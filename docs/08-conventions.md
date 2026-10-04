# Conventions

## Module files

- Every module uses `*.routes.ts` (wiring) → `*.controller.ts` (req/res) → `*.service.ts` (logic + Prisma) → `*.validation.ts` (Zod input) → `*.docs.ts` (Swagger response + `registerPath`); policy-gated modules add `*.policy.ts` (pure `(actor, scope) => can`).
- Validation files import `swagger/zod-extend.ts` at top for `.openapi()` support.
- Routes reuse shared `idParamSchema` (or domain `*IdParamSchema`, e.g. `teamIdParamSchema`) from `shared/schemas.validation.ts`.
- All messages come from `src/language/message.ts`; no inline strings.

## Swagger

- Two files per module: `*.validation.ts` for input schemas, `*.docs.ts` for response schemas + `registerPath()` on the shared `registry` with `bearerAuth`.
- `*.docs.ts` modules are aggregated in `src/swagger/swagger.ts` (`OpenAPI 3.0.0`, `servers: [/api/v1]`).

## Check placement

- DB query needed → service (ownership, existence, conflicts, transactions).
- Format/shape only → `validate` middleware with Zod.

## Backend specifics

- ESM `.ts` files with explicit `.ts` import suffixes; `__dirname` re-derived via `fileURLToPath`.
- Soft-delete via `status = DELETED` for orgs/teams/users + roster rows (with `POST .../restore` on admin org/team routes and roster reactivation); hard `delete` for seasons, age-categories, and cutoffs (`P2003` → 409 when referenced).
- Uploaded file URLs generated server-side (`/uploads/<dest>/...`), never trusted from client; deletes guarded by `basename` + prefix check; orphan uploads removed when the DB write fails.
- Jalali dates accepted as `YYYY/MM/DD`, stored as UTC-noon Gregorian `Date`.
