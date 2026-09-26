# People

## Purpose

Owns identity, authentication, and role profiles for all human actors.

## Entities

- `User`, `UserRole`, `UserAdmin`, `AdminPermission`, `Player`, `Coach`, `Referee`

## Sub-modules

- `auth` — register, login, admin login, refresh, logout, self-delete.
- `user` — self-service profile, avatar, password, user search; exports `toUserProfile`, `applyProfileUpdate`.
- `admin-users` — admin CRUD, admin-level assignment, permission replacement.
- `players` — self-only player profile upsert.
- `coaches` — self-only coach profile upsert.
- `referees` — self-only referee profile upsert.

## Responsibilities

- Self-registration limited to `ORG_MANAGER, PLAYER, COACH, REFEREE` with phone/email uniqueness and Jalali birth-date handling.
- Credential verification, access/refresh token issuance, refresh-token persistence, admin-login gating on `adminLevel`.
- Own-profile read/update, avatar upload/remove, password change, soft self-delete (`status = DELETED`).
- Admin user listing (non-`SUPER_ADMIN` hides admin accounts), admin create/update/delete, password reset, permission catalog listing and replacement.

## Relationships with other modules

- → shared: `admin-users.service` imports `PERMISSION_CATALOG`, `Permission` from `shared/permissions.ts`.
- → teams: `Coach`/`Player` profiles are referenced by `teams.service` roster adds via `User` + `UserRole` checks (Prisma FK, no service import).
- → organizations: `User` rows are linked as managers via `OrganizationManager` (Prisma FK, no service import).
- Internal: `auth.service` imports `userService.deleteOwnAccount` from `../user/user.service.ts`; `admin-users.service` imports `toUserProfile`, `applyProfileUpdate` from `../user/user.service.ts`.
