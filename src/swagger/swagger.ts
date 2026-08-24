import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.ts";

// Side-effect imports — each module's *.docs.ts calls
// registry.registerPath() for every route it owns. The request/input schemas
// live in the sibling *.validation.ts files and are imported from there.
//
// MAINTENANCE RULE: whenever a new module is added, its *.docs.ts file
// MUST be added to this list, otherwise none of its endpoints appear in /docs.
import "../modules/people/auth/auth.docs.ts";
import "../modules/people/players/players.docs.ts";
import "../modules/people/coaches/coaches.docs.ts";
import "../modules/people/referees/referees.docs.ts";
import "../modules/competition/organizations/organizations.docs.ts";

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
