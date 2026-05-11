/**
 * Lens phase manifest DAL surface.
 *
 * Manifests live in lens_pack_catalog (Wave 0 schema). This DAL is the
 * platform-wide registry write/read surface.
 */

import type Database from 'better-sqlite3';
import type { LensPhaseManifest } from '../orchestrator/types.js';

interface CatalogRow {
  lens_id: string;
  lens_version: string;
  practice_area: string;
  applicable_jurisdictions_json: string;
  manifest_json: string;
  clv_bindings_json: string;
  supersedes: string | null;
  created_at: string;
}

export class ManifestDal {
  constructor(private readonly db: Database.Database) {}

  insert(manifest: LensPhaseManifest): void {
    this.db
      .prepare(
        `INSERT INTO lens_pack_catalog
         (lens_id, lens_version, practice_area, applicable_jurisdictions_json, manifest_json, clv_bindings_json, supersedes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        manifest.lensId,
        manifest.lensVersion,
        manifest.practiceArea,
        JSON.stringify(manifest.applicableJurisdictions),
        JSON.stringify(manifest),
        JSON.stringify(manifest.clvBindings),
        manifest.supersedes ?? null,
        new Date().toISOString(),
      );
  }

  get(lensId: string, lensVersion: string): LensPhaseManifest | undefined {
    const row = this.db
      .prepare('SELECT * FROM lens_pack_catalog WHERE lens_id = ? AND lens_version = ?')
      .get(lensId, lensVersion) as CatalogRow | undefined;
    if (!row) return undefined;
    return JSON.parse(row.manifest_json) as LensPhaseManifest;
  }

  has(lensId: string, lensVersion: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM lens_pack_catalog WHERE lens_id = ? AND lens_version = ?')
      .get(lensId, lensVersion);
    return !!row;
  }

  listVersions(lensId: string): string[] {
    const rows = this.db
      .prepare('SELECT lens_version FROM lens_pack_catalog WHERE lens_id = ? ORDER BY created_at DESC')
      .all(lensId) as Array<{ lens_version: string }>;
    return rows.map((r) => r.lens_version);
  }
}
