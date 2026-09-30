import prisma from "../config/db.config.ts";

export interface Membership {
  role: "COACH" | "PLAYER";
  isHeadCoach: boolean;
}

export interface Actor {
  userId: number | null;
  isAdmin: boolean;
  managedOrgIds: ReadonlySet<number>;
  memberOrgIds: ReadonlySet<number>;
  membershipFor(teamId: number, seasonId: number): Membership | undefined;
}

function emptyMembershipLookup(): (teamId: number, seasonId: number) => Membership | undefined {
  return () => undefined;
}

export const guestActor: Actor = {
  userId: null,
  isAdmin: false,
  managedOrgIds: new Set<number>(),
  memberOrgIds: new Set<number>(),
  membershipFor: emptyMembershipLookup(),
};

export async function loadActor(userId: number, adminLevel: string | null): Promise<Actor> {
  const [managerRows, memberRows] = await Promise.all([
    prisma.organizationManager.findMany({
      where: { userId },
      select: { organizationId: true },
    }),
    prisma.teamSeasonMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        organizationId: true,
        teamId: true,
        seasonId: true,
        role: true,
        isHeadCoach: true,
      },
    }),
  ]);

  const managedOrgIds = new Set<number>(managerRows.map((r) => r.organizationId));
  const memberOrgIds = new Set<number>();
  const membershipByKey = new Map<string, Membership>();

  for (const m of memberRows) {
    memberOrgIds.add(m.organizationId);
    membershipByKey.set(`${m.teamId}:${m.seasonId}`, {
      role: m.role,
      isHeadCoach: m.isHeadCoach,
    });
  }

  return {
    userId,
    isAdmin: adminLevel != null,
    managedOrgIds,
    memberOrgIds,
    membershipFor: (teamId: number, seasonId: number) =>
      membershipByKey.get(`${teamId}:${seasonId}`),
  };
}
