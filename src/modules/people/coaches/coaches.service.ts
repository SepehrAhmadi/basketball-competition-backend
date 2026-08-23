import prisma from "../../../config/db.config.ts";

async function getOwnProfile(userId: number) {
  return prisma.coach.findUnique({ where: { userId } });
}

async function upsertOwnProfile(userId: number, data: any) {
  return prisma.coach.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export default { getOwnProfile, upsertOwnProfile };
