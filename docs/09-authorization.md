# Contextual Authorization (Actor + Policies + `can` Flags)

## What this is

Contextual authorization answers "what can this user do on this specific record"
instead of "what global role does this user have". The same user can have
different power in different contexts, so access is computed per request and
per resource, not from the token alone.

The backend remains the only security boundary. Responses also carry a `can`
object so the frontend can show or hide actions without interpreting roles.
`can` is UX-only; every mutation is still enforced in the service.

The name `can` is used deliberately. The login response already has
`permissions: string[]` (admin-panel permissions). Contextual flags never reuse
that name.

## Concepts

| Concept | Meaning |
|---|---|
| Authentication | Who the caller is (`verifyJWT`, login module). Unchanged. |
| Actor | The caller's contextual identity for one request: id, admin flag, managed/member sets (including member teams for the active season), and a season-scoped membership lookup. |
| Policy | A pure synchronous function `(actor, scope) => flags`. No DB access inside. |
| `can` | The policy result attached to a response item. Frontend renders it, never derives it. |
| Enforcement | Service calls `assertAllowed(can.flag, message)` before mutating. Throws `AppError` 403 on denial. |

## Request lifecycle

1. `verifyJWT` (protected routes) or `optionalJWT` (public routes) resolves token claims into `req.userId / roles / adminLevel / permissions`. `optionalJWT` never fails: missing or invalid token just leaves user fields unset.
2. `attachActor` (protected) or `optionalActor` (public) builds `req.actor` exactly once per request via `loadActor()`. Authenticated callers get a loaded actor; guests get `guestActor` (all flags false).
3. Controller passes `req.actor` to the service. Controllers and middleware make no allow/deny decisions.
4. Service loads the target record (404 first), calls the domain policy with the actor plus the record scope, enforces with `assertAllowed`, and attaches the resulting `can` to the response.
5. Coarse `verifyRole` gates may still sit in the route chain as a first filter. They never replace the policy check.

## Actor

Defined in `src/authz/actor.ts`:

- `userId: number | null`, `isAdmin: boolean` (`adminLevel != null`).
- `managedOrgIds`, `memberOrgIds`, `memberTeamIds`: readonly sets built from membership rows. `memberTeamIds` only includes ACTIVE memberships in the active season.
- `membershipFor(teamId, seasonId)`: season-scoped lookup backed by a `Map` keyed `${teamId}:${seasonId}`.
- `guestActor`: null user, empty sets, lookup always returns `undefined`.
- `loadActor(userId, adminLevel)`: runs the membership queries in parallel, builds the sets and map, returns the actor. Built once per request; policies receive it as input and never query.

The `Actor` type is attached to Express via the existing `Request` augmentation
in `src/types/express/index.d.ts` (`actor?: Actor` alongside
`userId/roles/adminLevel/permissions`).

## Middleware

Located in `src/middleware/auth/` following the `verifyJWT.middleware.ts`
naming style:

- `accessToken.utils.ts`: shared token parsing/verification extracted from `verifyJWT` so logic is not duplicated.
- `verifyJWT.middleware.ts`: strict; 401 on missing/invalid token.
- `optionalJWT.middleware.ts`: non-failing; public routes stay accessible, invalid tokens are treated as guest.
- `attachActor.middleware.ts`: exports `attachActor` (protected, after `verifyJWT`) and `optionalActor` (public, after `optionalJWT`). Forwards load errors with `next(err)`. Makes no allow/deny decisions.

## Policies

- One pure file per domain module: `*.policy.ts` (e.g. `organizations.policy.ts`, `teams.policy.ts`).
- Signature shape: `policy(actor, scope) => flags`, where scope is the minimal context the rule needs (record ids, team/season pair, target role/row).
- Helpers that map flags to a decision (e.g. role-based vs. row-based checks) live next to the policy and stay pure.
- Policies are unit-testable with hand-built `Actor` objects; no DB or request needed.

## Enforcement

`src/authz/assert.ts` exports:

```ts
assertAllowed(allowed: boolean, message: string): asserts allowed
```

It throws `new AppError(403, message)` when denied. Services use it with the
existing `messages` keys so 403/404 texts stay unchanged. Record-not-found (404)
is always checked before the policy denial (403).

## The `can` contract

- Additive: existing response fields are unchanged; `can` is an extra object.
- Present on detail and mutation responses; list responses include it per item only when cheap (no per-row lookups otherwise).
- Guests and callers with no access receive all-false flags; authenticated reads without visibility fail with 403.
- Row-level lists expose per-item `can` (e.g. `{ edit, delete }`) plus a top-level `can` for the collection scope.
- Swagger documents each `can` shape (e.g. `...Can` schemas in `*.docs.ts`) so the frontend can code against it.

## Adding a new domain

1. Create `<domain>.policy.ts` with a `<Domain>Can` type and a pure policy function.
2. Add `verifyJWT` + `attachActor` in the domain routes (`optionalJWT` + `optionalActor` remain only for future public routes).
3. Pass `req.actor` from controller to service; drop the `userId/roles/adminLevel` params it replaces.
4. In the service: 404 first, compute `can = policy(actor, scope)`, enforce with `assertAllowed`, return `can` in the response.
5. Register the `...Can` schema in `<domain>.docs.ts` and note authenticated semantics.

## Conventions and pitfalls

- ESM with explicit `.ts` import suffixes; `export default {}` service/controller objects; `AppError`, `messages`, `apiResponse` as elsewhere.
- Never put DB access inside a policy. Load everything the rule needs into the actor or the record scope first.
- Never trust `can` on input. It is output-only; the service re-derives it from the actor on every call.
- Keep business rules (transactions, soft-delete, conflict mapping, file cleanup) untouched; authorization only gates whether the operation may run.
- Keep 403/404 message keys stable; add new keys in `src/language/message.ts` only when no existing key fits.
