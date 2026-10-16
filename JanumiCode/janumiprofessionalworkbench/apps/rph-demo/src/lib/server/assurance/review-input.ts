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
import type {
	DeclaredInstruction,
	DeclaredPolicyFraming,
	ProfessionalRationaleSummary,
	ReasoningReviewInput
} from '@janumipwb/rph-assurance';
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

/** ⭐ E2 — one command a unit ran, as the host recorded it on its evidence: the command, its exit, and whether it timed out. */
export interface DeclaredReviewCommand {
	/** The work unit that ran it — its title, so the root's review can say whose command it was. */
	readonly unit: string;
	readonly argv: readonly string[];
	readonly exitCode: number | null;
	readonly timedOut: boolean;
}

/** ⭐ E2 — what a declared-policy review knows about the work it judges. */
export interface DeclaredPolicyReviewSource {
	/** The declared policy: its id, name and purpose, read from the stored policy by the caller. */
	readonly policy: DeclaredPolicyFraming;
	/** That policy's OWN criteria, read from the store — the rubric (`ASR-4`: never a second one). */
	readonly criteria: readonly AssessmentCriterion[];
	/** The instruction the work answered: the unit's rendered prompt, or, for a unit with none, its own purpose. */
	readonly instruction: string;
	/**
	 * ⭐ `E12F` F4 — WHAT `instruction` IS: the prompt the one producer of the work was given (`PRODUCING_PROMPT`), or the
	 * unit's own purpose (`UNIT_PURPOSE`) — a unit composed of others, or one whose work no recorded prompt produced. The
	 * reviewer is told which, and nothing else about it (`DeclaredInstruction`).
	 */
	readonly instructionIs: DeclaredInstruction;
	/**
	 * The work products judged, each with the title of the unit that produced it — the unit's own, or ~~its children's~~ ⭐ R3-A
	 * F1: for a unit composed of others, its whole subtree's.
	 */
	readonly workProducts: readonly { readonly unit: string; readonly answer: string }[];
	/** The commands those units ran, as the host recorded them. */
	readonly commands: readonly DeclaredReviewCommand[];
	/** ⭑ §9.7 — the producer's CONTRACTED account, when one unit's work is judged and it returned one. */
	readonly rationale?: ProfessionalRationaleSummary;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3); `DESIGN-phase-7-completion.md` B1, B6) — THE ONE
 * BUILDER OF A DECLARED-POLICY REVIEW'S INPUT: what Record Assurance hands the reviewer for each of a unit's declared
 * policies, and what the declared qualification cases replay (`scripts/reviewer-qual/materialize.ts`).
 *
 * ⭑ THE WORK IS THE UNIT'S WORK PRODUCT AND THE COMMANDS IT RAN (`R18`): the reviewer judges the declared policy over both.
 * For a unit composed of others the work is ~~its CHILDREN's work products and commands~~ ⭐ R3-A F1 (`REG-D-111` (2)'s
 * general form): the work products and commands its whole subtree produced, its own included, the end-to-end phase's among
 * them (DEC-6) — for §3.2's root, its children's: the root's own TRANSFORMATION produces nothing.
 * ⭐ ONE UNTRUSTED VALUE, IN ITS STATED SERIALIZATION (`REG-F-481`): the work is ONE line of JSON (`jsonLine`, as the graph's
 * content is) — `workProducts`, each work product with the title of the unit that produced it, and `commands`, each command
 * with the exit code and timeout recorded for it — and the host line above it says so (the validator's `DECLARED_POLICY`
 * framing). ⛔ No word of the host's is written into it: no label, no heading, no "(none)".
 * ⚠ THE COMMANDS ARE NOT THE FLOOR'S REVIEW VIEW: each was already reviewed on its own (`runProcessResultFloor`), and what a
 * policy's criteria need of them is which ran and how each ended. ⚠ So the exit codes the HOST recorded sit inside the quoted
 * value, beside the agent's arguments — the conservative direction, disclosed on the host line: the host's record is
 * understated as quoted, and no word of the agent's is ever shown as the host's.
 * ⚠ A unit with no work product is judged as it is — an empty `workProducts` — and nothing is invented to fill it.
 */
export function declaredPolicyReviewInput(source: DeclaredPolicyReviewSource): ReasoningReviewInput {
	return {
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED BY THE CALLER, and the policy it judges against with it (`declaredPolicy`).
		framing: 'DECLARED_POLICY',
		declaredPolicy: { policyId: source.policy.policyId, name: source.policy.name, purpose: source.policy.purpose },
		// ⭐ `E12F` F4 — what the instruction IS, so the reviewer is told only what is true of it.
		declaredInstruction: source.instructionIs,
		prompt: source.instruction,
		content: jsonLine({
			workProducts: source.workProducts.map((w) => ({ workUnit: w.unit, workProduct: w.answer })),
			commands: source.commands.map((c) => ({
				workUnit: c.unit,
				command: c.argv,
				exitCode: c.exitCode,
				timedOut: c.timedOut
			}))
		}),
		// ⚠ PASSED UNCONDITIONALLY, as the work-product floor passes it: §9.7 — presence or absence is never a signal.
		rationale: source.rationale,
		narration: undefined
	};
}
