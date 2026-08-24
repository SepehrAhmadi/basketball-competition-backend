// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";

export const upsertPlayerSchema = z.object({
  firstName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Ali" }),
  lastName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Rezaei" }),
  birthDate: z.coerce.date().optional().openapi({ example: "2001-05-04" }),
  nationalId: z
    .string()
    .min(10)
    .max(10)
    .optional()
    .openapi({ example: "0012345678" }),
  height: z.number().positive().optional().openapi({ example: 190.5 }),
  position: z.string().optional().openapi({ example: "SG" }),
  photoUrl: z.string().optional().openapi({
    description: "Optional profile photo URL",
    example: "/uploads/photos/player-1.png",
  }),
});

export default { upsertPlayerSchema };
