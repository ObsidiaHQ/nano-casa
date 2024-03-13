import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { EChartsOption } from 'echarts';
import { graphic } from 'echarts/core';
import { Contributor, FundingGoal, Profile, Repo } from '../../interfaces';
import { SharedService } from 'src/app/shared.service';
import { SortPipe } from 'src/app/pipes/sort.pipe';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [SortPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  devFundChartOpts: EChartsOption;
  donorsChartOpts: EChartsOption;
  selectedUser: Contributor = {} as Contributor;
  loggedUser: Profile;
  editMode = false;

  constructor(
    public shared: SharedService,
    private sort: SortPipe,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    combineLatest({
      repos: this.shared.repos,
      loggedUser: this.shared.loggedUser,
      selectedUser: this.shared.selectedUser,
    }).subscribe(({ repos, loggedUser, selectedUser }) => {
      this.reposNames = this.sort
        .transform(repos, 'repo', 'stars')
        .map((r) => r.full_name);
      setTimeout(() => {
        this.initCharts();
      }, 400);
      this.loggedUser = loggedUser;
      this.selectedUser = selectedUser;
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    document
      .getElementById('modal-profile')
      .addEventListener('hidden.bs.modal', (e) => {
        this.shared.selectedUser.next({} as Contributor);
      });
  }

  initCharts() {
    // list years since 2014
    const YEARS = Array.from(Array(new Date().getFullYear() - 2013), (_, i) =>
      (i + 2014).toString()
    );
    const YEARS_DICT = {};
    for (const year of YEARS) {
      YEARS_DICT[year] = 0;
    }
    this.shared.repos.value.forEach((repo, i) => {
      const year = new Date(repo.created_at).getFullYear();
      YEARS_DICT[year] += 1;
    });

    this.reposChartOpts = {
      animation: true,
      animationEasing: 'elasticOut',
      animationDuration: 1000,
      tooltip: {
        trigger: 'axis',
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
        data: this.shared.commits.value.map((com) => com.date),
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
          data: this.shared.commits.value.map((com) => com.count),
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

    this.devFundChartOpts = {
      animation: true,
      animationEasing: 'elasticOut',
      animationDuration: 1200,
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: -4,
        top: 0,
        right: -4,
        bottom: 0,
      },
      xAxis: {
        show: false,
        data: this.shared.devFund.value.labels,
      },
      yAxis: {
        show: false,
      },
      series: [
        {
          name: 'Balance',
          symbol: 'none',
          data: this.shared.devFund.value.data,
          type: 'line',
          itemStyle: {
            color: '#1F67BD',
          },
          areaStyle: {
            color: '#192F4B',
          },
        },
      ],
    };
    this.donorsChartOpts = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'none',
        },
        formatter(param) {
          return `Ӿ${param[0].value}`;
        },
      },
      grid: {
        left: 0,
        top: 0,
        right: '3%',
        bottom: 0,
      },
      xAxis: {
        show: false,
      },
      yAxis: {
        show: false,
        data: [...this.shared.devFund.value.donors]
          .map((d) => d.username || d.account.substring(0, 15))
          .slice(0, 5)
          .reverse(),
      },
      series: [
        {
          name: 'Amount',
          type: 'bar',
          itemStyle: {
            borderRadius: [0, 10, 10, 0],
            color: new graphic.LinearGradient(0, 0, 1, 1, [
              { offset: 0, color: '#DC538C' },
              { offset: 1, color: '#EEC200' },
            ]),
          },
          label: {
            show: true,
            fontSize: 10,
            position: 'insideRight',
            color: '#151F2C',
            formatter(param) {
              return `${param.name}`;
            },
          },
          data: [...this.shared.devFund.value.donors]
            .map((d) => Math.round(d.amount_nano))
            .slice(0, 5)
            .reverse(),
        },
      ],
    };
    this.cdr.markForCheck();
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
}
