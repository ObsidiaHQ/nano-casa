import { Pipe, PipeTransform } from '@angular/core';
import { IContributor, IRepo } from '../../../interfaces';

@Pipe({
  name: 'asRepo',
})
export class AsRepoPipe implements PipeTransform {
  transform(value: any, args?: any): IRepo[] {
    return value;
  }
}

@Pipe({
  name: 'asUser',
})
export class AsUserPipe implements PipeTransform {
  transform(value: any, args?: any): IContributor[] {
    return value;
  }
}
