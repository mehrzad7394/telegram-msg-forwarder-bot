import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserRoles } from 'src/types/types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async findAll(): Promise<User[]> {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByTelegramId(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }
  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByTelegramId(createUserDto.telegramId);
    if (existingUser) {
      throw new ConflictException('User with this Telegram ID already exists');
    }
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, {
        new: true,
      })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }
  async activateUser(id: string): Promise<User> {
    return this.update(id, { isActive: true });
  }
  async deactivateUser(id: string): Promise<User> {
    return this.update(id, { isActive: false });
  }
  async promoteToAdmin(id: string): Promise<User> {
    return this.update(id, { role: UserRoles.ADMIN });
  }
  async demoteToUser(id: string): Promise<User> {
    return this.update(id, { role: UserRoles.USER });
  }
  async getUsersCount(): Promise<{
    total: number;
    active: number;
    admins: number;
  }> {
    const total = await this.userModel.countDocuments();
    const active = await this.userModel.countDocuments({ isActive: true });
    const admins = await this.userModel.countDocuments({
      role: UserRoles.ADMIN,
    });
    return { total, active, admins };
  }
}
