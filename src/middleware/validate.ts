// src/middleware/validate.ts
import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import AppError from "../utils/appError.ts";

type ValidationSource = "body" | "params" | "query";

const validate = (schema: ZodType, source: ValidationSource = "body") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const firstIssue = result.error.errors[0];
      return next(new AppError(400, `${firstIssue.path.join(".")}: ${firstIssue.message}`));
    }

    (req as any)[source] = result.data;
    next();
  };
};

export default validate;