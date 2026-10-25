import { LeagueFormat } from "../../../../../prisma/generated/prisma/enums.ts";

const FORMAT_LABELS_FA: Record<LeagueFormat, string> = {
  GROUPS_KNOCKOUT: "گروهی + حذفی",
  SINGLE_GROUP_KNOCKOUT: "تک‌گروه + حذفی",
  KNOCKOUT_ONLY: "فقط حذفی",
};

function getAllFormats() {
  return (Object.values(LeagueFormat) as LeagueFormat[]).map((format) => ({
    value: format,
    label: FORMAT_LABELS_FA[format],
  }));
}

export default { getAllFormats };
