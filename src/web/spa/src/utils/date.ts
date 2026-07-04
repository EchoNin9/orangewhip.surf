/**
 * Parse an ISO date string. Date-only strings ("2026-09-11") are treated as
 * LOCAL midnight instead of UTC midnight — otherwise every show date renders
 * one day early west of Greenwich. Full ISO timestamps pass through unchanged.
 */
export function parseDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}
