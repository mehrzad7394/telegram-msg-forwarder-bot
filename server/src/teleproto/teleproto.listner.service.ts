import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { TelegramClient } from 'teleproto';
import { NewMessage } from 'teleproto/events';

@Injectable()
export class TeleprotoListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TeleprotoListenerService.name);
  private handler: (event: any) => Promise<void>;

  constructor(
    @Inject('TELEPROTO_CLIENT') private readonly client: TelegramClient,
  ) {}

  onModuleInit() {
    // Define the handler function for new messages
    this.handler = async (event: any) => {
      try {
        const msg = event.message;
        if (!msg) return;

        // 1. Filter out non-channel messages (only interested in channel posts)
        // teleproto's message.peerId determines the chat type
        // if (msg.peerId?.className !== 'PeerChannel') return;

        // 2. Extract the channel's numeric ID
        // const channelId = msg.peerId.channelId.toString();

        // 3. Query the database to confirm this is a channel you're tracking
        // const channel = await this.channelModel.findOne({
        //   telegramId: channelId,
        //   enabled: true,
        // });

        // if (!channel) return; // Skip channels you don't care about

        // 4. Skip empty messages (pure service messages or messages with no text content)
        // if (!msg.message && !msg.media) return;

        this.logger.log(`Received post  ${msg.message?.slice(0, 50)}...`);

        // 5. Push to the queue and let your existing QueueProcessor handle sending to the bot
        // await this.queueService.enqueueIncoming({
        //   channelId: channel._id.toString(),
        //   telegramChannelId: channelId,
        //   messageId: msg.id,
        //   text: msg.message ?? '',
        //   rawUpdate: this.serializeUpdate(msg),
        //   receivedAt: new Date(),
        // });
      } catch (err) {
        this.logger.error(
          'Listener handler error',
          err instanceof Error ? err.stack : err,
        );
      }
    };

    // Register the handler to the client
    this.client.addEventHandler(this.handler, new NewMessage({}));
    this.logger.log('Teleproto listener started, waiting for channel posts...');
  }

  async onModuleDestroy() {
    if (this.handler) {
      this.client.removeEventHandler(this.handler, new NewMessage({}));
    }
    await this.client.disconnect();
  }
}
