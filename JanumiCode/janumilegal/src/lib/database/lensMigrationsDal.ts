/**
 * Lens version migration DAL.
 */

import type Database from 'better-sqlite3';
import type { LensVersionTransition, MigrationKind } from '../lensVersioning/types.js';

export class LensMigrationsDal {
  constructor(private readonly db: Database.Database) {}

  declare(t: LensVersionTransition): void {
    this.db
      .prepare(
        `INSERT INTO lens_version_migrations
         (lens_id, from_version, to_version, kind, stale_states_json, incompatibility_reason, declared_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        t.lensId,
        t.fromVersion,
        t.toVersion,
        t.kind,
        JSON.stringify(t.staleStates ?? []),
        t.incompatibilityReason ?? null,
        new Date().toISOString(),
      );
  }

  get(lensId: string, fromVersion: string, toVersion: string): LensVersionTransition | undefined {
    const r = this.db
      .prepare(
        `SELECT lens_id, from_version, to_version, kind, stale_states_json, incompatibility_reason
         FROM lens_version_migrations
         WHERE lens_id = ? AND from_version = ? AND to_version = ?`,
      )
      .get(lensId, fromVersion, toVersion) as
      | { lens_id: string; from_version: string; to_version: string; kind: MigrationKind; stale_states_json: string; incompatibility_reason: string | null }
      | undefined;
    if (!r) return undefined;
    return {
      lensId: r.lens_id,
      fromVersion: r.from_version,
      toVersion: r.to_version,
      kind: r.kind,
      staleStates: JSON.parse(r.stale_states_json) as string[],
      incompatibilityReason: r.incompatibility_reason ?? undefined,
    };
  }
}
