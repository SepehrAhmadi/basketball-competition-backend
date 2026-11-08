import { GameStatus } from "../../../../../prisma/generated/prisma/enums.ts";

const STATUS_LABELS_FA: Record<GameStatus, string> = {
  SCHEDULED: "برنامه‌ریزی‌شده",
  LIVE: "در حال برگزاری",
  FINISHED: "تمام‌شده",
  CANCELED: "کنسل‌شده",
};

function getAllStatuses() {
  return (Object.values(GameStatus) as GameStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS_FA[status],
  }));
}

export default { getAllStatuses };
