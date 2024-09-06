import { Injectable, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { environment } from '../environments/environment';
import { hc } from 'hono/client';
import type { App } from '../../server/server';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  ChartCommit,
  Commit,
  Contributor,
  Donor,
  Milestone,
  NodeEvent,
  Profile,
  PublicNode,
  Repo,
} from '../../server/models';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  readonly server = hc<App>(environment.server, {
    init: {
      credentials: 'include',
    },
  });
  usersSort = signal<'month' | 'total'>('month');
  reposSort = signal<'date' | 'stars'>('date');
  loggedUser = signal<Profile | null>(null);
  loggedUser$ = toObservable(this.loggedUser);
  selectedUser = signal<Contributor | null>(null);

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

  selectUser(user: Contributor, editMode = false) {
    if (editMode) {
      const loggedContrib =
        this.contributors().find((c) => c.login === this.loggedUser()?.login) ||
        null;
      this.selectedUser.set(loggedContrib);
    } else {
      this.selectedUser.set(user);
    }
  }

  fetchUser() {
    this.server.api.auth.user.$get().then(async (user) => {
      const uu = await user.json();
      this.loggedUser.set(uu);
    });
  }

  getData() {
    this.server.api.data.$get().then(async (res) => {
      const data = await res.json();
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

  async updateProfile(loggedUser: Profile) {
    this.server.api['update-profile'].$post({ json: loggedUser }).then(() => {
      const loggedContrib =
        this.contributors().find((c) => c.login === this.loggedUser()?.login) ||
        null;
      this.selectedUser.set(loggedContrib);
      this.loggedUser.set(loggedUser);
      this.selectedUser.set({ ...loggedContrib, ...loggedUser });
    });
  }

  logOut() {
    this.server.api.logout.$get().then(() => this.loggedUser.set(null));
  }

  get isSmallScreen(): boolean {
    return this.bp.isMatched([Breakpoints.Small, Breakpoints.XSmall]);
  }
}
