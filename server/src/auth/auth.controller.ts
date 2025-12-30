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
import { UserRoles } from 'src/types/types';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiBody({ type: LoginDto })
  login(@Request() req: { user: User }) {
    return this.authService.login(req.user);
  }
  @ApiBearerAuth('access-token')
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
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Returns user profile' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMIN)
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
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMIN)
  @Post('logout')
  logout() {
    // JWT is stateless, client should remove token
    return { success: true, message: 'Logged out successfully' };
  }
}
