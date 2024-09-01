import { Pipe, PipeTransform } from '@angular/core';
import { Contributor, Repo } from '../../../server/models';

@Pipe({
  name: 'asRepo',
})
export class AsRepoPipe implements PipeTransform {
  transform(value: any, args?: any): Repo[] {
    return value;
  }
}

@Pipe({
  name: 'asUser',
})
export class AsUserPipe implements PipeTransform {
  transform(value: any, args?: any): Contributor[] {
    return value;
  }
}
