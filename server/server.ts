import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createMiddleware } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { auth } from './auth';
import {
  Commit,
  Contributor,
  Milestone,
  Misc,
  NodeEvent,
  PublicNode,
  Repo,
  Profile,
  CronJobRun,
  Log,
} from './models';
import { BotsManager } from './bots';
import db from './db'; // Import db instance

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

const BM = new BotsManager();

const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
    await next();
    return;
  }

  c.set('user', session.user);
  c.set('session', session.session);
  await next();
});

const adminMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check if user is admin (you can adjust this logic as needed)
  const userLogin = session.user.email?.split('@')[0] || '';
  if (userLogin !== 'geommr') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }

  c.set('user', session.user);
  c.set('session', session.session);
  return await next();
});

const app = new Hono<Env>({ strict: false })
  .use(
    cors({
      origin: [
        'http://127.0.0.1:8080',
        'http://localhost:4200',
        'https://nano.casa',
      ],
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
    })
  )
  .use(logger())
  .on(['POST', 'GET'], '/api/auth/**', (c) => {
    return auth.handler(c.req.raw);
  })
  .get('/api/data', async (c) => {
    const data = {
      repos: await Repo.getAll(),
      commits: await Commit.activity(),
      contributors: await Contributor.getAll(),
      milestones: await Milestone.getAll(),
      events: await Commit.latestEcosystem(),
      nodeEvents: await NodeEvent.getAll(),
      misc: await Misc.getAll(),
      publicNodes: await PublicNode.getAll(),
    };
    return c.json(data);
  })
  .post(
    '/api/update-profile',
    authMiddleware,
    zValidator(
      'json',
      z.object({
        bio: z.nullable(z.string()),
        twitterUsername: z.nullable(z.string()),
        website: z.nullable(z.string()),
        nanoAddress: z.nullable(z.string()),
        ghSponsors: z.nullable(z.number()),
        patreonUrl: z.nullable(z.string()),
        goalTitle: z.nullable(z.string()),
        goalAmount: z.nullable(z.number()),
        goalNanoAddress: z.nullable(z.string()),
        goalWebsite: z.nullable(z.string()),
        goalDescription: z.nullable(z.string()),
      })
    ),
    async (c) => {
      const user = c.var.user;
      if (!user) {
        return new Response('not logged in', {
          status: 401,
        });
      }

      // Get the GitHub login from the user's account
      const login = user.email?.split('@')[0] || user.name || '';

      await Contributor.updateProfile(
        c.req.valid('json') as Partial<Profile>,
        login
      );

      return new Response('updated', {
        status: 201,
      });
    }
  )
  .post('/api/bounty', async (c) => {
    BM.notify(await c.req.json());
    return c.json({ msg: 'ok' });
  })
  .get('/api/auth/user', authMiddleware, async (c) => {
    const user = c.var.user;
    if (!user) {
      return c.json(null);
    }

    // Try to find the profile from our database
    const login = user.email?.split('@')[0] || user.name || '';
    const profile = await Profile.findByLogin(login);

    return c.json(profile || user);
  })
  .post('/api/logout', async (c) => {
    await auth.api.signOut({ headers: c.req.raw.headers });
    return c.json({ success: true });
  })
  .get('/api/ping', (c) => c.text('pong'))
  .get('/api/logs', adminMiddleware, async (c) => {
    const { cronJobRuns, logs: logsTable } = await import('./schema');
    const { desc, eq } = await import('drizzle-orm');

    const runs = await db.select().from(cronJobRuns).orderBy(desc(cronJobRuns.startTimestamp));
    const logs = await db.select().from(logsTable).orderBy(logsTable.timestamp);

    const runsWithLogs = runs.map(run => {
      return {
        ...run,
        logs: logs.filter(log => log.jobRunId === run.id)
      };
    });

    return c.json(runsWithLogs);
  })
  .get('/explorer', async (c) => {
    const filePath = './html/index.html';
    const file = Bun.file(filePath);
    return new Response(file);
  })
  .get('/:filename{.+\\.(js|png|ico|css|svg|map)$}', async (c) => {
    const filePath = './dist/nano-casa/browser' + new URL(c.req.url).pathname;
    const file = Bun.file(filePath);
    return new Response(file);
  })
  .get('/*', async (c) => {
    const filePath = './dist/nano-casa/browser' + '/index.html';
    const file = Bun.file(filePath);
    return new Response(file);
  });

export default {
  port: Bun.env.PORT,
  host: '127.0.0.1',
  fetch: app.fetch,
};

declare module 'bun' {
  interface Env {
    GITHUB_TOKEN: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    SESSION_SECRET: string;
    NANO_RPC_KEY: string;
    PORT: number;
    DISCORD_BOT_TOKEN: string;
    DISCORD_APP_ID: string;
    DISCORD_USER_ID: string;
  }
}

type CronJobRunWithLogsRow = {
  run_id: number;
  job_name: string;
  start_timestamp: string;
  end_timestamp: string;
  status: string;
  run_duration_ms: number;
  log_id: number | null;
  job_run_id: number | null;
  timestamp: string | null;
  level: string | null;
  message: string | null;
  log_duration_ms: number | null;
};
