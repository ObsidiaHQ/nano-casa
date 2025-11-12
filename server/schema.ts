import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const repos = sqliteTable('Repos', {
  fullName: text('full_name').primaryKey(),
  name: text('name'),
  createdAt: text('created_at'),
  stargazersCount: integer('stargazers_count'),
  prs30d: integer('prs_30d').default(0),
  prs7d: integer('prs_7d').default(0),
  commits30d: integer('commits_30d').default(0),
  commits7d: integer('commits_7d').default(0),
  description: text('description'),
  avatarUrl: text('avatar_url'),
});

export const commits = sqliteTable('Commits', {
  repoFullName: text('repo_full_name'),
  author: text('author'),
  date: text('date'),
  message: text('message'),
  avatarUrl: text('avatar_url'),
});

export const milestones = sqliteTable('Milestones', {
  title: text('title'),
  openIssues: integer('open_issues'),
  closedIssues: integer('closed_issues'),
  url: text('url'),
  number: integer('number'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const profiles = sqliteTable('Profiles', {
  id: text('id').primaryKey().notNull(),
  login: text('login'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  twitterUsername: text('twitter_username'),
  website: text('website'),
  nanoAddress: text('nano_address'),
  ghSponsors: integer('gh_sponsors'),
  patreonUrl: text('patreon_url'),
  goalTitle: text('goal_title'),
  goalAmount: integer('goal_amount'),
  goalNanoAddress: text('goal_nano_address'),
  goalWebsite: text('goal_website'),
  goalDescription: text('goal_description'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const contributors = sqliteTable('Contributors', {
  login: text('login').primaryKey(),
  avatarUrl: text('avatar_url'),
  contributions: integer('contributions'),
  lastMonth: integer('last_month'),
  repos: text('repos'),
});

export const nodeEvents = sqliteTable('NodeEvents', {
  event: text('event'),
  type: text('type'),
  author: text('author'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at'),
});

export const publicNodes = sqliteTable('PublicNodes', {
  endpoint: text('endpoint'),
  website: text('website'),
  websocket: text('websocket'),
  up: integer('up'),
  respTime: integer('resp_time'),
  version: text('version'),
  error: text('error'),
  deprecated: integer('deprecated'),
});

export const misc = sqliteTable('Misc', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const cronJobRuns = sqliteTable('CronJobRuns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobName: text('job_name').notNull(),
  startTimestamp: text('start_timestamp').notNull(),
  endTimestamp: text('end_timestamp'),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
});

export const logs = sqliteTable('Logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobRunId: integer('job_run_id').notNull(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  message: text('message').notNull(),
  durationMs: integer('duration_ms'),
});

export const bounties = sqliteTable('Bounties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  deadline: text('deadline').notNull(),
  createdAt: text('created_at').notNull(),
  creator: text('creator').notNull(),
  reward: integer('reward').notNull(),
  status: text('status').notNull().default('open'),
});


