import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import {
  loadCompetitionLeague,
  unwrap,
} from "../../lib/competition.access.ts";
import { isLeagueFinished } from "../../../leagues/lib/league.rules.ts";
import { gameInclude } from "./games.queries.ts";

export async function loadGame(leagueId: number, gameId: number) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, leagueId },
    include: gameInclude,
  });
  if (!game) throw new AppError(404, messages.error.game.notFound);
  return game;
}

export async function loadRescheduleSource(
  leagueId: number,
  rescheduledFromGameId: number,
  homeLeagueTeamId: number,
  awayLeagueTeamId: number,
) {
  const source = await prisma.game.findFirst({
    where: { id: rescheduledFromGameId, leagueId },
    select: {
      id: true,
      leagueId: true,
      status: true,
      homeLeagueTeamId: true,
      awayLeagueTeamId: true,
      rescheduledTo: { select: { id: true } },
    },
  });
  if (!source) throw new AppError(404, messages.error.game.notFound);
  const samePair =
    (source.homeLeagueTeamId === homeLeagueTeamId &&
      source.awayLeagueTeamId === awayLeagueTeamId) ||
    (source.homeLeagueTeamId === awayLeagueTeamId &&
      source.awayLeagueTeamId === homeLeagueTeamId);
  if (
    source.status !== "CANCELED" ||
    !samePair ||
    source.rescheduledTo !== null
  )
    throw new AppError(409, messages.error.game.rescheduleSourceInvalid);
  return source;
}

export async function loadGameWriteContext(leagueId: number, gameId: number) {
  const [league, game] = await Promise.allSettled([
    loadCompetitionLeague(leagueId),
    loadGame(leagueId, gameId),
  ]);
  const loadedLeague = unwrap(league);
  if (isLeagueFinished(loadedLeague.status))
    throw new AppError(409, messages.error.league.finishedLocked);
  return { league: loadedLeague, game: unwrap(game) };
}
