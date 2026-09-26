import { Role } from "../../../prisma/generated/prisma/enums.ts";

// Role now holds only domain values — all of them are assignable through
// a general-purpose dropdown. Admin standing lives in the separate
// AdminLevel / user_admins table and is never exposed here.
const ROLE_LABELS_FA: Record<Role, string> = {
  ORG_MANAGER: "مدیر باشگاه",
  COACH: "مربی",
  PLAYER: "بازیکن",
  REFEREE: "داور",
};

function getAllRoles() {
  return (Object.values(Role) as Role[]).map((role) => ({
    value: role,
    label: ROLE_LABELS_FA[role],
  }));
}

export default { getAllRoles };
