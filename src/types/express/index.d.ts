import type { Role } from "../../prisma/generated/prisma/enums.ts";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      roles?: Role[];
    }
  }
}

export {};
