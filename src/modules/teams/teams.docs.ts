import { z } from "zod";
import { messages } from "../../language/message.ts";
import { registry } from "../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../swagger/helpers.ts";
import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from "../../shared/schemas.validation.ts";
import {
  teamIdParamSchema,
  rosterMemberParamSchema,
  rosterQuerySchema,
  createTeamSchema,
  updateTeamSchema,
  addRosterMemberSchema,
  updateRosterMemberSchema,
  removeRosterMemberSchema,
} from "./teams.validation.ts";

// ---- request schemas (multipart / JSON bodies for docs) ----

const teamLogoField = z.string().openapi({
  description: "Team logo image (JPEG/PNG/WEBP, max 1MB)",
  type: "string",
  format: "binary",
});

const removeLogoDocField = z
  .boolean()
  .optional()
  .openapi({
    example: false,
    description:
      'Send "true" (multipart text field) to remove the existing logo when no new logo file is provided. A newly uploaded logo takes precedence over removeLogo.',
  });

const createTeamRequestSchema = z
  .object({
    organizationId: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Tehran Titans" }),
    foundedDate: z.string().optional().openapi({ example: "1399/01/01", description: "Jalali date in YYYY/MM/DD format" }),
    logo: teamLogoField.optional(),
    removeLogo: removeLogoDocField,
  })
  .openapi("CreateTeamRequest");

const updateTeamRequestSchema = z
  .object({
    organizationId: z.number().optional().openapi({ example: 1 }),
    name: z.string().optional().openapi({ example: "Tehran Titans" }),
    foundedDate: z.string().optional().openapi({ example: "1399/01/01", description: "Jalali date in YYYY/MM/DD format" }),
    logo: teamLogoField.optional(),
    removeLogo: removeLogoDocField,
  })
  .openapi("UpdateTeamRequest");

const addRosterMemberRequestSchema = z
  .object({
    userId: z.number().openapi({ example: 10 }),
    seasonId: z.number().openapi({ example: 1 }),
    role: z.enum(["COACH", "PLAYER"]).openapi({ example: "PLAYER" }),
    jerseyNumber: z.number().optional().openapi({ example: 7 }),
    isHeadCoach: z.boolean().optional().openapi({ example: false }),
  })
  .openapi("AddRosterMemberRequest");

const updateRosterMemberRequestSchema = z
  .object({
    seasonId: z.number().openapi({ example: 1 }),
    role: z.enum(["COACH", "PLAYER"]).optional().openapi({ example: "PLAYER" }),
    jerseyNumber: z.number().nullable().optional().openapi({ example: 7 }),
    isHeadCoach: z.boolean().optional().openapi({ example: false }),
  })
  .openapi("UpdateRosterMemberRequest");

const removeRosterMemberRequestSchema = z
  .object({
    seasonId: z.number().openapi({ example: 1 }),
  })
  .openapi("RemoveRosterMemberRequest");

// ---- response models ----

export const teamSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    organizationId: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Tehran Titans" }),
    logoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/team-logos/team-1.png" }),
    foundedDate: z.string().nullable().openapi({ example: "1399/01/01", description: "Jalali date in YYYY/MM/DD format" }),
    status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).openapi({ example: "ACTIVE" }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    organization: z
      .object({
        id: z.number().openapi({ example: 1 }),
        name: z.string().openapi({ example: "Tehran Titans Club" }),
      })
      .optional(),
  })
  .openapi("Team");

const teamMemberSchema = z
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
      avatarUrl: z
        .string()
        .nullable()
        .openapi({ example: "/uploads/avatars/avatar-1.png" }),
    }),
  })
  .openapi("TeamRosterMember");

const rosterResponseSchema = z
  .object({
    season: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "1405-1406" }),
    }),
    items: z.array(teamMemberSchema),
    total: z.number().openapi({ example: 42 }),
    page: z.number().openapi({ example: 1 }),
    pageSize: z.number().openapi({ example: 20 }),
  })
  .openapi("TeamRoster");

const listTeamsQuerySchema = paginationQuerySchema.extend({
  organizationId: z.coerce.number().int().positive().optional(),
});

// ---- error schemas ----

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, messages.error.team.notAuthorized);
const notFoundError = () => errorResponseSchema(404, messages.error.team.notFound);

// ---- path registrations ----

registry.registerPath({
  method: "get",
  path: "/teams",
  tags: ["Teams"],
  summary: "List teams",
  description:
    "Paginated list of teams (public). Optionally filter by organizationId.",
  request: {
    query: listTeamsQuerySchema,
  },
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
  },
});

registry.registerPath({
  method: "get",
  path: "/teams/{teamId}",
  tags: ["Teams"],
  summary: "Get a team by id",
  description: "Fetch a single team (public).",
  request: {
    params: teamIdParamSchema,
  },
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
    "404": {
      description: "Team not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/teams/{teamId}/roster",
  tags: ["Teams"],
  summary: "Get team roster",
  description:
    "List members of a team for a specific season (defaults to the active season). Public.",
  request: {
    params: teamIdParamSchema,
    query: rosterQuerySchema,
  },
  responses: {
    "200": {
      description: "Team roster",
      content: {
        "application/json": {
          schema: successResponseSchema(rosterResponseSchema, {
            messageExample: messages.success.team.rosterList,
          }),
        },
      },
    },
    "404": {
      description: "Team or season not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/teams",
  tags: ["Teams"],
  summary: "Create a team",
  description:
    "Creates a team within an organization. Requires ORG_MANAGER or ADMIN. Accepts multipart/form-data with team fields plus an optional logo image file field named `logo` and an optional `removeLogo` text field (\"true\"/\"false\").",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "multipart/form-data": { schema: createTeamRequestSchema } },
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
    "400": {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            400,
            `name: ${messages.error.team.nameRequired}`,
          ),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Requires ORG_MANAGER or ADMIN role",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/teams/{teamId}",
  tags: ["Teams"],
  summary: "Update a team",
  description:
    "Partial update — send only the fields to change. Requires ORG_MANAGER or ADMIN with team access. Accepts multipart/form-data with team fields plus an optional logo image file field named `logo` and an optional `removeLogo` text field (\"true\"/\"false\").",
  security: [{ bearerAuth: [] }],
  request: {
    params: teamIdParamSchema,
    body: {
      content: { "multipart/form-data": { schema: updateTeamRequestSchema } },
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
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Team not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/teams/{teamId}",
  tags: ["Teams"],
  summary: "Delete a team",
  description: "Soft-deletes a team (sets status to DELETED). Requires ORG_MANAGER or ADMIN with team access.",
  security: [{ bearerAuth: [] }],
  request: {
    params: teamIdParamSchema,
  },
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
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Team not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/teams/{teamId}/logo",
  tags: ["Teams"],
  summary: "Replace team logo",
  description:
    "Upload a new logo image for the team. Replaces the existing logo. Requires ORG_MANAGER or ADMIN with team access. Accepts multipart/form-data with a `logo` file field.",
  security: [{ bearerAuth: [] }],
  request: {
    params: teamIdParamSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: z
            .object({
              logo: teamLogoField,
            })
            .openapi("UpdateTeamLogoRequest"),
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Logo updated",
      content: {
        "application/json": {
          schema: successResponseSchema(teamSchema, {
            messageExample: messages.success.team.logoUpdated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Team not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/teams/{teamId}/roster",
  tags: ["Teams"],
  summary: "Add a roster member",
  description:
    "Add a coach or player to the team for a given season. Requires ORG_MANAGER, COACH, or ADMIN with team access. COACH can only add PLAYERs. A coach can only be added once per team per season. Set isHeadCoach to true to assign as head coach (only one per team per season).",
  security: [{ bearerAuth: [] }],
  request: {
    params: teamIdParamSchema,
    body: {
      content: {
        "application/json": { schema: addRosterMemberRequestSchema },
      },
    },
  },
  responses: {
    "201": {
      description: "Roster member added",
      content: {
        "application/json": {
          schema: successResponseSchema(teamMemberSchema, {
            statusCode: 201,
            messageExample: messages.success.team.rosterMemberAdded,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Team or user not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
    "409": {
      description: "Duplicate coach, jersey number conflict, or head coach already exists",
      content: {
        "application/json": {
          schema: errorResponseSchema(409, messages.error.team.headCoachConflict),
        },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/teams/{teamId}/roster/{memberId}",
  tags: ["Teams"],
  summary: "Update a roster member",
  description:
    "Update a team member's role, jersey number, or head coach status. Requires ORG_MANAGER, COACH, or ADMIN with team access. Only one head coach is allowed per team per season.",
  security: [{ bearerAuth: [] }],
  request: {
    params: rosterMemberParamSchema,
    body: {
      content: {
        "application/json": { schema: updateRosterMemberRequestSchema },
      },
    },
  },
  responses: {
    "200": {
      description: "Roster member updated",
      content: {
        "application/json": {
          schema: successResponseSchema(teamMemberSchema, {
            messageExample: messages.success.team.rosterMemberUpdated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Team or roster member not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
    "409": {
      description: "Jersey number conflict or head coach already exists",
      content: {
        "application/json": {
          schema: errorResponseSchema(409, messages.error.team.headCoachAlreadyExists),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/teams/{teamId}/roster/{memberId}",
  tags: ["Teams"],
  summary: "Remove a roster member",
  description:
    "Remove a member from the team roster for a given season. Requires ORG_MANAGER, COACH, or ADMIN with team access.",
  security: [{ bearerAuth: [] }],
  request: {
    params: rosterMemberParamSchema,
    body: {
      content: {
        "application/json": { schema: removeRosterMemberRequestSchema },
      },
    },
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
      content: {
        "application/json": { schema: unauthorizedError },
      },
    },
    "403": {
      description: "Not authorized to manage this team",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Roster member not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});
