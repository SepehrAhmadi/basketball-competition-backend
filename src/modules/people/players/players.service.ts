import prisma from "../../../config/db.config.ts";

async function getOwnProfile(userId: number) {
  return prisma.player.findUnique({ where: { userId } });
}

async function upsertOwnProfile(userId: number, data: any) {
  return prisma.player.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export default { getOwnProfile, upsertOwnProfile };
