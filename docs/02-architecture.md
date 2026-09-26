# Architecture

- Style: Modular Monolith — one Express app split into self-contained domain folders under `src/modules/` sharing one Prisma client and one router.
- Layering inside a module: `routes` (wiring + middleware order) → `controller` (req/res mapping only) → `service` (business logic + Prisma queries). Validation runs as middleware before the controller, never called by it.

## Auth flow

1. `auth.service` `register`/`login` verifies credentials via `bcrypt.compare` and calls `getPermissionsForUser`.
2. Service signs 15-min access token (`userId`, `roles`, `adminLevel`, `permissions`) + 1-day refresh token persisted on `User`.
3. Client sends `Authorization: Bearer <token>`; `verifyJWT` verifies signature and attaches `req.userId/roles/adminLevel/permissions`.
4. `verifyRole` / `verifyAdminLevel` / `verifyPermission` check token claims without DB access (`SUPER_ADMIN` bypasses permission checks).
5. `verifyOrgAccess` / `verifyTeamAccess` do DB ownership checks where record scope matters.
6. Multi-role supported via `UserRole` rows (`[userId, role]` unique); token carries the full `roles` array.

## Authorization layers

- Role check — token `roles`/`adminLevel` overlap with route requirement; implemented by `verifyRole` / `verifyAdminLevel` in route chain.
- Record ownership — membership row must exist (`organizationManager`, `teamSeasonMember`); implemented by `verifyOrgAccess` / `verifyTeamAccess` middleware.
- List scoping — non-admin queries filtered to owned records (e.g. `managers.some { userId }`); implemented inline in service `findMany` calls.

See `05-middleware.md` for middleware details and `06-utilities.md` for error/response helpers.
