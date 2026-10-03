import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import findOrFail from "../../../../utils/findOrFail.ts";
import { messages } from "../../../../language/message.ts";

interface ListAgeCategoriesQuery {
  page: number;
  pageSize: number;
  search?: string;
}

async function listAgeCategories(query: ListAgeCategoriesQuery) {
  const where: any = {};
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }

  const [items, total] = await prisma.$transaction([
    prisma.ageCategory.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { cutoffs: true } } },
    }),
    prisma.ageCategory.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      cutoffsCount: item._count.cutoffs,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getAgeCategoryById(ageCategoryId: number) {
  const category = await prisma.ageCategory.findUnique({
    where: { id: ageCategoryId },
    include: { _count: { select: { cutoffs: true } } },
  });
  if (!category) throw new AppError(404, messages.error.ageCategory.notFound);
  return {
    id: category.id,
    name: category.name,
    cutoffsCount: category._count.cutoffs,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

async function createAgeCategory(input: { name: string }) {
  const duplicate = await prisma.ageCategory.findFirst({
    where: { name: input.name },
  });
  if (duplicate) {
    throw new AppError(409, messages.error.ageCategory.nameExists);
  }

  try {
    return await prisma.ageCategory.create({ data: { name: input.name } });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.ageCategory.nameExists);
    }
    throw err;
  }
}

async function updateAgeCategory(ageCategoryId: number, input: { name?: string }) {
  await findOrFail(prisma.ageCategory, ageCategoryId, messages.error.ageCategory.notFound);

  if (input.name !== undefined) {
    const duplicate = await prisma.ageCategory.findFirst({
      where: { name: input.name, id: { not: ageCategoryId } },
    });
    if (duplicate) {
      throw new AppError(409, messages.error.ageCategory.nameExists);
    }
  }

  try {
    return await prisma.ageCategory.update({
      where: { id: ageCategoryId },
      data: { ...(input.name !== undefined ? { name: input.name } : {}) },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.ageCategory.nameExists);
    }
    if (err?.code === "P2025") {
      throw new AppError(404, messages.error.ageCategory.notFound);
    }
    throw err;
  }
}

async function deleteAgeCategory(ageCategoryId: number) {
  await findOrFail(prisma.ageCategory, ageCategoryId, messages.error.ageCategory.notFound);

  try {
    return await prisma.ageCategory.delete({ where: { id: ageCategoryId } });
  } catch (err: any) {
    // A category with cutoffs (or later leagues) is blocked by the FK itself.
    if (err?.code === "P2003") {
      throw new AppError(409, messages.error.ageCategory.inUse);
    }
    if (err?.code === "P2025") {
      throw new AppError(404, messages.error.ageCategory.notFound);
    }
    throw err;
  }
}

export default {
  listAgeCategories,
  getAgeCategoryById,
  createAgeCategory,
  updateAgeCategory,
  deleteAgeCategory,
};
