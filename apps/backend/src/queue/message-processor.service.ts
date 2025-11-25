import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageProcessorService {
  getHello(): string {
    return 'Hello World!';
  }
}
