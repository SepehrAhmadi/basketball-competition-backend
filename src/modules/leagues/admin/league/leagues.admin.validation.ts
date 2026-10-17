import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../../shared/schemas.validation.ts";
import { messages } from "../../../../language/message.ts";
import { jalaliToGregorian } from "../../../../utils/date.util.ts";
import { LEAGUE_STATUS_VALUES } from "../../lib/league.rules.ts";
import { leagueIdParamSchema } from "../../leagues.validation.ts";

export { leagueIdParamSchema };

const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

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
    "League date must be a valid Jalali date in YYYY/MM/DD format.",
  )
  .openapi({
    example: "1404/06/01",
    description: "Jalali date in YYYY/MM/DD format",
  });

const nullableJalaliDate = jalaliDateSchema.nullable().optional();

const nameField = z
  .string({ required_error: messages.error.league.nameRequired })
  .trim()
  .transform((v) => v.replace(/ي/g, "ی").replace(/ك/g, "ک"))
  .refine((v) => v.length >= 2, { message: messages.error.league.nameRequired })
  .refine((v) => v.length <= 100, {
    message: messages.error.league.nameRequired,
  })
  .openapi({ example: "لیگ برتر نوجوانان" });

const descriptionField = z
  .string()
  .max(5000)
  .nullable()
  .optional()
  .openapi({ example: "توضیحات لیگ" });

export const adminLeagueListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LEAGUE_STATUS_VALUES).optional(),
  seasonId: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  ageCategoryId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .openapi({ example: 1 }),
  search: z.string().optional().openapi({ example: "برتر" }),
});

export const createLeagueSchema = z
  .object({
    name: nameField,
    ageCategoryCutoffId: idField(1),
    startDate: nullableJalaliDate,
    endDate: nullableJalaliDate,
    rosterDeadline: nullableJalaliDate,
    description: descriptionField,
  })
  .strict();

export const updateLeagueSchema = z
  .object({
    name: nameField.optional(),
    ageCategoryCutoffId: idField(1).optional(),
    startDate: nullableJalaliDate,
    endDate: nullableJalaliDate,
    rosterDeadline: nullableJalaliDate,
    description: descriptionField,
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export const updateLeagueStatusSchema = z
  .object({
    status: z.enum(LEAGUE_STATUS_VALUES),
  })
  .strict();

export default {
  leagueIdParamSchema,
  adminLeagueListQuerySchema,
  createLeagueSchema,
  updateLeagueSchema,
  updateLeagueStatusSchema,
};
