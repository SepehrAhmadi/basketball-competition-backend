import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import { isGroupStageFormat } from "../../format/lib/format.rules.ts";
import { activeLeagueTeamWhere } from "../../../leagues/lib/league.mapper.ts";
import { evaluateCreateGroup } from "../lib/groups.rules.ts";
import {
  buildGroupsLock,
  buildUnassignedIssue,
} from "../lib/groups.advisories.ts";
import { getGroupsLockReason } from "../lib/groups.rules.ts";
import {
  assertGroupsEditable,
  loadActiveLeagueTeam,
  loadGroup,
  loadGroupsLeague,
} from "../lib/groups.access.ts";
import { toGroupItem, toGroupSummary } from "../lib/groups.mapper.ts";

const groupWithTeamsInclude = {
  include: {
    teams: {
      orderBy: { id: "asc" as const },
      include: {
        leagueTeam: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                status: true,
                organization: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    },
  },
} as const;

type GroupWithTeams = {
  id: number;
  name: string;
  qualifiersOverride: number | null;
  teams: {
    leagueTeam: {
      id: number;
      team: {
        id: number;
        name: string;
        logoUrl: string | null;
        status: string;
        organization: { id: number; name: string } | null;
      };
    };
  }[];
};

function toRow(g: GroupWithTeams, includeDeleted: boolean) {
  return {
    id: g.id,
    name: g.name,
    qualifiersOverride: g.qualifiersOverride,
    teams: g.teams.map((t) => ({
      leagueTeamId: t.leagueTeam.id,
      team: t.leagueTeam.team,
      organization: t.leagueTeam.team.organization,
      teamStatus: t.leagueTeam.team.status,
    })),
  };
}

async function loadGroupsWithTeams(leagueId: number) {
  const groups = await prisma.group.findMany({
    where: { leagueId },
    orderBy: { id: "asc" },
    ...groupWithTeamsInclude,
  });
  return groups as unknown as GroupWithTeams[];
}

async function buildSummaries(
  leagueId: number,
  leagueDefault: number | null,
  includeDeleted: boolean,
) {
  const groups = await loadGroupsWithTeams(leagueId);
  return groups.map((g) =>
    toGroupSummary(toRow(g, includeDeleted), leagueDefault, { includeDeleted }),
  );
}

async function listGroups(leagueId: number) {
  const league = await loadGroupsLeague(leagueId);
  const grouped = isGroupStageFormat(league.format as never) && league.format !== null;
  const includeDeleted = league.status === "FINISHED";
  const lock = buildGroupsLock(getGroupsLockReason(league.status));

  if (!grouped) {
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

  const [groups, unassignedCount] = await prisma.$transaction([
    prisma.group.findMany({
      where: { leagueId },
      orderBy: { id: "asc" },
      ...groupWithTeamsInclude,
    }),
    prisma.leagueTeam.count({
      where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
    }),
  ]);
  const rows = groups as unknown as GroupWithTeams[];
  const items = rows.map((g) =>
    toGroupItem(toRow(g, includeDeleted), league.defaultQualifiersPerGroup, {
      includeDeleted,
    }),
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

async function listUnassignedTeams(
  leagueId: number,
  query: { page: number; pageSize: number; search?: string },
) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
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
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.leagueTeam.count({ where }),
  ]);
  return {
    items: items.map((lt) => ({
      leagueTeamId: lt.id,
      team: {
        id: lt.team.id,
        name: lt.team.name,
        logoUrl: lt.team.logoUrl,
      },
      organization: lt.team.organization,
    })),
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
    const created = (await prisma.group.create({
      data: {
        leagueId,
        name: input.name,
        qualifiersOverride: input.qualifiersOverride ?? null,
      },
      ...groupWithTeamsInclude,
    })) as unknown as GroupWithTeams;
    return toGroupItem(toRow(created, league.status === "FINISHED"), league.defaultQualifiersPerGroup, {
      includeDeleted: league.status === "FINISHED",
    });
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
  const group = await loadGroup(leagueId, groupId);
  if (
    input.name !== undefined &&
    input.name !== group.name
  ) {
    const dup = await prisma.group.findFirst({
      where: { leagueId, name: input.name, id: { not: groupId } },
    });
    if (dup) throw new AppError(409, messages.error.group.nameExists);
  }
  const data: { name?: string; qualifiersOverride?: number | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.qualifiersOverride !== undefined)
    data.qualifiersOverride = input.qualifiersOverride;
  if (Object.keys(data).length === 0) {
    const current = (await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      ...groupWithTeamsInclude,
    })) as unknown as GroupWithTeams;
    return toGroupItem(toRow(current, league.status === "FINISHED"), league.defaultQualifiersPerGroup, {
      includeDeleted: league.status === "FINISHED",
    });
  }
  try {
    const updated = (await prisma.group.update({
      where: { id: groupId },
      data,
      ...groupWithTeamsInclude,
    })) as unknown as GroupWithTeams;
    return toGroupItem(toRow(updated, league.status === "FINISHED"), league.defaultQualifiersPerGroup, {
      includeDeleted: league.status === "FINISHED",
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
  const unassignedCount = await prisma.leagueTeam.count({
    where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
  });
  return { unassignedCount, issues: buildUnassignedIssue(unassignedCount) };
}

async function assignTeam(
  leagueId: number,
  groupId: number,
  leagueTeamId: number,
) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
  await loadGroup(leagueId, groupId);
  await loadActiveLeagueTeam(leagueId, leagueTeamId);
  const existing = await prisma.groupTeam.findUnique({
    where: { leagueTeamId },
  });
  if (existing?.groupId === groupId) {
    const summaries = await buildSummaries(
      leagueId,
      league.defaultQualifiersPerGroup,
      league.status === "FINISHED",
    );
    const unassignedCount = await prisma.leagueTeam.count({
      where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
    });
    return {
      affectedGroups: summaries.filter((s) => s.id === groupId),
      unassignedCount,
      issues: buildUnassignedIssue(unassignedCount),
    };
  }
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
  const summaries = await buildSummaries(
    leagueId,
    league.defaultQualifiersPerGroup,
    league.status === "FINISHED",
  );
  const unassignedCount = await prisma.leagueTeam.count({
    where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
  });
  return {
    affectedGroups: existing
      ? summaries.filter((s) => s.id === groupId || s.id === existing.groupId)
      : summaries.filter((s) => s.id === groupId),
    unassignedCount,
    issues: buildUnassignedIssue(unassignedCount),
  };
}

async function removeTeam(
  leagueId: number,
  groupId: number,
  leagueTeamId: number,
) {
  const league = await loadGroupsLeague(leagueId);
  assertGroupsEditable(league);
  await loadGroup(leagueId, groupId);
  const row = await prisma.groupTeam.findFirst({
    where: { leagueTeamId, groupId },
  });
  if (!row) throw new AppError(404, messages.error.group.teamNotInGroup);
  await prisma.groupTeam.delete({ where: { id: row.id } });
  const summaries = await buildSummaries(
    leagueId,
    league.defaultQualifiersPerGroup,
    league.status === "FINISHED",
  );
  const unassignedCount = await prisma.leagueTeam.count({
    where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
  });
  return {
    affectedGroups: summaries.filter((s) => s.id === groupId),
    unassignedCount,
    issues: buildUnassignedIssue(unassignedCount),
  };
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
