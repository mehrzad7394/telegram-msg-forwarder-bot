import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { TeleprotoListenerService } from './teleproto.listner.service';
import { TelegramModule } from 'src/telegram/telegram.module';
import { SourceChannelsModule } from 'src/sourceChannels/sourceChannels.module';
import { TelegramService } from 'src/telegram/telegram.service';

@Module({
  imports: [TelegramModule, SourceChannelsModule],
  providers: [
    TeleprotoListenerService,
    {
      provide: 'TELEPROTO_CLIENT',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const sessionString =
          configService.getOrThrow<string>('TELEGRAM_SESSION');
        const apiId = Number(
          configService.getOrThrow<string>('TELEGRAM_API_ID'),
        );
        const apiHash = configService.getOrThrow<string>('TELEGRAM_API_HASH');

        const session = new StringSession(sessionString);
        const client = new TelegramClient(session, apiId, apiHash, {
          connectionRetries: 5,
        });

        await client.connect();

        return client;
      },
    },
  ],
  exports: ['TELEPROTO_CLIENT'],
})
export class TeleprotoModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly teleprotoListenerService: TeleprotoListenerService,
    private readonly telegramService: TelegramService,
  ) {}
  onModuleInit() {
    if (this.telegramService.isBotInitialized()) {
      this.teleprotoListenerService.initializeListner();
    } else {
      this.telegramService.onBotReady(() => {
        this.teleprotoListenerService.initializeListner();
      });
    }
  }
  async onModuleDestroy() {
    await this.teleprotoListenerService.destroyListner();
  }
}
