import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: "The value must be a number" })
    .int()
    .positive(),
});

module.exports = { idParamSchema };
