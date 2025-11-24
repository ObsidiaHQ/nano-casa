import { inject, Injectable, signal } from '@angular/core';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, map, take, tap } from 'rxjs/operators';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastService } from './toast.service';

declare global {
    interface Window {
        ethereum: MetaMaskInpageProvider;
    }
}

const snapId = 'npm:@obsidia/xnap';

export interface WalletAccount {
    address: string;
    icon: string;
}

@Injectable({
    providedIn: 'root'
})
export class Web3Service {
    snapConnected = signal<boolean>(false);
    walletAccount = signal<WalletAccount | null>(null);
    sanitizer = inject(DomSanitizer);
    toast = inject(ToastService);

    private get ethereum() {
        return window.ethereum;
    }

    constructor() {
        this.checkConnection();
    }

    checkConnection() {
        if (!this.ethereum) return;

        from(this.ethereum.request({
            method: 'wallet_getSnaps',
        }) as Promise<Record<string, any>>).pipe(
            map(snaps => Object.keys(snaps).includes(snapId)),
            catchError(err => {
                console.error(err);
                return of(false);
            })
        ).subscribe(isConnected => {
            this.snapConnected.set(isConnected);
            if (isConnected) {
                this.refreshCurrentAddress();
            }
        });
    }

    connect(): Observable<boolean> {
        if (!this.ethereum) return of(false);

        return from(this.ethereum.request({
            method: 'wallet_requestSnaps',
            params: {
                [snapId]: {
                    version: '1.0.0'
                },
            },
        }) as Promise<any>).pipe(
            map(result => !result?.snaps?.[snapId]?.error),
            tap(connected => {
                if (connected) {
                    this.snapConnected.set(true);
                    this.refreshCurrentAddress();
                }
            }),
            take(1),
            catchError(err => {
                console.error(err);
                return of(false);
            })
        );
    }

    refreshCurrentAddress() {
        this.getCurrentAddress().subscribe({
            next: (account) => this.walletAccount.set(account),
            error: (err) => console.error('Failed to fetch address', err)
        });
    }

    makeTx(account: string, amount: string = '0.001'): Observable<number> {
        if (!this.ethereum) return throwError(() => new Error('Ethereum not found'));

        return from(this.ethereum.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId,
                request: {
                    method: 'xno_makeTransaction',
                    params: {
                        to: account,
                        value: amount
                    },
                },
            },
        }) as Promise<number>).pipe(
            tap(res => {
                if (res) {
                    this.toast.show('Transaction successfully sent');
                }
            }),
            catchError(err => {
                console.error(err);
                this.toast.show('Transaction failed');
                return of(0);
            })
        );
    }

    signMessage(message: string): Observable<string> {
        if (!this.ethereum) return throwError(() => new Error('Ethereum not found'));

        return from(this.ethereum.request({
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
        }) as Promise<string>);
    }

    getCurrentAddress(): Observable<WalletAccount> {
        if (!this.ethereum) return throwError(() => new Error('Ethereum not found'));

        return from(this.ethereum.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId,
                request: {
                    method: 'xno_getCurrentAddress'
                },
            },
        }) as Promise<WalletAccount>);
    }

    getSafeIcon(size: number = 22): SafeHtml {
        const account = this.walletAccount();
        if (!account || !account.icon) return '';

        const svgWithStyle = account.icon
            .replace('<svg', `<svg style="width: ${size}px; height: ${size}px"`);

        return this.sanitizer.bypassSecurityTrustHtml(svgWithStyle);
    }
}
