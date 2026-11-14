import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SourceChannel } from 'src/schemas/sourceChannel.schema';
import {
  CreateSourceChannelsDto,
  UpdateSourceChannelDto,
} from './dto/sourceChannels.dto';

@Injectable()
export class SourceChannelsService {
  private readonly logger = new Logger(SourceChannelsService.name);
  private activeChannels: string[] = [];
  constructor(
    @InjectModel(SourceChannel.name)
    private sourceChannelModel: Model<SourceChannel>,
  ) {}
  async onModuleInit() {
    await this.loadChannels();
  }
  async loadChannels() {
    const channels = await this.sourceChannelModel
      .find({ isActive: true })
      .exec();
    this.activeChannels = channels.map((c) => c.channelId);
    this.logger.log(
      `Loaded ${this.activeChannels.length} active SourceChannels`,
    );
  }
  clearCache() {
    this.activeChannels = [];
  }
  getActiveChannels(): string[] {
    return this.activeChannels;
  }
  async findAll(): Promise<SourceChannel[]> {
    return this.sourceChannelModel.find().sort({ createdAt: -1 }).exec();
  }
  async findById(id: string): Promise<SourceChannel> {
    const channel = await this.sourceChannelModel.findById(id).exec();
    if (!channel) {
      throw new Error('Channel not found');
    }
    return channel;
  }
  async findByChannelId(id: string): Promise<SourceChannel | null> {
    const channel = await this.sourceChannelModel
      .findOne({ channelId: id })
      .exec();
    return channel;
  }
  async create(
    createChannelDto: CreateSourceChannelsDto,
  ): Promise<SourceChannel> {
    const channel = new this.sourceChannelModel(createChannelDto);
    const savedChannel = await channel.save();

    this.logger.log(`Channel ${savedChannel.channelName} created!`);
    return savedChannel;
  }
  async update(
    id: string,
    updateChannelDto: UpdateSourceChannelDto,
  ): Promise<SourceChannel> {
    const channel = await this.sourceChannelModel
      .findByIdAndUpdate(id, updateChannelDto, { new: true })
      .exec();

    if (!channel) {
      throw new Error('Channel not found');
    }

    await this.loadChannels();
    return channel;
  }
  async delete(id: string): Promise<void> {
    const result = await this.sourceChannelModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('Channel not found');
    }
    await this.loadChannels();
  }
  async activateChannel(id: string): Promise<SourceChannel> {
    return this.update(id, { isActive: true });
  }
  async deactivateChannel(id: string): Promise<SourceChannel> {
    return this.update(id, { isActive: false });
  }
  async deactivateAll(): Promise<void> {
    await this.sourceChannelModel.updateMany({}, { isActive: false });
    this.logger.log('All channels deactivated');
    await this.loadChannels();
  }
  async getChannelStats() {
    const total = await this.sourceChannelModel.countDocuments();
    const active = await this.sourceChannelModel.countDocuments({
      isActive: true,
    });

    return { total, active };
  }
}
