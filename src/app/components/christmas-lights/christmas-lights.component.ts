import { ChangeDetectionStrategy, Component } from '@angular/core';

export function isChristmasLightsSeason(now: Date): boolean {
  const year = now.getFullYear();
  const seasonYear = now.getMonth() === 0 ? year - 1 : year;

  return (
    now >= new Date(seasonYear, 11, 1) &&
    now < new Date(seasonYear + 1, 0, 2)
  );
}

@Component({
  selector: 'app-christmas-lights',
  standalone: true,
  templateUrl: './christmas-lights.component.html',
  styleUrl: './christmas-lights.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChristmasLightsComponent {
  protected readonly visible = isChristmasLightsSeason(new Date());
  protected readonly lights = [
    { left: 3.3, drop: 10, color: '#ffd43b', delay: '-0.4s' },
    { left: 10, drop: 23, color: '#fa5252', delay: '-1.8s' },
    { left: 16.7, drop: 28, color: '#51cf66', delay: '-0.9s' },
    { left: 23.3, drop: 23, color: '#ffd43b', delay: '-2.2s' },
    { left: 30, drop: 10, color: '#fa5252', delay: '-1.2s' },
    { left: 36.7, drop: 10, color: '#51cf66', delay: '-2.7s' },
    { left: 43.3, drop: 23, color: '#ffd43b', delay: '-0.6s' },
    { left: 50, drop: 28, color: '#fa5252', delay: '-2s' },
    { left: 56.7, drop: 23, color: '#51cf66', delay: '-1.4s' },
    { left: 63.3, drop: 10, color: '#ffd43b', delay: '-2.9s' },
    { left: 70, drop: 10, color: '#fa5252', delay: '-0.2s' },
    { left: 76.7, drop: 23, color: '#51cf66', delay: '-2.4s' },
    { left: 83.3, drop: 28, color: '#ffd43b', delay: '-1s' },
    { left: 90, drop: 23, color: '#fa5252', delay: '-2.1s' },
    { left: 96.7, drop: 10, color: '#51cf66', delay: '-1.5s' },
  ];
}
