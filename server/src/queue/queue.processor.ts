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
      // Update status to processing
      await this.queuedMessageModel.findByIdAndUpdate(queuedMessageId, {
        status: 'processing',
      });

      await this.telegramService.sendToChannel(processedMessage);

      // Update status to sent
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

  // private async retryWithBackoff<T>(
  //   operation: () => Promise<T>,
  //   maxRetries: number,
  // ): Promise<T> {
  //   let lastError: Error = new Error('No retry attempts made');

  //   for (let attempt = 1; attempt <= maxRetries; attempt++) {
  //     try {
  //       return await operation();
  //     } catch (error) {
  //       lastError = error as Error;
  //       this.logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);

  //       // Check if it's a rate limit error
  //       const waitTime = this.extractRateLimitWaitTime(error);
  //       if (waitTime > 0) {
  //         this.logger.warn(
  //           `Rate limited. Waiting ${waitTime} seconds before retry (attempt ${attempt}/${maxRetries})`,
  //         );
  //         await this.delay(waitTime * 1000);
  //         continue; // Try again after waiting
  //       }

  //       // For other errors, use exponential backoff
  //       if (attempt < maxRetries) {
  //         const backoffTime = Math.pow(2, attempt) * 1000; // Exponential backoff
  //         this.logger.warn(
  //           `Retrying in ${backoffTime / 1000} seconds (attempt ${attempt}/${maxRetries})`,
  //         );
  //         await this.delay(backoffTime);
  //       }
  //       // If this was the last attempt, break and throw the error
  //       if (attempt === maxRetries) {
  //         break;
  //       }
  //     }
  //   }

  //   throw lastError;
  // }

  // private extractRateLimitWaitTime(error: any): number {
  //   // Type guard to check if error has response property
  //   const hasResponse = (err: any): err is TelegramError => {
  //     return err && typeof err.response === 'object';
  //   };

  //   // Check for Telegram rate limit error (429 Too Many Requests)
  //   if (hasResponse(error) && error.response?.error_code === 429) {
  //     // Extract retry_after from error response
  //     const retryAfter = error.response?.parameters?.retry_after;
  //     if (retryAfter && typeof retryAfter === 'number') {
  //       return retryAfter;
  //     }
  //   }

  //   // Also check for direct properties (some Telegram libraries might attach them directly)
  //   if (error?.code === 429 || error?.error_code === 429) {
  //     const retryAfter = error?.parameters?.retry_after || error?.retry_after;
  //     if (retryAfter && typeof retryAfter === 'number') {
  //       return retryAfter;
  //     }
  //   }

  //   // Check for error message containing rate limit info
  //   if (
  //     error?.message?.includes('Too Many Requests') ||
  //     error?.description?.includes('Too Many Requests')
  //   ) {
  //     // Try to extract wait time from error message
  //     const match =
  //       error.message?.match(/retry after (\d+)/i) ||
  //       error.description?.match(/retry after (\d+)/i);
  //     if (match && match[1]) {
  //       return parseInt(match[1], 10);
  //     }
  //     return 5; // Default wait time for rate limit errors
  //   }

  //   return 0; // Not a rate limit error
  // }

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
