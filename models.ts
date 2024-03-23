import {
  ICommit,
  IContributor,
  IMilestone,
  INodeEvent,
  IProfile,
  IPublicNode,
  IRepo,
} from 'interfaces';
import db from './db';
import { format } from 'date-fns';

export class Repo {
  public static getAll() {
    return db
      .query<IRepo, []>('SELECT * FROM Repos ORDER BY created_at ASC')
      .all();
  }

  public static insert() {
    return db.prepare(`
      INSERT INTO Repos (name, full_name, created_at, stargazers_count, prs_30d, prs_7d, description, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
}

export class PublicNode {
  public static getAll() {
    return db
      .query<IPublicNode, []>('SELECT * FROM PublicNodes ORDER BY endpoint ASC')
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

export class Commit {
  public static latestEcosystem() {
    return db
      .query(
        `
      SELECT repo_full_name, author, date, message, avatar_url
      FROM Commits
      WHERE repo_full_name != ?
      ORDER BY date DESC
      LIMIT ?
    `
      )
      .all('nanocurrency/nano-node', 50) as ICommit[];
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

export class NodeEvent {
  public static getAll() {
    return db
      .query<INodeEvent, []>(
        `SELECT * FROM NodeEvents ORDER BY created_at DESC`
      )
      .all()
      .map((ev) => ({ ...ev, event: JSON.parse(ev.event as any) }));
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO NodeEvents (event, type, author, avatar_url, created_at) VALUES (?,?,?,?,?)'
    );
  }
}

export class Milestone {
  public static getAll() {
    return db.query<IMilestone, []>(`SELECT * FROM Milestones`).all();
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO Milestones (title, open_issues, closed_issues, url, number) VALUES (?,?,?,?,?)'
    );
  }
}

export class Misc {
  public static getAll() {
    const res = db
      .query<{ key: string; value: string }, []>(`SELECT * FROM Misc`)
      .all();
    const misc = {} as Misc satisfies Misc;
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

export class Contributor {
  public static getAll() {
    const reposNames = db
      .query<IRepo, []>('SELECT * FROM Repos ORDER BY stargazers_count DESC')
      .all()
      .map((r) => r.full_name);
    return db
      .query<IContributor, []>(
        `SELECT * FROM (
            SELECT * FROM Contributors
          ) AS c
          LEFT JOIN (
            SELECT * FROM Profiles
          ) AS p ON c.login = p.login
        ORDER BY
          c.contributions DESC;`
      )
      .all()
      .map((c: any) => {
        const repos = JSON.parse(c.repos);
        return {
          ...c,
          repos,
          hasPopularRepo: repos.some(
            (r) =>
              reposNames.indexOf(r) >= 0 &&
              reposNames.indexOf(r) < 15 &&
              r != 'nanocurrency/nano-node'
          ),
          nodeContributor: repos.includes('nanocurrency/nano-node'),
        };
      });
  }

  public static insert() {
    return db.prepare(
      'INSERT INTO Contributors (avatar_url, login, contributions, last_month, repos) VALUES (?,?,?,?,?)'
    );
  }

  public static updateProfile(login: string, profile: IProfile) {}

  public static update(login: string, contributor: IContributor) {}
}
