// Structured "why" data returned next to `can` flags. An advisory is output
// data only: pure rules keep returning internal codes, mappers turn those
// codes into advisories at the response boundary.
export type AdvisorySeverity = "INFO" | "WARNING" | "BLOCKER";

export type AdvisoryParams = Record<
  string,
  string | number | boolean | null
>;

export interface Advisory<C extends string = string> {
  code: C;
  severity: AdvisorySeverity;
  message: string;
  params: AdvisoryParams;
}

export function makeAdvisory<C extends string>(
  code: C,
  severity: AdvisorySeverity,
  message: string,
  params: AdvisoryParams = {},
): Advisory<C> {
  return { code, severity, message, params };
}
