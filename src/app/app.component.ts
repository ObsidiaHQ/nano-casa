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
import { MetaMaskInpageProvider } from '@metamask/providers';

declare global {
  interface Window {
    ethereum: MetaMaskInpageProvider;
  }
}

const { ethereum } = window;

const snapId = 'npm:@obsidia/xnap';

export async function connect(cb: (connected: boolean) => void) {
  let connected = false;
  try {
    const result: any = await ethereum.request({
      method: 'wallet_requestSnaps',
      params: {
        [snapId]: {
          version: '1.0.0'
        },
      },
    });
    console.log(result?.snaps?.[snapId]?.error);
    const hasError = !!result?.snaps?.[snapId]?.error;
    connected = !hasError;
  } finally {
    cb(connected);
  }
}

export async function getAccount(cb: (account: string) => void) {
  let account;
  try {
    const result: any = await ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId,
        request: {
          method: 'xno_getAddress',
          params: {},
        },
      },
    });
    account = result;
  } catch (e) {
    console.log(e);
  } finally {
    cb(account);
  }
}

export async function makeTx(account: string, cb: (amount: number) => void) {
  let res: number;
  try {
    res = await ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId,
        request: {
          method: 'xno_makeTransaction',
          params: {
            to: "@ben@xno.link", // account,
            value: '0.001'
          },
        },
      },
    }) as number;
  } catch (e) {
    console.log(e);
  } finally {
    cb(res);
  }
}

export async function signMessage(message: any, cb: (sig: string) => void) {
  let res: string;
  try {
    res = await ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId,
        request: {
          method: 'xno_signMessage',
          params: {
            message
          },
        },
      },
    }) as string;
    console.log(res);
  } catch (e) {
    console.log(e);
  } finally {
    cb(res);
  }
}

export async function getCurrentAddress(cb: (acc: { address: string, icon: string }) => void) {
  let res: { address: string, icon: string };
  try {
    res = await ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId,
        request: {
          method: 'xno_getCurrentAddress'
        },
      },
    }) as { address: string, icon: string };
  } catch (e) {
    console.log(e);
  } finally {
    cb(res);
  }
}

@Component({
    selector: 'app-root',
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
  snapConnected: boolean;
  //private contexts = inject(ChildrenOutletContexts);
  private intl = inject(TimeagoIntl);
  protected shared = inject(SharedService);

  constructor() {
    this.intl.strings = englishShortStrings;
    this.intl.changes.next();

    ethereum?.request({
      method: "wallet_getSnaps",
    }).then(snaps => {
      this.snapConnected = Object.keys(snaps).includes("npm:@obsidia/xnap")
    })
  }

  getRouteAnimationData() {
    //return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
    //  'animation'
    //];
  }

  connectMetamask() {
    connect((connected: boolean) => {
      if (connected) {
        alert("connected");
      }
    });
  }

  async getAccount() {
    getAccount((acc: string) => {
      if (acc) {
        alert(acc);
      }
    });
  }

  async makeTx() {
    const account = 'nano_3afgxnuotru59s9n9sefrwudtaibuzn3zccqhyq7ammrth1fzn3iiw5ykwyw';
    makeTx(account, (res: number) => {
      if (res) {
        alert(JSON.stringify(res));
      }
    });
  }

  async signMessage() {
    signMessage((`some message to sign
      
      
      
      
      
      new line`), (sig: string) => {
      alert(JSON.stringify(sig));
    });
  }

  async getCurrentAddress() {
    getCurrentAddress((acc: { address: string, icon: string }) => {
      alert(acc.address);
      console.log(acc.icon);
    });
  }

  async logIn() {
    const { authClient } = await import('./auth-client');
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/',
    });
  }
}
