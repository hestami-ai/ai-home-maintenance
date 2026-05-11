/**
 * Conflicts of interest — types.
 *
 * Per docs/janumilegal_product_description_evolution.md §8.1 and
 * docs/janumilegal_multi_matter_isolation_addendum.md §7.3.
 */

export type ConflictTrigger =
  | 'matter_open'
  | 'party_added'
  | 'lens_activated'
  | 'reviewer_assigned';

export type ConflictSeverity =
  | 'none'
  | 'waivable'
  | 'non_waivable'
  | 'imputed'
  | 'requires_screening';

export interface PartyDescriptor {
  readonly partyId: string;
  readonly displayName: string;
  readonly role: 'client' | 'opposing_party' | 'co_party' | 'witness' | 'third_party' | 'expert' | 'other';
  readonly entityType?: 'individual' | 'organization' | 'unknown';
}

export interface ConflictFinding {
  readonly findingId: string;
  readonly severity: ConflictSeverity;
  readonly category:
    | 'current_client'
    | 'former_client'
    | 'positional'
    | 'business'
    | 'lateral_attorney'
    | 'screened_personnel'
    | 'self_dealing';
  readonly subjects: readonly PartyDescriptor[];
  readonly basis: string;
  /** Optional: matter ids this finding references (returned only via the
   *  conflicts-only data surface; never matter-track content). */
  readonly relatedMatterIds: readonly string[];
}

export interface ConflictReport {
  readonly reportId: string;
  readonly trigger: ConflictTrigger;
  readonly findings: readonly ConflictFinding[];
  readonly highestSeverity: ConflictSeverity;
  readonly producedAt: string;
}

export const SEVERITY_RANK: Record<ConflictSeverity, number> = {
  none: 0,
  waivable: 1,
  requires_screening: 2,
  imputed: 3,
  non_waivable: 4,
};

export function maxSeverity(severities: readonly ConflictSeverity[]): ConflictSeverity {
  return severities.reduce<ConflictSeverity>((acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc), 'none');
}

/** Hard release block: any of these severities block external release outright. */
export function isHardReleaseBlock(s: ConflictSeverity): boolean {
  return s === 'non_waivable' || s === 'imputed';
}
