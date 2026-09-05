import prisma from "../../../config/db.config.ts";
import AppError from "../../../utils/appError.ts";
import { messages } from "../../../language/message.ts";

interface ListOrganizationsQuery {
  page: number;
  pageSize: number;
}

async function getAllOrganizations(
  userId: number,
  roles: string[],
  query: ListOrganizationsQuery,
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

  return { items, total, page: query.page, pageSize: query.pageSize };
}

async function getOrganizationById(id: number) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  return organization;
}

async function createOrganization(data: any, userId: number) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data });
    await tx.organizationManager.create({
      data: { organizationId: org.id, userId },
    });
    return org;
  });
}

async function updateOrganization(id: number, data: any) {
  const organization = await prisma.organization.findFirst({
    where: { id, status: { not: "DELETED" } },
  });
  if (!organization) {
    throw new AppError(404, messages.error.organization.notFound);
  }
  const { status: _ignoredStatus, ...safeData } = data;
  return prisma.organization.update({ where: { id }, data: safeData });
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
