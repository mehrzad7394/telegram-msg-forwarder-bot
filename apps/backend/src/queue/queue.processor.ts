import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ChannelsService } from 'src/channels/channels.service';
import { QueuedMessage } from 'src/schemas/queued-message.schema';
import { TelegramService } from 'src/telegram/telegram.service';
@Processor('messageQueue')
@Injectable()
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);
  constructor(
    @InjectModel(QueuedMessage.name)
    private queuedMessageModel: Model<QueuedMessage>,
    private readonly telegramService: TelegramService,
    private readonly channelsService: ChannelsService,
  ) {}

  @Process('processMessage')
  async processMessageJob(
    job: Job<{ queuedMessageId: string; processedMessage: string }>,
  ) {
    const { queuedMessageId, processedMessage } = job.data;
    try {
      // Update status to processing
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'processing',
      });
      // Get active channel
      const channel = await this.channelsService.getActiveChannel();
      if (!channel) {
        throw new Error('No active channel configured');
      }
      if (!channel.botIsAdmin) {
        throw new Error('Bot is not admin in the channel');
      }
      // Send message to channel
      const success = await this.telegramService.sendToChannel(
        processedMessage,
        channel.channelId,
      );
      if (success) {
        // Update status to sent
        await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
          status: 'sent',
          sentAt: new Date(),
        });
        this.logger.log(`Message ${queuedMessageId} sent successfully`);
      } else {
        throw new Error('Failed to send message to channel');
      }
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Update status to failed
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'failed',
        error: errorMessage,
      });

      this.logger.error(`Failed to process message ${queuedMessageId}:`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }
  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }
  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}:`, error);
  }
}
