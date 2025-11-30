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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FiltersService } from './filters.service';
import { Roles } from '../auth/roles.decorator';
import { UserRoles } from '@monorepo/types';
import { CreateFilterDto, UpdateFilterDto } from './dto/filter.dto';
@Controller('filters')
@UseGuards(JwtAuthGaurd, RolesGaurd)
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}
  @Get()
  @Roles(UserRoles.ADMIN)
  async findAll() {
    const filters = await this.filtersService.findAll();
    return { success: true, data: filters };
  }

  @Get('active')
  @Roles(UserRoles.ADMIN)
  getActiveFilters() {
    const filters = this.filtersService.getActiveFilters();
    return { success: true, data: filters };
  }
  @Get(':id')
  @Roles(UserRoles.ADMIN)
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
  @Roles(UserRoles.ADMIN)
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
  @Roles(UserRoles.ADMIN)
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
  @Roles(UserRoles.ADMIN)
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
  @Roles(UserRoles.ADMIN)
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
  @Roles(UserRoles.ADMIN)
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
