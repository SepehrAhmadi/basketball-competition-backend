import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

// ---- response models ----
const coachDegreeEnum = z
  .enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "NATIONAL"])
  .openapi("CoachDegreeValue");

const degreeItemSchema = z
  .object({
    value: coachDegreeEnum,
    label: z.string().openapi({ example: "درجه ۱" }),
  })
  .openapi("CoachDegreeItem");

const coachDegreesDataSchema = z.object({
  degrees: z.array(degreeItemSchema),
});

// ---- path registration ----
registry.registerPath({
  method: "get",
  path: "/dropdown/coach-degrees",
  tags: ["Dropdowns"],
  summary: "Get all coach degrees with Persian labels",
  description:
    "Returns the list of coach degree values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of coach degrees",
      content: {
        "application/json": {
          schema: successResponseSchema(coachDegreesDataSchema, {
            messageExample: messages.success.coachDegrees.fetched,
          }),
        },
      },
    },
  },
});
