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
	DeclaredUnitWithoutWork,
	Deliverable,
	DeliverableFile,
	HostSequence,
	HostSequenceAct,
	ProfessionalRationaleSummary,
	ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import type { PwaGraphExport, PwaTypePart } from '@janumipwb/rph-projections';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { renderProcessResultReview } from './process-result-render.js';
import {
	declaredPolicyContentBudget,
	processResultContentBudget,
	processResultUntrustedSlices,
	pwaTypeContentBudget
} from './reasoning-review-validator.js';
import { codePoints, headCutDeclaration, headOf, jsonLine } from './review-fence.js';

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

/**
 * The reasoning-review input for a DRAFT PWA graph — what `runPwaFloor` handed the reviewer until the review in parts.
 * ⭐ B3 (`REG-D-125`): the authoring floor hands the reviewer one part per type (`pwaTypeReviewInput`); this builder stays for
 * the historical case sets, which materialize through it.
 */
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

/** ⭐⭐ The review in parts, B1 — what the authoring floor knows about ONE TYPE of the draft it reviews. */
export interface PwaTypeReviewSource {
	/** The ACTIVE `floor.reasoning-review` policy's criteria, read from the store by the caller (`reasoningReviewCriteria`). */
	readonly criteria: readonly AssessmentCriterion[];
	/** The request the PWA was authored from — the intent the producing agent was given. */
	readonly prompt: string;
	/** One part of the candidate's export: a type, with its place in the PWA (`pwaTypeParts`). */
	readonly part: PwaTypePart;
	/** Exact app-local semantic hash of the candidate reviewed in this run. */
	readonly candidateSubjectHash?: string;
	/** The §9.7 contracted account the producer RETURNED — one, for the whole PWA. Undefined = it declared none. */
	readonly rationale?: ProfessionalRationaleSummary;
	/** The producer's observable narration — §8.4 admits "other observable trace data". Never its interior. */
	readonly narration?: string;
	readonly priorGaps?: readonly string[];
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1, D3) — THE ONE BUILDER OF
 * A PART'S REVIEW INPUT: one type of an authored PWA, reviewed in the `PWA_TYPE` framing, its whole definition the subject and
 * its place in the PWA the context (`pwaTypeParts`). ⛔ One reviewer reading the whole PWA saw about half of run-11's 16 types
 * once their prompts and policies were exported (`REG-F-571`).
 *
 * ⭐ THE PART IS LINES OF JSON, ONE UNTRUSTED VALUE IN ONE FENCE (`REG-F-481`; `jsonLine`, so no authored byte can break a
 * line): the SUBJECT, `{"subject":…}`; the CONTEXT, `{"context":…}`; then one line per child, `{"childSkeleton":…}`, in the
 * order the type permits them. The request is the instruction slice, and the account, the narration and the prior findings
 * are passed as the graph's are — bounded by the validator as today.
 * ⭐ IT FITS THE BUDGET THE VALIDATOR'S OWN ASSEMBLER LEAVES IT (`pwaTypeContentBudget`, measured over the input without its
 * content, in the key order it is returned in), and THE SUBJECT IS PROTECTED: a part over that budget has its children's
 * skeletons cut child by child, each cut declared (`declaredPartCut`, `childSkeletonsCut`), and the subject and context lines
 * never. ⚠ A part that cannot fit so is handed on whole, and the validator refuses it as incomplete — never head-cut.
 * ⭐ D3a (`REG-D-127`) — a part cut with the policy library carries its declared policies named on its subject line and the
 * policies its kind may take on its context line (`pwaTypeParts`): authored strings, inside the one fence, counted in the subject
 * and the context this builder never cuts.
 */
export function pwaTypeReviewInput(source: PwaTypeReviewSource): ReasoningReviewInput {
	const head = {
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED BY THE CALLER, never inferred from the subject.
		framing: 'PWA_TYPE' as const,
		prompt: source.prompt
	};
	// ⚠ As `graphReviewInput` passes them: the hash only when non-empty, the account when returned, the narration always,
	// the prior findings when there are any.
	const { candidateSubjectHash: hash, rationale: account, priorGaps: gaps } = source;
	const tail = {
		...(hash ? { candidateSubjectHash: hash } : {}),
		...(account ? { rationale: account } : {}),
		narration: source.narration ?? '',
		...(gaps?.length ? { prior: { gaps } } : {})
	};
	const lines = partLines(source.part);
	const whole = [lines.subject, lines.context, ...lines.children.map((c) => c.line)].join('\n');
	const budget = pwaTypeContentBudget({ ...head, ...tail });
	const cut = whole.length > budget ? childSkeletonsCut(lines, budget) : undefined;
	return cut === undefined
		? { ...head, content: whole, ...tail }
		: { ...head, content: cut.content, declaredPartCut: cut.cut, ...tail };
}

/**
 * A part as its review shows it: the subject's line, the context's line, and each child's line with its type id. ⭐ A2 (3) —
 * ~~and its name~~: a cut's declaration names a child by its ordinal and its type id, so its authored name is on its own
 * fenced line alone.
 */
interface PartLines {
	readonly subject: string;
	readonly context: string;
	readonly children: readonly { readonly id: string; readonly line: string }[];
}

function partLines(part: PwaTypePart): PartLines {
	return {
		subject: jsonLine({ subject: part.subject }),
		context: jsonLine({ context: part.context }),
		children: part.childSkeletons.map((s) => ({ id: s.id, line: jsonLine({ childSkeleton: s }) }))
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
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package N — D10 (`REG-D-135` (1); `REG-F-522` remedy candidate 2) — THE FILES THE UNIT CHANGED
	 * IN ITS WORKSPACE SINCE ITS STEP BEGAN, as the host read them after the try that made this answer (`deliverableAfterTry`,
	 * `execution/deliverable-view.ts`). ⭑ Production always hands it — none changed is a measurement too; a historical case
	 * hands none, and is reviewed as before.
	 */
	readonly deliverable?: Deliverable;
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
		prior: source.priorGaps?.length ? { gaps: [...source.priorGaps] } : undefined,
		// ⭐⭐ Package N — D10 — the finished work beside the answer: the files the unit changed and the step's writes and runs,
		// only when handed, so a historical case's input is unchanged. The validator lays them out within today's budget, cut
		// unit by unit, each cut declared before its bytes (`deliverableLayout`, `sequenceBlock`).
		...(source.deliverable ? { deliverable: source.deliverable } : {})
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
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package N — D12 (`REG-D-135` (1); `REG-F-579`) — THE STEP'S WRITES AND RUNS TO DATE, this
	 * command's act among them (`subjectOrdinal`): its place in the step's sequence, which its narrowed question asks of.
	 */
	readonly hostSequence?: HostSequence;
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
		...(source.priorGaps?.length ? { prior: { gaps: [...source.priorGaps] } } : {}),
		// ⭐ Package N — D12 — the step's sequence, on the validator's host lines after the view: its share comes out of the
		// view's budget (`processResultContentBudget`), and its commands and paths are among the slices the view's fence
		// avoids (`processResultUntrustedSlices`) — both the validator's own plan, so the view fits what the prompt leaves it.
		...(source.hostSequence ? { hostSequence: source.hostSequence } : {})
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

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package N — D11 (`REG-D-135` (1), the lead's D11; design D11) — ONE FILE A UNIT CHANGED IN ITS
 * WORKSPACE SINCE ITS STEP BEGAN, as the host recorded it at the unit's completion (`execution/deliverable-view.ts`): its
 * path, what changed, and its text as the host read it — none for a removed file.
 */
export interface DeclaredReviewFile {
	readonly unit: string;
	readonly path: string;
	readonly change: DeliverableFile['change'];
	readonly content?: string;
}

/** ⭐ Package N — D11 — one act of a unit's step's host sequence, as recorded at its completion, with the unit that made it. */
export type DeclaredReviewAct = HostSequenceAct & { readonly unit: string };

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
	/**
	 * ⭐⭐ Package N — D11 — THE FILES THOSE UNITS CHANGED, as recorded at each one's completion, in the same composition as
	 * their work products (the unit's own, then its subtree's, depth first). ⭑ Production always hands it, empty where none
	 * changed; a historical case hands none, and its line is built as before.
	 */
	readonly files?: readonly DeclaredReviewFile[];
	/** ⭐ Package N — D11 — those units' steps' writes and runs, try by try, as recorded at each one's completion. */
	readonly sequence?: readonly DeclaredReviewAct[];
	/**
	 * ⭐ Package N — D11 — each unit whose model's work completed with no deliverable view on the record (its admitted try ran no
	 * command whose evidence carries the pointer): named to the reviewer on a host line of its own, so its absence from
	 * `files` and `sequence` is never read as "it changed nothing".
	 */
	readonly unitsWithoutDeliverable?: readonly string[];
	/** ⭑ §9.7 — the producer's CONTRACTED account, when one unit's work is judged and it returned one. */
	readonly rationale?: ProfessionalRationaleSummary;
	/**
	 * ⭐ P5 package B (F1) — for a unit composed of others, each unit below it that holds no completion, so contributed no
	 * work: named to the reviewer on a host line of its own (`declaredUnitWithoutWorkLine`).
	 */
	readonly unitsWithoutWork?: readonly DeclaredUnitWithoutWork[];
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
 * ⭐⭐ P5 package B (F1, F2) — AND A UNIT BELOW THAT HOLDS NO COMPLETION IS NAMED, each on a host line of its own
 * (`unitsWithoutWork`); and work of MORE THAN ONE UNIT that is longer than the budget the prompt leaves it is cut UNIT BY
 * UNIT (`workCutUnitByUnit`), each unit's part to its own share, never head-only across units. ⛔ The head-only cut of
 * P5's root kept the first 21684 of 50586 code points: Requirements whole, Design to its §5, and nothing of
 * Implementation or of any command. ⭑ Work of one unit, or work that fits, is built exactly as before.
 * ⭐⭐ `JAN-EXEC` Phase 7, package N — D11 (`REG-D-135` (1), the lead's D11) — AND THE DELIVERABLE, AS THE WORK-PRODUCT REVIEW
 * IS SHOWN IT: the files each unit changed (`files`: its unit, path, what changed and its text) and each unit's step's writes
 * and runs (`sequence`: its unit, try, act number, and the path written or the command run with its exit), as recorded at
 * each one's completion, on the same line in the same composition. ⛔ Judging a declared policy without the delivered files
 * kept `REG-F-522`'s gap on this plane. ⭐ Work carrying them that is over its budget is cut unit by unit even when it is one
 * unit's — a head-only cut of the line would lose its files and sequence first — each file's text to its head and each
 * unit's acts from the last, each cut declared (`workCutUnitByUnit`). ⚠ Work carrying neither is built exactly as before.
 */
export function declaredPolicyReviewInput(source: DeclaredPolicyReviewSource): ReasoningReviewInput {
	const unitsWithoutWork = source.unitsWithoutWork ?? [];
	const head = {
		criteria: source.criteria,
		// ⭑ `R14` — DECLARED BY THE CALLER, and the policy it judges against with it (`declaredPolicy`).
		framing: 'DECLARED_POLICY' as const,
		declaredPolicy: { policyId: source.policy.policyId, name: source.policy.name, purpose: source.policy.purpose },
		// ⭐ `E12F` F4 — what the instruction IS, so the reviewer is told only what is true of it.
		declaredInstruction: source.instructionIs,
		...(unitsWithoutWork.length > 0 ? { declaredUnitsWithoutWork: unitsWithoutWork } : {}),
		...(source.unitsWithoutDeliverable?.length ? { declaredUnitsWithoutDeliverable: source.unitsWithoutDeliverable } : {}),
		prompt: source.instruction
	};
	// ⚠ PASSED UNCONDITIONALLY, as the work-product floor passes it: §9.7 — presence or absence is never a signal.
	const tail = { rationale: source.rationale, narration: undefined };
	const work: DeclaredWork = {
		workProducts: source.workProducts,
		commands: source.commands,
		...(source.files ? { files: source.files } : {}),
		...(source.sequence ? { sequence: source.sequence } : {})
	};
	const whole = workLine(work);
	const units = unitsOf(work);
	const carriesDeliverable = work.files !== undefined || work.sequence !== undefined;
	const budget = declaredPolicyContentBudget({ ...head, ...tail });
	const shared =
		(units.length > 1 || carriesDeliverable) && whole.length > budget ? workCutUnitByUnit(work, budget) : undefined;
	return shared === undefined
		? { ...head, content: whole, ...tail }
		: { ...head, content: shared.content, declaredWorkCut: shared.cut, ...tail };
}

/** ⭐ Package N — what a declared review's line holds: work products and commands, and — when handed — files and acts. */
interface DeclaredWork {
	readonly workProducts: readonly { readonly unit: string; readonly answer: string }[];
	readonly commands: readonly DeclaredReviewCommand[];
	readonly files?: readonly DeclaredReviewFile[];
	readonly sequence?: readonly DeclaredReviewAct[];
}

/** Every unit the work names, in the order it first names them: work products, commands, files, then acts. */
const unitsOf = (w: DeclaredWork): string[] => [
	...new Set([
		...w.workProducts.map((x) => x.unit),
		...w.commands.map((x) => x.unit),
		...(w.files ?? []).map((x) => x.unit),
		...(w.sequence ?? []).map((x) => x.unit)
	])
];

/**
 * A declared review's work as ONE line of JSON: each work product under its unit's title, then each command it ran — ⭐ and,
 * package N (D11), when handed: each file a unit changed, then each act of its step's sequence.
 */
function workLine(w: DeclaredWork): string {
	return jsonLine({
		workProducts: w.workProducts.map((x) => ({ workUnit: x.unit, workProduct: x.answer })),
		commands: w.commands.map(commandEntry),
		...(w.files ? { files: w.files.map(fileEntry) } : {}),
		...(w.sequence ? { sequence: w.sequence.map(actEntry) } : {})
	});
}

/** One command's entry on that line: its unit, its arguments, and the exit and timeout the host recorded. */
const commandEntry = (c: DeclaredReviewCommand) => ({
	workUnit: c.unit,
	command: c.argv,
	exitCode: c.exitCode,
	timedOut: c.timedOut
});

/** ⭐ Package N — one changed file's entry: its unit, its path, what changed, and — unless removed — its text. */
const fileEntry = (f: DeclaredReviewFile) => ({
	workUnit: f.unit,
	path: f.path,
	change: f.change,
	...(f.change === 'REMOVED' ? {} : { text: f.content ?? '' })
});

/** ⭐ Package N — one act's entry: its unit, its try, its number, and the path written or the command run with its exit. */
const actEntry = (a: DeclaredReviewAct) =>
	a.kind === 'WRITE'
		? { workUnit: a.unit, try: a.try, act: a.ordinal, wrote: a.path }
		: { workUnit: a.unit, try: a.try, act: a.ordinal, ran: a.argv, exitCode: a.exitCode, timedOut: a.timedOut };

/** How long `text` is written inside a string on a JSON line (`jsonLine`): each code point's own escape, summed. */
const encodedLength = (text: string): number => jsonLine(text).length - 2;

/** The longest code-point prefix of `text` whose length inside a string on a JSON line is at most `limit`. */
function encodedPrefix(text: string, limit: number): string {
	let used = 0;
	let end = 0;
	for (const ch of text) {
		const cost = encodedLength(ch);
		if (used + cost > limit) break;
		used += cost;
		end += ch.length;
	}
	return text.slice(0, end);
}

/** Shares of `total` by need: a need at most an equal share of what is left is met, and the rest share what remains alike. */
function fairShares(needs: readonly number[], total: number): number[] {
	const shares = needs.map(() => 0);
	let left = Math.max(0, total);
	let open = needs.map((_, i) => i);
	while (open.length > 0) {
		const each = Math.floor(left / open.length);
		const met = open.filter((i) => needs[i]! <= each);
		if (met.length === 0) {
			for (const i of open) shares[i] = each;
			break;
		}
		for (const i of met) {
			shares[i] = needs[i]!;
			left -= needs[i]!;
		}
		open = open.filter((i) => needs[i]! > each);
	}
	return shares;
}

/** The declaration of a cut that kept a unit's first `kept` commands of `total`. Host-authored, its title JSON-encoded. */
export const commandsCutDeclaration = (unit: string, kept: number, total: number, removed: number): string =>
	`[CUT FOR THIS REVIEW: the commands of ${jsonLine(unit)} — the first ${kept} of its ${total} are shown; the last ${removed} are removed.]`;

/** ⭐ Package N — D11 — the declaration of a cut that kept a unit's first `kept` acts of `total`, as its commands' cut reads. */
export const sequenceCutOfUnitDeclaration = (unit: string, kept: number, total: number, removed: number): string =>
	`[CUT FOR THIS REVIEW: the sequence of ${jsonLine(unit)} — the first ${kept} of its ${total} acts are shown; the last ${removed} are removed.]`;

/** The slice name a cut of one unit's work product declares: the work product of that unit, its title JSON-encoded. */
const productSlice = (unit: string): string => `the work product of ${jsonLine(unit)}`;

/** ⭐ Package N — D11 — the slice name a cut of one changed file's text declares: its path and its unit, JSON-encoded. */
const fileSlice = (unit: string, path: string): string => `the text of ${jsonLine(path)} of ${jsonLine(unit)}`;

/** A text the cut shares a unit's room among: a work product's answer, or a changed file's text, with its cut's slice name. */
interface CutText {
	readonly unit: string;
	readonly text: string;
	readonly slice: string;
}

/** A unit's ordered entries the cut keeps from the first while they fit: its commands, then its acts. */
interface CutList {
	readonly unit: string;
	readonly cost: number;
}

/**
 * ⭐⭐ P5 package B (F2) — THE WORK OF MANY UNITS, CUT UNIT BY UNIT to fit `limit` (the declaration lines, a line feed, then
 * the line of JSON, as a head-only cut's limit counts them): each unit is given an equal share of what is left after the
 * frame — every unit's title, with none of its work — or less where it needs less (`fairShares`), and within its share its
 * commands are kept first, in order, then its work products share the rest, each cut to its head. Each cut is declared on
 * its own line, and the line stays valid JSON in the same shape. ⚠ The declarations' room is reserved at the widest
 * numbers each could state, and recomputed until the cuts it leaves need no more. ⚠ Undefined when even the frame does
 * not fit: the validator's head-only cut then stands, as before.
 * ⭐ Package N — D11 — AND A UNIT'S FILES AND ACTS WITH THEM: the frame keeps every file's entry with its text emptied, the
 * unit's acts are kept after its commands, in order, and its files' texts share the rest with its work products, each cut
 * to its head and declared (`fileSlice`, `sequenceCutOfUnitDeclaration`).
 */
function workCutUnitByUnit(work: DeclaredWork, limit: number): { readonly content: string; readonly cut: string } | undefined {
	const units = unitsOf(work);
	const files = work.files ?? [];
	const sequence = work.sequence ?? [];
	// ⭐ The texts, in the line's order: every work product's, then every changed file's that is not removed.
	const texts: CutText[] = [
		...work.workProducts.map((w) => ({ unit: w.unit, text: w.answer, slice: productSlice(w.unit) })),
		...files.flatMap((f) => (f.change === 'REMOVED' ? [] : [{ unit: f.unit, text: f.content ?? '', slice: fileSlice(f.unit, f.path) }]))
	];
	// ⚠ A comma counted with every command and act, the first's included: an overcount of one, never an undercount.
	const commands: CutList[] = work.commands.map((c) => ({ unit: c.unit, cost: jsonLine(commandEntry(c)).length + 1 }));
	const acts: CutList[] = sequence.map((a) => ({ unit: a.unit, cost: jsonLine(actEntry(a)).length + 1 }));
	const textCost = texts.map((t) => encodedLength(t.text));
	const frame = workLine({
		workProducts: work.workProducts.map((w) => ({ unit: w.unit, answer: '' })),
		commands: [],
		...(work.files ? { files: files.map((f) => ({ ...f, content: '' })) } : {}),
		...(work.sequence ? { sequence: [] } : {})
	}).length;
	const indices = <T extends { readonly unit: string }>(xs: readonly T[], unit: string) =>
		xs.flatMap((x, i) => (x.unit === unit ? [i] : []));
	const keepWhileFits = (list: readonly CutList[], unit: string, room: { left: number }, kept: Set<number>) => {
		for (const i of indices(list, unit)) {
			if (list[i]!.cost > room.left) break;
			kept.add(i);
			room.left -= list[i]!.cost;
		}
	};
	const plan = (reserve: number) => {
		const needs = units.map(
			(u) =>
				indices(commands, u).reduce((n, i) => n + commands[i]!.cost, 0) +
				indices(acts, u).reduce((n, i) => n + acts[i]!.cost, 0) +
				indices(texts, u).reduce((n, i) => n + textCost[i]!, 0)
		);
		const shares = fairShares(needs, limit - frame - reserve);
		const keptCommands = new Set<number>();
		const keptActs = new Set<number>();
		const allowance = texts.map(() => 0);
		units.forEach((u, k) => {
			const room = { left: shares[k]! };
			keepWhileFits(commands, u, room, keptCommands);
			keepWhileFits(acts, u, room, keptActs);
			const mine = indices(texts, u);
			fairShares(
				mine.map((i) => textCost[i]!),
				room.left
			).forEach((a, j) => {
				allowance[mine[j]!] = a;
			});
		});
		return { keptCommands, keptActs, allowance };
	};
	const listCuts = (list: readonly CutList[], kept: ReadonlySet<number>, widest: boolean, declare: typeof commandsCutDeclaration) =>
		units.flatMap((u) => {
			const mine = indices(list, u);
			const shown = mine.filter((i) => kept.has(i)).length;
			if (shown === mine.length) return [];
			const total = mine.length;
			return [declare(u, widest ? total : shown, total, widest ? total : total - shown)];
		});
	const declarations = (p: ReturnType<typeof plan>, widest: boolean): string[] => [
		...texts.flatMap((t, i) => {
			if (p.allowance[i]! >= textCost[i]!) return [];
			const total = codePoints(t.text);
			const shown = widest ? total : codePoints(encodedPrefix(t.text, p.allowance[i]!));
			return [headCutDeclaration(t.slice, shown, total, widest ? total : total - shown)];
		}),
		...listCuts(commands, p.keptCommands, widest, commandsCutDeclaration),
		...listCuts(acts, p.keptActs, widest, sequenceCutOfUnitDeclaration)
	];
	let reserve = 0;
	for (let round = 0; round <= texts.length + 2 * units.length + 1; round++) {
		const p = plan(reserve);
		const needed = declarations(p, true).reduce((n, d) => n + d.length + 1, 0);
		if (needed > reserve) {
			reserve = needed;
			continue;
		}
		const cut = declarations(p, false).join('\n');
		// ⭑ Each text's kept head, by its index among `texts`: the work products first, then each file not removed.
		const shown = (i: number): string => encodedPrefix(texts[i]!.text, p.allowance[i]!);
		let next = work.workProducts.length;
		const content = workLine({
			workProducts: work.workProducts.map((w, i) => ({ unit: w.unit, answer: shown(i) })),
			commands: work.commands.filter((_, i) => p.keptCommands.has(i)),
			...(work.files ? { files: files.map((f) => (f.change === 'REMOVED' ? f : { ...f, content: shown(next++) })) } : {}),
			...(work.sequence ? { sequence: sequence.filter((_, i) => p.keptActs.has(i)) } : {})
		});
		return cut.length + 1 + content.length <= limit ? { content, cut } : undefined;
	}
	return undefined;
}

/**
 * The slice a cut of one child's skeleton declares: that child's skeleton, by its ordinal among the part's `count` children and
 * its type id, JSON-encoded. ⭐ A2 (3) — ~~its name and its id~~: the declaration is a host line, and the type id is the host's,
 * so no authored name is written outside the fence; the name stays on the child's own skeleton line.
 */
const skeletonSlice = (ordinal: number, count: number, id: string): string =>
	`the skeleton of child ${ordinal} of ${count} (type id ${jsonLine(id)})`;

/**
 * ⭐⭐ The review in parts, B1 (design D3; `REG-F-564`'s general form, "cut unit by unit, with each cut declared") — A PART OVER
 * ITS BUDGET, ITS CHILDREN'S SKELETONS CUT CHILD BY CHILD to fit `limit` (the declaration lines, a line feed, then the part, as
 * a head-only cut's limit counts them). ⭐ THE SUBJECT AND CONTEXT LINES ARE KEPT WHOLE; each child's line is given an equal
 * share of what they leave, or less where it needs less (`fairShares`, as a composite's work is shared), its HEAD kept within
 * its share and its cut declared on a line of its own in code points (`REG-F-480`, `REG-F-483`). ⛔ Never one head cut across
 * the children, which would keep the first and lose the later ones whole. ⚠ The declarations' room is reserved at the widest
 * numbers each could state, and recomputed until the cuts it leaves need no more. ⚠ Undefined when even the subject and
 * context, with a line feed for each child, do not fit: the part is then handed on whole, and the validator refuses it.
 */
function childSkeletonsCut(lines: PartLines, limit: number): { readonly content: string; readonly cut: string } | undefined {
	const kept = `${lines.subject}\n${lines.context}`;
	const frame = kept.length + lines.children.length;
	const declarations = (shares: readonly number[], widest: boolean): string[] =>
		lines.children.flatMap((c, i) => {
			if (c.line.length <= shares[i]!) return [];
			const total = codePoints(c.line);
			const shown = widest ? total : codePoints(headOf(c.line, shares[i]!));
			return [headCutDeclaration(skeletonSlice(i + 1, lines.children.length, c.id), shown, total, widest ? total : total - shown)];
		});
	let reserve = 0;
	for (let round = 0; round <= lines.children.length + 1; round++) {
		const shares = fairShares(
			lines.children.map((c) => c.line.length),
			limit - frame - reserve
		);
		const needed = declarations(shares, true).reduce((n, d) => n + d.length + 1, 0);
		if (needed > reserve) {
			reserve = needed;
			continue;
		}
		const cut = declarations(shares, false).join('\n');
		const content = [kept, ...lines.children.map((c, i) => headOf(c.line, shares[i]!))].join('\n');
		return cut.length + 1 + content.length <= limit ? { content, cut } : undefined;
	}
	return undefined;
}
