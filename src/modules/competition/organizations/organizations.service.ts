import prisma from "../../../config/db.config.ts";
import findOrFail from "../../../utils/findOrFail.ts";
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
  const where: any = {};
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
  return findOrFail(prisma.organization, id, messages.error.organization.notFound);
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
  await findOrFail(prisma.organization, id, messages.error.organization.notFound);
  return prisma.organization.update({ where: { id }, data });
}

async function deleteOrganization(id: number) {
  await findOrFail(prisma.organization, id, messages.error.organization.notFound);
  return prisma.organization.delete({ where: { id } });
}

export default {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
