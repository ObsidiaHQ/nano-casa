import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  faCodeBranch,
  faHistory,
  faInfoCircle,
  faMedal,
  faStar,
  faUsers,
  faStarOfLife,
  faMeteor,
  faArrowDown,
  faAngleDown,
  faHeart,
  faExternalLink,
  faCodeCommit,
  faCodePullRequest,
  faGhost,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { graphic, EChartsOption } from 'echarts';

interface Repo {
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
interface ChartCommit {
  count: number;
  date: string;
}
interface Commit {
  repo_full_name: string;
  author: string;
  message: string;
  avatar_url: string;
  date: string;
}
interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  last_month: number;
  repos: string[];
  repos_count: number;
  profile: any;
}
interface Milestone {
  title: string;
  open_issues: number;
  closed_issues: number;
  created_at: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  faRepo = faCodeBranch;
  faUser = faUsers;
  faStar = faStar;
  faHistory = faHistory;
  faInfo = faInfoCircle;
  faTwitter = faTwitter;
  faGithub = faGithub;
  faMedal = faMedal;
  faStarOL = faStarOfLife;
  faMeteor = faMeteor;
  faDown = faArrowDown;
  faMore = faAngleDown;
  faHeart = faHeart;
  faExt = faExternalLink;
  faCommit = faCodeCommit;
  faPR = faCodePullRequest;
  faGhost = faGhost;

  reposData = [];
  reposNames: string[] = [];
  reposPage: Repo[] = [];
  contributorsPage: Contributor[] = [];
  contributorsPageIndex = 0;

  busyRepos: Repo[] = [];
  repos: Repo[] = [];
  sortedRepos: Repo[] = [];
  contributors: Contributor[] = [];
  milestones: Milestone[] = [];
  filterBy: 'month' | 'total' = 'total';
  busyLastWeek = false;
  REPO_SORT: 'date' | 'stars' = 'date';
  events: Commit[] = [];

  options: EChartsOption;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.getData();
  }

  getData(): void {
    this.http.get('https://nano.casa/data').subscribe((data: any) => {
      this.contributors = data.contributors;
      this.contributors = this.contributors.map((usr) => {
        const profile = data.devList.find(
          (dl) => dl.github.toLowerCase() === usr.login.toLowerCase()
        );
        if (profile)
          profile.description = profile.description.replace(
            /\[(.*?)\]\((.*?)\)/gim,
            "<a href='$2'>$1</a>"
          );
        return { ...usr, profile };
      });
      this.milestones = data.milestones;
      this.events = data.events;
      this.setRepos(data.repos);
      this.initChart(data.commits);
    });
  }

  setRepos(repos: Repo[]) {
    this.repos = repos;
    this.sortRepos(this.REPO_SORT);
    this.busyRepos = [...this.repos]
      .filter((a) => a.commits_30d + a.prs_30d > 0)
      .sort((a, b) => b.commits_30d + b.prs_30d - (a.commits_30d + a.prs_30d));
    this.reposNames = this.repos.map((r) => r.full_name);

    // list years since 2014
    const YEARS = Array.from(Array(new Date().getFullYear() - 2013), (_, i) =>
      (i + 2014).toString()
    );
    const YEARS_DICT = {};
    for (const year of YEARS) {
      YEARS_DICT[year] = { name: year, value: 0 };
    }

    repos.forEach((repo, i) => {
      const year = new Date(repo.created_at).getFullYear();
      YEARS_DICT[year].value += 1;
    });

    this.reposData = Object.values(YEARS_DICT);
  }

  initChart(commits: ChartCommit[]) {
    this.options = {
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
          animation: true,
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
    if (this.filterBy === by) return;
    this.filterBy = by;
    this.contributors = [...this.contributors].sort((a, b) =>
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

  sortRepos(by: 'date' | 'stars') {
    if (by === 'date') {
      this.sortedRepos = [...this.repos].reverse();
    } else {
      this.sortedRepos = [...this.repos].sort(
        (a, b) => b.stargazers_count - a.stargazers_count
      );
    }
    this.REPO_SORT = by;
  }

  trackByName(index, item) {
    return item.full_name;
  }

  trackByLogin(index, item) {
    return item.login;
  }
}
