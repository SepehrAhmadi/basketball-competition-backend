import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { paginationQuerySchema } from "../../../../shared/schemas.validation.ts";
import { leagueIdParamSchema } from "../../../leagues/leagues.validation.ts";

export { leagueIdParamSchema };

const idField = (example: number) =>
  z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive()
    .openapi({ example });

function normalizeGroupName(value: string): string {
  return value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک");
}

const groupNameField = z
  .string({ required_error: messages.error.group.nameRequired })
  .min(2, messages.error.group.nameRequired)
  .max(100, messages.error.group.nameTooLong)
  .transform(normalizeGroupName)
  .refine((v) => v.length >= 2, messages.error.group.nameRequired)
  .openapi({ example: "گروه الف" });

const qualifiersField = z
  .number()
  .int()
  .min(1)
  .max(64)
  .nullable()
  .optional()
  .openapi({ example: 2 });

export const groupParamSchema = z.object({
  leagueId: idField(1),
  groupId: idField(1),
});

export const groupTeamParamSchema = z.object({
  leagueId: idField(1),
  groupId: idField(1),
  leagueTeamId: idField(1),
});

export const createGroupSchema = z
  .object({
    name: groupNameField,
    qualifiersOverride: qualifiersField,
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: groupNameField.optional(),
    qualifiersOverride: qualifiersField,
  })
  .strict()
  .refine((data) => data.name !== undefined || data.qualifiersOverride !== undefined, {
    message: messages.error.group.updateFieldRequired,
  });

export const unassignedTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional().openapi({ example: "عقاب" }),
});

export default {
  leagueIdParamSchema,
  groupParamSchema,
  groupTeamParamSchema,
  createGroupSchema,
  updateGroupSchema,
  unassignedTeamsQuerySchema,
};
