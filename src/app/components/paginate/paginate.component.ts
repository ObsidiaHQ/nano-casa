import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

import paginate from 'jw-paginate';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: ` <div class="card-footer d-flex align-items-center">
    <ul class="pagination m-0 ms-auto">
      <li
        class="page-item mx-2"
        [ngClass]="{ disabled: pager.currentPage === 1 }"
      >
        <a
          class="page-link"
          tabindex="-1"
          (click)="setPage(pager.currentPage - 1)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <polyline points="15 6 9 12 15 18" />
          </svg>
          prev
        </a>
      </li>
      @for (_ of [].constructor(pager.totalPages); track $index; let i = $index)
      {
      <li
        class="page-item d-none d-md-inline-block"
        [ngClass]="{ active: pager.currentPage === i + 1 }"
      >
        <a class="page-link" (click)="setPage(i + 1)">{{ i + 1 }}</a>
      </li>
      }

      <li
        class="page-item mx-2"
        [ngClass]="{ disabled: pager.currentPage === pager.totalPages }"
      >
        <a class="page-link" (click)="setPage(pager.currentPage + 1)">
          next
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </a>
      </li>
    </ul>
  </div>`,
  encapsulation: ViewEncapsulation.None
})
export class PaginationComponent implements OnInit, OnChanges {
  @Input() items: Array<any> = [];
  @Output() itemsChange = new EventEmitter<any>(true);
  @Input() pageSize = 10;
  @Input() maxPages = 10;

  pager: any = {};
  initialPage = 1;

  ngOnInit() {
    if (this.items && this.items.length) {
      this.setPage(this.initialPage);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items'].currentValue !== changes['items'].previousValue) {
      this.setPage(this.initialPage);
    }
  }

  setPage(page: number) {
    this.pager = paginate(
      this.items.length,
      page,
      this.pageSize,
      this.maxPages
    );

    var pageOfItems = this.items.slice(
      this.pager.startIndex,
      this.pager.endIndex + 1
    );

    this.itemsChange.emit({ items: pageOfItems, page });
  }
}
