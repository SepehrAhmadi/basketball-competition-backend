import { GroupRoundType } from "../../../../../prisma/generated/prisma/enums.ts";

const ROUND_TYPE_LABELS_FA: Record<GroupRoundType, string> = {
  ONE_ROUND: "یک‌دوره (همه با همه)",
  DOUBLE_ROUND: "رفت و برگشت",
};

function getAllRoundTypes() {
  return (Object.values(GroupRoundType) as GroupRoundType[]).map(
    (roundType) => ({
      value: roundType,
      label: ROUND_TYPE_LABELS_FA[roundType],
    }),
  );
}

export default { getAllRoundTypes };
