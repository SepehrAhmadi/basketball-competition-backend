import { gregorianToJalali } from "../../../../utils/date.util.ts";
import getPublicFileUrl from "../../../../utils/getFileUrl.ts";
import type {
  GameStatus,
  LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import type { GameRow, GameTeamRow } from "./games.queries.ts";
import { buildGameLocks, buildGameWarnings } from "./games.advisories.ts";
import {
  evaluateGameActions,
  isOutsideLeaguePeriod,
  isResultPending,
  isUnscheduled,
} from "./games.rules.ts";

export interface GameTeamItem {
  leagueTeamId: number;
  team: { id: number; name: string; logoUrl: string | null };
  organization: { id: number; name: string } | null;
  teamStatus?: string;
}

export function toGameTeamItem(
  row: GameTeamRow,
  options?: { includeTeamStatus?: boolean },
): GameTeamItem {
  return {
    leagueTeamId: row.id,
    team: {
      id: row.team.id,
      name: row.team.name,
      logoUrl: getPublicFileUrl(row.team.logoUrl, process.env.BASE_URL),
    },
    organization: row.team.organization,
    ...(options?.includeTeamStatus ? { teamStatus: row.team.status } : {}),
  };
}

export interface PublicGameItem {
  id: number;
  status: string;
  resultType: string | null;
  group: { id: number; name: string } | null;
  homeTeam: GameTeamItem;
  awayTeam: GameTeamItem;
  scheduledDate: string | null;
  scheduledTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerLeagueTeamId: number | null;
  forfeitLeagueTeamId: number | null;
  rescheduledFrom: { id: number; status: string } | null;
  rescheduledTo: { id: number; status: string } | null;
}

function winnerOf(row: GameRow): number | null {
  if (row.status !== "FINISHED") return null;
  if (row.homeScore === null || row.awayScore === null) return null;
  if (row.homeScore === row.awayScore) return null;
  return row.homeScore > row.awayScore
    ? row.homeLeagueTeamId
    : row.awayLeagueTeamId;
}

export function toPublicGameItem(
  row: GameRow,
  options: { includeTeamStatus: boolean },
): PublicGameItem {
  return {
    id: row.id,
    status: row.status,
    resultType: row.resultType,
    group: row.group ? { id: row.group.id, name: row.group.name } : null,
    homeTeam: toGameTeamItem(row.homeTeam, options),
    awayTeam: toGameTeamItem(row.awayTeam, options),
    scheduledDate: gregorianToJalali(row.scheduledDate),
    scheduledTime: row.scheduledTime,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    winnerLeagueTeamId: winnerOf(row),
    forfeitLeagueTeamId: row.forfeitLeagueTeamId,
    rescheduledFrom: row.rescheduledFrom,
    rescheduledTo: row.rescheduledTo,
  };
}

export interface AdminGameContext {
  leagueStatus: LeagueStatus;
  leagueStartDate: Date | null;
  leagueEndDate: Date | null;
  notSwappedIds: ReadonlySet<number>;
}

export function toAdminGameItem(row: GameRow, ctx: AdminGameContext) {
  const actions = evaluateGameActions({
    status: row.status as GameStatus,
    leagueStatus: ctx.leagueStatus,
    hasReplacement: row.rescheduledTo !== null,
  });
  return {
    ...toPublicGameItem(row, {
      includeTeamStatus: ctx.leagueStatus === "FINISHED",
    }),
    resultNote: row.resultNote,
    cancelReason: row.cancelReason,
    ...buildGameLocks(actions),
    issues: buildGameWarnings({
      resultPending: isResultPending(row.status, row.scheduledDate),
      unscheduled: isUnscheduled(row.status, row.scheduledDate),
      homeAwayNotSwapped: ctx.notSwappedIds.has(row.id),
      outsideLeaguePeriod: isOutsideLeaguePeriod(
        row.scheduledDate,
        ctx.leagueStartDate,
        ctx.leagueEndDate,
      ),
    }),
  };
}

export type AdminGameItem = ReturnType<typeof toAdminGameItem>;
