import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from 'src/schemas/setting.schema';

@Injectable()
export class SettingService {
  private readonly logger = new Logger(SettingService.name);
  private settings: Setting | null = null;
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
  ) {}
  async onModuleInit() {
    await this.loadSettings();
  }
  async loadSettings() {
    this.settings = await this.settingModel.findOne({ key: 'global' }).exec();
    this.logger.log(`Loaded  settings`);
  }
  clearCache() {
    this.settings = null;
  }
  async get(): Promise<Setting | null> {
    return this.settingModel.findOne({ key: 'global' }).exec();
  }
  async upsert(data: Partial<Setting>): Promise<Setting> {
    const savedData = this.settingModel.findOneAndUpdate(
      {
        key: 'global',
      },
      { $set: data },
      {
        new: true,
        upsert: true, // creates if not exists
        setDefaultsOnInsert: true,
      },
    );
    await this.loadSettings();
    return savedData;
  }
  getSettings(): Setting | null {
    return this.settings;
  }
}
