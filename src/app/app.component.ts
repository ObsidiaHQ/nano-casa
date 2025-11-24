import { Component, inject } from '@angular/core';
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
import { authClient } from './auth-client';
import { Web3Service } from './web3.service';
import { ToastService } from './toast.service';

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
  animations: [fader]
})
export class AppComponent {
  private contexts = inject(ChildrenOutletContexts);
  private intl = inject(TimeagoIntl);
  protected shared = inject(SharedService);
  protected web3 = inject(Web3Service);
  protected toast = inject(ToastService);

  constructor() {
    this.intl.strings = englishShortStrings;
    this.intl.changes.next();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }

  connectMetamask() {
    this.web3.connect().subscribe({
      next: () => this.toast.show('Wallet connected successfully'),
      error: (err) => {
        console.error(err);
        this.toast.show('Failed to connect wallet');
      }
    });
  }

  makeTx() {
    const account = 'nano_3afgxnuotru59s9n9sefrwudtaibuzn3zccqhyq7ammrth1fzn3iiw5ykwyw';
    this.web3.makeTx(account).subscribe();
  }

  async logIn() {
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/'
      });
    } catch (error) {
      console.error('Login failed:', error);
      this.toast.show('Failed to login with GitHub. Please try again.');
    }
  }
}
