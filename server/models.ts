import db from './db';
import { format } from 'date-fns';
import { GitHubUser } from '@hono/oauth-providers/github';

export class Repo {
  public static getAll() {
    return db
      .query<Repo, []>('SELECT * FROM Repos ORDER BY created_at ASC')
      .all();
  }

  public static insert() {
    return db.prepare(`
      INSERT INTO Repos (name, full_name, created_at, stargazers_count, prs_30d, prs_7d, description, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
}

export interface Repo {
  name: string;
  full_name: string;
  created_at: string;
  stargazers_count: number;
  prs_30d: number;
  prs_7d: number;
  commits_30d: number;
  commits_7d: number;
  avatar_url: string;
  description: string;
}

export class PublicNode {
  public static getAll() {
    return db
      .query<PublicNode, []>('SELECT * FROM PublicNodes ORDER BY endpoint ASC')
      .all()
      .map((node) => ({ ...node, error: JSON.parse(node.error) }));
  }

  public static insert() {
    return db.prepare(`
      INSERT INTO PublicNodes (endpoint, website, websocket, up, resp_time, version, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }
}

export interface PublicNode {
  endpoint: string;
  website?: string;
  websocket?: string;
  up: boolean;
  error: any;
  version: string;
  resp_time: number;
}

export class Commit {
  public static latestEcosystem() {
    return db
      .query(
        `
      SELECT *
      FROM Commits
      WHERE repo_full_name != ?
      ORDER BY date DESC
      LIMIT ?
    `
      )
      .all('nanocurrency/nano-node', 50) as Commit[];
  }

  public static activity() {
    const result = db
      .query(
        `
        SELECT 
          CAST(strftime('%Y', date) AS INTEGER) AS year,
          CAST(strftime('%W', date) AS INTEGER) AS week,
          COUNT(*) AS count
        FROM Commits
        GROUP BY year, week
        ORDER BY year, week
      `
      )
      .all();

    const formattedResult = result.map((row: any) => ({
      date: `${row.year}|${format(
        new Date(row.year, 0, (row.week + 1) * 7),
        'w'
      )}`,
      count: row.count,
    }));
    return formattedResult;
  }

  public static insert() {
    return db.prepare(`
      INSERT INTO Commits (repo_full_name, author, date, message, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `);
  }
}

export interface Commit {
  repo_full_name: string;
  author: string;
  message: string;
  avatar_url: string;
  date: string;
}

export class NodeEvent {
  public static getAll() {
    return db
      .query<NodeEvent, []>(`SELECT * FROM NodeEvents ORDER BY created_at DESC`)
      .all()
      .map((ev) => ({ ...ev, event: JSON.parse(ev.event as any) }));
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO NodeEvents (event, type, author, avatar_url, created_at) VALUES (?,?,?,?,?)'
    );
  }
}

export interface NodeEvent {
  event: {
    title?: string;
    event_url: string;
    action: string;
    body?: string;
    ref?: string;
  };
  type: string;
  author: string;
  avatar_url: string;
  created_at: string;
}

export class Milestone {
  public static getAll() {
    return db.query<Milestone, []>(`SELECT * FROM Milestones`).all();
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO Milestones (title, open_issues, closed_issues, url, number) VALUES (?,?,?,?,?)'
    );
  }
}

export interface Milestone {
  title: string;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  number: number;
}

export class Misc {
  public static getAll() {
    const res = db
      .query<{ key: string; value: string }, []>(`SELECT * FROM Misc`)
      .all();
    const misc = {} as Record<string, Misc>;
    res.forEach((m) => (misc[m.key] = JSON.parse(m.value)));
    return misc;
  }

  public static update(key: string, value: any) {
    db.query(
      `
      INSERT INTO Misc (key, value) 
      VALUES (?1, ?2) 
      ON CONFLICT(key)
      DO UPDATE SET value = ?2
      WHERE key = ?1`
    ).run(key, JSON.stringify(value));
  }
}

export interface Misc {
  spotlight: Repo;
  devFundLabels: string[];
  devFundData: number[];
  devFundDonors: Donor[];
}

export class Contributor {
  public static getAll() {
    const reposNames = db
      .query<Repo, []>('SELECT * FROM Repos ORDER BY stargazers_count DESC')
      .all()
      .map((r) => r.full_name);
    return db
      .query<Contributor, []>(
        `SELECT * FROM Profiles p
          RIGHT JOIN Contributors c
          USING (login)
        ORDER BY
          c.contributions DESC;`
      )
      .all()
      .map((c: Contributor) => {
        const repos: string[] = JSON.parse(c.repos as unknown as string);
        return {
          ...c,
          repos,
          hasPopularRepo: repos.some(
            (r) =>
              reposNames.indexOf(r) >= 0 &&
              reposNames.indexOf(r) < 15 &&
              r != 'nanocurrency/nano-node'
          ),
          created_at: null,
          nodeContributor: repos.includes('nanocurrency/nano-node'),
          bio: c.bio?.replace(
            /\[(.*?)\]\((.*?)\)/gim,
            "<a href='$2' target='_blank'>$1</a>"
          ),
        };
      });
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO Contributors (avatar_url, login, contributions, last_month, repos) VALUES (?,?,?,?,?)'
    );
  }

  public static createProfile(profile: Partial<GitHubUser> | undefined) {
    if (!profile) return;
    db.prepare(
      `INSERT OR IGNORE INTO Profiles (bio, twitter_username, website, login, avatar_url) VALUES ($bio, $twitter, $website, $login, $avatar)`
    ) //@ts-ignore
      .run({
        $bio: profile.bio,
        $twitter: profile.twitter_username,
        $website: profile.blog,
        $avatar: profile.avatar_url,
        $login: profile.login,
      });
  }

  public static updateProfile(
    profile: Partial<Profile>,
    login: string | undefined
  ) {
    if (!login) return;
    db.prepare(
      `UPDATE Profiles
       SET 
          bio = $bio,
          twitter_username = $twitter_username,
          website = $website,
          nano_address = $nano_address,
          gh_sponsors = $gh_sponsors,
          patreon_url = $patreon_url,
          goal_title = $goal_title,
          goal_amount = $goal_amount,
          goal_nano_address = $goal_nano_address,
          goal_website = $goal_website,
          goal_description = $goal_description
       WHERE login = $login`
    ) //@ts-ignore
      .run({
        $bio: profile.bio,
        $twitter_username: profile.twitter_username?.replace('@', ''),
        $website: profile.website?.replace(/(http|https):\/\//i, ''),
        $nano_address: profile.nano_address?.replace('@', '').trim(),
        $gh_sponsors: profile.gh_sponsors,
        $patreon_url: profile.patreon_url,
        $goal_title: profile.goal_title,
        $goal_amount: profile.goal_amount,
        $goal_nano_address: profile.goal_nano_address?.replace('@', '').trim(),
        $goal_website: profile.goal_website?.replace(/(http|https):\/\//i, ''),
        $goal_description: profile.goal_description,
        $login: login,
      });
  }

  public static update(login: string, contributor: Contributor) {}
}

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  last_month: number;
  repos: string[];
  profile: Profile;
  hasPopularRepo: boolean;
  nodeContributor: boolean;
  //profile
  bio?: string;
  twitter_username?: string;
  website?: string;
  nano_address?: string;
  gh_sponsors?: boolean;
  patreon_url?: string;
  goal_title?: string;
  goal_amount?: number;
  goal_nano_address?: string;
  goal_website?: string;
  goal_description?: string;
}

export interface ChartCommit {
  count: number;
  date: string;
}

export interface Profile {
  id: string;
  login: string;
  avatar_url: string; //deprecated
  bio: string;
  twitter_username: string;
  website: string;
  nano_address: string;
  gh_sponsors: boolean;
  patreon_url: string;
  goal_title: string | null;
  goal_amount: number;
  goal_nano_address: string;
  goal_website: string | null;
  goal_description: string | null;
}

export class Profile {
  public static findByLogin(login: string) {
    return db
      .query<Profile, {}>(`SELECT * FROM Profiles WHERE login = ? LIMIT 1`)
      .get(login);
  }

  public static update(key: string, value: any) {
    db.query(
      `
      INSERT INTO Misc (key, value) 
      VALUES (?1, ?2) 
      ON CONFLICT(key)
      DO UPDATE SET value = ?2
      WHERE key = ?1`
    ).run(key, JSON.stringify(value));
  }
}

export interface Donor {
  account: string;
  amount_nano: number;
  username?: string;
  website?: string;
  twitter?: string;
  github?: string;
}
