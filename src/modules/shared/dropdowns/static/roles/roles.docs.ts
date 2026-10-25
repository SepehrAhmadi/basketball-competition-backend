import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

// ---- response models ----
const assignableRoleEnum = z
  .enum(["COACH", "PLAYER", "REFEREE"])
  .openapi("AssignableRole");

const roleItemSchema = z
  .object({
    value: assignableRoleEnum,
    label: z.string().openapi({ example: "مربی" }),
  })
  .openapi("RoleItem");

const rolesDataSchema = z.object({
  roles: z.array(roleItemSchema),
});

// ---- path registration ----
registry.registerPath({
  method: "get",
  path: "/dropdown/roles",
  tags: ["Dropdowns"],
  summary: "Get all assignable system roles with Persian labels",
  description:
    "Returns the list of domain roles, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of assignable roles",
      content: {
        "application/json": {
          schema: successResponseSchema(rolesDataSchema, {
            messageExample: messages.success.roles.fetched,
          }),
        },
      },
    },
  },
});
