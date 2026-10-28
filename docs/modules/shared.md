# Shared

## Purpose

Serves static enum lookups for dropdowns and validation.

## Entities

- None via Prisma client; imports `Role`, `CoachDegree`, `RefreeLevel`, `LeagueStatus`, `LeagueFormat`, `GroupRoundType` from generated Prisma enums.

## Sub-modules

- `dropdowns` — authenticated (`verifyJWT`, no admin gate) reference data: static `organization-statuses`/`team-statuses`/`team-member-roles` (Persian labels) + paginated `organizations`/`teams`/`seasons`/`users`/`age-categories` lookups under `/dropdowns`.
- `dropdowns/admin` — admin-only (`verifyAdminLevel(ADMIN, SUPER_ADMIN)`, no permission gate) `GET /dropdowns/admin/leagues` league selector; returns every status including `INACTIVE`, label `"<league> — <season> — <age category>"`.
- `dropdowns/static/roles` — public `GET /dropdown/roles` listing `Role` values with labels.
- `dropdowns/static/coach-degrees` — public `GET /dropdown/coach-degrees` listing `CoachDegree` values with labels.
- `dropdowns/static/referee-levels` — public `GET /dropdown/referee-levels` listing `RefreeLevel` values with labels.
- `dropdowns/static/league-statuses` — public `GET /dropdown/league-statuses` listing `LeagueStatus` values with Persian labels.
- `dropdowns/static/league-formats` — public `GET /dropdown/league-formats` listing `LeagueFormat` values with Persian labels.
- `dropdowns/static/group-round-types` — public `GET /dropdown/group-round-types` listing `GroupRoundType` values with Persian labels.

## Responsibilities

- Static enum endpoints return code + label lists; no writes.
- Dropdown endpoints return paginated `{ items: { value, label, ... }, total, page, pageSize }` filtered to non-`DELETED` (orgs/teams) for filters/forms.
- The admin league dropdown is the only gated dropdown: admins see all statuses, and `search` is normalized with `normalizePersianText` (Arabic ي/ك → Persian ی/ک).

## Relationships with other modules

- → people: `Coach.degree` and `Referee.licenseLevel` use these enums; player/coach/referee validation references the same value sets (conceptual, no service import).
- → teams: roster role checks reference `Role` values (conceptual, no service import).
