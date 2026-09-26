# Organizations

## Purpose

Manages clubs/organizations, their logos, and their managers.

## Entities

- `Organization`, `OrganizationManager`

## Responsibilities

- Paginated org listing; non-admins scoped to `managers.some { userId }`.
- Org create (transaction creating `Organization` + `OrganizationManager`), update, logo replace/remove, soft-delete via `status = DELETED`.
- Record-level guard `verifyOrgAccess` checking `organizationManager` membership.

## Relationships with other modules

- → teams: owns `OrganizationManager` rows consumed by `teams.service.assertOrgManager` and `verifyTeamAccess` middleware (shared FK, no service import).
- → people: `OrganizationManager.userId` links to `User` (shared FK, no service import).
