import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import { TEAM_DELETE_BLOCKING_LEAGUE_STATUSES } from "./team.rules.ts";

export async function loadOpenLeagueTeamIds(
  teamIds: number[],
): Promise<Set<number>> {
  if (teamIds.length === 0) return new Set();
  const rows = await prisma.leagueTeam.findMany({
    where: {
      teamId: { in: teamIds },
      status: "ACTIVE",
      league: { status: { in: [...TEAM_DELETE_BLOCKING_LEAGUE_STATUSES] } },
    },
    select: { teamId: true },
  });
  return new Set(rows.map((r) => r.teamId));
}

export async function assertTeamDeletable(teamId: number): Promise<void> {
  const locked = (await loadOpenLeagueTeamIds([teamId])).has(teamId);
  if (locked) throw new AppError(409, messages.error.team.inOpenLeague);
}
