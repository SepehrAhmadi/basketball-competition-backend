import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../config/db.config.ts";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PHONE = "09120000000";
const ADMIN_PASSWORD = "Admin@1234";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      fullName: "Admin",
      phone: ADMIN_PHONE,
      email: ADMIN_EMAIL,
      passwordHash,
      roles: { create: { role: "ADMIN" } },
    },
    include: { roles: true },
  });

  if (!admin.roles.some((role) => role.role === "ADMIN")) {
    await prisma.userRole.create({
      data: { userId: admin.id, role: "ADMIN" },
    });
  }

  console.log(`Admin user ready: ${admin.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
