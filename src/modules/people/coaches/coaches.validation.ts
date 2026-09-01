// Must run before any schema below calls .openapi() — this file is imported
// directly by route files, which can bypass server.ts (e.g. tests).
import "../../../swagger/zod-extend.ts";
import { z } from "zod";

export const coachDegreeEnum = z.enum([
  "LEVEL_1",
  "LEVEL_2",
  "LEVEL_3",
  "NATIONAL",
]);

export const upsertCoachSchema = z.object({
  degree: coachDegreeEnum.openapi({ example: "LEVEL_1" }),
});

export default { upsertCoachSchema };
