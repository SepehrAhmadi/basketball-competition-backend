import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { registry } from "../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../swagger/helpers.ts";
import { advisorySchema } from "../../../../swagger/advisory.docs.ts";
import {
  createGroupSchema,
  groupParamSchema,
  groupTeamParamSchema,
  leagueIdParamSchema,
  unassignedTeamsQuerySchema,
  updateGroupSchema,
} from "./groups.admin.validation.ts";

const groupTeamSchema = z
  .object({
    leagueTeamId: z.number().openapi({ example: 11 }),
    team: z
      .object({
        id: z.number().openapi({ example: 5 }),
        name: z.string().openapi({ example: "عقاب" }),
        logoUrl: z.string().nullable().openapi({ example: null }),
      })
      .openapi("GroupTeamItem"),
    organization: z
      .object({
        id: z.number().openapi({ example: 2 }),
        name: z.string().openapi({ example: "باشگاه عقاب" }),
      })
      .nullable(),
  })
  .openapi("AdminGroupTeam");

const groupIssueSchema = advisorySchema.openapi("AdminGroupIssue");

const groupItemSchema = z
  .object({
    id: z.number().openapi({ example: 3 }),
    name: z.string().openapi({ example: "گروه الف" }),
    qualifiersOverride: z.number().nullable().openapi({ example: null }),
    qualifiers: z.number().nullable().openapi({ example: 2 }),
    teamsCount: z.number().openapi({ example: 1 }),
    issues: z.array(groupIssueSchema).openapi({
      description:
        "`issues` is always present; an empty array means no issues. " +
        "All group issues are warnings and never block saving. Codes: " +
        "`GROUP_TOO_SMALL`, `QUALIFIERS_EXCEED_TEAMS`.",
    }),
    teams: z.array(groupTeamSchema),
  })
  .openapi("AdminGroupItem");

const groupSummarySchema = z
  .object({
    id: z.number().openapi({ example: 3 }),
    teamsCount: z.number().openapi({ example: 2 }),
    qualifiers: z.number().nullable().openapi({ example: 2 }),
    issues: z.array(groupIssueSchema),
  })
  .openapi("AdminGroupSummary");

const groupsListSchema = z
  .object({
    league: z.object({
      id: z.number().openapi({ example: 1 }),
      format: z.string().nullable().openapi({ example: "GROUPS_KNOCKOUT" }),
      defaultQualifiersPerGroup: z
        .number()
        .nullable()
        .openapi({ example: 2 }),
    }),
    lock: z.union([advisorySchema, z.null()]).openapi({
      example: null,
      description:
        "Null when the grouping is editable. Code `FINISHED` (BLOCKER) when " +
        "the league is finished.",
    }),
    groups: z.array(groupItemSchema),
    unassignedCount: z.number().openapi({ example: 3 }),
    issues: z.array(groupIssueSchema).openapi({
      description:
        "League-level issues. Code `TEAM_UNASSIGNED` when teams are not " +
        "placed in any group.",
    }),
  })
  .openapi("AdminGroupsList");

const unassignedListSchema = z
  .object({
    items: z.array(groupTeamSchema),
    total: z.number().openapi({ example: 3 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
  })
  .openapi("AdminUnassignedTeams");

const deleteGroupSchema = z
  .object({
    unassignedCount: z.number().openapi({ example: 3 }),
    issues: z.array(groupIssueSchema),
  })
  .openapi("AdminDeleteGroupResult");

const placementSchema = z
  .object({
    affectedGroups: z.array(groupSummarySchema),
    unassignedCount: z.number().openapi({ example: 3 }),
    issues: z.array(groupIssueSchema),
  })
  .openapi("AdminGroupPlacement");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad request");
const conflictError = errorResponseSchema(409, "Conflict");

function notFoundError(message: string) {
  return errorResponseSchema(404, message);
}

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/groups",
  tags: ["Admin - League Groups"],
  summary: "List groups of a league (admin)",
  description:
    "`issues` is always present; an empty array means no issues. All group " +
    "issues are warnings and never block saving. Group issues and " +
    "`TEAM_UNASSIGNED` are only produced for group formats; otherwise " +
    "`issues` is `[]`. `lock` is non-null when edits are blocked.",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "Groups fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(groupsListSchema, {
            messageExample: messages.success.group.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.view",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.league.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}/groups/unassigned-teams",
  tags: ["Admin - League Groups"],
  summary: "List registered teams without a group (admin)",
  request: {
    params: leagueIdParamSchema,
    query: unassignedTeamsQuerySchema,
  },
  responses: {
    "200": {
      description: "Unassigned teams fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(unassignedListSchema, {
            messageExample: messages.success.group.unassignedList,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.view",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "League is FINISHED",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/leagues/{leagueId}/groups",
  tags: ["Admin - League Groups"],
  summary: "Create a group (admin)",
  request: {
    params: leagueIdParamSchema,
    body: {
      content: { "application/json": { schema: createGroupSchema } },
    },
  },
  responses: {
    "201": {
      description: "Group created",
      content: {
        "application/json": {
          schema: successResponseSchema(groupItemSchema, {
            messageExample: messages.success.group.created,
          }),
        },
      },
    },
    "400": {
      description: "Validation error",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.create",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.league.notFound),
        },
      },
    },
    "409": {
      description:
        "League is FINISHED, format is not grouped, single-group limit, " +
        "or duplicate group name",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}/groups/{groupId}",
  tags: ["Admin - League Groups"],
  summary: "Update a group (admin)",
  request: {
    params: groupParamSchema,
    body: {
      content: { "application/json": { schema: updateGroupSchema } },
    },
  },
  responses: {
    "200": {
      description: "Group updated",
      content: {
        "application/json": {
          schema: successResponseSchema(groupItemSchema, {
            messageExample: messages.success.group.updated,
          }),
        },
      },
    },
    "400": {
      description: "Validation error",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.update",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League or group not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.group.notFound),
        },
      },
    },
    "409": {
      description: "League is FINISHED or duplicate group name",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/groups/{groupId}",
  tags: ["Admin - League Groups"],
  summary: "Delete a group (admin)",
  description: "Teams of the deleted group become unassigned.",
  request: { params: groupParamSchema },
  responses: {
    "200": {
      description: "Group deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(deleteGroupSchema, {
            messageExample: messages.success.group.deleted,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.delete",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League or group not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.group.notFound),
        },
      },
    },
    "409": {
      description: "League is FINISHED",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}/groups/{groupId}/teams/{leagueTeamId}",
  tags: ["Admin - League Groups"],
  summary: "Assign or move a team to a group (admin)",
  description:
    "Idempotent: assigning a team that is already in the group returns the " +
    "same summary. Moving between groups is a single request.",
  request: { params: groupTeamParamSchema },
  responses: {
    "200": {
      description: "Team assigned",
      content: {
        "application/json": {
          schema: successResponseSchema(placementSchema, {
            messageExample: messages.success.group.teamAssigned,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.update",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League, group, or league team not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.leagueTeam.notFound),
        },
      },
    },
    "409": {
      description: "League is FINISHED or concurrent assignment conflict",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}/groups/{groupId}/teams/{leagueTeamId}",
  tags: ["Admin - League Groups"],
  summary: "Remove a team from a group (admin)",
  request: { params: groupTeamParamSchema },
  responses: {
    "200": {
      description: "Team removed from group",
      content: {
        "application/json": {
          schema: successResponseSchema(placementSchema, {
            messageExample: messages.success.group.teamRemoved,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: groups.update",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League, group, or team membership not found",
      content: {
        "application/json": {
          schema: notFoundError(messages.error.group.teamNotInGroup),
        },
      },
    },
    "409": {
      description: "League is FINISHED",
      content: { "application/json": { schema: conflictError } },
    },
  },
});
