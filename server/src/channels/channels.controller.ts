import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRoles } from 'src/types/types';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('channels')
@ApiBearerAuth('access-token')
@Roles(UserRoles.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async findAll() {
    const channels = await this.channelsService.findAll();
    return { success: true, data: channels };
  }

  @Get('active')
  async getActiveChannel() {
    const channel = await this.channelsService.getActiveChannel();
    return { success: true, data: channel };
  }

  @Get('stats')
  async getStats() {
    const stats = await this.channelsService.getChannelStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const channel = await this.channelsService.findById(id);
      return { success: true, data: channel };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
    }
  }

  @Post()
  async create(@Body() createChannelDto: CreateChannelDto) {
    try {
      const channel =
        await this.channelsService.createOrUpdate(createChannelDto);
      return {
        success: true,
        message: 'Channel created/updated successfully',
        data: channel,
      };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    try {
      const channel = await this.channelsService.update(id, updateChannelDto);
      return {
        success: true,
        message: 'Channel updated successfully',
        data: channel,
      };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.channelsService.delete(id);
      return { success: true, message: 'Channel deleted successfully' };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id/set-active')
  async setActive(@Param('id') id: string) {
    try {
      const channel = await this.channelsService.findById(id);
      await this.channelsService.createOrUpdate({
        channelId: channel.channelId,
        channelName: channel.channelName,
        botIsAdmin: channel.botIsAdmin,
      });
      return { success: true, message: 'Channel set as active' };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
