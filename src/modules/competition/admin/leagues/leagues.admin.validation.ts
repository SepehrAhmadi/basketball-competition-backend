import "../../../../swagger/zod-extend.ts";
import { z } from "zod";
import {
  leagueIdParamSchema,
  adminLeagueListQuerySchema,
  createLeagueSchema,
  updateLeagueSchema,
  updateLeagueStatusSchema,
} from "../../leagues/leagues.validation.ts";

export {
  leagueIdParamSchema,
  adminLeagueListQuerySchema,
  createLeagueSchema,
  updateLeagueSchema,
  updateLeagueStatusSchema,
};

export type LeagueIdParam = z.infer<typeof leagueIdParamSchema>;
export type AdminLeagueListQuery = z.infer<typeof adminLeagueListQuerySchema>;
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>;
export type UpdateLeagueStatusInput = z.infer<typeof updateLeagueStatusSchema>;

export default {
  leagueIdParamSchema,
  adminLeagueListQuerySchema,
  createLeagueSchema,
  updateLeagueSchema,
  updateLeagueStatusSchema,
};
