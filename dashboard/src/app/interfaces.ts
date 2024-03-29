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
export interface ChartCommit {
  count: number;
  date: string;
}
export interface Commit {
  repo_full_name: string;
  author: string;
  message: string;
  avatar_url: string;
  date: string;
}
export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  last_month: number;
  repos: string[];
  repos_count: number;
  profile: Profile;
}
export interface Milestone {
  title: string;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  number: number;
}
export interface Profile {
  _id: string;
  avatar_url: string;
  bio: string;
  twitter_username: string;
  website: string;
  nano_address: string;
  gh_sponsors: boolean;
  patreon_url: string;
  goal: FundingGoal;
}
export interface ServerResponse {
  repos: Repo[];
  commits: ChartCommit[];
  contributors: Contributor[];
  milestones: Milestone[];
  events: Commit[];
  nodeEvents: NodeEvent[];
  misc: {
    spotlight: Repo;
    devFundLabels: string[];
    devFundData: number[];
    devFundDonors: Donor[];
  };
  publicNodes: PublicNode[];
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
export interface FundingGoal {
  _id: string;
  title?: string;
  amount: number;
  nano_address: string;
  website?: string;
  description?: string;
}
export interface PublicNode {
  endpoint: string;
  website?: string;
  websocket?: string;
  up: boolean;
  error: any;
  version: string;
  resp_time: number;
  deprecated?: boolean;
}
export interface Donor {
  account: string;
  amount_nano: number;
  username?: string;
  website?: string;
  twitter?: string;
  github?: string;
}
