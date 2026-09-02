import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.ts";

import "../modules/people/auth/auth.docs.ts";
import "../modules/people/players/players.docs.ts";
import "../modules/people/coaches/coaches.docs.ts";
import "../modules/people/referees/referees.docs.ts";
import "../modules/competition/organizations/organizations.docs.ts";
import "../modules/shared/roles/roles.docs.ts";
import "../modules/shared/coach-degrees/coach-degrees.docs.ts";

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Basketball League API",
    version: "1.0.0",
    description: "NSL / Academy / Super League competition management API",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
});
