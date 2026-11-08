import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import type {
  GroupRoundType,
  LeagueFormat,
  LeagueStatus,
} from "../../../prisma/generated/prisma/enums.ts";
import { activeLeagueTeamWhere } from "../../leagues/lib/league.mapper.ts";

export interface CompetitionLeague {
  id: number;
  status: LeagueStatus;
  format: LeagueFormat | null;
  groupRoundType: GroupRoundType | null;
  defaultQualifiersPerGroup: number | null;
  startDate: Date | null;
  endDate: Date | null;
}

export async function loadCompetitionLeague(
  leagueId: number,
  options?: { hideInactiveFrom?: Actor },
): Promise<CompetitionLeague> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      status: true,
      format: true,
      groupRoundType: true,
      defaultQualifiersPerGroup: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  if (
    options?.hideInactiveFrom &&
    league.status === "INACTIVE" &&
    !options.hideInactiveFrom.isAdmin
  )
    throw new AppError(404, messages.error.league.notFound);
  return league;
}

export async function loadActiveLeagueTeam(
  leagueId: number,
  leagueTeamId: number,
) {
  const leagueTeam = await prisma.leagueTeam.findFirst({
    where: { id: leagueTeamId, ...activeLeagueTeamWhere(leagueId) },
  });
  if (!leagueTeam)
    throw new AppError(404, messages.error.leagueTeam.notFound);
  return leagueTeam;
}

export function unwrap<T>(result: PromiseSettledResult<T>): T {
  if (result.status === "rejected") throw result.reason;
  return result.value;
}
