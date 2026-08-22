import type { Response } from "express";

function sendResponse(
  res: Response,
  statusCode: number,
  message: string,
  data: any = null,
) {
  return res.status(statusCode).json({ statusCode, message, data });
}

export default { sendResponse };
