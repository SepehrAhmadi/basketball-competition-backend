import { z } from "zod";
import { messages } from "../../../language/message.ts";

const upsertRefereeSchema = z.object({
  firstName: z.string().min(1, messages.error.auth.fullNameRequired),
  lastName: z.string().min(1, messages.error.auth.fullNameRequired),
  nationalId: z.string().min(10).max(10).optional(),
  phone: z.string().optional(),
  licenseLevel: z.string().optional(),
});

export default { upsertRefereeSchema };
