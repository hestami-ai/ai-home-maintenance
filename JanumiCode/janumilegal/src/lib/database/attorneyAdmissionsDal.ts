/**
 * Attorney admissions DAL.
 *
 * Tracks per-attorney per-jurisdiction bar admissions. The Release Gate
 * Evaluator consults this to enforce "filing requires signing_attorney
 * admitted in forum jurisdiction" (evolution §9).
 */

import type Database from 'better-sqlite3';

export interface AttorneyAdmissionRow {
  firmId: string;
  attorneyId: string;
  jurisdiction: string;
  barNumber: string;
  admittedAt: string;
  status: 'active' | 'inactive' | 'suspended';
}

export class AttorneyAdmissionsDal {
  constructor(private readonly db: Database.Database) {}

  insert(row: AttorneyAdmissionRow): void {
    this.db
      .prepare(
        `INSERT INTO attorney_admissions
         (firm_id, attorney_id, jurisdiction, bar_number, admitted_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.firmId, row.attorneyId, row.jurisdiction, row.barNumber, row.admittedAt, row.status);
  }

  setStatus(firmId: string, attorneyId: string, jurisdiction: string, status: 'active' | 'inactive' | 'suspended'): number {
    return this.db
      .prepare(
        `UPDATE attorney_admissions SET status = ?
         WHERE firm_id = ? AND attorney_id = ? AND jurisdiction = ?`,
      )
      .run(status, firmId, attorneyId, jurisdiction).changes;
  }

  listForAttorney(firmId: string, attorneyId: string): AttorneyAdmissionRow[] {
    const rows = this.db
      .prepare(
        `SELECT firm_id, attorney_id, jurisdiction, bar_number, admitted_at, status
         FROM attorney_admissions
         WHERE firm_id = ? AND attorney_id = ?`,
      )
      .all(firmId, attorneyId) as Array<{
      firm_id: string;
      attorney_id: string;
      jurisdiction: string;
      bar_number: string;
      admitted_at: string;
      status: 'active' | 'inactive' | 'suspended';
    }>;
    return rows.map((r) => ({
      firmId: r.firm_id,
      attorneyId: r.attorney_id,
      jurisdiction: r.jurisdiction,
      barNumber: r.bar_number,
      admittedAt: r.admitted_at,
      status: r.status,
    }));
  }

  isAdmitted(firmId: string, attorneyId: string, jurisdiction: string): boolean {
    const r = this.db
      .prepare(
        `SELECT 1 FROM attorney_admissions
         WHERE firm_id = ? AND attorney_id = ? AND jurisdiction = ? AND status = 'active'`,
      )
      .get(firmId, attorneyId, jurisdiction);
    return !!r;
  }
}
