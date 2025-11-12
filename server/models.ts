import db from './db';
import { format } from 'date-fns';
import { eq, desc, sql } from 'drizzle-orm';
import * as schema from './schema';

export class Repo {
  public static async getAll(): Promise<Repo[]> {
    const results = await db
      .select()
      .from(schema.repos)
      .orderBy(schema.repos.createdAt);
    return results as Repo[];
  }

  public static insert() {
    return db.insert(schema.repos);
  }
}

export interface Repo {
  name: string | null;
  fullName: string;
  createdAt: string | null;
  stargazersCount: number | null;
  prs30d: number | null;
  prs7d: number | null;
  commits30d: number | null;
  commits7d: number | null;
  avatarUrl: string | null;
  description: string | null;
}

export class PublicNode {
  public static async getAll(): Promise<PublicNode[]> {
    const nodes = await db
      .select()
      .from(schema.publicNodes)
      .orderBy(schema.publicNodes.endpoint);

    return nodes.map((node) => ({
      ...node,
      error: JSON.parse(node.error || 'null'),
    })) as PublicNode[];
  }

  public static insert() {
    return db.insert(schema.publicNodes);
  }
}

export interface PublicNode {
  endpoint: string | null;
  website: string | null;
  websocket: string | null;
  up: number | null;
  error: any;
  version: string | null;
  respTime: number | null;
  deprecated: number | null;
}

export class Commit {
  public static async latestEcosystem(): Promise<Commit[]> {
    const results = await db
      .select()
      .from(schema.commits)
      .where(sql`${schema.commits.repoFullName} != 'nanocurrency/nano-node'`)
      .orderBy(desc(schema.commits.date))
      .limit(50);
    return results as Commit[];
  }

  public static async activity(): Promise<ChartCommit[]> {
    const rows = await db
      .select({
        year: sql<number>`CAST(strftime('%Y', ${schema.commits.date}) AS INTEGER)`,
        week: sql<number>`CAST(strftime('%W', ${schema.commits.date}) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.commits)
      .groupBy(
        sql`CAST(strftime('%Y', ${schema.commits.date}) AS INTEGER)`,
        sql`CAST(strftime('%W', ${schema.commits.date}) AS INTEGER)`
      )
      .orderBy(
        sql`CAST(strftime('%Y', ${schema.commits.date}) AS INTEGER)`,
        sql`CAST(strftime('%W', ${schema.commits.date}) AS INTEGER)`
      );

    return rows.map((row: any) => ({
      date: `${row.year}|${format(
        new Date(row.year, 0, (row.week + 1) * 7),
        'w'
      )}`,
      count: row.count,
    }));
  }

  public static insert() {
    return db.insert(schema.commits);
  }
}

export interface Commit {
  repoFullName: string | null;
  author: string | null;
  message: string | null;
  avatarUrl: string | null;
  date: string | null;
}

export class NodeEvent {
  public static async getAll(): Promise<NodeEvent[]> {
    const events = await db
      .select()
      .from(schema.nodeEvents)
      .orderBy(desc(schema.nodeEvents.createdAt));

    return events.map((ev) => ({
      ...ev,
      event: JSON.parse(ev.event as any),
    })) as NodeEvent[];
  }

  public static insert() {
    return db.insert(schema.nodeEvents);
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
  type: string | null;
  author: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

export class Milestone {
  public static async getAll(): Promise<Milestone[]> {
    const results = await db.select().from(schema.milestones);
    return results as Milestone[];
  }

  public static insert() {
    return db.insert(schema.milestones);
  }
}

export interface Milestone {
  title: string | null;
  openIssues: number | null;
  closedIssues: number | null;
  createdAt: string | null;
  number: number | null;
  url: string | null;
}

export class Misc {
  public static async getAll(): Promise<Record<string, any>> {
    const res = await db.select().from(schema.misc);
    const misc = {} as Record<string, any>;
    res.forEach((m) => (misc[m.key!] = JSON.parse(m.value || 'null')));
    return misc;
  }

  public static async update(key: string, value: any): Promise<void> {
    await db
      .insert(schema.misc)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: schema.misc.key,
        set: { value: JSON.stringify(value) },
      });
  }
}

export interface Misc {
  spotlight: Repo;
  devFundLabels: string[];
  devFundData: number[];
  devFundDonors: Donor[];
}

export class Contributor {
  public static async getAll(): Promise<Contributor[]> {
    const reposNames = (
      await db
        .select()
        .from(schema.repos)
        .orderBy(desc(schema.repos.stargazersCount))
    ).map((r) => r.fullName);

    const contributors = await db
      .select()
      .from(schema.contributors)
      .leftJoin(
        schema.profiles,
        eq(schema.contributors.login, schema.profiles.login)
      )
      .orderBy(desc(schema.contributors.contributions));

    return contributors.map((c: any) => {
      const repos: string[] = JSON.parse(c.Contributors.repos || '[]');
      return {
        ...c.Contributors,
        ...c.Profiles,
        repos,
        hasPopularRepo: repos.some(
          (r) =>
            reposNames.indexOf(r) >= 0 &&
            reposNames.indexOf(r) < 15 &&
            r != 'nanocurrency/nano-node'
        ),
        created_at: null,
        nodeContributor: repos.includes('nanocurrency/nano-node'),
        bio: c.Profiles?.bio?.replace(
          /\[(.*?)\]\((.*?)\)/gim,
          "<a href='$2' target='_blank'>$1</a>"
        ),
      };
    }) as Contributor[];
  }

  public static insert() {
    return db.insert(schema.contributors);
  }

  public static async createProfile(profile: any) {
    if (!profile) return;
    await db
      .insert(schema.profiles)
      .values({
        id: String(profile.id),
        bio: profile.bio || null,
        twitterUsername: profile.twitter_username || null,
        website: profile.blog || null,
        avatarUrl: profile.avatar_url || null,
        login: profile.login || null,
      })
      .onConflictDoNothing();
  }

  public static async updateProfile(
    profile: Partial<Profile>,
    login: string | undefined
  ) {
    if (!login) return;
    await db
      .update(schema.profiles)
      .set({
        bio: profile.bio,
        twitterUsername: profile.twitterUsername?.replace('@', ''),
        website: profile.website?.replace(/(http|https):\/\//i, ''),
        nanoAddress: profile.nanoAddress?.replace('@', '').trim(),
        ghSponsors: profile.ghSponsors,
        patreonUrl: profile.patreonUrl,
        goalTitle: profile.goalTitle,
        goalAmount: profile.goalAmount,
        goalNanoAddress: profile.goalNanoAddress?.replace('@', '').trim(),
        goalWebsite: profile.goalWebsite?.replace(/(http|https):\/\//i, ''),
        goalDescription: profile.goalDescription,
      })
      .where(eq(schema.profiles.login, login));
  }

  public static update(login: string, contributor: Contributor) {
    // Implementation if needed
  }
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
  lastMonth: number;
  repos: string[];
  profile?: Profile;
  hasPopularRepo: boolean;
  nodeContributor: boolean;
  //profile
  bio?: string;
  twitterUsername?: string;
  website?: string;
  nanoAddress?: string;
  ghSponsors?: number;
  patreonUrl?: string;
  goalTitle?: string;
  goalAmount?: number;
  goalNanoAddress?: string;
  goalWebsite?: string;
  goalDescription?: string;
}

export interface ChartCommit {
  count: number;
  date: string;
}

export interface Profile {
  id: string;
  login: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitterUsername: string | null;
  website: string | null;
  nanoAddress: string | null;
  ghSponsors: number | null;
  patreonUrl: string | null;
  goalTitle: string | null;
  goalAmount: number | null;
  goalNanoAddress: string | null;
  goalWebsite: string | null;
  goalDescription: string | null;
  createdAt: string | null;
}

export class Profile {
  public static async findByLogin(login: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.login, login))
      .limit(1);
    return (result[0] as Profile) || null;
  }

  public static async update(key: string, value: any): Promise<void> {
    await db
      .insert(schema.misc)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: schema.misc.key,
        set: { value: JSON.stringify(value) },
      });
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

export interface Log {
  id: number;
  jobRunId: number;
  timestamp: string;
  level: string;
  message: string;
  durationMs: number | null;
}

export interface CronJobRun {
  id: number;
  jobName: string;
  startTimestamp: string;
  endTimestamp: string | null;
  status: string;
  durationMs: number | null;
  logs: Log[];
}
