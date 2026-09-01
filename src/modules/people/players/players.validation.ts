// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";

export const upsertPlayerSchema = z.object({
  height: z.number().positive().optional().openapi({ example: 190.5 }),
  position: z.string().optional().openapi({ example: "SG" }),
  photoUrl: z.string().optional().openapi({
    description: "Optional profile photo URL",
    example: "/uploads/photos/player-1.png",
  }),
});

export default { upsertPlayerSchema };
