# Teams

## Purpose

Manages teams and their per-season rosters of coaches and players.

## Entities

- `Team`, `TeamSeasonMember` (plus reads of `OrganizationManager`, `Season`, `User`, `UserRole`)

## Responsibilities

- Public team listing and detail with organization include.
- Team create/update/soft-delete with Jalali `foundedDate` conversion and logo handling.
- Roster read (active season, `status = ACTIVE`, user include) and roster add/update/remove with head-coach demotion transaction, `P2002` → 409 mapping, and reactivation of `DELETED` rows.

## Relationships with other modules

- → organizations: reads `OrganizationManager` in `assertOrgManager` to authorize mutations (shared FK, no service import).
- → seasons: resolves active season via `getActiveSeasonOrThrow` and validates roster `seasonId` against `Season` (shared FK, no service import).
- → people: validates roster adds against `User` + `UserRole` (shared FK, no service import).
