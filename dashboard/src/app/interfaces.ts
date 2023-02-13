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
  profile: any;
}
export interface Milestone {
  title: string;
  open_issues: number;
  closed_issues: number;
  created_at: string;
}
