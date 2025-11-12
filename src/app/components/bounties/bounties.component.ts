import { Component, inject } from '@angular/core';
import { SharedService } from '../../shared.service';
import { IconComponent } from '../icon/icon.component';
import { CommonModule } from '@angular/common';
import { TimeagoModule } from 'ngx-timeago';

@Component({
    selector: 'app-bounties',
    imports: [CommonModule, IconComponent, TimeagoModule],
    templateUrl: './bounties.component.html',
    styleUrls: ['./bounties.component.css']
})
export class BountiesComponent {
  readonly shared = inject(SharedService);
  bounties = [
    {
      title: 'Refactor Legacy Codebase',
      description:
        'Refactor the legacy code to adhere to modern best practices. The goal is to improve readability, reduce technical debt, and make the code easier to maintain for future contributors.',
      deadline: 1725888009650,
      created_at: 1723640374159,
      reward: 150,
      creator: 'geommr',
    },
    {
      title: 'Dark Mode',
      description:
        'Add a dark mode feature to our existing web application. The task includes designing the dark mode theme, implementing it without altering the existing styles, and providing a toggle option for users. Consider accessibility and user preferences during development',
      deadline: 1735888009650,
      created_at: 1724640374159,
      reward: 250,
      creator: 'naner',
    },
  ];
}
