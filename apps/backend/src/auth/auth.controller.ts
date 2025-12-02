import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.gaurd';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { User } from 'src/schemas/user.schema';
import { UserRoles } from '@monorepo/types';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: { user: User }) {
    return this.authService.login(req.user);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMIN)
  @Post('setup-password')
  async setupPassword(
    @Request() req: { user: User },
    @Body() body: { password: string },
  ) {
    await this.authService.setAdminPassword(req.user.telegramId, body.password);
    return { success: true, message: 'Password setup successful' };
  }
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: { user: User }) {
    return {
      success: true,
      data: {
        id: req.user._id,
        telegramId: req.user.telegramId,
        username: req.user.username,
        role: req.user.role,
        isActive: req.user.isActive,
      },
    };
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    // JWT is stateless, client should remove token
    return { success: true, message: 'Logged out successfully' };
  }
}
