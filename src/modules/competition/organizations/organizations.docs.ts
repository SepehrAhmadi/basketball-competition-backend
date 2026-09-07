import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { registry } from "../../../swagger/registry.ts";
import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../swagger/helpers.ts";
import {
  idParamSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
} from "../../../shared/schemas.validation.ts";
import { organizationListQuerySchema } from "./organizations.validation.ts";

const organizationLogoField = z.string().openapi({
  description: "Organization logo image (JPEG/PNG/WEBP, max 2MB)",
  type: "string",
  format: "binary",
});

const createOrganizationRequestSchema = z
  .object({
    name: z.string().openapi({ example: "Tehran Titans" }),
    description: z.string().optional().openapi({ example: "Professional basketball club" }),
    city: z.string().optional().openapi({ example: "Tehran" }),
    phone: z.string().optional().openapi({ example: "02112345678" }),
    email: z.string().email().optional().openapi({ example: "info@titans.ir" }),
    logo: organizationLogoField.optional(),
  })
  .openapi("CreateOrganizationRequest");

const updateOrganizationRequestSchema = z
  .object({
    name: z.string().optional().openapi({ example: "Tehran Titans" }),
    description: z.string().optional().openapi({ example: "Professional basketball club" }),
    city: z.string().optional().openapi({ example: "Tehran" }),
    phone: z.string().optional().openapi({ example: "02112345678" }),
    email: z.string().email().optional().openapi({ example: "info@titans.ir" }),
    logo: organizationLogoField.optional(),
  })
  .openapi("UpdateOrganizationRequest");

export const organizationSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Tehran Titans" }),
    logoUrl: z
      .string()
      .nullable()
      .openapi({ example: "/uploads/organizations/org-1.png" }),
    description: z
      .string()
      .nullable()
      .openapi({ example: "Professional basketball club" }),
    city: z.string().nullable().openapi({ example: "Tehran" }),
    phone: z.string().nullable().openapi({ example: "02112345678" }),
    email: z.string().email().nullable().openapi({ example: "info@titans.ir" }),
    status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).openapi({ example: "ACTIVE" }),
    createdAt: z.date().openapi({ example: "2026-01-01T10:00:00.000Z" }),
  })
  .openapi("Organization");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(
  403,
  messages.error.organization.notAuthorized,
);
const notFoundError = () =>
  errorResponseSchema(404, messages.error.organization.notFound);

registry.registerPath({
  method: "get",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "List organizations",
  description:
    "Paginated list. ADMINs see all organizations; other users only see organizations they manage.",
  request: {
    query: organizationListQuerySchema,
  },
  responses: {
    "200": {
      description: "Paginated list of organizations",
      content: {
        "application/json": {
          schema: successResponseSchema(
            paginatedResponseSchema(organizationSchema),
            { messageExample: messages.success.organization.list },
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
  },
});

registry.registerPath({
  method: "get",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Get an organization by id",
  description:
    "ADMINs can fetch any organization; other users only organizations they manage.",
  request: {
    params: idParamSchema,
  },
  responses: {
    "200": {
      description: "Organization found",
      content: {
        "application/json": {
          schema: successResponseSchema(organizationSchema, {
            messageExample: messages.success.organization.found,
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
      description: "Not a manager of this organization",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Organization not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "Create an organization",
  description:
    "Creates an organization and makes the authenticated user its first manager. Requires ORG_MANAGER or ADMIN. Accepts multipart/form-data with organization fields plus an optional logo image file field named `logo`. If no logo is sent, logoUrl stays null.",
  request: {
    body: {
      content: { "multipart/form-data": { schema: createOrganizationRequestSchema } },
    },
  },
  responses: {
    "201": {
      description: "Organization created",
      content: {
        "application/json": {
          schema: successResponseSchema(organizationSchema, {
            statusCode: 201,
            messageExample: messages.success.organization.created,
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
            `name: ${messages.error.organization.nameRequired}`,
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
        "application/json": { schema: errorResponseSchema(403, "Forbidden") },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Update an organization",
  description:
    "Partial update — send only the fields to change. Requires ORG_MANAGER or ADMIN. Accepts multipart/form-data with organization fields plus an optional logo image file field named `logo`. If no logo is sent, the existing logo remains unchanged.",
  request: {
    params: idParamSchema,
    body: {
      content: { "multipart/form-data": { schema: updateOrganizationRequestSchema } },
    },
  },
  responses: {
    "200": {
      description: "Organization updated",
      content: {
        "application/json": {
          schema: successResponseSchema(organizationSchema, {
            messageExample: messages.success.organization.updated,
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
            `name: ${messages.error.organization.nameRequired}`,
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
      description: "Not a manager of this organization",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Organization not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Delete an organization",
  description: "Requires ORG_MANAGER or ADMIN.",
  request: {
    params: idParamSchema,
  },
  responses: {
    "200": {
      description: "Organization deleted",
      content: {
        "application/json": {
          schema: successResponseSchema(z.null(), {
            messageExample: messages.success.organization.deleted,
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
      description: "Not a manager of this organization",
      content: {
        "application/json": { schema: forbiddenError },
      },
    },
    "404": {
      description: "Organization not found",
      content: {
        "application/json": { schema: notFoundError() },
      },
    },
  },
});
