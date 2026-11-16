import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Channel } from '../schemas/channel.schema';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Injectable()
export class ChannelsService implements OnModuleInit {
  private readonly logger = new Logger(ChannelsService.name);
  private activeChannel: Channel | null = null;
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<Channel>,
  ) {}

  async onModuleInit() {
    await this.loadChannel();
  }

  async loadChannel() {
    const channel = await this.channelModel.findOne({ isActive: true }).exec();
    this.activeChannel = channel;
    this.logger.log(`Loaded ${this.activeChannel?.channelName} active Channel`);
  }

  getActiveChannel(): Channel | null {
    return this.activeChannel || null;
  }
  async findAll(): Promise<Channel[]> {
    return this.channelModel.find().sort({ createdAt: -1 }).exec();
  }
  async findById(id: string): Promise<Channel> {
    const channel = await this.channelModel.findById(id).exec();
    if (!channel) {
      throw new Error('Channel not found');
    }
    return channel;
  }
  async findByChannelId(id: string): Promise<Channel | null> {
    const channel = await this.channelModel.findOne({ channelId: id }).exec();
    return channel;
  }
  async createOrUpdate(createChannelDto: CreateChannelDto): Promise<Channel> {
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // 1. Deactivate any *other* active channel
        await this.channelModel.updateMany(
          { isActive: true, channelId: { $ne: createChannelDto.channelId } },
          { isActive: false },
        );

        // 2. Upsert this one as active
        const channel = await this.channelModel
          .findOneAndUpdate(
            { channelId: createChannelDto.channelId },
            { ...createChannelDto, isActive: true },
            { upsert: true, new: true },
          )
          .exec();

        await this.loadChannel();
        this.logger.log(`Channel ${channel.channelName} set as active`);
        return channel;
      } catch (err) {
        const code = (err as { code?: number }).code;
        // E11000 on the isActive partial unique index = another request won the race
        if (code === 11000 && attempt < MAX_ATTEMPTS) {
          this.logger.warn(
            `Activation race detected (attempt ${attempt}); retrying…`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new Error('Could not activate channel after retries');
  }
  async update(
    id: string,
    updateChannelDto: UpdateChannelDto,
  ): Promise<Channel> {
    const channel = await this.channelModel
      .findByIdAndUpdate(id, updateChannelDto, { new: true })
      .exec();

    if (!channel) {
      throw new Error('Channel not found');
    }
    await this.loadChannel();
    return channel;
  }
  async updateBotAdminStatus(
    channelId: string,
    botIsAdmin: boolean,
  ): Promise<Channel> {
    const channel = await this.channelModel
      .findOneAndUpdate({ channelId }, { botIsAdmin }, { new: true })
      .exec();

    if (!channel) {
      throw new Error('Channel not found');
    }

    this.logger.log(
      `Bot admin status updated for channel ${channel.channelName}: ${botIsAdmin}`,
    );
    await this.loadChannel();
    return channel;
  }
  async delete(id: string): Promise<void> {
    const result = await this.channelModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('Channel not found');
    }
    await this.loadChannel();
  }
  async deactivateAll(): Promise<void> {
    await this.channelModel.updateMany({}, { isActive: false });
    this.logger.log('All channels deactivated');
    await this.loadChannel();
  }
  async getChannelStats() {
    const total = await this.channelModel.countDocuments();
    const active = await this.channelModel.countDocuments({ isActive: true });
    const withAdmin = await this.channelModel.countDocuments({
      botIsAdmin: true,
    });

    return { total, active, withAdmin };
  }
}
