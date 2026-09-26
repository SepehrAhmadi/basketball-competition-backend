# Shared

## Purpose

Serves static enum lookups for dropdowns and validation.

## Entities

- None via Prisma client; imports `Role`, `CoachDegree`, `RefreeLevel` from generated Prisma enums.

## Sub-modules

- `roles` — lists `Role` values with labels.
- `coach-degrees` — lists `CoachDegree` values with labels.
- `referee-levels` — lists `RefreeLevel` values with labels.

## Responsibilities

- Public `GET /` endpoints returning code + label lists; no writes.

## Relationships with other modules

- → people: `Coach.degree` and `Referee.licenseLevel` use these enums; player/coach/referee validation references the same value sets (conceptual, no service import).
- → teams: roster role checks reference `Role` values (conceptual, no service import).
