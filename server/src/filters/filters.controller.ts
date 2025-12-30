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

import { FiltersService } from './filters.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFilterDto, UpdateFilterDto } from './dto/filter.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { UserRoles } from 'src/types/types';
import { ApiBearerAuth } from '@nestjs/swagger';
@Controller('filters')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN)
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}
  @Get()
  async findAll() {
    const filters = await this.filtersService.findAll();
    return { success: true, data: filters };
  }

  @Get('active')
  getActiveFilters() {
    const filters = this.filtersService.getActiveFilters();
    return { success: true, data: filters };
  }
  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const filter = await this.filtersService.findById(id);
      return { success: true, data: filter };
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
  async create(@Body() createFilterDto: CreateFilterDto) {
    try {
      const filter = await this.filtersService.create(createFilterDto);
      return {
        success: true,
        message: 'Filter created successfully',
        data: filter,
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
    @Body() updateFilterDto: UpdateFilterDto,
  ) {
    try {
      const filter = await this.filtersService.update(id, updateFilterDto);
      return {
        success: true,
        message: 'Filter updated successfully',
        data: filter,
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
      await this.filtersService.delete(id);
      return { success: true, message: 'Filter deleted successfully' };
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
      const filter = await this.filtersService.activateFilter(id);
      return {
        success: true,
        message: 'Filter activated successfully',
        data: filter,
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
      const filter = await this.filtersService.deactivateFilter(id);
      return {
        success: true,
        message: 'Filter deactivated successfully',
        data: filter,
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
