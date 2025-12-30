import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { QueueService } from './queue.service';
import { Roles } from 'src/auth/roles.decorator';
import { UserRoles } from 'src/types/types';

@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  @Roles(UserRoles.ADMIN)
  async getStats() {
    const stats = await this.queueService.getQueueStats();
    return { success: true, data: stats };
  }
  @Get('messages')
  @Roles(UserRoles.ADMIN)
  async getMessages(@Query('limit') limit: string) {
    const message = await this.queueService.getQueuedMessages(
      parseInt(limit) || 50,
    );
    return { success: true, data: message };
  }
  @Post('cleanup')
  @Roles(UserRoles.ADMIN)
  async cleanupOldMessages(@Body() body: { days?: number }) {
    const result = await this.queueService.cleanupOldMessages(body.days || 7);
    return {
      success: true,
      message: `Cleaned up ${result.deletedCount} old messages`,
    };
  }
}
