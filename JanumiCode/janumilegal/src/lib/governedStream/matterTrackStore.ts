/**
 * Per-matter Governed Stream SQLite file.
 *
 * Per docs/design/governed_stream_privilege.md §3.3 §6.1.
 *
 * Each matter has its own SQLite file:
 *   <data_root>/firms/<firmId>/clients/<clientId>/matters/<matterId>/governed_stream.sqlite
 *
 * The file holds one events table. Payloads are encrypted at rest with the
 * appropriate per-matter key (content key for most classifications; mental
 * key for work_product_mental). Hash chains run per (matter, classification).
 *
 * This module is in src/lib/governedStream/ rather than src/lib/database/
 * because per-matter file management is a Governed-Stream-specific concern.
 * Per the privilege architecture, this is a sanctioned location for direct
 * better-sqlite3 use. The layer linter recognizes it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import type { Scope } from '../database/types.js';
import type { MatterTrackClassification } from './classifications.js';

const MATTER_TRACK_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS matter_track_events (
    event_id TEXT PRIMARY KEY,
    correlation_id TEXT,
    user_id TEXT,
    active_matter_context TEXT,
    lens_id TEXT,
    lens_version TEXT,
    state_id TEXT,
    agent_id TEXT,
    agent_run_id TEXT,
    classification TEXT NOT NULL,
    privilege_frame_ref TEXT NOT NULL,
    clv_scope_json TEXT NOT NULL DEFAULT '[]',
    event_type TEXT NOT NULL,
    payload_envelope BLOB NOT NULL,
    payload_hash TEXT NOT NULL,
    prev_event_hash TEXT NOT NULL,
    written_at TEXT NOT NULL,
    writer_node TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matter_track_class ON matter_track_events(classification, written_at)`,
  `CREATE INDEX IF NOT EXISTS idx_matter_track_corr ON matter_track_events(correlation_id)`,
  `CREATE TABLE IF NOT EXISTS matter_track_chain_heads (
    classification TEXT PRIMARY KEY,
    head_hash TEXT NOT NULL,
    last_event_id TEXT NOT NULL,
    last_event_at TEXT NOT NULL
  )`,
];

export interface MatterTrackEventRow {
  eventId: string;
  correlationId: string | null;
  userId: string | null;
  activeMatterContext: string | null;
  lensId: string | null;
  lensVersion: string | null;
  stateId: string | null;
  agentId: string | null;
  agentRunId: string | null;
  classification: MatterTrackClassification;
  privilegeFrameRef: string;
  clvScopeJson: string;
  eventType: string;
  payloadEnvelope: Buffer;
  payloadHash: string;
  prevEventHash: string;
  writtenAt: string;
  writerNode: string;
}

export class MatterTrackStore {
  private readonly db: Database.Database;

  constructor(public readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    for (const stmt of MATTER_TRACK_SCHEMA) this.db.exec(stmt);
  }

  close(): void {
    this.db.close();
  }

  /** Returns the current chain head hash for a classification, or empty string if no events yet. */
  getChainHead(classification: MatterTrackClassification): string {
    const row = this.db
      .prepare('SELECT head_hash FROM matter_track_chain_heads WHERE classification = ?')
      .get(classification) as { head_hash: string } | undefined;
    return row?.head_hash ?? '';
  }

  insertEvent(row: MatterTrackEventRow): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO matter_track_events
           (event_id, correlation_id, user_id, active_matter_context, lens_id, lens_version, state_id, agent_id, agent_run_id,
            classification, privilege_frame_ref, clv_scope_json, event_type, payload_envelope, payload_hash, prev_event_hash, written_at, writer_node)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          row.eventId,
          row.correlationId,
          row.userId,
          row.activeMatterContext,
          row.lensId,
          row.lensVersion,
          row.stateId,
          row.agentId,
          row.agentRunId,
          row.classification,
          row.privilegeFrameRef,
          row.clvScopeJson,
          row.eventType,
          row.payloadEnvelope,
          row.payloadHash,
          row.prevEventHash,
          row.writtenAt,
          row.writerNode,
        );
      this.db
        .prepare(
          `INSERT INTO matter_track_chain_heads (classification, head_hash, last_event_id, last_event_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(classification) DO UPDATE SET head_hash = excluded.head_hash, last_event_id = excluded.last_event_id, last_event_at = excluded.last_event_at`,
        )
        .run(row.classification, row.payloadHash, row.eventId, row.writtenAt);
    })();
  }

  listEvents(filter?: { classification?: MatterTrackClassification }): MatterTrackEventRow[] {
    const rows = filter?.classification
      ? (this.db.prepare('SELECT * FROM matter_track_events WHERE classification = ? ORDER BY written_at').all(filter.classification) as DbRow[])
      : (this.db.prepare('SELECT * FROM matter_track_events ORDER BY written_at').all() as DbRow[]);
    return rows.map(rowToTyped);
  }

  countByClassification(classification: MatterTrackClassification): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM matter_track_events WHERE classification = ?')
      .get(classification) as { n: number };
    return r.n;
  }

  getEvent(eventId: string): MatterTrackEventRow | undefined {
    const row = this.db
      .prepare('SELECT * FROM matter_track_events WHERE event_id = ?')
      .get(eventId) as DbRow | undefined;
    return row ? rowToTyped(row) : undefined;
  }

  /**
   * Verify the integrity of a classification's chain by re-deriving each
   * event's payload_hash from prev_event_hash + payload_envelope and asserting
   * head_hash equals the latest event's payload_hash.
   */
  verifyChain(
    classification: MatterTrackClassification,
    rederivePayloadHash: (prevHash: string, payloadEnvelope: Buffer) => string,
  ): { ok: boolean; failedAt?: string; reason?: string } {
    const events = this.listEvents({ classification });
    let prev = '';
    for (const e of events) {
      if (e.prevEventHash !== prev) {
        return { ok: false, failedAt: e.eventId, reason: `prev_event_hash mismatch (expected ${prev}, got ${e.prevEventHash})` };
      }
      const expected = rederivePayloadHash(prev, e.payloadEnvelope);
      if (expected !== e.payloadHash) {
        return { ok: false, failedAt: e.eventId, reason: 'payload_hash mismatch' };
      }
      prev = e.payloadHash;
    }
    const head = this.getChainHead(classification);
    if (events.length > 0 && head !== events[events.length - 1].payloadHash) {
      return { ok: false, reason: 'chain head out of sync' };
    }
    return { ok: true };
  }
}

interface DbRow {
  event_id: string;
  correlation_id: string | null;
  user_id: string | null;
  active_matter_context: string | null;
  lens_id: string | null;
  lens_version: string | null;
  state_id: string | null;
  agent_id: string | null;
  agent_run_id: string | null;
  classification: MatterTrackClassification;
  privilege_frame_ref: string;
  clv_scope_json: string;
  event_type: string;
  payload_envelope: Buffer;
  payload_hash: string;
  prev_event_hash: string;
  written_at: string;
  writer_node: string;
}

function rowToTyped(r: DbRow): MatterTrackEventRow {
  return {
    eventId: r.event_id,
    correlationId: r.correlation_id,
    userId: r.user_id,
    activeMatterContext: r.active_matter_context,
    lensId: r.lens_id,
    lensVersion: r.lens_version,
    stateId: r.state_id,
    agentId: r.agent_id,
    agentRunId: r.agent_run_id,
    classification: r.classification,
    privilegeFrameRef: r.privilege_frame_ref,
    clvScopeJson: r.clv_scope_json,
    eventType: r.event_type,
    payloadEnvelope: r.payload_envelope,
    payloadHash: r.payload_hash,
    prevEventHash: r.prev_event_hash,
    writtenAt: r.written_at,
    writerNode: r.writer_node,
  };
}

/** Compute the matter's on-disk file path. */
export function matterTrackPath(dataRoot: string, scope: Scope): string {
  return path.join(
    dataRoot,
    'firms',
    scope.firmId,
    'clients',
    scope.clientId,
    'matters',
    scope.matterId,
    'governed_stream.sqlite',
  );
}
