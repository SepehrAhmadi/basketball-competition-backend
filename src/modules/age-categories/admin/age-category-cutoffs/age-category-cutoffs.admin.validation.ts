import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../../../utils/date.util.ts";

const jalaliDateSchema = z
  .string()
  .refine(
    (value) => {
      try {
        jalaliToGregorian(value);
        return true;
      } catch {
        return false;
      }
    },
    "Cutoff date must be a valid Jalali date in YYYY/MM/DD format.",
  )
  .openapi({ example: "1390/10/11", description: "Jalali date in YYYY/MM/DD format" });

const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

export const cutoffIdParamSchema = z.object({
  cutoffId: idField(1),
});

export const createCutoffSchema = z
  .object({
    ageCategoryId: idField(1),
    seasonId: idField(1),
    minBirthDate: jalaliDateSchema,
  })
  .strict();

export const updateCutoffSchema = z
  .object({
    seasonId: idField(1).optional(),
    minBirthDate: jalaliDateSchema.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export const cutoffListQuerySchema = paginationQuerySchema.extend({
  ageCategoryId: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  seasonId: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
});

export default {
  cutoffIdParamSchema,
  createCutoffSchema,
  updateCutoffSchema,
  cutoffListQuerySchema,
};
