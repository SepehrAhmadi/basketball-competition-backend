import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import { jalaliToGregorian, gregorianToJalali } from "../../../../utils/date.util.ts";

type CutoffRow = {
  id: number;
  ageCategoryId: number;
  seasonId: number;
  minBirthDate: Date;
  createdAt: Date;
  updatedAt: Date;
  ageCategory: { id: number; name: string };
  season: { id: number; name: string };
};

function toCutoffResponse(row: CutoffRow) {
  return {
    id: row.id,
    ageCategoryId: row.ageCategoryId,
    seasonId: row.seasonId,
    minBirthDate: gregorianToJalali(row.minBirthDate),
    ageCategory: row.ageCategory,
    season: row.season,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const cutoffInclude = {
  ageCategory: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
} as const;

interface ListCutoffsQuery {
  page: number;
  pageSize: number;
  ageCategoryId?: number;
  seasonId?: number;
}

async function listCutoffs(query: ListCutoffsQuery) {
  const where: any = {};
  if (query.ageCategoryId) where.ageCategoryId = query.ageCategoryId;
  if (query.seasonId) where.seasonId = query.seasonId;

  const [items, total] = await prisma.$transaction([
    prisma.ageCategoryCutoff.findMany({
      where,
      orderBy: [{ seasonId: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: cutoffInclude,
    }),
    prisma.ageCategoryCutoff.count({ where }),
  ]);

  return {
    items: items.map(toCutoffResponse),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getCutoffById(cutoffId: number) {
  const cutoff = await prisma.ageCategoryCutoff.findUnique({
    where: { id: cutoffId },
    include: cutoffInclude,
  });
  if (!cutoff) throw new AppError(404, messages.error.ageCategoryCutoff.notFound);
  return toCutoffResponse(cutoff);
}

async function createCutoff(input: { ageCategoryId: number; seasonId: number; minBirthDate: string }) {
  const category = await prisma.ageCategory.findUnique({
    where: { id: input.ageCategoryId },
  });
  if (!category) throw new AppError(404, messages.error.ageCategory.notFound);

  const season = await prisma.season.findUnique({ where: { id: input.seasonId } });
  if (!season) throw new AppError(404, messages.error.season.notFound);

  try {
    const created = await prisma.ageCategoryCutoff.create({
      data: {
        ageCategoryId: input.ageCategoryId,
        seasonId: input.seasonId,
        minBirthDate: jalaliToGregorian(input.minBirthDate),
      },
      include: cutoffInclude,
    });
    return toCutoffResponse(created);
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError(409, messages.error.ageCategoryCutoff.alreadyExists);
    }
    throw err;
  }
}

async function updateCutoff(cutoffId: number, input: { minBirthDate: string }) {
  const existing = await prisma.ageCategoryCutoff.findUnique({
    where: { id: cutoffId },
    include: cutoffInclude,
  });
  if (!existing) throw new AppError(404, messages.error.ageCategoryCutoff.notFound);

  // Skip the write when the date is unchanged so updatedAt stays untouched.
  if (gregorianToJalali(existing.minBirthDate) === input.minBirthDate) {
    return toCutoffResponse(existing);
  }

  const updated = await prisma.ageCategoryCutoff.update({
    where: { id: cutoffId },
    data: { minBirthDate: jalaliToGregorian(input.minBirthDate) },
    include: cutoffInclude,
  });
  return toCutoffResponse(updated);
}

async function deleteCutoff(cutoffId: number) {
  const existing = await prisma.ageCategoryCutoff.findUnique({
    where: { id: cutoffId },
  });
  if (!existing) throw new AppError(404, messages.error.ageCategoryCutoff.notFound);

  try {
    return await prisma.ageCategoryCutoff.delete({ where: { id: cutoffId } });
  } catch (err: any) {
    if (err?.code === "P2003") {
      throw new AppError(409, messages.error.ageCategoryCutoff.inUse);
    }
    if (err?.code === "P2025") {
      throw new AppError(404, messages.error.ageCategoryCutoff.notFound);
    }
    throw err;
  }
}

export default {
  listCutoffs,
  getCutoffById,
  createCutoff,
  updateCutoff,
  deleteCutoff,
};
