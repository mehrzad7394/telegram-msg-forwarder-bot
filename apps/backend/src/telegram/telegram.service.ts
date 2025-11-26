import { Inject, Injectable, Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { UsersService } from '../users/users.service';
import { FiltersService } from '../filters/filters.service';
import { QueueService } from '../queue/queue.service';
import { ChannelsService } from '../channels/channels.service';
import { MessageProcessorService } from '../queue/message-processor.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<Context>;
  constructor(
    @Inject('TELEGRAF_BOT') bot: Telegraf<Context>,
    private readonly usersService: UsersService,
    private readonly filtersService: FiltersService,
    private readonly queueService: QueueService,
    private readonly channelsService: ChannelsService,
    private readonly messageProcessor: MessageProcessorService,
  ) {
    this.bot = bot;
    this.setupHandlers();
  }
  private setupHandlers() {
    //start command
    this.bot.start(this.handleStart.bind(this));

    //Channel command
    this.bot.command('channel', this.handleChannelCommand.bind(this));

    // Help command
    this.bot.command('help', this.handleHelpCommand.bind(this));

    // Verify admin command
    this.bot.command('verifyadmin', this.handleVerifyAdmin.bind(this));

    // Stop command
    this.bot.command('stop', this.handleStopCommand.bind(this));

    // Handle all messages
    this.bot.on('message', this.handleMessage.bind(this));
  }
  private async handleStart(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    try {
      // Check if the user exists in database
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await ctx.reply(
          '❌ You are not authorized to use this bot. Please contact admin to get access.',
        );
        return;
      }
    } catch (error) {}
  }

  private async handleChannelCommand(ctx: Context) {}
  private async handleHelpCommand(ctx: Context) {}
  private async handleVerifyAdmin(ctx: Context) {}
  private async handleStopCommand(ctx: Context) {}
  private async handleMessage(ctx: Context) {}
}
