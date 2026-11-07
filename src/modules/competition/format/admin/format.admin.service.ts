import prisma from "../../../../config/db.config.ts";
import AppError from "../../../../utils/appError.ts";
import { messages } from "../../../../language/message.ts";
import type {
  GroupRoundType,
  LeagueFormat,
  LeagueStatus,
} from "../../../../prisma/generated/prisma/enums.ts";
import {
  evaluateFormatChange,
  getFormatLockReason,
  normalizeFormatInput,
  type FormatInput,
} from "../lib/format.rules.ts";
import { buildFormatLock } from "../lib/format.advisories.ts";

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


function toFormatResponse(row: FormatRow, hasGames: boolean) {
  const lock = buildFormatLock(getFormatLockReason(row.status, hasGames));
  return {
    leagueId: row.id,
    format: row.format,
    winPoints: row.winPoints,
    lossPoints: row.lossPoints,
    groupRoundType: row.groupRoundType,
    defaultQualifiersPerGroup: row.defaultQualifiersPerGroup,
    lock,
  };
}

async function getFormat(leagueId: number) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: formatSelect,
  });
  if (!league) throw new AppError(404, messages.error.league.notFound);
  const gameCount = await prisma.game.count({ where: { leagueId } });
  return toFormatResponse(league, gameCount > 0);
}

async function updateFormat(leagueId: number, input: FormatInput) {
  const existing = await prisma.league.findUnique({
    where: { id: leagueId },
    select: formatSelect,
  });
  if (!existing) throw new AppError(404, messages.error.league.notFound);
  const gameCount = await prisma.game.count({ where: { leagueId } });
  const lockReason = getFormatLockReason(existing.status, gameCount > 0);
  if (lockReason === "FINISHED")
    throw new AppError(409, messages.error.league.finishedLocked);
  if (lockReason === "HAS_GAMES")
    throw new AppError(409, messages.error.leagueFormat.locked);

  const groupCount = await prisma.group.count({ where: { leagueId } });
  const groupCheck = evaluateFormatChange(input.format, groupCount);
  if (!groupCheck.allowed)
    throw new AppError(
      409,
      groupCheck.reason === "HAS_GROUPS"
        ? messages.error.leagueFormat.hasGroups
        : messages.error.leagueFormat.tooManyGroups,
    );

  const data = normalizeFormatInput(input);

  try {
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data,
      select: formatSelect,
    });
    return toFormatResponse(updated, false);
  } catch (err: any) {
    if (err?.code === "P2025")
      throw new AppError(404, messages.error.league.notFound);
    throw err;
  }
}

export default {
  getFormat,
  updateFormat,
};
