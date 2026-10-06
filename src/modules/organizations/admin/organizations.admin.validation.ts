// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";

// Admin endpoints accept JSON bodies (no file upload).
// Logos are managed by the organization manager, not by admin.
const adminStatusField = z
  .enum(["ACTIVE", "INACTIVE"])
  .optional()
  .openapi({ example: "ACTIVE" });

const managerIdField = z
  .number({ invalid_type_error: "The value must be a number" })
  .int()
  .positive()
  .openapi({ example: 5, description: "Id of an ACTIVE user who becomes the manager" });

export const adminCreateOrganizationSchema = z
  .object({
    name: z
      .string()
      .min(2, messages.error.organization.nameRequired)
      .openapi({ example: "Tehran Titans" }),
    description: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    email: z
      .string()
      .email(messages.error.auth.invalidEmail)
      .optional()
      .openapi({ example: "info@titans.ir" }),
    managerId: managerIdField,
    status: z
      .enum(["ACTIVE", "INACTIVE"])
      .default("ACTIVE")
      .openapi({ example: "ACTIVE" }),
  })
  .strict();

export const adminUpdateOrganizationSchema = z
  .object({
    name: z
      .string()
      .min(2, messages.error.organization.nameRequired)
      .optional()
      .openapi({ example: "Tehran Titans" }),
    description: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    email: z
      .string()
      .email(messages.error.auth.invalidEmail)
      .optional()
      .openapi({ example: "info@titans.ir" }),
    managerId: managerIdField.optional(),
    status: adminStatusField,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const adminOrganizationListQuerySchema = paginationQuerySchema.extend({
  search: z
    .string()
    .optional()
    .openapi({ example: "Titans", description: "Search in name, city, email, phone" }),
  status: z
    .enum(["ACTIVE", "INACTIVE", "DELETED", "ALL"])
    .optional()
    .openapi({
      example: "ACTIVE",
      description:
        "Filter by status. Omit to exclude DELETED; ALL includes every status.",
    }),
});

export default {
  adminCreateOrganizationSchema,
  adminUpdateOrganizationSchema,
  adminOrganizationListQuerySchema,
};
