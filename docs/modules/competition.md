# Competition

## Purpose

League management: leagues linked to an age-category cutoff (season + category derived), team registration by organization managers or admins, and league rosters as a selection of team season members.

## Entities

- `League` — name (unique per cutoff), `ageCategoryCutoffId`, status (`INACTIVE`/`REGISTRATION`/`ACTIVE`/`FINISHED`), dates, roster deadline.
- `LeagueTeam` — registration of a team in a league (soft-delete via `DELETED`).
- `LeagueTeamMember` — selection of a `TeamSeasonMember` into a league roster (soft-delete).

## Sub-modules

- `leagues/` — public reads + authenticated manager endpoints (`/leagues`, `/leagues/me`).
- `leagues/admin/leagues/` — admin CRUD + status (`/admin/leagues`).
- `leagues/admin/league-teams/` — admin registration + roster (`/admin/leagues/:leagueId/teams`, `/admin/leagues/:leagueId/eligible-teams` via a second router in the same file).
- `shared/` — pure rules (`isRosterWindowOpen`, `canEditByStatus`, age eligibility) + response mappers.

## Responsibilities

- Status machine: free transitions except → `ACTIVE` needs ≥ 2 teams each with ≥ 1 player; leaving `FINISHED` needs `SUPER_ADMIN`.
- Unregistering a team and removing the last player of a team are forbidden (409) in an `ACTIVE` league.
- Registration checks: org ACTIVE + managed by caller, team ACTIVE, team has season roster; identity → status → window order.
- Roster: PLAYER age rule (`birthDate >= cutoff.minBirthDate`), one-team-per-league for players; manager edits in `REGISTRATION` + before deadline, admin in `REGISTRATION`/`ACTIVE`.
- Public roster (`GET /leagues/:leagueId/teams/:leagueTeamId/members`) is genuinely public (no ownership check) and exposes safe fields only; admin variants add phone + birth date.
- Roster candidates are paginated (`page`/`pageSize`/`total`).

## Relationships with other modules

- → age-categories: cutoff lock — a cutoff with leagues cannot be edited or deleted (409).
- → seasons: via cutoff (`cutoff.season`); never a direct `seasonId` on League.
- → teams: roster is a selection of `TeamSeasonMember`; team guards block remove/role-change in `ACTIVE`/`FINISHED` leagues.
- → organizations: scoping via `managedOrgIds`.
- Planned → games/groups/series: will reference `LeagueTeam`; stats will reference `LeagueTeamMember`.
