import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { graphic, EChartsOption } from 'echarts';
import { environment } from 'src/environments/environment';
import {
  ChartCommit,
  Commit,
  Contributor,
  Milestone,
  Profile,
  Repo,
  ServerResponse,
} from './interfaces';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  repos: Repo[] = [];
  reposNames: string[] = [];
  busyRepos: Repo[] = [];
  busyLastWeek = false;
  reposPage: Repo[] = [];
  sortedRepos: Repo[] = [];
  REPO_SORT: 'date' | 'stars' = 'date';
  reposQuery = '';

  contributors: Contributor[] = [];
  sortedContributors: Contributor[] = [];
  contributorsPage: Contributor[] = [];
  contributorsPageIndex = 0;
  CONTRIB_SORT: 'month' | 'total' = 'total';
  contributorsQuery = '';

  milestones: Milestone[] = [];
  events: Commit[] = [];
  profiles: Profile[] = [];

  commitsChartOpts: EChartsOption;
  reposChartOpts: EChartsOption;
  selectedUser: Contributor = {} as Contributor;
  loggedUser: Profile;
  editMode = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.getData();
    this.fetchUser();
  }

  getData(): void {
    this.http
      .get(`${environment.api}/data`)
      .subscribe((data: ServerResponse) => {
        this.contributors = data.contributors.map((usr) => {
          if (usr.profile) {
            usr.profile.bio = usr.profile.bio?.replace(
              /\[(.*?)\]\((.*?)\)/gim,
              "<a href='$2'>$1</a>"
            );
          }
          return usr;
        });
        this.sortedContributors = this.contributors;
        this.milestones = data.milestones;
        this.events = data.events;
        this.setRepos(data.repos);
        setTimeout(() => {
          // needed for animations to work
          this.initCharts(data.commits, data.repos);
        }, 200);
      });
  }

  setRepos(repos: Repo[]) {
    this.repos = repos;
    this.sortRepos(this.REPO_SORT);
    this.busyRepos = [...this.repos]
      .filter((a) => a.commits_30d + a.prs_30d > 0)
      .sort((a, b) => b.commits_30d + b.prs_30d - a.commits_30d - a.prs_30d);
    this.reposNames = this.repos.map((r) => r.full_name);
  }

  initCharts(commits: ChartCommit[], repos: Repo[]) {
    // list years since 2014
    const YEARS = Array.from(Array(new Date().getFullYear() - 2013), (_, i) =>
      (i + 2014).toString()
    );
    const YEARS_DICT = {};
    for (const year of YEARS) {
      YEARS_DICT[year] = 0;
    }
    repos.forEach((repo, i) => {
      const year = new Date(repo.created_at).getFullYear();
      YEARS_DICT[year] += 1;
    });

    this.reposChartOpts = {
      animation: true,
      animationEasing: 'elasticOut',
      animationDuration: 1200,
      tooltip: {
        trigger: 'axis',
        position: function (pt) {
          return [pt[0], '10%'];
        },
      },
      grid: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      xAxis: {
        show: false,
        data: Object.keys(YEARS_DICT),
      },
      yAxis: {
        show: false,
      },
      series: [
        {
          data: Object.values(YEARS_DICT),
          type: 'bar',
          name: 'Projects',
          itemStyle: {
            color: '#993255',
          },
        },
      ],
    };

    this.commitsChartOpts = {
      animation: true,
      animationEasing: 'elasticOut',
      animationDuration: 1200,
      tooltip: {
        trigger: 'axis',
        position: function (pt) {
          return [pt[0], '10%'];
        },
      },
      grid: {
        left: 34,
        top: 30,
        right: 10,
        bottom: 80,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: commits.map((com) => com.date),
      },
      yAxis: {
        splitLine: {
          lineStyle: {
            color: '#243049',
          },
        },
        type: 'value',
      },
      dataZoom: [
        {
          type: 'inside',
          start: 10,
          end: 100,
        },
        {
          start: 10,
          end: 100,
        },
      ],
      series: [
        {
          name: 'Commits',
          symbol: 'none',
          type: 'line',
          sampling: 'lttb',
          data: commits.map((com) => com.count),
          lineStyle: {
            width: 0,
          },
          itemStyle: {
            color: new graphic.LinearGradient(0, 0, 1, 0, [
              {
                offset: 0,
                color: '#70BAEB',
              },
              {
                offset: 1,
                color: '#0C8297',
              },
            ]),
          },
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 1, 0, [
              {
                offset: 0,
                color: '#70BAEB',
              },
              {
                offset: 1,
                color: '#0C8297',
              },
            ]),
          },
        },
      ],
    };
  }

  hasPopularRepo(repos: string[]) {
    return repos.some(
      (r) =>
        this.reposNames.indexOf(r) >= 0 &&
        this.reposNames.indexOf(r) < 10 &&
        r != 'nanocurrency/nano-node'
    );
  }

  contributedToNode(repos: string[]) {
    return repos.includes('nanocurrency/nano-node');
  }

  sortContributors(by: 'month' | 'total') {
    if (this.CONTRIB_SORT === by) return;
    this.CONTRIB_SORT = by;
    this.sortedContributors = [...this.contributors].sort((a, b) =>
      by === 'total'
        ? b.contributions - a.contributions
        : b.last_month - a.last_month
    );
  }

  filterBusyRepos(lastWeekOnly: boolean) {
    this.busyLastWeek = lastWeekOnly;
    if (lastWeekOnly) {
      this.busyRepos = [...this.repos]
        .filter((a) => a.commits_7d + a.prs_7d > 0)
        .sort((a, b) => b.commits_7d + b.prs_7d - (a.commits_7d + a.prs_7d));
      return;
    }
    this.busyRepos = [...this.repos]
      .filter((a) => a.commits_30d + a.prs_30d > 0)
      .sort((a, b) => b.commits_30d + b.prs_30d - (a.commits_30d + a.prs_30d));
  }

  sortRepos(by: 'date' | 'stars', source: Repo[] = this.repos) {
    if (by === 'date') {
      this.sortedRepos = [...source].reverse();
    } else {
      this.sortedRepos = [...source].sort(
        (a, b) => b.stargazers_count - a.stargazers_count
      );
    }
    this.REPO_SORT = by;
  }

  filterRepos(query: string) {
    if (!query) this.sortedRepos = this.repos;
    if (query.length < 3) return;
    query = query.toLowerCase();
    this.sortedRepos = this.repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    );
    this.sortRepos(this.REPO_SORT, this.sortedRepos);
  }

  filterContributors(query: string) {
    if (!query) this.sortedContributors = this.contributors;
    if (query.length < 3) return;
    query = query.toLowerCase();
    this.sortedContributors = this.contributors.filter(
      (c) =>
        c.login.toLowerCase().includes(query) ||
        c.repos.findIndex((re) => re.toLowerCase().includes(query)) > -1 ||
        c.profile?.bio?.toLowerCase().includes(query)
    );
    this.sortContributors(this.CONTRIB_SORT);
  }

  trackByName(index, item) {
    return item.full_name;
  }

  trackByLogin(index, item) {
    return item.login;
  }

  editProfile() {
    this.selectedUser = this.sortedContributors.find(
      (c) => c.login === this.loggedUser._id
    );
  }

  fetchUser() {
    this.http
      .get(`${environment.api}/auth/user`)
      .subscribe((user: Profile) => (this.loggedUser = user));
  }

  logIn() {
    window.open('/auth/github', '_self');
  }

  logOut() {
    this.http
      .get(`${environment.api}/logout`)
      .subscribe(() => (this.loggedUser = null));
  }

  updateProfile() {
    this.http
      .post(`${environment.api}/set-profile`, this.loggedUser)
      .subscribe((usr: Profile) => {
        this.sortedContributors = this.sortedContributors.map((c) => {
          if (c.login === usr._id) {
            return { ...c, profile: usr };
          }
          return c;
        });
        this.loggedUser = usr;
        this.editProfile();
        this.editMode = false;
      });
  }
}
