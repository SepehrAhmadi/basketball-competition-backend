import { z } from "zod";
import { messages } from "../../../../../language/message.ts";
import { registry } from "../../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../../swagger/helpers.ts";
import {
  leagueIdParamSchema,
  adminLeagueListQuerySchema,
  createLeagueSchema,
  updateLeagueSchema,
  updateLeagueStatusSchema,
} from "./leagues.admin.validation.ts";
import { leagueSchema as baseLeagueSchema } from "../../leagues.docs.ts";

const leagueSchema = baseLeagueSchema
  .omit({ can: true })
  .openapi("AdminLeague");

const leagueListDataSchema = z.object({
  items: z.array(leagueSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad request");
const conflictError = errorResponseSchema(409, "Conflict");

registry.registerPath({
  method: "get",
  path: "/admin/leagues",
  tags: ["Admin - Leagues"],
  summary: "List leagues (admin, paginated)",
  request: { query: adminLeagueListQuerySchema },
  responses: {
    "200": {
      description: "Leagues fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueListDataSchema, {
            messageExample: messages.success.league.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.view",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/leagues/{leagueId}",
  tags: ["Admin - Leagues"],
  summary: "Get a single league (admin)",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "League found",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueSchema, {
            messageExample: messages.success.league.found,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.view",
      content: { "application/json": { schema: forbiddenError } },
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

registry.registerPath({
  method: "post",
  path: "/admin/leagues",
  tags: ["Admin - Leagues"],
  summary: "Create a league (status INACTIVE)",
  request: {
    body: {
      content: { "application/json": { schema: createLeagueSchema } },
    },
  },
  responses: {
    "201": {
      description: "League created",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueSchema, {
            statusCode: 201,
            messageExample: messages.success.league.created,
          }),
        },
      },
    },
    "400": {
      description: "Validation or date order error",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.create",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Age category cutoff not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(
            404,
            messages.error.ageCategoryCutoff.notFound,
          ),
        },
      },
    },
    "409": {
      description: "Duplicate league name under the same cutoff",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/leagues/{leagueId}",
  tags: ["Admin - Leagues"],
  summary: "Update a league (admin)",
  request: {
    params: leagueIdParamSchema,
    body: {
      content: { "application/json": { schema: updateLeagueSchema } },
    },
  },
  responses: {
    "200": {
      description: "League updated",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueSchema, {
            messageExample: messages.success.league.updated,
          }),
        },
      },
    },
    "400": {
      description: "Validation or date order error",
      content: { "application/json": { schema: badRequestError } },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.update",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League or cutoff not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "Finished locked, cutoff locked or duplicate name",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/admin/leagues/{leagueId}/status",
  tags: ["Admin - Leagues"],
  summary: "Change league status (admin)",
  request: {
    params: leagueIdParamSchema,
    body: {
      content: { "application/json": { schema: updateLeagueStatusSchema } },
    },
  },
  responses: {
    "200": {
      description: "League status updated",
      content: {
        "application/json": {
          schema: successResponseSchema(leagueSchema, {
            messageExample: messages.success.league.statusUpdated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission or FINISHED change by non SUPER_ADMIN",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "Minimum teams or players requirement not met",
      content: { "application/json": { schema: conflictError } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/leagues/{leagueId}",
  tags: ["Admin - Leagues"],
  summary: "Delete a league (admin)",
  request: { params: leagueIdParamSchema },
  responses: {
    "200": {
      description: "League deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.league.deleted,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing permission: leagues.delete",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "League not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.league.notFound),
        },
      },
    },
    "409": {
      description: "League has teams or dependents",
      content: { "application/json": { schema: conflictError } },
    },
  },
});
