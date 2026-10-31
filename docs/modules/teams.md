# Teams

## Purpose

Manages teams and their per-season rosters of coaches and players.

## Entities

- `Team`, `TeamSeasonMember` (plus reads of `OrganizationManager`, `Season`, `User`, `UserRole`)

## Responsibilities

- Authenticated team list (`GET /`, optional `organizationId` filter) scoped to visible teams (admin: all; manager: managed organizations; others: member teams of the active season); detail/roster require `verifyJWT` + `attachActor` and return `can` flags (`teamPolicy` view gate, 404 before 403).
- Mutations require `verifyJWT` + `attachActor`; record checks via `teamPolicy`/`rosterPolicy` + `assertAllowed` with `can` on responses.
- Team create/update/soft-delete with Jalali `foundedDate` conversion and logo handling (server-generated URL, `basename` + prefix guard, orphan cleanup); org transfer requires managing the target org and, in one transaction, syncs the denormalized `TeamSeasonMember.organizationId` of every row of the team; `foundedDate` uses `jalaliPatchValue` (`null` clears, `undefined` keeps) on manager and admin routes; file helpers come from `utils/files.ts`; `admin/` adds status filter + `POST /:teamId/restore` (`teams.restore`).
- Roster read (resolved season — explicit `seasonId` or active — `status = ACTIVE`, user include) with top-level `can` (`assignHeadCoach/manageCoaches/managePlayers`) + per-item `can { edit, delete }` (head-coach rows manager-only).
- Roster routes validate `:memberId` with `rosterMemberParamSchema` (400 on non-numeric ids).
- Roster add/update/remove with head-coach demotion transaction (one `demoteOtherHeadCoaches` helper shared by create, reactivation and update; reactivation is wrapped in the same `P2002` handling, duplicate member → 409 `memberAlreadyExists`, otherwise `jerseyConflict`; COACH rows never store a jersey number), `P2002` → 409 mapping, reactivation of `DELETED` rows, jersey-unique handling, and role rules (regular coaches manage players only; only admins/org managers assign head coach).
- Head-coach sync: `addRosterMember` (new/reactivated head coach) and `updateRosterMember` (promotion) call `syncHeadCoachToRegistrationLeagues` (from `leagues/lib/league.head-coach-sync.ts`, batched via `createMany`/`updateMany`) in the same transaction, adding the head coach to ACTIVE league registrations whose league is in `REGISTRATION` for that season. This is an intentional module-level dependency: teams imports the leagues helper, leagues never imports `teams.service` (no cycle).
- League guards: `isLockedByLeague` blocks remove and role/jersey updates with 409 `memberInActiveLeague` when the member is in an `ACTIVE`/`FINISHED` league roster; removes and role changes otherwise cascade-soft-delete the league roster rows.
- Team delete guard (`teams/lib/team.rules.ts` pure, `team.locks.ts` Prisma, `team.advisories.ts` builder): both `DELETE /teams/:teamId` and `DELETE /admin/teams/:teamId` return 409 `inOpenLeague` when the team has an ACTIVE `LeagueTeam` in a `REGISTRATION`/`ACTIVE` league — no admin bypass. Responses carry `lock: Advisory | null` (`IN_OPEN_LEAGUE`, `BLOCKER`) and `can.delete` is derived via `withTeamLock(policy, locked)` (`lib/team.access.ts`). The lock is computed once by `loadOpenLeagueTeamIds(...).has(id)` using `TEAM_DELETE_BLOCKING_LEAGUE_STATUSES`; `isLockedByLeague` uses `ROSTER_LOCKING_LEAGUE_STATUSES` from `leagues/lib/league.rules.ts`.

## Relationships with other modules

- → organizations: `organizationPolicy(actor, organizationId).createTeam` gates team create; `managedOrgIds` drives `teamPolicy`/`rosterPolicy` (shared FK, no service import).
- → seasons: resolves explicit `seasonId` or active season via `getActiveSeasonOrThrow`; roster rows carry `seasonId` (shared FK, no service import).
- → people: validates roster adds against `User` + `UserRole` (shared FK, no service import).
- → leagues: league roster is a selection of `TeamSeasonMember`; guards above keep selections consistent.
- Admin roster mutations (`admin/` controller) call `teams.service` directly with `adminActor` — no admin-service wrappers.
