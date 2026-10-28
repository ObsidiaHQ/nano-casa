import { Cron } from 'croner';
import { Octokit } from 'octokit';
import { eq, sql } from 'drizzle-orm';
import { Misc, Donor, Repo } from './models';
import db from './db';
import * as schema from './schema';
import REPOS from './repos.json';
import { HttpClient, nativeHttp } from './http';

const COMMIT_SINCE = '2014-05-01T14:49:25Z';
const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_CONCURRENCY = 6;
const EVENT_TYPES = [
  'PullRequestEvent',
  'IssueCommentEvent',
  'IssuesEvent',
  'CommitCommentEvent',
  'PushEvent',
  'ReleaseEvent',
  'PullRequestReviewEvent',
  'PullRequestReviewCommentEvent',
];

export interface GitHubClient {
  request(route: string, parameters?: Record<string, unknown>): Promise<{ data: any }>;
  graphql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface CronDependencies {
  octo?: GitHubClient;
  database?: typeof db;
  http?: HttpClient;
  now?: () => Date;
  random?: () => number;
  batchSize?: number;
  concurrency?: number;
  onRequest?: (kind: 'github-rest' | 'github-graphql' | 'http', target: string) => void;
}

export interface RefreshedRepo {
  name: string;
  full_name: string;
  html_url: string;
  createdAt: Date;
  stargazers_count: number;
  avatar_url: string | null;
  prs_30d: number;
  prs_7d: number;
  description: string | null;
}

interface StagedCommit {
  sha: string;
  repoOrder: number;
  repoFullName: string;
  author: string | null;
  date: string | null;
  message: string | null;
  avatarUrl: string | null;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function splitRepoName(fullName: string): [string, string] {
  const separator = fullName.indexOf('/');
  return [fullName.slice(0, separator), fullName.slice(separator + 1)];
}

function formatEvent(item: any) {
  switch (item.type) {
    case 'CommitCommentEvent':
      return {
        action: 'commented commit',
        ref: item.payload.comment.commit_id,
        event_url: item.payload.comment.html_url,
        body: item.payload.comment.body,
      };
    case 'IssueCommentEvent':
      return {
        action: 'commented issue',
        ref: item.payload.issue.number,
        event_url: item.payload.comment.html_url,
        title: item.payload.issue.title,
        body: item.payload.comment.body,
      };
    case 'IssuesEvent':
      return {
        action: `${item.payload.action} issue`,
        ref: item.payload.issue.number,
        event_url: item.payload.issue.html_url,
        title: item.payload.issue.title,
      };
    case 'PullRequestEvent':
      return {
        action: `${item.payload.action.replace('_', ' ')} pr`,
        ref: item.payload.pull_request.number,
        title: item.payload.pull_request.number,
        event_url: item.payload.pull_request.url,
        body: item.payload.pull_request.body,
      };
    case 'PullRequestReviewEvent':
      return {
        action: `${item.payload.review.state.replace('_', ' ')} pr`,
        ref: item.payload.pull_request.number,
        title: `#${item.payload.pull_request.number}`,
        body: item.payload.review.body,
        event_url: item.payload.review.html_url,
      };
    case 'PullRequestReviewCommentEvent':
      return {
        action: 'commented pr review',
        ref: item.payload.pull_request.number,
        event_url: item.payload.comment.html_url,
        title: item.payload.pull_request.title,
        body: item.payload.comment.body,
      };
    case 'PushEvent':
      return {
        action: `pushed 1 commit to ${item.payload.ref.slice(item.payload.ref.lastIndexOf('/') + 1)}`,
        event_url: `https://github.com/nanocurrency/nano-node/commit/${item.payload.head}`,
        title: null,
      };
    case 'ReleaseEvent':
      return {
        action: 'published release',
        ref: item.payload.release.tag_name,
        title: item.payload.release.name,
        body: item.payload.release.body,
        event_url: item.payload.release.html_url,
      };
    default:
      return {};
  }
}

export class CronJobs {
  private readonly octo: GitHubClient;
  private readonly database: typeof db;
  private readonly http: HttpClient;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly onRequest?: CronDependencies['onRequest'];
  private readonly activeTasks = new Map<string, Promise<unknown>>();

  constructor(dependencies: CronDependencies = {}) {
    this.octo = dependencies.octo ?? new Octokit({ auth: Bun.env.GITHUB_TOKEN });
    this.database = dependencies.database ?? db;
    this.http = dependencies.http ?? nativeHttp;
    this.now = dependencies.now ?? (() => new Date());
    this.random = dependencies.random ?? Math.random;
    this.batchSize = dependencies.batchSize ?? DEFAULT_BATCH_SIZE;
    this.concurrency = dependencies.concurrency ?? DEFAULT_CONCURRENCY;
    this.onRequest = dependencies.onRequest;
  }

  private async request(route: string, parameters?: Record<string, unknown>) {
    this.onRequest?.('github-rest', route);
    return this.octo.request(route, parameters);
  }

  private async graphql(query: string, variables: Record<string, unknown> = {}) {
    this.onRequest?.('github-graphql', query.match(/query\s+(\w+)/)?.[1] ?? 'GraphQL');
    try {
      return await this.octo.graphql<any>(query, variables);
    } catch (error: any) {
      if (error?.data) {
        console.warn(`GitHub GraphQL partial failure: ${error.message}`);
        return error.data;
      }
      throw error;
    }
  }

  private async httpGet(url: string) {
    this.onRequest?.('http', url);
    return this.http.get(url);
  }

  private async httpPost(url: string, body: unknown, config?: Record<string, unknown>) {
    this.onRequest?.('http', url);
    return this.http.post(url, body, config);
  }

  async rate() {
    console.log((await this.request('GET /rate_limit')).data.resources.core);
  }

  async refreshMilestones() {
    console.time('refreshed_milestones');
    const milestones = (await this.request('GET /repos/nanocurrency/nano-node/milestones')).data;
    const latest = milestones
      .filter((m) => m.state == 'open' && m.title.toLowerCase().startsWith('v'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(({ title, open_issues, closed_issues, html_url, number }) => ({
        title,
        openIssues: open_issues,
        closedIssues: closed_issues,
        url: html_url,
        number,
      }))
      .sort((a, b) => b.title.localeCompare(a.title));

    await this.database.transaction(async (tx) => {
      await tx.delete(schema.milestones);
      for (const chunk of chunkArray(latest, 100)) {
        await tx.insert(schema.milestones).values(chunk);
      }
    });
    console.timeEnd('refreshed_milestones');
  }

  private async discoverRepositories(): Promise<string[]> {
    const names: string[] = [];
    const graphNames: string[] = [];
    const graphQuery = `query SearchRepositories($searchQuery: String!, $cursor: String) {
      search(query: $searchQuery, type: REPOSITORY, first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ... on Repository { nameWithOwner } }
      }
    }`;

    for (const configuredQuery of REPOS.queries) {
      await Promise.all([
        (async () => {
          let pageNumber = 1;
          let foundAll = false;
          while (!foundAll) {
            const repositories = (
              await this.request('GET /search/repositories', {
                q: configuredQuery,
                per_page: 100,
                page: pageNumber,
              })
            ).data.items;
            names.push(...repositories.map((repo) => repo.full_name));
            foundAll = repositories.length < 100;
            pageNumber++;
          }
        })(),
        (async () => {
          let cursor: string | null = null;
          do {
            const response = await this.graphql(graphQuery, {
              searchQuery: configuredQuery.replaceAll('+', ' '),
              cursor,
            });
            graphNames.push(...response.search.nodes.map((repo) => repo.nameWithOwner));
            cursor = response.search.pageInfo.hasNextPage ? response.search.pageInfo.endCursor : null;
          } while (cursor);
        })(),
      ]);
    }
    const trackedRepos = await this.database
      .select({ fullName: schema.repos.fullName })
      .from(schema.repos);
    names.push(...REPOS.known, ...trackedRepos.map((repo) => repo.fullName));

    const seen = new Set<string>();
    const uniqueNames = names.filter((name) => {
      if (seen.has(name) || REPOS.ignored.includes(name)) return false;
      seen.add(name);
      return true;
    });
    for (const name of graphNames) {
      if (!seen.has(name) && !REPOS.ignored.includes(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    }
    return uniqueNames;
  }

  private repositoryQuery(repositories: string[], cursors: Map<string, string | null>) {
    const declarations = repositories.flatMap((_, index) => {
      const cursor = cursors.get(repositories[index]);
      return [
        `$owner${index}: String!`,
        `$name${index}: String!`,
        ...(cursor ? [`$pullCursor${index}: String!`] : []),
      ];
    });
    const selections = repositories.map((fullName, index) => {
      const cursor = cursors.get(fullName);
      const metadata = cursor
        ? ''
        : `name nameWithOwner url createdAt stargazerCount description owner { avatarUrl }`;
      const after = cursor ? `, after: $pullCursor${index}` : '';
      return `repo${index}: repository(owner: $owner${index}, name: $name${index}) {
        ${metadata}
        pullRequests(first: 100, states: OPEN, orderBy: { field: CREATED_AT, direction: DESC }${after}) {
          pageInfo { hasNextPage endCursor }
          nodes { createdAt }
        }
      }`;
    });
    return {
      query: `query RepositoryBatch(${declarations.join(', ')}) { ${selections.join('\n')} }`,
      variables: Object.fromEntries(
        repositories.flatMap((fullName, index) => {
          const [owner, name] = splitRepoName(fullName);
          const cursor = cursors.get(fullName);
          return [
            [`owner${index}`, owner],
            [`name${index}`, name],
            ...(cursor ? [[`pullCursor${index}`, cursor]] : []),
          ];
        })
      ),
    };
  }

  private async refreshRepositoryBatch(
    repositories: string[],
    lastMonth: Date,
    lastWeek: Date
  ): Promise<RefreshedRepo[]> {
    const normalized = new Map<string, RefreshedRepo>();
    let active = [...repositories];
    const cursors = new Map<string, string | null>(repositories.map((name) => [name, null]));

    while (active.length > 0) {
      const request = this.repositoryQuery(active, cursors);
      const response = await this.graphql(request.query, request.variables);
      const next: string[] = [];

      active.forEach((fullName, index) => {
        const repository = response[`repo${index}`];
        if (!repository) {
          console.log(`Skipping unavailable repo ${fullName}`);
          return;
        }

        if (!normalized.has(fullName)) {
          normalized.set(fullName, {
            name: repository.name,
            full_name: repository.nameWithOwner,
            html_url: repository.url,
            createdAt: new Date(repository.createdAt),
            stargazers_count: repository.stargazerCount,
            avatar_url: repository.owner?.avatarUrl ?? null,
            prs_30d: 0,
            prs_7d: 0,
            description: repository.description,
          });
        }

        const repo = normalized.get(fullName)!;
        const pulls = repository.pullRequests.nodes;
        for (const pull of pulls) {
          const createdAt = new Date(pull.createdAt);
          if (createdAt > lastMonth) {
            repo.prs_30d++;
            if (createdAt > lastWeek) repo.prs_7d++;
          }
        }

        if (
          repository.pullRequests.pageInfo.hasNextPage &&
          pulls.length === 100 &&
          pulls.every((pull) => new Date(pull.createdAt) > lastMonth)
        ) {
          cursors.set(fullName, repository.pullRequests.pageInfo.endCursor);
          next.push(fullName);
        }
      });
      active = next;
    }

    return repositories.flatMap((name) => {
      const repo = normalized.get(name);
      return repo ? [repo] : [];
    });
  }

  async refreshRepos(): Promise<RefreshedRepo[]> {
    console.time('refreshed_repos');
    const now = this.now();
    const lastMonth = new Date(now);
    lastMonth.setDate(lastMonth.getDate() - 30);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const names = await this.discoverRepositories();
    const batches = chunkArray(names, this.batchSize);
    const results = await mapLimit(batches, this.concurrency, (batch) =>
      this.refreshRepositoryBatch(batch, lastMonth, lastWeek)
    );
    const canonicalNames = new Set<string>();
    const normalized = results.flat().filter((repo) => {
      if (canonicalNames.has(repo.full_name)) return false;
      canonicalNames.add(repo.full_name);
      return true;
    });

    await this.database.transaction(async (tx) => {
      await tx.delete(schema.repos);
      for (const chunk of chunkArray(normalized, 100)) {
        await tx.insert(schema.repos).values(
          chunk.map((repo) => ({
            name: repo.name,
            fullName: repo.full_name,
            createdAt: repo.createdAt,
            stargazersCount: repo.stargazers_count,
            prs30d: repo.prs_30d,
            prs7d: repo.prs_7d,
            description: repo.description,
            avatarUrl: repo.avatar_url,
          }))
        );
      }
    });
    console.timeEnd('refreshed_repos');
    return normalized;
  }

  private async stageCommits(commits: StagedCommit[]) {
    for (const chunk of chunkArray(commits, 100)) {
      if (chunk.length === 0) continue;
      const values = chunk.map(
        (commit) => sql`(${commit.sha}, ${commit.repoOrder}, ${commit.repoFullName}, ${commit.author}, ${commit.date}, ${commit.message}, ${commit.avatarUrl})`
      );
      await this.database.run(sql`INSERT INTO temp.cron_commits
        (sha, repo_order, repo_full_name, author, date, message, avatar_url)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT(sha) DO UPDATE SET
          repo_order = excluded.repo_order,
          repo_full_name = excluded.repo_full_name,
          author = excluded.author,
          date = excluded.date,
          message = excluded.message,
          avatar_url = excluded.avatar_url
        WHERE excluded.repo_order < cron_commits.repo_order`);
    }
  }

  private async refreshRepositoryCommits(repo: RefreshedRepo, order: number) {
    let pageNumber = 1;
    let foundAll = false;
    while (!foundAll) {
      let activity;
      try {
        activity = (
          await this.request(`GET /repos/${repo.full_name}/commits`, {
            per_page: 100,
            page: pageNumber,
            since: COMMIT_SINCE,
          })
        ).data;
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`Skipping commits for ${repo.full_name}: repo unavailable (404)`);
          break;
        }
        throw error;
      }

      const staged: StagedCommit[] = [];
      for (const commit of activity) {
        if (!commit.author) continue;
        staged.push({
          sha: commit.sha,
          repoOrder: order,
          repoFullName: repo.full_name,
          author: commit.author.login ?? null,
          date: commit.commit.author?.date ?? null,
          message: commit.commit.message ?? null,
          avatarUrl: commit.author.avatar_url || repo.avatar_url || null,
        });
      }
      await this.stageCommits(staged);
      foundAll = activity.length < 100;
      pageNumber++;
    }
  }

  async refreshCommitsAndContributors(repos: RefreshedRepo[] = []) {
    console.time('refreshed_commits');
    await this.database.run(sql`DROP TABLE IF EXISTS temp.cron_commits`);
    await this.database.run(sql`CREATE TEMP TABLE cron_commits (
      sha TEXT PRIMARY KEY,
      repo_order INTEGER NOT NULL,
      repo_full_name TEXT,
      author TEXT,
      date TEXT,
      message TEXT,
      avatar_url TEXT
    )`);

    try {
      const orderedRepos = repos.map((repo, order) => ({ repo, order }));
      await mapLimit(orderedRepos, this.concurrency, ({ repo, order }) =>
        this.refreshRepositoryCommits(repo, order)
      );

      const now = this.now();
      const lastMonth = new Date(now);
      lastMonth.setDate(lastMonth.getDate() - 30);
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const counts = await this.database.all<{ repoFullName: string; commits30d: number; commits7d: number }>(
        sql`SELECT repo_full_name AS repoFullName,
          SUM(CASE WHEN julianday(date) > julianday(${lastMonth.toISOString()}) THEN 1 ELSE 0 END) AS commits30d,
          SUM(CASE WHEN julianday(date) > julianday(${lastWeek.toISOString()}) THEN 1 ELSE 0 END) AS commits7d
          FROM temp.cron_commits GROUP BY repo_full_name`
      );

      await this.database.transaction(async (tx) => {
        for (const count of counts) {
          await tx
            .update(schema.repos)
            .set({ commits30d: count.commits30d, commits7d: count.commits7d })
            .where(eq(schema.repos.fullName, count.repoFullName));
        }
        await tx.delete(schema.commits);
        await tx.run(sql`INSERT INTO commits (repo_full_name, author, date, message, avatar_url)
          SELECT repo_full_name, author, date, message, avatar_url FROM temp.cron_commits`);
      });
    } finally {
      await this.database.run(sql`DROP TABLE IF EXISTS temp.cron_commits`);
      console.timeEnd('refreshed_commits');
    }
  }

  async refreshNodeEvents() {
    console.time('refreshed_node_events');
    const events = (await this.request('GET /repos/nanocurrency/nano-node/events', { per_page: 70 })).data
      .filter((event) => EVENT_TYPES.includes(event.type))
      .map((event) => ({
        event: JSON.stringify(formatEvent(event)),
        type: event.type,
        author: event.actor.login,
        avatarUrl: event.actor.avatar_url,
        createdAt: new Date(event.created_at),
      }));

    await this.database.transaction(async (tx) => {
      await tx.delete(schema.nodeEvents);
      for (const chunk of chunkArray(events, 100)) {
        await tx.insert(schema.nodeEvents).values(chunk);
      }
    });
    console.timeEnd('refreshed_node_events');
    return events;
  }

  async checkPublicNodes() {
    console.time('refreshed_public_nodes');
    const endpointStatuses = await Promise.all(
      REPOS.public_nodes.map(async (node) => {
        const start = Date.now();
        try {
          const res = await this.httpPost(node.endpoint, { action: 'version' }, { timeout: 2500 });
          return {
            endpoint: node.endpoint,
            website: node.website ?? null,
            websocket: node.websocket ?? null,
            up: 1,
            respTime: Date.now() - start,
            version: res.data.node_vendor,
            error: null,
          };
        } catch (error: any) {
          const errorMsg =
            error.code === 'ECONNABORTED'
              ? 'Timeout'
              : error.response?.data?.error || `Failed with status code ${error.response?.status}`;
          console.log(error.response?.data);
          return {
            endpoint: node.endpoint,
            website: node.website ?? null,
            websocket: node.websocket ?? null,
            up: (error.response?.status || 0) < 500 ? 1 : 0,
            respTime: Date.now() - start,
            version: null,
            error: JSON.stringify({ error: errorMsg }),
          };
        }
      })
    );

    await this.database.transaction(async (tx) => {
      await tx.delete(schema.publicNodes);
      for (const chunk of chunkArray(endpointStatuses, 100)) {
        await tx.insert(schema.publicNodes).values(chunk);
      }
    });
    console.timeEnd('refreshed_public_nodes');
  }

  async getDevFundHistory() {
    console.time('refreshed_dev_fund_history');
    const [knownResponse, historyResponse] = await Promise.all([
      this.httpGet('https://nano.to/known.json'),
      this.httpPost('https://rpc.nano.to', {
        action: 'account_history',
        account: '@Protocol_fund',
        count: '-1',
        reverse: true,
        key: Bun.env.NANO_RPC_KEY,
      }),
    ]);
    const knownMap = new Map<string, any>(knownResponse.data.map((obj) => [obj.name, obj]));
    const history = historyResponse.data.history;
    const balances = new Array(history.length);
    const labels = new Array(history.length);
    const donorsMap = {};
    const txSign = (type) => (type === 'send' ? -1 : 1);

    history.forEach((tx, i) => {
      labels[i] = new Date(parseInt(tx.local_timestamp) * 1000).toDateString();
      balances[i] = i === 0
        ? Math.round(parseFloat(tx.amount_nano))
        : Math.round(balances[i - 1] + parseFloat(tx.amount_nano) * txSign(tx.type));
      if (tx.type !== 'send') {
        if (tx.account in donorsMap) {
          donorsMap[tx.account].amount_nano += parseFloat(tx.amount_nano);
        } else {
          donorsMap[tx.account] = {
            account: tx.account,
            amount_nano: parseFloat(tx.amount_nano),
            username: tx.username || null,
          };
        }
      }
    });

    const donors = Object.values(donorsMap)
      .slice(1)
      .map((donor: Donor) => {
        if (!donor.username) return donor;
        const knownObj = knownMap.get(donor.username);
        return {
          ...donor,
          twitter: knownObj?.twitter || null,
          github: knownObj?.github || null,
          website: knownObj?.website || null,
        };
      })
      .sort((a, b) => b.amount_nano - a.amount_nano);

    await Promise.all([
      Misc.update('devFundData', balances),
      Misc.update('devFundLabels', labels),
      Misc.update('devFundDonors', donors),
    ]);
    console.timeEnd('refreshed_dev_fund_history');
  }

  async updateSpotlight() {
    const repos = (await Repo.getAll()).slice(15).filter((repo) => repo.description);
    const spotlight = repos[Math.floor(this.random() * repos.length)];
    await Misc.update('spotlight', spotlight);
  }

  private async runExclusive<T>(name: string, task: () => Promise<T>): Promise<T> {
    const active = this.activeTasks.get(name) as Promise<T> | undefined;
    if (active) return active;
    const promise = task();
    this.activeTasks.set(name, promise);
    try {
      return await promise;
    } finally {
      this.activeTasks.delete(name);
    }
  }

  runFullRefresh() {
    return this.runExclusive('full-refresh', async () => {
      const results = await Promise.allSettled([
        this.refreshMilestones(),
        this.getDevFundHistory(),
        this.checkPublicNodes(),
        this.runEventsRefresh(),
        (async () => {
          const repos = await this.refreshRepos();
          await this.refreshCommitsAndContributors(repos);
          await this.runSpotlightUpdate();
        })(),
      ]);
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
    });
  }

  runEventsRefresh() {
    return this.runExclusive('node-events', () => this.refreshNodeEvents());
  }

  runSpotlightUpdate() {
    return this.runExclusive('spotlight', () => this.updateSpotlight());
  }
}

const defaultCron = new CronJobs();

export const rate = () => defaultCron.rate();
export const refreshMilestones = () => defaultCron.refreshMilestones();
export const refreshRepos = () => defaultCron.refreshRepos();
export const refreshCommitsAndContributors = (repos: RefreshedRepo[] = []) =>
  defaultCron.refreshCommitsAndContributors(repos);
export const refreshNodeEvents = () => defaultCron.refreshNodeEvents();
export const checkPublicNodes = () => defaultCron.checkPublicNodes();
export const getDevFundHistory = () => defaultCron.getDevFundHistory();
export const updateSpotlight = () => defaultCron.updateSpotlight();
export const runFullRefresh = () => defaultCron.runFullRefresh();

export function startCronJobs(cron: CronJobs = defaultCron) {
  const jobs = [
    new Cron('19 * * * *', () => cron.runFullRefresh()),
    new Cron('*/24 * * * *', () => cron.runEventsRefresh()),
    new Cron('0 0 * * *', () => cron.runSpotlightUpdate()),
  ];
  return {
    jobs,
    stop: () => jobs.forEach((job) => job.stop()),
  };
}

if (import.meta.main) startCronJobs();
