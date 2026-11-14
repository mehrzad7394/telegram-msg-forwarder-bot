import { Inject, Injectable, Logger } from '@nestjs/common';
import { TelegramService } from 'src/telegram/telegram.service';
import { RelayChannelPostPayload } from 'src/types/types';
import { TelegramClient } from 'teleproto';
import { NewMessage, NewMessageEvent } from 'teleproto/events';
import { SourceChannelsService } from 'src/sourceChannels/sourceChannels.service';
import { SettingService } from 'src/setting/setting.service';

@Injectable()
export class TeleprotoListenerService {
  private readonly logger = new Logger(TeleprotoListenerService.name);
  private handler: (event: NewMessageEvent) => Promise<void> = async () => {};

  constructor(
    @Inject('TELEPROTO_CLIENT') private readonly client: TelegramClient,
    private readonly telegramService: TelegramService,
    private readonly sourceChannelsService: SourceChannelsService,
    private readonly settingService = SettingService,
  ) {}

  initializeListner() {
    //  the handler function for new messages
    this.handler = async (event: NewMessageEvent) => {
      try {
        if (!event.isChannel) return;

        const msg = event.message;
        if (!msg) return;
        // 1. Skip messages with no text and no media
        if (!msg.message && !msg.media) return;

        // 2. Filter out non-channel messages (only interested in channel posts)
        if (msg.peerId?.className !== 'PeerChannel') return;

        // 3. Extract the channel's marked ID (e.g. "-1002590125715")
        const channelId = await this.client.getPeerId(msg.peerId, true);

        // 4. Check Valid time to receive message
        if (!isListeningTime(settings)) {
          return;
        }
        // 5.Get active channels to receive message from.
        const channelLists = this.sourceChannelsService.getActiveChannels();
        if (!channelLists.includes(channelId)) return;

        const payload: RelayChannelPostPayload = {
          message: msg.message ?? '',
          messageId: msg.id,
          telegramChannelId: channelId,
        };

        await this.telegramService.handleListnerMessage(payload);
      } catch (err) {
        this.logger.error(
          'Listener handler error',
          err instanceof Error ? err.stack : err,
        );
      }
    };

    // Register the handler to the client
    this.client.addEventHandler((event: NewMessageEvent) => {
      void this.handler(event);
    }, new NewMessage({}));
    this.logger.log('Teleproto listener started, waiting for channel posts...');
  }

  async destroyListner() {
    if (this.handler) {
      this.client.removeEventHandler(this.handler, new NewMessage({}));
    }
    await this.client.disconnect();
  }
}
