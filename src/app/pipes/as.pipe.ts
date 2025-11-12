import { Pipe, PipeTransform } from '@angular/core';
import { Contributor, Repo } from '../api.types';

@Pipe({
  name: 'asRepo',
  standalone: true,
})
export class AsRepoPipe implements PipeTransform {
  transform(value: any, args?: any): Repo[] {
    return value;
  }
}

@Pipe({
  name: 'asUser',
  standalone: true,
})
export class AsUserPipe implements PipeTransform {
  transform(value: any, args?: any): Contributor[] {
    return value;
  }
}
