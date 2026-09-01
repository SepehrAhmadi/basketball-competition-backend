// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";

export const upsertRefereeSchema = z.object({
  licenseLevel: z.string().optional().openapi({
    description: "Refereeing license level",
    example: "INTERNATIONAL",
  }),
});

export default { upsertRefereeSchema };
