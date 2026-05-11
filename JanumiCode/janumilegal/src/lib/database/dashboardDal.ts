/**
 * Dashboard read-only DAL for assembling Matter Header Bar + cross-matter views.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';

export interface MatterHeaderRow {
  matterName: string;
  practiceArea: string;
  proceduralPosture: string | null;
  clientName: string;
}

export interface ActiveLensRow {
  lensId: string;
  lensVersion: string;
}

export interface MatterListRow {
  matterName: string;
  practiceArea: string;
  status: 'open' | 'closed';
  clientName: string;
}

export class DashboardDal {
  constructor(private readonly db: Database.Database) {}

  matterHeader(scope: Scope): MatterHeaderRow | undefined {
    const r = this.db
      .prepare(
        `SELECT m.matter_name, m.practice_area, m.procedural_posture, c.name AS client_name
         FROM matters m
         JOIN clients c ON c.firm_id = m.firm_id AND c.client_id = m.client_id
         WHERE m.firm_id = ? AND m.client_id = ? AND m.matter_id = ?`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId) as
      | { matter_name: string; practice_area: string; procedural_posture: string | null; client_name: string }
      | undefined;
    return r
      ? { matterName: r.matter_name, practiceArea: r.practice_area, proceduralPosture: r.procedural_posture, clientName: r.client_name }
      : undefined;
  }

  activeLens(scope: Scope): ActiveLensRow | undefined {
    const r = this.db
      .prepare(
        `SELECT lens_id, lens_version FROM matter_lens_activations
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND deactivated_at IS NULL
         ORDER BY activated_at DESC LIMIT 1`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId) as
      | { lens_id: string; lens_version: string }
      | undefined;
    return r ? { lensId: r.lens_id, lensVersion: r.lens_version } : undefined;
  }

  matterListEntry(scope: Scope): MatterListRow | undefined {
    const r = this.db
      .prepare(
        `SELECT m.matter_name, m.practice_area, m.status, c.name AS client_name
         FROM matters m
         JOIN clients c ON c.firm_id = m.firm_id AND c.client_id = m.client_id
         WHERE m.firm_id = ? AND m.client_id = ? AND m.matter_id = ?`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId) as
      | { matter_name: string; practice_area: string; status: 'open' | 'closed'; client_name: string }
      | undefined;
    return r
      ? { matterName: r.matter_name, practiceArea: r.practice_area, status: r.status, clientName: r.client_name }
      : undefined;
  }
}
