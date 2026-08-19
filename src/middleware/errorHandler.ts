import type { Request, Response, NextFunction } from "express";
import type AppError from "../utils/appError";

function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Server Error";
  res.status(statusCode).json({ statusCode, message });
}

export default errorHandler;
