import type { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

export type RosterRole = "ADMIN" | "MANAGER" | "HEAD_COACH" | "MEMBER" | null;

export interface LeagueTeamAccess {
  rosterRole: RosterRole;
  // teamSeasonMemberId of the caller's own league-roster row, if any
  ownTeamSeasonMemberId: number | null;
}

export type LeagueRole = "MANAGER" | "HEAD_COACH" | "COACH" | "PLAYER";

export const LEAGUE_ROLE_ORDER: readonly LeagueRole[] = [
  "MANAGER",
  "HEAD_COACH",
  "COACH",
  "PLAYER",
];

export interface LeagueContext {
  id: number;
  name: string;
  status: LeagueStatus;
  rosterDeadline: Date | null;
  seasonId: number;
  minBirthDate: Date;
}

export interface MyRosterRow {
  leagueId: number;
  leagueTeamId: number;
  teamSeasonMemberId: number;
  role: "COACH" | "PLAYER";
  isHeadCoach: boolean;
  seasonId: number;
}
