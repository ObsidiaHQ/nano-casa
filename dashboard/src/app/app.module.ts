import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { PaginationComponent } from './paginate.component';
import { NgxEchartsModule } from 'ngx-echarts';
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

@NgModule({
  declarations: [
    AppComponent,
    PaginationComponent,
    AboutComponent,
    HomeComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts'),
    }),
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
