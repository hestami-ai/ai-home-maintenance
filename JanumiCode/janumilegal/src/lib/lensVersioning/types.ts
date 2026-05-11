/**
 * Lens versioning + migration types.
 *
 * Per docs/janumilegal_product_description_evolution.md §10 and
 * docs/janumilegal_implementation_roadmap.md Wave 8 §8.2.
 */

export type MigrationKind = 'SAFE' | 'PARTIAL' | 'INCOMPATIBLE';

export interface LensVersionTransition {
  readonly lensId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly kind: MigrationKind;
  /** For PARTIAL: states whose outputs become stale and must be re-run. */
  readonly staleStates?: readonly string[];
  /** For INCOMPATIBLE: human-readable reason. */
  readonly incompatibilityReason?: string;
}

/** Result of attempting to migrate a matter activation to a new lens version. */
export interface MigrationResult {
  readonly status: 'advanced' | 'stale_marked' | 'refused' | 'force_migrated';
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly staleStates: readonly string[];
  readonly notes: readonly string[];
}

/** Authority freshness configuration. */
export interface AuthorityFreshnessPolicy {
  /** Maximum acceptable age (days) for a retrieved authority before re-verification is required. */
  readonly maxAgeDays: number;
}
