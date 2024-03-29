import { Database } from 'bun:sqlite';
const db = new Database('db.sqlite', { create: true });
db.exec('PRAGMA journal_mode = WAL;');

db.query(
  `
  CREATE TABLE IF NOT EXISTS Repos (
    full_name TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT,
    stargazers_count INTEGER,
    prs_30d INTEGER DEFAULT 0,
    prs_7d INTEGER DEFAULT 0,
    commits_30d INTEGER DEFAULT 0,
    commits_7d INTEGER DEFAULT 0,
    description TEXT,
    avatar_url TEXT
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS Commits (
    repo_full_name TEXT,
    author TEXT,
    date TEXT,
    message TEXT,
    avatar_url TEXT
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS Milestones (
    title TEXT,
    open_issues INTEGER,
    closed_issues INTEGER,
    url TEXT,
    number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS Profiles (
    login TEXT PRIMARY KEY,
    bio TEXT,
    twitter_username TEXT,
    website TEXT,
    nano_address TEXT,
    gh_sponsors INTEGER,
    patreon_url TEXT,
    goal_title TEXT,
    goal_amount DECIMAL,
    goal_nano_address TEXT,
    goal_website TEXT,
    goal_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS Contributors (
    login TEXT PRIMARY KEY,
    avatar_url TEXT,
    contributions INTEGER,
    last_month INTEGER,
    repos TEXT
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS NodeEvents (
    event TEXT,
    type TEXT,
    author TEXT,
    avatar_url TEXT,
    created_at TEXT
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS PublicNodes (
    endpoint TEXT,
    website TEXT,
    websocket TEXT,
    up INTEGER,
    resp_time INTEGER,
    version TEXT,
    error TEXT
  )
`
).run();

db.query(
  `
  CREATE TABLE IF NOT EXISTS Misc (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`
).run();

export default db;
