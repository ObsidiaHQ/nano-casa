import { AfterViewInit, Component, Input } from '@angular/core';
declare var nano;

@Component({
  selector: 'app-goal',
  template: ` <div [id]="id" [title]="title"></div> `,
})
export class GoalComponent implements AfterViewInit {
  @Input() id!: string;
  @Input() address: string =
    'nano_1faucet7b6xjyha7m13objpn5ubkquzd6ska8kwopzf1ecbfmn35d1zey3ys';
  @Input() amount: number = 15;
  @Input() title: string = 'Bird Sanctuary';
  @Input() color: string = '#4299e1';
  @Input() website: string;

  constructor() {}

  ngAfterViewInit(): void {
    nano.goal({
      element: `#${this.id}`,
      address: this.address,
      amount: this.amount,
      title: this.title,
      color: this.color,
      href: this.website,
    });
  }
}
