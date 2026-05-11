/**
 * Governance agent finding shape.
 *
 * Per docs/janumilegal_product_description.md §Tier 12.
 *
 * Tier 12 governance agents emit structured findings. Findings have a
 * severity. The Release Gate Evaluator (Wave 7) consumes findings to
 * determine release-blocker status.
 */

export type GovernanceSeverity = 'info' | 'warn' | 'block';

export interface GovernanceFinding {
  readonly findingId: string;
  readonly agentId: string;
  readonly severity: GovernanceSeverity;
  readonly category: string;
  readonly message: string;
  /** Optional pointer to the matter-track event/state/artifact the finding refers to. */
  readonly subject?: { kind: 'state' | 'artifact' | 'lbh' | 'mmp' | 'general'; id?: string };
}

export interface GovernanceReport {
  readonly reportId: string;
  readonly producedBy: string;
  readonly producedAt: string;
  readonly findings: readonly GovernanceFinding[];
  readonly summary: { info: number; warn: number; block: number };
}

export function summarize(findings: readonly GovernanceFinding[]): GovernanceReport['summary'] {
  return {
    info: findings.filter((f) => f.severity === 'info').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    block: findings.filter((f) => f.severity === 'block').length,
  };
}
