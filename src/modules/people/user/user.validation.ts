// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../../utils/date.util.ts";

const jalaliBirthDate = z
  .string()
  .nullable()
  .optional()
  .refine((value) => value == null || (() => {
    try {
      jalaliToGregorian(value);
      return true;
    } catch {
      return false;
    }
  })(), "Birth date must be a valid Jalali date in YYYY/MM/DD format.");

export const allRoles = [
  "ADMIN",
  "ORG_MANAGER",
  "COACH",
  "PLAYER",
  "REFEREE",
  "PUBLIC",
] as const;

export const roleSchema = z.enum(allRoles).openapi({ example: "PLAYER" });

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .min(1, messages.error.auth.fullNameRequired)
      .openapi({ example: "Ali Rezaei" }),
    phone: z
      .string()
      .min(1, messages.error.auth.phoneRequired)
      .openapi({ example: "09121234567" }),
    email: z
      .string()
      .email(messages.error.auth.invalidEmail)
      .openapi({ example: "ali@example.com" }),
    birthDate: jalaliBirthDate.openapi({ example: "1381/05/20" }),
    nationalId: z
      .string()
      .min(10)
      .max(10)
      .optional()
      .openapi({ example: "0012345678" }),
    roles: z.array(roleSchema).optional().openapi({ example: ["PLAYER"] }),
  })
  .partial()
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, messages.error.auth.passwordRequired)
      .openapi({ format: "password", example: "oldPassword123" }),
    newPassword: z
      .string()
      .min(8, messages.error.auth.passwordMinLength)
      .openapi({ format: "password", example: "newPassword123" }),
  })
  .strict();

export const searchUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["COACH", "PLAYER", "REFEREE"]).optional(),
  query: z.string().optional(),
});

export const updateUserByAdminSchema = z
  .object({
    fullName: z
      .string()
      .min(1, messages.error.auth.fullNameRequired)
      .openapi({ example: "Ali Rezaei" }),
    phone: z
      .string()
      .min(1, messages.error.auth.phoneRequired)
      .openapi({ example: "09121234567" }),
    email: z
      .string()
      .email(messages.error.auth.invalidEmail)
      .openapi({ example: "ali@example.com" }),
    birthDate: jalaliBirthDate.openapi({ example: "1381/05/20" }),
    nationalId: z
      .string()
      .min(10)
      .max(10)
      .optional()
      .openapi({ example: "0012345678" }),
    roles: z.array(roleSchema).optional().openapi({ example: ["COACH", "PLAYER"] }),
  })
  .partial()
  .strict();

export const listUsersQuerySchema = paginationQuerySchema.extend({
  query: z.string().optional(),
  role: roleSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"]).optional(),
});

export default {
  updateProfileSchema,
  changePasswordSchema,
  searchUsersQuerySchema,
  updateUserByAdminSchema,
  listUsersQuerySchema,
};
