import { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { githubAuth } from '@hono/oauth-providers/github';
import { Session, sessionMiddleware } from 'hono-sessions';
import { BunSqliteStore } from 'node_modules/hono-sessions/esm/src/store/bun/BunSqliteStore'; // TODO fix path
import { z } from 'zod';
import {
  Commit,
  Contributor,
  Milestone,
  Misc,
  NodeEvent,
  PublicNode,
  Repo,
  Profile,
} from './models';

type Env = {
  Variables: {
    session: Session;
    session_key_rotation: boolean;
    user?: Profile;
    isAuthenticated?: () => boolean;
  };
};

const db = new Database('./db.sqlite');
const store = new BunSqliteStore(db, 'Sessions');
const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const session = c.get('session');
  const userLogin = JSON.parse(session.get('user') as string)?.['login'];

  c.set('isAuthenticated', () => session.sessionValid() && userLogin);
  c.set('user', Profile.findByLogin(userLogin));
  await next();
});

const app = new Hono<Env>()
  .use(
    cors({
      origin: [
        'http://127.0.0.1:8080',
        'http://localhost:4200',
        'https://nano.casa',
      ],
      credentials: true,
    })
  )
  .use(logger())
  .use(
    '*',
    sessionMiddleware({
      store,
      encryptionKey: Bun.env.SESSION_SECRET,
      expireAfterSeconds: 60 * 60 * 24 * 7,
      cookieOptions: {
        sameSite: 'none',
        path: '/',
        httpOnly: true,
        domain: '127.0.0.1',
      },
    })
  )
  .get(
    '/api/auth/github',
    githubAuth({
      client_id: Bun.env.GITHUB_CLIENT_ID,
      client_secret: Bun.env.GITHUB_CLIENT_SECRET,
      scope: [],
      oauthApp: true,
    }),
    async (c) => {
      const profile = c.get('user-github');
      Contributor.createProfile(profile);

      const session = c.get('session');
      session?.set('user', JSON.stringify(profile));
      console.log('user sesh', session.get('user'), getCookie(c, 'session'));

      c.header('Set-Cookie', JSON.stringify(getCookie(c, 'session'))); // TODO remove?
      return c.redirect('/');
    }
  )
  .get('/api/data', async (c) => {
    return c.json({
      repos: Repo.getAll(),
      commits: Commit.activity(),
      contributors: Contributor.getAll(),
      milestones: Milestone.getAll(),
      events: Commit.latestEcosystem(),
      nodeEvents: NodeEvent.getAll(),
      misc: Misc.getAll(),
      publicNodes: PublicNode.getAll(),
    });
  })
  .post(
    '/api/update-profile',
    authMiddleware,
    zValidator(
      'json',
      z.object({
        bio: z.nullable(z.string()),
        twitter_username: z.nullable(z.string()),
        website: z.nullable(z.string()),
        nano_address: z.nullable(z.string()),
        gh_sponsors: z.nullable(z.boolean()),
        patreon_url: z.nullable(z.string()),
        goal_title: z.nullable(z.string()),
        goal_amount: z.nullable(z.number()),
        goal_nano_address: z.nullable(z.string()),
        goal_website: z.nullable(z.string()),
        goal_description: z.nullable(z.string()),
      })
    ),
    (c) => {
      if (!c.var.isAuthenticated()) {
        return new Response('not logged in', {
          status: 401,
        });
      }

      Contributor.updateProfile(
        c.req.valid('json') as Partial<Profile>,
        c.var.user.login
      );

      return new Response('updated', {
        status: 201,
      });
    }
  )
  .get('/api/auth/user', authMiddleware, async (c) => {
    return c.json(c.var.user);
  })
  .get('/api/logout', async (c) => {
    c.var.session.deleteSession();
    return new Response();
  })
  .get('/api/ping', (c) => c.text('pong'))
  .get('/:filename{.+\\.(js|png|ico|css|svg)$}', async (c) => {
    const filePath = './dist/nano-casa' + new URL(c.req.url).pathname;
    const file = Bun.file(filePath);
    return new Response(file);
  })
  .get('/', async (c) => {
    const filePath = './dist/nano-casa/' + 'index.html';
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
    PRODUCTION: boolean;
  }
}

export type App = typeof app;
