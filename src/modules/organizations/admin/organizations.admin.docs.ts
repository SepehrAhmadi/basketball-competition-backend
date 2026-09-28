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
} from "../../../shared/schemas.validation.ts";
import { adminOrganizationListQuerySchema } from "./organizations.admin.validation.ts";
import { organizationSchema } from "../organizations.docs.ts";

const adminCreateOrganizationRequestSchema = z
  .object({
    name: z.string().openapi({ example: "Tehran Titans" }),
    description: z.string().optional().openapi({ example: "Professional basketball club" }),
    city: z.string().optional().openapi({ example: "Tehran" }),
    phone: z.string().optional().openapi({ example: "02112345678" }),
    email: z.string().email().optional().openapi({ example: "info@titans.ir" }),
    managerId: z.number().openapi({ example: 5, description: "User id with ORG_MANAGER role" }),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().openapi({ example: "ACTIVE" }),
  })
  .openapi("AdminCreateOrganizationRequest");

const adminUpdateOrganizationRequestSchema = z
  .object({
    name: z.string().optional().openapi({ example: "Tehran Titans" }),
    description: z.string().optional().openapi({ example: "Professional basketball club" }),
    city: z.string().optional().openapi({ example: "Tehran" }),
    phone: z.string().optional().openapi({ example: "02112345678" }),
    email: z.string().email().optional().openapi({ example: "info@titans.ir" }),
    managerId: z
      .number()
      .optional()
      .openapi({ example: 5, description: "Replaces the current manager" }),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().openapi({ example: "INACTIVE" }),
  })
  .openapi("AdminUpdateOrganizationRequest");

const adminManagerSchema = z
  .object({
    id: z.number().openapi({ example: 5 }),
    fullName: z.string().openapi({ example: "Ali Rezaei" }),
    phone: z.string().openapi({ example: "09121234567" }),
    email: z.string().openapi({ example: "ali@example.com" }),
  })
  .nullable()
  .openapi("AdminOrganizationManager");

const adminOrganizationSchema = organizationSchema
  .extend({
    manager: adminManagerSchema.optional(),
    teamsCount: z.number().optional().openapi({ example: 3 }),
  })
  .openapi("AdminOrganization");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");
const notFoundError = () => errorResponseSchema(404, messages.error.organization.notFound);

registry.registerPath({
  method: "get",
  path: "/admin/organizations",
  tags: ["Admin - Organizations"],
  summary: "List organizations (admin)",
  description:
    "Paginated admin list with search (name, city, email, phone) and status filter. Omit status to exclude DELETED; use ALL to include every status.",
  request: { query: adminOrganizationListQuerySchema },
  responses: {
    "200": {
      description: "Paginated list of organizations",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(adminOrganizationSchema), {
            messageExample: messages.success.organization.list,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/organizations/{id}",
  tags: ["Admin - Organizations"],
  summary: "Get an organization by id (admin)",
  description: "Returns the organization with its current manager and teams count.",
  request: { params: idParamSchema },
  responses: {
    "200": {
      description: "Organization found",
      content: {
        "application/json": {
          schema: successResponseSchema(adminOrganizationSchema, {
            messageExample: messages.success.organization.found,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.view permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Organization not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/organizations",
  tags: ["Admin - Organizations"],
  summary: "Create an organization (admin)",
  description:
    "Creates an organization with an admin-selected manager (must already have the ORG_MANAGER role) and an ACTIVE/INACTIVE status. JSON body. Logos are managed by the organization manager, not admin.",
  request: {
    body: {
      content: { "application/json": { schema: adminCreateOrganizationRequestSchema } },
    },
  },
  responses: {
    "201": {
      description: "Organization created",
      content: {
        "application/json": {
          schema: successResponseSchema(adminOrganizationSchema, {
            statusCode: 201,
            messageExample: messages.success.organization.created,
          }),
        },
      },
    },
    "400": {
      description: "Validation error or manager without ORG_MANAGER role",
      content: {
        "application/json": {
          schema: errorResponseSchema(400, messages.error.organization.managerMissingRole),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.create permission",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/admin/organizations/{id}",
  tags: ["Admin - Organizations"],
  summary: "Update an organization (admin)",
  description:
    "Partial update. managerId replaces the current manager (single-manager semantics). status toggles ACTIVE/INACTIVE. JSON body.",
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: adminUpdateOrganizationRequestSchema } },
    },
  },
  responses: {
    "200": {
      description: "Organization updated",
      content: {
        "application/json": {
          schema: successResponseSchema(adminOrganizationSchema, {
            messageExample: messages.success.organization.updated,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.update permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Organization not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/organizations/{id}",
  tags: ["Admin - Organizations"],
  summary: "Delete an organization (admin)",
  description: "Soft-delete: sets status to DELETED.",
  request: { params: idParamSchema },
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
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.delete permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Organization not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/organizations/{id}/restore",
  tags: ["Admin - Organizations"],
  summary: "Restore a deleted organization (admin)",
  description: "Restores a DELETED organization back to ACTIVE.",
  request: { params: idParamSchema },
  responses: {
    "200": {
      description: "Organization restored",
      content: {
        "application/json": {
          schema: successResponseSchema(adminOrganizationSchema, {
            messageExample: messages.success.organization.restored,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Missing organizations.restore permission",
      content: { "application/json": { schema: forbiddenError } },
    },
    "404": {
      description: "Organization not found",
      content: { "application/json": { schema: notFoundError() } },
    },
  },
});
