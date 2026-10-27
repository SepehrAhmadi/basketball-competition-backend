import getPublicFileUrl from "../../../../utils/getFileUrl.ts";
import { buildGroupIssues, type GroupIssueAdvisory } from "./groups.advisories.ts";
import { effectiveQualifiers } from "./groups.rules.ts";

export interface GroupTeamRow {
  leagueTeamId: number;
  team: { id: number; name: string; logoUrl: string | null };
  organization: { id: number; name: string } | null;
  teamStatus: string;
}

export interface GroupRow {
  id: number;
  name: string;
  qualifiersOverride: number | null;
  teams: GroupTeamRow[];
}

export interface GroupItem {
  id: number;
  name: string;
  qualifiersOverride: number | null;
  qualifiers: number | null;
  teamsCount: number;
  issues: GroupIssueAdvisory[];
  teams: {
    leagueTeamId: number;
    team: { id: number; name: string; logoUrl: string | null };
    organization: { id: number; name: string } | null;
    teamStatus?: string;
  }[];
}

export interface GroupSummary {
  id: number;
  teamsCount: number;
  qualifiers: number | null;
  issues: GroupIssueAdvisory[];
}

export function toGroupItem(
  row: GroupRow,
  leagueDefault: number | null,
  options?: { includeDeleted?: boolean },
): GroupItem {
  const teams = options?.includeDeleted
    ? row.teams
    : row.teams.filter((t) => t.teamStatus !== "DELETED");
  const qualifiers = effectiveQualifiers(
    row.qualifiersOverride,
    leagueDefault,
  );
  return {
    id: row.id,
    name: row.name,
    qualifiersOverride: row.qualifiersOverride,
    qualifiers,
    teamsCount: teams.length,
    issues: buildGroupIssues({
      id: row.id,
      name: row.name,
      teamsCount: teams.length,
      qualifiers,
    }),
    teams: teams.map((t) => ({
      leagueTeamId: t.leagueTeamId,
      team: {
        id: t.team.id,
        name: t.team.name,
        logoUrl: getPublicFileUrl(t.team.logoUrl, process.env.BASE_URL),
      },
      organization: t.organization,
      ...(options?.includeDeleted ? { teamStatus: t.teamStatus } : {}),
    })),
  };
}

export function toGroupSummary(
  row: GroupRow,
  leagueDefault: number | null,
  options?: { includeDeleted?: boolean },
): GroupSummary {
  const item = toGroupItem(row, leagueDefault, options);
  return {
    id: item.id,
    teamsCount: item.teamsCount,
    qualifiers: item.qualifiers,
    issues: item.issues,
  };
}
