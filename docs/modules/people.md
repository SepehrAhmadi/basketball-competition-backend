# People

## Purpose

Owns identity, authentication, and role profiles for all human actors.

## Entities

- `User`, `UserRole`, `UserAdmin`, `AdminPermission`, `Player`, `Coach`, `Referee`

## Sub-modules

- `auth` — register, login, admin login, refresh, logout, self-delete (`/auth/*`; only `DELETE /account` requires JWT).
- `user` — self-service profile, avatar (`avatars` uploader, 2 MB), password, user search; exports `toUserProfile`, `applyProfileUpdate` (all `verifyJWT`).
- `user/admin` (admin-users) — admin CRUD, admin-level assignment, permission replacement (`/admin/users`, `verifyJWT` + `verifyAdminLevel` + `users.*` permissions; `GET /permissions` is `SUPER_ADMIN`-only).
- `players` — self-only player profile upsert (`verifyJWT` + `verifyRole("PLAYER")`).
- `coaches` — self-only coach profile upsert (`verifyJWT` + `verifyRole("COACH")`).
- `referees` — self-only referee profile upsert (`verifyJWT` + `verifyRole("REFEREE")`).

## Responsibilities

- Self-registration limited to `ORG_MANAGER, PLAYER, COACH, REFEREE` with phone/email uniqueness and Jalali birth-date handling.
- Credential verification, access/refresh token issuance, refresh-token persistence, admin-login gating on `adminLevel`.
- Own-profile read/update, avatar upload/remove, password change, soft self-delete (`status = DELETED`).
- Removing `ORG_MANAGER` is rejected with 409 while the user is a manager of any (non-deleted) organization.
- Admin user listing (non-`SUPER_ADMIN` hides admin accounts), admin create/update/delete, password reset, permission catalog listing and replacement.

## Relationships with other modules

- → shared: `users.admin.service` imports `PERMISSION_CATALOG`, `Permission` from `shared/permissions.ts`.
- → teams: `Coach`/`Player` profiles are referenced by `teams.service` roster adds via `User` + `UserRole` checks (Prisma FK, no service import).
- → organizations: `User` rows are linked as managers via `OrganizationManager` (Prisma FK, no service import).
- Internal: `auth.service` imports `userService.deleteOwnAccount` from `../user/user.service.ts`; `users.admin.service` imports `toUserProfile`, `applyProfileUpdate` from `../user.service.ts`.
