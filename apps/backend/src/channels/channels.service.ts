import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Channel } from 'src/schemas/channel.schema';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<Channel>,
  ) {}
  async getActiveChannel(): Promise<Channel | null> {
    return this.channelModel.findOne({ isActive: true }).exec();
  }
  async deactivateAll() {
    return this.channelModel.updateMany({isActive:true},).exec();
  }
}
