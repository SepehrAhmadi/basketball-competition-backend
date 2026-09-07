import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resolves to src/uploads — same root used by createUploader
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "..", "uploads");
const ORGANIZATION_LOGO_URL_PREFIX = "/uploads/organizations/";

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
}

// Never delete arbitrary files based on the DB value — only resolve paths
// that live under the organization logo directory.
function organizationLogoUrlToPath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl || !logoUrl.startsWith(ORGANIZATION_LOGO_URL_PREFIX)) return null;
  return path.join(UPLOADS_ROOT, "organizations", path.basename(logoUrl));
}

// DB stores the relative logoUrl (e.g. /uploads/organizations/x.png);
// the API exposes the absolute public URL built from the request host.
function getLogoUrl(logoUrl: string | null | undefined, baseUrl?: string): string | null {
  if (!logoUrl) return null;
  if (!baseUrl) return logoUrl;
  return `${baseUrl.replace(/\/$/, "")}/${logoUrl.replace(/^\/+/, "")}`;
}

const baseUrl = process.env.BASE_URL;
function withPublicLogoUrl(
  organization: {
    logoUrl: string | null;
    [key: string]: any;
  },
) {
  return {
    ...organization,
    logoUrl: getPublicFileUrl(organization.logoUrl, baseUrl),
  };
}

function removeFileIfExists(filePath: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // filesystem cleanup is best-effort — the DB is already consistent
  }
}

interface ListOrganizationsQuery {
  page: number;
  pageSize: number;
}

async function getAllOrganizations(
  userId: number,
  roles: string[],
  query: ListOrganizationsQuery,
  baseUrl?: string,
) {
  const where: any = { status: { not: "DELETED" } };
  if (!roles.includes("ADMIN")) {
    where.managers = { some: { userId } };
  }

  const [items, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    items: items.map((item) => withPublicLogoUrl(item)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getOrganizationById(id: number, baseUrl?: string) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  return withPublicLogoUrl(organization);
}

async function createOrganization(
  data: CreateOrganizationInput,
  userId: number,
  file?: Express.Multer.File,
  baseUrl?: string,
) {
  // logoUrl is server-generated from the uploaded file — never client-provided.
  const { status: _ignoredStatus, logoUrl: _ignoredLogoUrl, ...safeData } =
    data as CreateOrganizationInput & { status?: unknown; logoUrl?: unknown };
  const logoUrl = file ? `${ORGANIZATION_LOGO_URL_PREFIX}${file.filename}` : undefined;

  try {
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: logoUrl ? { ...safeData, logoUrl } : safeData,
      });
      await tx.organizationManager.create({
        data: { organizationId: created.id, userId },
      });
      return created;
    });
    return withPublicLogoUrl(org);
  } catch (err) {
    // Multer already wrote the file but the DB create failed — avoid orphans.
    if (file) removeFileIfExists(file.path);
    throw err;
  }
}

async function updateOrganization(
  id: number,
  data: UpdateOrganizationInput,
  file?: Express.Multer.File,
  baseUrl?: string,
) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    if (file) removeFileIfExists(file.path);
    throw new AppError(404, messages.error.organization.notFound);
  }
  // logoUrl is server-generated — a client-sent value must never reach Prisma.
  const { status: _ignoredStatus, logoUrl: _ignoredLogoUrl, ...safeData } =
    data as UpdateOrganizationInput & { status?: unknown; logoUrl?: unknown };

  // No file → logoUrl stays untouched. New file → point the DB at the new URL.
  const newLogoUrl = file ? `${ORGANIZATION_LOGO_URL_PREFIX}${file.filename}` : undefined;

  let updated;
  try {
    updated = await prisma.organization.update({
      where: { id },
      data: newLogoUrl ? { ...safeData, logoUrl: newLogoUrl } : safeData,
    });
  } catch (err) {
    // DB update failed — drop the new file, keep the old DB value and file.
    if (file) removeFileIfExists(file.path);
    throw err;
  }

  // DB now points at the new logo — the old physical file can go.
  if (file && organization.logoUrl) {
    const oldPath = organizationLogoUrlToPath(organization.logoUrl);
    if (oldPath && oldPath !== file.path) removeFileIfExists(oldPath);
  }

  return withPublicLogoUrl(updated);
}

async function deleteOrganization(id: number) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  return prisma.organization.update({
    where: { id },
    data: { status: "DELETED" },
  });
}

export default {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
