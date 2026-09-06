// src/config/upload.config.ts
export default {
  avatar: {
    maxSizeMb: 2,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  },
  // add more presets here later, as new upload use-cases come up, e.g.:
  // gallery: { maxSizeMb: 5, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] },
  // teamLogo: { maxSizeMb: 1, allowedMimeTypes: ["image/png", "image/svg+xml"] },
};
