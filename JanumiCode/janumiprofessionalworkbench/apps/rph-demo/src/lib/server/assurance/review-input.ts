// ⭐ `JAN-CRITREAD` J2-1 — WHAT THE REASONING REVIEWER IS HANDED, BUILT IN ONE PLACE.
//
// The authoring floor (`runPwaFloor`) and the work-product floor (`runWorkProductFloor`) each assembled the
// `ReasoningReviewInput` the reviewer judges — its framing, the instruction, the content, the producer's account —
// inline. Reviewer qualification (DESIGN-what-the-tests-prove.md §5.2) has to run a CASE through exactly that
// assembly and nothing else, so it lives here now, and both floors build through it. `review-input.test.ts` holds
// the two floors to this module byte for byte, and this module to its pins.
//
// ⛔ PURE, AND ~~IMPORTING NOTHING BUT TYPES~~ IMPORTING NOTHING THAT NEEDS SVELTEKIT OR THE DEMO HOST. A case is data;
// the runner and the check that replay it run outside SvelteKit and outside the demo host (`scripts/reviewer-qual/`). So
// this module may not import `$lib`, the authoring turn, the workbench, or either floor —
// `verif/review-input-imports.test.ts` refuses each, anywhere in the module's import closure. Everything a floor READS
// from an engine (the policy's criteria, the graph export) is read by the floor and handed in.
//
// ⭐ `JAN-PRQUAL` `PQ-1` (design D1, D2; `REG-F-476`) — IT NOW IMPORTS THREE MODULES AT RUNTIME, AND THE GUARD STILL HOLDS:
//   · the pure renderer (`process-result-render.ts`), which renders a process result's REVIEW view and fences it;
//   · the VALIDATOR's budget seam — the content budget it leaves the view (`processResultContentBudget`) and the prompt's
//     other untrusted slices the view's fence must avoid (`processResultUntrustedSlices`), both from the validator's own
//     assembler, never a copy of its arithmetic;
//   · the fence module (`review-fence.ts`), for `jsonLine` — the one encoder for JSON that sits on a line, which the
//     graph's content is (`REG-F-481`). The renderer and the validator import it too.
// ⚠ "Nothing but types" was the means, not the rule: what the rule protects is that the closure LOADS outside the app.
// All three are inside the closure `verif/review-input-imports.test.ts` walks, and the validator was already inside the
// qualification check's closure, which the same test holds to the same list.
//
// ⚠ WHAT STAYS WITH THE CALLER: the route-level pieces — the narration, the candidate's subject hash, the agent's
// rationale, the prior gaps — are the caller's to supply, and a qualification case supplies them as literals.
import type { AssessmentCriterion, ObservedToolCallReport } from '@janumipwb/rph-contracts';
import type { ProfessionalRationaleSummary, ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { PwaGraphExport } from '@janumipwb/rph-projections';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { renderProcessResultReview } from './process-result-render.js';
import {
	processResultContentBudget,
	processResultUntrustedSlices
} from './reasoning-review-validator.js';
import { jsonLine } from './review-fence.js';

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
		// ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — ONE LINE OF JSON, AND IT STAYS ONE LINE: `jsonLine` escapes the three line
		// breaks `JSON.stringify` leaves raw (U+0085, U+2028, U+2029), so a node name carrying one cannot stand a lookalike
		// fence line, or a forged heading, on a line of its own inside the fence. The parse is unchanged.
		content: jsonLine(source.graph),
		// ⭐ `PQ-1` (`REG-F-481`) — AND THE CANDIDATE'S SUBJECT HASH IS NOT IN IT. The host computed it, so the reviewer reads
		// it on a host line (`ReasoningReviewInput.candidateSubjectHash`); ⛔ merged into the graph's JSON it sat inside the
		// fence, quoted as the agent's artifact. Still only when non-empty: an empty hash is no hash.
		...(source.candidateSubjectHash ? { candidateSubjectHash: source.candidateSubjectHash } : {}),
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

/** What the process-result floor knows about the command result it reviews. */
export interface ProcessResultReviewSource {
	/** The ACTIVE `floor.reasoning-review` policy's criteria, read from the store by the caller. */
	readonly criteria: readonly AssessmentCriterion[];
	/** The instruction the PRODUCING model was given — the type's rendered template, never the turn. */
	readonly producingPrompt: string;
	/** The run, as the host observed it. Rendered here through the REVIEW view; the evidence holds the EVIDENCE view. */
	readonly run: ObservedProcessRun;
	/** ⭑ §9.7 — the producer's CONTRACTED account. Under `R15` this is the reasoning the review is OF. */
	readonly rationale?: ProfessionalRationaleSummary;
	/** ⭐ `R15` — the host's observation of the session's LAST turn, the independent half of the join. */
	readonly observedToolCalls?: ObservedToolCallReport;
	/** ⚠ NEVER SUPPLIED BY PRODUCTION (`runProcessResultFloor` passes none); optional so a probe can reach the slice. */
	readonly narration?: string;
	/** ⚠ NEVER SUPPLIED BY PRODUCTION either, for the same reason. */
	readonly priorGaps?: readonly string[];
}

/**
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D1) — THE ONE BUILDER OF A PROCESS RESULT'S REVIEW INPUT: what `runProcessResultFloor`
 * hands the reviewer, and what the fingerprint's probes and the qualification cases replay. `review-input.test.ts` holds
 * the floor to it byte for byte, input and prompt, as it holds the other two floors to theirs.
 *
 * ⛔ IT WAS BUILT INLINE, OVER A RENDERER THE QUALIFICATION CLOSURE COULD NOT REACH (`REG-D-072` D17; `REG-F-476`), so a
 * change to what the reviewer of a process result reads moved no reviewer fingerprint.
 *
 * ⭐ THE CONTENT IS THE RUN'S REVIEW VIEW, fitted to `processResultContentBudget` — the budget the validator's own
 * assembler leaves for THIS input's other slices — so the validator's generic cut never fires inside it (design D2).
 * ⚠ The budget is measured over the input WITHOUT its content, in the same key order the input is then returned in.
 *
 * ⭐ AND ITS FENCE AVOIDS THE WHOLE PROMPT (`REG-F-481`; design D2 under the sponsor's (a)): the view's chooser also reads
 * every other untrusted slice the prompt will carry — the instruction, the account, the narration, the prior findings,
 * every unminted call name — as the validator's own plan lists them (`processResultUntrustedSlices`). ⛔ Read over the
 * view's own slices alone, its token was almost always `<<<UNTRUSTED-00>>>`, and an instruction carrying a line of it
 * put that token inside the validator's region, where a reader pairing lines in order quoted the host's exit line.
 */
export function processResultReviewInput(source: ProcessResultReviewSource): ReasoningReviewInput {
	const shape = {
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED BY THE CALLER, never inferred from the subject.
		framing: 'PROCESS_RESULT' as const,
		prompt: source.producingPrompt
	};
	// ⭐ `R15` — THE TWO HALVES OF THE JOIN: the model's own account, and the host's observation of what it did. Neither
	// alone is a review: §22.1 makes the first untrusted, and the second carries no reasoning at all. ⚠ The account is
	// passed UNCONDITIONALLY (an absent one renders as the host's "NOT DECLARED"), as the floor always passed it.
	const halves = {
		rationale: source.rationale,
		...(source.observedToolCalls ? { observedToolCalls: source.observedToolCalls } : {}),
		narration: source.narration,
		...(source.priorGaps?.length ? { prior: { gaps: [...source.priorGaps] } } : {})
	};
	const budget = processResultContentBudget({ ...shape, ...halves });
	const otherUntrusted = processResultUntrustedSlices({ ...shape, ...halves });
	return {
		...shape,
		content: renderProcessResultReview(source.run, budget, otherUntrusted),
		...halves
	};
}
