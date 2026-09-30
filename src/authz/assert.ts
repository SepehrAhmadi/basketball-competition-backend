import AppError from "../utils/appError.ts";

export function assertAllowed(allowed: boolean, message: string): asserts allowed {
  if (!allowed) {
    throw new AppError(403, message);
  }
}

export default assertAllowed;
