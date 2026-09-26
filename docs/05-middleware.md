# Middleware

| Middleware | Responsibility | Location |
|---|---|---|
| `credentials` | Sets `Access-Control-Allow-Credentials` for listed origins | `src/middleware/credentials.ts` |
| `verifyJWT` | Verifies Bearer token, attaches `userId/roles/adminLevel/permissions` | `src/middleware/auth/verifyJWT.middleware.ts` |
| `verifyRole` | Allows listed domain roles; any `adminLevel` bypasses | `src/middleware/auth/verifyRole.middleware.ts` |
| `verifyAdminLevel` | Requires `adminLevel` in allowed list | `src/middleware/auth/verifyAdminLevel.middleware.ts` |
| `verifyPermission` | Requires token permission string; `SUPER_ADMIN` bypasses, no DB call | `src/middleware/auth/verifyPermission.middleware.ts` |
| `verifyTeamAccess` | DB ownership check via `team` + `organizationManager` / `teamSeasonMember` | `src/middleware/auth/verifyTeamAccess.middleware.ts` |
| `verifyOrgAccess` | DB check for `organizationManager` membership | `src/modules/organizations/organizations.middleware.ts` |
| `validate` | Generic Zod runner for `body`/`query`/`params`, sets `req.validated*` | `src/middleware/validate.ts` |
| `createUploader` | Factory for multer instances (dest, size, MIME filter) | `src/middleware/upload/createUploader.ts` |
| `errorHandler` | Maps `AppError`/Multer/unknown to JSON error shape | `src/middleware/errorHandler.ts` |

Notes:
- `validate` is only the execution engine; schemas live per-module in `*.validation.ts`.
- `errorHandler` must be the last `app.use()` in `src/app.ts`.
- No `requestLogger` exists in this codebase.
