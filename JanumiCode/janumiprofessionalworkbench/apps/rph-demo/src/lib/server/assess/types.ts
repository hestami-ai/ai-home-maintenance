// FaithfulnessAssessor — the PORT that answers the semantic question the deterministic invariant layer cannot:
// "is this generated PWA graph a FAITHFUL interpretation of the prompt it was authored from?"
//
// This is Layer B of the validation harness, promoted into the PRODUCT itself: assurance-over-authoring
// (exec != assurance — the assessor is a DIFFERENT vendor than the authoring executor, recorded in the
// AUTHORING_ASSESSMENT's `assessor` reference). The port has two runtime adapters:
//   • agy   — Google Antigravity CLI (Gemini) shelled out from the Node server; the product-runtime judge.
//   • mock  — deterministic, structural-only; TEST_MODE default and offline fallback (calls no model).
// The Claude judge panel (harness/pwa-judge-panel.workflow.js) stays the out-of-band ORACLE that grades the
// product's own judge; it is NOT a runtime adapter.
import type { PwaGraphExport } from '@janumipwb/rph-projections';

export type FaithfulnessVerdict = 'FAITHFUL' | 'PARTIAL' | 'POOR';

/** One prompt-derived judging dimension and its 0..1 score. Criteria are GENERIC — the judge extracts them
 *  from the prompt's own methodologies/requirements (e.g. V-model, UCD, JTBD for an SDLC prompt), not hardcoded. */
export interface CriterionScore {
	readonly name: string;
	readonly score: number;
	readonly rationale?: string;
}

export interface AssessmentInput {
	readonly pwaId: string;
	/** The natural-language prompt the PWA was authored from — the intent being judged against. */
	readonly prompt: string;
	/** The canonical graph export (engine truth, not the render model) the judge reads. */
	readonly graphExport: PwaGraphExport;
	/** The authoring agent's OWN recorded narration/plan, if available (adds "what it intended"). */
	readonly plan?: string;
	/** 1-based iteration within one authoring turn's assess/refine loop. */
	readonly iteration: number;
	/** The previous assessment in the loop, for convergence framing (iteration >= 2). */
	readonly prior?: { readonly overallScore: number; readonly gaps: readonly string[] };
}

export interface AssessmentResult {
	readonly verdict: FaithfulnessVerdict;
	readonly overallScore: number;
	readonly criteria: CriterionScore[];
	readonly gaps: string[];
	readonly recommendation: string;
	/** The model that actually judged (audit trail; recorded as assessor.modelId). */
	readonly assessorModel?: string;
}

export interface FaithfulnessAssessor {
	readonly kind: 'agy' | 'mock';
	assess(input: AssessmentInput): Promise<AssessmentResult>;
}
