import { z } from "zod";
import { messages } from "../../../language/message.ts";

const registerSchema = z.object({
  fullName: z.string().min(1, messages.error.auth.fullNameRequired),
  phone: z.string().min(1, messages.error.auth.phoneRequired),
  email: z.string().email(messages.error.auth.invalidEmail),
  avatarUrl: z.string().optional(),
  password: z.string().min(8, messages.error.auth.passwordMinLength),
  roles: z
    .array(z.enum(["ORG_MANAGER", "PLAYER", "COACH", "REFEREE"]))
    .min(1, messages.error.auth.atLeastOneRoleRequired),
});

const loginSchema = z.object({
  identifier: z.string().min(1, messages.error.auth.identifierRequired),
  password: z.string().min(1, messages.error.auth.passwordRequired),
});

const adminCreateUserSchema = z.object({
  fullName: z.string().min(1, messages.error.auth.fullNameRequired),
  phone: z.string().min(1, messages.error.auth.phoneRequired),
  email: z.string().email(messages.error.auth.invalidEmail),
  password: z.string().min(8, messages.error.auth.passwordMinLength),
  roles: z
    .array(z.enum(["ADMIN", "ORG_MANAGER", "COACH", "PLAYER", "REFEREE", "PUBLIC"]))
    .min(1, messages.error.auth.atLeastOneRoleRequired),
});

export default { registerSchema, loginSchema, adminCreateUserSchema };
