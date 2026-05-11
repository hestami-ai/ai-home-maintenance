/**
 * Issue Bloom — types.
 *
 * Per docs/janumilegal_product_description_evolution.md §7 Proposal C:
 *
 *   Pass 1 (SEED COVERAGE):
 *     Lens-defined issue-domain seed set must be touched.
 *     Each domain produces a candidate or an explicit non-applicability record.
 *
 *   Pass 2 (DIVERGENCE):
 *     Permitted to introduce issue domains outside the seed set.
 *     Required to produce at least one matter-specific off-seed candidate
 *     OR an explicit attestation that no off-seed issue is plausible.
 *
 *   Pass 3 (CONSOLIDATION + DAMPENING):
 *     No new issue domains permitted.
 *     Permitted: refining, splitting, merging, restating existing candidates.
 *     If pass 3 produces a new domain, the bloom escalates.
 *
 *   Termination = pass 3 emits a clean IssueCandidateSet.
 *   Hard cap = 3 passes.
 */

export interface SeedDomain {
  readonly domain: string;
  readonly description?: string;
}

export interface IssueCandidate {
  readonly issueId: string;
  readonly issueDomain: string;
  readonly whyItMightMatter: string;
  readonly requiredFacts: readonly string[];
  readonly requiredSources: readonly string[];
  readonly reviewRequirement: 'none' | 'attorney' | 'business' | 'compliance';
  /** Pass at which this candidate was first introduced (1, 2, or — for refined-only — 3). */
  readonly introducedAtPass: 1 | 2 | 3;
  /** Pass at which this candidate was last modified (refined). */
  readonly lastModifiedAtPass: 1 | 2 | 3;
}

export interface NonApplicabilityRecord {
  readonly domain: string;
  readonly reason: string;
}

export interface PassOneOutput {
  readonly pass: 1;
  readonly candidates: readonly IssueCandidate[];
  /** Each seed domain that did NOT produce a candidate must have a non-applicability record. */
  readonly nonApplicable: readonly NonApplicabilityRecord[];
}

export interface PassTwoOutput {
  readonly pass: 2;
  readonly candidates: readonly IssueCandidate[];
  /** When the agent declines to introduce off-seed candidates, an attestation is required. */
  readonly attestation?: { readonly type: 'no_off_seed_plausible'; readonly basis: string };
}

export interface PassThreeOutput {
  readonly pass: 3;
  readonly candidates: readonly IssueCandidate[];
}

export interface BloomPassInput {
  readonly seedDomains: readonly SeedDomain[];
  readonly priorCandidates: readonly IssueCandidate[];
  readonly priorDomains: ReadonlySet<string>;
  /** Caller-supplied matter context summary. Wave 5 ships as opaque blob;
   *  Wave 6+ wires the AgentInvocationScope envelope. */
  readonly matterContextSummary: string;
}

export interface IssueBloomAgent {
  pass1(input: BloomPassInput): Promise<PassOneOutput>;
  pass2(input: BloomPassInput): Promise<PassTwoOutput>;
  pass3(input: BloomPassInput): Promise<PassThreeOutput>;
}

export interface BloomResult {
  readonly status: 'completed' | 'escalated';
  readonly candidates: readonly IssueCandidate[];
  readonly nonApplicable: readonly NonApplicabilityRecord[];
  readonly seedCoveragePassed: boolean;
  readonly divergenceCount: number;
  readonly lateAdditionCount: number;
  readonly escalationReason?: string;
}

export interface BloomMetrics {
  readonly seedCoverageRate: number; // 0..1
  readonly divergenceRate: number; // off-seed candidates / total
  readonly lateAdditionRate: number; // illegal pass-3 additions / total candidates
  readonly pruneReasonCompleteness: number; // fraction of pruning decisions with non-empty reason
}
