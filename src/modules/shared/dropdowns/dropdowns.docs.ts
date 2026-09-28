import { z } from "zod";
import { registry } from "../../../swagger/registry.ts";
import {
  successResponseSchema,
  errorResponseSchema,
} from "../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../shared/schemas.validation.ts";
import { messages } from "../../../language/message.ts";
import {
  dropdownSearchQuerySchema,
  teamsDropdownQuerySchema,
  usersDropdownQuerySchema,
} from "./dropdowns.validation.ts";

const valueLabelItemSchema = z
  .object({
    value: z.string().openapi({ example: "ACTIVE" }),
    label: z.string().openapi({ example: "فعال" }),
  })
  .openapi("DropdownItem");

const idLabelItemSchema = z
  .object({
    value: z.number().openapi({ example: 1 }),
    label: z.string().openapi({ example: "Tehran Titans" }),
  })
  .openapi("IdDropdownItem");

const organizationDropdownItemSchema = idLabelItemSchema
  .extend({ status: z.string().openapi({ example: "ACTIVE" }) })
  .openapi("OrganizationDropdownItem");

const teamDropdownItemSchema = idLabelItemSchema
  .extend({ organizationId: z.number().openapi({ example: 1 }) })
  .openapi("TeamDropdownItem");

const seasonDropdownItemSchema = idLabelItemSchema
  .extend({ isActive: z.boolean().openapi({ example: true }) })
  .openapi("SeasonDropdownItem");

const userDropdownItemSchema = idLabelItemSchema
  .extend({ roles: z.array(z.string()).openapi({ example: ["ORG_MANAGER"] }) })
  .openapi("UserDropdownItem");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");

function registerStaticDropdown(path: string, summary: string, itemName: string) {
  registry.registerPath({
    method: "get",
    path,
    tags: ["Dropdowns"],
    summary,
    description: `${itemName} — static enum values with Persian labels. No hardcoded frontend values needed.`,
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: itemName,
        content: {
          "application/json": {
            schema: successResponseSchema(
              z.object({ items: z.array(valueLabelItemSchema) }),
              { messageExample: messages.success.dropdown.fetched },
            ),
          },
        },
      },
      "401": {
        description: "Missing or invalid access token",
        content: { "application/json": { schema: unauthorizedError } },
      },
    },
  });
}

registerStaticDropdown(
  "/dropdowns/organization-statuses",
  "Organization status options",
  "Organization statuses",
);
registerStaticDropdown("/dropdowns/team-statuses", "Team status options", "Team statuses");
registerStaticDropdown(
  "/dropdowns/team-member-roles",
  "Team member role options (roster filter)",
  "Team member roles",
);

registry.registerPath({
  method: "get",
  path: "/dropdowns/organizations",
  tags: ["Dropdowns"],
  summary: "Organization options",
  description: "Searchable id/label list of non-deleted organizations.",
  security: [{ bearerAuth: [] }],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Organization options",
      content: {
        "application/json": {
          schema: successResponseSchema(
            paginatedResponseSchema(organizationDropdownItemSchema),
            { messageExample: messages.success.dropdown.fetched },
          ),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdowns/teams",
  tags: ["Dropdowns"],
  summary: "Team options",
  description: "Searchable id/label list of non-deleted teams, optionally scoped by organizationId.",
  security: [{ bearerAuth: [] }],
  request: { query: teamsDropdownQuerySchema },
  responses: {
    "200": {
      description: "Team options",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(teamDropdownItemSchema), {
            messageExample: messages.success.dropdown.fetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdowns/seasons",
  tags: ["Dropdowns"],
  summary: "Season options",
  description: "Searchable id/label list of seasons, active first.",
  security: [{ bearerAuth: [] }],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Season options",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(seasonDropdownItemSchema), {
            messageExample: messages.success.dropdown.fetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdowns/manager-candidates",
  tags: ["Dropdowns"],
  summary: "Manager candidate options",
  description:
    "Searchable id/label list of ACTIVE users holding the ORG_MANAGER role, for the admin organization form.",
  security: [{ bearerAuth: [] }],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Manager candidates",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(idLabelItemSchema), {
            messageExample: messages.success.dropdown.fetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdowns/users",
  tags: ["Dropdowns"],
  summary: "User options",
  description:
    "Searchable id/label list of ACTIVE users. Optional role filter (e.g. ORG_MANAGER); omit role to return users with any role.",
  security: [{ bearerAuth: [] }],
  request: { query: usersDropdownQuerySchema },
  responses: {
    "200": {
      description: "User options",
      content: {
        "application/json": {
          schema: successResponseSchema(paginatedResponseSchema(userDropdownItemSchema), {
            messageExample: messages.success.dropdown.fetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
  },
});
