import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { SharedService } from '../../shared.service';
import { EChartsOption } from 'echarts';
import { graphic } from 'echarts/core';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';

@Component({
    selector: 'app-leaderboard',
    templateUrl: './leaderboard.component.html',
    imports: [NgxEchartsDirective],
    providers: [provideEcharts()],
    styleUrl: './leaderboard.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaderboardComponent implements AfterViewInit {
  donorsChartOpts: EChartsOption;

  protected shared = inject(SharedService);
  private cdr = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
    setTimeout(() => {
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
          show: false,
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
              color: new graphic.LinearGradient(0, 0, 1, 1, [
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
      };
      this.cdr.markForCheck();
    }, 250);
  }
}
