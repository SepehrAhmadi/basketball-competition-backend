import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import { messages } from "../../language/message.ts";
import getPublicFileUrl from "../../utils/getFileUrl.ts";
import type { Actor } from "../../authz/actor.ts";
import { assertAllowed } from "../../authz/assert.ts";
import { organizationPolicy } from "./organizations.policy.ts";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// resolves to src/uploads — same root used by createUploader
const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads");
const ORGANIZATION_LOGO_URL_PREFIX = "/uploads/organizations/";

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
  removeLogo?: boolean;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
  removeLogo?: boolean;
}

// Never delete arbitrary files based on the DB value — only resolve paths
// that live under the organization logo directory.
function organizationLogoUrlToPath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl || !logoUrl.startsWith(ORGANIZATION_LOGO_URL_PREFIX)) return null;
  return path.join(UPLOADS_ROOT, "organizations", path.basename(logoUrl));
}

const baseUrl = process.env.BASE_URL;
function withPublicLogoUrl<T extends { logoUrl: string | null }>(
  organization: T,
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
  } catch (err) {
    // filesystem cleanup is best-effort — the DB is already consistent
    console.error(`Failed to delete file at ${filePath}:`, err);
  }
}

interface ListOrganizationsQuery {
  page: number;
  pageSize: number;
}

type MembershipInfo = {
  seasonId: number;
  seasonName: string;
  teamId: number;
  teamName: string;
  role: string;
  isHeadCoach: boolean;
};

async function getMembershipInfoForOrgs(userId: number, orgIds: number[]) {
  const [managerRows, memberRows] = await Promise.all([
    prisma.organizationManager.findMany({
      where: { userId, organizationId: { in: orgIds } },
      select: { organizationId: true },
    }),
    prisma.teamSeasonMember.findMany({
      where: { userId, status: "ACTIVE", organizationId: { in: orgIds } },
      include: {
        team: { select: { id: true, name: true } },
        season: { select: { id: true, name: true } },
      },
    }),
  ]);

  const managedOrgIds = new Set(managerRows.map((r) => r.organizationId));
  const membershipsByOrgId = new Map<number, MembershipInfo[]>();

  for (const m of memberRows) {
    if (!membershipsByOrgId.has(m.organizationId)) membershipsByOrgId.set(m.organizationId, []);
    membershipsByOrgId.get(m.organizationId)!.push({
      seasonId: m.season.id,
      seasonName: m.season.name,
      teamId: m.team.id,
      teamName: m.team.name,
      role: m.role,
      isHeadCoach: m.isHeadCoach,
    });
  }

  return { managedOrgIds, membershipsByOrgId };
}

async function getAllOrganizations(actor: Actor, query: ListOrganizationsQuery) {
  const userId = actor.userId;
  const where: any = { status: { not: "DELETED" } };
  if (!actor.isAdmin) {
    where.OR = [
      { managers: { some: { userId } } },
      { teamSeasonMembers: { some: { userId, status: "ACTIVE" } } },
    ];
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

  let enriched = items.map((item) => ({
    ...withPublicLogoUrl(item),
    can: organizationPolicy(actor, item.id),
  }));

  if (!actor.isAdmin && items.length > 0 && userId != null) {
    const { managedOrgIds, membershipsByOrgId } = await getMembershipInfoForOrgs(
      userId,
      items.map((o) => o.id),
    );
    enriched = enriched.map((org) => ({
      ...org,
      isManager: managedOrgIds.has(org.id),
      memberships: membershipsByOrgId.get(org.id) ?? [],
    }));
  }

  return {
    items: enriched,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getOrganizationById(id: number, actor: Actor) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }

  const can = organizationPolicy(actor, id);
  assertAllowed(can.view, messages.error.organization.notAuthorized);

  const result = { ...withPublicLogoUrl(organization), can };
  if (actor.isAdmin || actor.userId == null) return result;

  const { managedOrgIds, membershipsByOrgId } = await getMembershipInfoForOrgs(actor.userId, [id]);
  return {
    ...result,
    isManager: managedOrgIds.has(id),
    memberships: membershipsByOrgId.get(id) ?? [],
  };
}

async function createOrganization(
  data: CreateOrganizationInput,
  userId: number,
  file?: Express.Multer.File,
) {
  // logoUrl is server-generated from the uploaded file — never client-provided.
  // removeLogo is meaningless on create (nothing exists yet to delete).
  const {
    status: _ignoredStatus,
    logoUrl: _ignoredLogoUrl,
    removeLogo: _ignoredRemoveLogo,
    ...safeData
  } = data as CreateOrganizationInput & {
    status?: unknown;
    logoUrl?: unknown;
    removeLogo?: unknown;
  };
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
    // Creator becomes the first manager, so all flags are granted.
    return {
      ...withPublicLogoUrl(org),
      can: { view: true, edit: true, delete: true, createTeam: true },
    };
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
  actor?: Actor,
) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    if (file) removeFileIfExists(file.path);
    throw new AppError(404, messages.error.organization.notFound);
  }
  // actor is always set by attachActor on these routes; required param would
  // break the untouched admin callers' type surface, so keep optional here.
  const can = organizationPolicy(actor!, id);
  try {
    assertAllowed(can.edit, messages.error.organization.notAuthorized);
  } catch (err) {
    if (file) removeFileIfExists(file.path);
    throw err;
  }
  // logoUrl is server-generated — a client-sent value must never reach Prisma.
  const {
    status: _ignoredStatus,
    logoUrl: _ignoredLogoUrl,
    removeLogo,
    ...safeData
  } = data as UpdateOrganizationInput & {
    status?: unknown;
    logoUrl?: unknown;
    removeLogo?: boolean;
  };

  // Final logo state priority: new uploaded logo > explicit removal > keep.
  // - file present            → use the new logo (removeLogo cannot delete it)
  // - no file + removeLogo    → clear logoUrl (null)
  // - no file, no removeLogo  → keep existing logoUrl untouched
  const newLogoUrl = file ? `${ORGANIZATION_LOGO_URL_PREFIX}${file.filename}` : undefined;
  const shouldRemoveLogo = !file && removeLogo === true;

  let updated;
  try {
    updated = await prisma.organization.update({
      where: { id },
      data:
        newLogoUrl !== undefined
          ? { ...safeData, logoUrl: newLogoUrl }
          : shouldRemoveLogo
            ? { ...safeData, logoUrl: null }
            : safeData,
    });
  } catch (err) {
    // DB update failed — drop the new file, keep the old DB value and file.
    // On removal the old file must also stay, since the DB still references it.
    if (file) removeFileIfExists(file.path);
    throw err;
  }

  // DB now holds the final state — the old physical file can go only when the
  // logo actually changed (replaced or removed).
  if ((file || shouldRemoveLogo) && organization.logoUrl) {
    const oldPath = organizationLogoUrlToPath(organization.logoUrl);
    if (oldPath && oldPath !== file?.path) removeFileIfExists(oldPath);
  }

  return { ...withPublicLogoUrl(updated), can: organizationPolicy(actor!, id) };
}

async function deleteOrganization(id: number, actor: Actor) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  assertAllowed(
    organizationPolicy(actor, id).delete,
    messages.error.organization.notAuthorized,
  );
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
