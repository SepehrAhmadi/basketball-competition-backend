import { withPublicLogoUrl } from "../../../utils/files.ts";
import { gregorianToJalali } from "../../../utils/date.util.ts";

// Public team shape: absolute logo URL and a Jalali founded date.
export function toPublicTeam<
  T extends { logoUrl: string | null; foundedDate: Date | null },
>(team: T) {
  return {
    ...withPublicLogoUrl(team),
    foundedDate: gregorianToJalali(team.foundedDate),
  };
}
