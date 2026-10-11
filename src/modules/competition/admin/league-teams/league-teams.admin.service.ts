import leagueTeamsService, {
  adminActor,
} from "../../leagues/league-teams.service.ts";

async function listLeagueTeams(
  leagueId: number,
  query: { page: number; pageSize: number; search?: string },
  callerUserId: number,
) {
  return leagueTeamsService.listLeagueTeams(
    leagueId,
    query,
    adminActor(callerUserId),
  );
}

async function listEligibleTeams(
  leagueId: number,
  query: { page: number; pageSize: number; search?: string; organizationId?: number },
  callerUserId: number,
) {
  return leagueTeamsService.listEligibleTeams(
    leagueId,
    query,
    adminActor(callerUserId),
  );
}

async function registerTeam(
  leagueId: number,
  teamId: number,
  callerUserId: number,
) {
  return leagueTeamsService.registerTeam(
    leagueId,
    teamId,
    adminActor(callerUserId),
  );
}

async function unregisterTeam(
  leagueId: number,
  leagueTeamId: number,
  callerUserId: number,
) {
  return leagueTeamsService.unregisterTeam(
    leagueId,
    leagueTeamId,
    adminActor(callerUserId),
  );
}

async function listMembers(
  leagueId: number,
  leagueTeamId: number,
  query: { page: number; pageSize: number; role?: "COACH" | "PLAYER" },
  callerUserId: number,
) {
  return leagueTeamsService.listMembers(
    leagueId,
    leagueTeamId,
    query,
    adminActor(callerUserId),
    { admin: true },
  );
}

async function listCandidates(
  leagueId: number,
  leagueTeamId: number,
  query: {
    page: number;
    pageSize: number;
    role?: "COACH" | "PLAYER";
    search?: string;
  },
  callerUserId: number,
) {
  return leagueTeamsService.listCandidates(
    leagueId,
    leagueTeamId,
    query,
    adminActor(callerUserId),
    { admin: true },
  );
}

async function addMembers(
  leagueId: number,
  leagueTeamId: number,
  teamSeasonMemberIds: number[],
  callerUserId: number,
) {
  return leagueTeamsService.addMembers(
    leagueId,
    leagueTeamId,
    teamSeasonMemberIds,
    adminActor(callerUserId),
  );
}

async function removeMember(
  leagueId: number,
  leagueTeamId: number,
  memberId: number,
  callerUserId: number,
) {
  return leagueTeamsService.removeMember(
    leagueId,
    leagueTeamId,
    memberId,
    adminActor(callerUserId),
  );
}

export default {
  listLeagueTeams,
  listEligibleTeams,
  registerTeam,
  unregisterTeam,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
};

