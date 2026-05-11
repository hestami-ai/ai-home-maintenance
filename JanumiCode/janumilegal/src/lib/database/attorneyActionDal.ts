/**
 * AttorneyAction persistence.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';
import type { AttorneyAction } from '../attorneyAction/types.js';

export class AttorneyActionDal {
  constructor(private readonly db: Database.Database) {}

  insert(a: AttorneyAction): void {
    this.db
      .prepare(
        `INSERT INTO attorney_actions
         (firm_id, client_id, matter_id, action_id, artifact_id, artifact_version_hash,
          attorney_id, attorney_role, action, signature_mode, jurisdiction_requirements_met,
          bar_numbers_at_action_json, timestamp, governed_stream_event_id,
          acknowledged_findings_json, override_rationale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        a.firmId,
        a.clientId,
        a.matterId,
        a.actionId,
        a.artifactId,
        a.artifactVersionHash,
        a.attorneyId,
        a.attorneyRole,
        a.action,
        a.signatureMode ?? null,
        a.jurisdictionRequirementsMet ? 1 : 0,
        JSON.stringify(a.barNumbersAtAction),
        a.timestamp,
        a.governedStreamEventId,
        a.acknowledgedFindings ? JSON.stringify(a.acknowledgedFindings) : null,
        a.overrideRationale ?? null,
      );
  }

  listForArtifact(scope: Scope, artifactId: string): AttorneyAction[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM attorney_actions
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND artifact_id = ?
         ORDER BY timestamp`,
      )
      .all(scope.firmId, scope.clientId, scope.matterId, artifactId) as Array<{
      firm_id: string;
      client_id: string;
      matter_id: string;
      action_id: string;
      artifact_id: string;
      artifact_version_hash: string;
      attorney_id: string;
      attorney_role: string;
      action: string;
      signature_mode: string | null;
      jurisdiction_requirements_met: number;
      bar_numbers_at_action_json: string;
      timestamp: string;
      governed_stream_event_id: string;
      acknowledged_findings_json: string | null;
      override_rationale: string | null;
    }>;
    return rows.map((r) => ({
      actionId: r.action_id,
      firmId: r.firm_id,
      clientId: r.client_id,
      matterId: r.matter_id,
      artifactId: r.artifact_id,
      artifactVersionHash: r.artifact_version_hash,
      attorneyId: r.attorney_id,
      attorneyRole: r.attorney_role as AttorneyAction['attorneyRole'],
      action: r.action as AttorneyAction['action'],
      signatureMode: (r.signature_mode ?? undefined) as AttorneyAction['signatureMode'],
      jurisdictionRequirementsMet: r.jurisdiction_requirements_met === 1,
      barNumbersAtAction: JSON.parse(r.bar_numbers_at_action_json) as AttorneyAction['barNumbersAtAction'],
      timestamp: r.timestamp,
      governedStreamEventId: r.governed_stream_event_id,
      acknowledgedFindings: r.acknowledged_findings_json
        ? (JSON.parse(r.acknowledged_findings_json) as readonly string[])
        : undefined,
      overrideRationale: r.override_rationale ?? undefined,
    }));
  }
}
