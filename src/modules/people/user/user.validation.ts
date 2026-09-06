// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";

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
    birthDate: z.coerce.date().optional().openapi({ example: "2001-05-04" }),
    nationalId: z
      .string()
      .min(10)
      .max(10)
      .optional()
      .openapi({ example: "0012345678" }),
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

export default { updateProfileSchema, changePasswordSchema };
