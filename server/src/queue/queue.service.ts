import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { QueuedMessage } from 'src/schemas/queued-message.schema';
import { CreateQueueDTO } from './dto/queue.dto';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('messageQueue') private readonly messageQueue: Queue,
    @InjectModel(QueuedMessage.name)
    private queuedMessageModel: Model<QueuedMessage>,
  ) {}
  async addToQueue(createQueueDTO: CreateQueueDTO) {
    try {
      //save to database first
      const queuedMessage = new this.queuedMessageModel({
        ...createQueueDTO,
        status: 'queued',
      });
      await queuedMessage.save();

      // Add to Redis queue
      await this.messageQueue.add(
        'processMessage',
        {
          queuedMessageId: queuedMessage._id.toString(),
          processedMessage: queuedMessage.processedMessage,
        },
        {
          delay: 2000, // 2 second delay between messages
          attempts: 3, // Retry 3 times on failure
          backoff: 5000, // 5 second backoff between retries
        },
      );
      this.logger.log(
        `Message queued with ID: ${queuedMessage._id.toString()}`,
      );
      return queuedMessage;
    } catch (error) {
      this.logger.error('Error adding message to queue:', error);
      throw error;
    }
  }
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.messageQueue.getWaiting(),
      this.messageQueue.getActive(),
      this.messageQueue.getCompleted(),
      this.messageQueue.getFailed(),
      this.messageQueue.getDelayed(),
    ]);
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }
  async getQueuedMessages(limit: number = 50) {
    return this.queuedMessageModel
      .find()
      .populate('userId', 'telegramId username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
  async cleanupOldMessages(
    days: number = 7,
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.queuedMessageModel.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['sent', 'failed'] },
    });

    this.logger.log(`Cleaned up ${result.deletedCount} old messages`);
    return { deletedCount: result.deletedCount || 0 };
  }
}
