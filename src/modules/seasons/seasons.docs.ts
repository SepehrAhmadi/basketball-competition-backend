import { z } from "zod";
import { messages } from "../../language/message.ts";
import { registry } from "../../swagger/registry.ts";
import { errorResponseSchema, successResponseSchema } from "../../swagger/helpers.ts";
import {
  createSeasonSchema,
  updateSeasonSchema,
  seasonListQuerySchema,
  seasonIdParamSchema,
} from "./seasons.validation.ts";

const seasonSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "فصل اول" }),
    startDate: z.string().nullable().openapi({ example: "2024-08-22" }),
    endDate: z.string().nullable().openapi({ example: "2025-05-21" }),
    isActive: z.boolean().openapi({ example: true }),
    createdAt: z.string(),
  })
  .openapi("Season");

const seasonListDataSchema = z.object({
  items: z.array(seasonSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const forbiddenError = errorResponseSchema(403, "Forbidden");
const unauthorizedError = errorResponseSchema(401, "Unauthorized");

registry.registerPath({
  method: "get",
  path: "/seasons",
  tags: ["Season"],
  summary: "List seasons (paginated)",
  security: [],
  request: { query: seasonListQuerySchema },
  responses: {
    "200": {
      description: "Seasons fetched",
      content: {
        "application/json": {
          schema: successResponseSchema(seasonListDataSchema, {
            messageExample: messages.success.season.list,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/seasons/{seasonId}",
  tags: ["Season"],
  summary: "Get a single season",
  security: [],
  request: { params: seasonIdParamSchema },
  responses: {
    "200": {
      description: "Season found",
      content: {
        "application/json": {
          schema: successResponseSchema(seasonSchema, {
            messageExample: messages.success.season.found,
          }),
        },
      },
    },
    "404": {
      description: "Season not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.season.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/seasons",
  tags: ["Season"],
  summary: "Create a season (ADMIN only)",
  request: {
    body: {
      content: { "application/json": { schema: createSeasonSchema } },
    },
  },
  responses: {
    "201": {
      description: "Season created",
      content: {
        "application/json": {
          schema: successResponseSchema(seasonSchema, {
            statusCode: 201,
            messageExample: messages.success.season.created,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Requires the ADMIN role",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/seasons/{seasonId}",
  tags: ["Season"],
  summary: "Update a season (ADMIN only)",
  request: {
    params: seasonIdParamSchema,
    body: {
      content: { "application/json": { schema: updateSeasonSchema } },
    },
  },
  responses: {
    "200": {
      description: "Season updated",
      content: {
        "application/json": {
          schema: successResponseSchema(seasonSchema, {
            messageExample: messages.success.season.updated,
          }),
        },
      },
    },
    "404": {
      description: "Season not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.season.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/seasons/{seasonId}",
  tags: ["Season"],
  summary: "Delete a season (ADMIN only)",
  request: { params: seasonIdParamSchema },
  responses: {
    "200": {
      description: "Season deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.season.deleted,
          }),
        },
      },
    },
    "404": {
      description: "Season not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.season.notFound),
        },
      },
    },
    "409": {
      description:
        "Season still has dependent records (e.g. team rosters) and can't be deleted",
      content: {
        "application/json": {
          schema: errorResponseSchema(409, messages.error.season.hasDependents),
        },
      },
    },
  },
});
