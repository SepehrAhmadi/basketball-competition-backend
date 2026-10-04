# Seasons

## Purpose

Owns the season lifecycle and active-season resolution.

## Entities

- `Season`

## Responsibilities

- Public season list (paginated, `createdAt desc`) and detail; mutations require `verifyJWT` + `verifyAdminLevel(ADMIN, SUPER_ADMIN)` + `seasons.create|update|delete` permissions (no `seasons.view` gate on reads).
- Create/update with Jalali date conversion and end ≥ start check (string compare pre-convert on create; resolved Jalali compare on update).
- Hard `delete` (no soft-delete); Prisma `P2003` mapped to 409 (`hasDependents`) for any referencing row — rosters today, leagues/games later.
- `deactivateExpiredSeasons()` helper exists but no cron schedules it yet.

## Relationships with other modules

- → teams: `teams.service` resolves explicit/active season via `getActiveSeasonOrThrow` and writes roster rows with `seasonId`; `Season.members` FK blocks season delete.
- → age-categories: `Season` is read/validated by cutoff create/update and included in cutoff responses; `Season.ageCategoryCutoffs` FK blocks season delete.
