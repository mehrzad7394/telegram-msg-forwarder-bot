import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { UsersService } from '../users/users.service';
import { FiltersService } from '../filters/filters.service';
import { QueueService } from '../queue/queue.service';
import { ChannelsService } from '../channels/channels.service';
import { MessageProcessorService } from '../queue/message-processor.service';
@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly usersService: UsersService,
    private readonly filtersService: FiltersService,
    private readonly queueService: QueueService,
    private readonly channelsService: ChannelsService,
    private readonly messageProcessor: MessageProcessorService,
  ) {}
}
