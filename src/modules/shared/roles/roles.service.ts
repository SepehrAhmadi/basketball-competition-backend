import { Role } from "../../../prisma/generated/prisma/enums.ts";

// SUPER_ADMIN, ADMIN and PUBLIC are intentionally excluded — these are not
// roles that should be assignable through a general-purpose dropdown.
// SUPER_ADMIN: seed-only, never assignable through any endpoint.
// ADMIN: sensitive role, must not be selectable through public UI.
// PUBLIC: default/non-operational role, not something a user explicitly picks.
const EXCLUDED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "PUBLIC"];

const ROLE_LABELS_FA: Record<Role, string> = {
  SUPER_ADMIN: "مدیر ارشد",
  ADMIN: "مدیر سیستم",
  ORG_MANAGER: "مدیر باشگاه",
  COACH: "مربی",
  PLAYER: "بازیکن",
  REFEREE: "داور",
  PUBLIC: "عمومی",
};

function getAllRoles() {
  return (Object.values(Role) as Role[])
    .filter((role) => !EXCLUDED_ROLES.includes(role))
    .map((role) => ({
      value: role,
      label: ROLE_LABELS_FA[role],
    }));
}

export default { getAllRoles };
