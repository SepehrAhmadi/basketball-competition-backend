import type { Role, UserStatus } from "../../../prisma/generated/prisma/enums.ts";

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  email?: string;
  birthDate?: string | null;
  nationalId?: string;
  roles?: Role[];
}

export interface UpdateUserByAdminInput {
  fullName?: string;
  phone?: string;
  email?: string;
  birthDate?: string | null;
  nationalId?: string;
  roles?: Role[];
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  query?: string;
  role?: Role;
  status?: UserStatus;
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
  birthDate: string | null;
  nationalId: string | null;
  status: UserStatus;
  roles: Role[];
  createdAt: Date;
}
