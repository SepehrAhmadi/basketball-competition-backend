import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import type { Actor } from "../../../authz/actor.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";
import { isGroupStageFormat } from "../format/lib/format.rules.ts";
import { effectiveQualifiers } from "./lib/groups.rules.ts";
import { loadGroupsLeague } from "./lib/groups.access.ts";

async function listPublicGroups(leagueId: number, actor: Actor) {
  const league = await loadGroupsLeague(leagueId, { hideInactiveFrom: actor });
  const grouped =
    league.format !== null &&
    isGroupStageFormat(league.format as never);
  if (!grouped) {
    return { format: league.format, groups: [] };
  }
  const includeDeleted = league.status === "FINISHED";
  const groups = await prisma.group.findMany({
    where: { leagueId },
    orderBy: { id: "asc" },
    include: {
      teams: {
        orderBy: { id: "asc" },
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
  });
  return {
    format: league.format,
    groups: groups.map((g) => {
      const leagueTeams = g.teams
        .map((t) => t.leagueTeam)
        .filter((lt) => includeDeleted || lt.team.status !== "DELETED");
      return {
        id: g.id,
        name: g.name,
        qualifiers: effectiveQualifiers(
          g.qualifiersOverride,
          league.defaultQualifiersPerGroup,
        ),
        teams: leagueTeams.map((lt) => ({
          leagueTeamId: lt.id,
          team: {
            id: lt.team.id,
            name: lt.team.name,
            logoUrl: getPublicFileUrl(lt.team.logoUrl, process.env.BASE_URL),
          },
          organization: lt.team.organization,
          ...(includeDeleted ? { teamStatus: lt.team.status } : {}),
        })),
      };
    }),
  };
}

export default { listPublicGroups };
