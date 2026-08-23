import prisma from "../../../config/db.config.ts";
import findOrFail from "../../../utils/findOrFail.ts";
import { messages } from "../../../language/message.ts";

async function getAllOrganizations(userId: number, roles: string[]) {
  if (roles.includes("ADMIN")) {
    return prisma.organization.findMany();
  }
  return prisma.organization.findMany({
    where: { managers: { some: { userId } } },
  });
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
