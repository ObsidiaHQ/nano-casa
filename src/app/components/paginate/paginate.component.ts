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
      @for (page of visiblePages; track $index) {
        @if (page === null) {
          <li class="page-item disabled d-none d-md-inline-block">
            <span class="page-link">...</span>
          </li>
        } @else {
          <li
            class="page-item d-none d-md-inline-block"
            [ngClass]="{ active: pager.currentPage === page }"
          >
            <a class="page-link" (click)="setPage(page)">{{ page }}</a>
          </li>
        }
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

  get visiblePages(): Array<number | null> {
    const totalPages = this.pager.totalPages || 0;
    const currentPage = this.pager.currentPage || 1;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, null, totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        null,
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      null,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      null,
      totalPages,
    ];
  }

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
