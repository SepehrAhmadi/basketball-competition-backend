import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";

const validate =
  (schema: any) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.errors[0];
      return next(
        new AppError(
          400,
          `${firstIssue.path.join(".")} filed is required or invalid`,
        ),
      );
    }
    req.body = result.data;
    next();
  };

module.exports = validate;
