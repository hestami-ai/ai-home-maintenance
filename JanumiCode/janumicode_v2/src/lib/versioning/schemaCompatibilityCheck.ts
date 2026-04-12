/**
 * Schema Compatibility Check — detects schema gaps on JanumiCode version upgrade.
 * Based on JanumiCode Spec v2.3, §13.4.
 *
 * Compares artifact schema_version fields against the new version's schema_registry.
 */

import type { Database } from '../database/init';

export interface SchemaGap {
  artifactType: string;
  currentVersion: string;
  requiredVersion: string;
  isBreaking: boolean;
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  gaps: SchemaGap[];
  newInvariantsAdded: string[];
}

export class SchemaCompatibilityChecker {
  constructor(private readonly db: Database) {}

  /**
   * Check compatibility between current artifacts and a new schema registry.
   */
  check(
    newSchemaRegistry: Record<string, { current_version: string; breaking_from?: string }>,
  ): CompatibilityCheckResult {
    const gaps: SchemaGap[] = [];

    // Get all distinct artifact types and their schema versions from the Governed Stream
    const artifacts = this.db.prepare(`
      SELECT DISTINCT
        json_extract(content, '$.artifact_type') as artifact_type,
        schema_version
      FROM governed_stream
      WHERE record_type = 'artifact_produced'
        AND is_current_version = 1
    `).all() as { artifact_type: string | null; schema_version: string }[];

    for (const artifact of artifacts) {
      if (!artifact.artifact_type) continue;
      const registry = newSchemaRegistry[artifact.artifact_type];
      if (!registry) continue;

      if (artifact.schema_version !== registry.current_version) {
        const isBreaking = registry.breaking_from !== undefined &&
          this.isVersionBefore(artifact.schema_version, registry.breaking_from);

        gaps.push({
          artifactType: artifact.artifact_type,
          currentVersion: artifact.schema_version,
          requiredVersion: registry.current_version,
          isBreaking,
        });
      }
    }

    return {
      compatible: gaps.filter(g => g.isBreaking).length === 0,
      gaps,
      newInvariantsAdded: [], // Would compare invariant library SHAs
    };
  }

  private isVersionBefore(current: string, breakingFrom: string): boolean {
    // Simple semver-like comparison
    const c = current.split('.').map(Number);
    const b = breakingFrom.split('.').map(Number);
    for (let i = 0; i < Math.max(c.length, b.length); i++) {
      if ((c[i] ?? 0) < (b[i] ?? 0)) return true;
      if ((c[i] ?? 0) > (b[i] ?? 0)) return false;
    }
    return false;
  }
}
