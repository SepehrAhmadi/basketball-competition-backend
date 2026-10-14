import type { Prisma } from "../../../prisma/generated/prisma/client.ts";
import { isPlayerAgeEligible } from "./league.rules.ts";
import { toCandidateItem } from "./league.mapper.ts";
import type { LeagueContext, LeagueTeamAccess } from "./league.types.ts";
import { rosterRowPolicy } from "../leagues.policy.ts";

export interface CandidatesQuery {
  page: number;
  pageSize: number;
  role?: "COACH" | "PLAYER";
  search?: string;
}

/** Builds the base candidate filter plus the selected/unselected variants. */
export function buildCandidateFilters(
  teamId: number,
  seasonId: number,
  leagueTeamId: number,
  query: CandidatesQuery,
): {
  where: Prisma.TeamSeasonMemberWhereInput;
  selectedFilter: Prisma.TeamSeasonMemberWhereInput;
  unselectedFilter: Prisma.TeamSeasonMemberWhereInput;
} {
  const search = query.search?.trim();
  const where: Prisma.TeamSeasonMemberWhereInput = {
    teamId,
    seasonId,
    status: "ACTIVE",
    user: { status: "ACTIVE" },
  };
  if (query.role) where.role = query.role;
  if (search) {
    where.user = {
      status: "ACTIVE",
      OR: [{ fullName: { contains: search } }, { phone: { contains: search } }],
    };
  }
  return {
    where,
    selectedFilter: {
      leagueMemberships: { some: { leagueTeamId, status: "ACTIVE" } },
    },
    unselectedFilter: {
      leagueMemberships: { none: { leagueTeamId, status: "ACTIVE" } },
    },
  };
}

export const candidateInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      phone: true,
      birthDate: true,
    },
  },
  leagueMemberships: {
    where: { status: "ACTIVE" },
    select: { id: true, leagueTeamId: true },
  },
} satisfies Prisma.TeamSeasonMemberInclude;

/**
 * Pure: page boundaries for two-phase paging over the virtual list
 * `selected ++ unselected`. Returns the skip/take for the selected slice
 * (a) and the unselected slice (b).
 */
export function paginateSelectedFirst(
  skip: number,
  take: number,
  selectedCount: number,
): { aSkip: number; aTake: number; bSkip: number; bTake: number } {
  const aTake = skip < selectedCount ? Math.min(take, selectedCount - skip) : 0;
  const bSkip = Math.max(0, skip - selectedCount);
  const bTake = take - aTake;
  return { aSkip: skip, aTake, bSkip, bTake };
}

export type CandidateRow = {
  id: number;
  userId: number;
  role: string;
  jerseyNumber: number | null;
  isHeadCoach: boolean;
  user: {
    fullName: string;
    avatarUrl: string | null;
    phone: string;
    birthDate: Date | null;
  };
  leagueMemberships: { id: number }[];
};

/** Maps one candidate row with eligibility and toggle permissions. */
export function mapCandidate(
  m: CandidateRow,
  league: LeagueContext,
  access: LeagueTeamAccess,
  otherUserIds: Set<number>,
  options: { admin: boolean },
) {
  let eligible = true;
  let ineligibleReason: string | null = null;
  if (m.role === "PLAYER") {
    const age = isPlayerAgeEligible(m.user.birthDate, league.minBirthDate);
    if (!age.ok) {
      eligible = false;
      ineligibleReason = age.reason;
    } else if (otherUserIds.has(m.userId)) {
      eligible = false;
      ineligibleReason = "IN_OTHER_TEAM";
    }
  }
  const selected = m.leagueMemberships.length > 0;
  const decision = rosterRowPolicy(access, league, {
    teamSeasonMemberId: m.id,
    isHeadCoach: m.isHeadCoach,
  });
  return toCandidateItem(
    m,
    {
      selected,
      eligible,
      ineligibleReason,
      canToggle: decision.canToggle && (selected || eligible),
      toggleLockReason: decision.lockReason,
    },
    options,
  );
}
