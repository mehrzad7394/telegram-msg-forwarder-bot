import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userModel.findOne({ telegramId }).exec();
  }
}
