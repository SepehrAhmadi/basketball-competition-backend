import type { Role, UserStatus } from "../../../prisma/generated/prisma/enums.ts";

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  email?: string;
  birthDate?: Date;
  nationalId?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfile {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
  birthDate: Date | null;
  nationalId: string | null;
  status: UserStatus;
  roles: Role[];
  createdAt: Date;
}
