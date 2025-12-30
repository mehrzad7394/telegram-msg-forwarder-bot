import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!); // Upstash or local
export const messageQueue = new Queue('message-queue', { connection });
export default messageQueue;
