# Plan: Remove the `ORG_MANAGER` Role Completely

> Supersedes the earlier "block role removal with 409" plan. **Do not implement** that plan
> (no `cannotRemoveOrgManagerRole` message, no guard in `syncUserRoles`). Once the role no longer
> exists, that problem cannot occur.

## 1. Goal and final behavior

Managing an organization becomes purely a **relationship** (`organization_managers`), never a global role.

| Topic                                            | Behavior after the change                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who can create an organization                   | Any authenticated user (`POST /organizations`). The creator is automatically inserted into `organization_managers` (already how `createOrganization` works). |
| Who can edit/delete an organization or its teams | Only its manager (or an admin), enforced by `organizationPolicy` / `teamPolicy` + `assertAllowed` in the services. These checks already exist.               |
| Who can manage a roster                          | Org manager, team head coach, team coach, admin: enforced by `rosterPolicy` in the service. No role gate in routes.                                          |
| Transferring management                          | **Admin only**, via the existing `PUT /admin/organizations/:id` with `managerId`. No new endpoint. No manager-side transfer.                                 |
| Organization limits per user                     | **None** for now (explicitly out of scope).                                                                                                                  |
| `Role` enum                                      | `COACH`, `PLAYER`, `REFEREE` only.                                                                                                                           |
| Users with no role                               | Valid state (e.g. someone who only creates an organization).                                                                                                 |

Why this is safe: the `ORG_MANAGER` role carries no profile or extra data (unlike `Player`/`Coach`/`Referee`), and the data model, policies and `Actor` are already relationship-based. The only thing contradicting that is the coarse `verifyRole("ORG_MANAGER")` gate in routes. Removing the role also eliminates the existing inconsistency where `can.edit = true` was returned but the route rejected the call with 403.

## 2. Decisions taken in this plan (change only if you disagree)

| #   | Decision                                                                                                     | Reason                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Remove `GET /dropdowns/manager-candidates`; the admin organization form uses `GET /dropdowns/users` instead. | Its only filter was the removed role. Without it, it duplicates `/dropdowns/users`. Keeping it would leave redundant code. (Frontend change required, see section 8.) |
| D2  | `roles` becomes optional (default `[]`) in self-registration and admin create-user.                          | Otherwise someone who only wants to run an organization must pick a meaningless role. The `min(1)` rule and its message become dead.                                  |
| D3  | Remove `SELF_REGISTER_ROLES` and its service check plus `invalidSelfRegisterRole`.                           | After this change every `Role` is self-registrable, so the "subset" concept is meaningless. The Zod enum already restricts input.                                     |
| D4  | `verifyRole` returns 403 (not 401 "No role found") for users with no matching/any role.                      | Roleless users are now normal. A 401 would make clients try a token refresh/logout loop.                                                                              |
| D5  | Remove stale `"PUBLIC"` from the admin-assignable roles list while editing it.                               | It no longer exists in the DB enum (removed by migration `20260926072520`); sending it already fails at Prisma.                                                       |
| D6  | One release: code + migration together.                                                                      | Old code against the new enum would fail when writing `ORG_MANAGER`.                                                                                                  |

## 3. Complete inventory of touchpoints

Verified by reading the whole project. Every item below must be changed. Nothing else references the role.

| File                                                                | Reference                                                                                                                    | Action                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `src/prisma/schema.prisma`                                          | `enum Role { ORG_MANAGER ... }`                                                                                              | Remove the value                                   |
| `src/prisma/migrations/<new>/migration.sql`                         | n/a                                                                                                                          | New migration (section 4.1)                        |
| `src/modules/organizations/organizations.routes.ts`                 | `verifyRole("ORG_MANAGER")` on POST/PUT/DELETE + import                                                                      | Remove gates and import                            |
| `src/modules/teams/teams.routes.ts`                                 | `verifyRole("ORG_MANAGER")` (team create/update/delete/logo), `verifyRole("ORG_MANAGER","COACH")` (3 roster routes) + import | Remove all gates and import                        |
| `src/middleware/auth/verifyRole.middleware.ts`                      | `401 "No role found"` branch                                                                                                 | Simplify (D4)                                      |
| `src/modules/shared/roles/roles.service.ts`                         | `ROLE_LABELS_FA.ORG_MANAGER`                                                                                                 | Remove entry (TS would error on excess key anyway) |
| `src/modules/shared/roles/roles.docs.ts`                            | `assignableRoleEnum`                                                                                                         | Remove value                                       |
| `src/modules/people/auth/auth.validation.ts`                        | `selfRegisterRoles`, `.min(1, atLeastOneRoleRequired)`                                                                       | Remove value, make optional (D2)                   |
| `src/modules/people/auth/auth.service.ts`                           | `SELF_REGISTER_ROLES` + check                                                                                                | Remove (D3)                                        |
| `src/modules/people/auth/auth.docs.ts`                              | `roleEnum`                                                                                                                   | Remove value                                       |
| `src/modules/people/user/user.validation.ts`                        | `allRoles`                                                                                                                   | Remove value                                       |
| `src/modules/people/user/user.docs.ts`                              | `roleEnum`                                                                                                                   | Remove value                                       |
| `src/modules/people/user/admin/users.admin.validation.ts`           | `adminAssignableRoles` (also contains stale `"PUBLIC"`), `.min(1, ...)` on create                                            | Remove both values (D5), make optional (D2)        |
| `src/modules/people/user/admin/users.admin.docs.ts`                 | `roleEnum`, create-user description                                                                                          | Remove value, fix text                             |
| `src/modules/shared/dropdowns/dropdowns.validation.ts`              | `usersDropdownQuerySchema.role` enum + example `"ORG_MANAGER"`                                                               | Remove value, change example to `"COACH"`          |
| `src/modules/shared/dropdowns/dropdowns.controller.ts`              | `getUsers` query type, `getManagerCandidates`                                                                                | Fix type, delete handler (D1)                      |
| `src/modules/shared/dropdowns/dropdowns.service.ts`                 | `getManagerCandidates` filters by role                                                                                       | Delete function and export (D1)                    |
| `src/modules/shared/dropdowns/dropdowns.routes.ts`                  | `/manager-candidates` route                                                                                                  | Delete (D1)                                        |
| `src/modules/shared/dropdowns/dropdowns.docs.ts`                    | `/dropdowns/manager-candidates` path, `userDropdownItemSchema` example `["ORG_MANAGER"]`, `/dropdowns/users` description     | Delete path, fix example/text                      |
| `src/modules/organizations/admin/organizations.admin.service.ts`    | `assertManagerCandidate` checks `UserRole`                                                                                   | Simplify and rename                                |
| `src/modules/organizations/admin/organizations.admin.validation.ts` | `managerIdField` description "User id with ORG_MANAGER role"                                                                 | Fix text                                           |
| `src/modules/organizations/admin/organizations.admin.docs.ts`       | `managerId` descriptions, 400 `managerMissingRole`                                                                           | Fix text/responses                                 |
| `src/modules/organizations/organizations.docs.ts`                   | "Requires ORG_MANAGER or ADMIN" (POST/PUT/DELETE), 403 on POST                                                               | Fix text/responses                                 |
| `src/modules/teams/teams.docs.ts`                                   | "Requires ORG_MANAGER or ADMIN..." (POST/PUT/DELETE/logo), POST 403 text                                                     | Fix text                                           |
| `src/language/message.ts`                                           | `organization.managerMissingRole`, `auth.atLeastOneRoleRequired`, `auth.invalidSelfRegisterRole`                             | Delete the three keys                              |
| `docs/*.md`                                                         | Several mentions                                                                                                             | Update (section 4.9)                               |

Files verified as needing **no** change: `seed.ts`, `accessToken.utils.ts` (old JWTs containing the value are harmless and expire in 15 minutes), `attachActor`, `actor.ts`, `organizations.policy.ts`, `teams.policy.ts`, all org/team services, `user.service.ts` (`syncUserRoles` stays untouched), `players/coaches/referees` routes (they keep `verifyRole` for their own single role), `teams.admin.service.ts`.

## 4. Step-by-step implementation

Do the steps in this order (it keeps the project compiling as you go).

### 4.1 Prisma schema and migration

`schema.prisma`:

```prisma
enum Role {
  COACH
  PLAYER
  REFEREE
}
```

Create the migration **without applying**, then edit the SQL (Prisma does not generate the `DELETE`):

```bash
npx prisma migrate dev --create-only --name remove_org_manager_role
```

Folder example: `src/prisma/migrations/20261005xxxxxx_remove_org_manager_role/migration.sql`

```sql
-- ORG_MANAGER is no longer a role: management is the organization_managers relation.
-- Delete the role rows first, otherwise shrinking the enum fails or corrupts data.
-- organization_managers is NOT touched, so no manager loses an organization.
DELETE FROM `user_roles` WHERE `role` = 'ORG_MANAGER';

-- AlterTable
ALTER TABLE `user_roles` MODIFY `role` ENUM('COACH', 'PLAYER', 'REFEREE') NOT NULL;
```

Then apply and regenerate the client:

```bash
npx prisma migrate dev
```

Rules: never edit old migrations (they legitimately contain `ORG_MANAGER`); users left with zero roles are fine.

### 4.2 Routes

`organizations.routes.ts`: delete the `verifyRole` import and the three `verifyRole("ORG_MANAGER")` lines.

```ts
router.post(
  "/",
  verifyJWT,
  attachActor,
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.createOrganizationSchema),
  organizationsController.create,
);

router.put(
  "/:id",
  verifyJWT,
  attachActor,
  validate(idParamSchema, "params"),
  organizationLogoUploader.single("logo"),
  validate(organizationsValidation.updateOrganizationSchema),
  organizationsController.update,
);

router.delete(
  "/:id",
  verifyJWT,
  attachActor,
  validate(idParamSchema, "params"),
  organizationsController.remove,
);
```

`teams.routes.ts`: delete the `verifyRole` import and **every** `verifyRole(...)` line (team create/update/delete/logo and the three roster routes). Chain becomes `verifyJWT, attachActor, <validators / uploader>, controller`. Do **not** replace the roster gate with `verifyRole("COACH")`: org managers without the COACH role must pass, and `rosterPolicy` + `assertCanManageRoster` / `assertCanManageMember` already decide.

Notes:

- The services already call `assertAllowed` and already delete the uploaded file on 403/404, so removing the route gate does not leave orphan files. A non-manager can now cause a transient upload (max 2 MB) that is immediately removed; this matches existing design.
- Teams and rosters are public reads, so the 404-before-403 order leaks nothing new.

### 4.3 `verifyRole` (D4)

Empty roles is now a normal state, so the special 401 branch is dead. Replace the body with:

```ts
const verifyRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Any admin level bypasses domain-role checks entirely.
    if (req.adminLevel) return next();

    if (!req.roles?.some((role) => allowedRoles.includes(role))) {
      return next(new AppError(403, "Forbidden"));
    }

    next();
  };
};
```

It remains in use by `players`, `coaches`, `referees` routes.

### 4.4 Validation

`auth.validation.ts`:

```ts
const selfRegisterRoles = ["PLAYER", "COACH", "REFEREE"] as const;
// ...
roles: z
  .array(z.enum(selfRegisterRoles))
  .default([])
  .openapi({ example: ["PLAYER"] }),
```

(Remove `.min(1, messages.error.auth.atLeastOneRoleRequired)`. Keep the `messages` import only if still used elsewhere in the file; it is.)

`user.validation.ts`: `allRoles = ["COACH", "PLAYER", "REFEREE"] as const`.

`users.admin.validation.ts`:

```ts
const adminAssignableRoles = ["COACH", "PLAYER", "REFEREE"] as const;
// adminCreateUserSchema.roles:
roles: z.array(z.enum(adminAssignableRoles)).default([]).openapi({ example: ["COACH"] }),
```

`dropdowns.validation.ts`:

```ts
role: z.enum(["COACH", "PLAYER", "REFEREE"]).optional().openapi({
  example: "COACH",
  description: "Filter by domain role. Omit to return users with any role.",
}),
```

Registering with an empty `roles` array is already safe in services: `roles: { create: [] }` is valid Prisma.

### 4.5 Services

`auth.service.ts` (D3): delete the `SELF_REGISTER_ROLES` constant and the following block from `register`:

```ts
if (roles.some((role) => !SELF_REGISTER_ROLES.includes(role))) {
  throw new AppError(400, messages.error.auth.invalidSelfRegisterRole);
}
```

Keep `const roles = [...new Set(input.roles)];`. Imports (`Role`, `AppError`, `messages`) remain used elsewhere in the file.

`organizations.admin.service.ts`: the manager only needs to be an active user. Replace `assertManagerCandidate` and update its two call sites:

```ts
async function assertActiveUser(userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(404, messages.error.organization.managerNotFound);
  }
}
// adminCreateOrganization: await assertActiveUser(data.managerId);
// adminUpdateOrganization: await assertActiveUser(data.managerId);
```

This removes the `UserRole` query, the unused `fullName` select, the unused return value, and the `managerMissingRole` usage. Single-manager replace logic in `adminUpdateOrganization` stays exactly as is: it is the admin-only transfer mechanism, and the old "role left behind" gap disappears with the role.

`roles.service.ts`: remove `ORG_MANAGER: "مدیر باشگاه"` from `ROLE_LABELS_FA`. `GET /roles` then returns three items automatically from `Object.values(Role)`.

`dropdowns.service.ts` (D1): delete `getManagerCandidates` (and its comment) and remove it from the default export.

### 4.6 Dropdowns controller and routes (D1)

- `dropdowns.controller.ts`: delete `getManagerCandidates`, remove it from the export, and change the `getUsers` query type to `role?: "COACH" | "PLAYER" | "REFEREE"`.
- `dropdowns.routes.ts`: delete the `/manager-candidates` route block.

### 4.7 Messages (`src/language/message.ts`)

Delete exactly these keys (all become unused after the steps above):

- `error.organization.managerMissingRole`
- `error.auth.atLeastOneRoleRequired`
- `error.auth.invalidSelfRegisterRole`

Add nothing.

### 4.8 Swagger docs

Important: `roleEnum` is registered as component `Role` in three files (`auth.docs.ts`, `user.docs.ts`, `users.admin.docs.ts`). All three must be edited **identically** (`["COACH","PLAYER","REFEREE"]`), otherwise the OpenAPI generator throws a duplicate-component conflict at startup.

| File                                | Edit                                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles.docs.ts`                     | `assignableRoleEnum` -> three values                                                                                                                                                                                                            |
| `auth.docs.ts`                      | `roleEnum` -> three values. Register description: roles are optional.                                                                                                                                                                           |
| `user.docs.ts`                      | `roleEnum` -> three values                                                                                                                                                                                                                      |
| `users.admin.docs.ts`               | `roleEnum` -> three values. Create-user description: "any domain role (COACH, PLAYER, REFEREE), or none".                                                                                                                                       |
| `dropdowns.docs.ts`                 | Delete the `/dropdowns/manager-candidates` registration. `userDropdownItemSchema` example -> `["COACH"]`. `/dropdowns/users` description: replace "(e.g. ORG_MANAGER)" with "(e.g. COACH)".                                                     |
| `organizations.docs.ts`             | POST: description "Any authenticated user can create an organization and becomes its manager"; **remove the 403 response** (no gate remains). PUT/DELETE: "Requires being a manager of the organization, or an ADMIN." Keep their 403 (policy). |
| `organizations.admin.docs.ts`       | `managerId` descriptions -> "Any ACTIVE user". POST 400 -> generic `errorResponseSchema(400, "Validation failed")`. Update 404 description -> "Organization or new manager not found". Add a 404 on POST for "Manager user not found".          |
| `organizations.admin.validation.ts` | `managerIdField` description -> "Id of an ACTIVE user who becomes the manager"                                                                                                                                                                  |
| `teams.docs.ts`                     | POST/PUT/DELETE/logo descriptions: replace "Requires ORG_MANAGER or ADMIN..." with "Requires being a manager of the organization, or an ADMIN." POST 403 description -> "Not a manager of the target organization".                             |

### 4.9 Project documentation (`docs/`)

| File                       | Edit                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04-data-model.md`         | Role enum is now `COACH, PLAYER, REFEREE`; add: organization management is the `OrganizationManager` relation, not a role.                                                                                            |
| `02-architecture.md`       | Note that organization/team authorization is policy-only (no `verifyRole`); `verifyRole` is used only by self-profile routes.                                                                                         |
| `09-authorization.md`      | Step 5 of the lifecycle: coarse `verifyRole` gates are used only on players/coaches/referees self routes.                                                                                                             |
| `modules/organizations.md` | Mutations require `verifyJWT` + `attachActor` only; any authenticated user can create and becomes manager; edit/delete via `organizationPolicy`. Admin `PUT` with `managerId` is the only way to transfer management. |
| `modules/teams.md`         | Mutations require `verifyJWT` + `attachActor`; record checks via `teamPolicy`/`rosterPolicy` (remove the `verifyRole` mentions).                                                                                      |
| `modules/people.md`        | Self-registration accepts `PLAYER`, `COACH`, `REFEREE`, or no role.                                                                                                                                                   |
| `modules/shared.md`        | Remove `manager-candidates` from the dropdowns list; roles list updated.                                                                                                                                              |
| `status/current-state.md`  | Add under "Known Issues Fixed": `ORG_MANAGER` role removed; management is relation-only (migration `<new>`).                                                                                                          |

## 5. Dead-code and cleanliness checklist (mandatory)

The goal is that **no trace of the role or its helpers remains**. No commented-out code, no compatibility shims, no "legacy" notes in code.

- [ ] `verifyRole` imports removed from `organizations.routes.ts` and `teams.routes.ts`
- [ ] `verifyRole` "No role found" branch removed
- [ ] `SELF_REGISTER_ROLES` constant and its check removed
- [ ] `getManagerCandidates`: service function, controller handler, route, Swagger path, export entries all removed
- [ ] `assertManagerCandidate` replaced; no leftover `UserRole` query, unused `fullName` select or unused return
- [ ] Messages `managerMissingRole`, `atLeastOneRoleRequired`, `invalidSelfRegisterRole` deleted
- [ ] `ROLE_LABELS_FA.ORG_MANAGER` removed
- [ ] `"PUBLIC"` removed from admin-assignable roles
- [ ] All Swagger descriptions/examples that mention the role fixed (no stale "Requires ORG_MANAGER")
- [ ] No unused imports left in any touched file (`tsc` will not fail on this; check by eye or ESLint `no-unused-vars`)
- [ ] Old migrations untouched

## 6. Verification

1. **Type check:** `npx tsc --noEmit` must pass (the `Record<Role, string>` map and enum usages will flag any miss).
2. **Grep must be clean** outside old migrations:

   ```bash
   grep -rniE "org_manager|managerMissingRole|manager-candidates|getManagerCandidates|invalidSelfRegisterRole|atLeastOneRoleRequired|SELF_REGISTER_ROLES|\"PUBLIC\"" src docs --include=*.ts --include=*.md --exclude-dir=migrations
   ```

   (Hits inside `src/prisma/migrations/` are expected history.)

3. **Swagger:** start the server in non-production and open `/docs`; the app must boot (a duplicate `Role` component would throw at import). Confirm no ORG_MANAGER value appears anywhere.
4. **Migration test on a copy of the DB** containing `ORG_MANAGER` rows: run `SELECT COUNT(*) FROM user_roles WHERE role='ORG_MANAGER';` before, apply, and confirm 0 such rows and `organization_managers` row count unchanged.
5. **Manual / automated scenarios:**

   | #   | Scenario                                                                   | Expected                                                                                               |
   | --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
   | 1   | Register with no roles                                                     | 201                                                                                                    |
   | 2   | Register with `["ORG_MANAGER"]`                                            | 400 (validation)                                                                                       |
   | 3   | Roleless user `POST /organizations`                                        | 201; appears in `GET /organizations` with `isManager: true`, `can` all true                            |
   | 4   | Same user `PUT`/`DELETE` own organization                                  | 200                                                                                                    |
   | 5   | Different user (not manager/member) `PUT /organizations/:id`               | 403 (policy), uploaded file cleaned up                                                                 |
   | 6   | Manager creates team in own org / in someone else's org                    | 201 / 403                                                                                              |
   | 7   | Manager without `COACH` role adds roster member                            | 201                                                                                                    |
   | 8   | Head coach adds a PLAYER; adds a COACH; plain PLAYER member tries to add   | 201; 403 (`coachOnlyManagesPlayer` / not allowed); 403                                                 |
   | 9   | Admin `PUT /admin/organizations/:id` with new `managerId`                  | New manager can edit; old manager gets 403 on edit and 403 on `GET /organizations/:id` unless a member |
   | 10  | Admin create/update organization with non-existent or inactive `managerId` | 404                                                                                                    |
   | 11  | Roleless user calls `GET /players/me`                                      | **403** (not 401)                                                                                      |
   | 12  | `GET /roles`                                                               | 3 items                                                                                                |
   | 13  | Admin create user / update roles with `ORG_MANAGER` or `PUBLIC`            | 400                                                                                                    |
   | 14  | `GET /dropdowns/manager-candidates`                                        | 404 (route gone); `GET /dropdowns/users` works                                                         |

## 7. Deployment and rollback

- Back up the database first.
- Deploy code and run the migration in the same release (D6). Old tokens still carrying `ORG_MANAGER` in `roles` remain harmless for up to 15 minutes; no forced re-login needed.
- Rollback: Prisma has no down-migrations. To roll back, restore the backup, or add a new migration re-adding the enum value. Role rows are fully reconstructible, because the role was always redundant with the relation:

  ```sql
  INSERT IGNORE INTO user_roles (user_id, role)
  SELECT DISTINCT user_id, 'ORG_MANAGER' FROM organization_managers;
  ```

## 8. Frontend impact (communicate before release)

1. Remove "club manager" from registration and profile role pickers; `roles` may be empty or omitted.
2. Show the "Create organization" button to every logged-in user; hide/redirect for guests.
3. Drive "My organizations" and management menus from `GET /organizations` (`isManager`, `can`) instead of `roles`.
4. Admin organization form: load manager options from `GET /dropdowns/users` (D1) instead of `manager-candidates`.
5. Admin user forms: the role list loses `ORG_MANAGER` (and `PUBLIC` if it was ever shown); `GET /roles` already reflects it.
6. Handle `403` (not `401`) for roleless users on profile-type routes (D4).

## 9. Risks and accepted trade-offs

| Risk                                                 | Note                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unlimited organization creation by any user          | Accepted for now (explicit requirement). Revisit later with a per-user cap or `INACTIVE`-until-approved. |
| Manager cannot hand over management on their own     | Accepted: admin-only transfer via `PUT /admin/organizations/:id`.                                        |
| Transient upload by non-managers before the 403      | Bounded (2 MB) and cleaned by services; consistent with existing handling.                               |
| Users who had only `ORG_MANAGER` now have zero roles | Valid and intended; their `organization_managers` access is intact.                                      |

## 10. Noticed while reading (not part of this plan)

- `users.admin.service.listUsers`: the `role` filter is applied only for `SUPER_ADMIN` (`else if`), so a plain ADMIN's `role` query is silently ignored.
- Messages `organization.managerNotActive` and `team.userNotActive` appear unused.

## 11. Definition of done

- Migration applied; `Role` enum has three values; no `ORG_MANAGER` rows exist.
- `tsc` passes, grep is clean (section 6), app boots and `/docs` renders.
- Every scenario in section 6 passes.
- Section 5 checklist fully ticked: no dead code, no stale docs, no leftover messages or routes.
