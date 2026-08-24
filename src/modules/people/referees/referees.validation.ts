// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";

export const upsertRefereeSchema = z.object({
  firstName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Hossein" }),
  lastName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Ahmadi" }),
  nationalId: z
    .string()
    .min(10)
    .max(10)
    .optional()
    .openapi({ example: "0034567890" }),
  licenseLevel: z.string().optional().openapi({
    description: "Refereeing license level",
    example: "INTERNATIONAL",
  }),
});

export default { upsertRefereeSchema };
