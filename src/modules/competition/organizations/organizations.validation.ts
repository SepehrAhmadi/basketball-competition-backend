// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";
import { paginationQuerySchema } from "../../../shared/schemas.validation.ts";

// Multipart note: multer parses text fields into req.body (all strings) and the
// logo file into req.file. File validation belongs to Multer — logoUrl is
// server-generated and therefore never accepted from the client.
// removeLogo also arrives as a string ("true"/"false") and is coerced to
// boolean here — never use Boolean(value) directly since Boolean("false")
// is true.
const removeLogoField = z
  .preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean())
  .optional()
  .openapi({
    example: false,
    description:
      "Set to \"true\" to remove the existing logo when no new logo file is provided. A newly uploaded logo takes precedence.",
  });

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
  removeLogo: removeLogoField,
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const organizationListQuerySchema = paginationQuerySchema.extend({});

export default {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationListQuerySchema,
};
