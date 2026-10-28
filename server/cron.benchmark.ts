import { Database } from 'bun:sqlite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TABLES = ['repos', 'commits', 'milestones', 'node_events', 'public_nodes', 'misc'];

type RequestKind = 'rest' | 'graphql' | 'http';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.stack || error.message : String(error);
}

function tableCounts(database: Database) {
  return Object.fromEntries(
    TABLES.map((table) => [
      table,
      (database.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
    ])
  );
}

async function runBenchmark(projectDirectory: string) {
  const requests: Record<RequestKind, number> = { rest: 0, graphql: 0, http: 0 };
  const errors: string[] = [];
  const originalFetch = globalThis.fetch;
  const initialMemory = process.memoryUsage();
  let peakRss = initialMemory.rss;
  let peakHeap = initialMemory.heapUsed;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const parsed = new URL(url);
    const kind: RequestKind = parsed.hostname === 'api.github.com'
      ? parsed.pathname === '/graphql' ? 'graphql' : 'rest'
      : 'http';
    requests[kind]++;
    return originalFetch.call(globalThis, input, init);
  }) as typeof fetch;

  const sampler = setInterval(() => {
    const memory = process.memoryUsage();
    peakRss = Math.max(peakRss, memory.rss);
    peakHeap = Math.max(peakHeap, memory.heapUsed);
  }, 25);
  const started = performance.now();

  try {
    const { CronJobs } = await import(pathToFileURL(join(projectDirectory, 'server', 'cron.ts')).href);
    await new CronJobs().runFullRefresh();
  } catch (error) {
    errors.push(errorMessage(error));
  } finally {
    clearInterval(sampler);
    globalThis.fetch = originalFetch;
  }

  const sqlite = new Database('db.sqlite', { readonly: true });
  const counts = tableCounts(sqlite);
  sqlite.close();

  console.log('\nCron benchmark');
  console.table([{
    durationMs: Math.round(performance.now() - started),
    githubRest: requests.rest,
    githubGraphql: requests.graphql,
    githubTotal: requests.rest + requests.graphql,
    otherHttp: requests.http,
    peakRssMb: (peakRss / 1_048_576).toFixed(1),
    peakHeapMb: (peakHeap / 1_048_576).toFixed(1),
    errors: errors.length,
  }]);
  console.log('\nResults in temporary database');
  console.table(TABLES.map((table) => ({ table, rows: counts[table] })));

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

async function runIsolatedBenchmark() {
  const projectDirectory = process.cwd();
  const scriptPath = fileURLToPath(import.meta.url);
  await mkdir(join(projectDirectory, 'tmp'), { recursive: true });
  const temporaryDirectory = await mkdtemp(join(projectDirectory, 'tmp', 'cron-benchmark-'));
  const source = new Database(join(projectDirectory, 'db.sqlite'), { readonly: true });

  try {
    source.query('VACUUM INTO ?').run(join(temporaryDirectory, 'db.sqlite'));
  } finally {
    source.close();
  }

  try {
    console.log(`Running cron against a temporary copy in ${temporaryDirectory}`);
    const child = Bun.spawn({
      cmd: [process.execPath, scriptPath, '--runner', projectDirectory],
      cwd: temporaryDirectory,
      env: process.env,
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const runnerIndex = process.argv.indexOf('--runner');
if (runnerIndex >= 0) {
  await runBenchmark(process.argv[runnerIndex + 1]);
} else {
  await runIsolatedBenchmark();
}
