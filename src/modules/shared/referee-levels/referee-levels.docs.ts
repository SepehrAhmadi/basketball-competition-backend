import { z } from "zod";
import { registry } from "../../../swagger/registry.ts";
import {
  successResponseSchema,
  errorResponseSchema,
} from "../../../swagger/helpers.ts";
import { messages } from "../../../language/message.ts";

// ---- response models ----
const refereeLevelEnum = z
  .enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "NATIONAL"])
  .openapi("RefereeLevelValue");

const levelItemSchema = z
  .object({
    value: refereeLevelEnum,
    label: z.string().openapi({ example: "درجه ۱" }),
  })
  .openapi("RefereeLevelItem");

const refereeLevelsDataSchema = z.object({
  levels: z.array(levelItemSchema),
});

// ---- path registration ----
registry.registerPath({
  method: "get",
  path: "/referee-levels",
  tags: ["Referee Levels"],
  summary: "Get all referee levels with Persian labels",
  description:
    "Returns the list of referee level values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [{ bearerAuth: [] }],
  responses: {
    "200": {
      description: "List of referee levels",
      content: {
        "application/json": {
          schema: successResponseSchema(refereeLevelsDataSchema, {
            messageExample: messages.success.refereeLevels.fetched,
          }),
        },
      },
    },
    "401": {
      description: "Missing or invalid access token",
      content: {
        "application/json": {
          schema: errorResponseSchema(401, "Unauthorized"),
        },
      },
    },
  },
});
