import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import type {
  GroupRoundType,
  LeagueFormat,
  LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import {
  normalizeFormatInput,
  type FormatInput,
  type FormatLockReason,
} from "../lib/format.rules.ts";

const formatSelect = {
  id: true,
  status: true,
  format: true,
  winPoints: true,
  lossPoints: true,
  groupRoundType: true,
  defaultQualifiersPerGroup: true,
} as const;

type FormatRow = {
  id: number;
  status: LeagueStatus;
  format: LeagueFormat | null;
  winPoints: number;
  lossPoints: number;
  groupRoundType: GroupRoundType | null;
  defaultQualifiersPerGroup: number | null;
};

function getLockReason(status: LeagueStatus): FormatLockReason {
  return status === "FINISHED" ? "FINISHED" : null;
}

function toFormatResponse(row: FormatRow) {
  const lockReason = getLockReason(row.status);
  return {
    leagueId: row.id,
    format: row.format,
    winPoints: row.winPoints,
    lossPoints: row.lossPoints,
    groupRoundType: row.groupRoundType,
    defaultQualifiersPerGroup: row.defaultQualifiersPerGroup,
    can: { edit: lockReason === null },
    lockReason,
  };
}

async function getFormat(leagueId: number) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: formatSelect,
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  return toFormatResponse(league);
}

async function updateFormat(leagueId: number, input: FormatInput) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    select: formatSelect,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  if (existing.status === "FINISHED")
    throw new AppError(409, messages.error.league.finishedLocked);

  // TODO(Game): block with a direct prisma.game.count({ where: { leagueId } })
  // > 0 → 409 messages.error.leagueFormat.locked once games exist (Stage 3).
  // TODO(Group): block switching to KNOCKOUT_ONLY while groups exist (Stage 2).

  const data = normalizeFormatInput(input);

  try {
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data,
      select: formatSelect,
    });
    return toFormatResponse(updated);
  } catch (err: any) {
    if (err?.code === "P2025")
      throw new AppError(404, messages.error.league.notFound);
    throw err;
  }
}

export default {
  getFormat,
  updateFormat,
  toFormatResponse,
};
