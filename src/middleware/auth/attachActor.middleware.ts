import type { Request, Response, NextFunction } from "express";
import { guestActor, loadActor } from "../../authz/actor.ts";

export const attachActor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userId == null) {
      req.actor = guestActor;
      return next();
    }
    req.actor = await loadActor(req.userId, req.adminLevel ?? null);
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalActor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.actor = req.userId != null ? await loadActor(req.userId, req.adminLevel ?? null) : guestActor;
    next();
  } catch (err) {
    next(err);
  }
};

export default attachActor;
