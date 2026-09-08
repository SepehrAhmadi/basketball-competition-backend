// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
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

const selfRegisterRoles = ["ORG_MANAGER", "PLAYER", "COACH", "REFEREE"] as const;

const adminAssignableRoles = [
  "ADMIN",
  "ORG_MANAGER",
  "COACH",
  "PLAYER",
  "REFEREE",
  "PUBLIC",
] as const;

export const registerSchema = z.object({
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
  avatarUrl: z.string().optional().openapi({
    description: "Optional profile photo URL",
    example: "/uploads/avatars/10.png",
  }),
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
    .array(z.enum(selfRegisterRoles))
    .min(1, messages.error.auth.atLeastOneRoleRequired)
    .openapi({ example: ["PLAYER"] }),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, messages.error.auth.identifierRequired)
    .openapi({ description: "Phone number or email", example: "09121234567" }),
  password: z
    .string()
    .min(1, messages.error.auth.passwordRequired)
    .openapi({ format: "password", example: "secret123" }),
});

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

export default { registerSchema, loginSchema, adminCreateUserSchema };
