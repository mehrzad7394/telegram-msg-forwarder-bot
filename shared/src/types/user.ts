export interface UserProfile {
  _id: string;
  telegramId: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash?: string;
}

export interface JWTPayload {
  telegramId: string;
  username: string;
  sub: string;
  role: UserRoles;
}

export enum UserRoles {
  ADMIN = 'admin',
  USER = 'user'
}