// Frontend API types - completely isolated from server/Drizzle types

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

export interface Commit {
  repoFullName: string | null;
  author: string | null;
  message: string | null;
  avatarUrl: string | null;
  date: string | null;
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

export interface Milestone {
  title: string | null;
  openIssues: number | null;
  closedIssues: number | null;
  createdAt: string | null;
  number: number | null;
  url: string | null;
}

export interface Contributor {
  githubLogin: string;
  avatarUrl: string;
  contributions: number;
  lastMonth: number;
  repos: string[];
  hasPopularRepo: boolean;
  nodeContributor: boolean;
  // Profile data (nullable - only if user has logged in with GitHub)
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

export interface ChartCommit {
  count: number;
  date: string;
}

export interface Profile {
  userId?: string;
  githubLogin?: string;
  bio?: string | null;
  twitterUsername?: string | null;
  website?: string | null;
  nanoAddress?: string | null;
  ghSponsors?: boolean | null;
  patreonUrl?: string | null;
  goalTitle?: string | null;
  goalAmount?: number | null;
  goalNanoAddress?: string | null;
  goalWebsite?: string | null;
  goalDescription?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  // User info
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isDeveloper: boolean;
  // Computed stats (only if isDeveloper is true)
  contributions?: number;
  lastMonth?: number;
  repos?: string[];
  hasPopularRepo?: boolean;
  nodeContributor?: boolean;
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

export interface ApiDataResponse {
  repos: Repo[];
  commits: ChartCommit[];
  contributors: Contributor[];
  milestones: Milestone[];
  events: Commit[];
  nodeEvents: NodeEvent[];
  misc: Record<string, any>;
  publicNodes: PublicNode[];
}





