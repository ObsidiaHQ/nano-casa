import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers'
import { serveStatic } from 'hono/bun';
import { createMiddleware } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { auth } from './auth';
import {
  Commit,
  Contributor,
  DeveloperProfile,
  Milestone,
  Misc,
  NodeEvent,
  PublicNode,
  Repo
} from './models';
import db from './db';
import { developerProfiles, account } from './schema';

type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

const adminMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userLogin = (await DeveloperProfile.findByUserId(session.user.id))?.githubLogin || '';
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
        'https://nano.org',
      ],
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
    })
  )
  .use(logger())
  .use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://goal.nano.to", "https://net.obsidia.io", "'unsafe-inline'"],
      scriptSrcElem: ["'self'", "https://goal.nano.to", "https://net.obsidia.io", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://api.fonts.coollabs.io", "https://cdn.fonts.coollabs.io"],
      styleSrc: ["'self'", "https://api.fonts.coollabs.io", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://net.obsidia.io", "https://goal.nano.to", "https://rpc.nano.to"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  }))
  .use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set("user", null);
      c.set("session", null);
      await next();
      return;
    }

    c.set("user", session.user);
    c.set("session", session.session);
    await next();
  })
  .get('/api/auth/user', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json(null);
    }

    const githubAccount = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, user.id),
          eq(account.providerId, 'github')
        )
      )
      .limit(1);

    if (!githubAccount[0]) {
      return c.json(null);
    }

    let profile = await DeveloperProfile.findByUserId(user?.id);

    if (!profile) {
      const accountInfo = await auth.api.accountInfo({ headers: c.req.raw.headers, body: { accountId: githubAccount[0].accountId } });
      await DeveloperProfile.createOrUpdate(user.id, {
        githubLogin: accountInfo.user.login,
        bio: accountInfo.user.bio,
        twitterUsername: accountInfo.user.twitter_username,
        website: accountInfo.user.website,
      });
      profile = await DeveloperProfile.findByUserId(user.id);
    }

    return c.json({
      // User info (required fields)
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      isDeveloper: !!profile,
      // Profile data (if exists)
      githubLogin: profile?.githubLogin,
      bio: profile?.bio || null,
      twitterUsername: profile?.twitterUsername || null,
      website: profile?.website || null,
      nanoAddress: profile?.nanoAddress || null,
      ghSponsors: profile?.ghSponsors || null,
      patreonUrl: profile?.patreonUrl || null,
      goalTitle: profile?.goalTitle || null,
      goalAmount: profile?.goalAmount || null,
      goalNanoAddress: profile?.goalNanoAddress || null,
      goalWebsite: profile?.goalWebsite || null,
      goalDescription: profile?.goalDescription || null,
      createdAt: profile?.createdAt || null,
      updatedAt: profile?.updatedAt || null,
      // Computed stats (only if developer profile exists)
      contributions: profile?.contributions,
      lastMonth: profile?.lastMonth,
      repos: profile?.repos,
      hasPopularRepo: profile?.hasPopularRepo,
      nodeContributor: profile?.nodeContributor,
    });
  })
  .on(['POST', 'GET'], '/api/auth/*', (c) => {
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
    zValidator(
      'json',
      z.object({
        bio: z.nullable(z.string()),
        twitterUsername: z.nullable(z.string()),
        website: z.nullable(z.string().transform(val => val?.replace(/(http|https):\/\//i, '') || null)),
        nanoAddress: z.nullable(z.string().regex(/^(nano_|xrb_)/).optional()),
        ghSponsors: z.nullable(z.boolean()),
        patreonUrl: z.nullable(z.string()),
        goalTitle: z.nullable(z.string()),
        goalAmount: z.nullable(z.number().min(0)),
        goalNanoAddress: z.nullable(z.string().regex(/^(nano_|xrb_)/).optional()),
        goalWebsite: z.nullable(z.string().transform(val => val?.replace(/(http|https):\/\//i, '') || null)),
        goalDescription: z.nullable(z.string()),
      })
    ),
    async (c) => {
      const user = c.get('user');
      if (!user) {
        return new Response('not logged in', {
          status: 401,
        });
      }

      await db.update(developerProfiles).set({
        ...c.req.valid('json'),
      }).where(eq(developerProfiles.userId, user.id));

      return c.json({ success: true });
    }
  )
  // .post('/api/bounty', async (c) => {
  //   BM.notify(await c.req.json());
  //   return c.json({ msg: 'ok' });
  // })
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
  .use('/*', serveStatic({ root: './nano-casa/browser' }))
  .get('*', (c) => {
    return new Response(Bun.file('./nano-casa/browser/index.html'));
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
