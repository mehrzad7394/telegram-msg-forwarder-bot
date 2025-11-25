import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UsersModule } from '../users/users.module';
import { FiltersModule } from '../filters/filters.module';
import { QueueModule } from '../queue/queue.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    ConfigModule,
    TelegrafModule.forRootAsync({
      useFactory: () => ({
        token: process.env.BOT_TOKEN!,
      }),
    }),
    UsersModule,
    FiltersModule,
    QueueModule,
    ChannelsModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
