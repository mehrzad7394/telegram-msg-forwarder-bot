import { Inject, Injectable, Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { UsersService } from '../users/users.service';
import { FiltersService } from '../filters/filters.service';
import { QueueService } from '../queue/queue.service';
import { ChannelsService } from '../channels/channels.service';
import { MessageProcessorService } from '../queue/message-processor.service';
import { User } from 'src/schemas/user.schema';
import { Channel } from 'src/schemas/channel.schema';
import { UserRoles } from 'src/types/types';
import { SettingService } from 'src/setting/setting.service';

interface TelegramChannel {
  id: number;
  title?: string;
  type: 'channel';
}

interface ForwardOrigin {
  type: 'channel' | 'chat' | 'user';
  chat: TelegramChannel;
  message_id: number;
  date: number;
}

interface TelegramMessageWithForward {
  forward_origin?: ForwardOrigin;
  forward_from_chat?: TelegramChannel;
  forward_from_message_id?: number;
  forward_date?: number;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<Context>;
  private usersCache = new Map<string, User>(); // Map<telegramId, User>
  private activeChannel: Channel | null = null;
  private isInitialized = false;

  private usersWaitingForChannel = new Set<string>();
  constructor(
    @Inject('TELEGRAF_BOT') bot: Telegraf<Context>,
    private readonly usersService: UsersService,
    private readonly filtersService: FiltersService,
    private readonly queueService: QueueService,
    private readonly channelsService: ChannelsService,
    private readonly messageProcessor: MessageProcessorService,
    private readonly settingService: SettingService,
  ) {
    this.bot = bot;
  }

  async initializeBot(): Promise<void> {
    try {
      this.logger.log('Initializing bot data...');

      await this.loadUsersFromDatabase();

      await this.loadActiveChannel();

      await this.filtersService.loadFilters();
      await this.settingService.loadSettings();
      this.isInitialized = true;
      this.logger.log(`Bot initialized with ${this.usersCache.size} users`);

      this.setupHandlers();
    } catch (error) {
      this.logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }
  private async loadUsersFromDatabase(): Promise<void> {
    try {
      const users = await this.usersService.findAll();
      this.usersCache.clear();
      for (const user of users) {
        if (user.telegramId && user.isActive) {
          this.usersCache.set(user.telegramId, user);
        }
      }
      this.logger.log(`Loaded ${this.usersCache.size} active users to cache`);
    } catch (error) {
      this.logger.error('Error loading users:', error);
      throw error;
    }
  }
  private async loadActiveChannel(): Promise<void> {
    try {
      const activeChannel = await this.channelsService.getActiveChannel();
      if (activeChannel && activeChannel.botIsAdmin) {
        this.activeChannel = activeChannel;
        this.logger.log(`Active channel loaded: ${activeChannel.channelName}`);
      } else {
        this.logger.warn('No active channel found');
      }
    } catch (error) {
      this.logger.error('Error loading active channel:', error);
      throw error;
    }
  }
  async refreshCache(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeBot();
      return;
    }
    this.logger.log('Refreshing cache...');
    try {
      await Promise.all([
        this.loadUsersFromDatabase(),
        this.loadActiveChannel(),
        this.filtersService.loadFilters(),
        this.settingService.loadSettings(),
      ]);
      this.logger.log('Cache refreshed successfully');
    } catch (error) {
      this.logger.error('Error refreshing cache:', error);
    }
  }
  private getUserFromCache(telegramId: string): User | null {
    if (!this.isInitialized) {
      this.logger.warn('Bot not initialized yet!');
      return null;
    }

    return this.usersCache.get(telegramId) || null;
  }
  private getActiveChannelFromCache(): Channel | null {
    if (!this.isInitialized) {
      this.logger.warn('Bot not initialized yet!');
      return null;
    }

    return this.activeChannel;
  }
  private setupHandlers() {
    //start command
    this.bot.start((ctx) => this.handleStart(ctx));

    //Channel command
    this.bot.command('channel', (ctx) => this.handleChannelCommand(ctx));
    this.bot.command('newchannel', (ctx) => this.handleAddChannel(ctx));

    // Help command
    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));

    //refresh cache
    this.bot.command('refresh', (ctx) => this.handleRefreshCommand(ctx));
    // Stop command
    this.bot.command('stop', (ctx) => this.handleStopCommand(ctx));

    // Handle all messages
    this.bot.on('message', (ctx) => this.handleMessage(ctx));
  }
  private async handleStart(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    try {
      //read user from cache
      const user = this.getUserFromCache(telegramId);
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
          `1. To setup channel:Use /newchannel to Forward any message from your channel (Admin only)\n` +
          `2. Send me any message and I'll process and queue it for the channel\n` +
          `3. Use /channel to check current channel\n` +
          `4. Use /help for more info`,
      );
    } catch (error) {
      this.logger.error('Start command error:', error);
      await ctx.reply('❌ Error initializing bot. Please try again.');
    }
  }
  private async handleAddChannel(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    const user = this.getUserFromCache(telegramId);
    if (!user || user.role !== UserRoles.ADMIN || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }

    this.usersWaitingForChannel.add(telegramId);

    await ctx.reply(
      '📤 **Add New Channel**\n\n' +
        'Please forward any message from the channel you want to add.\n\n' +
        'The bot will:\n' +
        '1. Get the channel ID from the forwarded message\n' +
        '2. Add it to the database\n' +
        '⚠️ *Note:* Make sure the bot is already added as admin to that channel.\n\n' +
        'To cancel, simply send any other message.',
    );
  }
  private async handleChannelCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    const user = this.getUserFromCache(telegramId);
    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized to use this bot.');
      return;
    }
    const channel = this.getActiveChannelFromCache();
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
        `/stop - Stop and reset bot`,
    );
  }
  private async handleRefreshCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = this.getUserFromCache(telegramId);
    if (!user || user.role !== UserRoles.ADMIN) {
      await ctx.reply('❌ Only admin can refresh cache.');
      return;
    }

    await ctx.reply('🔄 Refreshing cache from database...');

    try {
      await this.refreshCache();
      await ctx.reply('✅ Cache refreshed successfully!');
    } catch (error) {
      this.logger.error('Error refreshing cache.', error);
      await ctx.reply('❌ Error refreshing cache.');
    }
  }
  private async handleVerifyAdmin(ctx: Context, channelId: string) {
    try {
      const chatMember = await ctx.telegram.getChatMember(
        channelId,
        ctx.botInfo.id,
      );

      const isAdmin = ['administrator', 'creator'].includes(chatMember.status);

      return isAdmin;
    } catch (error) {
      this.logger.error('Admin verification error:', error);
      await ctx.reply('❌ Error verifying admin status.');
    }
  }
  private async handleStopCommand(ctx: Context) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = this.getUserFromCache(telegramId);
    if (!user || !user.isActive || user.role !== UserRoles.ADMIN) {
      await ctx.reply('❌ Only admin can stop the bot.');
      return;
    }

    // Reset channel and clear data
    await this.channelsService.deactivateAll();
    this.filtersService.clearCache();
    this.settingService.clearCache();

    //CLEAR CACHE
    this.usersWaitingForChannel.clear();
    this.usersCache.clear();
    this.activeChannel = null;
    this.isInitialized = false;

    await ctx.reply(
      '🛑 Bot has been stopped and reset. Send /start to begin again.',
    );
  }
  private async handleMessage(ctx: Context) {
    if (!ctx.message) return;
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    const user = this.getUserFromCache(telegramId);
    if (!user || !user.isActive) {
      await ctx.reply('❌ You are not authorized.');
      return;
    }
    // Check if user is waiting to add a channel
    if (this.usersWaitingForChannel.has(telegramId)) {
      await this.handleForwardedChannelMessage(ctx, user);
      return;
    }
    // Handle regular message processing
    if ('text' in ctx.message) {
      await this.handleUserMessage(ctx, user, ctx.message.text);
    }
  }

  private async handleForwardedChannelMessage(ctx: Context, user: User) {
    // // Remove user from waiting list
    this.usersWaitingForChannel.delete(user.telegramId);
    // // Check if message is forwarded from a channel
    if (!ctx.message) return;
    const message = ctx.message as TelegramMessageWithForward;
    if (!message.forward_origin || message.forward_origin.type !== 'channel') {
      await ctx.reply('❌ This message is not forwarded from channel.');
      return;
    }
    const channelId = message.forward_origin.chat.id.toString();
    const channelName = message.forward_origin.chat.title || 'Unknown Channel';

    try {
      // Check if channel already exists in database
      const existingChannel =
        await this.channelsService.findByChannelId(channelId);
      if (existingChannel) {
        await ctx.reply(
          `ℹ️ Channel already exists in database:\n\n` +
            `**Name:** ${existingChannel.channelName}\n` +
            `**ID:** ${existingChannel.channelId}\n` +
            `**Status:** ${existingChannel.isActive ? '✅ Active' : '❌ Inactive'}`,
        );
        return;
      }
      const botIsAdmin = await this.handleVerifyAdmin(ctx, channelId);
      if (!botIsAdmin) {
        await ctx.reply('Bot is not admin of the channel.');
        return;
      }

      const newChannel = await this.channelsService.createOrUpdate({
        channelId: channelId,
        channelName: channelName,
        botIsAdmin: true,
      });
      await ctx.reply(
        `✅ **Channel added successfully!**\n\n` +
          `**Channel:** ${newChannel.channelName}\n` +
          `**ID:** ${newChannel.channelId}\n\n` +
          `You can now send Messages to bot and it will be forwarded to your channel!` +
          `Use /channels to see all available channels.`,
      );
      // Refresh cache to include the new channel
      await this.refreshCache();
    } catch (error) {
      this.logger.error('Error adding channel:', error);
      await ctx.reply('❌ Error adding channel to database. Please try again.');
    }
  }
  private async handleUserMessage(ctx: Context, user: User, text: string) {
    const channel = this.getActiveChannelFromCache();
    if (!channel) {
      await ctx.reply('❌ No channel configured.');
      return;
    }
    if (!channel.botIsAdmin) {
      await ctx.reply('❌ Bot is not admin in the channel.');
      return;
    }
    try {
      const processedMessage = this.messageProcessor.processMessage(text);
      await this.queueService.addToQueue({
        originalMessage: text,
        processedMessage,
        userId: user._id.toString(),
      });
    } catch (error) {
      this.logger.error('Message processing error:', error);
      await ctx.reply('❌ Error processing message.');
    }
  }

  launchBot() {
    try {
      this.logger.log('Starting bot ...');
      this.bot
        .launch({ dropPendingUpdates: true })
        .then(() => {
          this.logger.log('✅ Telegram bot started successfully');
        })
        .catch((error) => {
          this.logger.error('❌ Telegram bot startup error:', error);
        });
      this.logger.log('Telegram bot started successfully');
    } catch (error) {
      this.logger.error('Failed to start Telegram bot:', error);
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
  async sendToChannel(message: string): Promise<boolean> {
    try {
      const channel = this.getActiveChannelFromCache();
      if (!channel) throw new Error('No Active Channel');
      await this.bot.telegram.sendMessage(channel.channelId, message);
      return true;
    } catch (error) {
      this.logger.error('Error sending message to channel:', error);
      throw error;
    }
  }
}
