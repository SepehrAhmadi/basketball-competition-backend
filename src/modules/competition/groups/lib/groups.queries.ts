import prisma from "../../../../config/db.config.ts";
import type { Prisma } from "../../../../prisma/generated/prisma/client.ts";
import { activeLeagueTeamWhere } from "../../../leagues/lib/league.mapper.ts";
import { buildGroupIssues } from "./groups.advisories.ts";
import { effectiveQualifiers } from "./groups.rules.ts";

export const leagueTeamWithTeamInclude = {
  team: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      status: true,
      organization: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LeagueTeamInclude;

export type LeagueTeamWithTeam = Prisma.LeagueTeamGetPayload<{
  include: typeof leagueTeamWithTeamInclude;
}>;

export const groupWithTeamsInclude = {
  teams: {
    orderBy: { id: "asc" },
    include: { leagueTeam: { include: leagueTeamWithTeamInclude } },
  },
} satisfies Prisma.GroupInclude;

export type GroupWithTeams = Prisma.GroupGetPayload<{
  include: typeof groupWithTeamsInclude;
}>;

export function countUnassigned(leagueId: number): Promise<number> {
  return prisma.leagueTeam.count({
    where: { ...activeLeagueTeamWhere(leagueId), groupTeam: null },
  });
}

/**
 * Counter-only summaries for the given groups: one query, no team rows.
 * Only active (non-deleted) teams are counted — mutations never run on
 * FINISHED leagues, so deleted-team inclusion is not needed here.
 */
export async function loadGroupSummaries(
  leagueId: number,
  groupIds: number[],
  leagueDefault: number | null,
) {
  const groups = await prisma.group.findMany({
    where: { leagueId, id: { in: groupIds } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      qualifiersOverride: true,
      _count: {
        select: { teams: { where: { leagueTeam: activeLeagueTeamWhere() } } },
      },
    },
  });
  return groups.map((g) => {
    const teamsCount = g._count.teams;
    const qualifiers = effectiveQualifiers(g.qualifiersOverride, leagueDefault);
    return {
      id: g.id,
      teamsCount,
      qualifiers,
      issues: buildGroupIssues({ id: g.id, name: g.name, teamsCount, qualifiers }),
    };
  });
}
