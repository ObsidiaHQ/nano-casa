import { Injectable, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { ToastComponent } from './components/toast/toast.component';

export interface ToastOptions {
    message: string;
    duration?: number;
}

@Injectable({
    providedIn: 'root',
})
export class ToastService {
    private toastContainer: HTMLElement | null = null;

    constructor(
        private appRef: ApplicationRef,
        private injector: EnvironmentInjector
    ) {
        this.initToastContainer();
    }

    private initToastContainer() {
        if (typeof document !== 'undefined') {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            this.toastContainer.style.zIndex = '9999';
            document.body.appendChild(this.toastContainer);
        }
    }

    show(message: string, duration: number = 4000) {
        if (!this.toastContainer) return;

        const componentRef = createComponent(ToastComponent, {
            environmentInjector: this.injector,
        });

        componentRef.instance.message = message;
        componentRef.instance.duration = duration;

        this.appRef.attachView(componentRef.hostView);
        this.toastContainer.appendChild(componentRef.location.nativeElement);

        componentRef.instance.onClose.subscribe(() => {
            this.appRef.detachView(componentRef.hostView);
            componentRef.destroy();
        });

        componentRef.instance.show();
    }
}

