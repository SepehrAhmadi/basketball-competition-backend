import prisma from "../../../../../config/db.config.ts";
import AppError from "../../../../../utils/appError.ts";
import { messages } from "../../../../../language/message.ts";
import { jalaliToGregorian } from "../../../../../utils/date.util.ts";
import {
  leagueInclude,
  toLeagueResponse,
} from "../../../shared/league.mapper.ts";
import {
  autoAdvanceExpiredRegistrations,
  assertRegistrationAllowed,
  initialStatusForDeadline,
  maybeAdvanceSingleLeague,
} from "../../../shared/league.auto.ts";

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

// TODO(Game): block leaving ACTIVE backwards with 409 once games exist.
async function assertNoGames(_leagueId: number) {
}

function assertDateOrder(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new AppError(400, messages.error.league.endDateBeforeStartDate);
  }
}

async function listLeagues(query: AdminLeagueListQuery) {
  // Lifecycle: REGISTRATION → ACTIVE once the deadline passes.
  // Best-effort so reads never fail because of the background promotion.
  try {
    await autoAdvanceExpiredRegistrations();
  } catch {}
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.seasonId || query.ageCategoryId) {
    where.ageCategoryCutoff = {};
    if (query.seasonId) where.ageCategoryCutoff.seasonId = query.seasonId;
    if (query.ageCategoryId)
      where.ageCategoryCutoff.ageCategoryId = query.ageCategoryId;
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
  const effectiveStatus = await maybeAdvanceSingleLeague(league).catch(
    () => league.status,
  );
  return toLeagueResponse({ ...league, status: effectiveStatus } as any);
}

async function createLeague(input: CreateLeagueInput) {
  const cutoff = await prisma.ageCategoryCutoff.findUnique({
    where: { id: input.ageCategoryCutoffId },
  });
  if (!cutoff)
    throw new AppError(404, messages.error.ageCategoryCutoff.notFound);

  const startDate = input.startDate ? jalaliToGregorian(input.startDate) : null;
  const endDate = input.endDate ? jalaliToGregorian(input.endDate) : null;
  assertDateOrder(startDate, endDate);

  const dup = await prisma.league.findFirst({
    where: { ageCategoryCutoffId: input.ageCategoryCutoffId, name: input.name },
  });
  if (dup) throw new AppError(409, messages.error.league.nameExists);

  try {
    const rosterDeadline = input.rosterDeadline
      ? jalaliToGregorian(input.rosterDeadline)
      : null;
    const created = await prisma.league.create({
      data: {
        name: input.name,
        ageCategoryCutoffId: input.ageCategoryCutoffId,
        // No deadline → INACTIVE; today/future deadline → REGISTRATION;
        // past deadline → INACTIVE (admin may still override manually).
        status: initialStatusForDeadline(rosterDeadline),
        startDate,
        endDate,
        rosterDeadline,
        description: input.description ?? null,
      },
      include: leagueInclude,
    });
    // If created with an already-past deadline, apply the default lifecycle.
    const effectiveStatus = await maybeAdvanceSingleLeague(created).catch(
      () => created.status,
    );
    return toLeagueResponse({ ...created, status: effectiveStatus } as any);
  } catch (err: any) {
    if (err?.code === "P2002")
      throw new AppError(409, messages.error.league.nameExists);
    throw err;
  }
}

async function updateLeague(leagueId: number, input: UpdateLeagueInput) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status === "FINISHED")
    throw new AppError(409, messages.error.league.finishedLocked);

  const finalCutoffId =
    input.ageCategoryCutoffId ?? existing.ageCategoryCutoffId;

  if (
    input.ageCategoryCutoffId !== undefined &&
    input.ageCategoryCutoffId !== existing.ageCategoryCutoffId
  ) {
    if (existing.status === "ACTIVE")
      throw new AppError(409, messages.error.league.cutoffLocked);
    const activeTeams = await prisma.leagueTeam.count({
      where: { leagueId, status: "ACTIVE" },
    });
    if (activeTeams > 0)
      throw new AppError(409, messages.error.league.cutoffLocked);
    const cutoff = await prisma.ageCategoryCutoff.findUnique({
      where: { id: input.ageCategoryCutoffId },
    });
    if (!cutoff)
      throw new AppError(404, messages.error.ageCategoryCutoff.notFound);
  }

  const newStart =
    input.startDate !== undefined
      ? input.startDate
        ? jalaliToGregorian(input.startDate)
        : null
      : existing.startDate;
  const newEnd =
    input.endDate !== undefined
      ? input.endDate
        ? jalaliToGregorian(input.endDate)
        : null
      : existing.endDate;
  assertDateOrder(newStart, newEnd);

  const newName = input.name ?? existing.name;
  const newDeadline =
    input.rosterDeadline !== undefined
      ? input.rosterDeadline
        ? jalaliToGregorian(input.rosterDeadline)
        : null
      : existing.rosterDeadline;
  const newDescription =
    input.description !== undefined ? input.description : existing.description;

  const nameChanged =
    newName !== existing.name || finalCutoffId !== existing.ageCategoryCutoffId;
  if (nameChanged) {
    const dup = await prisma.league.findFirst({
      where: {
        ageCategoryCutoffId: finalCutoffId,
        name: newName,
        id: { not: leagueId },
      },
    });
    if (dup) throw new AppError(409, messages.error.league.nameExists);
  }

  const startChanged =
    (newStart?.getTime() ?? null) !== (existing.startDate?.getTime() ?? null);
  const endChanged =
    (newEnd?.getTime() ?? null) !== (existing.endDate?.getTime() ?? null);
  const deadlineChanged =
    (newDeadline?.getTime() ?? null) !==
    (existing.rosterDeadline?.getTime() ?? null);
  const descChanged = newDescription !== existing.description;

  if (!nameChanged && !startChanged && !endChanged && !deadlineChanged && !descChanged)
    return toLeagueResponse(existing);

  try {
    // Keep the stored status consistent with the deadline rule:
    // clearing the deadline while REGISTRATION → INACTIVE; setting a
    // today/future deadline while INACTIVE → REGISTRATION.
    let nextStatus = existing.status;
    if (deadlineChanged) {
      if (!newDeadline && existing.status === "REGISTRATION") {
        nextStatus = "INACTIVE";
      } else if (
        newDeadline &&
        existing.status === "INACTIVE" &&
        initialStatusForDeadline(newDeadline) === "REGISTRATION"
      ) {
        nextStatus = "REGISTRATION";
      }
    }
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
    // If the deadline was moved to the past, apply the default lifecycle.
    const effectiveStatus = await maybeAdvanceSingleLeague(updated).catch(
      () => updated.status,
    );
    return toLeagueResponse({ ...updated, status: effectiveStatus } as any);
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
  adminLevel: string | null | undefined,
) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    include: leagueInclude,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status === status) return toLeagueResponse(existing);

  if (existing.status === "FINISHED" && adminLevel !== "SUPER_ADMIN")
    throw new AppError(403, messages.error.league.statusChangeForbidden);

  // REGISTRATION is only allowed with no deadline or a today-or-future one.
  if (status === "REGISTRATION") {
    assertRegistrationAllowed(existing.rosterDeadline);
  }

  if (status === "ACTIVE") {
    const teams = await prisma.leagueTeam.findMany({
      where: {
        leagueId,
        status: "ACTIVE",
        team: { status: { not: "DELETED" } },
      },
      include: {
        _count: {
          select: {
            members: {
              where: {
                status: "ACTIVE",
                teamSeasonMember: { role: "PLAYER" },
              },
            },
          },
        },
      },
    });
    if (teams.length < 2)
      throw new AppError(409, messages.error.league.minTeamsRequired);
    const withoutPlayers = teams.some((t) => t._count.members === 0);
    if (withoutPlayers)
      throw new AppError(409, messages.error.league.teamWithoutPlayers);
  }

  if (
    existing.status === "ACTIVE" &&
    (status === "REGISTRATION" || status === "INACTIVE")
  ) {
    await assertNoGames(leagueId);
  }

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
