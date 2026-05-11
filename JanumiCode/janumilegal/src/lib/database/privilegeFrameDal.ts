/**
 * Privilege Frame snapshot persistence.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';
import type { PrivilegeFrame, StoredFrameSnapshot } from '../privilege/frame.js';
import { hashFrame, newSnapshotId } from '../privilege/frame.js';

export class PrivilegeFrameDal {
  constructor(private readonly db: Database.Database) {}

  /**
   * Persist a frame snapshot. Returns the snapshot reference (id + hash + version).
   * Version is monotonic per matter.
   */
  saveSnapshot(scope: Scope, frame: PrivilegeFrame): { snapshotId: string; snapshotHash: string; version: number } {
    const snapshotHash = hashFrame(frame);
    const snapshotId = newSnapshotId();
    const lastVersion = (this.db
      .prepare('SELECT MAX(version) AS v FROM privilege_frame_snapshots WHERE firm_id = ? AND client_id = ? AND matter_id = ?')
      .get(scope.firmId, scope.clientId, scope.matterId) as { v: number | null }).v ?? 0;
    const version = lastVersion + 1;
    this.db
      .prepare(
        `INSERT INTO privilege_frame_snapshots (firm_id, client_id, matter_id, snapshot_id, snapshot_hash, version, frame_json, produced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(scope.firmId, scope.clientId, scope.matterId, snapshotId, snapshotHash, version, JSON.stringify(frame), new Date().toISOString());
    return { snapshotId, snapshotHash, version };
  }

  getCurrentSnapshot(scope: Scope): StoredFrameSnapshot | undefined {
    const row = this.db
      .prepare(
        `SELECT snapshot_id, snapshot_hash, version, frame_json, produced_at, matter_id
         FROM privilege_frame_snapshots
         WHERE firm_id = ? AND client_id = ? AND matter_id = ?
         ORDER BY version DESC LIMIT 1`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId) as
      | { snapshot_id: string; snapshot_hash: string; version: number; frame_json: string; produced_at: string; matter_id: string }
      | undefined;
    if (!row) return undefined;
    return {
      snapshotId: row.snapshot_id,
      snapshotHash: row.snapshot_hash,
      version: row.version,
      matterId: row.matter_id,
      frameJson: row.frame_json,
      producedAt: row.produced_at,
    };
  }

  getSnapshotByRef(scope: Scope, snapshotHash: string): StoredFrameSnapshot | undefined {
    const row = this.db
      .prepare(
        `SELECT snapshot_id, snapshot_hash, version, frame_json, produced_at, matter_id
         FROM privilege_frame_snapshots
         WHERE firm_id = ? AND client_id = ? AND matter_id = ? AND snapshot_hash = ?
         ORDER BY version DESC LIMIT 1`,
      )
      .get(scope.firmId, scope.clientId, scope.matterId, snapshotHash) as
      | { snapshot_id: string; snapshot_hash: string; version: number; frame_json: string; produced_at: string; matter_id: string }
      | undefined;
    if (!row) return undefined;
    return {
      snapshotId: row.snapshot_id,
      snapshotHash: row.snapshot_hash,
      version: row.version,
      matterId: row.matter_id,
      frameJson: row.frame_json,
      producedAt: row.produced_at,
    };
  }
}
