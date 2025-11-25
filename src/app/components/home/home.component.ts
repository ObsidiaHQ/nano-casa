import { AfterViewInit, ChangeDetectorRef, Component, OnInit, effect, inject } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import * as echarts from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Contributor, Profile, Repo } from '../../api.types';
import { SortPipe } from '../../pipes/sort.pipe';
import { SharedService } from '../../shared.service';
import { IconComponent } from '../icon/icon.component';
import { CommonModule } from '@angular/common';
import { FilterPipe } from '../../pipes/filter.pipe';
import { AsRepoPipe, AsUserPipe } from '../../pipes/as.pipe';
import { TimeagoModule } from 'ngx-timeago';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../paginate/paginate.component';
import { GoalComponent } from '../goal/goal.component';
import { CountUpModule } from 'ngx-countup';
import { RouterLink } from '@angular/router';
import { Web3Service } from '../../web3.service';

echarts.use([BarChart, LineChart, GridComponent, CanvasRenderer, TooltipComponent, DataZoomComponent]);

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    FormsModule,
    CountUpModule,
    NgxEchartsDirective,
    IconComponent,
    PaginationComponent,
    GoalComponent,
    SortPipe,
    FilterPipe,
    AsRepoPipe,
    AsUserPipe,
    RouterLink,
  ],
  styleUrls: ['./home.component.css'],
  providers: [provideEchartsCore({ echarts })]
})
export class HomeComponent implements OnInit, AfterViewInit {
  protected shared = inject(SharedService);
  protected web3 = inject(Web3Service);
  protected cdr = inject(ChangeDetectorRef);
  reposPage: Repo[] = [];
  reposSort: 'date' | 'stars' | 'activity' = 'activity';
  reposQuery = '';
  busyWindow: 'busyWeek' | 'busyMonth' = 'busyMonth';

  contributorsPage: Contributor[] = [];
  contributorsPageIndex = 0;
  contributorsSort: 'month' | 'total' = 'month';
  contributorsQuery = '';

  commitsChartOpts: EChartsCoreOption;
  reposChartOpts: EChartsCoreOption;
  devFundChartOpts: EChartsCoreOption;
  donorsChartOpts: EChartsCoreOption;
  loggedUser: Profile;

  donatingToUser: string | null = null;
  donationAmount: number = 1;
  showAnnouncementBanner = false;

  constructor() {
    const endDate = new Date('2026-02-01T00:00:00');
    this.showAnnouncementBanner = new Date() < endDate;
    effect(() => {
      if (this.shared.repos().length > 0 && this.shared.commits().length > 0 && this.shared.devFund().data?.length > 0) {
        this.initCharts();
      }
    });
  }

  ngOnInit() {
    this.shared.loggedUser$.subscribe((u) => (this.loggedUser = u));
  }

  ngAfterViewInit(): void {
    document
      .getElementById('modal-profile')
      .addEventListener('hidden.bs.modal', (e) => {
        this.shared.selectedUser.set({} as Contributor);
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
    this.shared.repos().forEach((repo, i) => {
      const year = new Date(repo.createdAt).getFullYear();
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
        data: this.shared.commits().map((com) => com.date),
      },
      yAxis: {
        splitLine: {
          lineStyle: {
            color: '#243049',
          },
        },
        type: 'value',
        max: 400,
        min: 0,
        interval: 50,
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: 'Commits',
          symbol: 'none',
          type: 'line',
          sampling: 'lttb',
          data: this.shared.commits().map((com) => com.count),
          lineStyle: {
            width: 0,
          },
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
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
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
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
        data: this.shared.devFund().labels,
      },
      yAxis: {
        show: false,
      },
      series: [
        {
          name: 'Balance',
          symbol: 'none',
          data: this.shared.devFund().data,
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
        type: 'log'
      },
      yAxis: {
        show: false,
        data: [...this.shared.devFund().donors]
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
            color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
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
          data: [...this.shared.devFund().donors]
            .map((d) => Math.round(d.amount_nano))
            .slice(0, 5)
            .reverse(),
        },
      ],
    };
  }

  handleDonate(user: Contributor) {
    if (this.web3.snapConnected()) {
      if (this.donatingToUser === user.githubLogin) {
        this.donatingToUser = null;
      } else {
        this.donatingToUser = user.githubLogin;
        this.donationAmount = 1;
      }
    } else {
      window.open(`https://nano.to/${user.nanoAddress}`, '_blank');
    }
  }

  updateDonationAmount(event: any) {
    const val = parseFloat(event.target.innerText);
    if (!isNaN(val)) {
      this.donationAmount = val;
    } else {
      this.donationAmount = 1;
    }
  }

  submitDonation(user: Contributor) {
    if (!user.nanoAddress) return;
    this.web3.makeTx(user.nanoAddress, this.donationAmount.toString()).subscribe({
      next: (res) => {
        this.donatingToUser = null;
      },
      error: (err) => {
        console.error(err);
        this.donatingToUser = null;
        alert('Transaction failed or cancelled.');
      }
    });
  }
}
