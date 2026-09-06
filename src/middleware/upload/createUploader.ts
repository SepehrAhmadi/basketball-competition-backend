// src/middleware/upload/createUploader.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import AppError from "../../utils/appError.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resolves to src/uploads — independent of process.cwd()
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");

interface UploaderOptions {
  destination: string; // subfolder under src/uploads/, e.g. "avatars", "gallery"
  maxSizeMb?: number;
  allowedMimeTypes?: string[];
}

function createUploader({
  destination,
  maxSizeMb = 2,
  allowedMimeTypes = ["image/png", "image/jpeg"],
}: UploaderOptions) {
  const destinationDir = path.join(UPLOADS_ROOT, destination);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(destinationDir, { recursive: true }); // auto-create if missing
      cb(null, destinationDir);
    },
    filename: (req, file, cb) => {
      // only the extension is trusted from the original name — the rest is random
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
      }
      cb(new AppError(400, `Invalid file type, allowed: ${allowedMimeTypes.join(", ")}`));
    },
  });
}

export default createUploader;
