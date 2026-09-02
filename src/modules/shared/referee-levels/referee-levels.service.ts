import { RefreeLevel } from "../../../prisma/generated/prisma/enums.ts";

const LEVEL_LABELS_FA: Record<RefreeLevel, string> = {
  LEVEL_1: "درجه ۱",
  LEVEL_2: "درجه ۲",
  LEVEL_3: "درجه ۳",
  NATIONAL: "ملی",
};

function getAllLevels() {
  return (Object.values(RefreeLevel) as RefreeLevel[]).map((level) => ({
    value: level,
    label: LEVEL_LABELS_FA[level],
  }));
}

export default { getAllLevels };
