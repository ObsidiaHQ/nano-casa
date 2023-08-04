import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { PaginationComponent } from './paginate.component';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import {
  TimeagoModule,
  TimeagoIntl,
  TimeagoFormatter,
  TimeagoCustomFormatter,
} from 'ngx-timeago';
import { strings as englishShortStrings } from 'ngx-timeago/language-strings/en-short';
import { CountUpModule } from 'ngx-countup';
import { FormsModule } from '@angular/forms';
import { AboutComponent } from './components/about/about.component';
import { RouterModule } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { IconComponent } from './components/icon/icon.component';
import { GoalComponent } from './components/goal/goal.component';
import { FilterPipe } from './pipes/filter.pipe';
import { SortPipe } from './pipes/sort.pipe';
import { AsRepoPipe, AsUserPipe } from './pipes/as.pipe';
import { PublicNodesComponent } from './components/public-nodes/public-nodes.component';
echarts.use([
  LineChart,
  BarChart,
  CanvasRenderer,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
]);

@NgModule({
  declarations: [
    AppComponent,
    PaginationComponent,
    AboutComponent,
    HomeComponent,
    IconComponent,
    GoalComponent,
    FilterPipe,
    SortPipe,
    AsRepoPipe,
    AsUserPipe,
    PublicNodesComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NgxEchartsModule.forRoot({ echarts }),
    TimeagoModule.forRoot({
      intl: TimeagoIntl,
      formatter: {
        provide: TimeagoFormatter,
        useClass: TimeagoCustomFormatter,
      },
    }),
    CountUpModule,
    FormsModule,
    RouterModule.forRoot([
      { path: 'about', component: AboutComponent },
      { path: 'public-nodes', component: PublicNodesComponent },
      { path: '**', component: HomeComponent },
    ]),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(private intl: TimeagoIntl) {
    this.intl.strings = englishShortStrings;
    this.intl.changes.next();
  }
}
