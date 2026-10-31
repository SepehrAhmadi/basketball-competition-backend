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
  adminLeagueDropdownQuerySchema,
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
  .extend({ roles: z.array(z.string()).openapi({ example: ["COACH"] }) })
  .openapi("UserDropdownItem");

const leagueDropdownItemSchema = z
  .object({
    value: z.number().openapi({ example: 3 }),
    label: z
      .string()
      .openapi({ example: "لیگ برتر نوجوانان — فصل ۱۴۰۵ — نوجوانان" }),
    status: z
      .enum(["INACTIVE", "REGISTRATION", "ACTIVE", "FINISHED"])
      .openapi({ example: "REGISTRATION" }),
    seasonId: z.number().openapi({ example: 2 }),
    ageCategoryId: z.number().openapi({ example: 1 }),
  })
  .openapi("LeagueDropdownItem");

const unauthorizedError = errorResponseSchema(401, "Unauthorized");
const forbiddenError = errorResponseSchema(403, "Forbidden");

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
  path: "/dropdowns/age-categories",
  tags: ["Dropdowns"],
  summary: "Age category options",
  description: "Searchable id/label list of age categories, creation order.",
  security: [{ bearerAuth: [] }],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Age category options",
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
  path: "/dropdowns/admin/leagues",
  tags: ["Dropdowns"],
  summary: "League options (admin)",
  description:
    "Searchable id/label list of leagues for admin selectors. Returns every status, including INACTIVE drafts. Admin or super admin only.",
  security: [{ bearerAuth: [] }],
  request: { query: adminLeagueDropdownQuerySchema },
  responses: {
    "200": {
      description: "League options",
      content: {
        "application/json": {
          schema: successResponseSchema(
            paginatedResponseSchema(leagueDropdownItemSchema),
            { messageExample: messages.success.dropdown.fetched },
          ),
        },
      },
    },
    "400": {
      description: "Invalid query",
      content: {
        "application/json": {
          schema: errorResponseSchema(400, "pageSize: Too big"),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: { "application/json": { schema: unauthorizedError } },
    },
    "403": {
      description: "Caller is not an admin",
      content: { "application/json": { schema: forbiddenError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdowns/users",
  tags: ["Dropdowns"],
  summary: "User options",
  description:
    "Searchable id/label list of ACTIVE users. Optional role filter (e.g. COACH); omit role to return users with any role.",
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
