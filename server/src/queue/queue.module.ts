import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  QueuedMessage,
  QueuedMessageSchema,
} from 'src/schemas/queued-message.schema';
import { TelegramModule } from 'src/telegram/telegram.module';
import { QueueService } from './queue.service';
import { MessageProcessorService } from './message-processor.service';
import { QueueProcessor } from './queue.processor';
import { FiltersModule } from 'src/filters/filters.module';
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'messageQueue',
      // limiter: {
      //   max: 1,
      //   duration: 3000,
      // },
    }),
    MongooseModule.forFeature([
      { name: QueuedMessage.name, schema: QueuedMessageSchema },
    ]),
    forwardRef(() => TelegramModule),
    FiltersModule,
    // ChannelsModule,
  ],
  providers: [QueueService, MessageProcessorService, QueueProcessor],
  exports: [QueueService, MessageProcessorService],
})
export class QueueModule {}
