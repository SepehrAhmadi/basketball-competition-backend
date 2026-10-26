# Conventions

## Module files

- Every module uses `*.routes.ts` (wiring) → `*.controller.ts` (req/res) → `*.service.ts` (logic + Prisma) → `*.validation.ts` (Zod input) → `*.docs.ts` (Swagger response + `registerPath`); policy-gated modules add `*.policy.ts` (pure `(actor, scope) => can`).
- A module with 3+ services groups them in `services/`; modules with fewer keep a flat layout.
- `lib/` holds module-private domain logic (rules, loaders, mappers, lifecycle). Code other modules import lives in `lib/` (or the main service) and is named in that module's doc.
- Cross-module imports: a module may import from another module's service, policy, or `lib` file — never from its routes, controller, or docs. Dependencies are one-directional (no cycles).
- Admin pattern: if an admin operation has no extra logic, the admin controller calls the main service with `adminActor(req.userId)`. An admin service exists only for admin-specific logic (different filters, validation, restore, status workflows).
- `*.admin.validation.ts` exists only when it contains admin-specific schemas; otherwise admin routes/docs import from the main `*.validation.ts` directly.
- Validation files import `swagger/zod-extend.ts` at top for `.openapi()` support.
- Routes reuse shared `idParamSchema` (or domain `*IdParamSchema`, e.g. `teamIdParamSchema`) from `shared/schemas.validation.ts`.
- All messages come from `src/language/message.ts`; no inline strings.

## Swagger

- Two files per module: `*.validation.ts` for input schemas, `*.docs.ts` for response schemas + `registerPath()` on the shared `registry` with `bearerAuth`.
- `*.docs.ts` modules are aggregated in `src/swagger/swagger.ts` (`OpenAPI 3.0.0`, `servers: [/api/v1]`).
- `Advisory` is registered once in `src/swagger/advisory.docs.ts`; import `advisorySchema` from there instead of re-declaring it. For a nullable advisory field use `z.union([advisorySchema, z.null()])` — `.nullable()` on a `$ref` drops the nullability.

## Advisories

`can` flags answer "may I?"; advisories answer "why not / what is wrong?".

```ts
type AdvisorySeverity = "INFO" | "WARNING" | "BLOCKER";
interface Advisory<C extends string = string> {
  code: C; severity: AdvisorySeverity; message: string; params: Record<string, string | number | boolean | null>;
}
```

| Severity | Meaning |
|---|---|
| `INFO` | Informational, nothing is wrong |
| `WARNING` | Allowed and saved, but incomplete or suspicious |
| `BLOCKER` | Prevents the action the user is looking at |

- A list of general warnings is always named `issues: Advisory[]`; empty is `[]`, never `null` and never omitted.
- A single reason attached to one concern is a nullable `Advisory` named after the concern (`lock`, `toggleLock`, `ineligibility`); `null` means "no reason" and is a legitimate answer.
- Rules and policies stay pure and return internal codes; the module mapper builds the advisory at the response boundary (`lib/*.advisories.ts`).
- Enforcement stays in services via `AppError` (403/409). The same code feeds both the error and the advisory.
- Advisory text lives in `messages.advisory.*` (short chip labels). Error envelopes keep the longer `messages.error.*` sentences.
- Each module owns its code union; `src/shared/advisory.ts` stays generic.

## Check placement

- DB query needed → service (ownership, existence, conflicts, transactions).
- Format/shape only → `validate` middleware with Zod.

## Backend specifics

- ESM `.ts` files with explicit `.ts` import suffixes; `__dirname` re-derived via `fileURLToPath`.
- Soft-delete via `status = DELETED` for orgs/teams/users + roster rows + league teams/members (with `POST .../restore` on admin org/team routes and roster reactivation); hard `delete` for seasons, age-categories, cutoffs, and leagues (guarded: leagues only in `INACTIVE`/`REGISTRATION` with no ACTIVE teams; `P2003` → 409 when referenced).
- Uploaded file URLs generated server-side (`/uploads/<dest>/...`), never trusted from client; deletes guarded by `basename` + prefix check; orphan uploads removed when the DB write fails.
- Jalali dates accepted as `YYYY/MM/DD`, stored as UTC-noon Gregorian `Date`.
