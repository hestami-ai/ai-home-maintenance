/**
 * Source-to-claim trace persistence.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';
import type { SourceToClaimTrace } from '../sourceToClaimTrace/types.js';

export class TraceDal {
  constructor(private readonly db: Database.Database) {}

  insert(scope: Scope, trace: SourceToClaimTrace): void {
    this.db
      .prepare(
        `INSERT INTO source_to_claim_traces
         (firm_id, client_id, matter_id, trace_id, artifact_id, assertion_text, assertion_kind,
          source_id, supporting_span, state_id, verification_label, attorney_confirmed_action_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scope.firmId,
        scope.clientId,
        scope.matterId,
        trace.traceId,
        trace.artifactId ?? null,
        trace.assertionText,
        trace.assertionKind,
        trace.sourceId,
        trace.supportingSpan ?? null,
        trace.stateId ?? null,
        trace.verificationLabel,
        trace.attorneyConfirmedActionId ?? null,
        new Date().toISOString(),
      );
  }

  listForArtifact(scope: Scope, artifactId: string): SourceToClaimTrace[] {
    const rows = this.db
      .prepare(
        `SELECT trace_id, artifact_id, assertion_text, assertion_kind, source_id, supporting_span,
                state_id, verification_label, attorney_confirmed_action_id
         FROM source_to_claim_traces
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND artifact_id = ?`,
      )
      .all(scope.firmId, scope.clientId, scope.matterId, artifactId) as Array<{
      trace_id: string;
      artifact_id: string | null;
      assertion_text: string;
      assertion_kind: SourceToClaimTrace['assertionKind'];
      source_id: string;
      supporting_span: string | null;
      state_id: string | null;
      verification_label: SourceToClaimTrace['verificationLabel'];
      attorney_confirmed_action_id: string | null;
    }>;
    return rows.map((r) => ({
      traceId: r.trace_id,
      artifactId: r.artifact_id ?? undefined,
      assertionText: r.assertion_text,
      assertionKind: r.assertion_kind,
      sourceId: r.source_id,
      supportingSpan: r.supporting_span ?? undefined,
      stateId: r.state_id ?? undefined,
      verificationLabel: r.verification_label,
      attorneyConfirmedActionId: r.attorney_confirmed_action_id ?? undefined,
    }));
  }

  countForMatter(scope: Scope): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM source_to_claim_traces WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId) as { n: number };
    return r.n;
  }
}
