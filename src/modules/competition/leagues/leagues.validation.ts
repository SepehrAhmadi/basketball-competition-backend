import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";

const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

export const leagueIdParamSchema = z.object({
  leagueId: idField(1),
});

export const leagueTeamParamSchema = z.object({
  leagueId: idField(1),
  leagueTeamId: idField(1),
});

export const leagueMemberParamSchema = z.object({
  leagueId: idField(1),
  leagueTeamId: idField(1),
  memberId: idField(1),
});

export const registerTeamSchema = z
  .object({
    teamId: idField(1),
  })
  .strict();

export const addMembersSchema = z
  .object({
    teamSeasonMemberIds: z.array(idField(1)).min(1).max(50),
  })
  .strict();

export const publicLeagueListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["REGISTRATION", "ACTIVE", "FINISHED"]).optional(),
  seasonId: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  ageCategoryId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .openapi({ example: 1 }),
  search: z.string().optional().openapi({ example: "برتر" }),
});

export const myLeaguesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["REGISTRATION", "ACTIVE", "FINISHED"]).optional(),
});

export const leagueTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional().openapi({ example: "عقاب" }),
});

export const membersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["COACH", "PLAYER"]).optional(),
});

export const candidatesQuerySchema = membersQuerySchema.extend({
  search: z.string().optional().openapi({ example: "علی" }),
});

export const eligibleTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional().openapi({ example: "عقاب" }),
  organizationId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .openapi({ example: 1 }),
});

export default {
  leagueIdParamSchema,
  leagueTeamParamSchema,
  leagueMemberParamSchema,
  registerTeamSchema,
  addMembersSchema,
  publicLeagueListQuerySchema,
  myLeaguesQuerySchema,
  leagueTeamsQuerySchema,
  membersQuerySchema,
  candidatesQuerySchema,
  eligibleTeamsQuerySchema,
};
