import {
  forwardRef,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { FiltersModule } from '../filters/filters.module';
import { QueueModule } from '../queue/queue.module';
import { ChannelsModule } from '../channels/channels.module';
import { TelegramConfig } from './telegram.config';
import { SettingModule } from 'src/setting/setting.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    FiltersModule,
    forwardRef(() => QueueModule),
    ChannelsModule,
    SettingModule,
  ],
  providers: [
    TelegramService,
    TelegramConfig,
    {
      provide: 'TELEGRAF_BOT',
      useFactory: (telegramConfig: TelegramConfig) => {
        return new Telegraf(telegramConfig.getToken());
      },
      inject: [TelegramConfig],
    },
  ],
  exports: [TelegramService],
})
export class TelegramModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly telegramService: TelegramService) {}
  async onModuleInit() {
    await this.telegramService.initializeBot();
    this.telegramService.launchBot();
  }
  onModuleDestroy() {
    this.telegramService.stopBot();
  }
}
