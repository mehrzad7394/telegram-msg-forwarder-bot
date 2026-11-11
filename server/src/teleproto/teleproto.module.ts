import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';

@Global()
@Module({
  providers: [
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
export class TeleprotoModule {}
