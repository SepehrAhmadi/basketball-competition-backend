// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";

// Multipart note: multer parses text fields into req.body (all strings) and the
// logo file into req.file. File validation belongs to Multer — logoUrl is
// server-generated and therefore never accepted from the client.
export const createOrganizationSchema = z.object({
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
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const organizationListQuerySchema = paginationQuerySchema.extend({});

export default {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationListQuerySchema,
};
