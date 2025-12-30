import { Injectable, Logger } from '@nestjs/common';
import { FiltersService } from 'src/filters/filters.service';
import { Filter } from 'src/schemas/filters.schema';
import { SettingService } from 'src/setting/setting.service';
import { FilterActions } from 'src/types/types';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private readonly urlRegex = /https?:\/\/[^\s]+/g;
  private readonly mentionRegex = /@[a-zA-Z0-9_]+/g;
  constructor(
    private readonly filtersService: FiltersService,
    private readonly settingsService: SettingService,
  ) {}

  processMessage(text: string): string {
    let processedText = text;
    //get active filters
    const filters = this.filtersService.getActiveFilters();
    const settings = this.settingsService.getSettings();
    if (settings?.removeMention) {
      processedText = this.removeMention(processedText);
    }
    if (settings?.removeURL) {
      processedText = this.removeUrls(processedText);
    }
    for (const filter of filters) {
      processedText = this.applyFilter(processedText, filter);
    }
    return processedText;
  }

  private applyFilter(text: string, filter: Filter): string {
    try {
      switch (filter.action) {
        case FilterActions.REMOVE_WORD:
          return this.removeWord(text, filter);
        case FilterActions.REPLACE_WORD:
          return this.replaceWord(text, filter);

        case FilterActions.REMOVE_LINE:
          return this.removeLine(text, filter);

        case FilterActions.REPLACE_LINE:
          return this.replaceLine(text, filter);

        case FilterActions.REGEX_REPLACE:
          return this.regexReplace(text, filter);
        case FilterActions.PREPEND_TEXT:
          return this.prependText(text, filter);
        case FilterActions.APPEND_TEXT:
          return this.appendText(text, filter);
        default:
          return text;
      }
    } catch (error) {
      this.logger.error(`Error applying filter ${filter.name}:`, error);
      return text;
    }
  }
  private prependText(text: string, filter: Filter): string {
    const prefix = filter.replacement || filter.pattern || '';
    return prefix + (text.startsWith('\n') ? '' : '\n') + text;
  }

  // Add text to the end of the entire message
  private appendText(text: string, filter: Filter): string {
    const suffix = filter.replacement || filter.pattern || '';
    return text + (text.endsWith('\n') ? '' : '\n') + suffix;
  }
  private removeWord(text: string, filter: Filter): string {
    const pattern = filter.isRegex
      ? new RegExp(filter.pattern, 'gi')
      : new RegExp(this.escapeRegex(filter.pattern), 'gi');
    return text.replace(pattern, '');
  }
  private replaceWord(text: string, filter: Filter): string {
    const pattern = filter.isRegex
      ? new RegExp(filter.pattern, 'gi')
      : new RegExp(this.escapeRegex(filter.pattern), 'gi');
    return text.replace(pattern, filter.replacement || '');
  }
  private removeLine(text: string, filter: Filter): string {
    const lines = text.split('\n');
    const pattern = filter.isRegex
      ? new RegExp(filter.pattern, 'i')
      : new RegExp(this.escapeRegex(filter.pattern), 'i');
    return lines.filter((line) => !pattern.test(line)).join('\n');
  }
  private replaceLine(text: string, filter: Filter): string {
    const lines = text.split('\n');
    const pattern = filter.isRegex
      ? new RegExp(filter.pattern, 'i')
      : new RegExp(this.escapeRegex(filter.pattern), 'i');

    return lines
      .map((line) => (pattern.test(line) ? filter.replacement || '' : line))
      .join('\n');
  }
  private removeUrls(text: string): string {
    return text
      .split('\n')
      .filter((line) => !this.urlRegex.test(line))
      .join('\n');
  }
  private removeMention(text: string): string {
    return text
      .split('\n')
      .filter((line) => !this.mentionRegex.test(line))
      .join('\n');
  }
  private regexReplace(text: string, filter: Filter): string {
    try {
      const regex = new RegExp(filter.pattern, 'gi');
      return text.replace(regex, filter.replacement || '');
    } catch (error) {
      this.logger.error(`Invalid regex pattern: ${filter.pattern}`, error);
      return text;
    }
  }
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
