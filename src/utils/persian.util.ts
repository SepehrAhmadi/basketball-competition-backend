// Persian text normalization: trim + map Arabic ي/ك to Persian ی/ک so values
// typed with a different keyboard still match stored text written in Persian.
export function normalizePersianText(value: string): string {
  return value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک");
}
