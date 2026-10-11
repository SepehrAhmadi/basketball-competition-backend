import { gregorianToJalali } from "../../../utils/date.util.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";

export const leagueInclude = {
  ageCategoryCutoff: {
    include: {
      ageCategory: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  },
  _count: {
    select: {
      teams: {
        where: { status: "ACTIVE", team: { status: { not: "DELETED" } } },
      },
    },
  },
} as const;

type LeagueRow = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  rosterDeadline: Date | null;
  ageCategoryCutoffId: number;
  createdAt: Date;
  updatedAt: Date;
  ageCategoryCutoff: {
    minBirthDate: Date;
    ageCategory: { id: number; name: string };
    season: { id: number; name: string };
  };
  _count: { teams: number };
};

export function toLeagueResponse(row: LeagueRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: gregorianToJalali(row.startDate),
    endDate: gregorianToJalali(row.endDate),
    rosterDeadline: gregorianToJalali(row.rosterDeadline),
    ageCategoryCutoffId: row.ageCategoryCutoffId,
    ageCategory: row.ageCategoryCutoff.ageCategory,
    season: row.ageCategoryCutoff.season,
    minBirthDate: gregorianToJalali(row.ageCategoryCutoff.minBirthDate),
    teamsCount: row._count.teams,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type LeagueTeamRow = {
  id: number;
  status: string;
  createdAt: Date;
  team: { id: number; name: string; logoUrl: string | null };
  organization: { id: number; name: string };
  membersCount?: number;
  can?: unknown;
};

export function toLeagueTeamItem(row: LeagueTeamRow, can?: unknown) {
  return {
    id: row.id,
    status: row.status,
    team: {
      id: row.team.id,
      name: row.team.name,
      logoUrl: getPublicFileUrl(row.team.logoUrl, process.env.BASE_URL),
    },
    organization: row.organization,
    ...(row.membersCount !== undefined
      ? { membersCount: row.membersCount }
      : {}),
    createdAt: row.createdAt,
    ...(can !== undefined ? { can } : {}),
  };
}

type MemberRow = {
  id: number;
  teamSeasonMemberId: number;
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  jerseyNumber: number | null;
  isHeadCoach: boolean;
};

export function toPublicMemberItem(row: MemberRow) {
  return {
    id: row.id,
    teamSeasonMemberId: row.teamSeasonMemberId,
    userId: row.userId,
    fullName: row.fullName,
    avatarUrl: getPublicFileUrl(row.avatarUrl, process.env.BASE_URL),
    role: row.role,
    jerseyNumber: row.jerseyNumber,
    isHeadCoach: row.isHeadCoach,
  };
}

export function toAdminMemberItem(
  row: MemberRow & { phone: string; birthDate: Date | null },
) {
  return {
    ...toPublicMemberItem(row),
    phone: row.phone,
    birthDate: gregorianToJalali(row.birthDate),
  };
}

type LeagueTeamMemberRow = {
  id: number;
  teamSeasonMember: {
    id: number;
    role: string;
    jerseyNumber: number | null;
    isHeadCoach: boolean;
    user: {
      id: number;
      fullName: string;
      avatarUrl: string | null;
      phone: string;
      birthDate: Date | null;
    };
  };
};

export function toLeagueTeamMemberRow(row: LeagueTeamMemberRow) {
  return {
    id: row.id,
    teamSeasonMemberId: row.teamSeasonMember.id,
    userId: row.teamSeasonMember.user.id,
    fullName: row.teamSeasonMember.user.fullName,
    avatarUrl: row.teamSeasonMember.user.avatarUrl,
    role: row.teamSeasonMember.role,
    jerseyNumber: row.teamSeasonMember.jerseyNumber,
    isHeadCoach: row.teamSeasonMember.isHeadCoach,
    phone: row.teamSeasonMember.user.phone,
    birthDate: row.teamSeasonMember.user.birthDate,
  };
}

// head coach first, COACH before PLAYER, then jersey number, then id.
// (jerseyNumber NULLs follow the database default ordering.)
export const memberOrderBy = [
  { teamSeasonMember: { isHeadCoach: "desc" } },
  { teamSeasonMember: { role: "asc" } },
  { teamSeasonMember: { jerseyNumber: "asc" } },
  { id: "asc" },
] as const;

export const teamSeasonMemberOrderBy = [
  { isHeadCoach: "desc" },
  { role: "asc" },
  { jerseyNumber: "asc" },
  { id: "asc" },
] as const;

export default {
  leagueInclude,
  toLeagueResponse,
  toLeagueTeamItem,
  toPublicMemberItem,
  toAdminMemberItem,
  toLeagueTeamMemberRow,
};
