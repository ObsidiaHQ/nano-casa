import { Pipe, PipeTransform } from '@angular/core';
import { Contributor, Repo } from '../api.types';

@Pipe({
  name: 'filter',
  standalone: true,
})
export class FilterPipe implements PipeTransform {
  transform(
    values: any[],
    type: 'repo' | 'user' | 'busyWeek' | 'busyMonth',
    query?: string
  ) {
    if (!query || (query.length < 3 && type === 'repo'))
      return values as Repo[];
    if (!query || (query.length < 3 && type === 'user'))
      return values as Contributor[];

    if (type === 'repo') {
      return [...values].filter((value: Repo) => {
        return (
          value.fullName.toLowerCase().includes(query.toLowerCase()) ||
          value.description?.toLowerCase().includes(query.toLowerCase())
        );
      }) as Repo[];
    } else if (type === 'user') {
      return [...values].filter((value: Contributor) => {
        return (
          value.githubLogin.toLowerCase().includes(query.toLowerCase()) ||
          value.repos.findIndex((re) =>
            re.toLowerCase().includes(query.toLowerCase())
          ) > -1
        );
      }) as Contributor[];
    } else {
      return [...values].filter((value: Repo) => {
        return type === 'busyWeek'
          ? value.commits7d + value.prs7d > 0
          : value.commits30d + value.prs30d > 0;
      }) as Repo[];
    }
  }
}
