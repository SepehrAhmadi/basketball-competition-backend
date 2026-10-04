# Shared

## Purpose

Serves static enum lookups for dropdowns and validation.

## Entities

- None via Prisma client; imports `Role`, `CoachDegree`, `RefreeLevel` from generated Prisma enums.

## Sub-modules

- `roles` — public `GET /` listing `Role` values with labels.
- `coach-degrees` — public `GET /` listing `CoachDegree` values with labels.
- `referee-levels` — public `GET /` listing `RefreeLevel` values with labels.
- `dropdowns` — authenticated (`verifyJWT`, no admin gate) reference data: static `organization-statuses`/`team-statuses`/`team-member-roles` (Persian labels) + paginated `organizations`/`teams`/`seasons`/`manager-candidates`/`users`/`age-categories` lookups.

## Responsibilities

- Static enum endpoints return code + label lists; no writes.
- Dropdown endpoints return paginated `{ items: { value, label, ... }, total, page, pageSize }` filtered to non-`DELETED` (orgs/teams) for filters/forms.

## Relationships with other modules

- → people: `Coach.degree` and `Referee.licenseLevel` use these enums; player/coach/referee validation references the same value sets (conceptual, no service import).
- → teams: roster role checks reference `Role` values (conceptual, no service import).
