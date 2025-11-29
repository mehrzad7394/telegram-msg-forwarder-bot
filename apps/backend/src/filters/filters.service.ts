import { Injectable } from '@nestjs/common';

@Injectable()
export class FiltersService {
  async loadFilters() {
    return 'Hello World!';
  }
  async clearCache() {
    return 'Hello World!';
  }
}
