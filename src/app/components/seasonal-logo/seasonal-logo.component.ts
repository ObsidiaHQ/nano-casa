import { ChangeDetectionStrategy, Component } from '@angular/core';

export type LogoCelebration =
  | { kind: 'anniversary'; age: number }
  | { kind: 'halloween' }
  | { kind: 'christmas' }
  | { kind: 'none' };

export function getLogoCelebration(now: Date): LogoCelebration {
  const year = now.getFullYear();
  const age = year - 2022;

  if (
    age > 0 &&
    now >= new Date(year, 3, 6) &&
    now < new Date(year, 3, 13)
  ) {
    return { kind: 'anniversary', age };
  }

  if (now >= new Date(year, 9, 26) && now < new Date(year, 10, 2)) {
    return { kind: 'halloween' };
  }

  const christmasYear = now.getMonth() === 0 ? year - 1 : year;
  const firstAdvent = new Date(christmasYear, 11, 25);
  firstAdvent.setDate(firstAdvent.getDate() - (firstAdvent.getDay() || 7) - 21);

  if (
    now >= firstAdvent &&
    now < new Date(christmasYear + 1, 0, 2)
  ) {
    return { kind: 'christmas' };
  }

  return { kind: 'none' };
}

@Component({
  selector: 'app-seasonal-logo',
  standalone: true,
  templateUrl: './seasonal-logo.component.html',
  styleUrl: './seasonal-logo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonalLogoComponent {
  protected readonly celebration = getLogoCelebration(new Date());
}
