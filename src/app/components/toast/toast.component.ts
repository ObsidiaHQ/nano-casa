import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-toast',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.css'],
})
export class ToastComponent {
    message = '';
    duration = 3000;
    isVisible = false;

    @Output() onClose = new EventEmitter<void>();

    show() {
        this.isVisible = true;
        setTimeout(() => {
            this.hide();
        }, this.duration);
    }

    hide() {
        this.isVisible = false;
        setTimeout(() => {
            this.onClose.emit();
        }, 300);
    }
}

