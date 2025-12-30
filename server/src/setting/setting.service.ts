import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from 'src/schemas/setting.schema';

@Injectable()
export class SettingService {
  private readonly logger = new Logger(SettingService.name);
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
  ) {}
  async get(): Promise<Setting | null> {
    return this.settingModel.findOne({ key: 'global' }).exec();
  }
  async upsert(data: Partial<Setting>): Promise<Setting> {
    return this.settingModel.findOneAndUpdate(
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
  }
}
