export interface IRepo {
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
export interface IChartCommit {
  count: number;
  date: string;
}
export interface ICommit {
  repo_full_name: string;
  author: string;
  message: string;
  avatar_url: string;
  date: string;
}
export interface IContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  last_month: number;
  repos: string[];
  profile: IProfile;
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
export interface IMilestone {
  title: string;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  number: number;
}
export interface IProfile {
  login: string;
  avatar_url: string;
  bio: string;
  twitter_username: string;
  website: string;
  nano_address: string;
  gh_sponsors: boolean;
  patreon_url: string;
  goal_title?: string;
  goal_amount: number;
  goal_nano_address: string;
  goal_website?: string;
  goal_description?: string;
}
export interface IServerResponse {
  repos: IRepo[];
  commits: IChartCommit[];
  contributors: IContributor[];
  milestones: IMilestone[];
  events: ICommit[];
  nodeEvents: INodeEvent[];
  misc: IMisc;
  publicNodes: IPublicNode[];
}
export interface IMisc {
  spotlight: IRepo;
  devFundLabels: string[];
  devFundData: number[];
  devFundDonors: IDonor[];
}
export interface IDonor {
  I;
  account: string;
  amount_nano: number;
  username?: string;
  website?: string;
  twitter?: string;
  github?: string;
}
export interface INodeEvent {
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
export interface IPublicNode {
  endpoint: string;
  website?: string;
  websocket?: string;
  up: boolean;
  error: any;
  version: string;
  resp_time: number;
}
