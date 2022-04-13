import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

import paginate from 'jw-paginate';

@Component({
    selector: 'app-pagination',
    template: `<ul *ngIf="pager.pages && pager.pages.length" class="pagination">
        <li [ngClass]="{disabled:pager.currentPage === 1}" class="page-item previous-item pt-md-2">
            <a (click)="setPage(pager.currentPage - 1)" class="page-link" role="button">< previous</a>
        </li>
        <li [ngClass]="{disabled:pager.currentPage === pager.totalPages}" class="page-item next-item pt-md-2">
            <a (click)="setPage(pager.currentPage + 1)" class="page-link" role="button">next ></a>
        </li>
    </ul>`,
    styles: [`.pagination {
        margin-bottom: 0;
        margin-top: 10px;
        display: flex;
        justify-content: center;
    }
    
    .pagination .page-item .page-link {
        background-color: transparent;
        border: none;
        color: var(--bg-light4);
        cursor: pointer;
        user-select: none;
    }
    
    .pagination .page-item.disabled .page-link {
        background-color: transparent;
        border: none;
        color: var(--bg-light2);
        user-select: none;
    }`]
})

export class PaginationComponent implements OnInit, OnChanges {
    @Input() items: Array<any>;
    @Output() changePage = new EventEmitter<any>(true);
    initialPage = 1;
    @Input() pageSize = 10;
    @Input() maxPages = 10;

    pager: any = {};

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
        this.pager = paginate(this.items.length, page, this.pageSize, this.maxPages);

        var pageOfItems = this.items.slice(this.pager.startIndex, this.pager.endIndex + 1);

        this.changePage.emit({items: pageOfItems, page});
    }
}