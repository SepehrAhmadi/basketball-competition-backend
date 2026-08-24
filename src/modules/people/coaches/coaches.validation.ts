// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";
import { messages } from "../../../language/message.ts";

export const coachDegreeEnum = z.enum([
  "LEVEL_1",
  "LEVEL_2",
  "LEVEL_3",
  "NATIONAL",
]);

export const upsertCoachSchema = z.object({
  firstName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Reza" }),
  lastName: z
    .string()
    .min(1, messages.error.auth.fullNameRequired)
    .openapi({ example: "Karimi" }),
  nationalId: z
    .string()
    .min(10)
    .max(10)
    .optional()
    .openapi({ example: "0023456789" }),
  degree: coachDegreeEnum.openapi({ example: "LEVEL_1" }),
});

export default { upsertCoachSchema };
