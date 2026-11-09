import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Channel } from '../schemas/channel.schema';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<Channel>,
  ) {}
  async getActiveChannel(): Promise<Channel | null> {
    return this.channelModel.findOne({ isActive: true }).exec();
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
    await this.channelModel.updateMany({}, { isActive: false });
    // Create or update the channel
    const channel = await this.channelModel
      .findOneAndUpdate(
        { channelId: createChannelDto.channelId },
        {
          ...createChannelDto,
          isActive: true,
        },
        {
          upsert: true,
          new: true,
        },
      )
      .exec();

    this.logger.log(`Channel ${channel.channelName} set as active`);
    return channel;
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
    return channel;
  }
  async delete(id: string): Promise<void> {
    const result = await this.channelModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('Channel not found');
    }
  }
  async deactivateAll(): Promise<void> {
    await this.channelModel.updateMany({}, { isActive: false });
    this.logger.log('All channels deactivated');
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
