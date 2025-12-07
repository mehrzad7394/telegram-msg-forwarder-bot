import { Inject, Injectable, Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { UsersService } from '../users/users.service';
import { FiltersService } from '../filters/filters.service';
import { QueueService } from '../queue/queue.service';
import { ChannelsService } from '../channels/channels.service';
import { MessageProcessorService } from '../queue/message-processor.service';
import { UserRoles } from '../../../../packages/types/enums/UserRoles';
import { User } from 'src/schemas/user.schema';
import { TelegramConfig } from './telegram.config';
import { Channel } from 'src/schemas/channel.schema';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<Context>;
  private activeChannel: Channel = null;
  private users = new Map<string, { user: User }>();

  constructor(
    @Inject('TELEGRAF_BOT') bot: Telegraf<Context>,
    private readonly usersService: UsersService,
    private readonly filtersService: FiltersService,
    private readonly queueService: QueueService,
    private readonly channelsService: ChannelsService,
    private readonly messageProcessor: MessageProcessorService,
    private readonly telegramConfig: TelegramConfig,
  ) {
    this.bot = bot;
    this.setupHandlers();
    const users = this.usersService.findAll();
  }
  private setupHandlers() {
    //start command
    this.bot.start((ctx) => this.handleStart(ctx));

    //Channel command
    this.bot.command('channel', (ctx) => this.handleChannelCommand(ctx));

    // Help command
    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));

    // Verify admin command
    this.bot.command('verifyadmin', (ctx) => this.handleVerifyAdmin(ctx));

    // Stop command
    this.bot.command('stop', (ctx) => this.handleStopCommand(ctx));

    // Handle all messages
    this.bot.on('message', (ctx) => this.handleMessage(ctx));
  }
  private async handleStart(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    try {
      // Check if the user exists in database
      const user = await this.usersService.findByTelegramId(telegramId || '');
      if (!user) {
        await ctx.reply(
          '❌ You are not authorized to use this bot. Please contact admin to get access.',
        );
        return;
      }
      if (!user.isActive) {
        await ctx.reply(
          '❌ Your account is deactivated. Please contact admin.',
        );
        return;
      }
      await ctx.reply(
        `👋 Welcome ${user.username || 'User'}! (${user.role})\n\n` +
          `I'm your channel message bot. Here's what you can do:\n\n` +
          `1. To setup channel: Forward any message from your channel (Admin only)\n` +
          `2. Send me any message and I'll process and queue it for the channel\n` +
          `3. Use /channel to check current channel\n` +
          `4. Use /help for more info`,
      );
      await this.filtersService.loadFilters();
    } catch (error) {
      this.logger.error('Start command error:', error);
      await ctx.reply('❌ Error initializing bot. Please try again.');
    }
  }

  private async handleChannelCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId || '');
    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }
    const channel = await this.channelsService.getActiveChannel();
    if (!channel) {
      await ctx.reply(
        '❌ No channel configured. Please forward a message from your channel first.',
      );
      return;
    }
    await ctx.reply(
      `📢 Current Channel:\n` +
        `Name: ${channel.channelName}\n` +
        `ID: ${channel.channelId}\n` +
        `Bot Status: ${channel.botIsAdmin ? '✅ Admin' : '❌ Not Admin'}`,
    );
  }
  private async handleHelpCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId || '');
    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }
    await ctx.reply(
      `🤖 Bot Help:\n\n` +
        `/start - Initialize bot\n` +
        `/channel - Show current channel info\n` +
        `/help - Show this help message\n\n` +
        `**How to use:**\n` +
        `1. Send any text message to process and queue it\n` +
        `2. Messages are automatically processed and sent to channel\n\n` +
        `**Admin Commands:**\n` +
        `/verifyadmin - Verify bot admin status\n` +
        `/stop - Stop and reset bot`,
    );
  }
  private async handleVerifyAdmin(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId || '');

    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }

    if (user.role !== UserRoles.ADMIN) {
      await ctx.reply('❌ Only admin can verify admin status.');
      return;
    }

    const channel = await this.channelsService.getActiveChannel();

    if (!channel) {
      await ctx.reply('❌ No channel configured.');
      return;
    }
    try {
      // Check if bot is admin in channel
      const botId = this.telegramConfig.getToken();
      const chatMember = await ctx.telegram.getChatMember(
        channel.channelId,
        Number(botId),
      );
      const isAdmin = ['administrator', 'creator'].includes(chatMember.status);
      await this.channelsService.updateBotAdminStatus(
        channel.channelId,
        isAdmin,
      );
      if (isAdmin) {
        await ctx.reply(
          '✅ Bot admin status verified! You can now send messages to the channel.',
        );
      } else {
        await ctx.reply(
          '❌ Bot is not admin in the channel. Please add bot as admin with post permissions.',
        );
      }
    } catch (error) {
      this.logger.error('Admin verification error:', error);
      await ctx.reply(
        '❌ Error verifying admin status. Make sure bot is added to channel and has appropriate permissions.',
      );
    }
  }
  private async handleStopCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId || '');

    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }
    if (user.role !== UserRoles.ADMIN) {
      await ctx.reply('❌ Only admin can stop the bot.');
      return;
    }
    // Reset channel and clear data
    await this.channelsService.deactivateAll();
    this.filtersService.clearCache();
    await ctx.reply(
      '🛑 Bot has been stopped and reset. Send /start to begin again.',
    );
  }
  private async handleMessage(ctx: Context) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const telegramId = ctx.from?.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId || '');
    if (!user || !user.isActive) {
      await ctx.reply(
        '❌ You are not authorized to use this bot. Please contact admin to get access.',
      );
      return;
    }
    // Handle channel setup via forwarded message (Admin only)
    if (ctx.message.forward_origin?.type === 'channel') {
      await this.handleChannelSetup(ctx, user);
      return;
    }
    // Handle regular message processing
    await this.handleUserMessage(ctx, user, ctx.message.text);
  }
  private async handleChannelSetup(ctx: Context, user: User) {
    // Only admin can setup channel
    if (user.role !== UserRoles.ADMIN) {
      await ctx.reply('❌ Only admin can setup channel.');
      return;
    }
    const chat = ctx.message?.from;
    try {
      const channel = await this.channelsService.createOrUpdate({
        channeld: chat?.id.toString(),
        channelName: chat?.username,
        botIsAdmin: false,
      });
      await ctx.reply(
        `✅ Channel setup successful!\n\n` +
          `Channel: ${channel.channelName}\n` +
          `ID: ${channel.channelId}\n\n` +
          `Now make sure the bot is added as admin to this channel with post permissions, then send /verifyadmin to confirm.`,
      );
    } catch (error) {
      this.logger.error('Channel setup error:', error);
      await ctx.reply('❌ Error setting up channel. Please try again.');
    }
  }
  private async handleUserMessage(ctx: Context, user: User, text: string) {
    const channel = await this.channelsService.getActiveChannel();
    if (!channel) {
      await ctx.reply(
        '❌ No channel configured. Please contact admin to setup channel first.',
      );
      return;
    }
    if (!channel.botIsAdmin) {
      await ctx.reply(
        '❌ Bot is not admin in the channel. Please contact admin to verify bot admin status.',
      );
      return;
    }
    try {
      const processedMessage =
        await this.messageProcessor.proccessMessage(text);
      // Add to queue
      await this.queueService.addToQueue({
        originalMessage: text,
        processedMessage,
        userId: user._id.toString(),
      });
      await ctx.reply('✅ Message received and queued for sending to channel!');
    } catch (error) {
      this.logger.error('Message processing error:', error);
      await ctx.reply('❌ Error processing message. Please try again.');
    }
  }

  async launchBot() {
    try {
      await this.bot.launch();
      this.logger.log('Telegram bot started successfully');
    } catch (error) {
      this.logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }
  stopBot() {
    try {
      this.bot.stop();
      this.logger.log('Telegram bot stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Telegram bot:', error);
    }
  }
  async sendToChannel(message: string, channelId: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(channelId, message);
      return true;
    } catch (error) {
      this.logger.error('Error sending message to channel:', error);
      return false;
    }
  }
}
