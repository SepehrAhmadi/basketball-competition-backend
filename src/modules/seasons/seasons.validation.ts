import "../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../language/message.ts";
import { paginationQuerySchema } from "../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../utils/date.util.ts";

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
    "Season date must be a valid Jalali date in YYYY/MM/DD format.",
  );

const seasonBaseFields = {
  name: z
    .string()
    .min(2, messages.error.season.nameRequired)
    .openapi({ example: "فصل اول" }),
  startDate: jalaliDateSchema.openapi({ example: "1403/06/01" }),
  endDate: jalaliDateSchema.openapi({ example: "1404/03/01" }),
  isActive: z.boolean().default(true),
};

const dateOrderRefine = {
  refine: (data: { startDate?: string; endDate?: string }) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  message: messages.error.season.endDateBeforeStartDate,
  path: ["endDate"],
};

export const createSeasonSchema = z
  .object(seasonBaseFields)
  .refine(dateOrderRefine.refine, {
    message: dateOrderRefine.message,
    path: dateOrderRefine.path,
  });

export const updateSeasonSchema = z
  .object(seasonBaseFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(dateOrderRefine.refine, {
    message: dateOrderRefine.message,
    path: dateOrderRefine.path,
  });

export const seasonListQuerySchema = paginationQuerySchema.extend({});

export const seasonIdParamSchema = z.object({
  seasonId: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example: 1 }),
});

export default {
  createSeasonSchema,
  updateSeasonSchema,
  seasonListQuerySchema,
  seasonIdParamSchema,
};
