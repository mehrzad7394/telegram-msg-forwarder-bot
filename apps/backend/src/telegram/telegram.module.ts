import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UsersModule } from '../users/users.module';
import { FiltersModule } from '../filters/filters.module';
import { QueueModule } from '../queue/queue.module';
import { ChannelsModule } from '../channels/channels.module';
import { TelegramConfig } from './telegram.config';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    FiltersModule,
    QueueModule,
    ChannelsModule,
  ],
  providers: [
    TelegramService,
    {
      provide: 'TELEGRAF_BOT',
      useFactory: (telegramConfig: TelegramConfig) => {
        return new Telegraf(telegramConfig.getToken());
      },
      inject: [TelegramConfig],
    },
  ],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}
  async onModuleInit() {
    await this.telegramService.launchBot();
  }
  async onModuleDestroy() {
    await this.telegramService.stopBot();
  }
}
