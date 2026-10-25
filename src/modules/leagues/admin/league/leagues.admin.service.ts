import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import type { Prisma } from "../../../../prisma/generated/prisma/client.ts";
import {
  jalaliToGregorianOrNull,
  sameDate,
} from "../../../../utils/date.util.ts";
import {
  leagueInclude,
  toLeagueResponse,
} from "../../lib/league.mapper.ts";
import {
  advanceLeagueIfExpired,
  assertRegistrationAllowed,
  checkActiveRequirements,
  initialStatusForDeadline,
} from "../../lib/league.lifecycle.ts";

interface AdminLeagueListQuery {
  page: number;
  pageSize: number;
  status?: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED";
  seasonId?: number;
  ageCategoryId?: number;
  search?: string;
}

interface CreateLeagueInput {
  name: string;
  ageCategoryCutoffId: number;
  startDate?: string | null;
  endDate?: string | null;
  rosterDeadline?: string | null;
  description?: string | null;
}

interface UpdateLeagueInput {
  name?: string;
  ageCategoryCutoffId?: number;
  startDate?: string | null;
  endDate?: string | null;
  rosterDeadline?: string | null;
  description?: string | null;
}

function assertDateOrder(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new AppError(400, messages.error.league.endDateBeforeStartDate);
  }
}

async function listLeagues(query: AdminLeagueListQuery) {
  // Reads use the stored status; promotion is owned by the background job.
  const where: Prisma.LeagueWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.seasonId || query.ageCategoryId) {
    where.ageCategoryCutoff = {
      ...(query.seasonId ? { seasonId: query.seasonId } : {}),
      ...(query.ageCategoryId ? { ageCategoryId: query.ageCategoryId } : {}),
    };
  }
  const search = query.search?.trim();
  if (search) where.name = { contains: search };

  const [items, total] = await prisma.$transaction([
    prisma.league.findMany({
      where,
      orderBy: [{ id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: leagueInclude,
    }),
    prisma.league.count({ where }),
  ]);

  return {
    items: items.map(toLeagueResponse),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getLeagueById(leagueId: number) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  return toLeagueResponse(league);
}

async function createLeague(input: CreateLeagueInput) {
  const cutoff = await prisma.ageCategoryCutoff.findUnique({
    where: { id: input.ageCategoryCutoffId },
  });
  if (!cutoff)
    throw new AppError(404, messages.error.ageCategoryCutoff.notFound);

  const startDate = jalaliToGregorianOrNull(input.startDate);
  const endDate = jalaliToGregorianOrNull(input.endDate);
  assertDateOrder(startDate, endDate);

  const dup = await prisma.league.findFirst({
    where: { ageCategoryCutoffId: input.ageCategoryCutoffId, name: input.name },
  });
  if (dup) throw new AppError(409, messages.error.league.nameExists);

  try {
    const rosterDeadline = jalaliToGregorianOrNull(input.rosterDeadline);
    const created = await prisma.league.create({
      data: {
        name: input.name,
        ageCategoryCutoffId: input.ageCategoryCutoffId,
        // No deadline or past deadline → INACTIVE; today/future deadline →
        // REGISTRATION. A fresh row can never be promotable, so no
        // lifecycle call is needed here.
        status: initialStatusForDeadline(rosterDeadline),
        startDate,
        endDate,
        rosterDeadline,
        description: input.description ?? null,
      },
      include: leagueInclude,
    });
    return toLeagueResponse(created);
  } catch (err: any) {
    if (err?.code === "P2002")
      throw new AppError(409, messages.error.league.nameExists);
    throw err;
  }
}

/** Rejects cutoff changes once the league has ACTIVE teams. */
async function assertCutoffChangeAllowed(
  leagueId: number,
  existing: { status: string },
  nextCutoffId: number | undefined,
  currentCutoffId: number,
): Promise<number> {
  const finalCutoffId = nextCutoffId ?? currentCutoffId;
  if (nextCutoffId === undefined || nextCutoffId === currentCutoffId)
    return finalCutoffId;
  if (existing.status === "ACTIVE")
    throw new AppError(409, messages.error.league.cutoffLocked);
  const activeTeams = await prisma.leagueTeam.count({
    where: { leagueId, status: "ACTIVE" },
  });
  if (activeTeams > 0)
    throw new AppError(409, messages.error.league.cutoffLocked);
  const cutoff = await prisma.ageCategoryCutoff.findUnique({
    where: { id: nextCutoffId },
  });
  if (!cutoff)
    throw new AppError(404, messages.error.ageCategoryCutoff.notFound);
  return finalCutoffId;
}

/** Rejects duplicate league names within the same cutoff. */
async function assertUniqueName(
  leagueId: number,
  finalCutoffId: number,
  newName: string,
): Promise<void> {
  const dup = await prisma.league.findFirst({
    where: {
      ageCategoryCutoffId: finalCutoffId,
      name: newName,
      id: { not: leagueId },
    },
  });
  if (dup) throw new AppError(409, messages.error.league.nameExists);
}

/** Next stored status when the deadline changes (clearing demotes to INACTIVE). */
function resolveNextStatusOnDeadlineChange(
  currentStatus: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED",
  newDeadline: Date | null,
): "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED" {
  if (!newDeadline && currentStatus === "REGISTRATION") return "INACTIVE";
  if (
    newDeadline &&
    currentStatus === "INACTIVE" &&
    initialStatusForDeadline(newDeadline) === "REGISTRATION"
  )
    return "REGISTRATION";
  return currentStatus;
}

async function updateLeague(leagueId: number, input: UpdateLeagueInput) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status === "FINISHED")
    throw new AppError(409, messages.error.league.finishedLocked);

  const finalCutoffId = await assertCutoffChangeAllowed(
    leagueId,
    existing,
    input.ageCategoryCutoffId,
    existing.ageCategoryCutoffId,
  );

  const newStart =
    input.startDate !== undefined
      ? jalaliToGregorianOrNull(input.startDate)
      : existing.startDate;
  const newEnd =
    input.endDate !== undefined
      ? jalaliToGregorianOrNull(input.endDate)
      : existing.endDate;
  assertDateOrder(newStart, newEnd);

  const newName = input.name ?? existing.name;
  const newDeadline =
    input.rosterDeadline !== undefined
      ? jalaliToGregorianOrNull(input.rosterDeadline)
      : existing.rosterDeadline;
  const newDescription =
    input.description !== undefined ? input.description : existing.description;

  const nameChanged =
    newName !== existing.name || finalCutoffId !== existing.ageCategoryCutoffId;
  if (nameChanged) await assertUniqueName(leagueId, finalCutoffId, newName);

  const startChanged = !sameDate(newStart, existing.startDate);
  const endChanged = !sameDate(newEnd, existing.endDate);
  const deadlineChanged = !sameDate(newDeadline, existing.rosterDeadline);
  const descChanged = newDescription !== existing.description;

  if (!nameChanged && !startChanged && !endChanged && !deadlineChanged && !descChanged)
    return toLeagueResponse(existing);

  try {
    // Keep the stored status consistent with the deadline rule.
    const nextStatus = deadlineChanged
      ? resolveNextStatusOnDeadlineChange(existing.status, newDeadline)
      : existing.status;
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: {
        name: newName,
        ageCategoryCutoffId: finalCutoffId,
        startDate: newStart,
        endDate: newEnd,
        rosterDeadline: newDeadline,
        description: newDescription,
        status: nextStatus,
      },
      include: leagueInclude,
    });
    // If the deadline moved to the past, promote once after the write.
    await advanceLeagueIfExpired(updated.id).catch((err) =>
      console.error("[league-lifecycle] advanceLeagueIfExpired failed", err),
    );
    const fresh = await prisma.league.findUnique({
      where: { id: leagueId },
      include: leagueInclude,
    });
    return toLeagueResponse(fresh ?? updated);
  } catch (err: any) {
    if (err?.code === "P2002")
      throw new AppError(409, messages.error.league.nameExists);
    if (err?.code === "P2025")
      throw new AppError(404, messages.error.league.notFound);
    throw err;
  }
}

async function deleteLeague(leagueId: number) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status !== "INACTIVE" && existing.status !== "REGISTRATION")
    throw new AppError(409, messages.error.league.deleteNotAllowed);

  const activeTeams = await prisma.leagueTeam.count({
    where: { leagueId, status: "ACTIVE" },
  });
  if (activeTeams > 0)
    throw new AppError(409, messages.error.league.hasTeams);

  try {
    await prisma.$transaction([
      prisma.leagueTeamMember.deleteMany({
        where: { leagueTeam: { leagueId } },
      }),
      prisma.leagueTeam.deleteMany({ where: { leagueId } }),
      prisma.league.delete({ where: { id: leagueId } }),
    ]);
  } catch (err: any) {
    if (err?.code === "P2003")
      throw new AppError(409, messages.error.league.hasDependents);
    if (err?.code === "P2025")
      throw new AppError(404, messages.error.league.notFound);
    throw err;
  }
}

async function updateLeagueStatus(
  leagueId: number,
  status: "INACTIVE" | "REGISTRATION" | "ACTIVE" | "FINISHED",
  canReopenFinished: boolean,
) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status === status) return toLeagueResponse(existing);

  if (existing.status === "FINISHED" && !canReopenFinished)
    throw new AppError(403, messages.error.league.statusChangeForbidden);

  // REGISTRATION requires a today-or-future deadline.
  if (status === "REGISTRATION") {
    assertRegistrationAllowed(existing.rosterDeadline);
  }

  if (status === "ACTIVE") {
    const check = await checkActiveRequirements(leagueId);
    if (!check.ok) {
      throw new AppError(
        409,
        check.reason === "MIN_TEAMS"
          ? messages.error.league.minTeamsRequired
          : messages.error.league.teamWithoutPlayers,
      );
    }
  }

  // TODO(Game): block leaving ACTIVE backwards with 409 once games exist.
  void leagueId;

  try {
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: { status },
      include: leagueInclude,
    });
    return toLeagueResponse(updated);
  } catch (err: any) {
    if (err?.code === "P2025")
      throw new AppError(404, messages.error.league.notFound);
    throw err;
  }
}

export default {
  listLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
  updateLeagueStatus,
};
