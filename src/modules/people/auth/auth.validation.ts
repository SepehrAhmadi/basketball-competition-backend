// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";

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
  birthDate: z.coerce.date().optional().openapi({ example: "2001-05-04" }),
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
  birthDate: z.coerce.date().optional().openapi({ example: "2001-05-04" }),
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
