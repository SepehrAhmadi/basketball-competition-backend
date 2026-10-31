import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import getPublicFileUrl from "./getFileUrl.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// resolves to src/uploads — same root used by createUploader
export const UPLOADS_ROOT = path.resolve(__dirname, "..", "uploads");

// Never delete arbitrary files based on a DB value — only resolve paths that
// carry the expected public prefix and live directly under `folder`.
export function uploadUrlToPath(
  url: string | null | undefined,
  urlPrefix: string,
  folder: string,
): string | null {
  if (!url || !url.startsWith(urlPrefix)) return null;
  return path.join(UPLOADS_ROOT, folder, path.basename(url));
}

export function removeFileIfExists(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    // filesystem cleanup is best-effort — the DB is already consistent
    console.error(`Failed to delete file at ${filePath}:`, err);
  }
}

export function withPublicLogoUrl<T extends { logoUrl: string | null }>(
  entity: T,
) {
  return {
    ...entity,
    logoUrl: getPublicFileUrl(entity.logoUrl, process.env.BASE_URL),
  };
}
