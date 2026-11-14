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
import { Job, Queue } from 'bull';
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
    private readonly queuedMessageModel: Model<QueuedMessage>,
    private readonly telegramService: TelegramService,
    @InjectQueue('messageQueue') private readonly queue: Queue,
  ) {}

  @Process('processMessage')
  async processMessageJob(
    job: Job<{ queuedMessageId: string; processedMessage: string }>,
  ): Promise<void> {
    const { queuedMessageId, processedMessage } = job.data;
    if (await this.waitIfTelegramLimited(job)) return;

    try {
      await this.telegramService.sendToChannel(processedMessage);
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'sent',
        sentAt: new Date(),
      });
      this.logger.log(`Message ${queuedMessageId} sent successfully`);
    } catch (error: any) {
      if (error?.response?.error_code === 429) {
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
        await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
          status: 'queued',
          error: `Telegram rate limited; retry after ${retryAfterSec}s`,
        });
        throw error;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'failed',
        error: errorMessage,
      });
      this.logger.error(`Failed to process message ${queuedMessageId}:`, error);
      throw error;
    }
  }

  private async waitIfTelegramLimited(job: Job): Promise<boolean> {
    const redis = await this.queue.client;
    const until = await redis.get(this.TELEGRAM_COOLDOWN_KEY);
    if (!until) return false;

    const waitMs = Number(until) - Date.now();
    if (waitMs <= 0) return false;

    this.logger.warn(
      `Telegram cooldown active. Delaying job ${job.id} for ${waitMs}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return false;
  }

  @OnQueueActive()
  onActive(job: Job): void {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
    this.queuedMessageModel.findByIdAndDelete(job.id);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Failed job ${job.id} of type ${job.name}:`, error);
  }
}
