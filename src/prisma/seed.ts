import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../config/db.config.ts";

const SUPER_ADMIN_EMAIL = "admin@example.com";
const SUPER_ADMIN_PHONE = "09120000000";
const SUPER_ADMIN_PASSWORD = "Admin@1234";

const ADMIN_EMAIL = "admin2@example.com";
const ADMIN_PHONE = "09120000001";
const ADMIN_PASSWORD = "Admin@1234";

async function upsertAdmin(
  email: string,
  phone: string,
  fullName: string,
  password: string,
  level: "ADMIN" | "SUPER_ADMIN",
) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      fullName,
      phone,
      email,
      passwordHash,
    },
  });

  await prisma.userAdmin.upsert({
    where: { userId: user.id },
    update: { level },
    create: { userId: user.id, level },
  });

  console.log(`${level} user ready: ${email}`);
}

async function main() {
  await upsertAdmin(
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PHONE,
    "Super Admin",
    SUPER_ADMIN_PASSWORD,
    "SUPER_ADMIN",
  );
  await upsertAdmin(
    ADMIN_EMAIL,
    ADMIN_PHONE,
    "Admin",
    ADMIN_PASSWORD,
    "ADMIN",
  );
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
