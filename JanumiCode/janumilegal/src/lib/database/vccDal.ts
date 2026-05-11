/**
 * VCC report persistence.
 */

import type Database from 'better-sqlite3';
import type { VocabularyCollisionReport } from '../vcc/types.js';

export class VccDal {
  constructor(private readonly db: Database.Database) {}

  insertReport(report: VocabularyCollisionReport, firmId: string | null = null): void {
    this.db
      .prepare(
        `INSERT INTO vocabulary_collision_reports
         (report_id, firm_id, trigger, verdict, blocking_count, warn_ack_count, warn_count, collisions_json, produced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        report.reportId,
        firmId,
        report.trigger,
        report.verdict,
        report.blockingCount,
        report.warnAckCount,
        report.warnCount,
        JSON.stringify(report.collisions),
        report.producedAt,
      );
  }

  acknowledge(reportId: string, acknowledgedBy: string): number {
    const info = this.db
      .prepare(
        `UPDATE vocabulary_collision_reports
         SET acknowledged_by = ?, acknowledged_at = ?
         WHERE report_id = ? AND verdict = 'allow_with_ack' AND acknowledged_by IS NULL`,
      )
      .run(acknowledgedBy, new Date().toISOString(), reportId);
    return info.changes;
  }

  countByVerdict(verdict: 'allow' | 'allow_with_ack' | 'block'): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM vocabulary_collision_reports WHERE verdict = ?')
      .get(verdict) as { n: number };
    return row.n;
  }
}
