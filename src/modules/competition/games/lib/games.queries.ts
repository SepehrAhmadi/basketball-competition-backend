import type { Prisma } from "../../../../prisma/generated/prisma/client.ts";

export const gameTeamInclude = {
  team: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      status: true,
      organization: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LeagueTeamInclude;

export type GameTeamRow = Prisma.LeagueTeamGetPayload<{
  include: typeof gameTeamInclude;
}>;

export const gameInclude = {
  group: { select: { id: true, name: true } },
  homeTeam: { include: gameTeamInclude },
  awayTeam: { include: gameTeamInclude },
  forfeitTeam: { select: { id: true } },
  rescheduledFrom: { select: { id: true, status: true } },
  rescheduledTo: { select: { id: true, status: true } },
} satisfies Prisma.GameInclude;

export type GameRow = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

export const gameListInclude = {
  group: { select: { id: true, name: true } },
  homeTeam: { include: gameTeamInclude },
  awayTeam: { include: gameTeamInclude },
} satisfies Prisma.GameInclude;

export type GameListRow = Prisma.GameGetPayload<{
  include: typeof gameListInclude;
}>;
