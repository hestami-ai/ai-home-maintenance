/**
 * LNFR types.
 *
 * Per docs/janumilegal_product_description_evolution.md §5.
 */

import type { LNFRDomain } from './domains.js';

export type LnfrSeverity = 'info' | 'warn' | 'block';

export interface LnfrFinding {
  readonly findingId: string;
  readonly domain: LNFRDomain;
  readonly severity: LnfrSeverity;
  readonly category: string;
  readonly message: string;
  readonly subjectArtifactId?: string;
  /** When set, the finding only blocks the listed release targets. Empty/undefined = blocks all. */
  readonly blocksTargets?: ReadonlyArray<'internal' | 'client' | 'opposing' | 'court' | 'agency' | 'public'>;
}

export interface LnfrReport {
  readonly reportId: string;
  readonly producedAt: string;
  readonly findings: readonly LnfrFinding[];
  readonly status: 'pass' | 'pending' | 'fail';
}

/** Gate-aggregator input from each LNFR domain. */
export interface LnfrDomainStatus {
  readonly domain: LNFRDomain;
  readonly status: 'pass' | 'pending' | 'fail';
  readonly findings: readonly LnfrFinding[];
}

/**
 * Three-pass LNFR bloom output (analogous to Issue Bloom Proposal C).
 *
 * Pass 1 (SEED COVERAGE): touch every LNFR domain — produce a candidate
 *   finding or a non-applicability record.
 * Pass 2 (DIVERGENCE): may introduce off-domain (matter-specific) findings.
 * Pass 3 (CONSOLIDATION + DAMPENING): no new domains; refinement only;
 *   late additions escalate.
 */
export interface LnfrBloomResult {
  readonly status: 'completed' | 'escalated';
  readonly findings: readonly LnfrFinding[];
  readonly nonApplicableDomains: readonly LNFRDomain[];
  readonly escalationReason?: string;
}
