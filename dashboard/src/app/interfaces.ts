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
}
export interface ServerResponse {
  repos: Repo[];
  commits: ChartCommit[];
  contributors: Contributor[];
  milestones: Milestone[];
  events: Commit[];
  nodeEvents: NodeEvent[];
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
