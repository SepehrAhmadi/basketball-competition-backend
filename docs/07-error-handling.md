# Error Handling

## Response shapes

- Success: `{ statusCode, message, data }` via `sendResponse`.
- Error: `{ statusCode, message }` via `errorHandler`.

## Error type → layer → tool

| Error type | Raised in | Surfaced by |
|---|---|---|
| Invalid input shape | `validate` middleware | `AppError` 400 `path: message` |
| Record not found | service via `findOrFail` | `AppError` 404 |
| Forbidden / unauthorized | auth middleware or service | `AppError` 401/403 |
| File too large / wrong type | `createUploader` / multer | `errorHandler` 400 |
| Unique / FK conflict | service catching Prisma `P2002`/`P2003` | `AppError` 409 |
| Unexpected | anywhere | `errorHandler` 500 |

See `06-utilities.md` → `AppError` and `05-middleware.md` → `errorHandler` for definitions.

## Example flows

- Invalid input: `POST /teams` with bad body → `validate` fails → `AppError(400)` → `{ statusCode: 400, message: "name: Required" }`.
- Record not found: `GET /seasons/999` → service `findOrFail` → `AppError(404)` → `{ statusCode: 404, message: <season.notFound> }`.
