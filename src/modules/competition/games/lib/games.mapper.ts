import { gregorianToJalali } from "../../../../utils/date.util.ts";
import getPublicFileUrl from "../../../../utils/getFileUrl.ts";
import type {
  GameListRow,
  GameRow,
  GameTeamRow,
} from "./games.queries.ts";

export interface GameTeamItem {
  leagueTeamId: number;
  team: { id: number; name: string; logoUrl: string | null };
  organization: { id: number; name: string } | null;
}

export function toGameTeamItem(row: GameTeamRow): GameTeamItem {
  return {
    leagueTeamId: row.id,
    team: {
      id: row.team.id,
      name: row.team.name,
      logoUrl: getPublicFileUrl(row.team.logoUrl, process.env.BASE_URL),
    },
    organization: row.team.organization,
  };
}

export interface GameItem {
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
  resultNote: string | null;
  cancelReason: string | null;
  rescheduledFrom: { id: number; status: string } | null;
  rescheduledTo: { id: number; status: string } | null;
}

function winnerOf(row: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeLeagueTeamId: number;
  awayLeagueTeamId: number;
}): number | null {
  if (row.status !== "FINISHED") return null;
  if (row.homeScore === null || row.awayScore === null) return null;
  if (row.homeScore === row.awayScore) return null;
  return row.homeScore > row.awayScore
    ? row.homeLeagueTeamId
    : row.awayLeagueTeamId;
}

export function toGameItem(row: GameRow | GameListRow): GameItem {
  return {
    id: row.id,
    status: row.status,
    resultType: row.resultType,
    group: row.group ? { id: row.group.id, name: row.group.name } : null,
    homeTeam: toGameTeamItem(row.homeTeam),
    awayTeam: toGameTeamItem(row.awayTeam),
    scheduledDate: gregorianToJalali(row.scheduledDate),
    scheduledTime: row.scheduledTime,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    winnerLeagueTeamId: winnerOf(row),
    forfeitLeagueTeamId: (row as GameRow).forfeitLeagueTeamId ?? null,
    resultNote: (row as GameRow).resultNote ?? null,
    cancelReason: (row as GameRow).cancelReason ?? null,
    rescheduledFrom: (row as GameRow).rescheduledFrom ?? null,
    rescheduledTo: (row as GameRow).rescheduledTo ?? null,
  };
}
