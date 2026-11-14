import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SourceChannel,
  SourceChannelSchema,
} from 'src/schemas/sourceChannel.schema';
import { SourceChannelsService } from './sourceChannels.service';
import { SourceChannelsController } from './sourceChannels.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceChannel.name, schema: SourceChannelSchema },
    ]),
  ],
  providers: [SourceChannelsService],
  controllers: [SourceChannelsController],
  exports: [SourceChannelsService],
})
export class SourceChannelsModule {}
