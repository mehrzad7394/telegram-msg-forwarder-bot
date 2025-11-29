import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelsModule } from 'src/channels/channels.module';
import {
  QueuedMessage,
  QueuedMessageSchema,
} from 'src/schemas/queued-message.schema';
import { TelegramModule } from 'src/telegram/telegram.module';
import { QueueService } from './queue.service';
import { MessageProcessorService } from './message-processor.service';
import { QueueProcessor } from './queue.processor';
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'messageQueue',
    }),
    MongooseModule.forFeature([
      { name: QueuedMessage.name, schema: QueuedMessageSchema },
    ]),
    TelegramModule,
    ChannelsModule,
  ],
  providers: [QueueService, MessageProcessorService, QueueProcessor],
  exports: [QueueService, MessageProcessorService],
})
export class QueueModule {}
