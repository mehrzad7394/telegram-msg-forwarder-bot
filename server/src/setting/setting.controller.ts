import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRoles } from 'src/types/types';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/setting.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('setting')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN)
export class SettingController {
  constructor(private readonly settingService: SettingService) {}
  @Get()
  async getSettings() {
    const settins = await this.settingService.get();
    return { success: true, data: settins };
  }
  @Put()
  async updateSettings(@Body() dto: UpdateSettingDto) {
    return this.settingService.upsert(dto);
  }
}
