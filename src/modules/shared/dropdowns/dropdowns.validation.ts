// Must run before any schema below calls .openapi().
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";
import { normalizePersianText } from "../../../utils/persian.util.ts";
import { LEAGUE_STATUS_VALUES } from "../../leagues/lib/league.rules.ts";

export const dropdownSearchQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional().openapi({ example: "Titans" }),
});

export const teamsDropdownQuerySchema = dropdownSearchQuerySchema.extend({
  organizationId: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .optional()
    .openapi({ example: 1 }),
});

export const usersDropdownQuerySchema = dropdownSearchQuerySchema.extend({
  role: z
    .enum(["COACH", "PLAYER", "REFEREE"])
    .optional()
    .openapi({
      example: "COACH",
      description: "Filter by domain role. Omit to return users with any role.",
    }),
});

const optionalIdField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .optional()
    .openapi({ example });

export const adminLeagueDropdownQuerySchema = dropdownSearchQuerySchema.extend({
  search: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const normalized = normalizePersianText(value);
      return normalized.length ? normalized : undefined;
    })
    .openapi({
      example: "برتر",
      description:
        "League name contains. Trimmed, with Arabic ي/ك mapped to Persian ی/ک.",
    }),
  seasonId: optionalIdField(1),
  ageCategoryId: optionalIdField(1),
  status: z.enum(LEAGUE_STATUS_VALUES).optional().openapi({ example: "ACTIVE" }),
});

export default {
  dropdownSearchQuerySchema,
  teamsDropdownQuerySchema,
  usersDropdownQuerySchema,
  adminLeagueDropdownQuerySchema,
};
