import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { UPLOADS_ROOT, uploadUrlToPath } from "./files.ts";

describe("UPLOADS_ROOT", () => {
  it("ends with src/uploads", () => {
    assert.ok(
      UPLOADS_ROOT.split(path.sep).slice(-2).join("/") === "src/uploads",
    );
  });
});

describe("uploadUrlToPath", () => {
  const prefix = "/uploads/team-logos/";

  it("resolves a url with the expected prefix", () => {
    assert.equal(
      uploadUrlToPath(`${prefix}a.png`, prefix, "team-logos"),
      path.join(UPLOADS_ROOT, "team-logos", "a.png"),
    );
  });
  it("rejects foreign prefixes and empty values", () => {
    assert.equal(uploadUrlToPath("/uploads/avatars/a.png", prefix, "team-logos"), null);
    assert.equal(uploadUrlToPath(null, prefix, "team-logos"), null);
  });
  it("keeps traversal inside the folder", () => {
    const result = uploadUrlToPath(`${prefix}../../secret.txt`, prefix, "team-logos");
    assert.equal(result, path.join(UPLOADS_ROOT, "team-logos", "secret.txt"));
  });
});
