/**
 * Replay driver — Tier-1 live-append stressor.
 *
 * Reads a recorded run's `governed_stream` rows from a (read-only, prepared)
 * calibration clone in `produced_at` order and re-emits them as `record:added`
 * events on a timer. The GovernedStreamViewProvider's existing `record:added`
 * subscriber forwards each as an `addRecord` postMessage — exactly the path a
 * live run takes — so this exercises the webview store's per-record `add()`
 * (the O(n²) hot path the pagination fix targets) without any engine, LLM, or
 * GPU activity.
 *
 * Used only when `JANUMICODE_REPLAY_APPEND=1`. In that mode the provider starts
 * the view EMPTY (it skips the full snapshot) so every re-emitted record is a
 * genuinely fresh delta to the store rather than a duplicate of a snapshot row.
 *
 * Paging is KEYSET by rowid (not LIMIT/OFFSET). rowid is the implicit integer
 * PK — monotonic with insertion, ~chronological — so `rowid > cursor` is an
 * index range scan: O(log n + batch) per tick, no filesort. (An earlier
 * `ORDER BY produced_at, id LIMIT/OFFSET` version filesorted the whole run's
 * content on every batch — catastrophic at small batch sizes.) Exact emit
 * order doesn't matter: the store re-sorts to conversational order on add().
 */

import { getLogger } from '../logging';
import type { Database } from '../database/init';
import type { EventBus, SerializedRecord } from '../events/eventBus';

export interface ReplayDriverOptions {
  db: Database;
  eventBus: EventBus;
  /** Workflow run to replay (the resolved cal-40 run id). */
  runId: string;
  /** Milliseconds between batches. Default 12; env JANUMICODE_REPLAY_APPEND_INTERVAL_MS. */
  intervalMs?: number;
  /** Records emitted per tick. Default 3; env JANUMICODE_REPLAY_APPEND_BATCH. */
  batchSize?: number;
  /** Called once all records have been emitted. */
  onDone?: () => void;
}

/** Map a raw governed_stream row to the minimal record shape the webview reads. */
function serializeRow(row: Record<string, unknown>): SerializedRecord {
  let content: Record<string, unknown> = {};
  try {
    content = JSON.parse((row.content as string) ?? '{}') as Record<string, unknown>;
  } catch {
    content = {};
  }
  let derived: string[] = [];
  try {
    derived = JSON.parse((row.derived_from_record_ids as string) ?? '[]') as string[];
  } catch {
    derived = [];
  }
  return {
    id: row.id as string,
    record_type: row.record_type as string,
    phase_id: (row.phase_id as string) || null,
    sub_phase_id: (row.sub_phase_id as string) || null,
    produced_by_agent_role: (row.produced_by_agent_role as string) || null,
    produced_at: row.produced_at as string,
    authority_level: (row.authority_level as number) ?? 1,
    quarantined: !!(row.quarantined as number),
    derived_from_record_ids: derived,
    content,
  };
}

export class ReplayDriver {
  private readonly db: Database;
  private readonly eventBus: EventBus;
  private readonly runId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly onDone?: () => void;

  private timer: ReturnType<typeof setInterval> | null = null;
  private cursor = 0; // last emitted rowid (keyset cursor)
  private emitted = 0;
  private readonly total: number;

  constructor(opts: ReplayDriverOptions) {
    this.db = opts.db;
    this.eventBus = opts.eventBus;
    this.runId = opts.runId;
    this.intervalMs = opts.intervalMs
      ?? (Number(process.env.JANUMICODE_REPLAY_APPEND_INTERVAL_MS) || 12);
    this.batchSize = opts.batchSize
      ?? (Number(process.env.JANUMICODE_REPLAY_APPEND_BATCH) || 3);
    this.onDone = opts.onDone;

    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM governed_stream
          WHERE workflow_run_id = ? AND is_current_version = 1`,
      )
      .get(this.runId) as { n: number } | undefined;
    this.total = countRow?.n ?? 0;
  }

  /** Begin feeding records. Idempotent — a second call is a no-op. */
  start(): void {
    if (this.timer) return;
    getLogger().info('ui', 'ReplayDriver starting live-append', {
      runId: this.runId,
      total: this.total,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    });
    const stmt = this.db.prepare(
      `SELECT rowid AS _rid, * FROM governed_stream
        WHERE workflow_run_id = ? AND is_current_version = 1 AND rowid > ?
        ORDER BY rowid ASC
        LIMIT ?`,
    );
    this.timer = setInterval(() => {
      const rows = stmt.all(this.runId, this.cursor, this.batchSize) as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        this.stop();
        getLogger().info('ui', 'ReplayDriver finished', { emitted: this.emitted });
        this.onDone?.();
        return;
      }
      for (const row of rows) {
        this.eventBus.emit('record:added', { record: serializeRow(row) });
        this.emitted++;
      }
      const last = rows.at(-1);
      if (last) this.cursor = Number(last._rid);
    }, this.intervalMs);
  }

  /** Stop feeding. Safe to call multiple times. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
