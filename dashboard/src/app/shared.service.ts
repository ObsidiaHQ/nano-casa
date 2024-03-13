import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, take } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { environment } from 'src/environments/environment';
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
  ServerResponse,
} from './interfaces';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
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
        .get(`${environment.api}/auth/user`)
        .pipe(take(1))
        .subscribe((user: Profile) => {
          this.loggedUser.next(user);
        });
    }
  }

  selectUser(user: Contributor, editMode = false) {
    if (editMode) {
      const loggedContrib = this.contributors.value.find(
        (c) => c.login === this.loggedUser.value._id
      );
      this.selectedUser.next(loggedContrib);
    } else {
      this.selectedUser.next(user);
    }
  }

  getData(): void {
    if (!this.repos.value.length) {
      this.http
        .get(`${environment.api}/data`)
        .pipe(take(1))
        .subscribe((data: ServerResponse) => {
          data.contributors = data.contributors.map((usr) => {
            if (usr.profile) {
              usr.profile.bio = usr.profile.bio?.replace(
                /\[(.*?)\]\((.*?)\)/gim,
                "<a href='$2' target='_blank'>$1</a>"
              );
            }
            return usr;
          });
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
  }

  updateProfile() {
    return this.http
      .post(`${environment.api}/set-profile`, this.loggedUser.value)
      .pipe(take(1));
  }

  logOut() {
    this.http
      .get(`${environment.api}/logout`)
      .pipe(take(1))
      .subscribe(() => this.loggedUser.next(null));
  }

  get isSmallScreen(): boolean {
    return this.bp.isMatched([Breakpoints.Small, Breakpoints.XSmall]);
  }
}
