# Organizations

## Purpose

Manages clubs/organizations, their logos, and their managers.

## Entities

- `Organization`, `OrganizationManager`

## Responsibilities

- Member routes (`/organizations`) require `verifyJWT` + `attachActor` + `verifyRole("ORG_MANAGER")` on mutations; reads are authenticated (no public list/detail).
- Paginated org listing; non-admins scoped to `managers.some { userId }` OR `teamSeasonMembers.some { userId, ACTIVE }`; non-admin items enriched with `isManager` + `memberships[]` (season/team/role).
- Org create (transaction creating `Organization` + `OrganizationManager`), update, logo replace/remove, soft-delete via `status = DELETED`; `logoUrl` server-generated from upload, client values ignored; orphan files removed on failure.
- Record-level guard via `organizationPolicy` + `assertAllowed` (view/edit/delete/createTeam) with `can` object on responses; 404 checked before 403.
- `admin/` sub-module (`/admin/organizations`, `verifyJWT` + `verifyAdminLevel(ADMIN, SUPER_ADMIN)` + `organizations.*` permissions): status filter (`ACTIVE|INACTIVE|DELETED|ALL`, default excludes `DELETED`), single-manager replace on update, soft-delete + `POST /:id/restore` (`organizations.restore`).

## Relationships with other modules

- → teams: owns `OrganizationManager` rows consumed by `teamPolicy`/`rosterPolicy` and `organizationPolicy.createTeam` gate in `teams.service` (shared FK, no service import).
- → people: `OrganizationManager.userId` links to `User` (shared FK, no service import).
