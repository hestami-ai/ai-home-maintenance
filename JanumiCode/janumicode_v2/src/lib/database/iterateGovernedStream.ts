/**
 * Pagination generator for prepared SQL statements that already embed
 * `LIMIT ? OFFSET ?` placeholders at the END of their parameter list.
 *
 * Standardizes the LIMIT/OFFSET loop previously duplicated across
 * `governedStreamViewProvider.streamSnapshot`, `collectHarnessResult`,
 * and `lineageValidator.getRecordsForRun`. Centralizing it gives every
 * caller the same backstop against the 32MB SAB-bridge ceiling
 * enforced by the sidecar RPC layer (see `dbServerLimits.ts`).
 *
 * Usage:
 *   const stmt = db.prepare(
 *     `SELECT ... FROM governed_stream
 *       WHERE workflow_run_id = ?
 *       ORDER BY produced_at ASC
 *       LIMIT ? OFFSET ?`,
 *   );
 *   for (const batch of iterateGovernedStream<Row>(stmt, [runId])) {
 *     for (const row of batch) { ... }
 *   }
 *
 * Or to accumulate (drop-in replacement for `.all(runId)`):
 *   const rows = collectGovernedStream<Row>(stmt, [runId]);
 */

import type { Statement } from './init';

export interface IteratePageOptions {
  /** Rows per page. Default 500. Pick smaller (≈200) for wide-content rows. */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 500;

/**
 * Yields the prepared statement's rows in pageSize-sized batches. The
 * statement's SQL must end in `LIMIT ? OFFSET ?` and `params` should
 * contain only the WHERE-clause bindings — the pagination params are
 * appended automatically.
 */
export function* iterateGovernedStream<T = Record<string, unknown>>(
  stmt: Statement,
  params: readonly unknown[],
  opts: IteratePageOptions = {},
): Generator<T[], void, void> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  let offset = 0;
  while (true) {
    const batch = stmt.all(...params, pageSize, offset) as T[];
    if (batch.length === 0) break;
    yield batch;
    if (batch.length < pageSize) break;
    offset += batch.length;
  }
}

/**
 * Convenience wrapper that flattens `iterateGovernedStream` into a
 * single accumulated array — for callers that today do `.all(...)`
 * and consume the whole list, since changing them to streaming
 * consumption is a larger refactor than this round wants.
 */
export function collectGovernedStream<T = Record<string, unknown>>(
  stmt: Statement,
  params: readonly unknown[],
  opts: IteratePageOptions = {},
): T[] {
  const out: T[] = [];
  for (const batch of iterateGovernedStream<T>(stmt, params, opts)) {
    for (const row of batch) out.push(row);
  }
  return out;
}
