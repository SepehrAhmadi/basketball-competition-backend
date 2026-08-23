import { z } from "zod";
import { messages } from "../../../language/message.ts";

const createOrganizationSchema = z.object({
  name: z.string().min(2, messages.error.organization.nameRequired),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email(messages.error.auth.invalidEmail).optional(),
});

const updateOrganizationSchema = createOrganizationSchema.partial();

export default { createOrganizationSchema, updateOrganizationSchema };
