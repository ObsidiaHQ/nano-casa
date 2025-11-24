import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
} from '@angular/core';
import { SharedService } from '../../shared.service';
import * as echarts from 'echarts/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  standalone: true,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  styleUrl: './leaderboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaderboardComponent {
  donorsChartOpts: EChartsCoreOption = {};
  protected shared = inject(SharedService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      if (this.shared.devFund().donors?.length > 0) {
        this.initCharts();
        this.cdr.markForCheck();
      }
    });
  }

  initCharts() {
    this.donorsChartOpts = {
      barWidth: 20,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'none',
        },
        formatter(param) {
          return `${param[0].axisValue} (Ӿ${param[0].value})`;
        },
      },
      grid: {
        left: 0,
        top: 0,
        right: '13%',
        bottom: 0,
      },
      xAxis: {
        show: true,
        type: 'log',
        splitLine: {
          lineStyle: {
            color: '#243049',
          },
        },
        axisLabel: {
          color: '#efefef',
        },
      },
      yAxis: {
        show: false,
        data: [...this.shared.devFund().donors]
          .filter((d) => d.amount_nano > 0.5)
          .map((d) => d.username || d.account.substring(0, 18))
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
            fontSize: 14,
            position: 'outside',
            color: '#fff',
            formatter(param) {
              return `${param.name}`;
            },
          },
          data: [...this.shared.devFund().donors]
            .filter((d) => d.amount_nano > 0.5)
            .map((d) => Math.round(d.amount_nano))
            .reverse(),
        },
      ],
    }
  }
}
