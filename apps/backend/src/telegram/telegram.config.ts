import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramConfig {
  constructor(private configService: ConfigService) {}

  getToken(): string {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN is not configured');
    }
    return token;
  }
}
