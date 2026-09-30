import type { AdminLevel, Role } from "../../prisma/generated/prisma/enums.ts";
import type { Request } from "express";
import type { Actor } from "../../authz/actor.ts";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      roles?: Role[];
      adminLevel?: AdminLevel | null;
      permissions?: string[];
      actor?: Actor;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
      validatedParams?: unknown;
      validatedBody?: unknown;
    }
  }
}
export {};
