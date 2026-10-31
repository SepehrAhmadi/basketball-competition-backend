# Utilities

| Utility | Responsibility | Location |
|---|---|---|
| `AppError` | Custom error carrying `statusCode` for expected failures | `src/utils/appError.ts` |
| `sendResponse` | Builds uniform success envelope `{statusCode, message, data}` | `src/utils/apiResponse.ts` |
| `findOrFail` | Record lookup that throws 404 `AppError` when missing | `src/utils/findOrFail.ts` |
| `jalaliToGregorian` / `gregorianToJalali` | Converts Jalali `YYYY/MM/DD` input to stored `Date` and back | `src/utils/date.util.ts` |
| `jalaliPatchValue` | Patch-style date conversion: `undefined` → unchanged, `null` → clear, string → Jalali → `Date` | `src/utils/date.util.ts` |
| `UPLOADS_ROOT` / `uploadUrlToPath` / `removeFileIfExists` / `withPublicLogoUrl` | Single home for upload-path resolution (prefix + `basename` guard), best-effort file deletion, and logo URL mapping; `UPLOADS_ROOT` resolves to `src/uploads` | `src/utils/files.ts` |
| `getPublicFileUrl` | Prefixes stored file paths with `BASE_URL` | `src/utils/getFileUrl.ts` |
| `normalizePersianText` | Trims text and maps Arabic ي/ك to Persian ی/ک for matching stored names | `src/utils/persian.util.ts` |
| `PERMISSION_CATALOG` / `Permission` | Single source of truth for admin permission codes | `src/shared/permissions.ts` |
| `Advisory` / `makeAdvisory` | Structured reason shape (`code`, `severity`, `message`, `params`) returned next to `can` flags | `src/shared/advisory.ts` |
| `idParamSchema` | Shared Zod schema for `:id` params | `src/shared/schemas.validation.ts` |
| `paginationQuerySchema` | Shared `page`/`pageSize` query defaults (1 / 20, max 100) | `src/shared/schemas.validation.ts` |
| `paginatedResponseSchema` | Generic `{items, total, page, pageSize}` envelope builder | `src/shared/schemas.validation.ts` |
| upload limits | Per-kind max size (2 MB) and MIME allowlists | `src/config/upload.config.ts` |
| `messages` | Central Persian error/success strings | `src/language/message.ts` |
