import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../../language/message.ts";
import apiResponse from "../../../../utils/apiResponse.ts";
import gamesAdminService from "./games.admin.service.ts";
import type { GamesListQuery } from "../lib/games.queries.ts";
import type { ResultInput } from "../lib/games.rules.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validatedQuery as GamesListQuery;
    const data = await gamesAdminService.listGames(
      Number(req.params.leagueId),
      query,
    );
    return apiResponse.sendResponse(res, 200, messages.success.game.list, data);
  } catch (error) {
    next(error);
  }
}

async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await gamesAdminService.getGame(
      Number(req.params.leagueId),
      Number(req.params.gameId),
    );
    return apiResponse.sendResponse(res, 200, messages.success.game.found, data);
  } catch (error) {
    next(error);
  }
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      homeLeagueTeamId: number;
      awayLeagueTeamId: number;
      scheduledDate?: string | null;
      scheduledTime?: string | null;
      rescheduledFromGameId?: number | null;
    };
    const data = await gamesAdminService.createGame(
      Number(req.params.leagueId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      201,
      messages.success.game.created,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function updateSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      scheduledDate?: string | null;
      scheduledTime?: string | null;
    };
    const data = await gamesAdminService.updateSchedule(
      Number(req.params.leagueId),
      Number(req.params.gameId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.game.updated,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as {
      status: "LIVE" | "CANCELED";
      cancelReason?: string | null;
    };
    const data = await gamesAdminService.updateStatus(
      Number(req.params.leagueId),
      Number(req.params.gameId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.game.statusUpdated,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function enterResult(req: Request, res: Response, next: NextFunction) {
  try {
    const input = (req.validatedBody ?? req.body) as ResultInput;
    const data = await gamesAdminService.enterResult(
      Number(req.params.leagueId),
      Number(req.params.gameId),
      input,
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.game.resultSaved,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function clearResult(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await gamesAdminService.clearResult(
      Number(req.params.leagueId),
      Number(req.params.gameId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.game.resultCleared,
      data,
    );
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await gamesAdminService.deleteGame(
      Number(req.params.leagueId),
      Number(req.params.gameId),
    );
    return apiResponse.sendResponse(
      res,
      200,
      messages.success.game.deleted,
      data,
    );
  } catch (error) {
    next(error);
  }
}

export default {
  list,
  get,
  create,
  updateSchedule,
  updateStatus,
  enterResult,
  clearResult,
  remove,
};
