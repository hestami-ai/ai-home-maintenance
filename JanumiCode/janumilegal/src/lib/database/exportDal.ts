/**
 * Export record persistence.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';
import type { MatterTrackClassification } from '../governedStream/classifications.js';

export interface ExportRecordRow {
  exportId: string;
  scope: Scope;
  purpose: string;
  requestedBy: string;
  classificationFilter: readonly MatterTrackClassification[];
  redactionSummary: { excludedCount: number; perClassification: Record<string, number> };
  packageHash: string;
  exportedAt: string;
}

export class ExportDal {
  constructor(private readonly db: Database.Database) {}

  insert(row: ExportRecordRow): void {
    this.db
      .prepare(
        `INSERT INTO export_records
         (export_id, firm_id, client_id, matter_id, purpose, requested_by, classification_filter_json, redaction_summary_json, package_hash, exported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.exportId,
        row.scope.firmId,
        row.scope.clientId,
        row.scope.matterId,
        row.purpose,
        row.requestedBy,
        JSON.stringify(row.classificationFilter),
        JSON.stringify(row.redactionSummary),
        row.packageHash,
        row.exportedAt,
      );
  }

  countForMatter(scope: Scope): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM export_records WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId) as { n: number };
    return r.n;
  }
}
