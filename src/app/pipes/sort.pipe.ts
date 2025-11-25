import { Pipe, PipeTransform } from '@angular/core';
import { Contributor, Repo } from '../api.types';

@Pipe({
  name: 'sort',
  standalone: true,
})
export class SortPipe implements PipeTransform {
  transform(
    values: any[],
    type: 'repo' | 'user' | 'busyWeek' | 'busyMonth',
    sortBy?: 'month' | 'total' | 'date' | 'stars' | 'activity'
  ) {
    if (type === 'busyMonth') {
      return [...values].sort(
        (a, b) => b.commits30d + b.prs30d - a.commits30d - a.prs30d
      ) as Repo[];
    } else if (type === 'busyWeek') {
      return [...values].sort(
        (a, b) => b.commits7d + b.prs7d - a.commits7d - a.prs7d
      ) as Repo[];
    } else if (type === 'repo') {
      return [...values].sort((a, b) => {
        if (sortBy === 'stars') {
          return b.stargazersCount - a.stargazersCount;
        } else if (sortBy === 'activity') {
          // Sort by most recent commit date
          const dateA = a.mostRecentCommit ? +new Date(a.mostRecentCommit) : 0;
          const dateB = b.mostRecentCommit ? +new Date(b.mostRecentCommit) : 0;
          return dateB - dateA;
        } else {
          // Default: sort by creation date
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        }
      }) as Repo[];
    } else {
      return [...values].sort((a, b) => {
        return sortBy === 'total'
          ? b.contributions - a.contributions
          : b.lastMonth - a.lastMonth;
      }) as Contributor[];
    }
  }
}
