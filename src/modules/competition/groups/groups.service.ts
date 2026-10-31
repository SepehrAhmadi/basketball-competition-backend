import prisma from "../../../config/db.config.ts";
import type { Actor } from "../../../authz/actor.ts";
import { isGroupedFormat } from "../format/lib/format.rules.ts";
import { isLeagueFinished } from "../../leagues/lib/league.rules.ts";
import { effectiveQualifiers } from "./lib/groups.rules.ts";
import { loadGroupsLeague } from "./lib/groups.access.ts";
import { groupWithTeamsInclude } from "./lib/groups.queries.ts";
import { toGroupTeamItem } from "./lib/groups.mapper.ts";

async function listPublicGroups(leagueId: number, actor: Actor) {
  const league = await loadGroupsLeague(leagueId, { hideInactiveFrom: actor });
  if (!isGroupedFormat(league.format)) {
    return { format: league.format, groups: [] };
  }
  const includeDeleted = isLeagueFinished(league.status);
  const groups = await prisma.group.findMany({
    where: { leagueId },
    orderBy: { id: "asc" },
    include: groupWithTeamsInclude,
  });
  return {
    format: league.format,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      qualifiers: effectiveQualifiers(
        g.qualifiersOverride,
        league.defaultQualifiersPerGroup,
      ),
      teams: g.teams
        .map((t) => t.leagueTeam)
        .filter((lt) => includeDeleted || lt.team.status !== "DELETED")
        .map((lt) => toGroupTeamItem(lt, { includeStatus: includeDeleted })),
    })),
  };
}

export default { listPublicGroups };
