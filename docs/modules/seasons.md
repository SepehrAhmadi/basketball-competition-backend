# Seasons

## Purpose

Owns the season lifecycle and active-season resolution.

## Entities

- `Season`

## Responsibilities

- Public season list and detail; admin-gated create/update/delete with Jalali date conversion and end ≥ start check.
- Hard `delete` (no soft-delete); Prisma `P2003` mapped to 409 when roster members reference the season.
- `deactivateExpiredSeasons()` helper exists but no cron schedules it yet.

## Relationships with other modules

- → teams: `teams.service` resolves the active season and writes roster rows with `seasonId`; `Season.members` FK blocks season delete.
