import type { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

export const LEAGUE_STATUS_VALUES = [
  "INACTIVE",
  "REGISTRATION",
  "ACTIVE",
  "FINISHED",
] as const;

export type LeagueStatusValue = (typeof LEAGUE_STATUS_VALUES)[number];

export function isRosterWindowOpen(
  rosterDeadline: Date | null,
  now: Date = new Date(),
): boolean {
  if (!rosterDeadline) return true;
  const todayInTehran = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
  }).format(now);
  const deadlineDay = rosterDeadline.toISOString().slice(0, 10);
  return todayInTehran <= deadlineDay;
}

export function canEditByStatus(
  status: LeagueStatus | LeagueStatusValue,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return status === "REGISTRATION" || status === "ACTIVE";
  return status === "REGISTRATION";
}

export function isPlayerAgeEligible(
  birthDate: Date | null,
  minBirthDate: Date,
): { ok: true } | { ok: false; reason: "BIRTH_DATE_MISSING" | "TOO_OLD" } {
  if (!birthDate) return { ok: false, reason: "BIRTH_DATE_MISSING" };
  if (birthDate.getTime() < minBirthDate.getTime())
    return { ok: false, reason: "TOO_OLD" };
  return { ok: true };
}

export default {
  LEAGUE_STATUS_VALUES,
  isRosterWindowOpen,
  canEditByStatus,
  isPlayerAgeEligible,
};
