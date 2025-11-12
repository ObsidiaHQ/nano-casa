import { Component, inject } from '@angular/core';
import { SharedService } from '../../shared.service';
import { IconComponent } from '../icon/icon.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-public-nodes',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './public-nodes.component.html',
  styleUrls: ['./public-nodes.component.css']
})
export class PublicNodesComponent {
  readonly shared = inject(SharedService);
}
