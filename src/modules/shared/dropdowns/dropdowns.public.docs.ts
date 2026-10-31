// Must run before any schema below calls .openapi().
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { registry } from "../../../swagger/registry.ts";
import {
  successResponseSchema,
  errorResponseSchema,
} from "../../../swagger/helpers.ts";
import { paginatedResponseSchema } from "../../../shared/schemas.validation.ts";
import { messages } from "../../../language/message.ts";
import { dropdownSearchQuerySchema } from "./dropdowns.validation.ts";

const publicSeasonDropdownItemSchema = z
  .object({
    value: z.number().openapi({ example: 1 }),
    label: z.string().openapi({ example: "Season 1403" }),
    isActive: z.boolean().openapi({ example: true }),
  })
  .openapi("PublicSeasonDropdownItem");

const publicAgeCategoryDropdownItemSchema = z
  .object({
    value: z.number().openapi({ example: 1 }),
    label: z.string().openapi({ example: "U16" }),
  })
  .openapi("PublicAgeCategoryDropdownItem");

const badQueryError = errorResponseSchema(400, "pageSize: Too big");

registry.registerPath({
  method: "get",
  path: "/dropdown/seasons",
  tags: ["Dropdowns"],
  summary: "Season options (public)",
  description:
    "Searchable id/label list of seasons, active first. Public read-only mirror of the authenticated season dropdown.",
  security: [],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Season options",
      content: {
        "application/json": {
          schema: successResponseSchema(
            paginatedResponseSchema(publicSeasonDropdownItemSchema),
            { messageExample: messages.success.dropdown.fetched },
          ),
        },
      },
    },
    "400": {
      description: "Invalid query",
      content: { "application/json": { schema: badQueryError } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/dropdown/age-categories",
  tags: ["Dropdowns"],
  summary: "Age category options (public)",
  description:
    "Searchable id/label list of age categories, creation order. Public read-only mirror of the authenticated age-category dropdown.",
  security: [],
  request: { query: dropdownSearchQuerySchema },
  responses: {
    "200": {
      description: "Age category options",
      content: {
        "application/json": {
          schema: successResponseSchema(
            paginatedResponseSchema(publicAgeCategoryDropdownItemSchema),
            { messageExample: messages.success.dropdown.fetched },
          ),
        },
      },
    },
    "400": {
      description: "Invalid query",
      content: { "application/json": { schema: badQueryError } },
    },
  },
});
