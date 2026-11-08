import type { Request, Response, NextFunction } from "express";
import { messages } from "../../../language/message.ts";
import apiResponse from "../../../utils/apiResponse.ts";
import gamesService from "./games.service.ts";
import type { GamesListQuery } from "./lib/games.queries.ts";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validatedQuery as GamesListQuery;
    const data = await gamesService.listPublicGames(
      Number(req.params.leagueId),
      query,
      req.actor!,
    );
    return apiResponse.sendResponse(res, 200, messages.success.game.list, data);
  } catch (error) {
    next(error);
  }
}

async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await gamesService.getPublicGame(
      Number(req.params.leagueId),
      Number(req.params.gameId),
      req.actor!,
    );
    return apiResponse.sendResponse(res, 200, messages.success.game.found, data);
  } catch (error) {
    next(error);
  }
}

export default { list, get };
