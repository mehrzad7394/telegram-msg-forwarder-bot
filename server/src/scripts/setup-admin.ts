import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRoles } from 'src/types/types';
dotenv.config();
interface IUser {
  telegramId: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash: string;
  createdAt: Date;
}

async function setupAdmin() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
  }
  if (!process.env.ADMIN_TELEGRAM_ID) {
    console.error('ADMIN_TELEGRAM_ID is not defined in .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const User = mongoose.model<IUser>(
      'User',
      new mongoose.Schema<IUser>({
        telegramId: String,
        username: String,
        role: String,
        isActive: Boolean,
        passwordHash: String,
        createdAt: Date,
      }),
    );
    //check if admin already exists
    const existingAdmin = await User.findOne({
      telegramId: process.env.ADMIN_TELEGRAM_ID,
      role: UserRoles.ADMIN,
    });
    if (existingAdmin) {
      console.log('Admin user already exists');
      await mongoose.disconnect();
      return;
    }
    // Create admin user
    const password = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    const adminUser = new User({
      telegramId: process.env.ADMIN_TELEGRAM_ID,
      username: 'admin',
      role: UserRoles.ADMIN,
      isActive: true,
      passwordHash: passwordHash,
      createdAt: new Date(),
    });
    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log(`Telegram ID: ${process.env.ADMIN_TELEGRAM_ID}`);
    console.log(`Initial password: ${password}`);
    console.log('Please change the password after first login.');
  } catch (error) {
    console.error('Error setting up admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}
setupAdmin();
