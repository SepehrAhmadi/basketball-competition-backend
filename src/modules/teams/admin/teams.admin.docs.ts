import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../shared/schemas.validation.ts";
import {
  teamIdParamSchema,
  rosterMemberParamSchema,
  addRosterMemberSchema,
  updateRosterMemberSchema,
  removeRosterMemberSchema,
} from "../teams.validation.ts";
import {
  adminTeamListQuerySchema,
  adminRosterQuerySchema,
} from "./teams.admin.validation.ts";
import { teamSchema } from "../teams.docs.ts";

const adminCreateTeamRequestSchema = z
  .object({
    organizationId: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Tehran Titans" }),
    foundedDate: z
      .string()
      .optional()
      .openapi({ example: "1399/01/01", description: "Jalali date in YYYY/MM/DD format" }),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().openapi({ example: "ACTIVE" }),
  })
  .openapi("AdminCreateTeamRequest");

const adminUpdateTeamRequestSchema = z
  .object({
    organizationId: z.number().optional().openapi({ example: 1 }),
    name: z.string().optional().openapi({ example: "Tehran Titans" }),
    foundedDate: z
      .string()
      .optional()
      .openapi({ example: "1399/01/01", description: "Jalali date in YYYY/MM/DD format" }),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().openapi({ example: "INACTIVE" }),
  })
  .openapi("AdminUpdateTeamRequest");

const adminRosterMemberSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    userId: z.number().openapi({ example: 10 }),
    role: z.enum(["COACH", "PLAYER"]).openapi({ example: "PLAYER" }),
    jerseyNumber: z.number().nullable().openapi({ example: 7 }),
    isHeadCoach: z.boolean().openapi({ example: false }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    user: z.object({
      id: z.number().openapi({ example: 10 }),
      fullName: z.string().openapi({ example: "Ali Rezaei" }),
      phone: z.string().nullable().openapi({ example: "09121234567" }),
      avatarUrl: z.string().nullable().openapi({ example: "/uploads/avatars/avatar-1.png" }),
    }),
  })
  .openapi("AdminTeamRosterMember");

const adminRosterResponseSchema = z
  .object({
    team: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "Tehran Titans" }),
    }),
    season: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "1405-1406" }),
    }),
    items: z.array(adminRosterMemberSchema),
    total: z.number().openapi({ example: 42 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
  })
  .openapi("AdminTeamRoster");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const notFoundError = () => errorResponseSchema(404, messages.error.team.notFound);

registry.registerPath({
  method: "get",
  path: "/admin/teams",
  tags: ["Admin - Teams"],
  summary: "List teams (admin)",
  description:
    "Paginated admin list with optional organizationId, status (omit to exclude DELETED; ALL includes every status), and search in team name.",
  request: { query: adminTeamListQuerySchema },
  responses: {
    "200": {
      description: "Paginated list of teams",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(teamSchema), {
            messageExample: messages.success.team.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/teams/{teamId}",
  tags: ["Admin - Teams"],
  summary: "Get a team by id (admin)",
  request: { params: teamIdParamSchema },
  responses: {
    "200": {
      description: "Team found",
      content: {
        "application/json": {
          schema: successResponseSchema(teamSchema, {
            messageExample: messages.success.team.found,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/teams",
  tags: ["Admin - Teams"],
  summary: "Create a team (admin)",
  description:
    "Creates a team within an organization with ACTIVE/INACTIVE status. JSON body. Logos are managed by the organization manager, not admin.",
  request: {
    body: {
      content: { "application/json": { schema: adminCreateTeamRequestSchema } },
    },
  },
  responses: {
    "201": {
      description: "Team created",
      content: {
        "application/json": {
          schema: successResponseSchema(teamSchema, {
            statusCode: 201,
            messageExample: messages.success.team.created,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.create permission",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/teams/{teamId}",
  tags: ["Admin - Teams"],
  summary: "Update a team (admin)",
  description: "Partial update incl. status toggle and optional cross-organization move. JSON body.",
  request: {
    params: teamIdParamSchema,
    body: {
      content: { "application/json": { schema: adminUpdateTeamRequestSchema } },
    },
  },
  responses: {
    "200": {
      description: "Team updated",
      content: {
        "application/json": {
          schema: successResponseSchema(teamSchema, {
            messageExample: messages.success.team.updated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.update permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/teams/{teamId}",
  tags: ["Admin - Teams"],
  summary: "Delete a team (admin)",
  description: "Soft-delete: sets status to DELETED.",
  request: { params: teamIdParamSchema },
  responses: {
    "200": {
      description: "Team deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.team.deleted,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.delete permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/teams/{teamId}/restore",
  tags: ["Admin - Teams"],
  summary: "Restore a deleted team (admin)",
  description: "Restores a DELETED team back to ACTIVE.",
  request: { params: teamIdParamSchema },
  responses: {
    "200": {
      description: "Team restored",
      content: {
        "application/json": {
          schema: successResponseSchema(teamSchema, {
            messageExample: messages.success.team.restored,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing teams.restore permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/teams/{teamId}/roster",
  tags: ["Admin - Teams"],
  summary: "Get team roster (admin)",
  description:
    "Lists ACTIVE members only for a season. seasonId is required; role (COACH/PLAYER) and search (member fullName, phone, jersey number) are optional.",
  request: { params: teamIdParamSchema, query: adminRosterQuerySchema },
  responses: {
    "200": {
      description: "Team roster",
      content: {
        "application/json": {
          schema: successResponseSchema(adminRosterResponseSchema, {
            messageExample: messages.success.team.rosterList,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing roster.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team or season not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/teams/{teamId}/roster",
  tags: ["Admin - Teams"],
  summary: "Add a roster member (admin)",
  request: { params: teamIdParamSchema, body: { content: { "application/json": { schema: addRosterMemberSchema } } } },
  responses: {
    "201": {
      description: "Roster member added",
      content: {
        "application/json": {
          schema: successResponseSchema(adminRosterMemberSchema, {
            statusCode: 201,
            messageExample: messages.success.team.rosterMemberAdded,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing roster.create permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Team, season, or user not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/teams/{teamId}/roster/{memberId}",
  tags: ["Admin - Teams"],
  summary: "Update a roster member (admin)",
  request: {
    params: rosterMemberParamSchema,
    body: { content: { "application/json": { schema: updateRosterMemberSchema } } },
  },
  responses: {
    "200": {
      description: "Roster member updated",
      content: {
        "application/json": {
          schema: successResponseSchema(adminRosterMemberSchema, {
            messageExample: messages.success.team.rosterMemberUpdated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing roster.update permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Roster member not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/teams/{teamId}/roster/{memberId}",
  tags: ["Admin - Teams"],
  summary: "Remove a roster member (admin)",
  request: {
    params: rosterMemberParamSchema,
    body: { content: { "application/json": { schema: removeRosterMemberSchema } } },
  },
  responses: {
    "200": {
      description: "Roster member removed",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.team.rosterMemberRemoved,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing roster.delete permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Roster member not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});
