import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, take } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { environment } from 'src/environments/environment';
import { treaty } from '@elysiajs/eden';
import type { App } from '../../server/server';
import {
  IChartCommit,
  ICommit,
  IContributor,
  IDonor,
  IMilestone,
  INodeEvent,
  IProfile,
  IPublicNode,
  IRepo,
} from '../../interfaces';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  readonly server = treaty<App>(environment.server);
  usersSort = new BehaviorSubject<'month' | 'total'>('month');
  reposSort = new BehaviorSubject<'date' | 'stars'>('date');
  loggedUser = new BehaviorSubject<IProfile>(null);
  selectedUser = new BehaviorSubject<IContributor>(null);

  repos = new BehaviorSubject<IRepo[]>([]);
  commits = new BehaviorSubject<IChartCommit[]>([]);
  contributors = new BehaviorSubject<IContributor[]>([]);
  milestones = new BehaviorSubject<IMilestone[]>([]);
  events = new BehaviorSubject<ICommit[]>([]);
  nodeEvents = new BehaviorSubject<INodeEvent[]>([]);
  spotlight = new BehaviorSubject<IRepo>({} as IRepo);
  publicNodes = new BehaviorSubject<IPublicNode[]>([]);
  devFund = new BehaviorSubject<{
    labels: string[];
    data: number[];
    donors: IDonor[];
  }>({
    labels: [],
    data: [],
    donors: [],
  });

  constructor(private http: HttpClient, private bp: BreakpointObserver) {
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

  fetchUser() {
    if (!this.loggedUser.value) {
      this.http
        .get(`${environment.server}/api/auth/user`)
        .pipe(take(1))
        .subscribe((user: IProfile) => {
          this.loggedUser.next(user);
        });
    }
  }

  selectUser(user: IContributor, editMode = false) {
    if (editMode) {
      const loggedContrib = this.contributors.value.find(
        (c) => c.login === this.loggedUser.value.login
      );
      this.selectedUser.next(loggedContrib);
    } else {
      this.selectedUser.next(user);
    }
  }

  getData() {
    this.server.api.data.get().then((res) => {
      this.nodeEvents.next(res.data.nodeEvents);
      this.repos.next(res.data.repos);
      this.contributors.next(res.data.contributors);
      this.commits.next(res.data.commits);
      this.events.next(res.data.events);
      this.milestones.next(res.data.milestones);
      this.devFund.next({
        data: res.data.misc.devFundData || [],
        labels: res.data.misc.devFundLabels || [],
        donors: res.data.misc.devFundDonors || [],
      });
      this.spotlight.next(
        res.data.misc.spotlight ||
          res.data.repos[Math.floor(Math.random() * res.data.repos.length)]
      );
      this.publicNodes.next(res.data.publicNodes);
    });
  }

  updateProfile() {
    return this.http
      .post(`${environment.server}/api/set-profile`, this.loggedUser.value)
      .pipe(take(1));
  }

  logOut() {
    this.http
      .get(`${environment.server}/api/logout`)
      .pipe(take(1))
      .subscribe(() => this.loggedUser.next(null));
  }

  get isSmallScreen(): boolean {
    return this.bp.isMatched([Breakpoints.Small, Breakpoints.XSmall]);
  }
}
