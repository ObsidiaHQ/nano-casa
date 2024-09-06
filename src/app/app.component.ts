import { Component } from '@angular/core';
import {
  ChildrenOutletContexts,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { fader } from './animation';
import { SharedService } from './shared.service';
import { IconComponent } from './components/icon/icon.component';
import { TimeagoIntl, TimeagoModule } from 'ngx-timeago';
import { strings as englishShortStrings } from '../../node_modules/ngx-timeago/language-strings/en-short';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    IconComponent,
    RouterLinkActive,
    TimeagoModule,
    RouterLink,
  ],
  templateUrl: './app.component.html',
  animations: [fader],
})
export class AppComponent {
  constructor(
    protected shared: SharedService,
    private contexts: ChildrenOutletContexts,
    private intl: TimeagoIntl
  ) {
    this.intl.strings = englishShortStrings;
    this.intl.changes.next();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }

  logIn() {
    window.open('/api/auth/github', '_self');
  }
}
