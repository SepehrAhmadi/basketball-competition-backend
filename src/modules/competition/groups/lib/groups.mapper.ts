import getPublicFileUrl from "../../../../utils/getFileUrl.ts";
import { buildGroupIssues, type GroupIssueAdvisory } from "./groups.advisories.ts";
import type { GroupWithTeams, LeagueTeamWithTeam } from "./groups.queries.ts";
import { effectiveQualifiers } from "./groups.rules.ts";

export interface GroupTeamItem {
  leagueTeamId: number;
  team: { id: number; name: string; logoUrl: string | null };
  organization: { id: number; name: string } | null;
  teamStatus?: string;
}

export interface GroupItem {
  id: number;
  name: string;
  qualifiersOverride: number | null;
  qualifiers: number | null;
  teamsCount: number;
  issues: GroupIssueAdvisory[];
  teams: GroupTeamItem[];
}

export function toGroupTeamItem(
  row: LeagueTeamWithTeam,
  options?: { includeStatus?: boolean },
): GroupTeamItem {
  return {
    leagueTeamId: row.id,
    team: {
      id: row.team.id,
      name: row.team.name,
      logoUrl: getPublicFileUrl(row.team.logoUrl, process.env.BASE_URL),
    },
    organization: row.team.organization,
    ...(options?.includeStatus ? { teamStatus: row.team.status } : {}),
  };
}

export function toGroupItem(
  group: GroupWithTeams,
  leagueDefault: number | null,
  options?: { includeDeleted?: boolean },
): GroupItem {
  const includeDeleted = options?.includeDeleted ?? false;
  const leagueTeams = group.teams
    .map((t) => t.leagueTeam)
    .filter((lt) => includeDeleted || lt.team.status !== "DELETED");
  const qualifiers = effectiveQualifiers(
    group.qualifiersOverride,
    leagueDefault,
  );
  return {
    id: group.id,
    name: group.name,
    qualifiersOverride: group.qualifiersOverride,
    qualifiers,
    teamsCount: leagueTeams.length,
    issues: buildGroupIssues({
      id: group.id,
      name: group.name,
      teamsCount: leagueTeams.length,
      qualifiers,
    }),
    teams: leagueTeams.map((lt) =>
      toGroupTeamItem(lt, { includeStatus: includeDeleted }),
    ),
  };
}
