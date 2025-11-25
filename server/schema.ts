import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const repos = sqliteTable('repos', {
  fullName: text('full_name').primaryKey(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  stargazersCount: integer('stargazers_count'),
  prs30d: integer('prs_30d').default(0),
  prs7d: integer('prs_7d').default(0),
  commits30d: integer('commits_30d').default(0),
  commits7d: integer('commits_7d').default(0),
  description: text('description'),
  avatarUrl: text('avatar_url'),
});

export const commits = sqliteTable('commits', {
  repoFullName: text('repo_full_name'),
  author: text('author'),
  date: text('date'),
  message: text('message'),
  avatarUrl: text('avatar_url'),
}, (table) => [
  index('idx_commits_repo_date').on(table.repoFullName, table.date),
]);

export const milestones = sqliteTable('milestones', {
  title: text('title'),
  openIssues: integer('open_issues'),
  closedIssues: integer('closed_issues'),
  url: text('url'),
  number: integer('number'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
});

export const developerProfiles = sqliteTable('developer_profiles', {
  githubLogin: text('github_login').primaryKey(),
  userId: text('user_id').unique().references(() => user.id), // Nullable, Unique, removed PK
  bio: text('bio'),
  twitterUsername: text('twitter_username'),
  website: text('website'),
  nanoAddress: text('nano_address'),
  ghSponsors: integer('gh_sponsors', { mode: 'boolean' }),
  patreonUrl: text('patreon_url'),
  goalTitle: text('goal_title'),
  goalAmount: integer('goal_amount'),
  goalNanoAddress: text('goal_nano_address'),
  goalWebsite: text('goal_website'),
  goalDescription: text('goal_description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdateFn(() => new Date()),
});

export const nodeEvents = sqliteTable('node_events', {
  event: text('event'),
  type: text('type'),
  author: text('author'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
});

export const publicNodes = sqliteTable('public_nodes', {
  endpoint: text('endpoint'),
  website: text('website'),
  websocket: text('websocket'),
  up: integer('up'),
  respTime: integer('resp_time'),
  version: text('version'),
  error: text('error'),
  deprecated: integer('deprecated'),
});

export const misc = sqliteTable('misc', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const cronJobRuns = sqliteTable('cron_job_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobName: text('job_name').notNull(),
  startTimestamp: text('start_timestamp').notNull(),
  endTimestamp: text('end_timestamp'),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
});

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobRunId: integer('job_run_id').notNull(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  message: text('message').notNull(),
  durationMs: integer('duration_ms'),
});

// wip
export const bounties = sqliteTable('bounties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  deadline: text('deadline').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  creator: text('creator').notNull(),
  reward: integer('reward').notNull(),
  status: text('status').notNull().default('open'),
});

// Better-auth tables
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdateFn(() => new Date()),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdateFn(() => new Date()),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdateFn(() => new Date()),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdateFn(() => new Date()),
});


