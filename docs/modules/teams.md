# Teams

## Purpose

Manages teams and their per-season rosters of coaches and players.

## Entities

- `Team`, `TeamSeasonMember` (plus reads of `OrganizationManager`, `Season`, `User`, `UserRole`)

## Responsibilities

- Public team list (`GET /`, optional `organizationId` filter) and detail; detail/roster use `optionalJWT` + `optionalActor` and return `can` flags when authenticated (guests get all-false).
- Mutations require `verifyJWT` + `attachActor` + `verifyRole("ORG_MANAGER")` (roster: `ORG_MANAGER|COACH`); record checks via `teamPolicy`/`rosterPolicy` + `assertAllowed` with `can` on responses.
- Team create/update/soft-delete with Jalali `foundedDate` conversion and logo handling (server-generated URL, `basename` + prefix guard, orphan cleanup); org transfer requires managing the target org; `admin/` adds status filter + `POST /:teamId/restore` (`teams.restore`).
- Roster read (resolved season — explicit `seasonId` or active — `status = ACTIVE`, user include) with top-level `can` (`assignHeadCoach/manageCoaches/managePlayers`) + per-item `can { edit, delete }` (head-coach rows manager-only).
- Roster add/update/remove with head-coach demotion transaction, `P2002` → 409 mapping, reactivation of `DELETED` rows, jersey-unique handling, and role rules (regular coaches manage players only; only admins/org managers assign head coach).

## Relationships with other modules

- → organizations: `organizationPolicy(actor, organizationId).createTeam` gates team create; `managedOrgIds` drives `teamPolicy`/`rosterPolicy` (shared FK, no service import).
- → seasons: resolves explicit `seasonId` or active season via `getActiveSeasonOrThrow`; roster rows carry `seasonId` (shared FK, no service import).
- → people: validates roster adds against `User` + `UserRole` (shared FK, no service import).
