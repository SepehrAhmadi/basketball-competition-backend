import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";
import { jalaliToGregorian } from "../../../utils/date.util.ts";

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

// Admin endpoints accept JSON bodies (no file upload).
// Logos are managed by the organization manager, not by admin.
const adminTeamStatusField = z
  .enum(["ACTIVE", "INACTIVE"])
  .openapi({ example: "ACTIVE" });

export const adminCreateTeamSchema = z
  .object({
    organizationId: z
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive(),
    name: z.string().min(2, messages.error.team.nameRequired).openapi({ example: "Tehran Titans" }),
    foundedDate: jalaliFoundedDate.openapi({
      example: "1399/01/01",
      description: "Jalali date in YYYY/MM/DD format",
    }),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE").openapi({ example: "ACTIVE" }),
  })
  .strict();

export const adminUpdateTeamSchema = z
  .object({
    organizationId: z
      .number({ invalid_type_error: "The value must be a number" })
      .int()
      .positive()
      .optional(),
    name: z
      .string()
      .min(2, messages.error.team.nameRequired)
      .optional()
      .openapi({ example: "Tehran Titans" }),
    foundedDate: jalaliFoundedDate,
    status: adminTeamStatusField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const adminTeamListQuerySchema = paginationQuerySchema.extend({
  organizationId: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  status: z
    .enum(["ACTIVE", "INACTIVE", "DELETED", "ALL"])
    .optional()
    .openapi({
      example: "ACTIVE",
      description: "Filter by status. Omit to exclude DELETED; ALL includes every status.",
    }),
  search: z.string().optional().openapi({ example: "Titans", description: "Search in team name" }),
});

// Admin roster query: ACTIVE members only. status is never client-supplied.
export const adminRosterQuerySchema = paginationQuerySchema.extend({
  seasonId: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example: 1, description: "Season to list the roster for" }),
  role: z.enum(["COACH", "PLAYER"]).optional().openapi({ example: "PLAYER" }),
  search: z
    .string()
    .optional()
    .openapi({
      example: "Ali",
      description: "Search in member fullName, phone, or jersey number",
    }),
});

export default {
  adminCreateTeamSchema,
  adminUpdateTeamSchema,
  adminTeamListQuerySchema,
  adminRosterQuerySchema,
};
