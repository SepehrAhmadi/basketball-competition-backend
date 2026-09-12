import "../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../language/message.ts";
import { paginationQuerySchema } from "../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../utils/date.util.ts";

const jalaliFoundedDate = z
  .string()
  .nullable()
  .optional()
  .refine(
    (value) =>
      value == null ||
      (() => {
        try {
          jalaliToGregorian(value);
          return true;
        } catch {
          return false;
        }
      })(),
    "Founded date must be a valid Jalali date in YYYY/MM/DD format.",
  );

// Multipart note: multer parses text fields into req.body (all strings) and the
// logo file into req.file. File validation belongs to Multer — logoUrl is
// server-generated and therefore never accepted from the client.
const removeLogoField = z
  .preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean())
  .optional()
  .openapi({
    example: false,
    description:
      'Set to "true" to remove the existing logo when no new logo file is provided. A newly uploaded logo takes precedence.',
  });

export const createTeamSchema = z
  .object({
    organizationId: z.coerce
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
    name: z
      .string()
      .min(2, messages.error.team.nameRequired)
      .openapi({ example: "Tehran Titans" }),
    foundedDate: jalaliFoundedDate.openapi({
      example: "1399/01/01",
      description: "Jalali date in YYYY/MM/DD format",
    }),
    removeLogo: removeLogoField,
  })
  .strict();

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const teamIdParamSchema = z.object({
  teamId: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example: 1 }),
});

export const rosterQuerySchema = z.object({
  seasonId: z.coerce.number().int().positive().optional(),
  role: z.enum(["COACH", "PLAYER"]).optional(),
});

export const addRosterMemberSchema = z
  .object({
    userId: z.coerce
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
    seasonId: z.coerce
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
    role: z.enum(["COACH", "PLAYER"]),
    jerseyNumber: z.coerce.number().int().min(0).max(99).optional(),
    isHeadCoach: z.boolean().optional(),
  })
  .strict();

export const updateRosterMemberSchema = z
  .object({
    seasonId: z.coerce
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
    role: z.enum(["COACH", "PLAYER"]).optional(),
    jerseyNumber: z.coerce.number().int().min(0).max(99).nullable().optional(),
    isHeadCoach: z.boolean().optional(),
  })
  .strict();

export const removeRosterMemberSchema = z
  .object({
    seasonId: z.coerce
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
  })
  .strict();

export default {
  createTeamSchema,
  updateTeamSchema,
  teamIdParamSchema,
  rosterQuerySchema,
  addRosterMemberSchema,
  updateRosterMemberSchema,
  removeRosterMemberSchema,
};
