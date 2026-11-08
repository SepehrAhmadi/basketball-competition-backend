import { z } from "zod";
import { registry } from "../../../../../swagger/registry.ts";
import { successResponseSchema } from "../../../../../swagger/helpers.ts";
import { messages } from "../../../../../language/message.ts";

const gameStatusEnum = z
  .enum(["SCHEDULED", "LIVE", "FINISHED", "CANCELED"])
  .openapi("GameStatusValue");

const statusItemSchema = z
  .object({
    value: gameStatusEnum,
    label: z.string().openapi({ example: "برنامه‌ریزی‌شده" }),
  })
  .openapi("GameStatusItem");

const gameStatusesDataSchema = z.object({
  statuses: z.array(statusItemSchema),
});

registry.registerPath({
  method: "get",
  path: "/dropdown/game-statuses",
  tags: ["Dropdowns"],
  summary: "Get all game statuses with Persian labels",
  description:
    "Returns the list of game status values, each with its enum value and a Persian display label. Intended for dropdown / reference-data usage on the admin panel and PWA.",
  security: [],
  responses: {
    "200": {
      description: "List of game statuses",
      content: {
        "application/json": {
          schema: successResponseSchema(gameStatusesDataSchema, {
            messageExample: messages.success.gameStatuses.fetched,
          }),
        },
      },
    },
  },
});
