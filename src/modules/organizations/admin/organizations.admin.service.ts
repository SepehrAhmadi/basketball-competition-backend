import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";
import getPublicFileUrl from "../../../utils/getFileUrl.ts";

const baseUrl = process.env.BASE_URL;

function withPublicLogoUrl<T extends { logoUrl: string | null }>(organization: T) {
  return {
    ...organization,
    logoUrl: getPublicFileUrl(organization.logoUrl, baseUrl),
  };
}

export interface AdminCreateOrganizationInput {
  name: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
  managerId: number;
  status?: "ACTIVE" | "INACTIVE";
}

export interface AdminUpdateOrganizationInput {
  name?: string;
  description?: string;
  city?: string;
  phone?: string;
  email?: string;
  managerId?: number;
  status?: "ACTIVE" | "INACTIVE";
}

export interface AdminListOrganizationsQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "DELETED" | "ALL";
}

// The admin-selected manager must be an ACTIVE user.
async function assertActiveUser(userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(404, messages.error.organization.managerNotFound);
  }
}

async function adminListOrganizations(query: AdminListOrganizationsQuery) {
  const where: any = {};

  // Default: hide soft-deleted. Explicit status narrows; ALL removes the filter.
  if (!query.status || query.status === "ALL") {
    if (!query.status) where.status = { not: "DELETED" };
  } else {
    where.status = query.status;
  }

  if (query.search) {
    const search = query.search.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        managers: {
          include: {
            user: { select: { id: true, fullName: true, phone: true, email: true } },
          },
        },
        _count: { select: { teams: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...withPublicLogoUrl(item),
      manager: item.managers[0]?.user ?? null,
      teamsCount: item._count.teams,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function adminGetOrganizationById(id: number) {
  const organization = await prisma.organization.findFirst({
    where: { id },
    include: {
      managers: {
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true } },
        },
      },
      _count: { select: { teams: true } },
    },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  return {
    ...withPublicLogoUrl(organization),
    manager: organization.managers[0]?.user ?? null,
    teamsCount: organization._count.teams,
  };
}

async function adminCreateOrganization(data: AdminCreateOrganizationInput) {
  if (!data.managerId) {
    throw new AppError(400, messages.error.organization.managerRequired);
  }
  await assertActiveUser(data.managerId);

  const {
    managerId,
    status,
    logoUrl: _ignoredLogoUrl,
    ...safeData
  } = data as AdminCreateOrganizationInput & {
    logoUrl?: unknown;
  };

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        ...safeData,
        status: status ?? "ACTIVE",
      },
    });
    await tx.organizationManager.create({
      data: { organizationId: created.id, userId: managerId },
    });
    return created;
  });
  return withPublicLogoUrl(org);
}

async function adminUpdateOrganization(id: number, data: AdminUpdateOrganizationInput) {
  const organization = await prisma.organization.findFirst({
    where: { id },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  if (organization.status === "DELETED") {
    throw new AppError(400, messages.error.organization.alreadyDeleted);
  }

  if (data.managerId !== undefined) {
    await assertActiveUser(data.managerId);
  }

  const {
    managerId,
    status,
    logoUrl: _ignoredLogoUrl,
    ...safeData
  } = data as AdminUpdateOrganizationInput & {
    logoUrl?: unknown;
  };

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.organization.update({
      where: { id },
      data: {
        ...safeData,
        ...(status !== undefined ? { status } : {}),
      },
    });

    // Single-manager semantics: replace the existing manager row.
    if (managerId !== undefined) {
      await tx.organizationManager.deleteMany({ where: { organizationId: id } });
      await tx.organizationManager.create({
        data: { organizationId: id, userId: managerId },
      });
    }

    return result;
  });

  return withPublicLogoUrl(updated);
}

async function adminDeleteOrganization(id: number) {
  const organization = await prisma.organization.findFirst({
    where: { id },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  if (organization.status === "DELETED") {
    throw new AppError(400, messages.error.organization.alreadyDeleted);
  }
  return prisma.organization.update({
    where: { id },
    data: { status: "DELETED" },
  });
}

async function adminRestoreOrganization(id: number) {
  const organization = await prisma.organization.findFirst({
    where: { id },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  if (organization.status !== "DELETED") {
    throw new AppError(400, messages.error.organization.notDeleted);
  }
  const restored = await prisma.organization.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  return withPublicLogoUrl(restored);
}

export default {
  adminListOrganizations,
  adminGetOrganizationById,
  adminCreateOrganization,
  adminUpdateOrganization,
  adminDeleteOrganization,
  adminRestoreOrganization,
};
