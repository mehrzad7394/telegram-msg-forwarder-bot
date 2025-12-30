import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Setting, SettingSchema } from 'src/schemas/setting.schema';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Setting.name, schema: SettingSchema }]),
  ],
  providers: [SettingService],
  controllers: [SettingController],
  exports: [SettingService],
})
export class SettingModule {}
