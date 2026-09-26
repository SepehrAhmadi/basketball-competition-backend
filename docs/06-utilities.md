# Utilities

| Utility | Responsibility | Location |
|---|---|---|
| `AppError` | Custom error carrying `statusCode` for expected failures | `src/utils/appError.ts` |
| `sendResponse` | Builds uniform success envelope `{statusCode, message, data}` | `src/utils/apiResponse.ts` |
| `findOrFail` | Record lookup that throws 404 `AppError` when missing | `src/utils/findOrFail.ts` |
| `jalaliToGregorian` / `gregorianToJalali` | Converts Jalali `YYYY/MM/DD` input to stored `Date` and back | `src/utils/date.util.ts` |
| `getPublicFileUrl` | Prefixes stored file paths with `BASE_URL` | `src/utils/getFileUrl.ts` |
| `PERMISSION_CATALOG` / `Permission` | Single source of truth for admin permission codes | `src/shared/permissions.ts` |
| `idParamSchema` | Shared Zod schema for `:id` params | `src/shared/schemas.validation.ts` |
| `paginationQuerySchema` | Shared `page`/`pageSize` query defaults (1 / 20, max 100) | `src/shared/schemas.validation.ts` |
| `paginatedResponseSchema` | Generic `{items, total, page, pageSize}` envelope builder | `src/shared/schemas.validation.ts` |
| upload limits | Per-kind max size (2 MB) and MIME allowlists | `src/config/upload.config.ts` |
| `messages` | Central Persian error/success strings | `src/language/message.ts` |
