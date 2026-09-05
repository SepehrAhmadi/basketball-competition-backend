import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import AppError from "../utils/appError.ts";

type ValidationSource = "body" | "params" | "query";

const validate = (
  schema: ZodType,
  source: ValidationSource = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const firstIssue = result.error.errors[0];

      return next(
        new AppError(
          400,
          `${firstIssue.path.join(".")}: ${firstIssue.message}`,
        ),
      );
    }

    switch (source) {
      case "query":
        req.validatedQuery = result.data;
        break;

      case "params":
        req.validatedParams = result.data;
        break;

      case "body":
        req.validatedBody = result.data;
        break;
    }

    next();
  };
};

export default validate;