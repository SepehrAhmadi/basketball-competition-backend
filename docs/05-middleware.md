# Middleware

| Middleware | Responsibility | Location |
|---|---|---|
| `credentials` | Sets `Access-Control-Allow-Credentials` for listed origins | `src/middleware/credentials.ts` |
| `verifyJWT` | Verifies Bearer token, attaches `userId/roles/adminLevel/permissions`; skips `/uploads` paths | `src/middleware/auth/verifyJWT.middleware.ts` |
| `optionalJWT` | Non-failing variant for public reads; missing/invalid token → guest | `src/middleware/auth/optionalJWT.middleware.ts` |
| `attachActor` / `optionalActor` | Builds `req.actor` once per request via `loadActor()`; protected vs public variant | `src/middleware/auth/attachActor.middleware.ts` |
| `accessToken.utils` | Shared `getBearerToken` / `verifyAccessToken` helpers (no duplication) | `src/middleware/auth/accessToken.utils.ts` |
| `verifyRole` | Allows listed domain roles; any `adminLevel` bypasses | `src/middleware/auth/verifyRole.middleware.ts` |
| `verifyAdminLevel` | Requires `adminLevel` in allowed list | `src/middleware/auth/verifyAdminLevel.middleware.ts` |
| `verifyPermission` | Requires token permission string; `SUPER_ADMIN` bypasses, no DB call | `src/middleware/auth/verifyPermission.middleware.ts` |
| `validate` | Generic Zod runner for `body`/`query`/`params`, sets `req.validated*` (400 `path: message` on first issue) | `src/middleware/validate.ts` |
| `createUploader` | Factory for multer instances (dest, size, MIME filter) | `src/middleware/upload/createUploader.ts` |
| `errorHandler` | Maps `AppError`/Multer/unknown to JSON error shape | `src/middleware/errorHandler.ts` |

Notes:
- `validate` is only the execution engine; schemas live per-module in `*.validation.ts`.
- `errorHandler` must be the last `app.use()` in `src/app.ts`; maps `AppError` → `{statusCode, message}`, multer `LIMIT_FILE_SIZE` → 400 `upload.largeFile`, unknown → 500.
- Record-level ownership is enforced by domain policies (`*.policy.ts` + `assertAllowed`), not by middleware — there is no `verifyOrgAccess`/`verifyTeamAccess` middleware in this codebase.
- No `requestLogger` exists in this codebase.
