import { Pipe, PipeTransform } from '@angular/core';
import { IContributor, IRepo } from '../../../interfaces';

@Pipe({
  name: 'sort',
})
export class SortPipe implements PipeTransform {
  transform(
    values: any[],
    type: 'repo' | 'user' | 'busyWeek' | 'busyMonth',
    sortBy?: 'month' | 'total' | 'date' | 'stars'
  ) {
    if (type === 'busyMonth') {
      return [...values].sort(
        (a, b) => b.commits_30d + b.prs_30d - a.commits_30d - a.prs_30d
      ) as IRepo[];
    } else if (type === 'busyWeek') {
      return [...values].sort(
        (a, b) => b.commits_7d + b.prs_7d - a.commits_7d - a.prs_7d
      ) as IRepo[];
    } else if (type === 'repo') {
      return [...values].sort((a, b) => {
        return sortBy === 'stars'
          ? b.stargazers_count - a.stargazers_count
          : +new Date(b.created_at) - +new Date(a.created_at);
      }) as IRepo[];
    } else {
      return [...values].sort((a, b) => {
        return sortBy === 'total'
          ? b.contributions - a.contributions
          : b.last_month - a.last_month;
      }) as IContributor[];
    }
  }
}
