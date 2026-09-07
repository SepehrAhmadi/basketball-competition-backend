function getPublicFileUrl(
  fileUrl: string | null,
  baseUrl?: string,
): string | null {
  if (!fileUrl) return null;

  if (!baseUrl) return fileUrl;

  return `${baseUrl.replace(/\/$/, "")}/${fileUrl.replace(/^\/+/, "")}`;
}

export default getPublicFileUrl;