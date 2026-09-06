import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import AppError from "../utils/appError.ts";
import { messages } from "../language/message.ts";

const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ statusCode: err.statusCode, message: err.message });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? messages.error.upload.largeFile
        : err.message;
    return res.status(400).json({ statusCode: 400, message });
  }

  res
    .status(500)
    .json({ statusCode: 500, message: err.message || "Internal Server Error" });
};

export default errorHandler;
