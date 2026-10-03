import { z } from "zod";
import { messages } from "../../../../language/message.ts";
import { registry } from "../../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../../shared/schemas.validation.ts";
import {
  ageCategoryIdParamSchema,
  createAgeCategorySchema,
  updateAgeCategorySchema,
  ageCategoryListQuerySchema,
} from "./age-categories.admin.validation.ts";

export const ageCategorySchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "نوجوانان" }),
    cutoffsCount: z.number().optional().openapi({ example: 2 }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
    updatedAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("AgeCategory");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const badRequestError = errorResponseSchema(400, "Bad Request");
const conflictError = (message: string) => errorResponseSchema(409, message);

registry.registerPath({
  method: "get",
  path: "/admin/age-categories",
  tags: ["Admin - Age Categories"],
  summary: "List age categories (admin)",
  request: { query: ageCategoryListQuerySchema },
  responses: {
    "200": {
      description: "Paginated list of age categories",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(ageCategorySchema), {
            messageExample: messages.success.ageCategory.list,
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
  path: "/admin/age-categories/{ageCategoryId}",
  tags: ["Admin - Age Categories"],
  summary: "Get an age category by id (admin)",
  request: { params: ageCategoryIdParamSchema },
  responses: {
    "200": {
      description: "Age category found",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategorySchema, {
            messageExample: messages.success.ageCategory.found,
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
      description: "Age category not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategory.notFound),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/age-categories",
  tags: ["Admin - Age Categories"],
  summary: "Create an age category (admin)",
  request: {
    body: { content: { "application/json": { schema: createAgeCategorySchema } } },
  },
  responses: {
    "201": {
      description: "Age category created",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategorySchema, {
            statusCode: 201,
            messageExample: messages.success.ageCategory.created,
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
    "409": {
      description: "Duplicate age category name",
      content: {
        "application/json": {
          schema: conflictError(messages.error.ageCategory.nameExists),
        },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/age-categories/{ageCategoryId}",
  tags: ["Admin - Age Categories"],
  summary: "Update an age category (admin)",
  request: {
    params: ageCategoryIdParamSchema,
    body: { content: { "application/json": { schema: updateAgeCategorySchema } } },
  },
  responses: {
    "200": {
      description: "Age category updated",
      content: {
        "application/json": {
          schema: successResponseSchema(ageCategorySchema, {
            messageExample: messages.success.ageCategory.updated,
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
      description: "Age category not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategory.notFound),
        },
      },
    },
    "409": {
      description: "Duplicate age category name",
      content: {
        "application/json": {
          schema: conflictError(messages.error.ageCategory.nameExists),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/age-categories/{ageCategoryId}",
  tags: ["Admin - Age Categories"],
  summary: "Delete an age category (admin)",
  request: { params: ageCategoryIdParamSchema },
  responses: {
    "200": {
      description: "Age category deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.ageCategory.deleted,
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
      description: "Age category not found",
      content: {
        "application/json": {
          schema: errorResponseSchema(404, messages.error.ageCategory.notFound),
        },
      },
    },
    "409": {
      description: "Age category has cutoffs",
      content: {
        "application/json": {
          schema: conflictError(messages.error.ageCategory.inUse),
        },
      },
    },
  },
});
