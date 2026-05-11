/**
 * LNFR gate aggregator.
 *
 * Per docs/janumilegal_product_description_evolution.md §5.4:
 *   "Each LNFR domain produces gate inputs consumed by the Release Gate
 *    Evaluator. An LNFR gate failure is a release blocker even when every
 *    lens-internal validator passes."
 *
 * Aggregates per-domain findings into a single gate status that the Release
 * Gate Evaluator's `lnfrGateStatus` input accepts.
 */

import { randomUUID } from 'node:crypto';
import { LNFR_DOMAINS, type LNFRDomain } from './domains.js';
import type { LnfrDomainStatus, LnfrFinding, LnfrReport } from './types.js';

export interface LnfrGateInputs {
  /** Per-domain status. Domains not supplied are treated as 'pending'. */
  readonly domainStatuses: readonly LnfrDomainStatus[];
  /** Optional: deadline-miss findings the deadline domain produces. */
  readonly extraFindings?: readonly LnfrFinding[];
}

export class LnfrGateEvaluator {
  evaluate(inputs: LnfrGateInputs): LnfrReport {
    const supplied = new Map<LNFRDomain, LnfrDomainStatus>();
    for (const s of inputs.domainStatuses) supplied.set(s.domain, s);

    const findings: LnfrFinding[] = [...(inputs.extraFindings ?? [])];

    let anyFail = false;
    let anyPending = false;
    for (const d of LNFR_DOMAINS) {
      const s = supplied.get(d);
      if (!s) {
        anyPending = true;
        continue;
      }
      findings.push(...s.findings);
      if (s.status === 'fail') anyFail = true;
      if (s.status === 'pending') anyPending = true;
    }
    if (findings.some((f) => f.severity === 'block')) anyFail = true;

    const status: LnfrReport['status'] = anyFail ? 'fail' : anyPending ? 'pending' : 'pass';
    return {
      reportId: randomUUID(),
      producedAt: new Date().toISOString(),
      findings,
      status,
    };
  }
}
