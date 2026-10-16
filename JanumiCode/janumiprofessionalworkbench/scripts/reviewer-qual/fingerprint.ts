// ⭐ `JAN-CRITREAD` J2-3 — THE REVIEWER FINGERPRINT (DESIGN-what-the-tests-prove.md §5.5; ROADMAP J2-3 + J2-4).
//
// ONE EXPORTED FUNCTION, `reviewerFingerprint`, shared by the runner (which stamps each RUN line with it, `run.ts`) and
// the check (which asks whether today's reviewer is covered, `check.ts`). It says which reviewer DEFINITION a record
// measured, at the grain of behaviour — never of text:
//   · `probes`   — the prompts the product's validator materializes for the probe set (`probes.ts`), which reaches the
//                  branches of assembly it names, the process-result arm and every oversize-together cap included — a
//                  probe the validator refuses hashed as its refusal — and, beside them, the fence skeleton's digest
//                  and the token the product's chooser takes over each witness of the reader corpus, and (⭐ P7-6 I4)
//                  the no-tools preamble devin's transport writes before every prompt (`TRANSPORT_PREAMBLE`);
//   · `budget`   — the excerpt budget constants themselves (`REASONING_REVIEW_BUDGET`), since `CONTENT_MAX` is a cap no
//                  probe can reach;
//   · `criteria` — the seed criteria as whole objects, every field, the ones no prompt or score reads included — and,
//                  since `JAN-CRITREAD` J2-3, the seeded Reasoning Review policy's `independence`, which the product's
//                  recording gate reads (`rph-application` `assurance.ts`, the §39 inv-8 check) though no score does;
//   · `scoring`  — the scoring digest: the corpus of raw replies (`scoring-corpus.ts`) through the runner's own
//                  `evaluateCase` — the real validator at its print seam, then the Reasoning Review reference alone —
//                  hashed as outcomes only, with the repair instruction a failed first parse draws, and the
//                  malformation classes the harness detects in each reply (a class lost is `MALFORMATION_GAINED`'s
//                  measure moving, §5.1).
// Beside it, not in it: the CASE-SET digest (over each case's inputs, never its oracle, §5.5) and each case's prompt
// hashes, which the check compares with what a run recorded (§5.6 limbs 1 and 2).
//
// ⛔ NOTHING HERE READS A SOURCE FILE. A comment moves no fingerprint, and a whole-file hash would move it on every
// comment — `verif/reviewer-qualification-fingerprint.test.ts` measures that on a disposable copy of the tree.
// ⚠ OUT OF SCOPE, AS §5.5 STATES: the model (a change of model moves nothing), the transports' bounds and argv (in each
// RUN's candidate identity instead), and a durable deployment seeded before a criteria change. ⭐ But not what a
// transport WRITES INTO the prompt (P7-6 I4; `REG-D-104` (2)): devin's no-tools preamble is text the reviewer reads, so it
// is hashed (`TRANSPORT_PREAMBLE`, which says what that does and does not reach).
// ~~⚠ AND `renderProcessResult` (`REG-D-072` D17): the process-result arm's content is literal in its probes, so a change
// to how a production process result is rendered into `content` moves no fingerprint.~~
// ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D3; `REG-F-476`, `REG-D-094`) — STRUCK: THE FINGERPRINT REACHES THE RENDERER. The P- probes
// are run literals built by the product's `processResultReviewInput` — reached through the `processResult` seam below,
// whose default IS that function — so a change to what the reviewer of a process result reads moves `probes` WHERE A
// PROBE TAKES IT: a change to a branch the fingerprint test's per-branch rows name moves the probes that take it, and so
// does a change to what either fence chooser reads — a candidate is planted, below the token that chooser takes, in
// every untrusted slice either chooser reads in every framing that carries it, but a call name the host did not mint,
// which no name production carries can hold (`probes.ts`), so a chooser that ~~reads LESS than the prompt carries~~
// skips any one of those slices, in every framing or in one alone, chooses another; and in each field of the account, a
// candidate split by each line terminator a reader may not break at, a candidate on a line of each layout the reader
// states, the field's last three lines (under an override, inside an embedding, inside an isolate: `probes.ts`
// `LAID_OUT_LINES`), and each chooser's token where only that field read otherwise holds it (split by a line feed,
// written backwards below a line a bidi control lays out, astride two items: `probes.ts` `BREAKS_ACCOUNT`), so a
// chooser that reads a field OTHERWISE than the prompt carries it — a list as one line of JSON, a terminator as a line
// feed, its line feeds read away, its items joined, its bidi controls read away (or any one family of them), its last
// line read away — chooses another too, in every framing or in one alone; and each chooser's token stands where a cut
// a probe takes removes it
// — in every cut but those that stand on a cut's own arithmetic, which `probes.ts` names — astride two slices, astride
// a cut's two parts, split by a line feed and laid out on a line with no bidi control, so a chooser that reads MORE in
// any of those ways chooses another too — to any break `jsonLine` escapes at any of its call sites, to the capture
// line's count, to a head-only cut's two edges, to a cut layout's widest declaration, to the account's host lines and
// the way each list is written, an item holding a line feed among them (design §9.3 D7), to the stakes beside each
// criterion and the recommendation's glosses
// (design §9.3 D8), or to the edge of a refusal — each held by a row of that test (`REG-F-481`). ⛔ "A CHOOSER THAT
// READS LESS THAN THE PROMPT CARRIES, IN EVERY FRAMING OR IN ONE ALONE, CHOOSES ANOTHER" WAS FALSE FOR THE LAYOUT (design
// §9.3 D7): no line of a field that a control laid out held a candidate, so a chooser that read a field with its bidi
// controls read away, in a graph's or a work product's review alone, moved no probe (driven). ⚠ AND NOT EVERY WAY OF
// READING A FIELD OTHERWISE MOVES ONE (`probes.ts` names them): its lookalikes read as themselves alone in a graph's or
// a work product's review, a bidi control no line of it holds or one of a line's opener and pop while the other stays,
// and a line of it that holds no candidate as the prompt carries it, read away, move nothing. ⭐ AND THE SKELETON'S
// TABLE IS HASHED WHOLE, AS IT READS (`REG-F-481`; design §5.5
// hashes the budget so): its digest over every code point (`fenceSkeletonDigest` — every code point's readings, in a
// line read in order and in one laid out reversed, and whether a line holding it is laid out) is hashed beside the
// probes, so a change to how a CODE POINT is read that no plant reaches moves `probes` too. ⭐ AND THE READER ITS CHOOSER
// MODELS IS HASHED AS IT READS A SLICE (`FENCE_READER`): the token the product's chooser takes over each witness of the
// reader corpus (`probes.ts` `READER_CORPUS` — every reader plant, a witness of each side of each rule
// `review-fence.ts` states, and one of each layout it names as not modelled) is hashed beside them, so a change to how
// a SLICE is read that changes a witness's token moves `probes` too — the corpus takes each rule at the points its
// witnesses stand, so a change confined to other inputs of a rule, or to two rules read together as no witness puts
// them, moves nothing.
// ⭐ AND A REFUSAL IS HASHED, NEVER THROWN (`probePrompt`), and one stands in EVERY framing and at the LAST candidate: an
// edit that sends what is refused today in any framing, or refuses what is sent — a chooser that tries any number of
// candidates short of a hundred — moves `probes`. ⚠ Not every change: what no probe, no code point's reading and no
// witness reaches is said in `probes.ts` — inputs this host cannot be handed (NOT TAKEN), an over-read no plant stands
// for (the safe direction: a cut that removes no plant among them), a field read otherwise where no plant of it stands
// (above; design §9.3 D7), and a change to the reader that changes no
// witness's token and no plant's. Driven red before
// `PQ-1`'s probes: a real edit to each branch, on a disposable copy, moved no probe. ~~⚠ It moves no CASE prompt while no
// case is a process result (case set v3); the cases that carry run literals are `PQ-2`'s (design D4).~~ ⭐ `JAN-PRQUAL`
// `PQ-2` (design D4): case set v4's process-result cases carry run literals, built through the SAME seam
// (`casePromptsOf`), so a renderer change moves their case prompts too — and the case-set digest and coverage owe a RUN.
import { readFileSync } from 'node:fs';
import {
	FLOOR_POLICY_DEFINITIONS,
	FLOOR_POLICY_IDS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type IndependenceRequirement,
	type ReasoningReviewInput,
	type Validator
} from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import {
	createAgyReasoningReviewValidator,
	REASONING_REVIEW_BUDGET,
	type AgyPrint
} from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { chooseFence } from '../../apps/rph-demo/src/lib/server/assurance/review-fence.js';
import { processResultReviewInput } from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';
// ⭐ P7-6 I4 — the preamble devin's transport writes before every prompt. ⚠ This loads `devin-reviewer.ts`, which reads
// `JPWB_DEVIN_BIN` at module load (`REG-D-072` D12), as the validator's chain already loads `agy-cli.ts`, which reads
// `JPWB_AGY_BIN` so: the runner computes the fingerprint only past its D12 refusal (`run.ts`), so the order holds for both.
import { DEVIN_REVIEWER_PREAMBLE } from '../../apps/rph-demo/src/lib/server/tools/devin-reviewer.js';
import { fenceSkeletonDigest } from '../fence-skeleton/digest.js';
import { CURRENT_CASE_SET_FILE, type CaseSet, type QualificationCase } from './cases.js';
import { canonicalJson, reviewerFingerprintOf, sha256, type FingerprintComponents } from './digest.js';
import { caseReviewInput } from './materialize.js';
import {
	CATALOG_DECLARED_POLICIES,
	FINGERPRINT_PROBES,
	PROBE_SUBJECT,
	READER_CORPUS,
	type DeclaredProbePolicy,
	type ProcessResultBuilder
} from './probes.js';
import type { CandidateIdentity } from './record.js';
import { evaluateCase } from './runner.js';
import { CORPUS_CASE, scoringCorpus } from './scoring-corpus.js';

/** A case's ~~two~~ prompts, as sha256 — the hashes its CALL lines carry for the initial call and ~~the repair~~ each repair. */
export interface CasePrompts {
	readonly initial: string;
	readonly repair: string;
	/**
	 * ⭐ P7-6 I5 (`DESIGN-the-reviewer-isolated.md` §4d; `REG-F-552`) — the repair of a reply that PARSED and answered no
	 * criterion, which the validator sends with a prompt of its own (`CRITERION_REPAIR_INSTRUCTION`), and a run records
	 * as `criterion-repair` (`runner.ts` `callRole`; `record.ts` `CALL_ROLES`).
	 */
	readonly 'criterion-repair': string;
}
export interface ReviewerFingerprint {
	/** The reviewer fingerprint — a RUN line's `reviewerFingerprint`. */
	readonly reviewer: string;
	/** The scoring digest — a RUN line's `scoringDigest`, and `components.scoring`. */
	readonly scoring: string;
	/** The case-set digest — a RUN line's `caseSetDigest`. */
	readonly caseSet: string;
	readonly components: FingerprintComponents;
	/** Each case's prompt hashes, by case id. */
	readonly casePrompts: ReadonlyMap<string, CasePrompts>;
	/**
	 * Each probe's materialized prompt — or, for a probe the validator refuses, its refusal (`probePrompt`) — by probe id,
	 * kept whole so a test can say what it reaches. ⚠ The probes alone: the skeleton's digest and the reader corpus's
	 * tokens, hashed beside them, are not among them.
	 */
	readonly probePrompts: ReadonlyMap<string, string>;
}

/**
 * ⭐ WHAT THE FINGERPRINT MEASURES, as seams — the product's own in `PRODUCT_SEAMS`. A test swaps ONE to show the
 * fingerprint moves with it; nothing else ever passes anything but the product's.
 */
export interface FingerprintSeams {
	/**
	 * The product's validator, its print seam handed in — how the probe prompts AND the case prompts are materialized
	 * (`casePromptsOf`), so a change at this seam that reaches a case prompt is seen to reach it.
	 */
	readonly validator: (print: AgyPrint) => Validator;
	/** The runner's evaluation — how the corpus is scored, and the repair instruction a failed first parse draws. */
	readonly evaluate: typeof evaluateCase;
	readonly budget: Readonly<Record<string, number>>;
	readonly criteria: readonly AssessmentCriterion[];
	/** The seeded Reasoning Review policy's independence requirement — what the recording gate holds a reviewer to. */
	readonly independence: IndependenceRequirement;
	/**
	 * ⭐ `JAN-PRQUAL` `PQ-1` (design D3) — the builder every process-result probe is built through: the product's
	 * `processResultReviewInput`, which renders the run's REVIEW view within the content budget the validator computes.
	 * A test swaps it to show a renderer change moves `probes` — and that a change confined to one branch of the renderer
	 * moves the probes that take it — ~~and no case prompt (v3 has no process-result case; see `casePromptsOf`)~~ and, since
	 * `PQ-2` (design D4), the prompts of the process-result cases, built through this seam too (`casePromptsOf`).
	 */
	readonly processResult: ProcessResultBuilder;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7 P7-6 I4 (`DESIGN-the-reviewer-isolated.md` §4b; `REG-D-104` (2)) — the no-tools preamble the
	 * product's `devinPrint` writes before every prompt it sends (`DEVIN_REVIEWER_PREAMBLE`). Hashed beside the probes
	 * (`TRANSPORT_PREAMBLE`, below). A test swaps it to show one character of it moves `probes`.
	 */
	readonly devinPreamble: string;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B4; `REG-F-553`'s class) — THE CATALOG'S DECLARED
	 * POLICIES, every field a declared review reads or its sign-off demands (`probes.ts` `CATALOG_DECLARED_POLICIES`): hashed
	 * whole in the `criteria` component — the declared framing's CRITERIA LIMB — and handed to the declared probes, so a
	 * change to a policy's purpose, a criterion, or the independence its sign-off checks moves the fingerprint. ⛔ Without it a
	 * declared review's rubric could change under a reviewer nobody re-measured.
	 */
	readonly declaredPolicies: readonly DeclaredProbePolicy[];
}

/** Who the fingerprint's validator says it is: an identity no producer carries, so independence never decides a probe. */
const FINGERPRINT_EVALUATOR = {
	agentId: 'jpwb-fingerprint',
	modelId: 'jpwb-fingerprint-reviewer',
	providerId: 'jpwb-fingerprint'
} as const;
const FINGERPRINT_CANDIDATE: CandidateIdentity = {
	transport: 'stub',
	agentId: FINGERPRINT_EVALUATOR.agentId,
	provider: FINGERPRINT_EVALUATOR.providerId,
	modelLabel: FINGERPRINT_EVALUATOR.modelId,
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};
/** The exchange clock the validator stamps with — its stamps reach no prompt and no outcome. */
const FIXED_CLOCK = () => '1970-01-01T00:00:00.000Z';
/** Stamped into an evaluation's outcome by `evaluateCase`, and removed before anything is hashed. */
const NO_DIGEST = '0'.repeat(64);

/** The seeded Reasoning Review policy's own requirement — `floor-policies.ts`, whence the seed writes it. */
const SEEDED_INDEPENDENCE: IndependenceRequirement = (() => {
	const policy = FLOOR_POLICY_DEFINITIONS.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!policy) throw new Error('the seeded floor policies hold no Reasoning Review policy');
	return policy.independence;
})();

export const PRODUCT_SEAMS: FingerprintSeams = {
	// ⛔ Built WITHOUT `requireReportedModel`, as the runner's is (`JAN-SELREV` D6): only the product's devin branch sets it.
	validator: (print) =>
		createAgyReasoningReviewValidator({ ...FINGERPRINT_EVALUATOR, clock: FIXED_CLOCK, print }),
	evaluate: evaluateCase,
	budget: REASONING_REVIEW_BUDGET,
	criteria: SEEDED_REASONING_REVIEW_CRITERIA,
	independence: SEEDED_INDEPENDENCE,
	// ⭐ P7-6 I4 — THE PRODUCT'S OWN CONSTANT, the one `devinPrint` writes: never a copy of its text.
	devinPreamble: DEVIN_REVIEWER_PREAMBLE,
	// ⭐ E2 — THE CATALOG'S DECLARED POLICIES AS THE PRODUCT SEEDS THEM (`probes.ts`), never a copy of their text.
	declaredPolicies: CATALOG_DECLARED_POLICIES,
	// ⛔ THE PRODUCT'S BUILDER ITSELF — the same function `runProcessResultFloor` builds through, never a copy or a wrapper
	// of it (`verif/reviewer-qualification-fingerprint.test.ts` holds the identity). That is why the production fingerprint
	// cannot hash a process result other than as the product sends it: the floor's input IS this function's output for
	// the floor's source (`review-input.test.ts`'s third block, input and prompt, byte for byte), the probes reach the
	// renderer only through this seam (`probes.ts` imports the builder's type, never the function), and the check and the
	// runner compute the fingerprint with these seams (`reviewerFingerprint`'s default) — only a test passes another.
	processResult: processResultReviewInput
};

/** A judgement answering every criterion clean — what the second call of a prompt capture returns. */
const cleanJudgement = (criteria: readonly AssessmentCriterion[]): string =>
	JSON.stringify({
		findings: criteria.map((k) => ({ criterionId: k.id, failed: false, statement: 'absent' })),
		recommendation: 'SATISFIED'
	});
/** A first reply no parse accepts, so the validator sends its repair prompt too. */
const UNUSABLE = 'not a judgement';
/** ⭐ P7-6 I5 — a first reply that PARSES and answers no criterion (`REG-F-552`'s shape), so the validator sends its
 *  criterion repair. */
const ANSWERS_NO_CRITERION = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}';

/** How a refusal is hashed: this line, the statement the validator refused with, then the content it was handed. */
const REFUSED = 'REFUSED — the validator sent no prompt:';

/**
 * The first prompt the validator materializes for `input` — or, when it refuses before any prompt exists, its REFUSAL.
 *
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-476`; `REG-F-480`, `REG-F-481`) — A REFUSAL IS HASHED AS A PROMPT IS. ⛔ It was thrown, so a
 * probe standing where the validator refuses — a view holding every fence candidate (`NO_FENCE_STATEMENT`), a view over
 * its budget — made the fingerprint throw, and none stood there: an edit that SENT what is refused today (a chooser that
 * never fails closed, a refusal edge moved by one unit) moved no fingerprint. Now the refusal is the text hashed — `REFUSED`,
 * the statement it threw, and the content it was handed (a process result's view, which says what was refused) — never
 * a prompt's text, so an edit that turns a refusal into a prompt, or a prompt into a refusal, moves `probes`.
 * ⚠ ONLY BEFORE ANY PROMPT IS SENT: a throw after one is not a refusal of the review, and it is thrown. And which probes
 * are refused is itself pinned (`verif/reviewer-qualification-fingerprint.test.ts`): `G-NO-FENCE`, `W-NO-FENCE` and
 * `P-NO-FENCE`, one in each framing — so a validator that fails closed in one framing alone moves `probes`.
 */
async function probePrompt(
	seams: FingerprintSeams,
	subject: AssuranceSubject,
	input: ReasoningReviewInput
): Promise<string> {
	const sent: string[] = [];
	const validator = seams.validator(async (p) => {
		sent.push(p);
		return cleanJudgement(input.criteria);
	});
	try {
		await validator.evaluate(subject, { reasoningReview: input });
	} catch (refusal) {
		if (sent.length > 0) throw refusal;
		return [REFUSED, refusal instanceof Error ? refusal.message : String(refusal), input.content].join('\n');
	}
	if (sent.length === 0) throw new Error('the validator materialized no prompt');
	return sent[0]!;
}

/**
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design §5.5) — THE FENCE SKELETON, HASHED AS IT READS. Its digest over every code
 * point (`scripts/fence-skeleton/digest.ts`, the value `verif/fence-skeleton-determinism.test.ts` pins) is hashed beside
 * the probes, under this id, as §5.5 hashes the budget: the table is the one input of prompt assembly whose every entry
 * no probe can plant, and a change to an entry no plant reaches — a lookalike read no more, a reading changed — decides
 * the fence for an input that holds it, and moved no fingerprint. ⚠ In `probes`, so `FingerprintComponents` and the RUN
 * line keep their shape. Computed once a load: a sweep of every code point, about a second.
 */
const FENCE_SKELETON = 'FENCE-SKELETON';
let skeletonDigest: string | undefined;

/**
 * ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design §5.5) — THE READER, HASHED AS IT READS A SLICE. The skeleton's digest hashes
 * every code point's readings and flags, never how a slice applies them — position by position, per line, every line
 * that holds a control, its two laid-out readings (`review-fence.ts` `readSlice`) — and a plant stands at one point of
 * each such rule: ⛔ a reader changed where no plant stood moved no fingerprint (driven on a disposable copy: a line
 * laid out under the override alone, the first such line alone, a laid-out line broken at every terminator, no
 * candidate begun inside a reading). So each witness of the reader corpus (`probes.ts` `READER_CORPUS`) is handed to the
 * product's chooser, and the slices with the token it takes — `null` where it fails closed — are hashed beside the
 * probes, under this id: a change to how a slice is read that changes any witness's token moves `probes`.
 * ⚠ In `probes`, as the skeleton's digest is, so `FingerprintComponents` and the RUN line keep their shape. The
 * chooser's own token over each witness, never the token the corpus states: the fingerprint test holds the two equal.
 */
const FENCE_READER = 'FENCE-READER';
const readerTokens = (): string => JSON.stringify(READER_CORPUS.map((w) => [w.slices, chooseFence(w.slices) ?? null]));

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 P7-6 I4 (`DESIGN-the-reviewer-isolated.md` §4b; `REG-D-104` (2)) — WHAT A TRANSPORT ADDS TO THE
 * PROMPT, HASHED AS THE PROBES ARE. The product's `devinPrint` writes a no-tools preamble before every prompt it sends
 * (`DEVIN_REVIEWER_PREAMBLE`), and qualification calls that same `devinPrint` (`transports.ts`), so a re-qualification
 * measures it. ⛔ But everything above hashes the VALIDATOR's prompts, which the preamble never reaches: left out, a
 * change to what the selected reviewer reads moved nothing, and `reviewer:qual:check` stayed GREEN on the qualification
 * made without it (driven 2026-10-10: GREEN at fingerprint `ed39d6cc…`, the preamble already in `devinPrint`). So its
 * text is hashed beside the probes, under this id, as the skeleton's digest and the reader's tokens are — in `probes`,
 * so `FingerprintComponents` and the RUN line keep their shape; one character of it moves `probes`
 * (`verif/reviewer-qualification-fingerprint.test.ts`, on a disposable copy and at the seam).
 * ⚠ FOR EVERY CANDIDATE, AND THAT IS STATED RATHER THAN HIDDEN. The fingerprint is the TREE's — the check computes one and
 * holds every RUN line to it, whichever transport the run used (`check-core.ts`) — so the preamble moves agy's and
 * ollama's fingerprints too, though neither transport sends it: their prompts are the validator's alone, unchanged by
 * it. That over-reach is the safe direction — it can only ask for a measurement a candidate did not need, never accept
 * one that is stale — and it asks for none today: the SELECTION in force names devin (`REG-D-084`), and the any-candidate
 * coverage limb is answered by the selected candidate's runs.
 * ⛔ WHAT IT DOES NOT REACH: the CASE prompts. A run records the hash of the prompt the validator hands its transport
 * (`runner.ts`), BEFORE `devinPrint` prepends — so a change to the preamble ALONE moves no case prompt, and the check
 * would read it as a move "outside every case prompt": owing an ACKNOWLEDGED line, and admitting RESCORED re-stamps of
 * devin's runs where a paid run is what such a change owes. Not closed here: closing it is per-transport case-prompt
 * hashes, a change to what a CALL line's `promptSha256` means. ⭑ In P7-6 it does not bite: I6's sentence moves every
 * case prompt in the same landing, so a RUN of the selected candidate is owed regardless.
 */
const TRANSPORT_PREAMBLE = 'DEVIN-PREAMBLE';

/**
 * Each case's initial and repair prompt hashes, exactly as the runner records them (`CallLine.promptSha256`) — the
 * fingerprint test holds the two equal over a run ('the case prompts are the hashes a run records').
 *
 * ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-476`) — MEASURED THROUGH THE SEAMS, AS THE PROBE PROMPTS ARE: the case's input through
 * the reviewer-side assembly (`materialize.ts`), then the seams' validator at its print seam, an unusable first reply
 * drawing the repair. ⛔ They were read off the runner's own evaluation (`seams.evaluate`), which builds a validator of
 * its own — so a row that swapped the validator seam and said "no case prompt moves" asked a question that could only
 * be answered yes: a seam change every prompt carries left every case prompt where it was. Now such a change moves
 * them, and the fingerprint test holds that as the limb's control.
 * ~~⚠ `PQ-2` (design D4) MUST CARRY THIS FORWARD: a process-result case is built through the BUILDER, so `materialize.ts`
 * must then take the seams' `processResult` — else a renderer change that does reach a case prompt is measured as one
 * that does not.~~ ⭐ CARRIED FORWARD by `PQ-2` (design D4): a process-result case is built through the seams'
 * `processResult` (`materialize.ts` takes it), so a renderer change that reaches a case prompt is measured as one that does.
 */
async function casePromptsOf(
	seams: FingerprintSeams,
	cases: readonly QualificationCase[]
): Promise<Map<string, CasePrompts>> {
	const out = new Map<string, CasePrompts>();
	/** The prompts the seams' validator sends for `c` when its first reply is `first` and its second answers clean. */
	const capture = async (c: QualificationCase, first: string): Promise<string[]> => {
		const sent: string[] = [];
		const validator = seams.validator(async (p) => {
			sent.push(p);
			return sent.length === 1 ? first : cleanJudgement(seams.criteria);
		});
		await validator.evaluate(c.subject, { reasoningReview: caseReviewInput(c, seams.criteria, seams.processResult) });
		return sent;
	};
	for (const c of cases) {
		const sent = await capture(c, UNUSABLE);
		const [initial, repair] = sent;
		if (sent.length !== 2 || initial === undefined || repair === undefined)
			throw new Error(`${c.id}: the capture drew ${sent.length} prompt(s), not an initial and a repair`);
		// ⭐ P7-6 I5 — and the criterion repair, drawn by a first reply that parses and answers no criterion.
		const criterion = await capture(c, ANSWERS_NO_CRITERION);
		const criterionRepair = criterion[1];
		if (criterion.length !== 2 || criterionRepair === undefined)
			throw new Error(`${c.id}: the capture drew ${criterion.length} prompt(s), not an initial and a criterion repair`);
		out.set(c.id, { initial: sha256(initial), repair: sha256(repair), 'criterion-repair': sha256(criterionRepair) });
	}
	return out;
}

/**
 * ⭐ THE SCORING DIGEST — each corpus entry's outcome as the runner scores it (the disposition, the result class,
 * independence, each criterion's outcome), how many calls it drew and the malformation classes the harness detected in
 * each reply, never a statement or a clock; and the REPAIR INSTRUCTION every repaired entry drew, as the text appended
 * to its first prompt — so a change to the corpus case's own prompt moves no scoring digest, and a change to the
 * instruction does. ⚠ The classes are here because no record can re-detect them: a line keeps only their names, never
 * the reply they were read from (§5.3), so a detection change is visible only as a fingerprint move.
 */
async function scoringDigestOf(seams: FingerprintSeams): Promise<string> {
	const outcomes: unknown[] = [];
	const repairs: unknown[] = [];
	for (const entry of scoringCorpus(seams.criteria)) {
		const sent: string[] = [];
		let n = 0;
		const e = await seams.evaluate({
			case: CORPUS_CASE,
			criteria: seams.criteria,
			candidate: FINGERPRINT_CANDIDATE,
			scoringDigest: NO_DIGEST,
			call: async (p) => {
				sent.push(p);
				return { returned: entry.replies[Math.min(n++, entry.replies.length - 1)]!, served: null };
			}
		});
		const { scoringDigest: _stamp, ...scored } = e.scored;
		outcomes.push([entry.id, scored, e.calls.length, e.calls.map((c) => c.malformations)]);
		const [first, repair] = sent;
		if (first !== undefined && repair !== undefined)
			repairs.push([
				entry.id,
				repair.startsWith(first) ? { appended: repair.slice(first.length) } : { prompt: sha256(repair) }
			]);
	}
	return sha256(JSON.stringify({ outcomes, repairs }));
}

/** The case-set digest: each case's inputs as the reviewer-side assembly receives them — never its oracle, nor a note. */
export function caseSetDigest(cases: readonly QualificationCase[]): string {
	return sha256(
		JSON.stringify(cases.map((c) => ({ id: c.id, arm: c.arm, subject: c.subject, input: c.input })))
	);
}

/**
 * ⭐⭐ THE REVIEWER FINGERPRINT of today's reviewer, over `cases` — the one function the runner and the check share.
 * `seams` is the product's own everywhere but in the tests that show each component moves it.
 */
export async function reviewerFingerprint(
	cases: readonly QualificationCase[],
	seams: FingerprintSeams = PRODUCT_SEAMS
): Promise<ReviewerFingerprint> {
	const prompts = new Map<string, string>();
	for (const probe of FINGERPRINT_PROBES)
		prompts.set(
			probe.id,
			await probePrompt(seams, PROBE_SUBJECT, probe.input(seams.criteria, seams.processResult, seams.declaredPolicies))
		);
	if (prompts.has(FENCE_SKELETON)) throw new Error(`a probe is named ${FENCE_SKELETON}, which is the skeleton's entry`);
	if (prompts.has(FENCE_READER)) throw new Error(`a probe is named ${FENCE_READER}, which is the reader corpus's entry`);
	if (prompts.has(TRANSPORT_PREAMBLE))
		throw new Error(`a probe is named ${TRANSPORT_PREAMBLE}, which is the devin preamble's entry`);
	/** What `probes` hashes, in order: each probe's prompt (or refusal), and then — as ~~two~~ three more entries — the
	 *  skeleton's digest, the reader corpus's tokens and (⭐ P7-6 I4) the preamble devin's transport writes. */
	const probePrompts = new Map([...prompts, [FENCE_SKELETON, (skeletonDigest ??= fenceSkeletonDigest())]]);
	probePrompts.set(FENCE_READER, readerTokens());
	probePrompts.set(TRANSPORT_PREAMBLE, seams.devinPreamble);
	const floorComponents: FingerprintComponents = {
		probes: sha256(JSON.stringify([...probePrompts].map(([id, p]) => [id, sha256(p)]))),
		budget: sha256(canonicalJson(seams.budget)),
		criteria: sha256(canonicalJson({ criteria: seams.criteria, independence: seams.independence })),
		scoring: await scoringDigestOf(seams)
	};
	// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B4) — THE DECLARED FRAMING'S CRITERIA LIMB, folded into the criteria
	// component: the catalog's declared policies whole, beside the floor's rubric and its independence, hashed above as
	// before. ⛔ Without it a declared policy's criterion, or the independence its sign-off checks, moved no component.
	const components: FingerprintComponents = {
		...floorComponents,
		criteria: sha256(canonicalJson({ floor: floorComponents.criteria, declared: seams.declaredPolicies }))
	};
	return {
		reviewer: reviewerFingerprintOf(components),
		scoring: components.scoring,
		caseSet: caseSetDigest(cases),
		components,
		casePrompts: await casePromptsOf(seams, cases),
		probePrompts: prompts
	};
}

/** The committed CURRENT case set (`cases.ts`), read from the tree `root` names (a `file:` URL ending in `/`). */
export function committedCaseSet(root: URL): CaseSet {
	return JSON.parse(readFileSync(new URL(CURRENT_CASE_SET_FILE, root), 'utf8')) as CaseSet;
}

// `bun --conditions=source scripts/reviewer-qual/fingerprint.ts` — today's fingerprint of this tree, as JSON on stdout.
if (import.meta.main) {
	const f = await reviewerFingerprint(committedCaseSet(new URL('../../', import.meta.url)).cases);
	process.stdout.write(
		`${JSON.stringify({ reviewer: f.reviewer, scoring: f.scoring, caseSet: f.caseSet, components: f.components })}\n`
	);
}
