import prisma from "../../config/db.config.ts";
import AppError from "../../utils/appError.ts";
import findOrFail from "../../utils/findOrFail.ts";
import { messages } from "../../language/message.ts";
import {
  jalaliToGregorian,
  gregorianToJalali,
} from "../../utils/date.util.ts";

/** Convert a season's date fields from Gregorian (DB) to Jalali (response). */
function toJalaliResponse<T extends { startDate: Date | null; endDate: Date | null }>(
  season: T,
): T {
  return {
    ...season,
    startDate: gregorianToJalali(season.startDate),
    endDate: gregorianToJalali(season.endDate),
  };
}

interface ListSeasonsQuery {
  page: number;
  pageSize: number;
}

async function listSeasons({ page, pageSize }: ListSeasonsQuery) {
  const [items, total] = await prisma.$transaction([
    prisma.season.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.season.count(),
  ]);

  return { items: items.map(toJalaliResponse), total, page, pageSize };
}

async function getSeasonById(seasonId: number) {
  const season = await findOrFail(prisma.season, seasonId, messages.error.season.notFound);
  return toJalaliResponse(season);
}

interface CreateSeasonInput {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
}

async function createSeason(input: CreateSeasonInput) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, messages.error.season.endDateBeforeStartDate);
  }

  const season = await prisma.season.create({
    data: {
      name: input.name,
      startDate:
        input.startDate == null
          ? input.startDate
          : jalaliToGregorian(input.startDate),
      endDate:
        input.endDate == null
          ? input.endDate
          : jalaliToGregorian(input.endDate),
      isActive: input.isActive,
    },
  });
  return toJalaliResponse(season);
}

interface UpdateSeasonInput {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

async function updateSeason(seasonId: number, input: UpdateSeasonInput) {
  const existingSeason = await findOrFail(prisma.season, seasonId, messages.error.season.notFound);

  const { startDate, endDate, ...rest } = input;
  const finalStartDate = startDate !== undefined ? startDate : existingSeason.startDate ? gregorianToJalali(existingSeason.startDate) : null;
  const finalEndDate = endDate !== undefined ? endDate : existingSeason.endDate ? gregorianToJalali(existingSeason.endDate) : null;

  if (finalStartDate && finalEndDate && finalEndDate < finalStartDate) {
    throw new AppError(400, messages.error.season.endDateBeforeStartDate);
  }

  const updated = await prisma.season.update({
    where: { id: seasonId },
    data: {
      ...rest,
      ...(startDate !== undefined
        ? { startDate: startDate == null ? null : jalaliToGregorian(startDate) }
        : {}),
      ...(endDate !== undefined
        ? { endDate: endDate == null ? null : jalaliToGregorian(endDate) }
        : {}),
    },
  });
  return toJalaliResponse(updated);
}

async function deleteSeason(seasonId: number) {
  await findOrFail(prisma.season, seasonId, messages.error.season.notFound);

  try {
    const deleted = await prisma.season.delete({ where: { id: seasonId } });
    return toJalaliResponse(deleted);
  } catch (err: any) {
    // Prisma/MySQL blocks the delete with a foreign-key error (P2003) whenever
    // anything still references this season — team rosters today, league/game
    // records later. Translating it here means this guard automatically covers
    // every future relation too, with no extra per-table checks to remember.
    if (err?.code === "P2003") {
      throw new AppError(409, messages.error.season.hasDependents);
    }
    throw err;
  }
}

// Used by the auto-deactivation cron job (not yet scheduled).
async function deactivateExpiredSeasons() {
  const result = await prisma.season.updateMany({
    where: {
      isActive: true,
      endDate: { lt: new Date() },
    },
    data: { isActive: false },
  });
  return result.count;
}

export default {
  listSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  deactivateExpiredSeasons,
};
