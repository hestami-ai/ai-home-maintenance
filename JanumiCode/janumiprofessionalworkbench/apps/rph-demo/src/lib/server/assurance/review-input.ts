// ⭐ `JAN-CRITREAD` J2-1 — WHAT THE REASONING REVIEWER IS HANDED, BUILT IN ONE PLACE.
//
// The authoring floor (`runPwaFloor`) and the work-product floor (`runWorkProductFloor`) each assembled the
// `ReasoningReviewInput` the reviewer judges — its framing, the instruction, the content, the producer's account —
// inline. Reviewer qualification (DESIGN-what-the-tests-prove.md §5.2) has to run a CASE through exactly that
// assembly and nothing else, so it lives here now, and both floors build through it. `review-input.test.ts` holds
// the two floors to this module byte for byte, and this module to its pins.
//
// ⛔ PURE, AND IMPORTING NOTHING BUT TYPES. A case is data; the runner and the check that replay it run outside
// SvelteKit and outside the demo host (`scripts/reviewer-qual/`). So this module may not import `$lib`, the
// authoring turn, the workbench, or either floor — `verif/review-input-imports.test.ts` refuses each, anywhere in
// the module's import closure. Everything a floor READS from an engine (the policy's criteria, the graph export)
// is read by the floor and handed in.
//
// ⚠ WHAT STAYS WITH THE CALLER: the route-level pieces — the narration, the candidate's subject hash, the agent's
// rationale, the prior gaps — are the caller's to supply, and a qualification case supplies them as literals.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ProfessionalRationaleSummary, ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { PwaGraphExport } from '@janumipwb/rph-projections';

/** What the authoring floor knows about the draft it reviews. */
export interface GraphReviewSource {
	/** The ACTIVE `floor.reasoning-review` policy's criteria, read from the store by the caller (`reasoningReviewCriteria`). */
	readonly criteria: readonly AssessmentCriterion[];
	/** The intent the producing agent was given. */
	readonly prompt: string;
	/** The canonical export of the PWA's PWU-Type graph (`buildPwaExport`, or `buildPwaGraphExport` over literals). */
	readonly graph: PwaGraphExport;
	/** Exact app-local semantic hash of the candidate reviewed in this run. */
	readonly candidateSubjectHash?: string;
	/** The §9.7 contracted account the producer RETURNED. Undefined = it declared none. */
	readonly rationale?: ProfessionalRationaleSummary;
	/** The producer's observable narration — §8.4 admits "other observable trace data". Never its interior. */
	readonly narration?: string;
	readonly priorGaps?: readonly string[];
}

/** The reasoning-review input for a DRAFT PWA graph — what `runPwaFloor` hands the reviewer. */
export function graphReviewInput(source: GraphReviewSource): ReasoningReviewInput {
	return {
		// The POLICY's criteria, read from the store — not a constant. See `reasoningReviewCriteria()`.
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED, NOT INFERRED. This arm is the original framing and the one the reviewers used to
		// reach as the FALSE half of a boolean; naming it means the graph arm is now chosen rather than
		// defaulted into, which is what stopped a third subject kind arriving there silently.
		framing: 'PWA_GRAPH',
		prompt: source.prompt,
		content: JSON.stringify({
			...source.graph,
			...(source.candidateSubjectHash ? { candidateSubjectHash: source.candidateSubjectHash } : {})
		}),
		// §8.4 orders what Reasoning Review reviews: the contracted rationale summary FIRST, then outputs and
		// tool records, then other observable trace data. Both are passed through unconditionally — §9.7
		// forbids treating presence or absence as a signal, and a constant-shape input is also what makes the
		// §14.3 ablation a real test rather than a null one.
		...(source.rationale ? { rationale: source.rationale } : {}),
		narration: source.narration ?? '',
		...(source.priorGaps?.length ? { prior: { gaps: source.priorGaps } } : {})
	};
}

/** What the work-product floor knows about the answer it reviews. */
export interface WorkProductReviewSource {
	/** The ACTIVE `floor.reasoning-review` policy's criteria, read from the store by the caller. */
	readonly criteria: readonly AssessmentCriterion[];
	/** The prompt the PRODUCING model was given, so the reviewer judges the same pair the producer saw. */
	readonly producingPrompt: string;
	/** The retained answer — the work product itself. */
	readonly answer: string;
	/** ⭑ §9.7 — the producer's CONTRACTED account; never its volunteered reasoning (`PER-12`). */
	readonly rationale?: ProfessionalRationaleSummary;
	/** ⚠ OFF BY DEFAULT — see `reviewSeesPriorFindings`. */
	readonly priorGaps?: readonly string[];
}

/** The reasoning-review input for a WORK PRODUCT — what `runWorkProductFloor` hands the reviewer. */
export function workProductReviewInput(source: WorkProductReviewSource): ReasoningReviewInput {
	return {
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED BY THE CALLER, so the reviewer is told what it is looking at rather than having
		// it inferred from `subject.objectType`. The inference was BINARY, and Phase 5 measured what that
		// costs.
		framing: 'WORK_PRODUCT',
		// ⭑ THE REVIEWER JUDGES THE SAME PAIR THE PRODUCER SAW — the prompt that was given and the answer
		// that came back. Handing it a summary would make the judgement about the summary.
		prompt: source.producingPrompt,
		content: source.answer,
		// ⚠ PASSED UNCONDITIONALLY — the section renders `(none recorded)` when absent. §9.7: presence or
		// absence is never a signal, so the reviewer's INPUT SHAPE must not encode whether the producer
		// declared one. What the reviewer may do is find against a real absence, which is a judgement about
		// the work rather than a difference in what it was handed.
		rationale: source.rationale,
		narration: undefined,
		// ⭑ THE DESIGNED CHANNEL, USED ONLY WHEN CONFIGURED. `judgePrompt` frames it as *"A PREVIOUS review
		// flagged … Judge whether those are genuinely resolved"* — which is the right framing IF the reviewer
		// is meant to know. It defaults to unset because the sponsor's model puts that state on the
		// PRODUCER, and the paper's deployed pipeline does the same: the judge's reason goes to the
		// GENERATOR's prompt, and the judge re-scores each draft cold.
		prior: source.priorGaps?.length ? { gaps: [...source.priorGaps] } : undefined
	};
}
