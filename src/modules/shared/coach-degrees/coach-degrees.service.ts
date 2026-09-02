import { CoachDegree } from "../../../prisma/generated/prisma/enums.ts";

const DEGREE_LABELS_FA: Record<CoachDegree, string> = {
  LEVEL_1: "درجه ۱",
  LEVEL_2: "درجه ۲",
  LEVEL_3: "درجه ۳",
  NATIONAL: "ملی",
};

function getAllDegrees() {
  return (Object.values(CoachDegree) as CoachDegree[]).map((degree) => ({
    value: degree,
    label: DEGREE_LABELS_FA[degree],
  }));
}

export default { getAllDegrees };
