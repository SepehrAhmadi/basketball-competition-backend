import { LeagueStatus } from "../../../prisma/generated/prisma/enums.ts";

const STATUS_LABELS_FA: Record<LeagueStatus, string> = {
  INACTIVE: "غیرفعال",
  REGISTRATION: "در حال ثبت‌نام",
  ACTIVE: "در جریان",
  FINISHED: "تمام‌شده",
};

function getAllStatuses() {
  return (Object.values(LeagueStatus) as LeagueStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS_FA[status],
  }));
}

export default { getAllStatuses };
