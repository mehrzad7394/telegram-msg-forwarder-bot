import { Injectable, Logger } from '@nestjs/common';
import { FiltersService } from 'src/filters/filters.service';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private readonly urlRegex = /https?:\/\/[^\s]+/g;
  private readonly mentionRegex = /@[a-zA-Z0-9_]+/g;
  constructor(private readonly filtersService: FiltersService) {}

  async processMessage(text: string): Promise<string> {
    let processedText = text;
    //get active filters
    const filters=await this.filtersService.getActiveFilters()
    for (const filter of filters){
      processedText=await
    }
  }
}
