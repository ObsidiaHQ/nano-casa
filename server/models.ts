import db from './db';
import { format } from 'date-fns';
import { eq, desc, sql } from 'drizzle-orm';
import * as schema from './schema';

export class Repo {
  public static async getAll(): Promise<Repo[]> {
    const maxCommitDates = db
      .select({
        repoFullName: schema.commits.repoFullName,
        maxDate: sql<string>`MAX(${schema.commits.date})`.as('max_date'),
      })
      .from(schema.commits)
      .groupBy(schema.commits.repoFullName)
      .as('max_commit_dates');

    const results = await db
      .select({
        name: schema.repos.name,
        fullName: schema.repos.fullName,
        createdAt: schema.repos.createdAt,
        stargazersCount: schema.repos.stargazersCount,
        prs30d: schema.repos.prs30d,
        prs7d: schema.repos.prs7d,
        commits30d: schema.repos.commits30d,
        commits7d: schema.repos.commits7d,
        avatarUrl: schema.repos.avatarUrl,
        description: schema.repos.description,
        mostRecentCommit: maxCommitDates.maxDate,
      })
      .from(schema.repos)
      .leftJoin(maxCommitDates, eq(maxCommitDates.repoFullName, schema.repos.fullName))
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
  createdAt: Date | null;
  stargazersCount: number | null;
  prs30d: number | null;
  prs7d: number | null;
  commits30d: number | null;
  commits7d: number | null;
  avatarUrl: string | null;
  description: string | null;
  mostRecentCommit: string | null;
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
  createdAt: Date | null;
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
  createdAt: Date | null;
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


export interface ChartCommit {
  count: number;
  date: string;
}

export class Contributor {
  public static async getAll(): Promise<ContributorWithProfile[]> {
    const reposNames = (
      await db
        .select()
        .from(schema.repos)
        .orderBy(desc(schema.repos.stargazersCount))
    ).map((r) => r.fullName);

    // Get all unique contributors from commits
    const contributorStats = await db
      .select({
        githubLogin: schema.commits.author,
        contributions: sql<number>`COUNT(*)`,
        lastMonth: sql<number>`SUM(CASE WHEN ${schema.commits.date} >= date('now', '-30 days') THEN 1 ELSE 0 END)`,
        repos: sql<string>`GROUP_CONCAT(DISTINCT ${schema.commits.repoFullName})`,
        avatarUrl: sql<string>`MAX(${schema.commits.avatarUrl})`,
      })
      .from(schema.commits)
      .groupBy(schema.commits.author)
      .orderBy(desc(sql`COUNT(*)`));

    // Get all developer profiles
    const profiles = await db
      .select()
      .from(schema.developerProfiles)
      .leftJoin(schema.user, eq(schema.developerProfiles.userId, schema.user.id));

    // Create a map of githubLogin -> profile
    const profileMap = new Map();
    profiles.forEach((p) => {
      if (p.developer_profiles) {
        profileMap.set(p.developer_profiles.githubLogin, {
          ...p.developer_profiles,
          userName: p.user?.name,
          userEmail: p.user?.email,
          userImage: p.user?.image,
        });
      }
    });

    // Combine contributor stats with profile data
    const result: ContributorWithProfile[] = contributorStats.map((stat) => {
      const repos: string[] = stat.repos ? stat.repos.split(',') : [];
      const hasPopularRepo = repos.some(
        (r) =>
          reposNames.indexOf(r) >= 0 &&
          reposNames.indexOf(r) < 15 &&
          r !== 'nanocurrency/nano-node'
      );

      const profile = profileMap.get(stat.githubLogin);

      return {
        githubLogin: stat.githubLogin,
        avatarUrl: stat.avatarUrl,
        contributions: stat.contributions,
        lastMonth: stat.lastMonth,
        repos,
        hasPopularRepo,
        nodeContributor: repos.includes('nanocurrency/nano-node'),
        // Profile data (if exists)
        userId: profile?.userId || null,
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
        name: profile?.userName || null,
        email: profile?.userEmail || null,
        image: profile?.userImage || stat.avatarUrl,
      };
    });

    return result;
  }
}

export interface ContributorWithProfile {
  githubLogin: string;
  avatarUrl: string;
  contributions: number;
  lastMonth: number;
  repos: string[];
  hasPopularRepo: boolean;
  nodeContributor: boolean;
  // Profile data (nullable - only if user has logged in)
  userId: string | null;
  bio: string | null;
  twitterUsername: string | null;
  website: string | null;
  nanoAddress: string | null;
  ghSponsors: boolean | null;
  patreonUrl: string | null;
  goalTitle: string | null;
  goalAmount: number | null;
  goalNanoAddress: string | null;
  goalWebsite: string | null;
  goalDescription: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
}

export class DeveloperProfile {
  public static async getAll(): Promise<DeveloperProfileWithStats[]> {
    const reposNames = (
      await db
        .select()
        .from(schema.repos)
        .orderBy(desc(schema.repos.stargazersCount))
    ).map((r) => r.fullName);

    // Get all developer profiles with user info
    const profiles = await db
      .select()
      .from(schema.developerProfiles)
      .leftJoin(schema.user, eq(schema.developerProfiles.userId, schema.user.id))
      .leftJoin(
        schema.account,
        sql`${schema.account.userId} = ${schema.developerProfiles.userId} AND ${schema.account.providerId} = 'github'`
      );

    // Compute stats from commits for each developer
    const result: DeveloperProfileWithStats[] = [];

    for (const profile of profiles) {
      const githubLogin = profile.developer_profiles.githubLogin;

      // Get commit stats
      const commitStats = await db
        .select({
          count: sql<number>`COUNT(*)`,
          repos: sql<string>`GROUP_CONCAT(DISTINCT ${schema.commits.repoFullName})`,
        })
        .from(schema.commits)
        .where(eq(schema.commits.author, githubLogin));

      // Get last month contributions
      const lastMonthStats = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(schema.commits)
        .where(
          sql`${schema.commits.author} = ${githubLogin} AND ${schema.commits.date} >= date('now', '-30 days')`
        );

      const repos: string[] = commitStats[0]?.repos
        ? commitStats[0].repos.split(',')
        : [];

      const hasPopularRepo = repos.some(
        (r) =>
          reposNames.indexOf(r) >= 0 &&
          reposNames.indexOf(r) < 15 &&
          r !== 'nanocurrency/nano-node'
      );

      result.push({
        userId: profile.developer_profiles.userId,
        githubLogin: profile.developer_profiles.githubLogin,
        bio: profile.developer_profiles.bio,
        twitterUsername: profile.developer_profiles.twitterUsername,
        website: profile.developer_profiles.website,
        nanoAddress: profile.developer_profiles.nanoAddress,
        ghSponsors: profile.developer_profiles.ghSponsors,
        patreonUrl: profile.developer_profiles.patreonUrl,
        goalTitle: profile.developer_profiles.goalTitle,
        goalAmount: profile.developer_profiles.goalAmount,
        goalNanoAddress: profile.developer_profiles.goalNanoAddress,
        goalWebsite: profile.developer_profiles.goalWebsite,
        goalDescription: profile.developer_profiles.goalDescription,
        createdAt: profile.developer_profiles.createdAt,
        updatedAt: profile.developer_profiles.updatedAt,
        // User info
        name: profile.user?.name || null,
        email: profile.user?.email || null,
        image: profile.user?.image || null,
        // Computed stats
        contributions: commitStats[0]?.count || 0,
        lastMonth: lastMonthStats[0]?.count || 0,
        repos,
        hasPopularRepo,
        nodeContributor: repos.includes('nanocurrency/nano-node'),
      });
    }

    return result.sort((a, b) => b.contributions - a.contributions);
  }

  public static async findByGithubLogin(
    githubLogin: string
  ): Promise<DeveloperProfileWithStats | null> {
    const profile = await db
      .select()
      .from(schema.developerProfiles)
      .leftJoin(schema.user, eq(schema.developerProfiles.userId, schema.user.id))
      .where(eq(schema.developerProfiles.githubLogin, githubLogin))
      .limit(1);

    if (!profile[0]) return null;

    const reposNames = (
      await db
        .select()
        .from(schema.repos)
        .orderBy(desc(schema.repos.stargazersCount))
    ).map((r) => r.fullName);

    // Get commit stats
    const commitStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        repos: sql<string>`GROUP_CONCAT(DISTINCT ${schema.commits.repoFullName})`,
      })
      .from(schema.commits)
      .where(eq(schema.commits.author, githubLogin));

    // Get last month contributions
    const lastMonthStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.commits)
      .where(
        sql`${schema.commits.author} = ${githubLogin} AND ${schema.commits.date} >= date('now', '-30 days')`
      );

    const repos: string[] = commitStats[0]?.repos
      ? commitStats[0].repos.split(',')
      : [];

    const hasPopularRepo = repos.some(
      (r) =>
        reposNames.indexOf(r) >= 0 &&
        reposNames.indexOf(r) < 15 &&
        r !== 'nanocurrency/nano-node'
    );

    return {
      userId: profile[0].developer_profiles.userId,
      githubLogin: profile[0].developer_profiles.githubLogin,
      bio: profile[0].developer_profiles.bio,
      twitterUsername: profile[0].developer_profiles.twitterUsername,
      website: profile[0].developer_profiles.website,
      nanoAddress: profile[0].developer_profiles.nanoAddress,
      ghSponsors: profile[0].developer_profiles.ghSponsors,
      patreonUrl: profile[0].developer_profiles.patreonUrl,
      goalTitle: profile[0].developer_profiles.goalTitle,
      goalAmount: profile[0].developer_profiles.goalAmount,
      goalNanoAddress: profile[0].developer_profiles.goalNanoAddress,
      goalWebsite: profile[0].developer_profiles.goalWebsite,
      goalDescription: profile[0].developer_profiles.goalDescription,
      createdAt: profile[0].developer_profiles.createdAt,
      updatedAt: profile[0].developer_profiles.updatedAt,
      // User info
      name: profile[0].user?.name || null,
      email: profile[0].user?.email || null,
      image: profile[0].user?.image || null,
      // Computed stats
      contributions: commitStats[0]?.count || 0,
      lastMonth: lastMonthStats[0]?.count || 0,
      repos,
      hasPopularRepo,
      nodeContributor: repos.includes('nanocurrency/nano-node'),
    };
  }

  public static async findByUserId(
    userId: string
  ): Promise<DeveloperProfileWithStats | null> {
    const profile = await db
      .select()
      .from(schema.developerProfiles)
      .leftJoin(schema.user, eq(schema.developerProfiles.userId, schema.user.id))
      .where(eq(schema.developerProfiles.userId, userId))
      .limit(1);

    if (!profile[0]) return null;

    const githubLogin = profile[0].developer_profiles.githubLogin;
    const reposNames = (
      await db
        .select()
        .from(schema.repos)
        .orderBy(desc(schema.repos.stargazersCount))
    ).map((r) => r.fullName);

    // Get commit stats
    const commitStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        repos: sql<string>`GROUP_CONCAT(DISTINCT ${schema.commits.repoFullName})`,
      })
      .from(schema.commits)
      .where(eq(schema.commits.author, githubLogin));

    // Get last month contributions
    const lastMonthStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.commits)
      .where(
        sql`${schema.commits.author} = ${githubLogin} AND ${schema.commits.date} >= date('now', '-30 days')`
      );

    const repos: string[] = commitStats[0]?.repos
      ? commitStats[0].repos.split(',')
      : [];

    const hasPopularRepo = repos.some(
      (r) =>
        reposNames.indexOf(r) >= 0 &&
        reposNames.indexOf(r) < 15 &&
        r !== 'nanocurrency/nano-node'
    );

    return {
      userId: profile[0].developer_profiles.userId,
      githubLogin: profile[0].developer_profiles.githubLogin,
      bio: profile[0].developer_profiles.bio,
      twitterUsername: profile[0].developer_profiles.twitterUsername,
      website: profile[0].developer_profiles.website,
      nanoAddress: profile[0].developer_profiles.nanoAddress,
      ghSponsors: profile[0].developer_profiles.ghSponsors,
      patreonUrl: profile[0].developer_profiles.patreonUrl,
      goalTitle: profile[0].developer_profiles.goalTitle,
      goalAmount: profile[0].developer_profiles.goalAmount,
      goalNanoAddress: profile[0].developer_profiles.goalNanoAddress,
      goalWebsite: profile[0].developer_profiles.goalWebsite,
      goalDescription: profile[0].developer_profiles.goalDescription,
      createdAt: profile[0].developer_profiles.createdAt,
      updatedAt: profile[0].developer_profiles.updatedAt,
      // User info
      name: profile[0].user?.name || null,
      email: profile[0].user?.email || null,
      image: profile[0].user?.image || null,
      // Computed stats
      contributions: commitStats[0]?.count || 0,
      lastMonth: lastMonthStats[0]?.count || 0,
      repos,
      hasPopularRepo,
      nodeContributor: repos.includes('nanocurrency/nano-node'),
    };
  }

  public static async createOrUpdate(
    userId: string,
    data: Partial<DeveloperProfileInput>
  ): Promise<void> {
    // 1. Check if user already has a profile linked
    const existingByUserId = await db
      .select()
      .from(schema.developerProfiles)
      .where(eq(schema.developerProfiles.userId, userId))
      .limit(1);

    if (existingByUserId.length > 0) {
      // Update existing profile found by userId
      await db
        .update(schema.developerProfiles)
        .set({
          bio: data.bio,
          twitterUsername: data.twitterUsername?.replace('@', ''),
          website: data.website?.replace(/(http|https):\/\//i, ''),
          nanoAddress: data.nanoAddress?.replace('@', '').trim(),
          ghSponsors: data.ghSponsors,
          patreonUrl: data.patreonUrl,
          goalTitle: data.goalTitle,
          goalAmount: data.goalAmount,
          goalNanoAddress: data.goalNanoAddress?.replace('@', '').trim(),
          goalWebsite: data.goalWebsite?.replace(/(http|https):\/\//i, ''),
          goalDescription: data.goalDescription,
        })
        .where(eq(schema.developerProfiles.userId, userId));
    } else {
      // 2. User has no linked profile yet. 
      // Check if there is an unlinked profile with this githubLogin (Legacy Migration)
      if (!data.githubLogin) {
        throw new Error('githubLogin is required to create or claim a developer profile');
      }

      const existingByLogin = await db
        .select()
        .from(schema.developerProfiles)
        .where(eq(schema.developerProfiles.githubLogin, data.githubLogin))
        .limit(1);

      if (existingByLogin.length > 0) {
        // Claim the existing unlinked profile!
        await db
          .update(schema.developerProfiles)
          .set({
            userId: userId, // LINK THE USER HERE
            bio: data.bio || existingByLogin[0].bio, // Prefer new data, fallback to old
            twitterUsername: data.twitterUsername?.replace('@', '') || existingByLogin[0].twitterUsername,
            // ... map other fields similarly if you want to update them on login, 
            // or just set userId if you want to preserve legacy data strictly.
            // For simplicity, let's update common fields:
            website: data.website?.replace(/(http|https):\/\//i, '') || existingByLogin[0].website,
          })
          .where(eq(schema.developerProfiles.githubLogin, data.githubLogin));
      } else {
        // 3. Create entirely new profile
        await db.insert(schema.developerProfiles).values({
          userId,
          githubLogin: data.githubLogin,
          bio: data.bio || null,
          twitterUsername: data.twitterUsername?.replace('@', '') || null,
          website: data.website?.replace(/(http|https):\/\//i, '') || null,
          nanoAddress: data.nanoAddress?.replace('@', '').trim() || null,
          ghSponsors: data.ghSponsors || null,
          patreonUrl: data.patreonUrl || null,
          goalTitle: data.goalTitle || null,
          goalAmount: data.goalAmount || null,
          goalNanoAddress: data.goalNanoAddress?.replace('@', '').trim() || null,
          goalWebsite: data.goalWebsite?.replace(/(http|https):\/\//i, '') || null,
          goalDescription: data.goalDescription || null
        });
      }
    }
  }
}

export interface DeveloperProfile {
  userId: string;
  githubLogin: string;
  bio: string | null;
  twitterUsername: string | null;
  website: string | null;
  nanoAddress: string | null;
  ghSponsors: boolean | null;
  patreonUrl: string | null;
  goalTitle: string | null;
  goalAmount: number | null;
  goalNanoAddress: string | null;
  goalWebsite: string | null;
  goalDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperProfileWithStats extends DeveloperProfile {
  // User info from better-auth
  name: string | null;
  email: string | null;
  image: string | null;
  // Computed stats from commits
  contributions: number;
  lastMonth: number;
  repos: string[];
  hasPopularRepo: boolean;
  nodeContributor: boolean;
}

export interface DeveloperProfileInput {
  githubLogin: string;
  bio?: string;
  twitterUsername?: string;
  website?: string;
  nanoAddress?: string;
  ghSponsors?: boolean;
  patreonUrl?: string;
  goalTitle?: string;
  goalAmount?: number;
  goalNanoAddress?: string;
  goalWebsite?: string;
  goalDescription?: string;
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
