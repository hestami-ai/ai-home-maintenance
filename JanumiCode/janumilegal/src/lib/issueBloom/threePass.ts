/**
 * Three-pass Issue Bloom orchestrator (Proposal C).
 *
 * Per docs/janumilegal_product_description_evolution.md §7 Proposal C and
 * docs/janumilegal_implementation_roadmap.md Wave 5 §5.1.
 *
 * Hard rules:
 *   - Pass 1 must produce a candidate or non-applicability record for every seed domain.
 *   - Pass 2 must produce at least one off-seed candidate OR an explicit attestation.
 *   - Pass 3 may not introduce new issue domains. Late additions trigger ESCALATION.
 *   - Termination = pass 3 emits a clean IssueCandidateSet. Hard cap = 3 passes.
 */

import type {
  BloomPassInput,
  BloomResult,
  IssueBloomAgent,
  IssueCandidate,
  NonApplicabilityRecord,
  SeedDomain,
} from './types.js';

export class BloomViolation extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'BloomViolation';
  }
}

export class ThreePassBloom {
  constructor(private readonly agent: IssueBloomAgent) {}

  async run(args: { seedDomains: readonly SeedDomain[]; matterContextSummary: string }): Promise<BloomResult> {
    const seedDomainSet = new Set(args.seedDomains.map((s) => s.domain));

    // Pass 1 — SEED COVERAGE
    const pass1 = await this.agent.pass1({
      seedDomains: args.seedDomains,
      priorCandidates: [],
      priorDomains: new Set(),
      matterContextSummary: args.matterContextSummary,
    });

    const pass1Domains = new Set(pass1.candidates.map((c) => c.issueDomain));
    const missingFromPass1 = Array.from(seedDomainSet).filter(
      (d) => !pass1Domains.has(d) && !pass1.nonApplicable.some((n) => n.domain === d),
    );
    if (missingFromPass1.length > 0) {
      throw new BloomViolation(
        `pass 1 did not cover seed domains: ${missingFromPass1.join(', ')}`,
        'SEED_COVERAGE_VIOLATED',
      );
    }
    // Pass 1 is also forbidden from introducing off-seed candidates.
    const pass1OffSeed = pass1.candidates.filter((c) => !seedDomainSet.has(c.issueDomain));
    if (pass1OffSeed.length > 0) {
      throw new BloomViolation(
        `pass 1 introduced off-seed candidates (only seed coverage permitted): ${pass1OffSeed.map((c) => c.issueDomain).join(', ')}`,
        'PASS1_OFFSEED_VIOLATION',
      );
    }

    const pass1MarkedCandidates = pass1.candidates.map((c) => ({
      ...c,
      introducedAtPass: 1 as const,
      lastModifiedAtPass: 1 as const,
    }));

    // Pass 2 — DIVERGENCE
    const pass2DomainsBefore = new Set(pass1MarkedCandidates.map((c) => c.issueDomain));
    const pass2 = await this.agent.pass2({
      seedDomains: args.seedDomains,
      priorCandidates: pass1MarkedCandidates,
      priorDomains: pass2DomainsBefore,
      matterContextSummary: args.matterContextSummary,
    });

    const offSeedFromPass2 = pass2.candidates.filter((c) => !seedDomainSet.has(c.issueDomain) && !pass2DomainsBefore.has(c.issueDomain));
    if (offSeedFromPass2.length === 0 && !pass2.attestation) {
      throw new BloomViolation(
        'pass 2 produced no off-seed candidate and no attestation; one or the other is required',
        'DIVERGENCE_REQUIRED',
      );
    }

    // Merge candidates from pass 1 + pass 2. Refinement is allowed; new domains permitted.
    const merged = mergeCandidates(pass1MarkedCandidates, pass2.candidates, 2);
    const passTwoDomainSet = new Set(merged.map((c) => c.issueDomain));

    // Pass 3 — CONSOLIDATION + DAMPENING
    const pass3 = await this.agent.pass3({
      seedDomains: args.seedDomains,
      priorCandidates: merged,
      priorDomains: passTwoDomainSet,
      matterContextSummary: args.matterContextSummary,
    });

    const lateAdditions = pass3.candidates.filter((c) => !passTwoDomainSet.has(c.issueDomain));
    if (lateAdditions.length > 0) {
      // ESCALATE — per Proposal C, a new domain in pass 3 is a structural error.
      return {
        status: 'escalated',
        candidates: merged,
        nonApplicable: pass1.nonApplicable,
        seedCoveragePassed: true,
        divergenceCount: offSeedFromPass2.length,
        lateAdditionCount: lateAdditions.length,
        escalationReason: `pass 3 introduced ${lateAdditions.length} new domain(s) (forbidden): ${lateAdditions.map((c) => c.issueDomain).join(', ')}`,
      };
    }

    // Pass 3 may refine, split, merge, restate. We use pass3.candidates as the
    // canonical final set; pre-existing items not present in pass 3 are dropped
    // intentionally (consolidation may merge/restate).
    const finalCandidates = pass3.candidates.map((c) => {
      const prior = merged.find((m) => m.issueId === c.issueId || m.issueDomain === c.issueDomain);
      return {
        ...c,
        introducedAtPass: prior?.introducedAtPass ?? c.introducedAtPass,
        lastModifiedAtPass: 3 as const,
      };
    });

    return {
      status: 'completed',
      candidates: finalCandidates,
      nonApplicable: pass1.nonApplicable,
      seedCoveragePassed: true,
      divergenceCount: offSeedFromPass2.length,
      lateAdditionCount: 0,
    };
  }
}

function mergeCandidates(
  prior: readonly IssueCandidate[],
  next: readonly IssueCandidate[],
  pass: 1 | 2 | 3,
): IssueCandidate[] {
  const byKey = new Map<string, IssueCandidate>();
  for (const p of prior) byKey.set(p.issueId, p);
  for (const n of next) {
    const existing = byKey.get(n.issueId);
    if (existing) {
      byKey.set(n.issueId, { ...n, introducedAtPass: existing.introducedAtPass, lastModifiedAtPass: pass });
    } else {
      byKey.set(n.issueId, { ...n, introducedAtPass: pass, lastModifiedAtPass: pass });
    }
  }
  return Array.from(byKey.values());
}

export function bloomMetricsForResult(result: BloomResult, seedDomains: readonly SeedDomain[]): import('./types.js').BloomMetrics {
  const total = result.candidates.length || 1;
  const seedSet = new Set(seedDomains.map((s) => s.domain));
  const seedCovered = Array.from(seedSet).filter((d) =>
    result.candidates.some((c) => c.issueDomain === d) ||
    result.nonApplicable.some((n: NonApplicabilityRecord) => n.domain === d),
  ).length;
  return {
    seedCoverageRate: seedCovered / Math.max(seedSet.size, 1),
    divergenceRate: result.candidates.filter((c) => !seedSet.has(c.issueDomain)).length / total,
    lateAdditionRate: result.lateAdditionCount / total,
    pruneReasonCompleteness: 1, // computed by Issue Prune
  };
}
