import { IsString } from 'class-validator';

export class CreateQueueDTO {
  @IsString()
  originalMessage!: string;
  @IsString()
  processedMessage!: string;
  @IsString()
  userId!: string;
}
