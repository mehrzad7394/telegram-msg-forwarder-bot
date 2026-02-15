import {
  InjectQueue,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue } from 'bullmq';
import { Model } from 'mongoose';
import { QueuedMessage } from 'src/schemas/queued-message.schema';
import { TelegramService } from 'src/telegram/telegram.service';

@Processor('messageQueue')
@Injectable()
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);
  private readonly TELEGRAM_COOLDOWN_KEY = 'telegram:cooldown:until';
  constructor(
    @InjectModel(QueuedMessage.name)
    private queuedMessageModel: Model<QueuedMessage>,
    private readonly telegramService: TelegramService,
    @InjectQueue('messageQueue') private readonly queue: Queue,
  ) {}

  @Process('processMessage')
  async processMessageJob(
    job: Job<{ queuedMessageId: string; processedMessage: string }>,
  ) {
    const { queuedMessageId, processedMessage } = job.data;
    // 1️⃣ Respect global Telegram cooldown
    const delayed = await this.waitIfTelegramLimited(job);
    if (delayed) return;
    try {
      // // Update status to processing
      // await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
      //   status: 'processing',
      // });

      await this.telegramService.sendToChannel(processedMessage);

      // Update status to sent
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'sent',
        sentAt: new Date(),
      });
      this.logger.log(`Message ${queuedMessageId} sent successfully`);
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.response?.error_code === 429) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const retryAfterSec = error.response.parameters?.retry_after ?? 30;

        const until = Date.now() + retryAfterSec * 1000;
        const redis = await this.queue.client;
        await redis.set(
          this.TELEGRAM_COOLDOWN_KEY,
          until.toString(),
          'PX',
          retryAfterSec * 1000,
        );
        this.logger.warn(
          `Telegram rate limit hit. Cooling down for ${retryAfterSec}s`,
        );

        // Delay THIS job
        await job.moveToDelayed(until);
        return;
      }
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

  private async waitIfTelegramLimited(job: Job) {
    const redis = await this.queue.client;
    const until = await redis.get(this.TELEGRAM_COOLDOWN_KEY);

    if (until) {
      const waitMs = Number(until) - Date.now();
      if (waitMs > 0) {
        this.logger.warn(
          `Telegram cooldown active. Delaying job ${job.id} for ${waitMs}ms`,
        );

        await job.moveToDelayed(Date.now() + waitMs);
        return true;
      }
    }
    return false;
  }
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
