/**
 * Operational-track Governed Stream writer.
 *
 * Per docs/design/governed_stream_privilege.md §3.1 and §6:
 *   - op_metadata only (no client identifiers, no substantive content).
 *   - non-discovery-relevant by design.
 *
 * Wave 2 wires this; Wave 3 adds the matter-track stream with classification.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

export type OpEventType =
  | 'extension_activated'
  | 'matter_context_switched'
  | 'lens_activation_started'
  | 'state_started'
  | 'state_completed'
  | 'state_blocked'
  | 'state_escalated'
  | 'agent_invoked'
  | 'agent_completed'
  | 'agent_failed'
  | 'manifest_loaded'
  | 'clv_loaded'
  | 'vcc_report_recorded'
  | 'export_recorded'
  | 'reasoning_review_completed'
  | 'source_admission_decision';

export interface OpEvent {
  readonly eventType: OpEventType;
  readonly firmId: string;
  readonly clientId?: string;
  readonly matterId?: string;
  readonly userId?: string;
  /** Non-substantive metadata only — no party names, no document content, no LLM prompts/completions. */
  readonly payload: Record<string, unknown>;
}

export class OpStreamDal {
  constructor(private readonly db: Database.Database) {}

  write(event: OpEvent): string {
    const eventId = randomUUID();
    this.db
      .prepare(
        `INSERT INTO governed_stream_op
         (event_id, firm_id, client_id, matter_id, user_id, event_type, payload_json, written_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        eventId,
        event.firmId,
        event.clientId ?? null,
        event.matterId ?? null,
        event.userId ?? null,
        event.eventType,
        JSON.stringify(event.payload),
        new Date().toISOString(),
      );
    return eventId;
  }

  countByType(firmId: string, eventType: OpEventType): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM governed_stream_op WHERE firm_id = ? AND event_type = ?')
      .get(firmId, eventType) as { n: number };
    return row.n;
  }

  recent(firmId: string, limit: number = 50): Array<{ eventId: string; eventType: string; payload: Record<string, unknown>; writtenAt: string }> {
    const rows = this.db
      .prepare('SELECT event_id, event_type, payload_json, written_at FROM governed_stream_op WHERE firm_id = ? ORDER BY written_at DESC LIMIT ?')
      .all(firmId, limit) as Array<{ event_id: string; event_type: string; payload_json: string; written_at: string }>;
    return rows.map((r) => ({
      eventId: r.event_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json) as Record<string, unknown>,
      writtenAt: r.written_at,
    }));
  }
}
