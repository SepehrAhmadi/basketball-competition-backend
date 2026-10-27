import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import { evaluateTeamDelete } from "./team.rules.ts";

const BLOCKING: ("REGISTRATION" | "ACTIVE")[] = ["REGISTRATION", "ACTIVE"];

export async function loadOpenLeagueTeamIds(
  teamIds: number[],
): Promise<Set<number>> {
  if (teamIds.length === 0) return new Set();
  const rows = await prisma.leagueTeam.findMany({
    where: {
      teamId: { in: teamIds },
      status: "ACTIVE",
      league: { status: { in: BLOCKING } },
    },
    select: { teamId: true },
  });
  return new Set(rows.map((r) => r.teamId));
}

export async function assertTeamDeletable(teamId: number): Promise<void> {
  const rows = await prisma.leagueTeam.findMany({
    where: {
      teamId,
      status: "ACTIVE",
      league: { status: { in: BLOCKING } },
    },
    select: { league: { select: { status: true } } },
  });
  const check = evaluateTeamDelete(rows.map((r) => r.league.status));
  if (!check.allowed)
    throw new AppError(409, messages.error.team.inOpenLeague);
}
