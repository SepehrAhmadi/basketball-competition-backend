# Age Categories

## Purpose

Owns age-category definitions and their per-season birth-date cutoffs for eligibility.

## Entities

- `AgeCategory`, `AgeCategoryCutoff` (plus reads of `Season`)

## Sub-modules

- `admin/age-categories` — category CRUD mounted at `/admin/age-categories`.
- `admin/age-category-cutoffs` — cutoff CRUD mounted at `/admin/age-category-cutoffs`.

## Responsibilities

- Admin-only; all routes require `verifyJWT` + `verifyAdminLevel("ADMIN", "SUPER_ADMIN")` + `verifyPermission("age-categories.view|create|update|delete")` (cutoffs reuse the same permission strings).
- Category list (paginated, `search` on name) and detail, both with `cutoffsCount` via `_count.cutoffs`.
- Category create/update with Persian name normalization (trim + Arabic ي/ك → Persian ی/ک) and duplicate-name check plus `P2002` → 409.
- Category hard `delete` (no soft-delete); Prisma `P2003` mapped to 409 when cutoffs (or later leagues) reference the category.
- Cutoff list (paginated, filterable by `ageCategoryId`/`seasonId`, ordered by `seasonId desc`) and detail, both with `ageCategory { id, name }` + `season { id, name }` includes and Jalali `minBirthDate` output via `gregorianToJalali`.
- Cutoff create validates `AgeCategory` + `Season` existence, converts Jalali `minBirthDate` via `jalaliToGregorian`, and maps unique `[ageCategoryId, seasonId]` `P2002` → 409.
- Cutoff update keeps `ageCategoryId` immutable; allows `seasonId`/`minBirthDate` only, skips the write when nothing changed (Date-to-Date compare so `1390/1/1` matches `1390/01/01`), pre-checks duplicate `(ageCategoryId, seasonId)` → 409, and maps `P2002`/`P2003` → 409.
- Cutoff hard `delete` with `P2003` → 409 and `P2025` → 404; edit/delete lock `assertCutoffEditable()` is currently a no-op stub.

## Relationships with other modules

- → seasons: cutoff create/update validates `Season` existence and reads `Season` for response includes (shared FK, no service import).
- → competition (planned): `assertCutoffEditable` has a `TODO(League)` stub — any future league linked to a cutoff must block cutoff edit/delete with 409.
