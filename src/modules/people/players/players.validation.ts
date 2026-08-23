import { z } from "zod";
import { messages } from "../../../language/message.ts";

const upsertPlayerSchema = z.object({
  firstName: z.string().min(1, messages.error.auth.fullNameRequired),
  lastName: z.string().min(1, messages.error.auth.fullNameRequired),
  birthDate: z.coerce.date().optional(),
  nationalId: z.string().min(10).max(10).optional(),
  height: z.number().positive().optional(),
  position: z.string().optional(),
});

export default { upsertPlayerSchema };
