import { AfterViewInit, Component, Input } from '@angular/core';
declare var nano;

@Component({
  selector: 'app-goal',
  template: `
    @if (barOnly) {

    <div
      [id]="sid"
      [title]="title || 'Funding goal'"
      [attr.data-title]="title || 'Funding goal'"
      [attr.data-color]="color"
      [attr.data-type]="'bar'"
      [attr.data-address]="address"
      [attr.data-amount]="amount"
    ></div>

    } @else {

    <div
      style="min-height: 120px;"
      [id]="sid"
      [attr.data-title]="title"
      [attr.data-color]="color"
      [attr.data-address]="address"
      [attr.data-amount]="amount"
    >
      <div class="row align-items-center placeholder-glow">
        <div class="col-3 me-auto">
          <div class="placeholder placeholder-xs col-12"></div>
        </div>
        <div class="col-1">
          <div class="placeholder placeholder-xs col-12"></div>
        </div>
        <div class="col-12 my-2">
          <div class="placeholder placeholder-xs col-12"></div>
        </div>
        <div class="col-2 me-auto">
          <div class="placeholder placeholder-xs col-8"></div>
        </div>
        <div class="col-2">
          <div class="placeholder placeholder-xs col-12"></div>
        </div>
      </div>
    </div>
    <span class="text-muted mt-1">{{ description }}</span>

    }
  `,
})
export class GoalComponent implements AfterViewInit {
  @Input() sid: string;
  @Input() address: string;
  @Input() title: string;
  @Input() amount: number;
  @Input() color: string = '#4299e1';
  @Input() website: string;
  @Input() description: string;
  @Input() barOnly = true;

  constructor() {}

  ngAfterViewInit(): void {
    nano.goal({
      element: `#${this.sid}`,
    });
  }
}
