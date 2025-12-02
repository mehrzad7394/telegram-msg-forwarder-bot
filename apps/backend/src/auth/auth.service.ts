import { UserRoles } from '@monorepo/types';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { compare, hash } from 'bcryptjs';
import { JWTPayload, UserProfile } from 'src/types/auth.type';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
  async validateUser(
    telegramId: string,
    password: string,
  ): Promise<Omit<UserProfile, 'passwordHash'> | null> {
    const user = await this.userModel
      .findOne({
        telegramId,
        role: UserRoles.ADMIN,
      })
      .exec();

    if (user?.passwordHash) {
      try {
        const isPasswordValid = await (
          compare as unknown as (
            data: string,
            encrypted: string,
          ) => Promise<boolean>
        )(password, user.passwordHash);
        if (isPasswordValid) {
          const userObj = user.toObject();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { passwordHash: _, ...result } = userObj;
          return {
            ...result,
            _id: result._id.toString(),
          } as Omit<UserProfile, 'passwordHash'>;
        }
      } catch {
        // If compare fails, password is invalid
        return null;
      }
    }
    return null;
  }
  async setAdminPassword(telegramId: string, password: string): Promise<void> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user || user.role !== UserRoles.ADMIN) {
      throw new UnauthorizedException('Only admin users can set password');
    }
    const saltRounds = 10;
    let passwordHash: string;
    try {
      passwordHash = await (
        hash as unknown as (
          data: string,
          saltOrRounds: number,
        ) => Promise<string>
      )(password, saltRounds);
    } catch {
      throw new UnauthorizedException('Failed to hash password');
    }
    await this.userModel.findByIdAndUpdate(user._id, {
      passwordHash,
    });
  }
  login(user: User) {
    const payload = {
      telegramId: user.telegramId,
      sub: user._id,
      role: user.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        role: user.role,
      },
    };
  }
  async validateJwtPayload(payload: JWTPayload) {
    const user = await this.usersService.findByTelegramId(payload.telegramId);
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  }
}
