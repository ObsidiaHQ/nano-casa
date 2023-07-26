import { Pipe, PipeTransform } from '@angular/core';
import { Contributor, Repo } from '../interfaces';

@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(
    values: any[],
    type: 'repo' | 'user' | 'busyWeek' | 'busyMonth',
    query?: string
  ) {
    if (query?.length < 3 && type === 'repo') return values as Repo[];
    if (query?.length < 3 && type === 'user') return values as Contributor[];

    if (type === 'repo') {
      return [...values].filter((value: Repo) => {
        return (
          value.full_name.toLowerCase().includes(query.toLowerCase()) ||
          value.description?.toLowerCase().includes(query.toLowerCase())
        );
      }) as Repo[];
    } else if (type === 'user') {
      return [...values].filter((value: Contributor) => {
        return (
          value.login.toLowerCase().includes(query.toLowerCase()) ||
          value.repos.findIndex((re) =>
            re.toLowerCase().includes(query.toLowerCase())
          ) > -1 ||
          value.profile?.bio?.toLowerCase().includes(query.toLowerCase())
        );
      }) as Contributor[];
    } else {
      return [...values].filter((value: Repo) => {
        return type === 'busyWeek'
          ? value.commits_7d + value.prs_7d > 0
          : value.commits_30d + value.prs_30d > 0;
      }) as Repo[];
    }
  }
}
