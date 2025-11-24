import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import db from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  baseURL: Bun.env.NODE_ENV === 'production'
    ? 'https://nano.casa'
    : 'http://127.0.0.1:8080',
  trustedOrigins: [
    'http://127.0.0.1:8080',
    'http://localhost:4200',
    'https://nano.casa',
  ],
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: {
      clientId: Bun.env.GITHUB_CLIENT_ID as string,
      clientSecret: Bun.env.GITHUB_CLIENT_SECRET as string,
      mapProfileToUser: (profile) => {
        //console.log(profile);
        return {
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          website: profile.blog,
          twitter_username: profile.twitter_username,
          login: profile.login,
        };
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
});


