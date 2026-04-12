/**
 * Timestamp formatting — shared by Card.svelte, AgentInvocationCard.svelte,
 * and any other component that shows record timestamps.
 *
 * Display format: "2026-04-11 14:32:45" (date + time, host timezone)
 * Tooltip: full ISO timestamp on hover (title attribute)
 */

/**
 * Format an ISO timestamp string into a human-readable date + time string
 * using the host machine's locale and timezone. Returns e.g. "04/11 2:32:45 PM"
 * or "2026-04-11 14:32:45" depending on locale.
 *
 * Uses a consistent format across locales via Intl for the date part so the
 * user always sees year-month-day ordering, then the locale-native time.
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // pass through malformed timestamps

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const time = d.toLocaleTimeString(); // host locale + timezone

  return `${year}-${month}-${day} ${time}`;
}

/**
 * Format just the time portion for compact card headers where the date
 * is implied by context (e.g. within a single workflow run).
 */
export function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
}
