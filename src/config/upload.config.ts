// src/config/upload.config.ts
export default {
  avatar: {
    maxSizeMb: 2,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  },
  organizationLogo: {
    maxSizeMb: 2,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  teamLogo: {
    maxSizeMb: 2,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
};
