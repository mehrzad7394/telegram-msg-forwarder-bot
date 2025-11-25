import { Injectable } from '@nestjs/common';

@Injectable()
export class FiltersService {
  getHello(): string {
    return 'Hello World!';
  }
}
