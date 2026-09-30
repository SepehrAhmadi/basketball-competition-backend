import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.ts";

import "../modules/people/auth/auth.docs.ts";
import "../modules/people/user/user.docs.ts";
import "../modules/people/user/admin/users.admin.docs.ts";
import "../modules/people/players/players.docs.ts";
import "../modules/people/coaches/coaches.docs.ts";
import "../modules/people/referees/referees.docs.ts";
import "../modules/organizations/organizations.docs.ts";
import "../modules/organizations/admin/organizations.admin.docs.ts";
import "../modules/teams/teams.docs.ts";
import "../modules/teams/admin/teams.admin.docs.ts";
import "../modules/seasons/seasons.docs.ts";
import "../modules/shared/roles/roles.docs.ts";
import "../modules/shared/dropdowns/dropdowns.docs.ts";
import "../modules/shared/coach-degrees/coach-degrees.docs.ts";
import "../modules/shared/referee-levels/referee-levels.docs.ts";

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Basketball Competition APP",
    version: "1.0.0",
    description: "Basketball competition management API",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
});
