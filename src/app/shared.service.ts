import { Injectable } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { hc } from 'hono/client';
import type { App } from '../../server/server';
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
  usersSort = new BehaviorSubject<'month' | 'total'>('month');
  reposSort = new BehaviorSubject<'date' | 'stars'>('date');
  loggedUser = new BehaviorSubject<Profile>(null);
  selectedUser = new BehaviorSubject<Contributor>(null);

  repos = new BehaviorSubject<Repo[]>([]);
  commits = new BehaviorSubject<ChartCommit[]>([]);
  contributors = new BehaviorSubject<Contributor[]>([]);
  milestones = new BehaviorSubject<Milestone[]>([]);
  events = new BehaviorSubject<Commit[]>([]);
  nodeEvents = new BehaviorSubject<NodeEvent[]>([]);
  spotlight = new BehaviorSubject<Repo>({} as Repo);
  publicNodes = new BehaviorSubject<PublicNode[]>([]);
  devFund = new BehaviorSubject<{
    labels: string[];
    data: number[];
    donors: Donor[];
  }>({
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
    this.usersSort.next(perfUS);
    this.reposSort.next(perfRS);
  }

  sortUsersBy(by: 'month' | 'total') {
    this.usersSort.next(by);
    localStorage.setItem('usersSort', by);
  }

  sortReposBy(by: 'date' | 'stars') {
    this.reposSort.next(by);
    localStorage.setItem('reposSort', by);
  }

  selectUser(user: Contributor, editMode = false) {
    if (editMode) {
      const loggedContrib = this.contributors.value.find(
        (c) => c.login === this.loggedUser.value.login
      );
      this.selectedUser.next(loggedContrib);
    } else {
      this.selectedUser.next(user);
    }
  }

  fetchUser() {
    this.server.api.auth.user.$get().then(async (user) => {
      this.loggedUser.next(await user.json());
    });
  }

  getData() {
    this.server.api.data.$get().then(async (res) => {
      const data = await res.json();
      this.nodeEvents.next(data.nodeEvents);
      this.repos.next(data.repos);
      this.contributors.next(data.contributors);
      this.commits.next(data.commits);
      this.events.next(data.events);
      this.milestones.next(data.milestones);
      this.devFund.next({
        data: data.misc.devFundData || [],
        labels: data.misc.devFundLabels || [],
        donors: data.misc.devFundDonors || [],
      });
      this.spotlight.next(
        data.misc.spotlight ||
          data.repos[Math.floor(Math.random() * data.repos.length)]
      );
      this.publicNodes.next(data.publicNodes);
    });
  }

  async updateProfile(loggedUser) {
    await this.server.api['update-profile'].$post({ json: loggedUser });
  }

  logOut() {
    this.server.api.logout.$get().then(() => this.loggedUser.next(null));
  }

  get isSmallScreen(): boolean {
    return this.bp.isMatched([Breakpoints.Small, Breakpoints.XSmall]);
  }
}
