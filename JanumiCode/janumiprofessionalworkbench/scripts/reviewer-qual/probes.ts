// ⭐ `JAN-CRITREAD` J2-3 — THE FINGERPRINT PROBE SET (DESIGN-what-the-tests-prove.md §5.5).
//
// The reviewer fingerprint must move when anything that decides a verdict moves — including a branch of prompt
// assembly that no qualification case exercises. So it hashes the prompts of THESE inputs — or, for one the validator
// refuses, the refusal — chosen to reach every branch a prompt can take (what none can, and why, is said below), and
// separate from the cases (which are data the sponsor confers; §5.2):
//   · each framing — ~~the graph~~ ⭐ the part (B7: the graph framing's probes left the fingerprint with case set v8, which
//     holds no graph case), the work product, and the process result with each observation kind and its absent
//     report (the process-result arm has no case in version one, `REG-D-072` D17);
//   · the rationale absent (the "NOT DECLARED" instruction fifteen of sixteen lane prompts carried) and present, with an
//     empty list inside it; narration present and absent; prior gaps present; a candidate subject hash;
//   · and, per framing, one probe with ONLY the content oversize and one with EVERY slice oversize at once. The content
//     budget is capped by three terms (`CONTENT_MIN`, `CONTENT_MAX`, the budget left after the scaffolding), and a
//     probe that is oversize in one input reaches only one of them.
// ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D3; `REG-F-476`, `REG-D-094`) — AND THE PROCESS-RESULT ARM IS BUILT THROUGH THE PRODUCT'S
// BUILDER, OVER FIXED RUN LITERALS. Its probes carried a literal `content` — not even the renderer's format — because no
// builder was factored for that arm (`REG-D-072` D17): a change to what the reviewer of a process result reads moved no
// fingerprint (driven red before `PQ-1`'s probes: a real edit to each renderer branch, on a disposable copy, moved no
// probe, and two literal probes no longer materialized at all). Now each P- probe is a RUN, with the port's stream names
// (`REG-F-487`), handed to `processResultReviewInput` — the builder `runProcessResultFloor` builds through, reached
// through the fingerprint's `processResult` seam (`fingerprint.ts`). WHAT THE PROBES ARE CHOSEN TO TAKE, each held to the
// probes that take it by a named row of `verif/reviewer-qualification-fingerprint.test.ts`:
//   · each branch of the renderer its per-branch rows name (`BRANCH_CHANGES`): the exit line's four shapes, the capture's
//     facts and its declaration of a cut stream, a review cut of either stream and of both at once, the long command
//     line, and the two edges of a slice's room;
//   · ⭐ WHAT EACH FENCE CHOOSER READS, AND HOW IT READS IT (`REG-F-481`; design D2 under the sponsor's answer (a)): a
//     candidate planted in every untrusted slice either chooser reads, in every framing that carries it, below the
//     token that chooser takes there — each link of a chain, so a chooser that stops reading any one slice, in every
//     framing or in one alone, chooses another token. THE VIEW'S CHOOSER (a process result's): `P-OVERSIZE-FENCES` in
//     each slice production's prompt for a process result carries (the instruction, the account's rationale,
//     assumptions and residual uncertainty, argv, stdout's HEAD and TAIL, stderr), each spelled through its own family
//     of the skeleton's generated table or its own rule of the reader the chooser models, and `P-FENCES-OTHER-SLICES`
//     in the three it leaves empty (the limitations, which production sends, and the narration and the prior findings,
//     which it never does). THE VALIDATOR'S: ~~`G-OVERSIZE-FENCES` in each of a graph's slices~~ `T-OVERSIZE-FENCES` in
//     each of a part's slices (the request, a type's name in the part, each field of the account — the limitations cut —
//     the narration, the prior findings); `W-FENCES` in each of
//     a work product's (the instruction, the answer, each field of the account, the prior findings);
//     `P-OVERSIZE-FENCES` in each of a process result's it fills (the instruction, the account's fields but the empty
//     limitations, and the view, read whole), and `P-OVERSIZE-ALL` and `P-FENCES-OTHER-SLICES` in the other three (the
//     limitations, the narration, the prior findings); and ~~`G-OVERSIZE-CONTENT` and~~ `W-OVERSIZE-CONTENT` in the kept
//     HEAD of a content the budget cuts (a part's content is never cut by the validator). ⭐ P5 package D (`REG-D-118`
//     (1)) — and, in a declared review, the slices its host
//     lines carry: `D-ROOT-UNITS-WITHOUT-WORK` in a title on the line naming a unit below that holds no completion, and
//     `D-OVERSIZE-UNIT-TITLE` in the builder's cut declarations; and `D-OVERSIZE-UNITS` in the kept HEAD of a work
//     product its builder cut. No probe plants in a call name the host did not mint, which no name production
//     carries can hold (NOT TAKEN, below). Every token is pinned. ⭐ AND HOW EACH FIELD OF THE ACCOUNT IS READ (design
//     §9.3 D7): in each field, in every framing, a candidate split by each line terminator a reader may not break at,
//     ⭐ a candidate on a line of each layout the reader states — under an override, inside an embedding, inside an
//     isolate (`LAID_OUT_LINES`), the field's last three lines — and each chooser's own token where only the field read
//     otherwise holds it — split by a line feed (in a list, an item holding one), written backwards below a line a bidi
//     control lays out, and astride two items (`BREAKS_ACCOUNT`; `T-ACCOUNT-BREAKS`, `W-ACCOUNT-BREAKS`,
//     `P-ACCOUNT-BREAKS`) — so a chooser that reads a field otherwise than the prompt carries it (a list as one line of
//     JSON, a terminator as a line feed, its line feeds read away, a list's items joined, ⭐ its bidi controls read away,
//     or any one family of them, or its last line read away), in every framing or in one alone, chooses another token.
//     ⛔ The one line of a field a control laid out held no candidate, so a chooser that read a field with its bidi
//     controls read away, in a graph's or a work product's review alone, moved no probe (driven). ⚠ NOT EVERY WAY OF
//     READING A FIELD OTHERWISE: a field's lookalikes read as themselves alone, in a graph's or a work product's review
//     (no probe of either spells a candidate of the account with one: `P-OVERSIZE-FENCES` spells three, in a process
//     result's); a bidi control no line of a field holds (U+202A, U+202D, U+2066, U+2068), or one of a line's opener and
//     pop read away while the other stays (the line is laid out still); and a line that holds no candidate as the
//     prompt carries it, read away — each moves nothing. ⭐ AND WHAT NO CHOOSER MAY READ: the token a chooser
//     takes, planted where it must not read it — in the bytes a cut removes: the instruction's tail
//     (`OVERSIZE_INTENT`); the end of ~~a graph's content,~~ a work product's, the rationale, the narration and the prior
//     findings (~~`OVERSIZE_NODES`,~~ `OVERSIZE_ANSWER`, `OVERSIZE_RATIONALE`, `OVERSIZE_NARRATION`, `OVERSIZE_GAPS`); the
//     end of the limitations `T-OVERSIZE-FENCES` cuts, and of each list `T-OVERSIZE-LISTS`, `W-OVERSIZE-LISTS` and
//     `P-OVERSIZE-LISTS` cut (`listsCut`); the middle of a view's command line, stdout and stderr
//     (`P-OVERSIZE-COMMAND`, `P-OVERSIZE-FENCES`, `P-OVERSIZE-STREAMS`); and, for EACH of a process result's two
//     choosers, the ends of the assumptions and the residual uncertainty `P-OVERSIZE-FENCES` ties (each holding the
//     view's token and the prompt's) and the end of each slice `P-OVERSIZE-ALL`'s prompt cuts (the instruction, the
//     rationale, the narration and the prior findings, each holding the view's token and then the prompt's own); ⚠ BUT
//     NOT IN EVERY CUT A PROBE TAKES — the cuts that stand on a cut's own arithmetic remove no plant:
//     `W-OVERSIZE-EDGES`'s answer (the validator's chooser), and the stdout of `P-OVERSIZE-CONTENT`,
//     `P-OVERSIZE-SURROGATE`, `P-OVERSIZE-STREAMS` and `P-OVERSIZE-ALL`, both streams of `P-OVERSIZE-ROOM-EDGES` and
//     all three slices of `P-OVERSIZE-AT-ITS-BUDGET` (the view's), each a residual named below. And astride two slices
//     (`W-FENCES`'s instruction and answer, `T-OVERSIZE-FENCES`'s request and rationale, `P-OVERSIZE-FENCES`'s
//     stdout and stderr), astride the two parts of a cut (`P-OVERSIZE-FENCES`'s stdout), split by a line feed, and
//     written backwards, or with its runs reversed, on a line with no bidi control (`FENCE_UNREAD`): so a chooser that
//     reads MORE than the prompt carries in any of those ways — what a planted cut removed, two slices or a cut's two
//     parts joined, a line feed read away, a line with no control laid out — chooses another token too. With them:
//     every break `jsonLine` escapes, U+2028, U+0085 and U+2029 together (`EVERY_BREAK`), at each of its call sites a
//     probe reaches (a node's name, a prior finding, argv) — so an encoder that leaves any one break raw at any one
//     site moves a probe — and in an account list, where design §9.3 D7 retired the encoder, so they reach its region
//     raw; an account with every field and an empty one, and two of its fields tied (`allocate`); and the chooser's own
//     edges — a stdout that prints every candidate but the last two (`P-FENCE-AT-THE-LAST`, its prompt fenced by the
//     last) and, in EVERY framing, slices that print them all (`T-NO-FENCE`, `W-NO-FENCE`, `P-NO-FENCE`, each refused);
//   · ⭐ WHAT THE SKELETON'S TABLE READS, WHOLE, AND THE READER ITS CHOOSER MODELS: dropping any of the six families the
//     plants are spelled through moves `P-OVERSIZE-FENCES`, and so does dropping any rule of the reader a plant stands
//     on — four of how a code point is read (a line terminator read as nothing too, every reading of a code point, a
//     line with a bidi control read reversed, a code point outside the Basic Multilingual Plane read whole) and seven of
//     how a slice is (an isolate or an embedding lays a line out as the override does, every line holding a control is
//     laid out, a control anywhere in a line lays it out, a line laid out runs across the terminators a reader may not
//     break at, a candidate may begin while another is open and inside a reading, and a line is laid out with its runs
//     reversed too). A change to how a CODE POINT is read moves `probes` through the skeleton's digest, which the
//     fingerprint hashes beside the probes as §5.5 hashes the budget; a change to how a SLICE is read, through the
//     reader corpus (`READER_CORPUS`: every reader plant, a witness of each side of each rule `review-fence.ts` states,
//     and one of each layout it names as NOT modelled), the token the chooser takes over each witness hashed beside
//     them too (`fingerprint.ts`). ⚠ Not every change: the corpus takes each rule at the points its witnesses stand, so
//     a change confined to other inputs of a rule, or to two rules read together as no witness puts them, moves nothing
//     — and so does a lookalike no input of the table lists, which no witness can name;
//   · the capture line's count of either stream holding an astral character (`P-STDOUT-CAPTURE-CUT`,
//     `P-STDERR-CAPTURE-CUT`), a cut instruction whose kept HEAD carries a candidate (`OVERSIZE_INTENT`), a head-only cut
//     at its two edges (`W-OVERSIZE-EDGES`), a cut layout's widest declaration where a stream's code points and UTF-16
//     units differ in digit count (`P-OVERSIZE-SURROGATE`), and a view that fills its budget EXACTLY
//     (`P-OVERSIZE-AT-ITS-BUDGET`);
//   · ⭐ THE RUBRIC'S STAKES (design §9.3 D8: each criterion's `severityIfNotMet` beside it, read from the policy):
//     every floor criterion declares BLOCKING, so a rubric that showed a constant, or wrote any other stakes otherwise,
//     moved no probe. `T-STAKES`, `W-STAKES` and `P-STAKES` hand each framing a policy whose criteria declare each of
//     the five (`withEveryStakes`), so each value is shown, and pinned, in every framing.
// ⭐ A REFUSAL IS HASHED TOO (`fingerprint.ts` `probePrompt`): a probe the validator refuses before any prompt exists is
// hashed as the statement it refuses with and the content it was handed — so an edit that SENDS what is refused today,
// in any framing (a chooser that never fails closed, or a validator that fails closed in one framing alone:
// `T-NO-FENCE`, `W-NO-FENCE`, `P-NO-FENCE`), or refuses what is sent today (a refusal edge moved by one unit:
// `P-OVERSIZE-AT-ITS-BUDGET`; a chooser that tries any number of candidates short of a hundred: `P-FENCE-AT-THE-LAST`),
// moves `probes` — and so does one that tries more than a hundred, which sends what `P-NO-FENCE` is refused today.
// ~~a chooser that tries ten candidates: `P-FENCE-PAST-TEN`~~ — its prompt was fenced by the twelfth, so a chooser that
// tried twelve to ninety-nine refused nothing a probe sent; and only a process result was refused, so a validator that
// failed closed for a process result alone moved nothing (both driven on a disposable copy).
// ⚠ NOT TAKEN, AND WHY — none of them is an input this host can be handed (every refusal edge above IS taken, and so is
// each reading a chooser must not make that is named above):
//   · a budget below the view's minimum, refused before the view exists (`reviewBudgetBelowMinimum`): the builder's
//     budget is never below `CONTENT_MIN` (4,000), while a run's minimum is its host lines and three layouts of a few
//     hundred characters each;
//   · a view OVER its budget — the other side of the validator's refusal edge: the builder fits every view it renders
//     to that budget (`processResultReviewInput`), and production's floor builds through it, so a refusal one unit late
//     refuses no view this host renders (the validator's own test refuses one unit over, `REG-F-480`);
//   · two capture cuts of one stream are a run the capture never records (`child-process-runner.ts` `captureSink`
//     declares at most one per stream);
//   · a call name the host did not mint that holds a candidate: `RecordPlaneNameSchema` spells a recorded name with
//     letters, digits, `_`, `.` and `-` alone, and `governedToolCallReport` drops a name the host did not mint, so no name
//     production carries can hold a `<` — the validator's reading of such names is left unprobed, on purpose.
// ⚠ AND AN OVER-READ NO PLANT STANDS FOR moves nothing, though an input can reach it: two slices joined where no plant
// stands astride them (the narration and the prior findings, say), or the removed bytes of a cut that removes no plant
// (the cuts named above). ~~a cut's removed bytes read in a framing whose probes do not cut that slice (a graph's
// assumptions)~~ — every untrusted slice is cut now in every framing that carries it (`listsCut` took the account's
// lists), each such cut removing a plant. It is the safe direction — a token that avoids more than the prompt carries —
// and its cost is a prompt that moves for such an input while `probes` does not.
// ⚠ A DECLARED REVIEW'S WORK ITS BUILDER CUT UNIT BY UNIT (`D-OVERSIZE-UNITS`, `D-OVERSIZE-UNIT-TITLE`) is no such cut:
// the builder cuts it before the validator is handed it, so the bytes it removed are in no input the validator's chooser
// reads, and a plant in them would decide nothing.
//
// ⚠ A PROBE IS NEVER SENT TO A MODEL: only its prompt's hash is kept. Its ids and texts need none of the discipline a
// case needs (§5.2), only stability — a probe that changes moves every fingerprint, deliberately.
// ⭐ THE OVERSIZE LENGTHS ARE DERIVED FROM THE PRODUCT'S OWN BUDGET, so a probe stays oversize when a limit is raised.
// ⭐ `PQ-1` — A PROBE THAT CARRIES A CUT IS NAMED `…OVERSIZE…`, AND ONE NAMED SO CARRIES ONE: a cut is what only an input
// over its budget reaches, and `verif/reviewer-qualification-fingerprint.test.ts` holds the name to the bytes both ways.
import type { AssuranceSubject, ProfessionalRationaleSummary, ReasoningReviewInput } from '@janumipwb/rph-assurance';
import {
	AssuranceSeveritySchema,
	type AssessmentCriterion,
	type EvidenceRequirement,
	type ObservedToolCallReport
} from '@janumipwb/rph-contracts';
import { buildPwaGraphExport, pwaTypeParts, type PwaGraphNode, type PwaMeta, type PwaTypePart } from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { REASONING_REVIEW_BUDGET } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import {
	declaredPolicyReviewInput,
	pwaTypeReviewInput,
	workProductReviewInput,
	type ProcessResultReviewSource
} from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';
import type { ObservedProcessRun } from '../../apps/rph-demo/src/lib/server/tools/process-run-observer.js';

/**
 * ⭐ `PQ-1` (design D3) — HOW A PROCESS-RESULT PROBE IS BUILT: the fingerprint's `processResult` seam, which is the
 * product's `processResultReviewInput` everywhere but in the tests that show a renderer change moves the fingerprint.
 * ⛔ This module imports the builder's TYPE only, never the function: a P- probe cannot reach the renderer except
 * through the seam it is handed, so the fingerprint hashes exactly what the seam builds.
 */
export type ProcessResultBuilder = (source: ProcessResultReviewSource) => ReasoningReviewInput;

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B4; `REG-F-553`'s class) — A DECLARED POLICY AS THE
 * REVIEWER IS SHOWN IT: its id, name and purpose, and its criteria; and the independence its sign-off demands, which no
 * prompt shows and the recording gate reads (as the seeded floor policy's is hashed beside its criteria). ⭐ R3-A F3 (the
 * lead's delegated decision of 2026-10-16, registered as REG-D-114 (13)) — and its required evidence, which no prompt shows
 * and which caps the verdict its sign-off records (`declared-policy-signoff.ts` `evidenceCeiling`).
 */
export interface DeclaredProbePolicy {
	readonly policyId: string;
	readonly name: string;
	readonly purpose: string;
	readonly criteria: readonly AssessmentCriterion[];
	readonly independenceRequirement: string;
	readonly requiredEvidence: readonly EvidenceRequirement[];
}

/**
 * ⭐ E2 — THE CATALOG'S POLICIES, AS THE PRODUCT SEEDS THEM (`seedAdditivePolicies` copies these fields from
 * `ontology.seedPolicies`): every policy a work unit can declare, so every declared review's rubric and purpose. The
 * fingerprint's product seam (`fingerprint.ts` `PRODUCT_SEAMS.declaredPolicies`) and the declared probes' default.
 */
export const CATALOG_DECLARED_POLICIES: readonly DeclaredProbePolicy[] = ontology.seedPolicies.map((p) => ({
	policyId: p.policyId,
	name: p.name,
	purpose: p.purpose,
	criteria: p.criteria as unknown as readonly AssessmentCriterion[],
	independenceRequirement: p.independenceRequirement,
	requiredEvidence: p.requiredEvidence as unknown as readonly EvidenceRequirement[]
}));

export interface FingerprintProbe {
	readonly id: string;
	/** The branch of assembly the probe reaches — for the reader of a moved fingerprint. */
	readonly covers: string;
	/**
	 * The input under `criteria` — the fingerprint's own criteria, so a criteria change reaches the rubric — and, for a
	 * process result, built through `processResult` (the part and work-product probes do not read it).
	 * ⭐ E2 — and, for a declared review, under `declared`: the catalog's policies as the fingerprint's seam holds them, so a
	 * change to a declared policy's purpose or criteria reaches its probe's prompt (the other probes do not read it).
	 */
	readonly input: (
		criteria: readonly AssessmentCriterion[],
		processResult: ProcessResultBuilder,
		declared?: readonly DeclaredProbePolicy[]
	) => ReasoningReviewInput;
}

/** Whom a probe is about. The validator does not read its subject; it is carried because `evaluate` requires one. */
export const PROBE_SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_01M4A7K2QH8X9Z3T5V6W1B0C7D',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'jpwb-fingerprint-probe-author',
		modelId: 'jpwb-fingerprint-probe-author',
		providerId: 'jpwb-fingerprint'
	}
};

/** `sentence` repeated past `limit` characters — an input the budget must cut. */
const over = (limit: number, sentence: string): string =>
	sentence.repeat(Math.ceil((limit + 500) / sentence.length));
const B = REASONING_REVIEW_BUDGET;

const PWA: PwaMeta = {
	id: 'pwa_01M4A7K2QH8X9Z3T5V6W1B0C7D',
	name: 'Retaining Wall Condition Survey',
	domain: 'civil-structural',
	version: '0.1.0',
	publicationStatus: 'DRAFT'
};
const node = (id: string, name: string, pwuKind: string, extra: Partial<PwaGraphNode> = {}): PwaGraphNode => ({
	id,
	name,
	pwuKind,
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	executionBoundary: 'INTERNAL',
	...extra
});
const ROOT_ID = 'pwut_01M4A7K9R2D5F8H1J4K7M0N3P6';
const INSPECT_ID = 'pwut_01M4A7KF3T6V9X2Z5B8D1G4J7K';
const NODES: readonly PwaGraphNode[] = [
	node(ROOT_ID, 'Condition Survey', 'SURVEY', {
		isRoot: true,
		permittedChildTypeIds: [INSPECT_ID],
		requiredOutputs: ['survey-report']
	}),
	node(INSPECT_ID, 'Visual Inspection', 'INSPECTION', { requiredInputs: ['survey-report'] })
];
/**
 * ⭐ Package P F1 — THE ABSENT-FIELD CONTROL'S GRAPH: the root carrying each new field EMPTY, as its author stored it — no
 * purpose, no declared policy, no child rule, a template whose output contract is empty — and the inspection carrying none of
 * them, a type that predates them. The two must read differently.
 */
const EMPTY_AND_ABSENT_NODES: readonly PwaGraphNode[] = [
	{
		...NODES[0]!,
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		purpose: '',
		requiredAssurancePolicyIds: [],
		permittedChildren: [],
		promptTemplate: { templateText: 'Survey {title}.', outputContract: '', status: 'ACTIVE', templateVersion: 1 }
	},
	NODES[1]!
];
// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 (`REG-D-125`; DESIGN-authoring-review-in-parts.md §5) — THE PARTS' GRAPHS ──
/** The PWA of the part probes, with a description, which a root's subject carries (design D3). */
const PWA_DESCRIBED: PwaMeta = { ...PWA, description: 'A condition survey of a 60 m masonry retaining wall, panel by panel.' };
/** One part of the PWA `nodes` define: the type `typeId`'s, cut by the product's own `pwaTypeParts`. */
function partOf(nodes: readonly PwaGraphNode[], typeId: string, pwa: PwaMeta = PWA): PwaTypePart {
	const part = pwaTypeParts(buildPwaGraphExport(pwa, nodes)).find((x) => x.typeId === typeId);
	if (part === undefined) throw new Error(`no part of ${typeId}`);
	return part;
}
const FIELDWORK_ID = 'pwut_01M4A7KQ5W8Y1A4C7E0G3J6M9P';
const PANEL_ID = 'pwut_01M4A7KX8Z1B4D7F0H3K6N9Q2S';
const DRAINAGE_ID = 'pwut_01M4A7M3B4E7G0J3M6P9S2V5X8';
const REPORT_ID = 'pwut_01M4A7M9E7H0K3N6Q9T2W5Z8B1';
/**
 * ⭐ A THREE-LEVEL PWA, every type carrying what it declares (design D3): the survey root; the fieldwork, a middle composite
 * permitting the panel inspection (M1) and the drainage check (C1, with an applicability note); and the report, delegated,
 * with its boundary contract and context specification. The fieldwork's children's flow runs among them (the inspection to
 * the check) and across its subtree's boundary (the inspection, and the fieldwork itself, to the report).
 */
const PART_NODES: readonly PwaGraphNode[] = [
	node(ROOT_ID, 'Condition Survey', 'SURVEY', {
		isRoot: true,
		permittedChildTypeIds: [FIELDWORK_ID, REPORT_ID],
		requiredInputs: ['wall-drawings'],
		requiredOutputs: ['survey-findings'],
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		purpose: 'Survey the condition of the retaining wall and report its defects by panel.',
		requiredAssurancePolicyIds: ['pol_intent_preservation', 'pol_fitness_for_purpose'],
		permittedChildren: [
			{ typeId: FIELDWORK_ID, cardinality: 'M1', applicabilityNote: 'Every survey goes on site.' },
			{ typeId: REPORT_ID, cardinality: 'M1' }
		],
		promptTemplate: {
			templateText: 'Survey {title} through its fieldwork and its report; claim no defect the fieldwork did not record.',
			outputContract: 'A JSON object: {"defects": [{"panel": number, "defect": string}]}.',
			status: 'ACTIVE',
			templateVersion: 2
		},
		completionRule: 'The report names every panel.'
	}),
	node(FIELDWORK_ID, 'Survey Fieldwork', 'FIELDWORK', {
		permittedChildTypeIds: [PANEL_ID, DRAINAGE_ID],
		requiredInputs: ['wall-drawings', 'panel-defects', 'drainage-findings'],
		requiredOutputs: ['fieldwork-record'],
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		purpose: 'Inspect every panel on site and check the drainage behind it.',
		requiredAssurancePolicyIds: ['pol_intent_preservation'],
		permittedChildren: [
			{ typeId: PANEL_ID, cardinality: 'M1', applicabilityNote: 'Every panel is inspected.' },
			{ typeId: DRAINAGE_ID, cardinality: 'C1', applicabilityNote: 'Only where the weep holes are blocked.' }
		],
		promptTemplate: {
			templateText: 'Compose the fieldwork record of {title} from its inspections; record nothing they did not observe.',
			outputContract: 'A JSON object: {"panels": number, "defects": string[]}.',
			status: 'ACTIVE',
			templateVersion: 1
		}
	}),
	node(PANEL_ID, 'Panel Inspection', 'INSPECTION', {
		requiredInputs: ['wall-drawings'],
		requiredOutputs: ['panel-defects'],
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		purpose: 'Inspect each panel and record each crack, its width and its displacement.',
		requiredAssurancePolicyIds: ['pol_test_adequacy'],
		permittedChildren: [],
		promptTemplate: {
			templateText:
				'Inspect {title} panel by panel. Record each crack you observed, its width and its displacement; record nothing you did not observe.',
			outputContract: 'A JSON array of {"panel": number, "crack": string, "widthMm": number}.',
			status: 'ACTIVE',
			templateVersion: 3
		}
	}),
	node(DRAINAGE_ID, 'Drainage Check', 'INSPECTION', {
		requiredInputs: ['panel-defects'],
		requiredOutputs: ['drainage-findings'],
		workDischarge: 'MODEL',
		promptStatus: 'DRAFT',
		purpose: 'Check the weep holes of each panel the inspection reports.',
		requiredAssurancePolicyIds: [],
		permittedChildren: [],
		promptTemplate: { templateText: 'Check {title}.', status: 'DRAFT', templateVersion: 1 }
	}),
	node(REPORT_ID, 'Survey Report', 'REPORTING', {
		requiredInputs: ['fieldwork-record', 'panel-defects'],
		requiredOutputs: ['survey-findings'],
		executionBoundary: 'DELEGATED_EXTERNAL',
		purpose: 'Report the survey’s findings, panel by panel.',
		boundaryContract: {
			counterpartyLabel: 'An independent reporting engineer',
			attestedAssurancePolicyIds: ['pol_fitness_for_purpose']
		},
		contextSpecification: {
			requiredElements: ['the fieldwork record'],
			constraintDispositions: [{ constraintId: 'CON-1', fate: 'PROPAGATED' }]
		}
	})
];
/**
 * ⭐ A COMPOSITE WIDER THAN ITS ROOM: a root permitting six children, each a purpose of 5,000 characters, so its part is over
 * its budget and its children's skeletons are cut child by child, each cut declared (`pwaTypeReviewInput`).
 */
const WIDE_NODES: readonly PwaGraphNode[] = (() => {
	const ids = Array.from({ length: 6 }, (_, i) => `pwut_01M4A7MF${String(i).padStart(18, '0')}`);
	return [
		node(ROOT_ID, 'Condition Survey', 'SURVEY', {
			isRoot: true,
			permittedChildTypeIds: ids,
			purpose: 'Survey every panel of the wall.'
		}),
		...ids.map((id, i) =>
			node(id, `Panel Group ${i + 1}`, 'INSPECTION', { purpose: over(5_000, `Inspect panel group ${i + 1} on site. `) })
		)
	];
})();
/** ⭐ A TYPE WHOSE OWN DEFINITION IS LONGER THAN ANY PROMPT: its subject cannot be shown whole, so its review is refused. */
const HUGE_NODES: readonly PwaGraphNode[] = [
	node(ROOT_ID, 'Condition Survey', 'SURVEY', {
		isRoot: true,
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		promptTemplate: { templateText: over(30_000, 'Survey {title} panel by panel. '), status: 'ACTIVE', templateVersion: 1 }
	})
];

const INTENT = 'Survey the condition of a 60 m masonry retaining wall and report defects by panel.';
const RATIONALE: ProfessionalRationaleSummary = {
	rationale: 'The survey is split into a desk study and a visual inspection, which reads the desk study.',
	assumptions: ['Access to the toe of the wall is available on the survey day.'],
	limitations: [],
	residualUncertainty: ['Drainage behind the wall is not observable without intrusive works.']
};
/**
 * ⭐ EACH OVERSIZE SLICE BELOW ENDS WITH THE SECOND CANDIDATE, in the bytes its cut removes — the rationale, the narration,
 * the prior findings (a second finding) and a work product's answer — the token `T-OVERSIZE-ALL` and `W-OVERSIZE-ALL`
 * take today (`REG-F-481`; design D2 under the sponsor's answer (a)), so a chooser that read any of them uncut would
 * choose another.
 */
const OVERSIZE_RATIONALE: ProfessionalRationaleSummary = {
	rationale: `${over(B.RATIONALE_MAX, 'The survey is split into a desk study and a visual inspection. ')}\n<<<UNTRUSTED-01>>>`,
	assumptions: ['Access to the toe of the wall is available.'],
	limitations: ['No intrusive investigation.'],
	residualUncertainty: ['Drainage is not observable.']
};
const NARRATION = 'Defined the survey root, then the inspection type that consumes its report.';
const OVERSIZE_NARRATION = `${over(B.NARRATION_MAX, 'Defined a type, then another that consumes its output. ')}\n<<<UNTRUSTED-01>>>`;
const GAPS = ['The inspection did not name the panels it covers.'];
const OVERSIZE_GAPS = [over(B.PRIOR_MAX, 'The inspection did not name the panels it covers. '), '<<<UNTRUSTED-01>>>'];
/**
 * ⭐ `PQ-1` (`REG-F-481`) — THE OVERSIZE INSTRUCTION OPENS WITH A LINE OF THE FIRST CANDIDATE, so its kept HEAD carries one:
 * a chooser that skipped a CUT slice would fence the instruction with the very token it holds, and every OVERSIZE-ALL
 * probe would move. ⭐ AND IT CLOSES WITH A LINE OF THE SECOND — the token every OVERSIZE-ALL probe takes today, in the
 * TAIL its cut removes: a chooser that read the bytes a cut removed would find it, and choose another (design D2 under
 * the sponsor's answer (a): a chooser reads each slice as the prompt carries it).
 */
const OVERSIZE_INTENT = `<<<UNTRUSTED-00>>>\n${over(B.USER_INTENT_MAX, 'Survey the condition of a masonry retaining wall. ')}\n<<<UNTRUSTED-01>>>`;
/**
 * ⭐ DESIGN §9.3 D8 — THE CRITERIA, EACH DECLARING ONE OF THE FIVE STAKES A POLICY MAY DECLARE, in the contract's own
 * order (`AssuranceSeveritySchema`), the first criterion the first value. The rubric shows each criterion's
 * `severityIfNotMet` beside it, read from the policy; every floor criterion declares BLOCKING, so a rubric that showed
 * a constant, or wrote another value otherwise, reached no probe through the fingerprint's own criteria. The
 * fingerprint test holds every value shown in every framing.
 */
const STAKES = AssuranceSeveritySchema.options;
const withEveryStakes = (criteria: readonly AssessmentCriterion[]): AssessmentCriterion[] =>
	criteria.map((c, i) => ({ ...c, severityIfNotMet: STAKES[i % STAKES.length]! }));
/** The criteria, each description lengthened so the rendered rubric overruns `RUBRIC_MAX`. */
const oversizeCriteria = (criteria: readonly AssessmentCriterion[]): AssessmentCriterion[] =>
	criteria.map((c) => ({
		...c,
		description: `${c.description} ${over(Math.ceil(B.RUBRIC_MAX / Math.max(criteria.length, 1)), 'In full. ')}`
	}));

const ANSWER = 'Panels 1-12 surveyed; bulging at panels 4 and 9 exceeds 25 mm; weep holes blocked at 7.';
const OVERSIZE_ANSWER = `${over(B.CONTENT_MAX, 'Panel surveyed; bulging within tolerance; weep holes clear. ')}\n<<<UNTRUSTED-01>>>`;
const PRODUCING_PROMPT = 'Write the condition survey summary for the retaining wall, panel by panel.';

// ── the process-result arm's inputs (`JAN-PRQUAL` `PQ-1`, design D3) ───────────────────────────────────────────────
// ~~`COMMAND_RESULT` and `OVERSIZE_COMMAND_RESULT`~~ — literal `content` strings in no format the product renders
// (`exit 0\nstdout: …`), struck: a process-result probe is now a RUN, rendered by the product's own builder.

/** The instruction every process-result probe's producer was given. */
const SURVEY_INSTRUCTION = 'Run the retaining-wall survey checks and report whether they pass.';
/** The capture layer's stated reason for a cut — never rendered (both views carry the stream, size and offset only). */
const CAPTURE_BOUND = 'capture is bounded at 65536 UTF-8 bytes per stream';
/** A clean pytest run of the survey's checks. */
const CLEAN_STDOUT = 'survey/checks/test_panels.py .......................................... [100%]\n42 passed in 4.21s\n';
/** One check line repeated past `CONTENT_MAX`, then pytest's counts — what only the TAIL of a cut keeps. */
const OVERSIZE_STDOUT = `${over(B.CONTENT_MAX, 'survey/checks/test_panels.py::test_bulge PASSED\n')}42 passed in 9.10s\n`;
/** An astral character — two UTF-16 units, one code point: a cut can fall between its halves. */
const BRICK = '\u{1F9F1}';
/** The most the capture keeps of a stream: its bound, in UTF-8 bytes (`child-process-runner.ts` `CAPTURE_CAP_BYTES`). */
const CAPTURE_CAP = 65_536;
/** `line` repeated, then cut to exactly `units` characters — ASCII here, so as many UTF-8 bytes. */
const filled = (line: string, units: number): string => line.repeat(Math.ceil(units / line.length)).slice(0, units);
/** A verbose pytest stdout that filled the capture — what is kept of a 480 KB run. */
const CAPTURED_STDOUT = filled('survey/checks/test_panels.py::test_bulge[panel-9] PASSED\n', CAPTURE_CAP);
/**
 * A stderr that filled the capture too — the same warning, once per check — ⭐ with the FIRST candidate in its middle,
 * which the review's cut removes: the token `P-OVERSIZE-STREAMS`'s view takes today (`REG-F-481`; design D2 under the
 * sponsor's answer (a)), so a chooser that read stderr uncut would choose another. Still the capture's bound in length,
 * every character ASCII.
 */
const CAPTURED_STDERR = ((warnings: string): string =>
	`${warnings.slice(0, CAPTURE_CAP / 2)}<<<UNTRUSTED-00>>>\n${warnings.slice(CAPTURE_CAP / 2 + '<<<UNTRUSTED-00>>>\n'.length)}`)(
	filled('PytestUnknownMarkWarning: Unknown pytest.mark.drainage - is this a typo?\n', CAPTURE_CAP)
);
/**
 * ⭐ HOW LONG `P-OVERSIZE-ROOM-EDGES`'s STDERR IS: two units past what fits whole between its fence lines in the room the
 * renderer gives it at `CONTENT_MIN` — so it is cut, and would fit whole were its fence lines not counted. ⚠ A CONSTANT
 * TUNED TO THE RENDERER'S LAYOUT, as the surrogate probe's parity is: the fingerprint test asserts the edge and says how
 * to re-tune it.
 */
const STDERR_AT_ITS_EDGE = 1878;
/**
 * ⭐ HOW MANY ASTRAL CHARACTERS `P-OVERSIZE-SURROGATE`'s STDOUT HOLDS (`REG-F-480`): four digits of code points in five
 * digits of UTF-16 units, so a cut layout that reserved its widest declaration in units — each of its four numbers one
 * digit wider — would keep four units fewer, and move this probe. ⚠ A CONSTANT TUNED TO THE DIGITS, as
 * `STDERR_AT_ITS_EDGE` is to the layout: the fingerprint test asserts the two counts differ in width, and says how to
 * re-tune it.
 */
const SURROGATE_POINTS = 6_000;
/**
 * ⭐ HOW LONG EACH SLICE OF `P-OVERSIZE-AT-ITS-BUDGET` IS (`REG-F-480`): the command line's JSON, stdout and stderr each
 * this many code points, every one ASCII — each over its third of the room, so all three are cut alike, and every
 * declaration states four numbers of four digits: a HEAD and a TAIL each between 1,000 and 4,999 code points, this
 * total, and at least 1,000 removed. The layout reserves each declaration at its widest — four numbers as wide as the
 * total — so a view whose every number is that wide fills its budget EXACTLY: the edge of the validator's refusal of a
 * view over its budget. ⚠ A CONSTANT TUNED TO THE DIGITS, for any content budget from about 7,000 to `CONTENT_MAX`:
 * the fingerprint test asserts the view fills its budget, and says how to re-tune it.
 */
const SLICE_AT_FOUR_DIGITS = 9_500;
/** The run whose command line, stdout and stderr are each `SLICE_AT_FOUR_DIGITS` code points (see there). */
const AT_FOUR_DIGITS_ARGV_HEAD: readonly string[] = ['python', '-m', 'pytest', '-rs', 'survey/checks/', '-k'];

// ── the fence choosers' probe (`JAN-PRQUAL` `PQ-1`; `REG-F-481`, `REG-F-476`; design D2 under the sponsor's answer (a)) ──
/**
 * ⭐⭐ A CANDIDATE IN EVERY SLICE A FENCE CHOOSER READS, EACH SPELLED THROUGH A DIFFERENT RULE OF THE SKELETON OR OF THE
 * READER — a chain, `00` to `18`, so the view's chooser skips all nineteen and takes `<<<UNTRUSTED-19>>>`, and the
 * validator's, which reads the view whole as well, takes `<<<UNTRUSTED-20>>>`. ⭐ EVERY LINK DECIDES: were any one plant
 * not read — its slice skipped by a chooser, its spelling by the table, or its rule by the reader the chooser models
 * (`review-fence.ts`) — its own candidate would be free and lower than the token chosen, so the token moves, and the
 * probe with it. ⛔ No byte of a
 * plant is altered: a chooser reads the slices as the prompt carries them.
 *   · 00 the instruction, exact;
 *   · 01 the account's rationale, a zero-width space inside it (the table's DELETED family);
 *   · 02 argv, its zero the MATHEMATICAL BOLD DIGIT ZERO, a code point outside the Basic Multilingual Plane — two
 *     UTF-16 units, read as ONE code point (TR39 and its decomposition both read it as 0), so a reader that looked a
 *     code point up by its first unit reads it no more;
 *   · 03 stdout's HEAD, the Cyrillic ZE for the digit 3 — TR39's own lookalike of a digit, after exact 00 and 02;
 *   · 04 stdout's TAIL, in ASCII lower case, its zero the Devanagari digit zero — read as a zero only because TR39's
 *     prototype for it is a small o, which the table reads in either case: by the ASCII fold, or by the case mappings
 *     rule 2 reads a prototype's characters through (either alone reads it, so the two are one family here);
 *   · 05 stderr, the Cyrillic small te, read as T through its capital (the either-case family);
 *   · 06 the account's assumptions, a superscript six (read through its compatibility decomposition);
 *   · 07 the account's residual uncertainty, the Cyrillic capital IE for E (TR39);
 *   · 08 stderr, split by a raw U+2028 — read whole, because a reader may not break a line there (the reader's
 *     terminators, `UNBROKEN_TERMINATORS`);
 *   · 09 the instruction, the DEGREE SIGN for its 0 — read as a zero only through its TR39 class, which the masculine
 *     ordinal indicator's `<super>` o reads (rule 4 of the table);
 *   · 10 stderr, the Cyrillic small tall te for T — which TR39 reads as 7 and its capital as T: read as T because the
 *     reader takes a code point every way the table reads it, never by its first reading alone;
 *   · 11 stderr, written backwards after a RIGHT-TO-LEFT OVERRIDE — read because a line holding a bidi control is read
 *     laid out reversed too, its brackets mirrored;
 *   ⭐ AND ONE FOR EACH RULE OF HOW THE READER READS A SLICE (`review-fence.ts` `readSlice`; `REG-F-481`): ⛔ the plants
 *   stood at one point of each such rule, a line under U+202E that opened the only line of stderr holding a control, so
 *   a reader that laid out a line only under the override, only the first such line, only a line a control BEGINS,
 *   broken at every terminator, or that let no candidate begin inside a reading, moved no probe (driven on a disposable
 *   copy, each). Now:
 *   · 12 the instruction, written backwards between a RIGHT-TO-LEFT ISOLATE and its pop — read because an isolate lays
 *     a line out as the override does, to this reader (`BIDI_CONTROLS`);
 *   · 13 stderr, written backwards after an override, on the SECOND line of stderr that holds a control — read because
 *     every line holding one is laid out, not the first alone;
 *   · 14 stderr, written backwards after an override that stands MID-LINE — read because a control anywhere in a line
 *     lays it out;
 *   · 15 stderr, written backwards after an override, a raw U+2028 inside it — read because a line laid out runs from one
 *     line feed to the next, across the terminators a reader may not break at;
 *   · 16 stderr, after a FOURTH bracket — read because a candidate may begin while another is open;
 *   · 17 stderr, its first two brackets one MUCH LESS-THAN, U+226A, which reads as `<<` — read because a candidate may
 *     begin INSIDE a reading;
 *   · 18 stderr, its digits BEFORE its name, between a RIGHT-TO-LEFT EMBEDDING and its pop — read because a line holding
 *     a control is laid out with its RUNS reversed too (`runsReversed`), as UAX #9 lays out a line wholly inside an
 *     embedding: its letters and its digits keep their order, its runs and its brackets do not. ⛔ Read code point by
 *     code point alone, a forged block planted so stood outside every fence (`REG-F-481`, driven).
 * ⚠ EACH SPELLING IS READ BY THE FAMILY OR THE RULE NAMED AND BY NO OTHER, so regenerating the table without that family
 * (the fingerprint test drops each of the six in turn), or loading the chooser without that rule (each of the eleven),
 * moves this probe: a fullwidth digit is read by TR39 and by its decomposition both, which is why none is planted — save
 * 02's astral zero, read by both on purpose, which stands for the reader reading a code point whole, not for a family.
 * ⚠ THE ORDER IS PART OF IT: each plant from `11` up that a control lays out is read through `11`'s rule as well (a
 * line holding a control is laid out), and those after `13` in stderr through `13`'s (every such line) — so each
 * stands after the rules it shares, and a reader without a shared rule takes the lowest plant that rule reads.
 */
const FENCE_PLANTS = {
	instruction: '<<<UNTRUSTED-00>>>',
	rationale: '<<<UNTRUSTED-0\u200b1>>>',
	argv: '<<<UNTRUSTED-\u{1d7ce}2>>>',
	stdoutHead: '<<<UNTRUSTED-0\u0417>>>',
	stdoutTail: '<<<untrusted-\u09664>>>',
	stderr: '<<<UNTRUS\u0442ED-05>>>',
	assumptions: '<<<UNTRUSTED-0\u2076>>>',
	residualUncertainty: '<<<UNTRUST\u0415D-07>>>',
	splitByALineSeparator: '<<<UNTRUSTED-0\u20288>>>',
	readThroughItsClass: '<<<UNTRUSTED-\u00b09>>>',
	readTheSecondWay: '<<<UNTRUS\u1c84ED-10>>>',
	laidOutReversed: '\u202e<<<11-DETSURTNU>>>',
	isolatedReversed: '\u2067<<<21-DETSURTNU>>>\u2069',
	onASecondLine: '\u202e<<<31-DETSURTNU>>>',
	reversedMidLine: 'E   panel 9: \u202e<<<41-DETSURTNU>>>',
	reversedAndSplit: '\u202e<<<51-DET\u2028SURTNU>>>',
	afterAFourthBracket: '<<<<UNTRUSTED-16>>>',
	insideAReading: '\u226a<<UNTRUSTED-17>>>',
	runsReversed: '\u202b<<<18-UNTRUSTED>>>\u202c'
} as const;
/**
 * ⭐ WHAT A FENCE CHOOSER MUST NOT READ, each planted as `P-OVERSIZE-FENCES`'s view's own token, `19` — so a chooser that
 * read it would find the token it chose, and choose another (`REG-F-481`; design D2 under the sponsor's answer (a): a
 * chooser reads each slice as the prompt carries it):
 *   · in the MIDDLE of stdout, which the review's cut removes — a chooser reads the bytes a cut KEPT, never those it
 *     removed — and at the END of the assumptions, which theirs removes;
 *   · ASTRIDE THE CUT of stdout — its first half ends a run of code points a reader does not see, where the HEAD ends,
 *     and its second half follows another, where the TAIL begins (`UNSEEN`) — and ASTRIDE stdout and stderr, its first
 *     half ending one and its second beginning the other: a chooser reads a cut's two parts, and the view's slices,
 *     each on its own;
 *   · in stderr, split by a line feed — the one terminator every reader breaks a line at, so its halves are no line a
 *     reader sees, and a reader that read the line feed away would find it;
 *   · in stderr, written backwards, and written with its runs reversed, each on a line of its own with NO bidi control,
 *     below the lines that have one — a reader lays out only a line that holds one, so a chooser that read the whole
 *     slice, or every line of it, laid out would find it.
 * ⭐ And the PROMPT's own token, `20`, at the END of the residual uncertainty, which its cut removes: the validator's
 * chooser reads the account as the prompt carries it too. ⭐ AND EACH OF THE TWO TIED LISTS ENDS WITH BOTH (`19` and
 * `20`, in the other order in the other list): so each chooser that read EITHER list uncut finds its own token.
 */
const FENCE_UNREAD = {
	removedMiddle: '<<<UNTRUSTED-19>>>',
	firstHalf: '<<<UNTRUSTED-1',
	secondHalf: '9>>>',
	endOfTheAssumptions: '<<<UNTRUSTED-19>>>',
	endOfTheResidualUncertainty: '<<<UNTRUSTED-20>>>',
	splitByALineFeed: '<<<UNTRUSTED-1\n9>>>',
	backwardsWithNoControl: '<<<91-DETSURTNU>>>',
	runsReversedWithNoControl: '<<<19-UNTRUSTED>>>'
} as const;
/**
 * ⭐ A RUN OF CODE POINTS A READER DOES NOT SEE (the zero-width space, the table's DELETED family) — as long as the most
 * content a review keeps, so the cut of `P-OVERSIZE-FENCES`'s stdout falls inside one run at its HEAD's end and inside
 * another at its TAIL's start, whatever the room: the halves of the token around them stand astride the cut, a token to
 * a chooser that read the HEAD and the TAIL joined, and no token in either alone.
 */
const UNSEEN = '\u200b'.repeat(B.CONTENT_MAX);
/** The fence's form, `<<<UNTRUSTED-nn>>>` — how a candidate a probe prints is spelled, exactly. */
const candidate = (n: number): string => `<<<UNTRUSTED-${String(n).padStart(2, '0')}>>>`;
/** The first `count` candidates, a line each — what a stdout that prints them holds. */
const candidateLines = (count: number): string => Array.from({ length: count }, (_, n) => `${candidate(n)}\n`).join('');
/**
 * ⭐ HOW MANY CANDIDATES `P-FENCE-AT-THE-LAST`'s STDOUT PRINTS (`REG-F-481`): every one but the last two, `00` to `97`, so
 * its view is fenced by `<<<UNTRUSTED-98>>>` and its prompt by `<<<UNTRUSTED-99>>>`, the LAST candidate — and a chooser
 * that tried any number of candidates short of a hundred would refuse what is sent today (one that tried more would send
 * what `P-NO-FENCE` is refused). ⛔ IT WAS TEN (`P-FENCE-PAST-TEN`, its prompt fenced by the twelfth), so a chooser that
 * tried anything from twelve to ninety-nine candidates refused nothing a probe sent. ⚠ A CONSTANT TUNED TO THAT EDGE: the
 * fingerprint test pins both tokens.
 */
const ALL_BUT_THE_LAST_TWO = 98;
/**
 * Every candidate the choosers try, `00` to `99` (`FENCE_CANDIDATE_COUNT`) — what `T-NO-FENCE`'s request,
 * `W-NO-FENCE`'s answer and `P-NO-FENCE`'s stdout print.
 */
const EVERY_CANDIDATE = 100;
/**
 * ⭐ EVERY LINE BREAK `jsonLine` ESCAPES, RAW — U+2028, U+0085 and U+2029, each a break to some reader, which
 * `JSON.stringify` leaves raw (`REG-F-481`, `REG-F-482`) — planted together at each call site a probe reaches (a node's
 * name, a prior finding, argv): so an encoder that escaped any one break and not the others, at any one
 * site, would leave a break raw in the prompt, and move a probe. ⭐ And in an assumption, where design §9.3 D7 retired
 * the encoder (the lists are `renderRationale`'s bullets again): there the three stand raw in the list's region, the
 * agent's own words, ~~and the fence chooser reads them as the prompt carries them~~ — splitting no candidate there:
 * what holds the fence chooser to reading a field's breaks as the prompt carries them is `BREAKS_ACCOUNT`, each of
 * whose candidates one splits.
 */
const EVERY_BREAK = '\u2028\u0085\u2029';
/**
 * ⭐ HOW LONG EACH OF THE TWO TIED LISTS' SECOND ITEM IS — the account's fields share `RATIONALE_MAX` by `allocate`, the rule
 * the view's slices are shared by too: the residual uncertainty's label is one character shorter than the assumptions',
 * so its item is one character longer and the two NEED the same room; both are over their share; and what the
 * rationale leaves them is odd, so the tie decides which of the two gets the one unit over — the earlier, by the
 * fields' own order. ⚠ A CONSTANT TUNED TO THE ACCOUNT'S LABELS AND TO `RATIONALE_MAX`, as `STDERR_AT_ITS_EDGE` is to
 * the view's layout: the fingerprint test asserts the tie, and says how to re-tune it. ⭐ Design §9.3 D7 RE-TUNED IT:
 * the labels are HEAD's again (the residual uncertainty's still one shorter), and the rationale lost its label —
 * fifteen characters, which made what it leaves even; so `FENCES_ACCOUNT`'s rationale says the checks were run "just"
 * once. ⚠ The two items end with the same two tokens (`FENCE_UNREAD`), each in the other order, so they stay one length
 * apart and the tie stands.
 */
const TIED_ITEM = 2_400;
/**
 * The fences probe's account: every field, the limitations empty, two lists tied over their share (`TIED_ITEM`) — ⭐ each
 * of the two ending with BOTH tokens where its cut removes them (`FENCE_UNREAD`: the view's own and the prompt's, in
 * the other order in the other list), the same length both, so the tie stands. ⛔ Each ended with one token alone, the
 * view's in the assumptions and the prompt's in the residual uncertainty, so the validator's chooser reading the
 * assumptions uncut, or the view's the residual uncertainty, moved no probe (driven on a disposable copy).
 */
const FENCES_ACCOUNT: ProfessionalRationaleSummary = {
	rationale: `The survey checks were run just once, as the instruction asks.\n${FENCE_PLANTS.rationale}`,
	assumptions: [
		FENCE_PLANTS.assumptions,
		`${filled('The toe of the wall is reachable on the survey day. ', TIED_ITEM)}${FENCE_UNREAD.endOfTheAssumptions}${FENCE_UNREAD.endOfTheResidualUncertainty}`
	],
	limitations: [],
	residualUncertainty: [
		FENCE_PLANTS.residualUncertainty,
		`${filled('Drainage behind the wall is not observable without intrusive works. ', TIED_ITEM + 1)}${FENCE_UNREAD.endOfTheResidualUncertainty}${FENCE_UNREAD.endOfTheAssumptions}`
	]
};
/**
 * ⭐ AN ACCOUNT WHOSE THREE LISTS ARE EACH CUT (`REG-F-481`; design D2 under the sponsor's answer (a)) — each list one
 * item as long as the whole account's budget, so each is over its share, ending with `ends` where its cut removes it:
 * the token each chooser that reads the list takes. ⛔ No graph or work-product probe cut the assumptions or the
 * residual uncertainty, and no work-product or process-result probe the limitations, so a chooser that read one of them
 * uncut in that framing alone moved no probe (driven on a disposable copy).
 */
const listsCut = (ends: string): ProfessionalRationaleSummary => ({
	rationale: 'The survey is split into a desk study and a visual inspection.',
	assumptions: [`${filled('The toe of the wall is reachable on the survey day. ', B.RATIONALE_MAX)}${ends}`],
	limitations: [`${filled('No intrusive investigation of the backfill was made. ', B.RATIONALE_MAX)}${ends}`],
	residualUncertainty: [`${filled('Drainage behind the wall is not observable. ', B.RATIONALE_MAX)}${ends}`]
});
/**
 * ⭐ `W-FENCES`'s ACCOUNT — a candidate in each field, `02` to `05`, in the fields' order (`REG-F-481`). ⛔ `W-FENCES`
 * carried an instruction and an answer alone, so a chooser that skipped a work product's account, and no other
 * framing's, fenced with a token the account holds — the forged-block path `REG-F-481` closed — and moved no probe
 * (driven on a disposable copy).
 */
const FENCES_WORK_PRODUCT_ACCOUNT: ProfessionalRationaleSummary = {
	rationale: `The summary follows the panels in order.\n${candidate(2)}`,
	assumptions: [candidate(3)],
	limitations: [candidate(4)],
	residualUncertainty: [candidate(5)]
};

// ── the validator chooser's probes in the other two framings (`JAN-PRQUAL` `PQ-1`; `REG-F-481`, `REG-F-476`) ─────────────
/**
 * ⭐⭐ ~~`G-OVERSIZE-FENCES`'s GRAPH~~ `T-OVERSIZE-FENCES`'s GRAPH, whose inspection's part it is (B7) — the inspection type
 * NAMED with a candidate, `01`, and every break `jsonLine` escapes
 * inside its name (`EVERY_BREAK`): the graph's content is one line of JSON (`jsonLine`), so a call site that encoded it
 * otherwise, or escaped one break and not the others, would leave a break raw, and the prompt would move.
 */
const FENCES_NODES: readonly PwaGraphNode[] = [
	NODES[0]!,
	node(INSPECT_ID, `Visual Inspection <<<UNTRUSTED-01>>> panel${EVERY_BREAK}nine`, 'INSPECTION', { requiredInputs: ['survey-report'] })
];
/**
 * ⭐ ~~`G-OVERSIZE-FENCES`'s~~ `T-OVERSIZE-FENCES`'s ACCOUNT — a candidate in each field, `02` to `05`, in the fields'
 * order; every break inside an
 * assumption (~~an account list is one line of JSON too~~ raw in its region since design §9.3 D7, which retired the
 * list encoder); and the limitations long enough to be CUT, alone, so a cut of
 * them — its HEAD keeps `04` — is hashed, and how it is declared with it. ⭐ AND THE LIMITATIONS END WITH THE PROMPT'S OWN
 * TOKEN, `08`, in the bytes the cut removes: a chooser that read the account uncut would find it, and choose another.
 * ⭐ AND THE RATIONALE OPENS WITH THE TOKEN'S SECOND HALF, the request ending with its first (`T-OVERSIZE-FENCES`): a
 * chooser that read the instruction and the account joined would find it.
 */
const FENCES_GRAPH_ACCOUNT: ProfessionalRationaleSummary = {
	rationale: '8>>>\nThe survey is split into a desk study and a visual inspection.\n<<<UNTRUSTED-02>>>',
	assumptions: ['<<<UNTRUSTED-03>>>', `Access to the toe of the wall${EVERY_BREAK}is available.`],
	limitations: ['<<<UNTRUSTED-04>>>', 'No intrusive investigation. '.repeat(200), '<<<UNTRUSTED-08>>>'],
	residualUncertainty: ['<<<UNTRUSTED-05>>>']
};

// ── the account, read as the prompt carries it (`JAN-PRQUAL` `PQ-1`; design §9.3 D7; `REG-F-481`) ────────────────────
/** The line terminators a reader may not break a line at (`review-fence.ts` `UNBROKEN_TERMINATORS`). */
const UNBROKEN = ['\r', '\v', '\f', '\u0085', '\u2028', '\u2029'] as const;
/** Candidate `n` split between its two digits by `split`: one candidate, or none, as a reader reads `split`. */
const splitBy = (n: number, split: string): string => `${candidate(n).slice(0, 14)}${split}${candidate(n).slice(14)}`;
/** Candidate `n` written backwards, its brackets as a line laid out reversed draws them: one only to a reader that lays
 *  its line out. */
const writtenBackwards = (n: number): string =>
	[...candidate(n)]
		.reverse()
		.map((c) => (c === '<' ? '>' : c === '>' ? '<' : c))
		.join('');
/** Candidate `n`, its two runs — its digits, then `UNTRUSTED` — in reverse order: one only to a reader that lays its
 *  line out with its runs reversed (`review-fence.ts` `runsReversed`). */
const runsBackwards = (n: number): string => `<<<${String(n).padStart(2, '0')}-UNTRUSTED>>>`;
/**
 * ⭐ A LINE OF EACH LAYOUT `review-fence.ts` STATES ITS READER LAYS A LINE OUT BY, holding candidate `n` where that layout
 * alone reads it (design §9.3 D7; `REG-F-481`): under U+202E RIGHT-TO-LEFT OVERRIDE, written backwards — the line laid
 * out reversed, code point by code point; inside U+202B RIGHT-TO-LEFT EMBEDDING and its pop U+202C, and inside U+2067
 * RIGHT-TO-LEFT ISOLATE and its pop U+2069, its runs reversed — the line laid out with its runs reversed. Each line holds
 * one family's controls and no other's, so a chooser that reads that family away, and no other, leaves its candidate
 * free; and read in logical order, none is a candidate.
 */
const LAID_OUT_LINES = [
	(n: number): string => `\u202e${writtenBackwards(n)}`,
	(n: number): string => `\u202b${runsBackwards(n)}\u202c`,
	(n: number): string => `\u2067${runsBackwards(n)}\u2069`
] as const;
/** `BREAKS_ACCOUNT`'s two tokens: a process result's view's own, then its prompt's (a graph's and a work product's
 *  prompt is fenced by the first) — past the nine candidates each of the four fields holds. ~~`24` and `25`, past six
 *  each~~ — before each field held a line of each layout (`LAID_OUT_LINES`). */
const BREAKS_TOKENS = [36, 37] as const;
/**
 * ⭐⭐ AN ACCOUNT EACH FIELD OF WHICH IS READ AS THE PROMPT CARRIES IT, AND NO OTHER WAY (design §9.3 D7; `REG-F-481`):
 * the prose raw, each list its items after `  - `, one to a line. ⛔ Every plant in an account slice was read by every
 * reading of it, and none was split by a break, so a chooser that read a field OTHERWISE — a list as one line of JSON
 * again (the encoder D7 retired), U+2028, U+0085 or U+2029 read as a line feed, in a list or in the prose — moved no
 * probe (driven on a disposable copy). Each field — the prose, then each list, in the fields' order — holds nine
 * candidates, `00` to `35` across the four fields, and:
 *   · its first six (~~`00` to `23` across the four fields~~ `00` to `05`, `09` to `14`, `18` to `23` and `27` to
 *     `32`), each split between its digits by one of the six
 *     terminators a reader may not break at, in `UNBROKEN`'s order — READ, each terminator reading as nothing too: so
 *     a chooser that reads one as a line feed, or reads the field as JSON (which escapes all six), finds that
 *     candidate free;
 *   · ⭐ its last three (`06` to `08` in the prose, `15` to `17`, `24` to `26` and `33` to `35` in the lists), each on a
 *     line of its own that one layout the reader states lays out (`LAID_OUT_LINES`: under an override, written
 *     backwards; inside an embedding, and inside an isolate, its runs reversed) — READ, a line holding a bidi control
 *     being read laid out too: so a chooser that reads the field with its bidi controls read away, or one family of
 *     them (the override; the embedding and its pop; the isolate and its pop), finds that line's candidate free. They
 *     stand LAST, the isolate's line the field's last line (in a list, its last item), so a chooser that reads a field
 *     without its last line finds that candidate free too. ⛔ The one line a control laid out held no candidate, so a
 *     chooser that read a field with every bidi control read away — in every framing, or in a graph's or a work
 *     product's review alone — moved no probe (driven: a work product's lists so, and a graph's prose);
 *   · each of `BREAKS_TOKENS` split by a LINE FEED — in a list, an item holding a line feed (D7's stated ambiguity) —
 *     and written backwards on a line of its own below a line U+202E lays out, and, in a list, astride two items —
 *     NOT READ, since a line feed breaks every line, a line with no bidi control is not laid out, and two items are
 *     two lines: so a chooser that reads the field's line feeds away, or reads it on one line (as JSON), or reads a
 *     list's items joined, finds the token it chose, and chooses another.
 * ⚠ Within `RATIONALE_MAX`, so no field is cut: each is read whole, as the prompt carries it.
 */
const BREAKS_ACCOUNT: ProfessionalRationaleSummary = (() => {
	const field = (first: number, line: string): string[] => [
		...UNBROKEN.map((split, i) => splitBy(first + i, split)),
		...BREAKS_TOKENS.map((n) => splitBy(n, '\n')),
		`\u202e${line}`,
		...BREAKS_TOKENS.map(writtenBackwards)
	];
	const astride = (before: string, after: string): string[] =>
		BREAKS_TOKENS.flatMap((n) => [`${before} ${candidate(n).slice(0, 14)}`, `${candidate(n).slice(14)} ${after}`]);
	/** The field's laid-out lines, its last: the candidates after its six, one on a line of each layout. */
	const laidOut = (first: number): string[] => LAID_OUT_LINES.map((line, i) => line(first + UNBROKEN.length + i));
	const prose = [
		'The survey is split into a desk study and a visual inspection.',
		...field(0, 'The desk study is read first.'),
		...laidOut(0)
	];
	return {
		rationale: prose.join('\n'),
		assumptions: [
			...field(9, 'The toe of the wall is reachable.'),
			...astride('The survey day is fixed by', 'the tide table.'),
			...laidOut(9)
		],
		limitations: [
			...field(18, 'No intrusive investigation was made.'),
			...astride('The backfill was not', 'sampled.'),
			...laidOut(18)
		],
		residualUncertainty: [
			...field(27, 'Drainage behind the wall is not observable.'),
			...astride('The weep holes', 'may be blocked.'),
			...laidOut(27)
		]
	};
})();

/**
 * ⭐ A RUN THE HOST WATCHED, with the port's stream names (`REG-F-487`) — every process-result probe's run starts here,
 * and each branch probe states the one field its branch turns on. `ordinal` and `retention` render nowhere.
 */
const run = (fields: Partial<ObservedProcessRun> = {}): ObservedProcessRun => ({
	ordinal: 1,
	argv: ['python', '-m', 'pytest', '-rs', 'survey/checks/'],
	exitCode: 0,
	timedOut: false,
	durationMs: 4210,
	outputComplete: true,
	omittedRegions: [],
	retention: { retained: false, notRetainedBecause: 'a fingerprint probe: no capture is read' },
	stdout: CLEAN_STDOUT,
	stderr: '',
	...fields
});

/** A failing suite, as production sees one: the failure and the counts on stdout, a warning on stderr. */
const PRODUCTION_RUN = run({
	exitCode: 1,
	durationMs: 4381,
	stdout:
		'survey/checks/test_panels.py ........F................................. [100%]\n\n' +
		'=================================== FAILURES ===================================\n' +
		'_____________________________ test_bulge[panel-9] ______________________________\n' +
		'    def test_bulge(panel):\n>       assert panel.bulge_mm <= 25\nE       assert 31 <= 25\n\n' +
		'survey/checks/test_panels.py:41: AssertionError\n' +
		'=========================== short test summary info ============================\n' +
		'FAILED survey/checks/test_panels.py::test_bulge[panel-9] - assert 31 <= 25\n' +
		'1 failed, 41 passed in 4.38s\n',
	stderr: 'PytestUnknownMarkWarning: Unknown pytest.mark.drainage\n'
});

/** What production's host reports for a step that ran one command: one call it minted, completed. */
const ONE_CALL: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }],
	observedCount: 1,
	recordedLimit: 32
};
const OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [
		{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' },
		{ ordinal: 2, nameProvenance: 'NOT_MINTED', outcome: 'FAILED' },
		{ ordinal: 3, nameProvenance: 'NOT_MINTED', toolName: 'write_file', outcome: 'REFUSED' }
	],
	observedCount: 40,
	recordedLimit: 3
};
/**
 * A call list long enough that the scaffolding alone overruns the budget — the content falls to `CONTENT_MIN`.
 * ⚠ AN IMPOSSIBLE INPUT, ON PURPOSE (as `CALLS_AT_CONTENT_MIN` below): see there.
 */
const OVERSIZE_OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: Array.from({ length: 400 }, (_, i) => ({
		ordinal: i + 1,
		nameProvenance: 'MINTED_BY_HOST' as const,
		toolName: 'run_command',
		outcome: 'COMPLETED' as const
	})),
	observedCount: 400,
	recordedLimit: 400
};
/**
 * A call list long enough that the scaffolding ALONE passes `PROMPT_BUDGET`, so the content budget is `CONTENT_MIN`
 * whatever the other slices hold — derived from the budget, as every oversize length here is (no call line is shorter
 * than 25 characters).
 *
 * ⚠ AN IMPOSSIBLE INPUT, ON PURPOSE. The host records at most `OBSERVED_TOOL_CALL_LIMIT` (32) calls of a turn
 * (`@janumipwb/rph-contracts`; `governedToolCallReport`), and a prompt carrying this list is longer than
 * `PROMPT_BUDGET`. No process result in production's shape reaches `CONTENT_MIN`: with 32 calls at the name bound, the
 * instruction, the account and the rubric at their limits, and no narration and no prior (production sends neither),
 * the scaffolding still leaves the content more. So the probes held there hash that branch, and the cuts it fixes,
 * through an input production cannot build — deliberately: there the room is a constant of the budget object, never
 * moved by the scaffolding. The fingerprint test holds all three facts.
 */
const CALLS_AT_CONTENT_MIN: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: Array.from({ length: Math.ceil(B.PROMPT_BUDGET / 25) }, (_, i) => ({
		ordinal: i + 1,
		nameProvenance: 'MINTED_BY_HOST' as const,
		toolName: 'run_command',
		outcome: 'COMPLETED' as const
	})),
	observedCount: Math.ceil(B.PROMPT_BUDGET / 25),
	recordedLimit: Math.ceil(B.PROMPT_BUDGET / 25)
};
// ~~`processResult` — a literal `ReasoningReviewInput` with `content: COMMAND_RESULT` and a narration production never
// sends~~ (`PQ-1`, D3: five of the seven old probes sent a narration and two sent prior gaps; production sends neither).

/** `R15`'s two halves, as a probe hands them to the builder: the agent's account and the host's observation, each optional. */
interface R15Halves {
	readonly rationale?: ProfessionalRationaleSummary;
	readonly observedToolCalls?: ObservedToolCallReport;
}
/** What production's branch probes carry: the account declared, and the one call its host observed. */
const PRODUCTION_HALVES: R15Halves = { rationale: RATIONALE, observedToolCalls: ONE_CALL };

/**
 * ⭐ A PROCESS-RESULT PROBE IN PRODUCTION'S SHAPE — exactly what `runProcessResultFloor` hands the builder: the
 * instruction, the run, the account and the host's observation of the session's last turn, and NO narration and NO
 * prior (`review-input.test.ts` holds the floor to that byte for byte). The branch probes are built so, so each renderer
 * branch is hashed as the reviewer of a production process result reads it.
 */
const asProduction = (
	criteria: readonly AssessmentCriterion[],
	build: ProcessResultBuilder,
	observed: ObservedProcessRun,
	halves: R15Halves = PRODUCTION_HALVES
): ReasoningReviewInput => build({ criteria, producingPrompt: SURVEY_INSTRUCTION, run: observed, ...halves });

/**
 * ⭐ THE PROBE SET, in a fixed order — the order, like each prompt, is part of what is hashed (`probes` hashes the list of
 * `[id, sha256(prompt)]` pairs in this order, then the skeleton's digest, then the reader corpus's tokens). Since
 * `PQ-1` (design D3) it is: ~~G-BARE, G-DECLARED, G-PRIOR, G-OVERSIZE-CONTENT, G-OVERSIZE-ALL, G-OVERSIZE-FENCES,
 * G-OVERSIZE-LISTS, G-NO-FENCE, G-STAKES, G-ACCOUNT-BREAKS;~~ ⭐ B7: T-LEAF, T-COMPOSITE, T-ROOT, T-OVERSIZE-CHILDREN,
 * T-ABSENT-FIELDS, T-SUBJECT-REFUSED, T-OVERSIZE-ALL, T-OVERSIZE-FENCES, T-OVERSIZE-LISTS, T-NO-FENCE, T-STAKES,
 * T-ACCOUNT-BREAKS; W-BARE, W-DECLARED-PRIOR, W-OVERSIZE-CONTENT,
 * W-OVERSIZE-ALL, W-OVERSIZE-EDGES, W-FENCES, W-OVERSIZE-LISTS, W-NO-FENCE, W-STAKES, W-ACCOUNT-BREAKS; P-CLEAN,
 * P-SIGNAL, P-TIMED-OUT, P-INCOMPLETE-CAPTURE, P-STDOUT-CAPTURE-CUT, P-STDERR-CAPTURE-CUT, P-OVERSIZE-CONTENT,
 * P-OVERSIZE-COMMAND, P-OVERSIZE-SURROGATE, P-OVERSIZE-ROOM-EDGES, P-OVERSIZE-STREAMS, P-OVERSIZE-AT-ITS-BUDGET,
 * P-OVERSIZE-FENCES, P-OVERSIZE-LISTS, P-FENCE-AT-THE-LAST, P-NO-FENCE, P-PRODUCTION, P-ABSENT-REPORT,
 * P-NOT-OBSERVABLE, P-NOT-OBSERVABLE-BARE, P-NONE-OBSERVED, P-OBSERVED, P-OVERSIZE-ALL, P-FENCES-OTHER-SLICES,
 * P-STAKES, P-ACCOUNT-BREAKS; NO-CRITERIA — forty-seven, every process-result one `P-`-prefixed.
 * ~~⭐ Package P F1 (`REG-F-503` remedy 1) — and, after G-ACCOUNT-BREAKS, G-TYPE-DECLARATIONS, G-TYPE-DECLARATIONS-ABSENT and
 * G-OVERSIZE-TYPE-DECLARATIONS.~~ ⭐ B7 — the graph framing's probes left the fingerprint with case set v8; NO-CRITERIA is a
 * part's now.
 */
export const FINGERPRINT_PROBES: readonly FingerprintProbe[] = [
	// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 (`REG-D-125`; DESIGN-authoring-review-in-parts.md §5) — THE PART ARM,
	// through the builder the authoring floor is to review each type with (`pwaTypeReviewInput`), over parts cut by the product's
	// own `pwaTypeParts`. ⛔ The graph arm's probes LEFT the fingerprint with case set v8, which holds no graph case (design
	// D4: "Remove its fingerprint probes when the current case set holds zero `PWA_GRAPH` cases"): ~~G-BARE, G-DECLARED,
	// G-PRIOR, G-OVERSIZE-CONTENT, G-OVERSIZE-ALL, G-OVERSIZE-FENCES, G-OVERSIZE-LISTS, G-NO-FENCE, G-STAKES, G-ACCOUNT-BREAKS,
	// G-TYPE-DECLARATIONS, G-TYPE-DECLARATIONS-ABSENT, G-OVERSIZE-TYPE-DECLARATIONS~~. Each shared control they held is held
	// here in the part framing instead, and the design's five part probes stand beside them.
	{
		// ⭐ Design §5 — A LEAF WITH A PROMPT: its whole definition the subject, its ACTIVE template's text and output contract
		// among it; the account declared, with an empty list; the narration; a candidate subject hash.
		id: 'T-LEAF',
		covers:
			'part framing; a LEAF with an ACTIVE prompt and its output contract; its ancestors, its parent’s rule and its artifacts’ peers as context; rationale declared, with an empty list; narration; a candidate subject hash',
		input: (criteria) =>
			pwaTypeReviewInput({
				criteria,
				prompt: INTENT,
				part: partOf(PART_NODES, PANEL_ID),
				candidateSubjectHash: 'a3f1c9e07b52d846',
				rationale: RATIONALE,
				narration: NARRATION
			})
	},
	{
		// ⭐ Design §5 — A COMPOSITE WITH ITS CHILDREN'S SKELETONS AND DATA FLOW: a middle composite, its children's skeletons
		// (a DRAFT template among them, kept to its status and version), the flow among them and across its boundary; the
		// account NOT DECLARED, the narration absent, prior gaps present.
		id: 'T-COMPOSITE',
		covers:
			'part framing; a middle COMPOSITE — its children’s skeletons, a conditional child rule, and the data flow among its children and across its subtree’s boundary; rationale NOT DECLARED; narration absent; prior gaps present',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(PART_NODES, FIELDWORK_ID), priorGaps: GAPS })
	},
	{
		// ⭐ Design §5 — THE ROOT WITH THE PRODUCER'S ACCOUNT: the PWA's name, domain and description on its subject, a delegated
		// child's boundary contract and context specification in its skeleton, the account and the narration.
		id: 'T-ROOT',
		covers:
			'part framing; the ROOT with the producer’s account and narration — the PWA’s name, domain and description in its subject, its stored completion rule, and a delegated child carrying its boundary contract and context specification',
		input: (criteria) =>
			pwaTypeReviewInput({
				criteria,
				prompt: INTENT,
				part: partOf(PART_NODES, ROOT_ID, PWA_DESCRIBED),
				rationale: RATIONALE,
				narration: NARRATION
			})
	},
	{
		// ⭐ Design §5 — AN OVER-BUDGET CHILDREN'S-SKELETON VIEW WITH CHILD-SPECIFIC CUT DECLARATIONS: its builder cuts each
		// child's skeleton to a share and declares each cut by the child's ordinal and type id (A2 (3)), the subject whole.
		id: 'T-OVERSIZE-CHILDREN',
		covers:
			'part framing; a composite over its room — its children’s skeletons cut child by child by its builder, each cut declared by the child’s ordinal and type id, its subject and context whole',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(WIDE_NODES, ROOT_ID) })
	},
	{
		// ⭐ Design §5 — ABSENT FIELDS: the root carrying each declared field EMPTY, as authored, and giving its child no rule; the
		// child carrying none of them; the PWA storing no description. The two must read differently.
		id: 'T-ABSENT-FIELDS',
		covers:
			'part framing; the ABSENT-FIELD CONTROL — a subject carrying each declared field empty, as authored (no purpose, no policy, no child rule, an empty output contract), beside a child carrying none of them, the PWA with no description',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(EMPTY_AND_ABSENT_NODES, ROOT_ID) })
	},
	{
		// ⭐ The full-subject refusal (design D3): a type whose own definition no prompt can hold is refused as incomplete, never
		// cut — hashed as the refusal (`fingerprint.ts` `probePrompt`), so a validator that cut a part instead moves `probes`.
		id: 'T-SUBJECT-REFUSED',
		covers:
			'part framing; a REFUSAL — a subject longer than the room the prompt leaves it, refused as incomplete before any prompt: hashed as the statement and the part',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(HUGE_NODES, ROOT_ID) })
	},
	{
		// ⭐ Every bounded slice beside the part oversize at once — the request, the rubric, the prior findings, the rationale and
		// the narration (`OVERSIZE_*`); the part itself is never cut by the validator, so it stays within its room.
		id: 'T-OVERSIZE-ALL',
		covers: 'part framing; every bounded slice oversize at once — request, rubric, prior, rationale, narration — the part within its room',
		input: (criteria) =>
			pwaTypeReviewInput({
				criteria: oversizeCriteria(criteria),
				prompt: OVERSIZE_INTENT,
				part: partOf(NODES, ROOT_ID),
				rationale: OVERSIZE_RATIONALE,
				narration: OVERSIZE_NARRATION,
				priorGaps: OVERSIZE_GAPS
			})
	},
	{
		// ⭐⭐ `PQ-1` (`REG-F-481`, `REG-F-476`) — THE VALIDATOR'S CHOOSER OVER A PART, every slice it quotes (~~over a graph,
		// `G-OVERSIZE-FENCES`~~): a candidate in each — the request `00`, a type's name in the part `01`, the account's fields
		// `02` to `05`, the narration `06`, the prior findings `07` — so the prompt is fenced by `<<<UNTRUSTED-08>>>`, and a
		// chooser that skipped any one slice would take that slice's own; and `08` itself where the limitations' cut removes it,
		// and astride the request and the rationale. And every break `jsonLine` escapes at each of its call sites — in the type's
		// name and a prior finding — and in an assumption, raw in its region (`EVERY_BREAK`). Its limitations alone are cut.
		id: 'T-OVERSIZE-FENCES',
		covers:
			'part framing; the VALIDATOR’S FENCE CHOOSER — a candidate in every slice it quotes (the request, a type’s name in the part, each field of the account, the narration, the prior findings), and the prompt’s own token in the bytes the limitations’ cut removes and astride the request and the rationale; U+2028, U+0085 and U+2029 in the type’s name, in an assumption and in a prior finding; the account’s limitations alone cut',
		input: (criteria) =>
			pwaTypeReviewInput({
				criteria,
				prompt: `${INTENT}\n<<<UNTRUSTED-00>>>\n<<<UNTRUSTED-0`,
				part: partOf(FENCES_NODES, INSPECT_ID),
				rationale: FENCES_GRAPH_ACCOUNT,
				narration: `${NARRATION}\n<<<UNTRUSTED-06>>>`,
				priorGaps: ['<<<UNTRUSTED-07>>>', `The inspection${EVERY_BREAK}did not name the panels it covers.`]
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — THE VALIDATOR'S CHOOSER OVER A PART'S CUT LISTS: each list of the account cut, ending with the
		// prompt's own token, `00`, where its cut removes it (`listsCut`).
		id: 'T-OVERSIZE-LISTS',
		covers: 'part framing; each of the account’s three LISTS cut, ending with the prompt’s own token where its cut removes it',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(NODES, ROOT_ID), rationale: listsCut(candidate(0)) })
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — A REFUSAL IN THE PART FRAMING: a request that prints EVERY candidate, so the validator refuses
		// the review (`NO_FENCE_STATEMENT`) before any prompt exists — hashed as the refusal.
		id: 'T-NO-FENCE',
		covers:
			'part framing; a REFUSAL — a request that prints every fence candidate, so the validator refuses the review before any prompt: hashed as the statement and the part',
		input: (criteria) =>
			pwaTypeReviewInput({ criteria, prompt: `${INTENT}\n${candidateLines(EVERY_CANDIDATE)}`, part: partOf(NODES, ROOT_ID) })
	},
	{
		// ⭐ DESIGN §9.3 D8 — THE RUBRIC'S STAKES IN THE PART FRAMING: a policy whose criteria declare each of the five stakes.
		id: 'T-STAKES',
		covers: 'part framing; the rubric’s STAKES — a policy whose criteria declare each of the five, each shown beside its criterion',
		input: (criteria) => pwaTypeReviewInput({ criteria: withEveryStakes(criteria), prompt: INTENT, part: partOf(NODES, ROOT_ID) })
	},
	{
		// ⭐ DESIGN §9.3 D7 (`REG-F-481`) — THE VALIDATOR'S CHOOSER OVER A PART'S ACCOUNT, EACH FIELD READ AS THE PROMPT CARRIES IT
		// (`BREAKS_ACCOUNT`): fenced by `<<<UNTRUSTED-36>>>`, past the thirty-six candidates its four fields hold.
		id: 'T-ACCOUNT-BREAKS',
		covers:
			'part framing; the VALIDATOR’S FENCE CHOOSER over each field of the account as the prompt carries it — in each, a candidate split by each line terminator a reader may not break at, a candidate on a line of each layout the reader states (an override, an embedding, an isolate), the field’s last lines, and the prompt’s own token split by a line feed (in a list, an item holding one), written backwards below a line a bidi control lays out, and astride two items',
		input: (criteria) => pwaTypeReviewInput({ criteria, prompt: INTENT, part: partOf(NODES, ROOT_ID), rationale: BREAKS_ACCOUNT })
	},
	// ── the work-product arm, through the builder the work-product floor uses ──
	{
		id: 'W-BARE',
		covers: 'work-product framing; rationale NOT DECLARED; no prior gaps',
		input: (criteria) => workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: ANSWER })
	},
	{
		id: 'W-DECLARED-PRIOR',
		covers: 'work-product framing; rationale declared; prior gaps present',
		input: (criteria) =>
			workProductReviewInput({
				criteria,
				producingPrompt: PRODUCING_PROMPT,
				answer: ANSWER,
				rationale: RATIONALE,
				priorGaps: GAPS
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — its answer opens with the first candidate, in the kept HEAD of its cut: ⛔ no probe held a
		// candidate in a cut content, so a validator chooser that skipped a cut content and fenced the prompt with a token the
		// content holds moved no probe (driven on a disposable copy). ~~as `G-OVERSIZE-CONTENT`'s root type is named with it~~
		// — B7: the graph framing's probes left the fingerprint.
		id: 'W-OVERSIZE-CONTENT',
		covers: 'work-product framing; only the content oversize, the kept HEAD of its cut holding the first fence candidate',
		input: (criteria) =>
			workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: `<<<UNTRUSTED-00>>>\n${OVERSIZE_ANSWER}` })
	},
	{
		id: 'W-OVERSIZE-ALL',
		covers: 'work-product framing; every slice oversize at once — instruction, rubric, prior, rationale, content',
		input: (criteria) =>
			workProductReviewInput({
				criteria: oversizeCriteria(criteria),
				producingPrompt: OVERSIZE_INTENT,
				answer: OVERSIZE_ANSWER,
				rationale: OVERSIZE_RATIONALE,
				priorGaps: OVERSIZE_GAPS
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-480`, `REG-F-483`) — A HEAD-ONLY CUT AT ITS TWO EDGES: an instruction of EXACTLY `USER_INTENT_MAX`
		// units, shown whole and undeclared, and an answer of astral characters past `CONTENT_MAX`, whose kept HEAD is
		// declared in CODE POINTS — half its UTF-16 units. So a cut that took a slice AT its limit, or counted units, moves
		// this probe (the fingerprint test holds both edges).
		id: 'W-OVERSIZE-EDGES',
		covers:
			'work-product framing; a head-only cut at its two edges — the instruction EXACTLY at USER_INTENT_MAX, shown whole; an astral answer over CONTENT_MAX, its kept HEAD counted in code points',
		input: (criteria) =>
			workProductReviewInput({
				criteria,
				producingPrompt: filled('Write the condition survey summary for the retaining wall, panel by panel. ', B.USER_INTENT_MAX),
				answer: BRICK.repeat(B.CONTENT_MAX)
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — THE VALIDATOR'S CHOOSER OVER A WORK PRODUCT, every slice it quotes: a candidate in each —
		// the instruction `00`, the answer `01`, the account's fields `02` to `05` (`FENCES_WORK_PRODUCT_ACCOUNT`), the
		// prior findings `06` — so the prompt is fenced by `<<<UNTRUSTED-07>>>`, and a chooser that skipped any one slice,
		// in this framing alone or in every one, would take that slice's own. ⭐ AND `07` ITSELF ASTRIDE THE INSTRUCTION
		// AND THE ANSWER: the instruction ends with its first half, the answer begins with the rest — no line a reader
		// sees, since the prompt sets host lines between any two slices — so a chooser that read its slices joined would
		// find it, and choose another (design D2 under the sponsor's answer (a)). ~~a candidate in the instruction and one
		// in the answer, the prompt fenced by `02`~~ — a chooser that skipped a work product's account or its prior
		// findings, and no other framing's, moved no probe (driven on a disposable copy).
		id: 'W-FENCES',
		covers:
			'work-product framing; the VALIDATOR’S FENCE CHOOSER — a candidate in every slice it quotes (the instruction, the answer, each field of the account, the prior findings), and the prompt’s own token astride the instruction and the answer',
		input: (criteria) =>
			workProductReviewInput({
				criteria,
				producingPrompt: `${PRODUCING_PROMPT}\n<<<UNTRUSTED-00>>>\n<<<UNTRUSTED-0`,
				answer: `7>>>\n${ANSWER}\n<<<UNTRUSTED-01>>>`,
				rationale: FENCES_WORK_PRODUCT_ACCOUNT,
				priorGaps: [candidate(6)]
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — THE VALIDATOR'S CHOOSER OVER A WORK PRODUCT'S CUT LISTS: as `T-OVERSIZE-LISTS`, in this
		// framing.
		id: 'W-OVERSIZE-LISTS',
		covers: 'work-product framing; each of the account’s three LISTS cut, ending with the prompt’s own token where its cut removes it',
		input: (criteria) =>
			workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: ANSWER, rationale: listsCut(candidate(0)) })
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — A REFUSAL IN THE WORK-PRODUCT FRAMING: an answer that prints EVERY candidate, so the
		// validator refuses the review (`NO_FENCE_STATEMENT`) before any prompt exists — hashed as the refusal
		// (`fingerprint.ts` `probePrompt`), so a validator that failed closed for a process result alone, and SENT this,
		// moves `probes`.
		id: 'W-NO-FENCE',
		covers:
			'work-product framing; a REFUSAL — an answer that prints every fence candidate, so the validator refuses the review before any prompt: hashed as the statement and the content',
		input: (criteria) =>
			workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: candidateLines(EVERY_CANDIDATE) })
	},
	{
		// ⭐ DESIGN §9.3 D8 — THE RUBRIC'S STAKES IN THE WORK-PRODUCT FRAMING: `W-BARE` over a policy whose criteria declare
		// each of the five stakes (`withEveryStakes`).
		id: 'W-STAKES',
		covers: 'work-product framing; the rubric’s STAKES — a policy whose criteria declare each of the five, each shown beside its criterion',
		input: (criteria) =>
			workProductReviewInput({ criteria: withEveryStakes(criteria), producingPrompt: PRODUCING_PROMPT, answer: ANSWER })
	},
	{
		// ⭐ DESIGN §9.3 D7 (`REG-F-481`) — THE VALIDATOR'S CHOOSER OVER A WORK PRODUCT'S ACCOUNT, EACH FIELD READ AS THE
		// PROMPT CARRIES IT: as `T-ACCOUNT-BREAKS`, in this framing.
		id: 'W-ACCOUNT-BREAKS',
		covers:
			'work-product framing; the VALIDATOR’S FENCE CHOOSER over each field of the account as the prompt carries it — in each, a candidate split by each line terminator a reader may not break at, a candidate on a line of each layout the reader states (an override, an embedding, an isolate), the field’s last lines, and the prompt’s own token split by a line feed (in a list, an item holding one), written backwards below a line a bidi control lays out, and astride two items',
		input: (criteria) =>
			workProductReviewInput({ criteria, producingPrompt: PRODUCING_PROMPT, answer: ANSWER, rationale: BREAKS_ACCOUNT })
	},
	// ── ⭐⭐ the process-result arm, through the builder the process-result floor uses (`JAN-PRQUAL` `PQ-1`, design D3) ──
	// ~~no builder is factored for it (`REG-D-072` D17), so its input is literal~~ — each probe below is a RUN literal,
	// built by the `processResult` seam (the product's `processResultReviewInput`). FIRST, ONE PROBE PER BRANCH OF THE
	// RENDERER (`process-result-render.ts`), each in production's shape and each taking its branch and no other branch's
	// but what every view of its kind shares (the clean layout; a cut's HEAD and TAIL labels); then the probes that stand
	// where branches MEET or where a rule decides by one unit — `P-OVERSIZE-SURROGATE`, `P-OVERSIZE-ROOM-EDGES`,
	// `P-OVERSIZE-STREAMS` — which take several, by design (`verif/reviewer-qualification-fingerprint.test.ts` holds each
	// branch to the probes that take it, exactly but for the two every view of a kind shares: a change confined to the
	// branch moves them);
	{
		id: 'P-CLEAN',
		covers: 'process-result framing, production’s shape; the CLEAN branch — an exit code, a complete capture, every slice whole',
		input: (criteria, build) => asProduction(criteria, build, run())
	},
	{
		id: 'P-SIGNAL',
		covers: 'process-result framing, production’s shape; the SIGNAL branch — no exit code: terminated by a signal',
		input: (criteria, build) =>
			asProduction(criteria, build, run({ exitCode: null, durationMs: 2214, stdout: 'survey/checks/test_panels.py ..........' }))
	},
	{
		// ⚠ An exit CODE, not null: so this probe takes the timeout alone, never the signal branch as well. This host's own
		// timeout shape — exit null AND TIMED OUT, the runner's SIGKILL — is `P-OVERSIZE-STREAMS`'s, and the fingerprint
		// test holds each exit-line branch to the exact probes that take it.
		id: 'P-TIMED-OUT',
		covers: 'process-result framing, production’s shape; the TIMED OUT branch — the host’s timeout, with an exit code',
		input: (criteria, build) =>
			asProduction(criteria, build, run({ timedOut: true, exitCode: 1, durationMs: 120_000, stdout: 'survey/checks/test_drainage.py ....' }))
	},
	{
		id: 'P-INCOMPLETE-CAPTURE',
		covers: 'process-result framing, production’s shape; the INCOMPLETE CAPTURE branch — a descendant held the streams',
		input: (criteria, build) => asProduction(criteria, build, run({ outputComplete: false }))
	},
	{
		// ⚠ The kept prefix is SHORT here, though production's is 64 KiB: a probe is hashed, never read, and a 64 KiB prefix
		// would take the review-layer cut too, which `P-OVERSIZE-CONTENT` takes alone.
		// ⭐ `PQ-1` (`REG-F-480`) — AND IT ENDS IN AN ASTRAL CHARACTER, so the capture's declaration, which states the CODE
		// POINTS the capture kept, states one fewer than the stream's UTF-16 units: a count in units moves this probe.
		id: 'P-STDOUT-CAPTURE-CUT',
		covers:
			'process-result framing, production’s shape; a STDOUT CAPTURE CUT, declared in UTF-8 bytes before the slices, of a stream holding an astral character — its kept count in code points',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					stdout: `${CLEAN_STDOUT}${BRICK}\n`,
					omittedRegions: [{ stream: 'STDOUT', reason: CAPTURE_BOUND, byteSize: 18_432, byteOffset: 65_536 }]
				})
			)
	},
	{
		// ⭐ `PQ-1` (`REG-F-480`) — AND ITS STDERR ENDS IN AN ASTRAL CHARACTER, as `P-STDOUT-CAPTURE-CUT`'s stdout does: the
		// capture's declaration states the code points it kept of EITHER stream, so a count in units of either moves a probe.
		id: 'P-STDERR-CAPTURE-CUT',
		covers:
			'process-result framing, production’s shape; a STDERR CAPTURE CUT, declared in UTF-8 bytes before the slices, of a stream holding an astral character — its kept count in code points',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					exitCode: 1,
					stdout: 'survey/checks/test_panels.py .........F................................ [100%]\n1 failed, 41 passed in 4.40s\n',
					stderr: `E   AssertionError: panel 9 bulge 31 mm exceeds 25 mm\n${BRICK}\n`,
					omittedRegions: [{ stream: 'STDERR', reason: CAPTURE_BOUND, byteSize: 2_048, byteOffset: 65_536 }]
				})
			)
	},
	{
		// ⭑ The id is the old content-only probe's: what is oversize is still the content alone — now cut by the BUILDER,
		// HEAD and TAIL, declared before both, and never by the validator (design D2).
		id: 'P-OVERSIZE-CONTENT',
		covers: 'process-result framing, production’s shape; a REVIEW-LAYER HEAD-AND-TAIL CUT of stdout — only the content oversize',
		input: (criteria, build) => asProduction(criteria, build, run({ stdout: OVERSIZE_STDOUT }))
	},
	{
		id: 'P-OVERSIZE-COMMAND',
		covers: 'process-result framing, production’s shape; a LONG COMMAND LINE, cut HEAD and TAIL as argv’s JSON array',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					argv: [
						'python',
						'-m',
						'pytest',
						'-rs',
						// ⭐ `PQ-1` (`REG-F-481`) — its MIDDLE argument the first candidate, which the cut removes: the token the view
						// takes today, so a chooser that read the command line uncut would choose another.
						...Array.from({ length: Math.ceil((B.CONTENT_MAX + 500) / 25) }, (_, i) => `survey/checks/p${String(i).padStart(4, '0')}.py`)
							.map((a, i, all) => (i === Math.floor(all.length / 2) ? '<<<UNTRUSTED-00>>>' : a))
					]
				})
			)
	},
	{
		// ⭐ A PAIR ASTRIDE THE CUT AT BOTH ENDS: the HEAD gives back a high surrogate and the TAIL steps past a low one. Where
		// a cut falls is fixed by the room the slice is given, so the call list holds the content budget at `CONTENT_MIN`
		// — a constant of the budget object — and the room is then the run's and the renderer's alone, never moved by the
		// scaffolding. Both ends straddle when what is kept of the stdout is 1 mod 4 UTF-16 units (3537 today: the HEAD
		// asks for 1769 and gives one back, the TAIL is asked for 1769 and steps past one). ⚠ A renderer change can move
		// that parity: the fingerprint test asserts BOTH half pairs given back, and a stderr of n characters moves it by n.
		// ⭐ `PQ-1` (`REG-F-480`) — AND ITS CODE POINTS AND ITS UNITS DIFFER IN DIGIT COUNT (`SURROGATE_POINTS`), so a cut
		// layout that reserved its widest declaration in units moves it.
		// ⚠ AN IMPOSSIBLE INPUT, ON PURPOSE (`CALLS_AT_CONTENT_MIN`): more calls than production records, a prompt over
		// `PROMPT_BUDGET`.
		id: 'P-OVERSIZE-SURROGATE',
		covers:
			'process-result framing; a SURROGATE PAIR ASTRIDE A CUT, at the HEAD and at the TAIL, of a stream whose code points and UTF-16 units differ in digit count; the content at CONTENT_MIN, through an impossible input — more calls than production’s 32, a prompt over PROMPT_BUDGET',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({ stdout: BRICK.repeat(SURROGATE_POINTS) }),
				{ rationale: RATIONALE, observedToolCalls: CALLS_AT_CONTENT_MIN }
			)
	},
	{
		// ⭐ THE TWO EDGES OF A SLICE'S ROOM, where a cut rule decides by one unit — so a change to either rule moves a view
		// only on its edge, and no other probe stands on one. Held at `CONTENT_MIN` by the same call list as
		// `P-OVERSIZE-SURROGATE` (an impossible input, on purpose), so each room is the run's and the renderer's alone:
		//   · STDOUT — a pair astride its HEAD only, its TAIL in ASCII. The unit the HEAD gives back goes to the TAIL
		//     (`shownWithin`), so the TAIL holds one unit more than half of what is kept; a TAIL asked for half instead keeps
		//     one fewer. The HEAD straddles when ⌈k/2⌉ is odd, k the units kept (1657 today: the HEAD asks 829, keeps 828).
		//   · STDERR — two units past fitting whole between its fence lines (`STDERR_AT_ITS_EDGE`). The whole-fit test
		//     counts the fence lines, so it is cut; a test that forgot them would show it whole — still within the budget,
		//     by the digits stdout's declaration does not need — and the fence lines would overrun its room.
		// ⚠ A renderer change can move either edge: the fingerprint test asserts both, and says how to re-tune.
		id: 'P-OVERSIZE-ROOM-EDGES',
		covers:
			'process-result framing; the EDGES OF A ROOM — stdout with a pair astride its HEAD only, the unit given back going to an ASCII TAIL; stderr two units past fitting whole between its fence lines; the content at CONTENT_MIN, through an impossible input — more calls than production’s 32, a prompt over PROMPT_BUDGET',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					stdout: `${BRICK.repeat(6_000)}${filled('survey/checks/test_panels.py::test_bulge PASSED\n', 6_000)}`,
					stderr: filled('E   AssertionError: panel 9 bulge 31 mm exceeds 25 mm\n', STDERR_AT_ITS_EDGE)
				}),
				{ rationale: RATIONALE, observedToolCalls: CALLS_AT_CONTENT_MIN }
			)
	},
	{
		// ⭐ THIS HOST'S OWN TIMEOUT, AS PRODUCTION RECORDS IT, OVER STREAMS THAT FILLED THE CAPTURE. The runner's own
		// `child.kill('SIGKILL')` reports exit null (`child-process-runner.ts`), so the exit line carries the signal AND
		// the timeout; a descendant still held the streams; and BOTH streams filled the capture's 64 KiB and were cut there,
		// each declared on its own line as a capture cut whose TAIL is the end of what was CAPTURED. Both are then over
		// their share of the room, so two large slices split it — evenly, max-min — and stderr is cut at the review layer
		// as stdout is. In production's shape (one call, the account declared, no narration, no prior), so the content
		// budget is the scaffolding's, never `CONTENT_MIN`.
		id: 'P-OVERSIZE-STREAMS',
		covers:
			'process-result framing, production’s shape; this host’s own TIMEOUT (exit null, TIMED OUT); an INCOMPLETE CAPTURE with a CAPTURE CUT of each stream, whose TAIL is the end of what was captured; BOTH STREAMS cut at the review layer, splitting the room',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					exitCode: null,
					timedOut: true,
					durationMs: 120_000,
					outputComplete: false,
					stdout: CAPTURED_STDOUT,
					stderr: CAPTURED_STDERR,
					omittedRegions: [
						{ stream: 'STDOUT', reason: CAPTURE_BOUND, byteSize: 415_000, byteOffset: CAPTURE_CAP },
						{ stream: 'STDERR', reason: CAPTURE_BOUND, byteSize: 9_000, byteOffset: CAPTURE_CAP }
					]
				})
			)
	},
	{
		// ⭐ `PQ-1` (`REG-F-480`) — A VIEW THAT FILLS ITS BUDGET EXACTLY: every other cut view falls short of its budget by
		// the digits its declarations did not need, so a refusal that fired AT the budget rather than past it refused
		// nothing a probe sent. Here the command line, stdout and stderr are cut alike, each declaration as wide as the
		// widest the layout reserves (`SLICE_AT_FOUR_DIGITS`), so the view is its budget to the unit — sent today, and
		// refused, and so moved, by a refusal one unit early. In production's shape: one call, the account declared.
		id: 'P-OVERSIZE-AT-ITS-BUDGET',
		covers:
			'process-result framing, production’s shape; a view that fills its content budget EXACTLY — the command line, stdout and stderr each cut, each declaration as wide as the widest the layout reserves — on the edge of the validator’s refusal of a view over its budget',
		input: (criteria, build) =>
			asProduction(
				criteria,
				build,
				run({
					argv: [
						...AT_FOUR_DIGITS_ARGV_HEAD,
						filled('panel_9 or ', SLICE_AT_FOUR_DIGITS - JSON.stringify([...AT_FOUR_DIGITS_ARGV_HEAD, '']).length)
					],
					stdout: filled('survey/checks/test_panels.py::test_bulge[panel-9] PASSED\n', SLICE_AT_FOUR_DIGITS),
					stderr: filled('PytestUnknownMarkWarning: Unknown pytest.mark.drainage - is this a typo?\n', SLICE_AT_FOUR_DIGITS)
				})
			)
	},
	// …THEN THE FENCE CHOOSERS' PROBE, a candidate in every slice either chooser reads (`FENCE_PLANTS`);
	{
		// ⭐ IN PRODUCTION'S SHAPE — one call the host minted, the account declared, no narration, no prior — so the slices
		// the choosers read are the ones production's prompt carries. Its view's token is `<<<UNTRUSTED-19>>>` and its
		// prompt's `<<<UNTRUSTED-20>>>`, both pinned by the fingerprint test, beside a row for each rule of what the
		// view's chooser reads, one for each family of the skeleton's table and one for each rule of the reader its
		// chooser models — and `19` itself, and `20`, where no chooser may read them (`FENCE_UNREAD`).
		id: 'P-OVERSIZE-FENCES',
		covers:
			'process-result framing, production’s shape; the FENCE CHOOSERS — a candidate in every slice either reads (the instruction, each field of the account, argv, stdout’s HEAD and TAIL, stderr), each spelled through its own family of the skeleton’s table or its own rule of the reader (a line terminator a reader may not break at, a second reading, a line laid out reversed under an override and under an isolate, on its second line holding a control, mid-line, across a line separator, and with its runs reversed under an embedding; a candidate begun while another is open, and inside a reading), and the view’s own token where none may read it (the middle of stdout and the end of the assumptions, which their cuts remove; astride stdout’s cut, and astride stdout and stderr; split by a line feed; written backwards, and with its runs reversed, on a line with no bidi control) and the prompt’s at the end of the residual uncertainty, which its cut removes; U+2028, U+0085 and U+2029 in argv; an account with every field and an empty one, two of its fields tied over their share; stdout cut at the review layer',
		input: (criteria, build) =>
			build({
				criteria,
				producingPrompt: `${SURVEY_INSTRUCTION}\n${FENCE_PLANTS.instruction}\n${FENCE_PLANTS.readThroughItsClass}\n${FENCE_PLANTS.isolatedReversed}`,
				run: run({
					argv: ['python', '-m', 'pytest', '-rs', 'survey/checks/', '-k', FENCE_PLANTS.argv, `panel${EVERY_BREAK}nine`],
					// ⭐ The HEAD ends inside the first `UNSEEN` run and the TAIL begins inside the second, so the token's halves
					// stand astride the cut; and the second half of another begins stderr.
					stdout: `${FENCE_PLANTS.stdoutHead}\n${FENCE_UNREAD.firstHalf}${UNSEEN}${FENCE_UNREAD.removedMiddle}\n${UNSEEN}${FENCE_UNREAD.secondHalf}\n${FENCE_PLANTS.stdoutTail}\n${FENCE_UNREAD.firstHalf}`,
					stderr: [
						FENCE_UNREAD.secondHalf,
						FENCE_PLANTS.stderr,
						FENCE_PLANTS.splitByALineSeparator,
						FENCE_PLANTS.readTheSecondWay,
						FENCE_PLANTS.laidOutReversed,
						FENCE_PLANTS.onASecondLine,
						FENCE_PLANTS.reversedMidLine,
						FENCE_PLANTS.reversedAndSplit,
						FENCE_PLANTS.afterAFourthBracket,
						FENCE_PLANTS.insideAReading,
						FENCE_PLANTS.runsReversed,
						FENCE_UNREAD.splitByALineFeed,
						FENCE_UNREAD.backwardsWithNoControl,
						FENCE_UNREAD.runsReversedWithNoControl,
						''
					].join('\n')
				}),
				rationale: FENCES_ACCOUNT,
				observedToolCalls: ONE_CALL
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — BOTH CHOOSERS OVER A PROCESS RESULT'S CUT LISTS, in production's shape: each list of the
		// account cut, ending with the view's token, `00`, and then the prompt's, `01`, where its cut removes them
		// (`listsCut`) — so the view's chooser, or the validator's, that read any of them uncut would choose another. ⛔ No
		// process-result probe cut the limitations (driven on a disposable copy).
		id: 'P-OVERSIZE-LISTS',
		covers:
			'process-result framing, production’s shape; each of the account’s three LISTS cut, ending with the view’s token and the prompt’s where its cut removes them',
		input: (criteria, build) =>
			asProduction(criteria, build, run(), { rationale: listsCut(`${candidate(0)}${candidate(1)}`), observedToolCalls: ONE_CALL })
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — THE CHOOSER AT ITS LAST CANDIDATE: a stdout that prints every one but the last two
		// (`ALL_BUT_THE_LAST_TWO`), so the view is fenced by `<<<UNTRUSTED-98>>>` and the prompt by `<<<UNTRUSTED-99>>>`, the
		// last — and a chooser that tried any number of candidates short of a hundred would refuse a review sent today. In
		// production's shape. ~~`P-FENCE-PAST-TEN`, its prompt fenced by the twelfth~~ — a chooser that tried twelve to
		// ninety-nine candidates refused nothing it sent.
		id: 'P-FENCE-AT-THE-LAST',
		covers:
			'process-result framing, production’s shape; the FENCE CHOOSERS at their last candidate — a stdout that prints every candidate but the last two, so the view’s token is the ninety-ninth and the prompt’s the hundredth, the last',
		input: (criteria, build) =>
			asProduction(criteria, build, run({ stdout: `${candidateLines(ALL_BUT_THE_LAST_TWO)}${CLEAN_STDOUT}` }))
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`) — A REFUSAL: a stdout that prints EVERY candidate, so the view is rendered unfenced and the
		// validator, reading it whole, refuses the review (`NO_FENCE_STATEMENT`) before any prompt exists. Hashed as the
		// refusal — the statement and the view (`fingerprint.ts` `probePrompt`) — so a chooser that never failed closed,
		// and SENT it, moves `probes`; as `T-NO-FENCE` and `W-NO-FENCE` stand in the other two framings, so a validator
		// that failed closed in one framing alone moves it too. ⚠ It carries no account: what it hashes is the statement
		// and the view, never the account's lines, so an account here would be one no change to how an account is
		// rendered could move.
		id: 'P-NO-FENCE',
		covers:
			'process-result framing; a REFUSAL — a stdout that prints every fence candidate, so the view is rendered unfenced and the validator refuses the review before any prompt: hashed as the statement and the view',
		input: (criteria, build) =>
			asProduction(criteria, build, run({ stdout: candidateLines(EVERY_CANDIDATE) }), { observedToolCalls: ONE_CALL })
	},
	// …THEN ONE IN PRODUCTION'S EXACT SHAPE, over a run as production sees one — a failing suite, its failure on stdout,
	// a warning on stderr, one call observed, the account declared, no narration, no prior (held to that shape, key by
	// key, by the fingerprint test);
	{
		// ⭐ WRITTEN OUT, NOT THROUGH `asProduction`: this probe's shape IS the claim, so it is stated field by field.
		id: 'P-PRODUCTION',
		covers: 'process-result framing in production’s EXACT shape: no narration, no prior, OBSERVED with one call; a failing suite',
		input: (criteria, build) =>
			build({
				criteria,
				producingPrompt: SURVEY_INSTRUCTION,
				run: PRODUCTION_RUN,
				rationale: RATIONALE,
				observedToolCalls: ONE_CALL
			})
	},
	// …THEN THE OBSERVATION KINDS (`R15`) and the host's absent report, over the clean run, with no account — each kept
	// from version one, built through the builder now, and without the narration production never sends;
	{
		id: 'P-ABSENT-REPORT',
		covers: 'process-result framing; the host reported nothing about tool calls',
		input: (criteria, build) => asProduction(criteria, build, run(), {})
	},
	{
		id: 'P-NOT-OBSERVABLE',
		covers: 'process-result framing; NOT_OBSERVABLE, with a reason',
		input: (criteria, build) =>
			asProduction(criteria, build, run(), {
				observedToolCalls: { observation: 'NOT_OBSERVABLE', reason: 'the adapter ran the session headless' }
			})
	},
	{
		id: 'P-NOT-OBSERVABLE-BARE',
		covers: 'process-result framing; NOT_OBSERVABLE, with no reason',
		input: (criteria, build) => asProduction(criteria, build, run(), { observedToolCalls: { observation: 'NOT_OBSERVABLE' } })
	},
	{
		id: 'P-NONE-OBSERVED',
		covers: 'process-result framing; NONE_OBSERVED',
		input: (criteria, build) => asProduction(criteria, build, run(), { observedToolCalls: { observation: 'NONE_OBSERVED' } })
	},
	{
		id: 'P-OBSERVED',
		covers: 'process-result framing; OBSERVED — a minted name, an unnamed call, an unminted name, a declared cut',
		input: (criteria, build) => asProduction(criteria, build, run(), { rationale: RATIONALE, observedToolCalls: OBSERVED })
	},
	// …AND EVERY SLICE OVERSIZE AT ONCE, the builder's optional narration and prior gaps reaching the two slices
	// production never fills — one of the three probes held at `CONTENT_MIN`, and the one held there by a call list of
	// its own (`OVERSIZE_OBSERVED`): like the other two, an impossible input on purpose (`CALLS_AT_CONTENT_MIN`).
	// ⭐ `PQ-1` (`REG-F-481`) — AND THE VALIDATOR'S CHOOSER OVER THE THREE SLICES `P-OVERSIZE-FENCES` LEAVES EMPTY: a
	// candidate in the limitations (`02`) and in the kept HEAD of the narration (`03`) and of the prior findings (`04`),
	// past the instruction's `00` and the view's own `01` — so the prompt is fenced by `<<<UNTRUSTED-05>>>`, and a
	// chooser that skipped any of the three in a process result's review alone would take its own. ⛔ No process-result
	// probe planted in the limitations, so such a chooser moved no probe (driven on a disposable copy).
	{
		id: 'P-OVERSIZE-ALL',
		covers:
			'process-result framing; the VALIDATOR’S FENCE CHOOSER over the limitations, the narration and the prior findings, a candidate in each, and its own token at the end of each slice its prompt cuts; every slice oversize, and a call list that leaves the content CONTENT_MIN — an impossible input: more calls than production’s 32, a prompt over PROMPT_BUDGET',
		// ⭐ AND THE PROMPT'S OWN TOKEN, `05`, AT THE END OF EACH SLICE ITS PROMPT CUTS — the instruction, the rationale, the
		// narration and the prior findings, each after the view's `01` already there — so the validator's chooser that read
		// any of them uncut in a process result's review finds its own token. ⛔ The ends held the view's `01` alone, which
		// the view's fence lines carry anyway, so such a chooser moved no probe (driven on a disposable copy).
		input: (criteria, build) =>
			build({
				criteria: oversizeCriteria(criteria),
				producingPrompt: `${OVERSIZE_INTENT}\n${candidate(5)}`,
				run: run({ stdout: OVERSIZE_STDOUT }),
				rationale: {
					...OVERSIZE_RATIONALE,
					rationale: `${OVERSIZE_RATIONALE.rationale}\n${candidate(5)}`,
					limitations: [...OVERSIZE_RATIONALE.limitations, candidate(2)]
				},
				observedToolCalls: OVERSIZE_OBSERVED,
				narration: `${candidate(3)}\n${OVERSIZE_NARRATION}\n${candidate(5)}`,
				priorGaps: [candidate(4), ...OVERSIZE_GAPS, candidate(5)]
			})
	},
	{
		// ⭐ `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a)) — THE VIEW'S CHOOSER OVER THE THREE SLICES
		// `P-OVERSIZE-FENCES` LEAVES EMPTY: a candidate in the limitations (`01`), the narration (`02`) and the prior
		// findings (`03`), past the instruction's `00` — so the view is fenced by `<<<UNTRUSTED-04>>>` and the prompt by
		// `05`, and a view chooser that skipped any one of the three takes its own. ⛔ `P-OVERSIZE-ALL` planted there, but its
		// view is fenced by `01`, below every such plant, so a view chooser that skipped the limitations — which production
		// does send, and which D7 now shows one item to a line — moved no probe (driven on a disposable copy). Nothing is
		// cut; it carries a narration and a prior, as production never does.
		id: 'P-FENCES-OTHER-SLICES',
		covers:
			'process-result framing; the VIEW’S FENCE CHOOSER over the account’s limitations, the narration and the prior findings — a candidate in each below the view’s own token, past the instruction’s; nothing cut; a narration and a prior, which production never sends',
		input: (criteria, build) =>
			build({
				criteria,
				producingPrompt: `${SURVEY_INSTRUCTION}\n${candidate(0)}`,
				run: run(),
				rationale: { ...RATIONALE, limitations: [candidate(1)] },
				observedToolCalls: ONE_CALL,
				narration: candidate(2),
				priorGaps: [candidate(3)]
			})
	},
	{
		// ⭐ DESIGN §9.3 D8 — THE RUBRIC'S STAKES IN THE PROCESS-RESULT FRAMING: `P-CLEAN` over a policy whose criteria
		// declare each of the five stakes (`withEveryStakes`), in production's shape.
		id: 'P-STAKES',
		covers:
			'process-result framing, production’s shape; the rubric’s STAKES — a policy whose criteria declare each of the five, each shown beside its criterion',
		input: (criteria, build) => asProduction(withEveryStakes(criteria), build, run())
	},
	{
		// ⭐ DESIGN §9.3 D7 (`REG-F-481`) — BOTH CHOOSERS OVER A PROCESS RESULT'S ACCOUNT, EACH FIELD READ AS THE PROMPT
		// CARRIES IT (`BREAKS_ACCOUNT`), in production's shape: its view is fenced by ~~`<<<UNTRUSTED-24>>>`~~
		// `<<<UNTRUSTED-36>>>` and its prompt by ~~`<<<UNTRUSTED-25>>>`, past the twenty-four~~ `<<<UNTRUSTED-37>>>`, past
		// the thirty-six candidates the account's four fields hold — and each token stands where
		// only a field read otherwise holds it, so the view's chooser, or the validator's, that reads a field otherwise
		// chooses another.
		id: 'P-ACCOUNT-BREAKS',
		covers:
			'process-result framing, production’s shape; BOTH FENCE CHOOSERS over each field of the account as the prompt carries it — in each, a candidate split by each line terminator a reader may not break at, a candidate on a line of each layout the reader states (an override, an embedding, an isolate), the field’s last lines, and the view’s token and the prompt’s each split by a line feed (in a list, an item holding one), written backwards below a line a bidi control lays out, and astride two items',
		input: (criteria, build) =>
			asProduction(criteria, build, run(), { rationale: BREAKS_ACCOUNT, observedToolCalls: ONE_CALL })
	},
	// ── ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B4; `REG-F-553`'s class) — THE DECLARED-POLICY FRAMING ──────────────
	// ⛔ Without these, no probe reached the `DECLARED_POLICY` framing, so a change to what a declared review's reviewer reads
	// — its framing text, the policy line, a catalog policy's purpose or criteria — moved no fingerprint, and
	// `reviewer:qual:check` would stay green over a prompt nobody measured. One probe per catalog policy reaches each
	// policy's own line and rubric; then the root's shape (many work products, no account) and a cut of the work.
	...CATALOG_DECLARED_POLICIES.map(
		(catalogued): FingerprintProbe => ({
			id: `D-${catalogued.policyId}`,
			covers: `declared-policy framing; ${catalogued.policyId}'s own purpose and criteria the rubric; one work product, one command, the account declared`,
			input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
				const policy = declared.find((p) => p.policyId === catalogued.policyId) ?? catalogued;
				return declaredPolicyReviewInput({
					policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
					criteria: policy.criteria,
					instruction: PRODUCING_PROMPT,
					instructionIs: 'PRODUCING_PROMPT',
					workProducts: [{ unit: 'Condition Survey', answer: ANSWER }],
					commands: [{ unit: 'Condition Survey', argv: ['pytest', '-rs', 'survey/checks/'], exitCode: 0, timedOut: false }],
					rationale: RATIONALE
				});
			}
		})
	),
	{
		id: 'D-ROOT',
		covers:
			'declared-policy framing; a unit composed of others — its own PURPOSE the standard (E12F F4), its children’s two work products and their commands, one timed out and one with no exit code; no one producer’s account, and the host line that says so',
		input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
			const policy = declared[0]!;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: INTENT,
				// ⭐ `E12F` F4 — the root's instruction is its own purpose, and the reviewer is told so (`DECLARED_UNIT_PURPOSE_INTENT`).
				instructionIs: 'UNIT_PURPOSE',
				workProducts: [
					{ unit: 'Condition Survey', answer: ANSWER },
					{ unit: 'Inspection', answer: 'Panels 4 and 9 to be rebuilt; weep holes at 7 to be cleared.' }
				],
				commands: [
					{ unit: 'Condition Survey', argv: ['pytest', '-rs', 'survey/checks/'], exitCode: null, timedOut: true },
					{ unit: 'Inspection', argv: ['pytest', 'inspection/'], exitCode: null, timedOut: false }
				]
			});
		}
	},
	{
		id: 'D-OVERSIZE-CONTENT',
		covers: 'declared-policy framing; only the work oversize, the kept HEAD of its cut holding the first fence candidate',
		input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
			const policy = declared[0]!;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: PRODUCING_PROMPT,
				instructionIs: 'PRODUCING_PROMPT',
				// The kept head holds the first fence candidate, on a line of its own (as `W-OVERSIZE-CONTENT`'s does).
				workProducts: [{ unit: 'Condition Survey', answer: ['<<<UNTRUSTED-00>>>', OVERSIZE_ANSWER].join('\n') }],
				commands: [],
				rationale: RATIONALE
			});
		}
	},
	// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package D (`REG-D-118` (1); `REG-F-564`; `REG-F-553`'s class) — THE ROOT'S REVIEW AS P5
	// PACKAGE B WROTE IT ──────────────────────────────────────────────────────────────────────────────────────────────────
	// ⛔ Without these, no probe reached the text package B added to a declared review of a unit composed of others: the host
	// line naming a unit below that holds no completion, and the builder's cut of many units' work, unit by unit, each cut
	// declared on a host line of its own, which the fence chooser reads. 0 of 61 probe prompts held any of it, so a change to
	// any of it moved no fingerprint. Each is built through the product's builder, as `D-ROOT` is.
	{
		id: 'D-ROOT-UNITS-WITHOUT-WORK',
		covers:
			'declared-policy framing; a unit composed of others, its own PURPOSE the standard, its work fitting, and two units below it that hold no completion, each named on a host line of its own after the work with its lifecycle and assurance states (P5 package B F1); the second’s title holding the first fence candidate, which the chooser reads there',
		input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
			const policy = declared[0]!;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: INTENT,
				instructionIs: 'UNIT_PURPOSE',
				workProducts: [{ unit: 'Condition Survey', answer: ANSWER }],
				commands: [{ unit: 'Condition Survey', argv: ['pytest', '-rs', 'survey/checks/'], exitCode: 0, timedOut: false }],
				// ⭐ The second title stands on the host's line alone, so the prompt is fenced by `<<<UNTRUSTED-01>>>`, and a
				// chooser that did not read that line would take `00`.
				unitsWithoutWork: [
					{ unit: 'Inspection', lifecycleState: 'ABANDONED', assuranceState: 'UNASSESSED' },
					{ unit: `Handover ${candidate(0)}`, lifecycleState: 'PLANNED', assuranceState: 'UNASSESSED' }
				]
			});
		}
	},
	{
		id: 'D-OVERSIZE-UNITS',
		covers:
			'declared-policy framing; the work of three units longer than its budget, cut UNIT BY UNIT by the builder (P5 package B F2): one unit’s work product cut to its share, its kept HEAD holding the first fence candidate, another’s commands cut past its first ones, the third shown whole, each cut declared on a host line of its own before the work',
		input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
			const policy = declared[0]!;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: INTENT,
				instructionIs: 'UNIT_PURPOSE',
				// The kept head of the cut work product holds the first fence candidate, so the prompt is fenced by `01`.
				workProducts: [
					{
						unit: 'Condition Survey',
						answer: `${candidate(0)}\n${over(B.CONTENT_MAX, 'Panel surveyed; bulging within tolerance; weep holes clear. ')}`
					},
					{ unit: 'Repair Design', answer: 'Rebuild panels 4 and 9; clear the weep holes at 7.' }
				],
				commands: [
					...Array.from({ length: 40 }, (_, i) => ({
						unit: 'Inspection',
						argv: ['pytest', `inspection/panel_${i + 1}/`, '-k', over(600, 'bulge or weep or crack ')],
						exitCode: 0,
						timedOut: false
					})),
					{ unit: 'Repair Design', argv: ['pytest', 'design/'], exitCode: 0, timedOut: false }
				]
			});
		}
	},
	{
		id: 'D-OVERSIZE-UNIT-TITLE',
		covers:
			'declared-policy framing; the work of two units cut unit by unit, one with no work product and a command longer than its share, so all its commands are cut and its title, holding the first fence candidate, stands only in the declaration of that cut, which the chooser reads (P5 package B’s check, finding 3)',
		input: (_criteria, _build, declared = CATALOG_DECLARED_POLICIES) => {
			const policy = declared[0]!;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instruction: INTENT,
				instructionIs: 'UNIT_PURPOSE',
				workProducts: [
					{ unit: 'Condition Survey', answer: over(B.CONTENT_MAX, 'Panel surveyed; bulging within tolerance; weep holes clear. ') }
				],
				// ⭐ So the prompt is fenced by `<<<UNTRUSTED-01>>>`, and a chooser that did not read the declarations would take `00`.
				commands: [
					{
						unit: `Handover ${candidate(0)}`,
						argv: ['pytest', 'handover/', '-k', over(B.CONTENT_MAX, 'handover ')],
						exitCode: 0,
						timedOut: false
					}
				]
			});
		}
	},
	// ── the output example, when a policy declares no criterion ──
	{
		// ⭐ The review in parts, B7 — ~~over a graph~~ over a part: the graph framing's probes left the fingerprint.
		id: 'NO-CRITERIA',
		covers: 'the output example with no criterion to name (CRITERION-ID)',
		input: () => pwaTypeReviewInput({ criteria: [], prompt: INTENT, part: partOf(NODES, ROOT_ID) })
	}
];

// ── ⭐⭐ THE READER CORPUS (`JAN-PRQUAL` `PQ-1`; `REG-F-481`; design D2 under the sponsor's answer (a)) ─────────────────
/**
 * One witness of the reader the fence choosers model (`review-fence.ts`, THE READER IT MODELS): the slices a chooser is
 * handed, and the token today's reader chooses over them — `null` where every candidate occurs, and it fails closed.
 */
export interface ReaderWitness {
	/** The rule the witness stands on, and its side: READ, a reading the rule makes; NOT READ, one it must not make. */
	readonly rule: string;
	readonly slices: readonly string[];
	readonly token: string | null;
}
/**
 * `text` in a slice after one holding every candidate below `n`, a line each — so a reader that reads `text` as the
 * `n`th candidate chooses the next, and one that does not, the `n`th.
 */
const after = (n: number, text: string): readonly string[] => [candidateLines(n), text];
/** The first candidate written backwards: one only to a reader that lays it out reversed, code point by code point. */
const BACKWARDS = '<<<00-DETSURTNU>>>';
/** The first candidate, its two runs (`00`, `UNTRUSTED`) in reverse order: one only to a reader that reverses its runs. */
const RUNS_BACKWARDS = '<<<00-UNTRUSTED>>>';
/** The bidi controls the reader names (`review-fence.ts` `BIDI_CONTROLS`). */
const CONTROLS = ['\u202a', '\u202b', '\u202c', '\u202d', '\u202e', '\u2066', '\u2067', '\u2068', '\u2069'] as const;
/** One code point's name for a reader of a moved fingerprint: `U+` and four hex digits. */
const named = (c: string): string => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * ⭐⭐ THE READER CORPUS — WHAT THE FINGERPRINT HASHES OF HOW A SLICE IS READ (`fingerprint.ts`, `FENCE-READER`). The
 * skeleton's digest hashes every code point's readings and flags, never how a slice applies them — position by
 * position, per line, every line that holds a control, its two laid-out readings (`review-fence.ts` `readSlice`) — and
 * a plant stands at one point of each such rule. ⛔ So a reader changed where no plant stood moved no fingerprint
 * (driven on a disposable copy: a line laid out under the override alone, the first such line alone, a laid-out line
 * broken at every terminator, no candidate begun inside a reading — and the runs-reversed reading added). Here: every
 * plant of the chain, each after the candidates below it; every READER plant of what no chooser may read
 * (`FENCE_UNREAD` split by a line feed, laid out on a line with no control either way, and astride two slices — its cut
 * plants are the probes' alone); a witness of EACH SIDE of each rule `review-fence.ts` states — the reading it makes
 * and the one it must not; and a witness of each layout it names as NOT modelled — a line UAX #9 (with its mirroring,
 * L4) displays as a candidate the chooser does not read, so a change that models one is a change of reader too — each
 * with the token today's reader chooses, which `verif/reviewer-qualification-fingerprint.test.ts` holds it to, beside
 * the corpus's composition by label. ⚠ What it does not reach: the corpus takes each rule at the points its witnesses
 * stand, so a change confined to other inputs of a rule, or to two rules read together as no witness puts them, moves
 * nothing; the lookalikes `review-fence.ts` names as not read through the table (one Unicode lists only through its
 * prototype's own decompositions, a class read only through a `<compat>` one) are the table's, whose every entry the
 * skeleton's digest hashes, not the corpus's; and one neither Unicode nor the supplement lists no witness can name.
 */
export const READER_CORPUS: readonly ReaderWitness[] = [
	// ── the chain's plants (`FENCE_PLANTS`), each READ: the next candidate is chosen ──
	...Object.values(FENCE_PLANTS).map((plant, n) => ({
		rule: `READ — the plant of ${candidate(n)} (FENCE_PLANTS), after every candidate below it`,
		slices: after(n, plant),
		token: candidate(n + 1)
	})),
	// ── what no chooser may read (`FENCE_UNREAD`), each NOT READ: the view's own token is chosen ──
	{
		rule: 'NOT READ — LINES: a line feed breaks every line, so a candidate split by one is no line a reader sees',
		slices: after(19, FENCE_UNREAD.splitByALineFeed),
		token: candidate(19)
	},
	{
		rule: 'NOT READ — LAYOUT: a line that holds no bidi control is not laid out reversed',
		slices: after(19, FENCE_UNREAD.backwardsWithNoControl),
		token: candidate(19)
	},
	{
		rule: 'NOT READ — LAYOUT: a line that holds no bidi control is not laid out with its runs reversed',
		slices: after(19, FENCE_UNREAD.runsReversedWithNoControl),
		token: candidate(19)
	},
	{
		rule: 'NOT READ — EACH SLICE ON ITS OWN: a candidate begun at the end of one slice and ended at the start of the next',
		slices: [...after(19, FENCE_UNREAD.firstHalf), FENCE_UNREAD.secondHalf],
		token: candidate(19)
	},
	// ── a witness of each side of each rule, spelling the first candidate ──
	{ rule: 'READ — LOGICAL ORDER: a slice that holds a candidate’s bytes holds the candidate', slices: [candidate(0)], token: candidate(1) },
	{ rule: 'NOT READ — EACH SLICE ON ITS OWN: a candidate astride two slices is in neither', slices: ['<<<UNTRUSTED-0', '0>>>'], token: candidate(0) },
	{ rule: 'NOT READ — LINES: a candidate split by a line feed', slices: ['<<<UNTRUSTED-0\n0>>>'], token: candidate(0) },
	...UNBROKEN.map((t) => ({
		rule: `READ — LINES: ${named(t)} may not break a line, so it reads as nothing too`,
		slices: [`<<<UNTRUSTED-0${t}0>>>`],
		token: candidate(1)
	})),
	{ rule: 'READ — LOOKALIKES: a code point a reader does not see reads as nothing (U+200B ZERO WIDTH SPACE)', slices: ['<<<UNTRUSTED-0\u200b0>>>'], token: candidate(1) },
	{ rule: 'READ — LOOKALIKES: a code point read its FIRST way (U+1C84, which TR39 reads as 7)', slices: after(7, '<<<UNTRUSTED-0\u1c84>>>'), token: candidate(8) },
	{ rule: 'READ — LOOKALIKES: and its SECOND (U+1C84, whose capital reads as T)', slices: ['<<<UNTRUS\u1c84ED-00>>>'], token: candidate(1) },
	{
		rule: 'READ — LOOKALIKES: a code point outside the Basic Multilingual Plane is read whole (U+1D7CE MATHEMATICAL BOLD DIGIT ZERO)',
		slices: ['<<<UNTRUSTED-\u{1d7ce}0>>>'],
		token: candidate(1)
	},
	{
		rule: 'NOT READ — LOOKALIKES: a code point the table does not read as another reads as itself alone (U+0023 NUMBER SIGN, no digit)',
		slices: ['<<<UNTRUSTED-0#>>>'],
		token: candidate(0)
	},
	{ rule: 'READ — POSITION BY POSITION: a candidate may begin while another is open (a fourth bracket)', slices: ['<<<<UNTRUSTED-00>>>'], token: candidate(1) },
	{ rule: 'READ — POSITION BY POSITION: a candidate may begin inside a reading (U+226A, which reads as <<)', slices: ['\u226a<<UNTRUSTED-00>>>'], token: candidate(1) },
	{
		rule: 'READ — POSITION BY POSITION: a reading may be a candidate’s whole first part (U+22D8, which reads as <<<)',
		slices: ['\u22d8UNTRUSTED-00>>>'],
		token: candidate(1)
	},
	...CONTROLS.map((c) => ({
		rule: `READ — LAYOUT: a line that holds ${named(c)} is laid out reversed, code point by code point`,
		slices: [`${c}${BACKWARDS}`],
		token: candidate(1)
	})),
	...CONTROLS.map((c) => ({
		rule: `READ — LAYOUT: a line that holds ${named(c)} is laid out with its runs reversed`,
		slices: [`${c}${RUNS_BACKWARDS}`],
		token: candidate(1)
	})),
	{ rule: 'NOT READ — LAYOUT: a line that holds no control, reversed code point by code point', slices: [BACKWARDS], token: candidate(0) },
	{ rule: 'NOT READ — LAYOUT: a line that holds no control, with its runs reversed', slices: [RUNS_BACKWARDS], token: candidate(0) },
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: U+200F RIGHT-TO-LEFT MARK is no control the reader names',
		slices: [`\u200f${BACKWARDS}`],
		token: candidate(0)
	},
	{ rule: 'NOT READ — LAYOUT, NOT MODELLED: nor is U+061C ARABIC LETTER MARK', slices: [`\u061c${BACKWARDS}`], token: candidate(0) },
	{ rule: 'READ — LAYOUT: a line laid out is read with its brackets as written, too', slices: ['\u202e>>>00-DETSURTNU<<<'], token: candidate(1) },
	{ rule: 'READ — LAYOUT: and with its runs reversed, its brackets as written', slices: ['\u202b>>>00-UNTRUSTED<<<\u202c'], token: candidate(1) },
	{ rule: 'READ — LAYOUT: a control MID-LINE lays the line out', slices: [`E: \u202e${BACKWARDS}`], token: candidate(1) },
	{ rule: 'READ — LAYOUT: so does a control at the line’s END', slices: [`${BACKWARDS}\u202c`], token: candidate(1) },
	{ rule: 'READ — LAYOUT: EVERY line that holds a control is laid out, not the first alone', slices: [`\u202e\n\u202e${BACKWARDS}`], token: candidate(1) },
	{
		rule: 'READ — LAYOUT: a line laid out runs across a terminator a reader may not break at (U+2028)',
		slices: ['\u202e<<<00-DET\u2028SURTNU>>>'],
		token: candidate(1)
	},
	{ rule: 'NOT READ — LAYOUT: a control lays out its own line alone, not the line after it', slices: [`\u202e\n${BACKWARDS}`], token: candidate(0) },
	{ rule: 'NOT READ — LAYOUT: nor the line before it', slices: [`${BACKWARDS}\n\u202e`], token: candidate(0) },
	{
		rule: 'NOT READ — CANONICAL ORDER, NOT MODELLED: combining marks are read in the order written — U+0345 then U+1BF3, which in canonical order, U+1BF3 first, read as the -1 of -10',
		slices: after(10, '<<<UNTRUSTED\u0345\u1bf30>>>'),
		token: candidate(10)
	},
	// ⭐ EACH TERMINATOR A READER MAY NOT BREAK AT, INSIDE A LINE LAID OUT EITHER WAY — a line runs from one LF to the
	// next.
	// ⛔ Only U+2028 was witnessed in a laid-out line, so a reader that broke one at the other five moved nothing (driven
	// on a disposable copy).
	...UNBROKEN.filter((t) => t !== '\u2028').map((t) => ({
		rule: `READ — LAYOUT: a line laid out reversed runs across ${named(t)} too`,
		slices: [`\u202e<<<00-DET${t}SURTNU>>>`],
		token: candidate(1)
	})),
	...UNBROKEN.map((t) => ({
		rule: `READ — LAYOUT: a line laid out with its runs reversed runs across ${named(t)}, inside a run`,
		slices: [`\u202b<<<00-UNTRUS${t}TED>>>\u202c`],
		token: candidate(1)
	})),
	// ⭐ AND THE SIDES OF THREE STATED RULES NO WITNESS STOOD ON (driven on a disposable copy: a reader that broke none of
	// them otherwise moved nothing): a reading that holds a bracket breaks a run whatever its length; a line its control
	// ENDS is laid out with its runs reversed as well as reversed; and a candidate may END inside a reading.
	{
		rule: 'READ — LAYOUT: a reading that holds a bracket breaks a run, however many characters it has (U+226B, which reads as >>)',
		slices: ['\u202b<<<00-UNTRUSTED>\u226b\u202c'],
		token: candidate(1)
	},
	{ rule: 'READ — LAYOUT: a line its control ENDS is laid out with its runs reversed too', slices: [`${RUNS_BACKWARDS}\u202c`], token: candidate(1) },
	{ rule: 'READ — POSITION BY POSITION: a candidate may END inside a reading (U+226B, which reads as >>)', slices: ['<<<UNTRUSTED-00>>\u226b'], token: candidate(1) },
	// ⭐ AND EACH LAYOUT `review-fence.ts` NAMES AS NOT MODELLED: a line UAX #9 displays as a candidate (the algorithm with
	// its mirroring, L4), which the chooser does not read — so a change that models one moves a token here. ⛔ Four were
	// named with no witness — a line laid out in parts, right-to-left letters, nesting and a paragraph's direction — and
	// the runs drawn by Bidi_Class and the digits reordered with no control none either, so a reader that modelled any of
	// them moved nothing (driven on a disposable copy).
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: U+200F reorders a line that holds no control the reader names — its runs, as UAX #9 displays it',
		slices: [`\u200f${RUNS_BACKWARDS}`],
		token: candidate(0)
	},
	{ rule: 'NOT READ — LAYOUT, NOT MODELLED: and so does U+061C — its runs, as UAX #9 displays it', slices: [`\u061c${RUNS_BACKWARDS}`], token: candidate(0) },
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: a right-to-left letter is no control the reader names (U+05D0 HEBREW LETTER ALEF)',
		slices: [`\u05d0${BACKWARDS}`],
		token: candidate(0)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: a paragraph laid out right to left because its first strong character is (U+05D0, a space, then the candidate its runs reversed)',
		slices: [`\u05d0 ${RUNS_BACKWARDS}`],
		token: candidate(0)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: right-to-left letters laid out right to left (U+05E1 SAMEKH, read as 0, then U+05D5 VAV, read as 1: displayed as 10)',
		slices: after(10, '<<<UNTRUSTED-\u05e1\u05d5>>>'),
		token: candidate(10)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: a line laid out in PARTS (U+202E mid-line, only the part after it reversed)',
		slices: ['<<<UNTRUSTED-\u202e<<<00'],
		token: candidate(0)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: embeddings nested in one another (U+202D LEFT-TO-RIGHT OVERRIDE inside U+202E)',
		slices: ['\u202e<<<0\u202dTED-0\u202cSURTNU>>>\u202c'],
		token: candidate(0)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — digits before the line’s first letter, split by a space a reader does not see, inside U+202B (displayed 0 1)',
		slices: after(1, '\u202b<<<1 0-UNTRUSTED>>>\u202c'),
		token: candidate(1)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — a neutral read as a fence character (U+222A UNION, read as U), inside U+202B',
		slices: after(1, '\u202b<<<01-NTRUSTED\u222a>>>\u202c'),
		token: candidate(1)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — a letter read as a bracket keeps its place in its letter run (U+304F HIRAGANA LETTER KU, read as <), inside U+202B',
		slices: ['\u202b<<<00-\u304fUNTRUSTED>>\u202c'],
		token: candidate(0)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: digits reordered with NO control — Arabic-Indic digits split by a space (U+0661 read as 1, U+0665 as 0: displayed 01)',
		slices: after(1, '<<<UNTRUSTED-\u0661 \u0665>>>'),
		token: candidate(1)
	},
	{
		rule: 'NOT READ — LAYOUT, NOT MODELLED: digits reordered with NO control — a digit after a right-to-left letter (U+05D5 VAV, read as 1, a space, then 0: displayed 01)',
		slices: after(1, '<<<UNTRUSTED-\u05d5 0>>>'),
		token: candidate(1)
	},
	{
		rule: 'READ — THE CANDIDATES: every one but the last occurring, the last is chosen',
		slices: [candidateLines(EVERY_CANDIDATE - 1)],
		token: candidate(EVERY_CANDIDATE - 1)
	},
	{ rule: 'NOT READ — THE CANDIDATES: every one occurring, none is chosen — the chooser fails closed', slices: [candidateLines(EVERY_CANDIDATE)], token: null }
];
