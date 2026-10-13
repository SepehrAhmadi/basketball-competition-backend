# Competition

## Purpose

League management: leagues linked to an age-category cutoff (season + category derived), team registration by organization managers or admins, and league rosters as a selection of team season members.

## Entities

- `League` — name (unique per cutoff), `ageCategoryCutoffId`, status (`INACTIVE`/`REGISTRATION`/`ACTIVE`/`FINISHED`), dates, roster deadline.
- `LeagueTeam` — registration of a team in a league (soft-delete via `DELETED`).
- `LeagueTeamMember` — selection of a `TeamSeasonMember` into a league roster (soft-delete).

## Sub-modules

- `leagues/` — public reads + authenticated endpoints (`/leagues`, `/leagues/me`, `/leagues/:leagueId/my-teams`, `/leagues/:leagueId/teams/:leagueTeamId`, roster edit endpoints).
  - `leagues.public.service.ts` — public list/detail, my leagues, my teams, team detail (reads never write).
  - `league-teams.service.ts` — registration only: list, eligible, register, unregister.
  - `league-roster.service.ts` — roster only: members, candidates, add, remove.
  - `leagues.policy.ts` — single source of truth for register/roster-edit rules (`evaluateRegister`/`evaluateRosterEdit` return a reason; services map it to errors).
- `shared/league.access.ts` — DB loaders that resolve the caller's roster role (`ADMIN`/`MANAGER`/`HEAD_COACH`/null) for a league team; `shared/league.head-coach-sync.ts` — auto-adds the head coach to league rosters (batched).
- `shared/league.types.ts` — shared types (`LeagueContext`, `LeagueTeamAccess`, `MyRosterRow`, roles); `shared/league.players.ts` — one-team-per-league player lookup; `shared/league.candidates.ts` — candidate filters, two-phase paging, candidate mapping; `shared/league.roster-writes.ts` — roster write helpers (load/validate/persist).
- `leagues/admin/leagues/` — admin CRUD + status (`/admin/leagues`).
- `leagues/admin/league-teams/` — admin registration + roster (`/admin/leagues/:leagueId/teams`, `/admin/leagues/:leagueId/eligible-teams` via a second router in the same file). The admin controller calls the registration/roster services directly with `adminActor`.
- `shared/` — pure rules (`isRosterWindowOpen`, `canEditByStatus`, age eligibility) + response mappers + lifecycle job.

## Responsibilities

- Status machine: free transitions except → `ACTIVE` needs ≥ 2 teams each with ≥ 1 player (`checkActiveRequirements`); leaving `FINISHED` needs `SUPER_ADMIN`. `REGISTRATION` requires a today-or-future deadline; clearing the deadline moves `REGISTRATION` back to `INACTIVE`.
- Lifecycle: `startLeagueLifecycleJob` (startup + every ~90s) owns `REGISTRATION` → `ACTIVE` promotion in one batched pass (SQL date filter, grouped counts, conditional `updateMany`); reads never write. Write paths that move the deadline call `advanceLeagueIfExpired` once after the update.
- Unregistering a team and removing the last player of a team are forbidden (409) in an `ACTIVE` league.
- Registration checks: org ACTIVE + managed by caller, team ACTIVE, team has season roster; identity → status → window order.
- Roster: PLAYER age rule (`birthDate >= cutoff.minBirthDate`), one-team-per-league for players; manager edits in `REGISTRATION` + before deadline, admin in `REGISTRATION`/`ACTIVE`.
- League head coach = the team's head coach (`isHeadCoach`, role `COACH`, `ACTIVE`) who has an `ACTIVE` league-roster row. Registering a team auto-adds its head coach to the roster; assigning/promoting a head coach at team level adds them to rosters of `REGISTRATION` leagues. A manager/admin can deactivate that row, after which the head coach loses league access.
- Head coach may toggle COACH/PLAYER rows (in `REGISTRATION`, before the deadline) but never head-coach rows or their own (`403 headCoachRowManagerOnly`); cannot unregister the team. Regular coaches/players are view-only. Manager rules win when a user is both (policy in `leagues.policy.ts` is pure; the service loads the facts).
- `GET /leagues/me` returns `{ league, myRoles, myTeamsCount }` (DB-paginated, no teams); per-league teams come from `GET /leagues/:leagueId/my-teams`.
- Candidates are ordered selected → head coach → coaches → players (two-phase paging) and expose `leagueTeamMemberId`, `canToggle`, `toggleLockReason`; public members are ordered head coach → coaches → players → jersey.
- Public roster (`GET /leagues/:leagueId/teams/:leagueTeamId/members`) is genuinely public (no ownership check) and exposes safe fields only; admin variants add phone + birth date.
- Roster candidates are paginated (`page`/`pageSize`/`total`).

## Relationships with other modules

- → age-categories: cutoff lock — a cutoff with leagues cannot be edited or deleted (409).
- → seasons: via cutoff (`cutoff.season`); never a direct `seasonId` on League.
- → teams: roster is a selection of `TeamSeasonMember`; team guards block remove/role-change in `ACTIVE`/`FINISHED` leagues.
- → organizations: scoping via `managedOrgIds`.
- Planned → games/groups/series: will reference `LeagueTeam`; stats will reference `LeagueTeamMember`.
