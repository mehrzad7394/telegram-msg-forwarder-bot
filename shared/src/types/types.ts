export interface UserProfile {
  _id: string;
  telegramId: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash?: string;
}
