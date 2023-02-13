import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { PaginationComponent } from './paginate.component';
import { NgxEchartsModule } from 'ngx-echarts';
import { TimeagoModule } from 'ngx-timeago';
import { CountUpModule } from 'ngx-countup';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [AppComponent, PaginationComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts'),
    }),
    TimeagoModule.forRoot(),
    CountUpModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
