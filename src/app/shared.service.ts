import { Injectable, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { environment } from '../environments/environment';
import { toObservable } from '@angular/core/rxjs-interop';
import type {
  ApiDataResponse,
  ChartCommit,
  Commit,
  Contributor,
  CronJobRun,
  Milestone,
  NodeEvent,
  Profile,
  PublicNode,
  Repo,
} from './api.types';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  private readonly baseUrl = environment.server;
  usersSort = signal<'month' | 'total'>('month');
  reposSort = signal<'date' | 'stars'>('date');
  loggedUser = signal<Profile | null>(null);
  loggedUser$ = toObservable(this.loggedUser);
  selectedUser = signal<Contributor | null>(null);
  logs = signal<CronJobRun[]>([]);
  repos = signal<Repo[]>([]);
  commits = signal<ChartCommit[]>([]);
  contributors = signal<Contributor[]>([]);
  milestones = signal<Milestone[]>([]);
  events = signal<Commit[]>([]);
  nodeEvents = signal<NodeEvent[]>([]);
  spotlight = signal<Repo>({} as Repo);
  publicNodes = signal<PublicNode[]>([]);
  devFund = signal<any>({
    labels: [],
    data: [],
    donors: [],
  });

  constructor(private bp: BreakpointObserver) {
    this.fetchUser();
    this.getData();
    const perfUS =
      (localStorage.getItem('usersSort') as 'month' | 'total') || 'month';
    const perfRS =
      (localStorage.getItem('reposSort') as 'date' | 'stars') || 'date';
    this.usersSort.set(perfUS);
    this.reposSort.set(perfRS);
  }

  sortUsersBy(by: 'month' | 'total') {
    this.usersSort.set(by);
    localStorage.setItem('usersSort', by);
  }

  sortReposBy(by: 'date' | 'stars') {
    this.reposSort.set(by);
    localStorage.setItem('reposSort', by);
  }

  selectUser(user: Contributor | null, editMode = false) {
    if (editMode) {
      const loggedContrib =
        this.contributors().find((c) => c.login === this.loggedUser()?.login) ||
        null;
      this.selectedUser.set(loggedContrib);
    } else {
      this.selectedUser.set(user);
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  fetchUser() {
    this.request<Profile | null>('/api/auth/user')
      .then((user) => this.loggedUser.set(user))
      .catch(() => this.loggedUser.set(null));
  }

  getData() {
    this.request<ApiDataResponse>('/api/data').then((data) => {
      this.nodeEvents.set(data.nodeEvents);
      this.repos.set(data.repos);
      this.contributors.set(data.contributors);
      this.commits.set(data.commits);
      this.events.set(data.events);
      this.milestones.set(data.milestones);
      this.devFund.set({
        data: data.misc['devFundData'] || [],
        labels: data.misc['devFundLabels'] || [],
        donors: data.misc['devFundDonors'] || [],
      });
      this.spotlight.set(
        (data.misc['spotlight'] ||
          data.repos[Math.floor(Math.random() * data.repos.length)]) as Repo
      );
      this.publicNodes.set(data.publicNodes);
    });
  }

  getLogs() {
    this.request<CronJobRun[]>('/api/logs').then((logs) => {
      console.log(logs);
      this.logs.set(logs);
    });
  }

  async updateProfile(loggedUser: Profile) {
    await this.request<void>('/api/update-profile', {
      method: 'POST',
      body: JSON.stringify(loggedUser),
    });
    const loggedContrib =
      this.contributors().find((c) => c.login === this.loggedUser()?.login) ||
      null;
    this.selectedUser.set(loggedContrib);
    this.loggedUser.set(loggedUser);
    this.selectedUser.set(loggedContrib ? { ...loggedContrib, ...loggedUser } : null);
  }

  logOut() {
    this.request<void>('/api/logout', { method: 'POST' })
      .then(() => this.loggedUser.set(null))
      .catch(() => this.loggedUser.set(null));
  }

  get isSmallScreen(): boolean {
    return this.bp.isMatched([Breakpoints.Small, Breakpoints.XSmall]);
  }
}
