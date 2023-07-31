import { AfterViewInit, Component, OnInit } from '@angular/core';
import { graphic, EChartsOption } from 'echarts';
import {
  ChartCommit,
  Contributor,
  FundingGoal,
  Profile,
  Repo,
} from '../../interfaces';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, AfterViewInit {
  reposPage: Repo[] = [];
  reposNames: string[] = [];
  reposSort: 'date' | 'stars' = 'date';
  reposQuery = '';
  busyWindow: 'busyWeek' | 'busyMonth' = 'busyMonth';

  contributorsPage: Contributor[] = [];
  contributorsPageIndex = 0;
  contributorsSort: 'month' | 'total' = 'month';
  contributorsQuery = '';

  commitsChartOpts: EChartsOption;
  reposChartOpts: EChartsOption;
  selectedUser: Contributor = {} as Contributor;
  loggedUser: Profile;
  editMode = false;

  constructor(public shared: SharedService) {}

  ngOnInit() {
    this.shared.repos.subscribe((repos: Repo[]) => {
      this.reposNames = repos.map((r) => r.full_name);
      setTimeout(() => {
        this.initCharts(this.shared.commits.value, this.shared.repos.value);
      }, 400);
    });
    this.shared.loggedUser.subscribe(
      (user: Profile) => (this.loggedUser = user)
    );
    this.shared.selectedUser.subscribe(
      (user: Contributor) => (this.selectedUser = user)
    );
  }

  ngAfterViewInit(): void {
    document
      .getElementById('modal-profile')
      .addEventListener('hidden.bs.modal', (e) => {
        this.shared.selectedUser.next({} as Contributor);
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

  updateProfile() {
    this.shared.updateProfile().subscribe((usr: Profile) => {
      this.shared.contributors.next(
        this.shared.contributors.value.map((c) => {
          if (c.login === usr._id) {
            return { ...c, profile: usr };
          }
          return c;
        })
      );
      this.shared.loggedUser.next(usr);
      this.shared.selectUser(null, true);
      this.editMode = false;
    });
  }

  setGoal() {
    const usr = this.shared.loggedUser.value;
    usr.goal = {
      title: 'New goal',
      amount: 5,
      nano_address: usr.nano_address,
      description: '',
    } as FundingGoal;
    this.shared.loggedUser.next(usr);
  }

  deleteGoal(goal) {
    const usr = this.shared.loggedUser.value;
    delete usr.goal;
    this.shared.loggedUser.next(usr);
  }

  trackByName(index, item) {
    return item.full_name;
  }

  trackByLogin(index, item) {
    return item.login;
  }
}
