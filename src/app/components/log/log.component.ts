import { Component, inject } from '@angular/core';
import { SharedService } from '../../shared.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './log.component.html',
  styleUrl: './log.component.css'
})
export class LogComponent {
  shared = inject(SharedService);

  ngOnInit() {
    this.shared.getLogs();
  }
}
