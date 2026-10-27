// The Validator subsystem seam (§8.9) — the evaluator-execution arm of Assurance Engineering. A Validator is a
// replaceable implementation of a floor policy that PROPOSES a schema-conformant ValidatorResult; it never mutates
// state. This module is the in-process registry + the ordered-floor runner + the pure Reasoning-Review judgement
// mapper. The registry is a RUNTIME seam (not a persisted contract — §16.23 leaves deployment-capability projections
// unresolved). Concrete model-backed Validators (e.g. agy/Gemini for Reasoning Review) live server-side and register
// here; the deterministic floor Validators are pure and defined here.
import type { AssessmentCriterion, ObservedToolCallReport } from '@janumipwb/rph-contracts';
import {
	BLOCKING_SEVERITIES,
	type Disposition,
	type Identity,
	type Severity
} from './assurance-rules.js';
import { assuranceRecordingPlan, type AssuranceRecordingPlan } from './recording.js';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceOutcome,
	type AssuranceSubject,
	type ComposeOptions,
	type FloorCriterion,
	type FloorObservation,
	type FloorPolicyId,
	type FloorPolicyRef,
	type IdentityProvenanceFacts,
	type SchemaInvariantFacts,
	type ValidatorResult
} from './floor.js';

/**
 * The §9.7 PROFESSIONAL RATIONALE SUMMARY — the agent-authored account of its own professional reasoning, bound to
 * the Assumptions, limitations, and residual uncertainty it declares. §9.7's execution contract requires the
 * producer to RETURN this; §3 fixes what it is: "a contracted deliverable addressed to the governed system, not a
 * byproduct of a provider's runtime. It is not private chain-of-thought."
 *
 * That distinction is the whole point. §8.4 makes this the FIRST thing Reasoning Review reviews, precisely so the
 * control never depends on the producer's interior — the account is something the producer is accountable for
 * having written, not something scraped out of its runtime.
 */
export interface ProfessionalRationaleSummary {
	/** The account itself: how the subject discharges the delegated obligation. */
	readonly rationale: string;
	/** Typed Assumptions the producer relied on. §8.10 Assumption Disclosure: disclosure is not verification. */
	readonly assumptions: readonly string[];
	/** What the producer knows it did NOT do, or could not establish. */
	readonly limitations: readonly string[];
	/** What remains uncertain. §8.4 requires unacknowledged uncertainty to be an observable failure class. */
	readonly residualUncertainty: readonly string[];
}

/**
 * The kinds of thing a Reasoning Review can be conducted over, in this system, today.
 *
 * ⭑ ONE RUBRIC, N FRAMINGS (`R14`). Adding a member here does NOT add criteria and does not touch a policy: it
 * adds a way of TELLING a reviewer what is in front of it. `§8.4`'s Reasoning Review is mandatory over
 * AI-produced material whatever its shape, and this is the field that stops "whatever its shape" becoming
 * "described as whichever shape came first".
 */
export type ReviewFraming =
	/** A canonical PWA graph export — the original and, until `JAN-WPREVIEW`, the only one. */
	| 'PWA_GRAPH'
	/** A professional's deliverable, judged against the instruction that asked for it. */
	| 'WORK_PRODUCT'
	/**
	 * The result of a command an executing model chose to run — `JAN-EXEC` Phase 5.
	 *
	 * ⛔ THE SUBJECT OF THIS REVIEW IS NOT THE EXIT CODE (`R15`). There is no model reasoning in `exitCode: 0`;
	 * the producer is a child process. What is reviewed is the model's CONTRACTED ACCOUNT read against the
	 * ADAPTER'S OBSERVED CALLS — `§22.1` makes the model's word untrusted, and the adapter's observation is the
	 * only independent half available. `observedToolCalls` below is that half.
	 */
	| 'PROCESS_RESULT'
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; `REG-D-110` (3); `DESIGN-phase-7-completion.md` B1) — a work
	 * unit's work, judged against ONE of its DECLARED assurance policies: the policy's purpose framing the review, and
	 * that policy's own criteria the rubric (`declaredPolicy`, below). One review per (unit, policy) pair.
	 *
	 * ⛔ NOT A FLOOR REVIEW, AND IT IS NEVER RECORDED AS ONE. A review in this framing is run through the reviewer's own
	 * machinery — its call, retry, repair and capture — but its answers are recorded under the DECLARED policy, by the
	 * app's declared-policy sign-off, never as a `ValidatorResult` citing a `FloorPolicyId`. ⚠ So `ASR-4`'s bound above
	 * holds here as for the other three: the rubric is the policy's own criteria, never a second rubric.
	 */
	| 'DECLARED_POLICY'
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B2 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D4) — ONE TYPE of an
	 * authored PWA, its whole declared definition the subject and its place in the PWA the context: its ancestors, its
	 * parent's rule for it, its children's skeletons, the artifacts it shares and, for a type with children, their data flow
	 * (`pwaTypeReviewInput`). A type with children is judged for their composition too (DEC-6), and the root against the
	 * request. A review in this framing reviews one type, under the floor's own Reasoning Review policy and its criteria.
	 * ⚠ `PWA_GRAPH` STAYS: the historical case sets materialize through it. ⭐ B3: the authoring floor reviews in this framing,
	 * one review per type, and no longer through `PWA_GRAPH`.
	 */
	| 'PWA_TYPE';

/**
 * ⭐⭐ E2 (`DESIGN-phase-7-completion.md` B1) — WHAT A `DECLARED_POLICY` REVIEW TELLS THE REVIEWER ABOUT THE POLICY IT
 * JUDGES AGAINST: its id, its name and its PURPOSE, read from the stored policy by the caller. ⭑ Host-authored — it is the
 * catalog's text, never the producer's — so a reviewer shows it on host lines, outside every fence.
 */
export interface DeclaredPolicyFraming {
	readonly policyId: string;
	readonly name: string;
	readonly purpose: string;
}

/**
 * ⭐⭐ `E12F` F4 (the E12 package review's fourth finding; `R14`: *"a review conducted on a false account of its own subject is
 * worse than no review"*) — WHAT THE INSTRUCTION A `DECLARED_POLICY` REVIEW SHOWS IS, so the reviewer is told only what is
 * true of it:
 *   · `PRODUCING_PROMPT` — the prompt the agent that produced the ONE work product judged was given, re-rendered from the
 *     record: the reviewer is told that agent was given exactly it;
 *   · `UNIT_PURPOSE` — the unit's OWN purpose: for a unit composed of others (the root, judged over ~~its children's work~~
 *     ⭐ R3-A F1: the work its whole subtree produced, `REG-D-111` (2)), or one whose work no recorded prompt produced. It
 *     is the standard the work is judged against, and each work product judged was made under its own unit's instruction,
 *     which is not shown.
 * ⛔ The framing said of EVERY declared review that the work was produced "by the agents that did its children's work, which
 * was given exactly this instruction" — false of the root, whose instruction is its purpose and whose children each had a
 * prompt of their own.
 */
export type DeclaredInstruction = 'PRODUCING_PROMPT' | 'UNIT_PURPOSE';

/**
 * ⭐ `JAN-EXEC` Phase 7 P5, package B (F1) — A UNIT BELOW A UNIT COMPOSED OF OTHERS THAT HOLDS NO COMPLETION: its title, and
 * its lifecycle and assurance states as the store holds them. Such a unit contributed no work to what a declared review of
 * the unit above it is shown, and the reviewer is told so on a host line of its own (`declaredUnitsWithoutWork`).
 */
export interface DeclaredUnitWithoutWork {
	readonly unit: string;
	readonly lifecycleState: string;
	readonly assuranceState: string;
}

/** The inputs a Validator needs beyond the subject. Deterministic Validators read the fact bags; the Reasoning
 *  Review Validator reads the review input (the intent + the serialized subject content to review). */
export interface ReasoningReviewInput {
	/**
	 * The criteria this review judges — READ FROM THE SEEDED `floor.reasoning-review` ASSURANCE_POLICY OBJECT
	 * by the composition root, NOT from a constant in this file.
	 *
	 * THIS FIELD IS THE POINT OF THE INCREMENT. The rubric and the scored criterion set both keyed off the
	 * `REASONING_REVIEW_CRITERIA` constant, so the seeded policy object was a PROJECTION of the code: it was
	 * written at seed time and never read again. Editing it would have changed the UI card and nothing in the
	 * evaluation — "a policy that lies about what it checks". Now the policy is the source and the constant is
	 * only its seed.
	 *
	 * REQUIRED, deliberately: an optional field with a constant fallback is how this regresses silently. A caller
	 * that cannot supply criteria should fail the build, not quietly re-hardcode the rubric.
	 *
	 * `rph-assurance` stays STORE-FREE — the app reads the ACTIVE policy and passes its criteria in, which is
	 * what keeps the package DAG intact (this package may not import the engine).
	 */
	readonly criteria: readonly AssessmentCriterion[];
	/**
	 * ⭐ WHAT THE REVIEWER IS BEING TOLD IT IS LOOKING AT — declared by the CALLER, never inferred from the subject.
	 *
	 * ⛔ IT USED TO BE INFERRED, AND THE INFERENCE WAS BINARY. Both reviewers tested
	 * `subject.objectType === 'ARTIFACT'` and treated the FALSE arm as "a PWA graph export" — so every subject
	 * kind that was neither took the graph arm SILENTLY. `JAN-EXEC` Phase 5 measured the consequence: an
	 * `EVIDENCE` subject carrying a process result was handed to a reviewer told it was reading a canonical graph
	 * export, and the offline arm returned INCONCLUSIVE, which BLOCKS. A reviewer misdescribed to is worse than
	 * no reviewer, because the result is recorded as a review.
	 *
	 * ⭑ REQUIRED, FOR THE REASON `criteria` IS, AND A CLOSED UNION FOR A SECOND REASON. Required, so a caller
	 * that cannot say what it is reviewing fails the BUILD rather than quietly inheriting someone else's framing.
	 * Closed, so a FOURTH subject kind is a compile-time hole in every reviewer's exhaustive switch instead of a
	 * silent fall-through — which is exactly how the third kind arrived.
	 *
	 * ⚠ `ASR-4` BOUNDS WHAT THIS MAY VARY: policy meaning is stable across validator replacement, so this changes
	 * how the review is CONDUCTED and NEVER what the policy means. The rubric stays `criteria`, above, read from
	 * the one `floor.reasoning-review` policy object. A second rubric here would be `REG-F-353`'s restated
	 * vocabulary — and, because `ValidatorResult.policyId` is typed `FloorPolicyId`, it would also be recorded
	 * citing a policy that did not supply it (`R14`).
	 */
	readonly framing: ReviewFraming;
	/**
	 * ⭐ E2 — the declared policy a `DECLARED_POLICY` review judges against (`DeclaredPolicyFraming`). ⛔ REQUIRED BY THAT
	 * FRAMING, AND READ BY NO OTHER: a reviewer refuses a `DECLARED_POLICY` review that does not carry it, rather than
	 * tell the reviewer it judges against a policy it cannot name. Optional in the type so the three floor framings —
	 * and every record and case built over them — are unchanged.
	 */
	readonly declaredPolicy?: DeclaredPolicyFraming;
	/**
	 * ⭐ `E12F` F4 — what a `DECLARED_POLICY` review's instruction (`prompt`) is (`DeclaredInstruction`). ⛔ REQUIRED BY THAT
	 * FRAMING, AND READ BY NO OTHER, as `declaredPolicy` is: a reviewer refuses a declared review that does not say, rather
	 * than tell the reviewer something about its instruction the host does not know to be true.
	 */
	readonly declaredInstruction?: DeclaredInstruction;
	/**
	 * ⭐ P5 package B (F1) — the units below a unit composed of others that hold no completion (`DeclaredUnitWithoutWork`),
	 * each named to the reviewer on a host line of its own. ⛔ READ BY THE `DECLARED_POLICY` FRAMING ONLY; absent or empty,
	 * the prompt carries no such line.
	 */
	readonly declaredUnitsWithoutWork?: readonly DeclaredUnitWithoutWork[];
	/**
	 * ⭐ `JAN-EXEC` Phase 7, package N — D11 — the titles of the units whose model's work completed with no deliverable view on
	 * the record, each named on a host line of its own. ⛔ READ BY THE `DECLARED_POLICY` FRAMING ONLY; absent or empty, no line.
	 */
	readonly declaredUnitsWithoutDeliverable?: readonly string[];
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (`REG-D-137`; `REG-F-583`) — SOME UNIT OF THE WORK IS MARKED A WORK RE-RUN: the work's
	 * line marks that unit's work product (`"workRerun"`, set by `declaredPolicyReviewInput` from the view recorded at its completion),
	 * and the subject sentence gains the one clause that says what the mark means. ⛔ READ BY THE `DECLARED_POLICY` FRAMING ONLY;
	 * absent where no unit is marked, so that subject reads as before, byte for byte.
	 */
	readonly declaredWorkRerun?: true;
	/**
	 * ⭐ P5 package B (F2) — the host's declaration of the cut its BUILDER made of a declared review's work, one line per
	 * cut (`declaredPolicyReviewInput`): each unit's part cut to its own share of the budget. The reviewer is shown it before
	 * the work, as a head-only cut's declaration is, and the content is then never cut again. ⛔ READ BY THE
	 * `DECLARED_POLICY` FRAMING ONLY.
	 */
	readonly declaredWorkCut?: string;
	/**
	 * ⭐ The review in parts, B1 (`REG-D-125`; design D3) — the host's declaration of the cut its BUILDER made of a part's
	 * children's skeletons, one line per child cut (`pwaTypeReviewInput`): each child's skeleton cut to its own share of the
	 * budget, the subject never. The reviewer is shown it before the part, and the part is never cut again. ⛔ READ BY THE
	 * `PWA_TYPE` FRAMING ONLY.
	 */
	readonly declaredPartCut?: string;
	readonly prompt: string;
	readonly content: string;
	/**
	 * ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — the exact app-local semantic hash of the candidate under review, which the
	 * HOST computed: a reviewer shows it on a line of the host's own, never inside the content it quotes. ⛔ It was merged
	 * into a graph's content, so the host's computation was quoted as the agent's artifact. Absent or empty: no line.
	 */
	readonly candidateSubjectHash?: string;
	/** The producer's contracted §9.7 deliverable. Undefined means the producer did not discharge that half of its
	 *  execution contract — the Validator records that as a LIMITATION on its result and never infers anything
	 *  from the absence. */
	readonly rationale?: ProfessionalRationaleSummary;
	/** The producer's OBSERVABLE narration. §8.4 lists "other observable trace data" among what Reasoning Review
	 *  reviews, so this is admissible — but it is weaker than the contracted account and is never the producer's
	 *  interior (§9.7). Formerly `plan`, which was scraped narration standing in for the deliverable above. */
	readonly narration?: string;
	/**
	 * ⭐ WHAT THE ADAPTER OBSERVED THE SESSION DO — the independent half of a `PROCESS_RESULT` review (`R15`).
	 *
	 * ⛔ THIS IS NOT `narration`, AND FILING IT THERE WOULD HAVE BEEN A CATEGORY ERROR. `narration` is the
	 * PRODUCER's observable trace — the model's own account, weaker than its contracted one. This is the
	 * ADAPTER's: the party that DROVE the session reporting what it watched start and finish. `§22.1` classifies
	 * model output as untrusted external input, so the whole value of this field is that its author is not the
	 * model. Writing it into a producer-owned field would have destroyed exactly that.
	 *
	 * ⚠ IT CARRIES NO ARGUMENT, RESULT, EXIT CODE OR OUTPUT BYTE, BY CONSTRUCTION (`R11`). What a reviewer can
	 * ask of it is whether the producer's ACCOUNT squares with the calls that were SEEN — not what they printed.
	 * The verdict lives on the content plane and reaches the review as `content`.
	 *
	 * Optional, because an adapter that cannot observe must be able to say so through `observation`, and a
	 * framing that is not `PROCESS_RESULT` has nothing to put here.
	 */
	readonly observedToolCalls?: ObservedToolCallReport;
	readonly prior?: { readonly gaps: readonly string[] };
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package N — D10 (`REG-D-135` (1); `REG-F-522` remedy candidate 2; design D10) — THE FINISHED
	 * WORK BESIDE THE ANSWER: the files the unit changed in its workspace since its step began, as the host read them after a
	 * try, and the step's ONE host sequence to date (package L's D8), try by try. ⛔ READ BY THE `WORK_PRODUCT` FRAMING ONLY.
	 * Absent, the review is of the answer alone, as before.
	 */
	readonly deliverable?: Deliverable;
	/**
	 * ⭐⭐ Package N — D12 (`REG-D-135` (1); `REG-F-579`; design D12) — A COMMAND'S PLACE IN THE STEP'S SEQUENCE: the step's
	 * writes and runs to date, this command's act named (`subjectOrdinal`), shown on host lines after the command's view.
	 * ⛔ READ BY THE `PROCESS_RESULT` FRAMING ONLY. Absent, no line, as before.
	 */
	readonly hostSequence?: HostSequence;
}

/**
 * ⭐⭐ Package N — D8, D10, D12 — ONE ACT OF A STEP'S HOST SEQUENCE: a write the host completed (`write_file`'s `written`
 * arm), or a run it completed and retained, each with the number of the step's ONE sequence it took (package L) and the
 * try it was made in. ⛔ The path and `argv` are the agent's (content plane, `R11`); the number, the try and the exit are the
 * host's.
 */
export type HostSequenceAct =
	| { readonly try: number; readonly ordinal: number; readonly kind: 'WRITE'; readonly path: string }
	| {
			readonly try: number;
			readonly ordinal: number;
			readonly kind: 'RUN';
			readonly argv: readonly string[];
			readonly exitCode: number | null;
			readonly timedOut: boolean;
	  };

/** ⭐ Package N — a step's host sequence to date, as a review is shown it (`Deliverable.sequence`; a command's view). */
export interface HostSequence {
	readonly acts: readonly HostSequenceAct[];
	/**
	 * How many runs past the step's bound (`recordedLimit`) the host completed: each took its number, so the numbers above
	 * skip them, and none is retained or reviewed (package L's D8: a disclosed residual).
	 */
	readonly droppedRuns: number;
	readonly recordedLimit: number;
	/** The act a `PROCESS_RESULT` review is of, by its number in the sequence. */
	readonly subjectOrdinal?: number;
}

/** ⭐ Package N — D10 — one file the unit changed since its step began: its path, what changed, and the text the host read. */
export interface DeliverableFile {
	readonly path: string;
	readonly change: 'ADDED' | 'CHANGED' | 'REMOVED';
	/** The text the host read after the try. ⛔ Absent for a REMOVED file: there is nothing to read. */
	readonly content?: string;
}

/**
 * ⭐ Package N — D10 — what a work-product review judges beside the answer: the files changed through `afterTry`, and the
 * step's writes and runs to date.
 */
export interface Deliverable {
	readonly afterTry: number;
	readonly files: readonly DeliverableFile[];
	readonly sequence: HostSequence;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (`REG-D-137`; `REG-F-583`; design D28, revision 4) — A WORK RE-RUN'S VIEW: its
	 * step counts `files` from an EARLIER step's baseline, the unit's first (package O's D22), so a file an earlier step changed
	 * is among them, while `sequence` is this step's alone. The work-product review then says so, and so does a declared review
	 * whose work holds it (`reasoning-review-validator.ts`). ⛔ ABSENT on a unit's first step — never `false` — so a first step's
	 * view, every view recorded before package O-2, and every case read as before, byte for byte.
	 */
	readonly workRerun?: true;
}
export interface ValidatorContext {
	readonly schemaInvariant?: SchemaInvariantFacts;
	readonly identityProvenance?: IdentityProvenanceFacts;
	readonly reasoningReview?: ReasoningReviewInput;
}

export interface Validator {
	readonly policyId: FloorPolicyId;
	readonly validatorId: string;
	evaluate(subject: AssuranceSubject, ctx: ValidatorContext): Promise<ValidatorResult>;
}

export interface ValidatorRegistry {
	register(v: Validator): void;
	get(policyId: FloorPolicyId): Validator | undefined;
}

/** An in-process validator registry (one Validator per floor policy). Not a persisted contract. */
export function createValidatorRegistry(): ValidatorRegistry {
	const map = new Map<FloorPolicyId, Validator>();
	return {
		register: (v) => {
			map.set(v.policyId, v);
		},
		get: (id) => map.get(id)
	};
}

// Deterministic floor Validators as registry instances (pure — they read facts from the context).
export const schemaInvariantValidatorInstance: Validator = {
	policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
	validatorId: 'deterministic.schema-invariant',
	evaluate: (subject, ctx) =>
		Promise.resolve(
			schemaInvariantValidator(
				subject,
				ctx.schemaInvariant ?? {
					schemaValid: false,
					invariantViolations: ['SCHEMA_FACTS_UNAVAILABLE']
				}
			)
		)
};
export const identityProvenanceValidatorInstance: Validator = {
	policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
	validatorId: 'deterministic.identity-provenance',
	evaluate: (subject, ctx) =>
		Promise.resolve(
			identityProvenanceValidator(
				subject,
				ctx.identityProvenance ?? {
					hasStableId: false,
					hasSemanticVersion: false,
					hasProvenance: false,
					hasProducer: false,
					traceComplete: false
				}
			)
		)
};

/** Reasoning Review criteria = the §8.4 / §11.7.5 derivational-integrity failure classes, phrased so that MET means
 *  the failure is ABSENT. The Validator prompt and the judgement mapper both key off these ids. */
export const REASONING_REVIEW_CRITERIA = [
	{
		id: 'RR-01-no-problem-substitution',
		label:
			'The result genuinely discharges its delegated obligation rather than substituting an easier problem.'
	},
	{
		id: 'RR-02-no-obligation-elision',
		label: 'No delegated professional obligation is silently dropped.'
	},
	{
		id: 'RR-03-no-unjustified-scope-reduction',
		label: 'Scope is not narrowed without explicit justification.'
	},
	{
		id: 'RR-04-no-proxy-satisfaction',
		label: 'No proxy or surface satisfaction that conceals the underlying problem.'
	},
	{ id: 'RR-05-no-premature-convergence', label: 'No premature closure or convergence.' },
	{
		id: 'RR-06-sound-inference',
		label: 'No unsupported assumptions, circular support, or invalid inference.'
	},
	{
		id: 'RR-07-no-contradiction',
		label: 'No contradiction with intent, constraints, inputs, or evidence.'
	},
	{
		id: 'RR-08-evidence-integrity',
		label: 'No omitted inconvenient evidence and no hidden/unacknowledged uncertainty.'
	},
	{
		id: 'RR-09-no-completeness-from-existence',
		label: 'Completeness is not claimed merely from output existence or activity.'
	}
] as const;

export interface ReasoningReviewFinding {
	readonly criterionId: string;
	/** True = the failure class IS present (i.e. the criterion is NOT_MET). */
	readonly failed: boolean;
	readonly statement: string;
	readonly severity?: Severity;
	/**
	 * ⭐ `JAN-CRITREAD` J1-1a (`REG-D-071` Q4, form D): the answer a TEST stipulated for this criterion — no reviewer
	 * judged it. Only the test-mode stand-in writes it; a model's own `stipulated` is dropped by `coerceJudgement`,
	 * which rebuilds every finding field by field. The mapper records such a finding as `UNABLE_TO_DETERMINE` — the
	 * truth — with the stipulation beside it, and a FAILED finding stays a fault whatever else it says.
	 */
	readonly stipulated?: true;
}
export interface ReasoningReviewJudgement {
	readonly findings: readonly ReasoningReviewFinding[];
	readonly recommendation: Disposition;
	readonly residualUncertainty?: readonly string[];
	readonly limitations?: readonly string[];
	readonly consideredEvidenceIds?: readonly string[];
	readonly rejectedEvidenceIds?: readonly string[];
}

/**
 * Map a Reasoning Review judgement (from any backend — model, deterministic, hybrid, human) to the schema-conformant
 * ValidatorResult. Each criterion becomes a scored result (MET iff its failure class is absent); present failures
 * become open observations. Pure + backend-agnostic, so the agy/Gemini adapter and any future Validator share one
 * mapping.
 *
 * `policyCriteria` IS THE POLICY'S OWN, threaded in from the seeded ASSURANCE_POLICY object. This mapped over the
 * `REASONING_REVIEW_CRITERIA` constant, which made the SCORED criterion set a fact about this file rather than
 * about the policy — the other half of the projection (the prompt rubric was the first half). Both now read the
 * policy, so an edited criterion reaches the rubric AND the score, and the two cannot silently diverge.
 *
 * `mandatory` is DERIVED from the ratified `severityIfNotMet` (DOC-004 §7) rather than hardcoded `true`: a
 * criterion blocks iff its severity does. It was `true` for every criterion, which was correct only because every
 * floor criterion happens to be BLOCKING — a coincidence, not a rule, and it would have silently promoted any
 * ADVISORY criterion the moment one existed.
 */
export function reasoningReviewResultFromJudgement(
	subject: AssuranceSubject,
	evaluator: Identity,
	validatorId: string,
	j: ReasoningReviewJudgement,
	policyCriteria: readonly AssessmentCriterion[]
): ValidatorResult {
	const byId = new Map(j.findings.map((f) => [f.criterionId, f]));
	// ⭐ THE POLICY'S OWN DECLARED SEVERITY, BY CRITERION ID (`JAN-EXEC` `R25`). `severityIfNotMet` is the policy
	// author's ratified statement of what it MEANS if a criterion is unmet; whether it is unmet is the reviewer's
	// call. Those are different questions and only the second belongs to the reviewer.
	const declaredSeverity = new Map(policyCriteria.map((c) => [c.id, c.severityIfNotMet]));
	const criteria: FloorCriterion[] = policyCriteria.map((c) => {
		const f = byId.get(c.id);
		// ⭐ A STIPULATED CLEAN ANSWER RECORDS THE TRUTH — NOBODY JUDGED THIS — WITH THE TEST'S ANSWER BESIDE IT
		// (`REG-D-071` Q4, form D). Every reader that knows nothing of stipulations sees `UNABLE_TO_DETERMINE` and
		// fails closed; only an engine built to admit them counts `stipulated` as met. ⛔ Recording it as `MET` here
		// would write `REG-F-409`'s shape — an unjudged criterion recorded as passed — which is why revision 1 of the
		// design was replaced. ⛔ AND A FAILED FINDING IS A FAULT, recorded below as one: a stipulation never softens
		// a fault (`REG-D-072` D4).
		if (f?.stipulated === true && !f.failed)
			return {
				criterionId: c.id,
				mandatory: BLOCKING_SEVERITIES.has(c.severityIfNotMet),
				outcome: 'UNABLE_TO_DETERMINE',
				stipulated: 'MET',
				...(f.statement ? { rationale: f.statement } : {})
			};
		return {
			criterionId: c.id,
			mandatory: BLOCKING_SEVERITIES.has(c.severityIfNotMet),
			// ⛔ ABSENCE MEANS THE FAILURE DID NOT OCCUR — NOT THAT THE CRITERION WENT UNJUDGED, AND I HAD THAT
			// BACKWARDS (`JAN-EXEC` `R25`). I changed this to report the criterion undetermined whenever the reviewer
			// had not mentioned it, reasoning that silence was being scored a pass. TWELVE EXISTING TESTS WENT RED,
			// one of them named *"maps each failure class to a mandatory criterion (MET iff absent)"*, and the
			// contract states it at the type: `ReasoningReviewFinding.failed` is documented *"True = the failure class
			// IS present"*. The reviewer reports FAILURE CLASSES, so an absent finding is a positive statement that
			// the failure did not occur. MET is correct, and the change would have made every clean review
			// INCONCLUSIVE — a refusal that looks like rigour and stops all work.
			//
			// ⚠ WHAT SURVIVES AS A REAL RESIDUE — AND THE SHAPE IS NOT THE PROBLEM, WHICH I HAD WRONG. `failed` is
			// a BOOLEAN, so a `failed: false` row already says *"I evaluated this and it is clean"*, and the live
			// prompt asks for exactly that (*"Evaluate EACH derivational-integrity failure class below"*) with an
			// example showing `"failed":false`. THIS LINE is what discards it: absent and present-with-false
			// collapse to one `MET`. ⛔ MEASURED CONSEQUENCE (`REG-F-409`): the deterministic fixture the GATE runs
			// faults only FOUR of this policy's NINE criteria, so five are recorded PASSED on every gated run.
			// ⚠ The residue restated correctly: this shape cannot distinguish a reviewer
			// that evaluated every criterion and found nothing from one that engaged with nothing and returned an
			// empty finding list. Both are CLEAN here. So the ratified outcome value for "could not determine" is
			// emitted by NO production path, and `dispositionFromFindings`'s mandatory-undetermined rule — *"never a
			// pass"* — cannot fire. ⛔ THE REMEDY IS A CONTRACT CHANGE (the judgement would have to say what it
			// EVALUATED, not only what it FAULTED), not a re-reading of this line. Filed as `REG-F-407`.
			// ⭐⭐ THREE-WAY (`JAN-EXEC` `R26`). A reviewer's report distinguishes three things and this line used
			// to carry two: faulted, evaluated-and-clean, and NOT EVALUATED. `failed` is a boolean, so a
			// `failed: false` row is an explicit clean verdict — the live prompt asks for one per criterion and
			// its example shows it — and ABSENCE is now what it always meant: the reviewer did not judge this.
			outcome: f === undefined ? 'UNABLE_TO_DETERMINE' : f.failed ? 'NOT_MET' : 'MET',
			...(f?.statement ? { rationale: f.statement } : {})
		};
	});
	const observations: FloorObservation[] = j.findings
		.filter((f) => f.failed)
		.map((f) => ({
			code: f.criterionId,
			// ⭐ THE POLICY'S SEVERITY WHERE THE POLICY DECLARED ONE (`R25`). This read `f.severity ?? 'MATERIAL'`
			// — the reviewer's own opinion, defaulted — and it is the field the KERNEL GATE actually enforces on:
			// `rejectForeclosedDisposition` forecloses a positive disposition over an open BLOCKING/CRITICAL
			// observation, universally, and `MATERIAL` is not in that set.
			//
			// ⛔ SO THE JUDGED PARTY SET ITS OWN STAKES. `mandatory` above is derived from the policy correctly and
			// is package-private — it never crosses the ratified command boundary. What crossed was this severity.
			// A reviewer that reported a failure and simply OMITTED a severity downgraded a policy's declared
			// BLOCKING to MATERIAL and Gate C stayed silent. Every floor criterion declares BLOCKING, so this
			// weakened the de minimis floor and not only authored policies.
			//
			// ⚠ THE FALLBACK SURVIVES FOR AN UNDECLARED ID, AND IT IS A DISCLOSED RESIDUE RATHER THAN A CHOICE I
			// LIKE. A finding naming a criterion the policy does not declare is not a criterion verdict at all, so
			// there is no declared severity to prefer; keeping the reviewer's own value records what it said
			// instead of dropping it. ⛔ THE RESIDUE: a reviewer could reach the old behaviour by naming an id the
			// policy does not declare. That is a weaker bypass than the one this closes — it forfeits the
			// criterion result entirely, which `UNABLE_TO_DETERMINE` now makes visible — but it is not nothing,
			// and it is tested rather than assumed.
			severity: declaredSeverity.get(f.criterionId) ?? f.severity ?? 'MATERIAL',
			statement: f.statement,
			open: true
		}));
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		policyVersion: '1',
		validatorId,
		validatorVersion: '1',
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		evaluator,
		criteria,
		observations,
		dispositionRecommendation: j.recommendation,
		consideredEvidenceIds: j.consideredEvidenceIds ?? [],
		rejectedEvidenceIds: j.rejectedEvidenceIds ?? [],
		residualUncertainty: j.residualUncertainty ?? [],
		executionFailed: false,
		limitations: j.limitations ?? []
	};
}

// ── ⭐ `JAN-SELRES` D6 (`REG-F-460`) — A VALIDATOR FAILURE THAT HAS A CODE OF ITS OWN ──────────────────────────────
//
// ⛔ WHAT WAS WRONG. A Validator that failed could say WHY only in prose: `runFloorResults` read the thrown error's
// `.message` and nothing else, so every failure was recorded as one observation, `VALIDATOR_EXECUTION_FAILED`. The
// app's remediation classifier reads CODES, never prose (`apps/rph-demo/src/lib/server/floor.ts`), so a review
// refused because the reviewing tool reported a model other than the one selected took the execution-failure branch
// and was told *"Configure or retry the reviewer"* — the one remedy its own statement forbids (`REG-D-085` item 3).
//
// ⭑ ADDITIVE, NOT A REPLACEMENT CODE. `VALIDATOR_EXECUTION_FAILED` means "the validator produced no result", and a
// refused substitute is such a case. So it is still recorded FIRST, byte for byte as before, and the carried code
// follows it as a refinement: `observations[0]` — what the waiver form targets and what a reader sees first — is
// unchanged, and every predicate keyed on the old code still fires.

/** ~~The one failure~~ ⭐ A failure this package records under its own code: the reviewing tool reported that a model
 *  other than the configured and selected one answered, and the review was refused for it. */
export const VALIDATOR_MODEL_SUBSTITUTED = 'VALIDATOR_MODEL_SUBSTITUTED';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L2's check, finding 2 (`REG-F-580`; DESIGN-data-flow-order-and-deliverable-review.md D20) —
 * THE SECOND: the host's allowance of reviewer calls stopped the review before any call, so no reviewer ran. ⛔ Carried by
 * nothing, the stop was recorded as a reviewer that did not execute, and the app answered it "Configure or retry the
 * reviewer": no reviewer caused it, and a retry under the same allowance is stopped again (the app's
 * `assurance/review-allowance.ts`; its classifier, `floor.ts`).
 */
export const VALIDATOR_ALLOWANCE_STOPPED = 'VALIDATOR_ALLOWANCE_STOPPED';

/**
 * ⭐ THE CLOSED SET OF CODES A THROWN VALIDATOR FAILURE MAY CARRY. A code outside it is dropped, never recorded:
 * this package's observation vocabulary is not extended by whatever a Validator happens to throw.
 *
 * ⭑ ~~The member is~~ ⭐ Each member is ALSO exported by name so the app IMPORTS it rather than restating the literal — the
 * classifier's `o.code === …` is a string comparison no compiler checks, so a restated literal that drifted would silently
 * route a refused review back to "retry the reviewer" (`REG-F-460`, reopened).
 */
export const VALIDATOR_FAILURE_CODES = [VALIDATOR_MODEL_SUBSTITUTED, VALIDATOR_ALLOWANCE_STOPPED] as const;
export type ValidatorFailureCode = (typeof VALIDATOR_FAILURE_CODES)[number];

/** What a thrown error may carry: a code in `VALIDATOR_FAILURE_CODES`, and the statement to record under it. */
export interface ValidatorFailure {
	readonly code: ValidatorFailureCode;
	readonly statement: string;
}

/**
 * An `Error` whose message is `message` — recorded as `VALIDATOR_EXECUTION_FAILED` exactly as any throw is — carrying
 * `failure` for `runFloorResults` to record beside it.
 *
 * ⭑ WHY A HELPER AND NOT A CLASS, AND WHY EXPORTED. The property name is the whole contract between the Validator
 * that throws and the runner that reads, and this keeps BOTH ends of it in this module: an app writing
 * `Object.assign(new Error(m), { validatorFailure })` itself would restate the name, and a rename here would then
 * turn every carried failure causeless with nothing to say so (`Object.assign` accepts any shape). ⛔ NOT a subclass,
 * because the runner cannot ask `instanceof`: the app and this package can each load their own copy of it (`src`
 * and `dist`), and a class from one copy is not an instance of the other's — the reason `StoreBusyError`'s `code` is
 * read by property too (`rph-ports/src/ports/storage.ts`).
 * ⚠ NOT `cause`: ES2022's `Error.cause` means the UNDERLYING error, and this is a classification of the failure itself.
 */
export function validatorFailureError(
	message: string,
	failure: ValidatorFailure
): Error & { readonly validatorFailure: ValidatorFailure } {
	return Object.assign(new Error(message), { validatorFailure: failure });
}

/**
 * The failure a thrown value carries, read BY PROPERTY (see `validatorFailureError`), or `undefined`.
 *
 * ⛔ EVERYTHING BUT A WELL-FORMED, IN-SET CARRIER ON AN `Error` IS NOTHING, never a guess: a non-Error throw (its
 * statement is already `String(e)`), a carrier that is not an object, a code outside the closed set, a statement
 * that is not a non-blank string, or a carrier whose READ throws (a throwing getter, a Proxy's trap). Each of those
 * is recorded exactly as a causeless throw is.
 *
 * ⭑ WHY THE READ IS GUARDED. This runs inside `runFloorResults`' catch, so a read that threw would escape it: the floor
 * run would REJECT with the reader's error instead of recording the Validator's failure, and "a Validator that throws
 * yields a failed result" would no longer hold for every throw.
 */
function carriedFailure(e: unknown): ValidatorFailure | undefined {
	if (!(e instanceof Error)) return undefined;
	try {
		const carried: unknown = (e as { validatorFailure?: unknown }).validatorFailure;
		if (typeof carried !== 'object' || carried === null) return undefined;
		const { code, statement } = carried as { code?: unknown; statement?: unknown };
		const known: readonly unknown[] = VALIDATOR_FAILURE_CODES;
		if (!known.includes(code) || typeof statement !== 'string' || statement.trim() === '')
			return undefined;
		return { code: code as ValidatorFailureCode, statement };
	} catch {
		// ⛔ A READ THAT THROWS CARRIES NOTHING: the throw is recorded as a causeless one.
		return undefined;
	}
}

function failedResult(
	subject: AssuranceSubject,
	p: FloorPolicyRef,
	validatorId: string,
	reason: string,
	carried?: ValidatorFailure
): ValidatorResult {
	return {
		policyId: p.policyId,
		policyVersion: p.policyVersion,
		validatorId,
		validatorVersion: '1',
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		evaluator: { actorType: 'SYSTEM' },
		criteria: [],
		observations: [
			{ code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL', statement: reason, open: true },
			// ⭐ D6 — THE REFINEMENT, SECOND AND ONLY WHEN CARRIED. `MATERIAL` like the failure it refines, and open.
			...(carried
				? [
						{
							code: carried.code,
							severity: 'MATERIAL' as const,
							statement: carried.statement,
							open: true
						}
					]
				: [])
		],
		dispositionRecommendation: 'INCONCLUSIVE',
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: true,
		limitations: []
	};
}

/**
 * Run the ordered de minimis floor over a subject using the registered Validators. An absent Validator leaves its
 * policy MISSING (compose blocks — never assume satisfied); a Validator that throws yields a VALIDATOR_FAILED result
 * (compose blocks, and it is never mistaken for REJECTED). The composed outcome + its transition gate are returned.
 * ⭐ `JAN-SELRES` D6: a throw recorded as `VALIDATOR_EXECUTION_FAILED` also records the failure it CARRIES, when it
 * carries one in `VALIDATOR_FAILURE_CODES` (`validatorFailureError`), as a second observation.
 */
async function runFloorResults(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry,
	policyIds?: readonly FloorPolicyId[]
): Promise<{ plan: FloorPolicyRef[]; results: ValidatorResult[] }> {
	const plan = deMinimisFloorPlan(subject).filter(
		(p) => policyIds === undefined || policyIds.includes(p.policyId)
	);
	const results: ValidatorResult[] = [];
	for (const p of plan) {
		const v = registry.get(p.policyId);
		if (!v) continue; // missing → compose treats the policy as MISSING → blocks
		try {
			results.push(await v.evaluate(subject, ctx));
		} catch (e) {
			results.push(
				failedResult(
					subject,
					p,
					v.validatorId,
					e instanceof Error ? e.message : String(e),
					carriedFailure(e)
				)
			);
		}
	}
	return { plan, results };
}

export async function runDeMinimisFloor(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry,
	opts: ComposeOptions = {}
): Promise<AssuranceOutcome> {
	const { plan, results } = await runFloorResults(subject, ctx, registry);
	return composeAssuranceOutcome(subject, plan, results, opts);
}

/**
 * ⭐ The review in parts, B3 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1, D5) — THE NAMED POLICIES OF A SUBJECT'S
 * FLOOR, RUN AS `runDeMinimisFloor` RUNS THEM, THEIR RESULTS RETURNED UNCOMPOSED. The authoring floor runs a PWA's two
 * deterministic policies once over the PWA and its Reasoning Review once over each of its types, so it composes each plan
 * itself (`assuranceRecordingPlan`) and folds the parts. ⚠ A policy the subject's own plan does not hold is not run.
 */
export async function runFloorPolicies(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry,
	policyIds: readonly FloorPolicyId[]
): Promise<{ plan: FloorPolicyRef[]; results: ValidatorResult[] }> {
	return runFloorResults(subject, ctx, registry, policyIds);
}

/**
 * Run the ordered de minimis floor and produce the Assurance-Service RECORDING plan — the canonical per-policy
 * assessments + observations carrying the floor-computed dispositions (§8.9 layer 3). Same run + blocking semantics
 * as runDeMinimisFloor; the composition layer turns the plan into live ASSURANCE_ASSESSMENT/OBSERVATION commands.
 */
export async function runFloorAndPlanRecording(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry,
	opts: ComposeOptions = {}
): Promise<AssuranceRecordingPlan> {
	const { plan, results } = await runFloorResults(subject, ctx, registry);
	return assuranceRecordingPlan(subject, plan, results, opts);
}
