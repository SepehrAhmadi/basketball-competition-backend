import { makeAdvisory, type Advisory } from "../../../../shared/advisory.ts";
import { messages } from "../../../../language/message.ts";
import type {
  GameActionDenial,
  GameActions,
  GamesLockReason,
} from "./games.rules.ts";

export type GamesLockCode = Exclude<GamesLockReason, null>;

export type GameWarningCode =
  | "RESULT_PENDING"
  | "UNSCHEDULED"
  | "HOME_AWAY_NOT_SWAPPED"
  | "OUTSIDE_LEAGUE_PERIOD";

export type GameWarning = Advisory<GameWarningCode>;

export type GameSummaryIssueCode = "UNFINISHED_GAMES";

export type GameActionLockCode = GameActionDenial;

const GAME_ACTION_LOCK_MESSAGES: Record<GameActionLockCode, string> = {
  FINISHED: messages.advisory.leagueFinished,
  LEAGUE_NOT_ACTIVE: messages.advisory.games.leagueNotActive,
  STATUS_LOCKED: messages.advisory.games.statusLocked,
  HAS_REPLACEMENT: messages.advisory.games.hasReplacement,
  DEPENDENT_STARTED: messages.advisory.games.dependentStarted,
};

export function buildGameLock(
  reason: GameActionDenial | null,
): Advisory<GameActionLockCode> | null {
  if (reason === null) return null;
  return makeAdvisory(
    reason,
    "BLOCKER",
    GAME_ACTION_LOCK_MESSAGES[reason],
    {},
  );
}

export function buildGameLocks(actions: GameActions) {
  return {
    scheduleLock: buildGameLock(actions.schedule),
    startLock: buildGameLock(actions.start),
    cancelLock: buildGameLock(actions.cancel),
    resultLock: buildGameLock(actions.result),
    deleteLock: buildGameLock(actions.delete),
  };
}

const GAMES_LOCK_MESSAGES: Record<GamesLockCode, string> = {
  FINISHED: messages.advisory.leagueFinished,
  LEAGUE_NOT_ACTIVE: messages.advisory.games.leagueNotActive,
  FORMAT_NOT_SET: messages.advisory.games.formatNotSet,
  FORMAT_NOT_GROUPED: messages.advisory.games.formatNotGrouped,
};

export function buildGamesLock(
  reason: GamesLockReason,
): Advisory<GamesLockCode> | null {
  if (reason === null) return null;
  return makeAdvisory(reason, "BLOCKER", GAMES_LOCK_MESSAGES[reason], {});
}

export function buildGameWarnings(input: {
  resultPending: boolean;
  unscheduled: boolean;
  homeAwayNotSwapped: boolean;
  outsideLeaguePeriod: boolean;
}): GameWarning[] {
  const warnings: GameWarning[] = [];
  if (input.resultPending)
    warnings.push(
      makeAdvisory(
        "RESULT_PENDING",
        "WARNING",
        messages.advisory.games.resultPending,
        {},
      ),
    );
  if (input.unscheduled)
    warnings.push(
      makeAdvisory(
        "UNSCHEDULED",
        "WARNING",
        messages.advisory.games.unscheduled,
        {},
      ),
    );
  if (input.homeAwayNotSwapped)
    warnings.push(
      makeAdvisory(
        "HOME_AWAY_NOT_SWAPPED",
        "WARNING",
        messages.advisory.games.homeAwayNotSwapped,
        {},
      ),
    );
  if (input.outsideLeaguePeriod)
    warnings.push(
      makeAdvisory(
        "OUTSIDE_LEAGUE_PERIOD",
        "WARNING",
        messages.advisory.games.outsideLeaguePeriod,
        {},
      ),
    );
  return warnings;
}

export function buildUnfinishedGamesIssues(
  count: number,
): Advisory<GameSummaryIssueCode>[] {
  if (count === 0) return [];
  return [
    makeAdvisory(
      "UNFINISHED_GAMES",
      "WARNING",
      messages.advisory.games.unfinishedGames,
      { count },
    ),
  ];
}
