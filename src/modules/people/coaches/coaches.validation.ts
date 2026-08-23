import { z } from "zod";
import { messages } from "../../../language/message.ts";

const upsertCoachSchema = z.object({
  firstName: z.string().min(1, messages.error.auth.fullNameRequired),
  lastName: z.string().min(1, messages.error.auth.fullNameRequired),
  nationalId: z.string().min(10).max(10).optional(),
  phone: z.string().optional(),
  degree: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "NATIONAL"]),
});

export default { upsertCoachSchema };
