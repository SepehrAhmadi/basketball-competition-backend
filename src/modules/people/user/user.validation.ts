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
