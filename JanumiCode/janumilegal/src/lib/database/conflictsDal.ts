/**
 * Conflicts-surface persistence (firm-wide read of metadata only).
 */

import type Database from 'better-sqlite3';

export interface MatterMetadataRow {
  firmId: string;
  clientId: string;
  matterId: string;
  matterName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
}

export class ConflictsDal {
  constructor(private readonly db: Database.Database) {}

  matterMetadataAcrossFirm(firmId: string): MatterMetadataRow[] {
    const rows = this.db
      .prepare(
        `SELECT firm_id, client_id, matter_id, matter_name, status, opened_at, closed_at
         FROM matters WHERE firm_id = ?`,
      )
      .all(firmId) as Array<{
      firm_id: string;
      client_id: string;
      matter_id: string;
      matter_name: string;
      status: 'open' | 'closed';
      opened_at: string;
      closed_at: string | null;
    }>;
    return rows.map((r) => ({
      firmId: r.firm_id,
      clientId: r.client_id,
      matterId: r.matter_id,
      matterName: r.matter_name,
      status: r.status,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
    }));
  }
}
