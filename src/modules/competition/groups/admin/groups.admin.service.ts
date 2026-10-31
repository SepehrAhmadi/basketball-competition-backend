import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import { isGroupedFormat } from "../../format/lib/format.rules.ts";
import { activeLeagueTeamWhere } from "../../../leagues/lib/league.mapper.ts";
import { isLeagueFinished } from "../../../leagues/lib/league.rules.ts";
import {
  evaluateCreateGroup,
  getGroupsLockReason,
} from "../lib/groups.rules.ts";
import {
  buildGroupsLock,
  buildUnassignedIssue,
} from "../lib/groups.advisories.ts";
import {
  assertGroupsEditable,
  loadAssignmentContext,
  loadGroup,
  loadGroupsLeague,
  loadRemovalContext,
} from "../lib/groups.access.ts";
import { toGroupItem, toGroupTeamItem } from "../lib/groups.mapper.ts";
import {
  countUnassigned,
  groupWithTeamsInclude,
  leagueTeamWithTeamInclude,
  loadGroupSummaries,
} from "../lib/groups.queries.ts";

async function listGroups(leagueId: number) {
  const league = await loadGroupsLeague(leagueId);
  const includeDeleted = isLeagueFinished(league.status);
  const lock = buildGroupsLock(getGroupsLockReason(league.status));

  if (!isGroupedFormat(league.format)) {
    return {
      league: {
        id: league.id,
        format: league.format,
        defaultQualifiersPerGroup: league.defaultQualifiersPerGroup,
      },
      lock,
      groups: [],
      unassignedCount: 0,
      issues: [],
    };
  }

  const [groups, unassignedCount] = await Promise.all([
    prisma.group.findMany({
      where: { leagueId },
      orderBy: { id: "asc" },
      include: groupWithTeamsInclude,
    }),
    countUnassigned(leagueId),
  ]);
  const items = groups.map((g) =>
    toGroupItem(g, league.defaultQualifiersPerGroup, { includeDeleted }),
  );

  return {
    league: {
      id: league.id,
      format: league.format,
      defaultQualifiersPerGroup: league.defaultQualifiersPerGroup,
    },
    lock,
    groups: items,
    unassignedCount,
    issues: buildUnassignedIssue(unassignedCount),
  };
}

// A read: allowed in every league status (the groups list carries the lock).
async function listUnassignedTeams(
  leagueId: number,
  query: { page: number; pageSize: number; search?: string },
) {
  await loadGroupsLeague(leagueId);
  const search = query.search?.trim();
  const where = {
    ...activeLeagueTeamWhere(leagueId),
    groupTeam: null,
    ...(search ? { team: { status: { not: "DELETED" as const }, name: { contains: search } } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.leagueTeam.findMany({
      where,
      orderBy: [{ id: "asc" as const }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: leagueTeamWithTeamInclude,
    }),
    prisma.leagueTeam.count({ where }),
  ]);
  return {
    items: items.map((lt) => toGroupTeamItem(lt)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function createGroup(
  leagueId: number,
  input: { name: string; qualifiersOverride?: number | null },
) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
  const groupCount = await prisma.group.count({ where: { leagueId } });
  const check = evaluateCreateGroup(league.format, groupCount);
  if (!check.allowed)
    throw new AppError(
      409,
      check.reason === "FORMAT_NOT_GROUPED"
        ? messages.error.group.formatNotGrouped
        : messages.error.group.singleGroupOnly,
    );
  try {
    const created = await prisma.group.create({
      data: {
        leagueId,
        name: input.name,
        qualifiersOverride: input.qualifiersOverride ?? null,
      },
    });
    // A new group has no teams yet.
    return toGroupItem({ ...created, teams: [] }, league.defaultQualifiersPerGroup);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002")
      throw new AppError(409, messages.error.group.nameExists);
    throw err;
  }
}

async function updateGroup(
  leagueId: number,
  groupId: number,
  input: { name?: string; qualifiersOverride?: number | null },
) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
  await loadGroup(leagueId, groupId);
  const data: { name?: string; qualifiersOverride?: number | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.qualifiersOverride !== undefined)
    data.qualifiersOverride = input.qualifiersOverride;
  try {
    const updated = await prisma.group.update({
      where: { id: groupId },
      data,
      include: groupWithTeamsInclude,
    });
    return toGroupItem(updated, league.defaultQualifiersPerGroup, {
      includeDeleted: isLeagueFinished(league.status),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002")
      throw new AppError(409, messages.error.group.nameExists);
    if (code === "P2025")
      throw new AppError(404, messages.error.group.notFound);
    throw err;
  }
}

async function deleteGroup(leagueId: number, groupId: number) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
  await loadGroup(leagueId, groupId);
  await prisma.$transaction([
    prisma.groupTeam.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ]);
  const unassignedCount = await countUnassigned(leagueId);
  return { unassignedCount, issues: buildUnassignedIssue(unassignedCount) };
}

async function buildPlacementResult(
  leagueId: number,
  groupIds: number[],
  leagueDefault: number | null,
) {
  const [affectedGroups, unassignedCount] = await Promise.all([
    loadGroupSummaries(leagueId, groupIds, leagueDefault),
    countUnassigned(leagueId),
  ]);
  return {
    affectedGroups,
    unassignedCount,
    issues: buildUnassignedIssue(unassignedCount),
  };
}

async function assignTeam(
  leagueId: number,
  groupId: number,
  leagueTeamId: number,
) {
  const { league } = await loadAssignmentContext(leagueId, groupId, leagueTeamId);
  const existing = await prisma.groupTeam.findUnique({
    where: { leagueTeamId },
  });
  const movedFrom =
    existing && existing.groupId !== groupId ? existing.groupId : null;
  // Re-assigning to the same group is idempotent: nothing to write.
  if (!existing || movedFrom !== null) {
    try {
      await prisma.groupTeam.upsert({
        where: { leagueTeamId },
        create: { groupId, leagueTeamId },
        update: { groupId },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "P2002")
        throw new AppError(409, messages.error.group.teamAssignConflict);
      throw err;
    }
  }
  return buildPlacementResult(
    leagueId,
    movedFrom !== null ? [groupId, movedFrom] : [groupId],
    league.defaultQualifiersPerGroup,
  );
}

async function removeTeam(
  leagueId: number,
  groupId: number,
  leagueTeamId: number,
) {
  const { league } = await loadRemovalContext(leagueId, groupId);
  const row = await prisma.groupTeam.findFirst({
    where: { leagueTeamId, groupId },
  });
  if (!row) throw new AppError(404, messages.error.group.teamNotInGroup);
  await prisma.groupTeam.delete({ where: { id: row.id } });
  return buildPlacementResult(
    leagueId,
    [groupId],
    league.defaultQualifiersPerGroup,
  );
}

export default {
  listGroups,
  listUnassignedTeams,
  createGroup,
  updateGroup,
  deleteGroup,
  assignTeam,
  removeTeam,
};
