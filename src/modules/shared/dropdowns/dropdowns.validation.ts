// Must run before any schema below calls .openapi().
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";

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
    .enum(["ORG_MANAGER", "COACH", "PLAYER", "REFEREE"])
    .optional()
    .openapi({
      example: "ORG_MANAGER",
      description: "Filter by domain role. Omit to return users with any role.",
    }),
});

export default { dropdownSearchQuerySchema, teamsDropdownQuerySchema, usersDropdownQuerySchema };
