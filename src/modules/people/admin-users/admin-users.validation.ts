// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../../utils/date.util.ts";
import { PERMISSION_CODES } from "../../../shared/permissions.ts";

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

const adminAssignableRoles = [
  "ORG_MANAGER",
  "COACH",
  "PLAYER",
  "REFEREE",
] as const;

export const roleSchema = z.enum(adminAssignableRoles).openapi({ example: "PLAYER" });

export const adminCreateUserSchema = z.object({
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
  password: z
    .string()
    .min(8, messages.error.auth.passwordMinLength)
    .openapi({ format: "password", example: "secret123" }),
  roles: z
    .array(z.enum(adminAssignableRoles))
    .min(1, messages.error.auth.atLeastOneRoleRequired)
    .openapi({ example: ["COACH"] }),
});

export const listUsersQuerySchema = paginationQuerySchema.extend({
  query: z.string().optional(),
  role: roleSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"]).optional(),
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
      .max(10)
      .optional()
      .openapi({ example: "0012345678" }),
    roles: z.array(roleSchema).optional().openapi({ example: ["COACH", "PLAYER"] }),
  })
  .partial()
  .strict();

export const adminResetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, messages.error.auth.passwordMinLength)
      .openapi({ format: "password", example: "newPassword123" }),
  })
  .strict();

export const setAdminStatusSchema = z
  .object({
    isAdmin: z.boolean().openapi({ example: true }),
  })
  .strict();

export const replacePermissionsSchema = z
  .object({
    permissions: z.array(z.enum(PERMISSION_CODES)).openapi({
      example: ["teams.create", "teams.update"],
    }),
  })
  .strict();

export default {
  adminCreateUserSchema,
  listUsersQuerySchema,
  updateUserByAdminSchema,
  adminResetPasswordSchema,
  setAdminStatusSchema,
  replacePermissionsSchema,
};
