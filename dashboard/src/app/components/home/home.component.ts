import { Component, OnInit } from '@angular/core';
import { graphic, EChartsOption } from 'echarts';
import {
  ChartCommit,
  Contributor,
  Profile,
  Repo,
  ServerResponse,
} from '../../interfaces';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  reposNames: string[] = [];
  busyRepos: Repo[] = [];
  busyLastWeek = false;
  reposPage: Repo[] = [];
  sortedRepos: Repo[] = [];
  REPO_SORT: 'date' | 'stars' = 'date';
  reposQuery = '';

  sortedContributors: Contributor[] = [];
  contributorsPage: Contributor[] = [];
  contributorsPageIndex = 0;
  CONTRIB_SORT: 'month' | 'total' = 'month';
  contributorsQuery = '';

  commitsChartOpts: EChartsOption;
  reposChartOpts: EChartsOption;
  selectedUser: Contributor = {} as Contributor;
  loggedUser: Profile;
  editMode = false;

  constructor(public shared: SharedService) {}

  ngOnInit() {
    this.getData();
    this.shared.loggedUser.subscribe(
      (user: Profile) => (this.loggedUser = user)
    );
    this.shared.selectedUser.subscribe(
      (user: Contributor) => (this.selectedUser = user)
    );
  }

  getData(): void {
    this.shared.data.subscribe((data: ServerResponse) => {
      this.sortContributors(this.CONTRIB_SORT);
      this.sortRepos(this.REPO_SORT);
      this.busyRepos = [...data.repos]
        .filter((a) => a.commits_30d + a.prs_30d > 0)
        .sort((a, b) => b.commits_30d + b.prs_30d - a.commits_30d - a.prs_30d);
      this.reposNames = data.repos.map((r) => r.full_name);
      setTimeout(() => {
        // needed for animations to work
        this.initCharts(data.commits, data.repos);
      }, 200);
    });
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
    this.CONTRIB_SORT = by;
    this.sortedContributors = [...this.shared.data.value.contributors].sort(
      (a, b) =>
        by === 'total'
          ? b.contributions - a.contributions
          : b.last_month - a.last_month
    );
  }

  filterBusyRepos(lastWeekOnly: boolean) {
    this.busyLastWeek = lastWeekOnly;
    if (lastWeekOnly) {
      this.busyRepos = [...this.shared.data.value.repos]
        .filter((a) => a.commits_7d + a.prs_7d > 0)
        .sort((a, b) => b.commits_7d + b.prs_7d - (a.commits_7d + a.prs_7d));
      return;
    }
    this.busyRepos = [...this.shared.data.value.repos]
      .filter((a) => a.commits_30d + a.prs_30d > 0)
      .sort((a, b) => b.commits_30d + b.prs_30d - (a.commits_30d + a.prs_30d));
  }

  sortRepos(
    by: 'date' | 'stars',
    source: Repo[] = this.shared.data.value.repos
  ) {
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
    if (!query) this.sortedRepos = this.shared.data.value.repos;
    if (query.length < 3) return;
    query = query.toLowerCase();
    this.sortedRepos = this.shared.data.value.repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    );
    this.sortRepos(this.REPO_SORT, this.sortedRepos);
  }

  filterContributors(query: string) {
    if (!query) this.sortedContributors = this.shared.data.value.contributors;
    if (query.length < 3) return;
    query = query.toLowerCase();
    this.sortedContributors = this.shared.data.value.contributors.filter(
      (c) =>
        c.login.toLowerCase().includes(query) ||
        c.repos.findIndex((re) => re.toLowerCase().includes(query)) > -1 ||
        c.profile?.bio?.toLowerCase().includes(query)
    );
    this.sortContributors(this.CONTRIB_SORT);
  }

  updateProfile() {
    this.shared.updateProfile().subscribe((usr: Profile) => {
      this.sortedContributors = this.sortedContributors.map((c) => {
        if (c.login === usr._id) {
          return { ...c, profile: usr };
        }
        return c;
      });
      this.shared.loggedUser.next(usr);
      this.shared.selectUser(null, true);
      this.editMode = false;
    });
  }

  trackByName(index, item) {
    return item.full_name;
  }

  trackByLogin(index, item) {
    return item.login;
  }
}
