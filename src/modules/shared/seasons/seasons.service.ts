import prisma from "../../../config/db.config.ts";
import { gregorianToJalali } from "../../../utils/date.util.ts";

async function getAllSeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
  });

  return seasons.map((season) => ({
    value: season.id,
    label:
      gregorianToJalali(season.startDate) +
      " - " +
      gregorianToJalali(season.endDate),
  }));
}

export default { getAllSeasons };
