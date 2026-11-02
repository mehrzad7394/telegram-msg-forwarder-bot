export interface Channel {
  channelId: string;
  channelName: string;
  botIsAdmin: boolean;
  isActive: boolean;
}

export interface QueuedMessage {
  originalMessage: string;
  processedMessage: string;
  userId: string;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}