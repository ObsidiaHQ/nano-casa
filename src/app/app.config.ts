import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  TimeagoModule,
  TimeagoIntl,
  TimeagoFormatter,
  TimeagoCustomFormatter,
  TimeagoPipe,
} from 'ngx-timeago';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    importProvidersFrom(
      TimeagoModule.forRoot({
        intl: TimeagoIntl,
        formatter: {
          provide: TimeagoFormatter,
          useClass: TimeagoCustomFormatter,
        },
      })
    ),
  ],
};
