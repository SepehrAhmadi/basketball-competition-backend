import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { paginationQuerySchema } from "../../../../shared/schemas.validation.ts";

// Normalize Persian names: trim + map Arabic ي/ك to Persian ی/ک so the
// unique constraint cannot be bypassed with a different spelling.
export function normalizeAgeCategoryName(value: string): string {
  return value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک");
}

const ageCategoryNameField = z
  .string()
  .min(2, messages.error.ageCategory.nameRequired)
  .max(100)
  .transform((value) => normalizeAgeCategoryName(value))
  .refine((value) => value.length >= 2, {
    message: messages.error.ageCategory.nameRequired,
  })
  .openapi({ example: "نوجوانان" });

export const ageCategoryIdParamSchema = z.object({
  ageCategoryId: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example: 1 }),
});

export const createAgeCategorySchema = z
  .object({
    name: ageCategoryNameField,
  })
  .strict();

export const updateAgeCategorySchema = z
  .object({
    name: ageCategoryNameField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ageCategoryListQuerySchema = paginationQuerySchema.extend({
  search: z
    .string()
    .optional()
    .openapi({ example: "نوجوانان", description: "Search in age category name" }),
});

export default {
  ageCategoryIdParamSchema,
  createAgeCategorySchema,
  updateAgeCategorySchema,
  ageCategoryListQuerySchema,
};
