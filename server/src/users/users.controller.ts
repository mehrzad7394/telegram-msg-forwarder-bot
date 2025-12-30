import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';

import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRoles } from 'src/types/types';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoles.ADMIN)
export class UserController {
  constructor(private readonly usersService: UsersService) {}
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return { success: true, data: users };
  }
  @Get('stats')
  async getStats() {
    const stats = await this.usersService.getUsersCount();
    return { success: true, data: stats };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, data: user };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      success: true,
      message: 'User updated successfully',
      data: user,
    };
  }
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { success: true, message: 'User deleted successfully' };
  }
  @Put(':id/activate')
  async activate(@Param('id') id: string) {
    const user = await this.usersService.activateUser(id);
    return {
      success: true,
      message: 'User activated successfully',
      data: user,
    };
  }
  @Put(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const user = await this.usersService.deactivateUser(id);
    return {
      success: true,
      message: 'User deactivated successfully',
      data: user,
    };
  }
  @Put(':id/promote')
  async promoteToAdmin(@Param('id') id: string) {
    const user = await this.usersService.promoteToAdmin(id);
    return {
      success: true,
      message: 'User promoted to admin successfully',
      data: user,
    };
  }
  @Put(':id/demote')
  async demoteToUser(@Param('id') id: string) {
    const user = await this.usersService.demoteToUser(id);
    return {
      success: true,
      message: 'User demoted to user role successfully',
      data: user,
    };
  }
}
