import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { registry } from "../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../../shared/schemas.validation.ts";
import {
  cutoffIdParamSchema,
  createCutoffSchema,
  updateCutoffSchema,
  cutoffListQuerySchema,
} from "./age-category-cutoffs.admin.validation.ts";

export const ageCategoryCutoffSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    ageCategoryId: z.number().openapi({ example: 1 }),
    seasonId: z.number().openapi({ example: 3 }),
    minBirthDate: z.string().openapi({
      example: "1390/10/11",
      description: "Jalali date in YYYY/MM/DD format",
    }),
    ageCategory: z
      .object({
        id: z.number().openapi({ example: 1 }),
        name: z.string().openapi({ example: "نوجوانان" }),
      })
      .optional(),
    season: z
      .object({
        id: z.number().openapi({ example: 3 }),
        name: z.string().openapi({ example: "1405-1406" }),
      })
      .optional(),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    updatedAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("AgeCategoryCutoff");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad Request");
const conflictError = (message: string) => errorResponseSchema(409, message);

registry.registerPath({
  method: "get",
  path: "/admin/age-category-cutoffs",
  tags: ["Admin - Age Category Cutoffs"],
  summary: "List age category cutoffs (admin)",
  description: "Newer seasons first (seasonId desc), then id asc.",
  request: { query: cutoffListQuerySchema },
  responses: {
    "200": {
      description: "Paginated list of cutoffs",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(ageCategoryCutoffSchema), {
            messageExample: messages.success.ageCategoryCutoff.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing age-categories.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/age-category-cutoffs/{cutoffId}",
  tags: ["Admin - Age Category Cutoffs"],
  summary: "Get an age category cutoff by id (admin)",
  request: { params: cutoffIdParamSchema },
  responses: {
    "200": {
      description: "Cutoff found",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategoryCutoffSchema, {
            messageExample: messages.success.ageCategoryCutoff.found,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing age-categories.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Cutoff not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategoryCutoff.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/age-category-cutoffs",
  tags: ["Admin - Age Category Cutoffs"],
  summary: "Create an age category cutoff (admin)",
  request: {
    body: { content: { "application/json": { schema: createCutoffSchema } } },
  },
  responses: {
    "201": {
      description: "Cutoff created",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategoryCutoffSchema, {
            statusCode: 201,
            messageExample: messages.success.ageCategoryCutoff.created,
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
      description: "Missing age-categories.create permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Age category or season not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategory.notFound),
        },
      },
    },
    "409": {
      description: "Cutoff already exists for this category and season",
      content: {
        "application/json": {
          schema: conflictError(messages.error.ageCategoryCutoff.alreadyExists),
        },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/age-category-cutoffs/{cutoffId}",
  tags: ["Admin - Age Category Cutoffs"],
  summary: "Update an age category cutoff (admin)",
  description: "Only minBirthDate can change; category and season are immutable.",
  request: {
    params: cutoffIdParamSchema,
    body: { content: { "application/json": { schema: updateCutoffSchema } } },
  },
  responses: {
    "200": {
      description: "Cutoff updated",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategoryCutoffSchema, {
            messageExample: messages.success.ageCategoryCutoff.updated,
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
      description: "Missing age-categories.update permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Cutoff not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategoryCutoff.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/age-category-cutoffs/{cutoffId}",
  tags: ["Admin - Age Category Cutoffs"],
  summary: "Delete an age category cutoff (admin)",
  request: { params: cutoffIdParamSchema },
  responses: {
    "200": {
      description: "Cutoff deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.ageCategoryCutoff.deleted,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing age-categories.delete permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Cutoff not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategoryCutoff.notFound),
        },
      },
    },
    "409": {
      description: "Cutoff has dependents",
      content: {
        "application/json": {
          schema: conflictError(messages.error.ageCategoryCutoff.inUse),
        },
      },
    },
  },
});
