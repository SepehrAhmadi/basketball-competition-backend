import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { leagueIdParamSchema } from "./admin/groups.admin.validation.ts";

const publicGroupTeamSchema = z
  .object({
    leagueTeamId: z.number().openapi({ example: 11 }),
    team: z.object({
      id: z.number().openapi({ example: 5 }),
      name: z.string().openapi({ example: "عقاب" }),
      logoUrl: z.string().nullable().openapi({ example: null }),
    }),
    organization: z
      .object({
        id: z.number().openapi({ example: 2 }),
        name: z.string().openapi({ example: "باشگاه عقاب" }),
      })
      .nullable(),
  })
  .openapi("PublicGroupTeam");

const publicGroupSchema = z
  .object({
    id: z.number().openapi({ example: 3 }),
    name: z.string().openapi({ example: "گروه الف" }),
    qualifiers: z.number().nullable().openapi({ example: 2 }),
    teams: z.array(publicGroupTeamSchema),
  })
  .openapi("PublicGroup");

const publicGroupsSchema = z
  .object({
    format: z.string().nullable().openapi({ example: "GROUPS_KNOCKOUT" }),
    groups: z.array(publicGroupSchema),
  })
  .openapi("PublicGroupsList");

registry.registerPath({
  method: "get",
  path: "/leagues/{leagueId}/groups",
  tags: ["League Groups"],
  summary: "List groups of a league (public)",
  description:
    "Shown only when the format is a group format and at least one group " +
    "exists; otherwise `groups` is `[]`. No admin-only data is exposed.",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "Groups fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(publicGroupsSchema, {
            messageExample: messages.success.group.publicList,
          }),
        },
      },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
  },
});
