import type { Role } from "../../prisma/generated/prisma/enums.ts";
import type { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      roles?: Role[];
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
