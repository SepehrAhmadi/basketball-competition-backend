import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import type { Prisma } from "../../../prisma/generated/prisma/client.ts";
import {
  memberInclude,
  memberOrderBy,
  teamSeasonMemberOrderBy,
  toAdminMemberItem,
  toLeagueTeamMemberRow,
  toPublicMemberItem,
} from "../shared/league.mapper.ts";
import {
  buildCandidateFilters,
  candidateInclude,
  mapCandidate,
  paginateSelectedFirst,
  type CandidatesQuery,
} from "../shared/league.candidates.ts";
import {
  assertPlayersEligible,
  loadAddableRows,
  persistRosterRows,
} from "../shared/league.roster-writes.ts";
import {
  loadLeagueContext,
  loadLeagueTeam,
  resolveLeagueTeamAccess,
} from "../shared/league.access.ts";
import type {
  LeagueContext,
  LeagueTeamAccess,
} from "../shared/league.types.ts";
import { findPlayerUserIdsInOtherTeams } from "../shared/league.players.ts";
import {
  evaluateRosterEdit,
  leagueTeamPolicy,
  rosterRowPolicy,
  throwDenial,
} from "./leagues.policy.ts";

/** Identity → status → window, using the role-specific rule. */
function assertRosterEditable(access: LeagueTeamAccess, league: LeagueContext) {
  const result = evaluateRosterEdit(access, league);
  if (!result.allowed) throwDenial(result.reason);
}

interface MembersQuery {
  page: number;
  pageSize: number;
  role?: "COACH" | "PLAYER";
}

async function listMembers(
  leagueId: number,
  leagueTeamId: number,
  query: MembersQuery,
  actor: Actor,
  options: { admin: boolean },
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const where: Prisma.LeagueTeamMemberWhereInput = {
    leagueTeamId,
    status: "ACTIVE",
  };
  if (query.role) where.teamSeasonMember = { role: query.role };

  const [items, total] = await prisma.$transaction([
    prisma.leagueTeamMember.findMany({
      where,
      orderBy: memberOrderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: memberInclude,
    }),
    prisma.leagueTeamMember.count({ where }),
  ]);

  const rows = items.map((row) =>
    options.admin
      ? toAdminMemberItem(toLeagueTeamMemberRow(row))
      : toPublicMemberItem(toLeagueTeamMemberRow(row)),
  );
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  const can = leagueTeamPolicy(league, access);
  return { items: rows, total, page: query.page, pageSize: query.pageSize, can };
}

async function listCandidates(
  leagueId: number,
  leagueTeamId: number,
  query: CandidatesQuery,
  actor: Actor,
  options: { admin: boolean },
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  if (access.rosterRole === null)
    throw new AppError(403, messages.error.league.notAuthorized);

  const { where, selectedFilter, unselectedFilter } = buildCandidateFilters(
    leagueTeam.team.id,
    league.seasonId,
    leagueTeamId,
    query,
  );

  const [total, selectedCount] = await prisma.$transaction([
    prisma.teamSeasonMember.count({ where }),
    prisma.teamSeasonMember.count({ where: { ...where, ...selectedFilter } }),
  ]);

  // Two-phase paging over the virtual list `selected ++ unselected`.
  const skip = (query.page - 1) * query.pageSize;
  const { aSkip, aTake, bSkip, bTake } = paginateSelectedFirst(
    skip,
    query.pageSize,
    selectedCount,
  );

  const [partA, partB] = await Promise.all([
    aTake > 0
      ? prisma.teamSeasonMember.findMany({
          where: { ...where, ...selectedFilter },
          orderBy: teamSeasonMemberOrderBy,
          skip: aSkip,
          take: aTake,
          include: {
            ...candidateInclude,
            leagueMemberships: {
              where: { leagueTeamId, status: "ACTIVE" },
              select: { id: true },
            },
          },
        })
      : Promise.resolve([]),
    bTake > 0
      ? prisma.teamSeasonMember.findMany({
          where: { ...where, ...unselectedFilter },
          orderBy: teamSeasonMemberOrderBy,
          skip: bSkip,
          take: bTake,
          include: {
            ...candidateInclude,
            leagueMemberships: {
              where: { leagueTeamId, status: "ACTIVE" },
              select: { id: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const members = [...partA, ...partB];

  const playerUserIds = members
    .filter((m) => m.role === "PLAYER")
    .map((m) => m.userId);
  const otherUserIds = await findPlayerUserIdsInOtherTeams(
    leagueId,
    leagueTeamId,
    playerUserIds,
  );

  const items = members.map((m) =>
    mapCandidate(m, league, access, otherUserIds, options),
  );

  return { items, total, page: query.page, pageSize: query.pageSize };
}

async function addMembers(
  leagueId: number,
  leagueTeamId: number,
  teamSeasonMemberIds: number[],
  actor: Actor,
  options: { admin: boolean } = { admin: false },
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  assertRosterEditable(access, league);

  const ids = [...new Set(teamSeasonMemberIds)];
  const rows = await loadAddableRows(
    ids,
    leagueTeam.team.id,
    league.seasonId,
    access,
    league,
  );
  await assertPlayersEligible(rows, leagueId, leagueTeamId, league.minBirthDate);

  try {
    const created = await persistRosterRows(leagueTeamId, ids);
    return created.map((r) =>
      options.admin
        ? toAdminMemberItem(toLeagueTeamMemberRow(r))
        : toPublicMemberItem(toLeagueTeamMemberRow(r)),
    );
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    if ((err as { code?: string })?.code === "P2002")
      throw new AppError(409, messages.error.leagueRoster.alreadyInRoster);
    throw err;
  }
}

async function removeMember(
  leagueId: number,
  leagueTeamId: number,
  memberId: number,
  actor: Actor,
) {
  const league = await loadLeagueContext(leagueId, actor);
  const leagueTeam = await loadLeagueTeam(league, leagueTeamId);
  const access = await resolveLeagueTeamAccess(actor, leagueTeam, league);
  assertRosterEditable(access, league);

  const row = await prisma.leagueTeamMember.findFirst({
    where: { id: memberId, leagueTeamId, status: "ACTIVE" },
    include: {
      teamSeasonMember: { select: { id: true, role: true, isHeadCoach: true } },
    },
  });
  if (!row) throw new AppError(404, messages.error.leagueRoster.notFound);

  const decision = rosterRowPolicy(access, league, {
    teamSeasonMemberId: row.teamSeasonMember.id,
    isHeadCoach: row.teamSeasonMember.isHeadCoach,
  });
  if (!decision.canToggle)
    throw new AppError(403, messages.error.leagueRoster.headCoachRowManagerOnly);

  if (league.status === "ACTIVE" && row.teamSeasonMember.role === "PLAYER") {
    const remainingPlayers = await prisma.leagueTeamMember.count({
      where: {
        leagueTeamId,
        status: "ACTIVE",
        id: { not: memberId },
        teamSeasonMember: { role: "PLAYER" },
      },
    });
    if (remainingPlayers === 0)
      throw new AppError(409, messages.error.league.teamWithoutPlayers);
  }

  await prisma.leagueTeamMember.update({
    where: { id: memberId },
    data: { status: "DELETED" },
  });
}

export default {
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
};
