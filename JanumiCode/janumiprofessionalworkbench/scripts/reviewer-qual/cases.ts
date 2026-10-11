// ⭐ `JAN-CRITREAD` J2-1 — WHAT A REVIEWER-QUALIFICATION CASE IS (DESIGN-what-the-tests-prove.md §5.2).
//
// A case is DATA: every input the reasoning reviewer sees, as literals, with fixed ids — so it materializes the same
// prompt on every run. Only the reviewer-side assembly runs through product code (`materialize.ts`, through the one
// module both production floors build with). What the case is EXPECTED to draw from a reviewer is its ORACLE, kept
// in a separate file with its own version (§5.2, §5.4): correcting an oracle moves no case and no case digest.
//
// ⚠ TYPES, PATHS AND THE SERIALIZER ONLY — NO RUNTIME IMPORT. The generator (`generate.ts`) runs under bare `bun`,
// where `@janumipwb/*` would resolve to built `dist` (`REG-D-072` D11); nothing here needs a package at runtime.
import type { AssuranceSubject, ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import type { PwaGraphNode, PwaMeta } from '@janumipwb/rph-projections';
import type { ObservedProcessRun } from '../../apps/rph-demo/src/lib/server/tools/process-run-observer.js';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { DeclaredReviewCommand } from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';

/**
 * ⭐ THE PRODUCER EVERY CASE CARRIES (`REG-D-072` D13). The reasoning-review policy requires `DIFFERENT_MODEL`
 * independence (`floor-policies.ts`), so a case whose producer shared a model id with the candidate reviewer would be
 * refused on independence and measure nothing about judgement. No candidate model is, or can be, labelled this.
 */
export const CASE_PRODUCER_MODEL_ID = 'jpwb-qualification-case-author';
export const CASE_PRODUCER_PROVIDER_ID = 'jpwb-qualification';

/** What the graph arm hands `graphReviewInput`, less the policy's criteria — the graph as literal `PwaMeta` +
 *  `PwaGraphNode[]` (keys in production's order), which `buildPwaGraphExport` turns into the export production builds. */
export interface GraphCaseInput {
	readonly prompt: string;
	readonly pwa: PwaMeta;
	readonly nodes: readonly PwaGraphNode[];
	readonly candidateSubjectHash?: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly narration?: string;
	readonly priorGaps?: readonly string[];
}

/** What the work-product arm hands `workProductReviewInput`, less the criteria — never re-rendered, so a change to a
 *  producer's template moves no case. */
export interface WorkProductCaseInput {
	readonly producingPrompt: string;
	readonly answer: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly priorGaps?: readonly string[];
}

/**
 * ⭐ `JAN-PRQUAL` `PQ-2` (DESIGN-process-result-qualification.md D4, §5) — what the process-result arm hands
 * `processResultReviewInput`, less the criteria: the RUN LITERAL as the host observed it, which the product's builder
 * renders at materialize time (`materialize.ts`), so a change to what the reviewer of a process result reads reaches the
 * case's prompt; the instruction the producer was given; its account; the host's observation of its calls.
 * ⛔ NO NARRATION AND NO PRIOR GAPS, BY TYPE: `runProcessResultFloor` passes neither, so a case cannot carry either.
 */
export interface ProcessResultCaseInput {
	readonly producingPrompt: string;
	readonly run: ObservedProcessRun;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly observedToolCalls?: ObservedToolCallReport;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B5; `REG-D-110` (3)) — what the declared-policy arm
 * hands `declaredPolicyReviewInput`: the declared POLICY it is judged against — its id, name, purpose and criteria, as the
 * catalog seeds them, carried as literals (a case is data) — the unit's instruction, its work products and the commands it
 * ran. ⛔ ITS CRITERIA ARE ITS OWN: the runner's `criteria` (the floor's seeded rubric) never reaches a declared case.
 */
export interface DeclaredPolicyCaseInput {
	readonly policy: {
		readonly policyId: string;
		readonly name: string;
		readonly purpose: string;
		readonly criteria: readonly AssessmentCriterion[];
	};
	readonly instruction: string;
	readonly workProducts: readonly { readonly unit: string; readonly answer: string }[];
	readonly commands: readonly DeclaredReviewCommand[];
	readonly rationale?: ProfessionalRationaleSummary;
}

interface CaseCommon {
	/** Stable across versions of the set: a case that changes gets a new id (version two's `G2-…`, `case-set-v2.ts`;
	 *  version three's `G3-…`, `case-set-v3.ts`). */
	readonly id: string;
	/** The subject the floor composes over — its id, version and the producer independence is checked against. */
	readonly subject: AssuranceSubject;
}
export interface GraphCase extends CaseCommon {
	readonly arm: 'PWA_GRAPH';
	readonly input: GraphCaseInput;
}
export interface WorkProductCase extends CaseCommon {
	readonly arm: 'WORK_PRODUCT';
	readonly input: WorkProductCaseInput;
}
/** ⭐ `PQ-2` (design D4) — the third arm: one completed command run, reviewed against the account (`R15`). */
export interface ProcessResultCase extends CaseCommon {
	readonly arm: 'PROCESS_RESULT';
	readonly input: ProcessResultCaseInput;
}
/** ⭐ E2 (design B5) — the fourth arm: a work unit's work, judged against one of its declared policies. */
export interface DeclaredPolicyCase extends CaseCommon {
	readonly arm: 'DECLARED_POLICY';
	readonly input: DeclaredPolicyCaseInput;
}
export type QualificationCase = GraphCase | WorkProductCase | ProcessResultCase | DeclaredPolicyCase;

export interface CaseSet {
	readonly note: string;
	readonly caseSetVersion: number;
	readonly cases: readonly QualificationCase[];
}

/** Whether a failure against this expectation is the reviewer's, or possibly the case's (§5.2; `REG-F-427` (4)). */
export type OracleStanding = 'uncontested' | "the author's claim";

export interface Oracle {
	readonly caseId: string;
	/** The criteria the case REQUIRES faulted. A reviewer that faults others as well has not failed discrimination
	 *  (§5.1 (2)); an empty list on a clean case means ANY fault fails clean acceptance (§5.1 (3)). */
	readonly faulted: readonly string[];
	/** The Reasoning Review policy's disposition expected from `composeAssuranceOutcome` over its reference alone. */
	readonly disposition: 'SATISFIED' | 'REJECTED';
	readonly expectation: OracleStanding;
	/** What the case plants, or why it is clean — for the reader of a failure, never read by a scorer. */
	readonly note: string;
}

export interface OracleSet {
	readonly note: string;
	readonly oracleVersion: number;
	/** The case set these oracles judge. */
	readonly caseSetVersion: number;
	/** Who conferred them, and under what authority. */
	readonly conferral: string;
	readonly oracles: readonly Oracle[];
}

/** Where the generated data lives, repo-relative. The directory's own `*.ndjson` files are the run record (§5.4). */
export const CASE_SET_V1_FILE = 'docs/tracking/reviewer-qualification/cases/case-set-v1.json';
export const ORACLES_V1_FILE = 'docs/tracking/reviewer-qualification/oracles/oracles-v1.json';
/** ⭐ `JAN-CRITREAD` J2-5 — version two (`REG-F-449`; `REG-D-078`), beside version one, which stays as history. */
export const CASE_SET_V2_FILE = 'docs/tracking/reviewer-qualification/cases/case-set-v2.json';
export const ORACLES_V2_FILE = 'docs/tracking/reviewer-qualification/oracles/oracles-v2.json';
/** ⭐ `JAN-CRITREAD` J2-7 — version three (`REG-F-453`; `REG-D-081`), beside versions one and two, which stay as history. */
export const CASE_SET_V3_FILE = 'docs/tracking/reviewer-qualification/cases/case-set-v3.json';
export const ORACLES_V3_FILE = 'docs/tracking/reviewer-qualification/oracles/oracles-v3.json';
/** ⭐ `JAN-PRQUAL` `PQ-2` — version four (design D4, §5; `REG-D-095`), beside versions one to three, which stay as history. */
export const CASE_SET_V4_FILE = 'docs/tracking/reviewer-qualification/cases/case-set-v4.json';
export const ORACLES_V4_FILE = 'docs/tracking/reviewer-qualification/oracles/oracles-v4.json';
/** ⭐ `JAN-EXEC` Phase 7 completion E2 — version five (design B5), beside versions one to four, which stay as history. */
export const CASE_SET_V5_FILE = 'docs/tracking/reviewer-qualification/cases/case-set-v5.json';
export const ORACLES_V5_FILE = 'docs/tracking/reviewer-qualification/oracles/oracles-v5.json';

/**
 * ⭐ `JAN-CRITREAD` J2-5 — THE CURRENT CASE SET AND ITS ORACLES: what `reviewer:qual:check` holds coverage and
 * escalation to, what a run runs (`run.ts`), and what the fingerprint's case-set digest is taken over. The one place
 * the current version is named, so the check, the runner and the stamp cannot sit on different versions.
 * Version two from J2-5: version one's graph cases built on the draft, with `REG-F-449`'s correction, under new ids.
 * ⭐ Version three from J2-7: version two's twelve changed cases with the sponsor's two changes — the design type's
 * scope takes in the foundations, and the permit receives the report and the calculations (`REG-D-081`) — under new ids.
 * ⭐ Version four since `JAN-PRQUAL` `PQ-2`: version three's twenty-six cases under their ids, byte for byte, and the
 * fourteen process-result cases the sponsor conferred (DESIGN-process-result-qualification.md §5; `REG-D-095`).
 * ⭐⭐ Version five since `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B5): version four's forty cases
 * under their ids, byte for byte, and fourteen DECLARED-POLICY cases, their oracles PROPOSED, awaiting the sponsor's
 * conferral (design §6 step 2). ⚠ It moves the case-set digest, so `reviewer:qual:check` owes a RUN (P4).
 */
export const CURRENT_CASE_SET_FILE = CASE_SET_V5_FILE;
export const CURRENT_ORACLES_FILE = ORACLES_V5_FILE;

/** The one serialization of a generated file: tab-indented JSON, LF, a final newline. */
export function serializeGenerated(value: CaseSet | OracleSet): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}
