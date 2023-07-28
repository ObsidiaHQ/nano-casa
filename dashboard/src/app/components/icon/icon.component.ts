import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      attr.width="{{ size }}px"
      attr.height="{{ size }}px"
      attr.fill="{{ fill }}"
      attr.class="{{ classList }}"
      attr.stroke="{{ strokeColor }}"
      attr.stroke-width="{{ strokeWidth }}"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <use attr.xlink:href="assets/icons/{{ icon }}.svg#{{ icon }}"></use>
    </svg>
  `,
})
export class IconComponent implements OnInit {
  @Input() icon!: string;
  @Input() size?: string = '20';
  @Input() fill?: string = 'none';
  @Input() classList?: string;
  @Input() strokeColor?: string = 'currentColor';
  @Input() strokeWidth?: string = '1.5';

  ngOnInit(): void {}
}
