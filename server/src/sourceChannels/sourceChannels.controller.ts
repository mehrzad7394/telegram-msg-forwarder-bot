import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserRoles } from '@repo/shared';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { SourceChannelsService } from './sourceChannels.service';
import {
  CreateSourceChannelsDto,
  UpdateSourceChannelDto,
} from './dto/sourceChannels.dto';

@Controller('sourceChannels')
@ApiBearerAuth('access-token')
@Roles(UserRoles.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class SourceChannelsController {
  constructor(private readonly sourceChannelsService: SourceChannelsService) {}

  @Get()
  async findAll() {
    const channels = await this.sourceChannelsService.findAll();
    return { success: true, data: channels };
  }
  @Get('active')
  getActiveChannels() {
    const channel = this.sourceChannelsService.getActiveChannels();
    return { success: true, data: channel };
  }
  @Get('stats')
  async getStats() {
    const stats = await this.sourceChannelsService.getChannelStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const channel = await this.sourceChannelsService.findById(id);
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
  async create(@Body() createChannelDto: CreateSourceChannelsDto) {
    try {
      const channel = await this.sourceChannelsService.create(createChannelDto);
      return {
        success: true,
        message: 'Channel created successfully',
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
    @Body() updateChannelDto: UpdateSourceChannelDto,
  ) {
    try {
      const channel = await this.sourceChannelsService.update(
        id,
        updateChannelDto,
      );
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
      await this.sourceChannelsService.delete(id);
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

  @Put(':id/activate')
  async activate(@Param('id') id: string) {
    try {
      const channel = await this.sourceChannelsService.activateChannel(id);
      return {
        success: true,
        message: 'Channel activated successfully',
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
  @Put(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    try {
      const channel = await this.sourceChannelsService.deactivateChannel(id);
      return {
        success: true,
        message: 'Channel deactivated successfully',
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
}
