// The in-product de minimis assurance floor (guide §8.4) for the PWA authoring plane. After an authoring turn the
// server runs the ordered floor over the DRAFT PWA graph — schema/invariant + identity/provenance (deterministic) +
// an INDEPENDENT Reasoning Review (~~agy/Gemini in dev/prod, the structural mock under E2E; a different vendor than the
// Pi authoring executor~~ ⭑ `JAN-SELREV` SR-3: the reviewer `assurance/reviewer-selection.ts` selects — outside test
// mode the configured tool and model, devin with ~~`glm-5-3-flash-max` being the sponsor's selection (`REG-D-084`)~~ ⭐
// `glm-5-3-flash-high` being the sponsor's selection (`REG-D-119`) and agy
// configurable; under E2E (test mode, no tool named) the declared stand-in; independence checked on the recorded
// identities, never assumed from a vendor — exec != assurance, INV-5) — and persists the outcome as canonical
// ASSURANCE_ASSESSMENT + ASSURANCE_OBSERVATION objects via the shared recorder. Nothing here self-dispositions;
// composeAssuranceOutcome does the strictest-unresolved composition, and the PublishPwa gate (rph-application)
// enforces it.
import { analyzePwaGraph, pwaTypeParts, type PwaTypePart } from '@janumipwb/rph-projections';
import {
	aggregateDisposition,
	assuranceRecordingPlan,
	FLOOR_POLICY_IDS,
	REVIEWER_RECOMMENDED_ESCALATION,
	runFloorPolicies,
	VALIDATOR_FAILURE_CODES,
	VALIDATOR_MODEL_SUBSTITUTED,
	type AssuranceRecordingPlan,
	type AssuranceSubject,
	type ComposeOptions,
	type IdentityProvenanceFacts,
	type PolicyAssessment,
	type ProfessionalRationaleSummary,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import {
	getObject,
	listAssessments,
	listDecisions,
	listObservations,
	listPwuTypes,
	recordAssuranceRecordingPlan,
	type AuthedEngineHandle,
	type EngineHandle
} from '@janumipwb/rph-engine';
import {
	AssuranceDispositionRecommendationSchema,
	type AssessmentCriterion
} from '@janumipwb/rph-contracts';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { createFloorRegistry } from './assurance/index.js';
import { pwaTypeReviewInput } from './assurance/review-input.js';
import { stipulationFor } from './stipulations.js';
import type { AgyPrint } from './assurance/reasoning-review-validator.js';
import { createExchangeSink } from './assurance/exchange-capture.js';
import { recordExchanges } from './assurance/exchange-recorder.js';
import type { ExchangeRecord } from './agent/exchange-record.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { canonicalActsOf } from './authoring-turn.js';
import { buildPwaExport, getArtifactStore, getEngine, hostNow, isTestMode, mintUiId } from './workbench.js';

/**
 * Read the ACTIVE `floor.reasoning-review` policy's criteria FROM THE STORE — the store→runtime content path.
 *
 * THIS FUNCTION IS THE INCREMENT. Until now the rubric and the scored criterion set both keyed off the
 * `REASONING_REVIEW_CRITERIA` constant in `rph-assurance`, so the seeded ASSURANCE_POLICY object was a
 * PROJECTION of the code: written once at seed time and never read again. Editing it would have changed the UI
 * card and nothing in the evaluation — "a policy that lies about what it checks". The constant is now only the
 * SEED; the policy object is the source.
 *
 * This lives in the composition root, not in `rph-assurance`, on purpose: that package may not import the
 * engine (the package DAG forbids it, and `boundary` enforces it), so the app reads the store and passes plain
 * data in. That is what keeps the Validator subsystem store-free while still letting the policy govern it.
 *
 * FAIL-CLOSED, and §13.3 L2227 names this case literally — "Fail closed on missing identity, tenant, POLICY,
 * schema, or authority context". A missing or empty policy must NOT silently fall back to the constant: that
 * would restore the projection at the exact moment the policy stopped being readable, which is the worst
 * possible moment. §8.4 L854 agrees — a required review that is unavailable "cannot satisfy assurance or permit
 * its protected transition".
 */
/** ⭑ EXPORTED FOR THE EXECUTION PLANE (`JAN-EXECREVIEW`). The work-product review is governed by the SAME
 *  policy object as the authoring review, read from the store. Restating the rubric in a second module is
 *  how four descriptions of one AssessmentCriterion came to disagree — the defect this function's own
 *  fail-closed errors exist to prevent, one plane over. */
export function reasoningReviewCriteria(engine: AuthedEngineHandle): readonly AssessmentCriterion[] {
	const policy = getObject(engine, FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!policy) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} ASSURANCE_POLICY is not in the store, so its criteria cannot govern the review. Seed the floor policies before running the floor.`
		);
	}
	const criteria = policy.criteria;
	if (!Array.isArray(criteria) || criteria.length === 0) {
		throw new Error(
			`Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} policy records no criteria, so a Reasoning Review over it would assert a rubric no policy declares.`
		);
	}
	return criteria as AssessmentCriterion[];
}

// ⚠ `FLOOR_ACTOR` WAS HERE — `{ actorId: 'assurance-svc', actorType: 'SERVICE' }`, passed to
// `recordAssuranceRecordingPlan` as the declared issuer of every assessment/observation command.
//
// It was a string, not an identity. No authenticator issued `assurance-svc`, no credential resolves to it, and
// once the engine began stamping the authenticated principal the declaration became a DISAGREEMENT — refused
// (REG-D-027(b)), which surfaced as `BLOCKED_EXTERNAL · the reviewer call failed` on every authoring turn that
// reached assurance. The floor was not failing; recording its result was.
//
// The issuer is now the caller's authenticated handle, and the identity that carries assurance meaning — the
// independent EVALUATOR §8.12 checks — was never this field: it rides in `validatorResult.executionProvenance`.

/** The ACTUAL producer of the graph under review. §8.12 checks independence against real model/provider identity —
 *  "not a role label such as 'Verifier'" — so this is resolved per run and never a compile-time constant. It was
 *  previously the literal `authoring-executor`, which made `checkIndependence(DIFFERENT_MODEL, …)` a comparison of
 *  two constants: it could never fail, and certified independence on every run. */
export interface FloorProducer {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

export interface FloorObservationView {
	readonly code: string;
	readonly severity: string;
	readonly statement: string;
	/**
	 * ⭐ The review in parts, B4 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D7) — THE TYPE A PART'S OBSERVATION IS
	 * ABOUT, SUPPLIED BY THE HOST: the PWU Type its review was recorded under — that assessment's subject — and the type's
	 * stored name. ⛔ Never read from the reviewer's prose, which may name any type it likes. Absent on an observation of
	 * a policy over the whole PWA, and on any floor that reviews no PWA in parts.
	 */
	readonly typeId?: string;
	readonly typeName?: string;
}

/**
 * ⭐⭐ The review in parts, B3 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1, D6) — ONE TYPE'S REASONING REVIEW IN A
 * FLOOR ROUND: the type, named by the host, at the stored version a review of it is bound to, and that review as it was
 * recorded in the round — or `MISSING`, when the round holds none at that version.
 */
export interface FloorPartView {
	readonly typeId: string;
	readonly typeName: string;
	readonly semanticVersion: number;
	readonly disposition: string;
	/** No independence violation is recorded on the part's review (a `MISSING` part has none recorded either). */
	readonly independenceOk: boolean;
	/** The review's observations, each carrying this part's type (`FloorObservationView.typeId`). */
	readonly observations: FloorObservationView[];
	readonly criteria?: CriterionTally;
	/**
	 * ⭐ The review in parts, B5 (package C's check; roadmap 9a.6, "criterion results") — EACH CRITERION THE PART'S REVIEW
	 * RECORDED, the rows `criteria` tallies: read back from the record (`loadPwaFloor`). Absent on a `MISSING` part, and on the
	 * view a run returns (`runPwaFloor`).
	 */
	readonly criterionResults?: readonly CriterionResultView[];
}

/** A part as the host names it: its type's id and stored name. */
export type FloorPartName = Pick<FloorPartView, 'typeId' | 'typeName'>;

/**
 * ⭐ The review in parts, package E, E1 — PARTS NAMED IN A SENTENCE, as the refinement directive names a type: each one's name
 * quoted, then its id, comma-separated.
 */
export function partsNamed(parts: readonly FloorPartName[]): string {
	return parts.map((p) => `${JSON.stringify(p.typeName)} (${p.typeId})`).join(', ');
}

/**
 * ⭐ The review in parts, B5 (package C's check) — ONE CRITERION'S RECORDED RESULT: the latest `AssuranceCriterionEvaluated` of
 * it (`latestCriterionRows`), and beside it what a TEST stipulated (`REG-D-071`), as the event carries it.
 */
export interface CriterionResultView {
	readonly criterionId: string;
	readonly result?: string;
	readonly stipulated?: string;
}

export interface FloorPolicyView {
	readonly policyId: string;
	readonly disposition: string;
	readonly independenceOk: boolean;
	readonly observations: FloorObservationView[];
	/** ⭐ WHAT THE VERDICT RESTS ON (`JAN-CRITREAD` J1-2; §4.4): recorded criteria a reviewer EVALUATED, and criteria a
	 *  TEST stipulated (`REG-D-071`). Optional: absent on a view built before any criterion was recorded. */
	readonly criteria?: CriterionTally;
}

/** ⭐ `JAN-CRITREAD` J1-2 — a policy's recorded criteria, split by who answered them. */
export interface CriterionTally {
	/** A reviewer reached a result (anything but `UNABLE_TO_DETERMINE`). */
	readonly evaluated: number;
	/** Nobody judged it; the TEST stipulated it clean (`UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it). */
	readonly stipulated: number;
}

/** Tally recorded criterion rows — `outcome` on the floor's own rows, `result` on the event that records them. */
export function tallyCriteria(
	rows: readonly { readonly outcome?: string; readonly result?: string; readonly stipulated?: string }[]
): CriterionTally {
	const result = (r: (typeof rows)[number]) => r.outcome ?? r.result;
	return {
		evaluated: rows.filter((r) => result(r) !== undefined && result(r) !== 'UNABLE_TO_DETERMINE').length,
		stipulated: rows.filter((r) => r.stipulated === 'MET').length
	};
}

/**
 * ⭐ THE ONE-LINE STATUS OF A FLOOR RUN, for the agent's log (`JAN-CRITREAD` J1-2; §4.4). A SATISFIED floor whose
 * reasoning review rests on a TEST's stipulations says so on the same line: the prefix every reader matches on is
 * kept, and what follows it is true. ⭐ The review in parts (`REG-D-125`): a review in parts says over how many types its
 * criteria were counted, every part's together.
 */
export function floorStatusLine(f: FloorView): string {
	if (f.satisfied) {
		const rr = f.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.criteria;
		const over = f.parts === undefined ? '' : ` of ${f.parts.length} type(s)`;
		if (rr && rr.stipulated > 0)
			return `⚖ Assurance floor SATISFIED (test mode) — schema and provenance pass; reasoning review${over}: ${rr.evaluated} criteria evaluated, ${rr.stipulated} stipulated by the test, not reviewed.`;
		return '⚖ Assurance floor SATISFIED — schema, provenance, and an independent reasoning review all pass.';
	}
	const validFindings = classifyFloorRemediation(f).findings.length;
	const gaps = validFindings ? ` · ${validFindings} valid reasoning finding(s)` : '';
	return `⚖ Assurance floor ${f.aggregate}${gaps}.`;
}

/** ⭐ The "assured candidate" line, carrying the same disclosure beside the ✓ (§4.4). */
export function assuredCandidateLine(candidateHash: string, f: FloorView | undefined): string {
	const rr = f?.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.criteria;
	const disclosure =
		rr && rr.stipulated > 0
			? ` Its reasoning review rests on ${rr.stipulated} criteria stipulated by the test, not reviewed (test mode).`
			: '';
	return `✓ Assured candidate ${candidateHash} is staged.${disclosure} Canonical DRAFT is unchanged until you accept this exact preview.`;
}

/**
 * ⭐ `JAN-ESCREC` D3 — THE PWA PAGE'S HEADER CHIP, IN WORDS: *"floor satisfied"*, or the aggregate lower-cased with its
 * underscores read as spaces. The read-back now passes a CONDITIONALLY_SATISFIED review through as itself
 * (`aggregateDisposition`, `floorAggregate` below), and the template's `floor ${aggregate}` then read *"floor
 * conditionally_satisfied"*, the contract's token (the ER-1 app verifier's finding [4]). Nothing asserted the underscore
 * form. The page's load answers it once, beside the floor; `floor.test.ts` holds every aggregate, because the e2e lane
 * may record no positive reasoning review but the stand-in's (`lane-control.ts`, LIMB 2), so no browser test can stage
 * a CONDITIONALLY_SATISFIED review to read the chip from. The panel's own disposition chip keeps the token.
 */
export function floorChipLabel(floor: Pick<FloorView, 'satisfied' | 'aggregate'>): string {
	return floor.satisfied
		? 'floor satisfied'
		: `floor ${floor.aggregate.toLowerCase().replaceAll('_', ' ')}`;
}
export interface FloorView {
	readonly subjectId: string;
	readonly aggregate: string;
	readonly satisfied: boolean;
	/** True iff an EFFECTIVE governance WAIVER covers the subject — ⭐ on a PWA's floor, the PWA or one of its live types, whose
	 *  part a waiver names (package E, E2; `hasEffectiveWaiver`). ⚠ THAT IS ALL IT MEANS. This docblock read
	 *  "— publication is permitted despite the floor", and it was the contract-level source of every waiver claim
	 *  the UI made: `data.floor.waived` gates the badge and the hint on the floor panel, and both said what this
	 *  line told them to say. ASR-3 makes the floor UNCONDITIONAL (REG-F-202), so an EFFECTIVE waiver permits
	 *  NOTHING here — it records accepted risk (ASR-14) while the floor keeps blocking. Fixing the markup without
	 *  fixing this line leaves the next reader authoring the same claim again. */
	readonly waived: boolean;
	readonly policies: FloorPolicyView[];
	/** Open Reasoning-Review observation statements for display. Remediation decisions MUST use the structured
	 *  policy/observation fields above: this list also contains operational findings when review execution fails.
	 *  ⭐ `JAN-ESCREC` D3 (`REG-D-090`): NEVER the reviewer's recommendation (`isReviewerRecommendation`). The page lists
	 *  these under "Reasoning-review findings", and a recommendation is not one; the blocked hint and the resume banner
	 *  carry an escalation, one line beside the findings says it where they do not, in the sentence true of the floor
	 *  (`escalationRecommendationNote`), and the observation stays on `policies` above, as the informational record it
	 *  is. */
	readonly reasoningGaps: string[];
	/**
	 * ⭐⭐ `JAN-EXEC` P7-6 fix round C, C2 (`REG-F-433`; `DESIGN-the-stopped-unit-recovery.md` RD10, as corrected) — THE
	 * FLOOR-RUN TOKEN OF THE REASONING REVIEW THIS VIEW SHOWS: its assessment's correlation, which its run's reviewer calls
	 * carry as their `runToken` (one token per floor run, P7-6 B7). The page hands it to `loadReviewerAnswer`, so the answer
	 * shown under this floor is the one ITS review concluded from — never another run's on the subject.
	 * ⚠ Set by `loadPwaFloor` (the page's read) and `loadSubjectFloor`; absent when no reasoning review is recorded, and on
	 * `runPwaFloor`'s return, which no page renders an answer under. ⭐ The review in parts (`REG-D-125`): on a PWA's floor it is
	 * the ROUND's token, which each part's assessments and reviewer calls carry; the page joins each part's answer to its
	 * part's subject and this token (~~`partAnswers`~~ ⭐ B5: `typeReviews`, `routes/pwa/[id]/+page.server.ts`).
	 */
	readonly reasoningReviewRunToken?: string;
	/**
	 * ⭐⭐ The review in parts, B3 (`REG-D-125`; design D1, D5, D6) — EACH TYPE'S OWN REASONING REVIEW, IN EXPORT ORDER: one part
	 * per type of the PWA. The `floor.reasoning-review` entry of `policies` is their fold (`partsDisposition`), never a
	 * recorded assessment of its own. Set by the authoring floor's two readers (`runPwaFloor`, `loadPwaFloor`); absent on a
	 * floor over any other subject (the execution plane's).
	 */
	readonly parts?: readonly FloorPartView[];
}

/** The authoring-plane response to an unsatisfied floor. Only a valid Reasoning Review finding about the reviewed
 *  subject may be sent back to the producing agent. Validator availability, execution, output-boundary, and
 *  independence failures — ⭐ and a review refused because a model other than the selected one answered it
 *  (`REQUALIFY_OR_RESELECT_REVIEWER`, `JAN-SELRES` D7) — are assurance-control failures; asking the producer to edit
 *  the graph in response would hide the failed control behind unrelated semantic mutation.
 *
 *  ⛔ A NEW MEMBER IS ALSO A NEW CASE IN `isOperationalRemediation`, below, whose `never` default refuses to compile
 *  without one — the authoring route's disposition keys on it. */
export type FloorRemediationAction =
	| 'NONE'
	| 'REFINE_SUBJECT'
	| 'RETRY_OR_CONFIGURE_REVIEWER'
	| 'REQUALIFY_OR_RESELECT_REVIEWER'
	| 'CHANGE_REVIEWER'
	| 'ESCALATE_REVIEW'
	| 'RESOLVE_OTHER_FLOOR_FINDINGS';

/**
 * ⭐ `JAN-SELRES` D7 — IS THIS A PROBLEM WITH THE REVIEW, NOT WITH THE SUBJECT? The authoring route marks a staged
 * candidate `BLOCKED_EXTERNAL` when it is, and `REVISION_REQUIRED` when it is not (`routes/pwa/[id]/agent/+server.ts`).
 *
 * ⛔ AN EXHAUSTIVE SWITCH, NOT A LIST. The route enumerated three actions with `===`, so an action added to the union and
 * missed there fell to `REVISION_REQUIRED` in silence — a refused review recorded as a defect in the candidate. The
 * `never` default makes that miss a COMPILE error instead.
 */
export function isOperationalRemediation(action: FloorRemediationAction): boolean {
	switch (action) {
		case 'RETRY_OR_CONFIGURE_REVIEWER':
		case 'REQUALIFY_OR_RESELECT_REVIEWER':
		case 'CHANGE_REVIEWER':
		case 'ESCALATE_REVIEW':
			return true;
		case 'NONE':
		case 'REFINE_SUBJECT':
		case 'RESOLVE_OTHER_FLOOR_FINDINGS':
			return false;
		default: {
			const unclassified: never = action;
			throw new Error(`Unclassified floor remediation action: ${String(unclassified)}`);
		}
	}
}

export interface FloorRemediation {
	readonly action: FloorRemediationAction;
	readonly autoRefine: boolean;
	/** Structured, valid subject findings that may be given to the authoring agent. Never operational failures — ⭐ and
	 *  never the reviewer's recommendation (`JAN-ESCREC` D3, `isReviewerRecommendation`). */
	readonly findings: readonly FloorObservationView[];
	/** Human/operator guidance. The route emits this verbatim after the fail-closed floor result. */
	readonly guidance: string;
	/**
	 * ⭐ The review in parts, package E, E1 (the lead's decision; DESIGN-authoring-review-in-parts.md D5, D8) — THE PARTS WHOSE
	 * REVIEWS FAILED OPERATIONALLY BESIDE `findings`: set only on the `REFINE_SUBJECT` that answers a round in which other
	 * parts concluded with findings that ask for revision (`revisionBesideFailedParts`). None is a finding; each is reviewed
	 * again, with every part, when assurance reruns.
	 */
	readonly failedParts?: readonly FloorPartName[];
}

/**
 * The review observation codes that say something about the REVIEW, never about the subject — never sent back to the
 * producer as a finding.
 *
 * ⭐ `JAN-SELRES` D7 — EVERY CODE A THROWN VALIDATOR FAILURE MAY CARRY IS ONE, imported from the package's closed set
 * rather than restated: each refines `VALIDATOR_EXECUTION_FAILED`, which it is always recorded beside. ~~⭑ EXPORTED FOR
 * THE PWA PAGE, whose blocked hint keys on these recorded codes (`JAN-SELRES` RS-3, D8).~~
 * ⚠ TODAY THE SUBSTITUTION'S MEMBERSHIP IS UNOBSERVABLE HERE: `classifyFloorRemediation` answers a
 * `VALIDATOR_MODEL_SUBSTITUTED` review before it reaches the one reader below. ~~RS-3's hint is its first reader.~~
 * ⭑ `RS-3` (D8 as revised): the page's hint follows the classifier's ACTION and the non-review policies' dispositions
 * (`floorBlockedHint`, below), never these codes, so the ONE reader of this set is the classifier's subject-finding
 * filter, and it is private to this module. ⚠ AND NOT ONLY THE SUBSTITUTION'S: each member has its own branch ahead of the filter — the substitution, the
 * execution failure (beside which any future member of `VALIDATOR_FAILURE_CODES` is recorded) and the independence
 * violation — so no observation the filter reads carries one, and a mutant of the membership is EQUIVALENT today. The
 * filter is defence in depth: a reordered or dropped branch still cannot send a failure of the review to the producer
 * as a finding about the subject.
 */
const OPERATIONAL_REVIEW_CODES: ReadonlySet<string> = new Set([
	'VALIDATOR_EXECUTION_FAILED',
	'INDEPENDENCE_VIOLATION',
	...VALIDATOR_FAILURE_CODES
]);

/**
 * ⭐⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — THE REVIEWER'S ESCALATED RECOMMENDATION IS RECORDED, AND IS NEVER A FINDING
 * ABOUT THE SUBJECT.
 *
 * `rph-assurance`'s recording plan appends `REVIEWER_RECOMMENDED_ESCALATION` (typed RECOMMENDATION, INFORMATIONAL) to a VALID
 * Reasoning Review whose reviewer recommended the literal ESCALATED, whatever the review's outcome (D2): LAST, beside a
 * REJECTED review's subject finding, and ALONE on the clean review rule (a) escalates (D1). It records what the reviewer
 * RECOMMENDED — it names no criterion and no deficiency — so it is never sent back to the producer as work, never listed
 * among the reasoning-review findings (`reasoningGaps`), and never a waiver's target (`routes/pwa/[id]/+page.server.ts`).
 * Unexcluded, a REJECTED review sent "the reviewing model's recommendation was ESCALATED" back as a defect to repair, and a
 * review that recorded no subject finding at all became a refinement of nothing (`REG-D-059`: *"work from silence"*).
 *
 * ⛔ ITS OWN EXCLUSION, NOT A MEMBER OF `OPERATIONAL_REVIEW_CODES`. That set's members are failures of the REVIEW — each
 * refines `VALIDATOR_EXECUTION_FAILED` or records a failed independence — and a recommendation is not one: a REJECTED review
 * that carries it is still a verdict that judged the subject, and its own finding still goes back.
 * ⭑ IMPORTED, NEVER RESTATED: `o.code === …` is a comparison no compiler checks, and a restated spelling matches only until
 * the package's word moves (`verif/validator-failure-codes-imported.test.ts` holds the app to the import).
 */
const isReviewerRecommendation = (o: { readonly code: string }): boolean =>
	o.code === REVIEWER_RECOMMENDED_ESCALATION;

/** The dispositions that JUDGED the subject and found something in it — the only ones whose findings may
 *  be sent back to the producer. Of `AggregateAssuranceDisposition`'s six members these are the two that
 *  assert something ABOUT THE WORK; the other four assert something about the REVIEW. */
const FEEDS_BACK_TO_PRODUCER: ReadonlySet<string> = new Set(['REJECTED', 'CONDITIONALLY_SATISFIED']);

/** Classify remediation from policy identity, disposition, independence, and observation CODES — never prose.
 *
 * `VALIDATOR_EXECUTION_FAILED` covers missing host configuration and external process/provider failures alike. The
 * exact operational diagnosis remains in the recorded observation, and ~~all such cases have the same safe authoring
 * response~~ every such case keeps the subject preserved and publication blocked. ⭐ `JAN-SELRES` D7 (`REG-F-460`):
 * ONE CASE HAS ITS OWN RESPONSE — a review refused because the reviewing tool reported a model other than the
 * configured and selected one, recorded as `VALIDATOR_MODEL_SUBSTITUTED` beside it (`rph-assurance` D6). Retrying or
 * reconfiguring would bill another call to the same substitute, so it is answered by re-qualification or re-selection;
 * every other execution failure is still answered by repairing, retrying or changing the independent Validator.
 */
export function classifyFloorRemediation(floor: FloorView): FloorRemediation {
	if (floor.satisfied) {
		return { action: 'NONE', autoRefine: false, findings: [], guidance: '' };
	}

	const review = floor.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!review) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not produce a policy result. Configure or register a permitted independent reviewer, then rerun assurance. Do not revise the PWA or record a waiver in response to the missing review.'
		};
	}

	// ⭐ The review in parts, package E, E3 — A PWA WITH NO TYPE HAD NOTHING TO REVIEW. The review is one per type, and the fold
	// of no part is UNASSESSED (`partsDisposition`): answered by the catch-all below, it read "configure or change the
	// reviewer", of a review that called none. Authoring the types answers it, as it answers the schema/invariant policy's
	// finding beside it: a graph with no type has no root.
	if (floor.parts?.length === 0) {
		return {
			action: 'RESOLVE_OTHER_FLOOR_FINDINGS',
			autoRefine: false,
			findings: [],
			guidance:
				"PublishPwa remains blocked because the PWA defines no PWU Type, so the mandatory Reasoning Review, which reviews each of the PWA's types, had nothing to review. Author the PWA's types, then rerun assurance. The reviewer did not fail: do not configure or change it, or record a waiver, in response."
		};
	}

	// ⭐ E1 — a round in parts whose concluded parts ask for revision, beside parts whose reviews failed operationally.
	const revision = revisionBesideFailedParts(floor);
	if (revision !== undefined) return revision;

	// ⭐ `JAN-SELRES` D7 — A SUBSTITUTED MODEL, BEFORE ANY OTHER FAILED REVIEW. ⛔ BEFORE, AND IT MUST BE: the substitution
	// is always recorded BESIDE `VALIDATOR_EXECUTION_FAILED` (it refines it, `rph-assurance` D6), so the execution-failure
	// branch below would take it first and answer "configure or retry" — the remedy its own refusal forbids.
	// ⚠ The guidance is the agent's wording, flagged for the sponsor's confirmation (`REG-D-087`); the confirmed core is
	// only *"re-qualification or re-selection, not reconfiguration"* (`REG-D-085` item 3, `REG-D-086`).
	if (review.observations.some((o) => o.code === VALIDATOR_MODEL_SUBSTITUTED)) {
		return {
			action: 'REQUALIFY_OR_RESELECT_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the reviewing tool reported that a model other than the configured and selected one answered, so the review was refused. Retrying or reconfiguring the same selection does not fix this: another call is billed and may be served the same way. The remedy is a sponsor decision: re-qualify the model the tool actually serves and select it, or re-select the reviewer (REG-D-084, REG-D-086); then configure the host to the new selection. Do not revise the PWA or record a waiver in response to this refusal.'
		};
	}

	const executionFailure = review.observations.some((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
	if (executionFailure) {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review did not execute. Configure or retry the reviewer; if it remains unavailable, change to a permitted independent validator and rerun assurance. Do not revise the PWA or record a waiver in response to this execution failure.'
		};
	}

	if (
		!review.independenceOk ||
		review.observations.some((o) => o.code === 'INDEPENDENCE_VIOLATION')
	) {
		return {
			action: 'CHANGE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was not independent of the producer. Select a permitted reviewer/model/provider that satisfies the policy independence rule, then rerun assurance. Do not revise the PWA or record a waiver in response to this independence failure.'
		};
	}

	if (review.disposition === 'ESCALATED') {
		return {
			action: 'ESCALATE_REVIEW',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review was escalated. Route the recorded review to the governed human or alternate independent-review path, then rerun assurance; an automatic subject edit cannot substitute for the escalation.'
		};
	}

	// ⭐ `JAN-ESCREC` D3 — AND NEVER THE REVIEWER'S RECOMMENDATION (`isReviewerRecommendation`, above). THIS ONE FILTER IS
	// EVERY PATH TO THE PRODUCER: its `findings` are `refineDirective`'s (below) and the authoring route's `priorFindings`,
	// which `runPwaFloor` narrows to each part's own type (`routes/pwa/[id]/agent/+server.ts`), and `openPerTry`'s and
	// `priorFindings`' (`routes/undertakings/[id]/+page.server.ts`), and `floorStatusLine` counts them.
	const subjectFindings = review.observations.filter(
		(o) => !OPERATIONAL_REVIEW_CODES.has(o.code) && !isReviewerRecommendation(o)
	);
	// ⛔ ONLY A DISPOSITION THAT ACTUALLY JUDGES THE SUBJECT MAY SEND WORK BACK TO ITS PRODUCER.
	//
	// This read `disposition !== 'SATISFIED'`, which swept in `INCONCLUSIVE` — and `REG-D-059` rules that out in
	// terms: *"INCONCLUSIVE — the reviewer could not tell — must not feed a finding back to the agent, because
	// there is no finding … Feeding an inconclusive review back as though it were a critique would MANUFACTURE
	// WORK FROM SILENCE."* `ASR-11` limb 1 says the same: a validator failure *"neither rejects nor satisfies
	// the subject."*
	//
	// ⚠ THE GAP WAS UNREACHABLE UNTIL A LIVE REVIEWER EXISTED. The offline arm returns INCONCLUSIVE only with
	// operational codes, which this filter already drops — so the condition could never be met and the defect
	// was invisible. A live model CHOOSES its disposition, and may return INCONCLUSIVE alongside subject-coded
	// observations.
	//
	// ⭑ `UNASSESSED` and `EVIDENCE_REQUIRED` are excluded for their own reasons, not by oversight: nothing
	// assessed the subject in the first, and the remedy is EVIDENCE rather than a subject edit in the second.
	if (FEEDS_BACK_TO_PRODUCER.has(review.disposition) && subjectFindings.length > 0) {
		return {
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: subjectFindings,
			guidance:
				'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.'
		};
	}

	// An unsatisfied/rejected/inconclusive review with no valid subject observations is not an instruction to mutate
	// the subject. It can arise from a missing or boundary-rejected Validator result whose prose is deliberately not
	// interpreted here. Treat it as an assurance-control problem and keep the gate closed.
	if (review.disposition !== 'SATISFIED') {
		return {
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance:
				'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.'
		};
	}

	return {
		action: 'RESOLVE_OTHER_FLOOR_FINDINGS',
		autoRefine: false,
		findings: [],
		guidance:
			'PublishPwa remains blocked by non-review assurance findings. Resolve the coded schema, invariant, identity, or provenance findings and rerun the assurance floor.'
	};
}

/** A part whose review failed operationally — no reply, the output limit, a reply that did not parse after its repair: each a
 *  thrown validator failure, recorded `VALIDATOR_EXECUTION_FAILED` (`rph-assurance` `failedResult`). */
const failedOperationally = (part: FloorPartView): boolean =>
	part.observations.some((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');

/**
 * ⭐⭐ The review in parts, package E, E1 (the lead's decision; DESIGN-authoring-review-in-parts.md D5, D7, D8) — A ROUND IN PARTS
 * IS ANSWERED BY REVISION WHEN ITS CONCLUDED PARTS ASK FOR IT, BESIDE PARTS WHOSE REVIEWS FAILED OPERATIONALLY.
 *
 * ⛔ The fold carries every part's observations, so one part's `VALIDATOR_EXECUTION_FAILED` beside another part's REJECTED
 * review sent the whole round to "configure or retry the reviewer": no finding went back, no refinement ran, and the page said
 * the review produced no usable verdict while it listed the rejected part's finding.
 *
 * So the round without its failed parts is classified as any round is (`floorViewOf` over the other parts, the deterministic
 * policies as recorded), and when that answers `REFINE_SUBJECT` its findings go back, with the failed parts named
 * (`failedParts`): the one automatic refinement runs, and the floor then reviews every part again, the failed ones included
 * (`runPwaFloor` rebuilds the whole inventory; design D8). ⛔ A failed part's record is never a finding (D5), and the round is
 * never SATISFIED by this: `floor` is unchanged, its fold the strictest part's.
 * ⭑ `undefined`, and the ladder answers, when no part failed; when a failed part's review was refused for a substituted model,
 * whose remedy is the sponsor's and which a re-review would bill again (`REQUALIFY_OR_RESELECT_REVIEWER`); and when the other
 * parts are answered otherwise — every part failed (the round without them has no part), the rest SATISFIED, a review not
 * independent of the producer, an escalation, or no finding that asks for revision: today's retry answer stands.
 */
function revisionBesideFailedParts(floor: FloorView): FloorRemediation | undefined {
	const parts = floor.parts ?? [];
	const failed = parts.filter(failedOperationally);
	if (failed.length === 0) return undefined;
	if (failed.some((p) => p.observations.some((o) => o.code === VALIDATOR_MODEL_SUBSTITUTED))) return undefined;
	const concluded = floorViewOf(floor.subjectId, {
		deterministic: floor.policies.filter((p) => p.policyId !== FLOOR_POLICY_IDS.REASONING_REVIEW),
		parts: parts.filter((p) => !failed.includes(p)),
		waived: floor.waived
	});
	const answer = classifyFloorRemediation(concluded);
	if (answer.action !== 'REFINE_SUBJECT') return undefined;
	const failedParts = failed.map((p) => ({ typeId: p.typeId, typeName: p.typeName }));
	return {
		...answer,
		failedParts,
		guidance: `${answer.guidance} The Reasoning Review of ${partsNamed(failedParts)} failed operationally and recorded no finding: that failure is not a defect in the PWA, and every type, the failed ones included, is reviewed again when assurance reruns.`
	};
}

/** How many findings about one type the refinement directive lists; the rest of that type's are counted, never dropped. */
const FINDINGS_LISTED_PER_TYPE = 6;

/**
 * Turn the Reasoning Review's open findings into an auto-refinement directive for the executor (`routes/pwa/[id]/agent/
 * +server.ts`, which sends it once, when `classifyFloorRemediation` answers `REFINE_SUBJECT`).
 *
 * ⭐ The review in parts, B4 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D7) — GROUPED BY TYPE, each type named by the
 * HOST: the id and name each finding carries from the part it was recorded under (`FloorObservationView.typeId`), never
 * from the reviewer's prose. Every type with a finding is listed, in the order the findings come, which is export order;
 * within a type its first `FINDINGS_LISTED_PER_TYPE` findings are, and how many more there are is said on a line of its
 * own. ⛔ It listed the round's first six findings, so a later type's were dropped without a word.
 * ⭐ Package E, E1 — and the types whose reviews failed operationally beside those findings (`FloorRemediation.failedParts`),
 * named on lines of their own after the findings: none is a finding, and each is reviewed again after the revision.
 */
export function refineDirective(
	prompt: string,
	findings: readonly FloorObservationView[],
	failedParts: readonly FloorPartName[] = []
): string {
	const byType = new Map<string, { readonly name?: string; readonly findings: FloorObservationView[] }>();
	for (const finding of findings) {
		const key = finding.typeId ?? '';
		const group = byType.get(key) ?? { name: finding.typeName, findings: [] };
		group.findings.push(finding);
		byType.set(key, group);
	}
	const sections = [...byType].map(([typeId, group]) => {
		const listed = group.findings
			.slice(0, FINDINGS_LISTED_PER_TYPE)
			.map((finding, i) => `${i + 1}. [${finding.code}] ${finding.statement}`);
		const omitted = group.findings.length - listed.length;
		return [
			typeId === ''
				? 'Findings about the PWA as a whole:'
				: `Findings about the type ${JSON.stringify(group.name ?? typeId)} (${typeId}):`,
			...listed,
			...(omitted > 0 ? [`(${omitted} further finding(s) about this type are not listed here.)`] : [])
		].join('\n');
	});
	return [
		'An independent assurance Reasoning Review produced valid findings about the authored PWA subject, reviewed type by type.',
		'Revise the PWA graph and/or its recorded professional rationale as each coded finding requires; do not merely restate the intent:',
		sections.join('\n\n'),
		...(failedParts.length === 0
			? []
			: [
					'',
					`The review of ${failedParts.length} type(s) failed operationally and recorded no finding about them; every type, these included, is reviewed again after this revision. Do not change them on account of that failure:`,
					...failedParts.map((p) => `- ${partsNamed([p])}`)
				]),
		'',
		`Original intent: ${prompt}`
	].join('\n');
}

/** Which of ~~three~~ ~~four~~ five sentences the PWA page's blocked hint reads — see `floorBlockedHint`. ⭐ `JAN-ESCREC` D3
 *  added `'ROUTE_TO_HUMAN'`; ⭐ the review in parts, package E, E1, `'REVISE_BESIDE_FAILED_REVIEWS'`. */
export type FloorBlockedHint =
	'REVISE' | 'NOT_BY_REVISION' | 'REVISE_AND_REVIEW' | 'ROUTE_TO_HUMAN' | 'REVISE_BESIDE_FAILED_REVIEWS';

/**
 * ⭐ `JAN-ESCREC` D3 — DOES A FLOOR POLICY OTHER THAN THE REVIEW RECORD A FINDING AGAINST THE GRAPH? The question the last
 * line of `floorBlockedHint` asks, WRITTEN APART FROM IT ON PURPOSE: that line's predicate is a ledger anchor (`RS3-M29`..
 * `M31`), and an anchor must occur exactly once in its file. So it is asked the other way round here — every policy is
 * the review or is not REJECTED — and neither spelling contains the other.
 */
function rejectsTheGraph(floor: FloorView): boolean {
	return !floor.policies.every(
		(p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW || p.disposition !== 'REJECTED'
	);
}

/**
 * ⭐ `JAN-SELRES` D8 (`REG-F-462`), AS REVISED IN RS-3 — WHICH SENTENCE THE PWA PAGE'S BLOCKED HINT READS. The page renders
 * its hint from this ONE answer, computed on the server from the floor the panel shows. It said *"revise the graph and
 * re-run"* beside every unsatisfied floor, where the floor's own guidance for a failed review says *"Do not revise the
 * PWA"*.
 *   · `undefined` — the floor is SATISFIED: nothing blocks, and the page shows no blocked hint at all.
 *   · `'REVISE'` — `classifyFloorRemediation` answers the block with an action that is NOT operational: a subject finding
 *     to refine (`REFINE_SUBJECT`), or a non-review floor finding beside a review that passed the graph
 *     (`RESOLVE_OTHER_FLOOR_FINDINGS`). Revising the graph answers it.
 *   · `'NOT_BY_REVISION'` — the classifier answers with an operational action (`isOperationalRemediation`) and NO
 *     non-review floor policy is REJECTED. Five of the six operational guidance strings say *"Do not revise the PWA"*;
 *     the escalation's says *"an automatic subject edit cannot substitute for the escalation"*. ⭐ Since `JAN-ESCREC` an
 *     escalation with no REJECTED non-review policy is `'ROUTE_TO_HUMAN'`'s (below), so this answer is the other five's.
 *   · `'REVISE_AND_REVIEW'` — operational, AND a non-review floor policy (schema/invariant or identity/provenance) is
 *     REJECTED: a defect in the graph that revising DOES answer, beside a review that revising does not. An escalation
 *     beside one reads this too, as every operational block does.
 *   · ⭐ `'ROUTE_TO_HUMAN'` (`JAN-ESCREC` D3; `REG-D-090`) — the classifier answers `ESCALATE_REVIEW` and NO non-review floor
 *     policy is REJECTED. The review was escalated — from `JAN-ESCREC`, the clean review whose reviewer recommended
 *     ESCALATED with nothing else in the floor blocking (`rph-assurance` D1) — so the page says the review is routed to a
 *     human, that this workbench cannot record a human's review yet (`REG-F-474`), and that revising the graph does not
 *     address it. It does not say to run assurance again: a re-run re-runs the same automated reviewer (`REG-F-474`).
 *     ⛔ THE INSERTION SHAPE IS THE DESIGN'S: one line after the `'REVISE'` line, asking the classifier AGAIN — never a
 *     cached call, so that line stays byte-identical — and asking `rejectsTheGraph`, never the last line's predicate, which
 *     stays byte-identical too.
 *   · ⭐ `'REVISE_BESIDE_FAILED_REVIEWS'` (the review in parts, package E, E1) — the classifier answers `REFINE_SUBJECT` beside
 *     parts whose reviews failed operationally (`FloorRemediation.failedParts`): revising answers the findings, and the
 *     failed parts are reviewed again, with every part, when the floor re-runs. The page names them beside the sentence
 *     (`floorFailedReviews`, `routes/pwa/[id]/+page.server.ts`). ⛔ Asked one line BEFORE the `'REVISE'` line, which would
 *     take it first, so that line stays byte-identical.
 *
 * ⛔ THE FLOOR'S OWN CLASSIFIER DECIDES WHETHER THE REVIEW IS THE PROBLEM, so the hint and the guidance cannot disagree
 * about the review. This function adds only what the classifier does not ask when it answers an operational review:
 * whether the floor ALSO records a finding against the graph.
 *
 * ⚠ A TWO-WAY ANSWER WAS FALSE FOR THAT SHAPE (the RS-3 re-verifier's MAJOR). Beside a refused substitute on a graph with
 * two roots, the page read "revising it does not address this": false for the schema half, which HEAD's "revise the
 * graph" had got right. RS-3's own route test pinned that floor as its refused-substitute case, because the mock agent's
 * canned graph is not well formed on the reference seed. The fixture was the tell again.
 *
 * ⚠ IT WAS FIRST KEYED ON THE RECORDED CODES (`OPERATIONAL_REVIEW_CODES`), and that missed the blocks the classifier
 * answers without one (the RS-3 verifier's MAJOR 1): an INCOMPLETE review, with no verdict that judged the subject
 * (INCONCLUSIVE, ASSESSING, …), with or without subject-coded observations — the classifier's catch-all, which also takes
 * the INCONCLUSIVE review with nothing recorded that an unregistered draft stages (`e2e/resume-hint.e2e.ts`); an
 * ESCALATED review whose record names no operational code; and NO reasoning-review result at all. The codes were chosen
 * because the waiver e2e staged its revision test's floor ASSESSING with a BLOCKING `RR-04`: a test about a SUBJECT
 * rejection whose fixture recorded an incomplete review. That test now concludes its review REJECTED, and the classifier
 * answers it `REFINE_SUBJECT`.
 *
 * ⭑ ONLY A REJECTED NON-REVIEW POLICY COUNTS: REJECTED is the disposition that records a finding AGAINST the graph. A
 * non-review policy left INCONCLUSIVE or ASSESSING records none. And the review's OWN disposition never counts here: an
 * operational review is answered by the classifier whatever its disposition, and the classifier sends none of its
 * observations back as a finding (`findings: []`).
 *
 * ⭑ A NON-REVIEW POLICY CARRYING ONLY AN OPERATIONAL CODE, BESIDE A REVIEW THAT PASSED (a deterministic validator that did
 * not execute), is the classifier's `RESOLVE_OTHER_FLOOR_FINDINGS`, and so `'REVISE'` here. Whether the classifier should
 * answer that floor so is the classifier's question, not this function's.
 *
 * ⭑ A SATISFIED FLOOR IS `undefined`, NOT `'REVISE'`. The classifier answers it `NONE`, which is not operational, so the
 * first line is what keeps it out of `'REVISE'`. The page renders the hint only under `!data.floor.satisfied`, where the
 * difference is unobservable; `floor.test.ts` pins it.
 */
export function floorBlockedHint(floor: FloorView): FloorBlockedHint | undefined {
	if (floor.satisfied) return undefined;
	if (classifyFloorRemediation(floor).failedParts !== undefined) return 'REVISE_BESIDE_FAILED_REVIEWS';
	if (!isOperationalRemediation(classifyFloorRemediation(floor).action)) return 'REVISE';
	if (classifyFloorRemediation(floor).action === 'ESCALATE_REVIEW' && !rejectsTheGraph(floor)) return 'ROUTE_TO_HUMAN';
	return floor.policies.some(
		(p) => p.policyId !== FLOOR_POLICY_IDS.REASONING_REVIEW && p.disposition === 'REJECTED'
	)
		? 'REVISE_AND_REVIEW'
		: 'NOT_BY_REVISION';
}

/**
 * ⭐ The review in parts, package E, E1 — THE PARTS THE BLOCKED HINT NAMES BESIDE `'REVISE_BESIDE_FAILED_REVIEWS'`: those whose
 * reviews failed operationally, as the classifier names them (`FloorRemediation.failedParts`, `partsNamed`); `undefined` on
 * every other floor.
 */
export function floorFailedReviews(floor: FloorView): string | undefined {
	const failed = classifyFloorRemediation(floor).failedParts;
	return failed === undefined ? undefined : partsNamed(failed);
}

/** Which sentence the floor panel says when the reviewer also recommended escalation — see `escalationRecommendationNote`.
 *  ⭐ `JAN-ESCREC` D3 (the ER-1 app re-verifier's finding [0]): a SENTENCE, never a boolean. */
export type EscalationRecommendationNote = 'BESIDE_FINDINGS' | 'WITH_AN_INCOMPLETE_REVIEW';

/**
 * ⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — WHAT THE FLOOR PANEL SAYS WHEN THE REVIEWER ALSO RECOMMENDED ESCALATION:
 * WHICH of two informational sentences, never whether one. One line, beside the findings and never among them, rendered
 * AFTER the blocked hint so the instruction keeps its place on screen (`routes/pwa/[id]/+page.svelte`):
 *   · `'BESIDE_FINDINGS'` — *"The reviewer also recommended escalation to a human reviewer. The recommendation is recorded
 *     beside the findings, which are addressed first (REG-D-089)."* The hint says to revise (`'REVISE'` or
 *     `'REVISE_AND_REVIEW'`): the floor records findings revising answers, and they are addressed first.
 *   · `'WITH_AN_INCOMPLETE_REVIEW'` — *"The reviewer also recommended escalation to a human reviewer. The review reached no
 *     usable verdict; the recommendation is recorded with it (REG-D-089)."* The hint says revising does not address the
 *     block (`'NOT_BY_REVISION'`): D2 records the recommendation on a VALID INCONCLUSIVE review too — a reply that left a
 *     criterion unanswered — and that review has no finding to be addressed first.
 *   · `undefined` — the floor is satisfied (its hint is `undefined`: nothing blocks, and nothing is addressed first); the
 *     latest reasoning review carries no recommendation (keyed on its imported CODE, `isReviewerRecommendation`, never on
 *     prose); or the hint routes the review to a human (`'ROUTE_TO_HUMAN'` says the escalation itself, so the line would
 *     say it twice).
 *
 * ⛔ WHAT WAS WRONG, TWICE. (1) The ER-1 app verifier's finding [7]: the recommendation is recorded whatever the review's
 * outcome (`rph-assurance` D2), and beside a REJECTED review, or one KEPT SATISFIED because another floor policy blocks, the
 * page showed it nowhere — the policy list renders no observation, `reasoningGaps` excludes it, and the hint and the resume
 * banner key on `ESCALATE_REVIEW`. (2) The ER-1 app re-verifier's finding [0] (its mutant `ER1-V153`): that first answer was
 * a BOOLEAN (`escalationRecommendedBesideTheFindings`), and its one sentence was shown beside an incomplete review as well —
 * "recorded beside the findings, which are addressed first", beside no finding, under a hint saying revising does not
 * address the block. `REG-D-090` accepted option (a), no hard stop, on the condition that the operator is told honestly;
 * so the server answers which sentence, and the template renders exactly one, restating no code.
 *
 * ⛔ KEYED ON THE HINT'S ANSWER, NOT ON THE REVIEW'S DISPOSITION: an ESCALATED review beside a REJECTED identity policy reads
 * `'REVISE_AND_REVIEW'`, which names no escalation, so the line is said there, beside the findings. ⭑ AN EXHAUSTIVE SWITCH,
 * so a fifth answer of the hint must be decided here before this compiles. Neither sentence names a waiver or a route past
 * the floor (ASR-3).
 */
export function escalationRecommendationNote(
	floor: FloorView
): EscalationRecommendationNote | undefined {
	const review = floor.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (review?.observations.some(isReviewerRecommendation) !== true) return undefined;
	const hint = floorBlockedHint(floor);
	switch (hint) {
		case 'REVISE':
		case 'REVISE_AND_REVIEW':
			return 'BESIDE_FINDINGS';
		// ⭐ Package E, E1 — the findings of the parts whose reviews concluded are addressed first, beside those that failed.
		case 'REVISE_BESIDE_FAILED_REVIEWS':
			return 'BESIDE_FINDINGS';
		case 'NOT_BY_REVISION':
			return 'WITH_AN_INCOMPLETE_REVIEW';
		// ⭑ ROUTE_TO_HUMAN says the escalation itself. And a SATISFIED floor's hint is `undefined` (`floorBlockedHint`'s first
		// line): nothing blocks, nothing is addressed first — asked once, here, rather than again above, where a second test
		// of `satisfied` could never fail.
		case 'ROUTE_TO_HUMAN':
		case undefined:
			return undefined;
		default: {
			const unanswered: never = hint;
			throw new Error(`Unanswered floor blocked hint: ${String(unanswered)}`);
		}
	}
}

/**
 * The identity/provenance/trace facts (§8.4 step 2) DERIVED from the real PWA object under review, not asserted.
 * These were five literal `true`s — a floor step that certifies itself and can never fail (findings 18/67; the
 * vacuity audit). Four are now computed: a PWA missing a stable id, a semantic version, a provenance record, or
 * an identified producer now fails IP-01/02/03/04 and blocks, as §8.4 step 2's checks require. "The engine
 * always adds provenance" is exactly the complacency the floor exists to counter — it re-checks rather than trusts.
 *
 * `traceComplete` (IP-05) stays asserted and is DISCLOSED as withheld: §8.4 step 2 names a "trace completeness"
 * check, but no ratified definition of trace-completeness exists as a computable predicate (the causal chain §5.6
 * describes is not contracted as one condition), and §0.3 forbids an agent inventing one. It becomes real the
 * moment that definition lands — the same posture as the readiness guard's withheld limbs and the waiver.
 */
export function identityProvenanceFactsOf(
	pwa: Record<string, unknown>,
	producer: FloorProducer
): IdentityProvenanceFacts {
	const id = pwa.id;
	const prov = pwa.provenance as { originType?: unknown } | undefined;
	return {
		hasStableId: typeof id === 'string' && id.length > 0,
		hasSemanticVersion: Number(pwa.semanticVersion) >= 1,
		hasProvenance: !!prov && typeof prov.originType === 'string' && prov.originType.length > 0,
		hasProducer:
			producer.agentId.length > 0 &&
			(producer.modelId.length > 0 || producer.providerId.length > 0),
		traceComplete: true // WITHHELD — no ratified trace-completeness definition; see the doc comment.
	};
}

/** True iff an EFFECTIVE governance WAIVER Decision covers one of `subjectIds`. ⚠ NOT "the auditable override of a
 *  blocking floor", which is what this said: under ASR-3 nothing overrides the floor. It is an auditable record
 *  of accepted risk, and the floor blocks regardless (REG-F-202). ⭐ The review in parts, package E, E2: a PWA's floor asks
 *  of the PWA and of each of its live types, since a waiver of a part's finding names the type it was recorded about. */
function hasEffectiveWaiver(engine: AuthedEngineHandle, ...subjectIds: string[]): boolean {
	// WORKSPACE, and deliberately so (SPEC-001 INV-02 / FORK-9): this lookup's subjects are the `subjectIds` argument
	// filtered below, not an Undertaking. A waiver may be authored anywhere in the workspace and still cover this
	// subject, so narrowing the read to one Undertaking would hide legitimate overrides.
	return listDecisions(engine, { kind: 'WORKSPACE' }).some(
		(d) =>
			d.state.decisionType === 'WAIVER' &&
			d.state.status === 'EFFECTIVE' &&
			subjectIds.some((id) => (d.state.subjectObjectIds as string[] | undefined)?.includes(id) === true)
	);
}

/** How many times the canonical exchange drain tries a write the store reported BUSY before recording the shortfall. */
const BUSY_ATTEMPTS = 3;

/**
 * ⭑ `JAN-CRITREAD` `DD-1`: a busy store must not lose a try (PER-9). Every outermost write now takes the store's
 * lock up front, so a write that meets another process's long commit waits the busy timeout and then fails with
 * `RPH_STORE_BUSY` — nothing written. For the record of an act that happened, that is a bounded retry, then the
 * disclosed shortfall the drain already reports. Any other failure is not retried.
 */
function retryingWhenBusy(handle: AuthedEngineHandle): Pick<AuthedEngineHandle, 'dispatch'> {
	return {
		dispatch(command) {
			for (let attempt = 1; ; attempt += 1) {
				try {
					return handle.dispatch(command);
				} catch (error) {
					if ((error as { code?: unknown }).code !== 'RPH_STORE_BUSY' || attempt >= BUSY_ATTEMPTS) throw error;
				}
			}
		}
	};
}

/**
 * Run the de minimis floor over the current DRAFT PWA graph and RECORD it as canonical assessments/observations.
 * Returns the composed view (or undefined if the PWA/graph is unavailable). `priorFindings` are surfaced to the
 * Reasoning Review so a re-run judges whether the previous findings are genuinely resolved.
 *
 * ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B3 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1, D5, D6, D9) — ONE
 * ROUND, REVIEWED IN PARTS. The export is built once; the PWA's two deterministic policies are run once over the PWA; the
 * Reasoning Review is run once per type, sequentially in export order, over that type's part (`pwaTypeParts`, through
 * `pwaTypeReviewInput`), its subject the PWU Type at its stored semantic version. ⛔ One reviewer reading the whole PWA saw
 * about half of run-11's 16 types once their prompts and policies were exported (`REG-F-571`). Each part is composed on
 * its own — never into one policy-keyed map, which keeps one result per policy (`rph-assurance` `floor.ts`) — and the parts
 * fold to the strictest unresolved part's (`partsDisposition`), beside the deterministic outcomes. The round is recorded
 * as one plan for the deterministic policies and one plan per part, under ONE floor-run token, each with a command prefix
 * of its own; each part's exchanges are drained under that part's own subject.
 */
export async function runPwaFloor(
	pwaId: string,
	opts: {
		prompt: string;
		/** REQUIRED: the actual resolved producer. An unresolved producer means §8.12 independence cannot be
		 *  established, so there is no honest default — callers must supply it or not run the floor. */
		producer: FloorProducer;
		/** The §9.7 contracted account the producer RETURNED. Undefined = it declared none; the Validator records
		 *  that shortfall rather than inferring anything from the silence. */
		rationale?: ProfessionalRationaleSummary;
		/** Exact app-local semantic hash of the PWA/PWU-Type candidate reviewed in this run. */
		candidateSubjectHash?: string;
		/** MXR-05: the model call, injectable so the retention wiring is reachable in a gate rather than only
		 *  by spawning a real agy. See createFloorRegistry's own note. */
		print?: AgyPrint;
		/**
		 * The CANONICAL handle the exchange records are written through.
		 *
		 * ⛔ NEVER PASS THE CANDIDATE FORK HERE. The default is the workbench's canonical engine, and it is
		 * correct: a `MODEL_EXCHANGE` records an act that HAPPENED, so it must survive a discarded turn. This
		 * exists because `runPwaFloor` otherwise reaches module state (`getEngine()`), which no test can
		 * observe — the drain would dispatch into an engine the caller cannot see, and the wiring would be
		 * unassertable. Tests pass their own host; production omits it.
		 *
		 * ⛔ AND IT IS REFUSED WHEN `engine` IS AN ACTIVE AUTHORING TURN'S FORK (`JAN-CRITREAD` `TT-2`). There
		 * the drain goes through the turn's canonical WITNESS (`canonicalActsOf`), which is what lets the turn's
		 * commit admit its own reviewer's records. An explicit handle would drain unwitnessed and silently
		 * reproduce `REG-F-425`: a really-reviewed turn that refuses its own candidate.
		 */
		canonical?: AuthedEngineHandle;
		/** The content plane, injectable so a gate can assert against a store it controls. */
		artifacts?: ArtifactStore;
		/** The producer's observable narration — §8.4 admits "other observable trace data". Never its interior. */
		narration?: string;
		/**
		 * ⭐ The review in parts, B4 (`REG-D-125`; design D4, D8) — the findings the previous round sent back to the producer,
		 * each carrying its type (`FloorObservationView.typeId`). A part is shown its own type's, never another's: a claim
		 * about another type belongs to that type's review.
		 */
		priorFindings?: readonly FloorObservationView[];
	},
	// This path RECORDS an assurance floor, so it needs a session. SESSION rather than SYSTEM: the floor
	// is run because a professional asked for it, and the record should say so.
	engine: AuthedEngineHandle = getEngine().as(SESSION_CREDENTIAL)
): Promise<FloorView | undefined> {
	const witness = canonicalActsOf(engine);
	if (witness && opts.canonical) {
		throw new Error(
			'runPwaFloor on an authoring turn records its tries through the turn’s own canonical witness; ' +
				'an explicit `canonical` would drain them unwitnessed and the turn would refuse its own candidate.'
		);
	}
	const pwa = getObject(engine, pwaId);
	const graphExport = buildPwaExport(pwaId, engine);
	if (!pwa || !graphExport) return undefined;
	const report = analyzePwaGraph(graphExport);
	const producer = { actorType: 'AGENT' as const, ...opts.producer };
	const subject: AssuranceSubject = {
		subjectId: pwaId,
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: Number(pwa.semanticVersion ?? 1),
		isAiProduced: true,
		producer
	};
	const ctx: ValidatorContext = {
		schemaInvariant: {
			schemaValid: true, // the PWA + PWU Types are engine-validated on creation
			invariantViolations: report.valid ? [] : ['PWA_GRAPH_NOT_WELL_FORMED']
		},
		identityProvenance: identityProvenanceFactsOf(pwa, opts.producer)
	};
	// MXR-05. BOTH OR NEITHER: `captureTry` refuses a store supplied without a sink, because bytes retained
	// with no record referencing them are the orphan REG-F-336 C-2 forbids.
	//
	// ⚠ THE STORE IS PROCESS-LOCAL AND THAT IS LAWFUL ONLY BECAUSE IT IS DISCLOSED. This record plane is
	// durable (SQLite) while the content plane is not, so after a restart a permanent record names bytes that
	// are gone. REG-F-342 made that visible instead of silent: the store DECLARES its durability and every
	// stored ref carries it, so the record says on its face that its content is process-local. The §31 durable
	// adapter (MXR-07) is what turns the disclosure into a fix.
	const artifacts = opts.artifacts ?? getArtifactStore();
	const exchanges = createExchangeSink();
	const registry = createFloorRegistry({
		testMode: isTestMode(),
		artifacts,
		exchanges,
		...(opts.print ? { print: opts.print } : {}),
		// ⭐ B6 — EACH PART IS ASKED ABOUT WITH THE PWA IT BELONGS TO, which this floor knows: the part's own registration,
		// else its PWA's (`stipulationFor`). Nothing is read from any engine to do it, so a turn's fork sees no extra by-id
		// read (`REG-D-072` D6).
		stipulations: (s, framing) =>
			framing === 'PWA_TYPE' ? stipulationFor(pwaId, 'PWA_TYPE', s.subjectId) : undefined
	});
	// ⭐ THE ENGINE THIS FLOOR RECORDS INTO decides whether a stipulated answer counts (`REG-D-071` Q5) — the same
	// engine whose Gate E will judge the completion, so the two cannot disagree. Never `isTestMode()`.
	const composing: ComposeOptions = { admitStipulatedAnswers: engine.admitStipulatedAnswers };
	const deterministic = await runFloorPolicies(subject, ctx, registry, [
		FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
	]);
	const pwaPlan = assuranceRecordingPlan(subject, deterministic.plan, deterministic.results, composing);
	// ⭐ THE PARTS, ONE AFTER ANOTHER IN EXPORT ORDER (design D9), each through the one builder qualification replays
	// (`pwaTypeReviewInput`), with the POLICY's criteria read from the store (`reasoningReviewCriteria`) and its subject the
	// type at the version the store holds — read by its id from the same listing the export was built from.
	const criteria = reasoningReviewCriteria(engine);
	const stored = storedTypes(engine, pwaId);
	const reviewed: ReviewedPart[] = [];
	for (const part of pwaTypeParts(graphExport)) {
		const partSubject: AssuranceSubject = {
			subjectId: part.typeId,
			objectType: 'PWU_TYPE',
			semanticVersion: stored.get(part.typeId)!.semanticVersion,
			isAiProduced: true,
			producer
		};
		const reasoningReview = pwaTypeReviewInput({
			criteria,
			prompt: opts.prompt,
			part,
			candidateSubjectHash: opts.candidateSubjectHash,
			rationale: opts.rationale,
			narration: opts.narration,
			priorGaps: (opts.priorFindings ?? [])
				.filter((f) => f.typeId === part.typeId)
				.map((f) => f.statement)
		});
		// The sink keeps every try of the round in order, so this part's are the ones its own review added.
		const before = exchanges.drain().length;
		const run = await runFloorPolicies(partSubject, { reasoningReview }, registry, [
			FLOOR_POLICY_IDS.REASONING_REVIEW
		]);
		reviewed.push({ part, subject: partSubject, run, tries: exchanges.drain().slice(before) });
	}
	const partPlans = composeParts(reviewed, pwaPlan, composing);
	// ⭐⭐ `JAN-EXEC` P7-6 B7 — `REG-F-433`'s JOIN KEY: ONE TOKEN FOR THIS FLOOR RUN, minted once (RD10, as corrected; the
	// execution plane's twin is `floor-over-subject.ts`, `floorRunToken`). ⛔ The assessments were correlated
	// `authoring-floor:<candidate hash>` — the same for every run over one candidate, and bare `authoring-floor` with none —
	// and the exchanges `model-exchange:<pwaId>` with a SECOND `mintUiId('floorrun')` for their `runToken`: nothing joined a
	// run's assessments to its own reviewer calls, and `loadReviewerAnswer` returned the older run's answer on a tie. Now
	// the assessments' correlation, the exchanges' `runToken` and their correlation are this one token. ⭑ Lossless: it is
	// the old correlation — the plane and the candidate's hash — followed by the run's own id, the recording's `idPrefix`.
	// ⚠ ON A TURN the assessments go to the fork and the exchanges to canonical (`REG-F-433`'s "DIFFERENT STORES"): the
	// token is a string both carry, so the join survives the turn's commit, which replays the fork's commands unchanged.
	// ⭐ B3 — AND IT IS THE WHOLE ROUND'S: the PWA's plan and every part's carry it, so the round's readers can ask for the
	// complete inventory under one token (`loadPwaFloor`; `rph-application`'s publication gate).
	const floorRunId = mintUiId('floorrun');
	const floorRunToken = `${opts.candidateSubjectHash ? `authoring-floor:${opts.candidateSubjectHash}` : 'authoring-floor'}:${floorRunId}`;
	const record = (plan: AssuranceRecordingPlan, idPrefix: string) =>
		recordAssuranceRecordingPlan(engine, plan, {
			issuedAt: hostNow(),
			correlationId: floorRunToken,
			idPrefix,
			newId: (prefix) => mintUiId(prefix)
		});
	record(pwaPlan, floorRunId);
	// ⛔ A PREFIX OF ITS OWN FOR EACH PART: the recorder numbers its commands from one in every plan, and a command whose
	// idempotency key repeats is answered DUPLICATE — accepted by the recorder, and never applied.
	reviewed.forEach((r, i) => record(partPlans[i]!, `${floorRunId}-${r.part.typeId}`));
	// ⭑ THE DRAIN — PER-9's durable exchange record, one per bounded try, ⭐ B3: each part's tries under that part's own
	// subject, the type at the version its review was bound to.
	//
	// ⛔ ON THE CANONICAL HANDLE, DELIBERATELY, AND NOT ON `engine`. This function is called with
	// `turn.engine` — the authoring fork's CANDIDATE engine (`+server.ts:127`, `:153`). Dispatching there
	// would make every exchange record live or die with the turn, and a try that was MADE, cost money and
	// produced a bad answer is precisely the try PER-9 wants kept. Recording an act that happened is not
	// candidate state. That property is why REG-D-055 made this record its own aggregate, and routing it
	// through the fork would silently hand it back.
	//
	// ⭐ ON A TURN, THROUGH THE TURN'S WITNESS (`JAN-CRITREAD` `TT-2`, `REG-F-425`): the same canonical store and
	// the same SESSION principal, one dispatch per try — but the events it produces are NOTED as the turn's own
	// acts, so its commit admits them. Undrained through the witness, each try refused the turn's own candidate.
	const canonical = retryingWhenBusy(
		opts.canonical ?? witness?.as(SESSION_CREDENTIAL) ?? getEngine().as(SESSION_CREDENTIAL)
	);
	for (const r of reviewed) drainTries(canonical, r, floorRunToken);

	return floorViewOf(pwaId, {
		deterministic: pwaPlan.assessments.map((a) => ({
			policyId: a.policyId,
			disposition: a.disposition,
			independenceOk: a.independenceOk,
			observations: a.observations.map((o) => ({
				code: o.code,
				severity: o.severity,
				statement: o.statement
			})),
			criteria: tallyCriteria(a.criteria)
		})),
		parts: reviewed.map((r, i) => {
			const a = partPlans[i]!.assessments.find((x) => x.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
			const named = { typeId: r.part.typeId, typeName: r.part.subject.type.name };
			return {
				...named,
				semanticVersion: r.subject.semanticVersion,
				disposition: a?.disposition ?? PART_MISSING,
				// No review recorded, no violation recorded: a MISSING part blocks on its own.
				independenceOk: a?.independenceOk ?? true,
				observations: (a?.observations ?? []).map((o) => ({
					code: o.code,
					severity: o.severity,
					statement: o.statement,
					...named
				})),
				...(a === undefined ? {} : { criteria: tallyCriteria(a.criteria) })
			};
		}),
		waived: hasEffectiveWaiver(engine, pwaId, ...stored.keys())
	});
}

/** One part of a round, reviewed: the part, its subject, the review's run, and the tries that review made. */
interface ReviewedPart {
	readonly part: PwaTypePart;
	readonly subject: AssuranceSubject;
	readonly run: Awaited<ReturnType<typeof runFloorPolicies>>;
	readonly tries: readonly ExchangeRecord[];
}

/** The disposition of a part the round holds no review of, at the version the store holds. */
const PART_MISSING = 'MISSING';

const reviewIn = (plan: AssuranceRecordingPlan) =>
	plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);

/**
 * ⭐ B3 — EACH PART'S PLAN, COMPOSED ALONE, THEN `REG-D-089`'S CONDITION (iv) READ ACROSS THE ROUND. A part's plan holds its
 * review and nothing else, so composed alone a clean review its reviewer escalates is ESCALATED whatever the rest of the
 * round holds. The ruling escalates only when *"nothing else already blocks"*: so where the PWA's deterministic policies,
 * or another part's review as the ladder computed it, are not SATISFIED, the part is composed again knowing it
 * (`blockedOutsideThePlan`), and keeps the ladder's SATISFIED with its recommendation recorded beside it.
 */
function composeParts(
	reviewed: readonly ReviewedPart[],
	pwaPlan: AssuranceRecordingPlan,
	composing: ComposeOptions
): AssuranceRecordingPlan[] {
	const alone = reviewed.map((r) =>
		assuranceRecordingPlan(r.subject, r.run.plan, r.run.results, composing)
	);
	// What each review computed before the rule moved it: only a SATISFIED review is ever escalated.
	const computed = alone.map((plan) => {
		const disposition = reviewIn(plan)?.disposition;
		return disposition === 'ESCALATED' ? 'SATISFIED' : disposition;
	});
	return alone.map((plan, i) => {
		if (reviewIn(plan)?.disposition !== 'ESCALATED') return plan;
		const blocked =
			!pwaPlan.gatePermitsTransition || computed.some((d, j) => j !== i && d !== 'SATISFIED');
		if (!blocked) return plan;
		const r = reviewed[i]!;
		return assuranceRecordingPlan(r.subject, r.run.plan, r.run.results, {
			...composing,
			blockedOutsideThePlan: true
		});
	});
}

/** Record one part's tries, through `canonical`, under the part's own subject and the round's token. */
function drainTries(
	canonical: Pick<AuthedEngineHandle, 'dispatch'>,
	reviewed: ReviewedPart,
	floorRunToken: string
): void {
	if (reviewed.tries.length === 0) return;
	const outcome = recordExchanges(
		(payload, aggregateId) =>
			canonical.dispatch({
				commandId: mintUiId('cmd'),
				commandType: 'RecordModelExchange',
				commandSchemaVersion: 1,
				targetAggregateType: 'MODEL_EXCHANGE',
				targetAggregateId: aggregateId,
				issuedAt: hostNow(),
				// ⭐ B7 — the run's token, as its assessments carry it: never the subject's constant.
				correlationId: floorRunToken,
				idempotencyKey: `mex:${aggregateId}`,
				payload
			}),
		reviewed.tries,
		{
			// ⭐ B7 — THE SAME TOKEN, never a second mint: the field `loadReviewerAnswer` groups a run's calls by.
			runToken: floorRunToken,
			plane: 'ASSURANCE',
			invokerId: 'agy.reasoning-review',
			assurancePolicyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			// ⭐ B3 — the part's own subject: the type, at the version its review was bound to (design D6).
			subjectObjectId: reviewed.subject.subjectId,
			subjectObjectType: 'PWU_TYPE',
			subjectSemanticVersion: reviewed.subject.semanticVersion,
			newId: (prefix) => mintUiId(prefix)
		}
	);
	// A retention fault must not fail an assurance run that already reached its conclusion — but it must
	// not vanish either. Surfacing it is the disclosed shortfall PER-9 permits; swallowing it is the
	// silent omission it forbids.
	if (outcome.failures.length > 0)
		console.warn(
			`[MXR] ${outcome.recorded}/${reviewed.tries.length} exchange records written; ${outcome.failures.length} failed: ${outcome.failures.join('; ')}`
		);
}

/** A PWA's live types as the store holds them, by id, in the order the export lists them: each one's name and version. */
function storedTypes(
	engine: EngineHandle,
	pwaId: string
): Map<string, { readonly name: string; readonly semanticVersion: number }> {
	return new Map(
		listPwuTypes(engine, pwaId).map((t) => [
			t.id,
			{
				name: String((t.state.name ?? t.id) as string),
				semanticVersion: Number(t.state.semanticVersion ?? 1)
			}
		])
	);
}

/**
 * ⭐⭐ The review in parts, B3 (`REG-D-125`; design D5; ASR-10, RPH-ASR-012) — THE PWA'S REASONING REVIEW OUTCOME IS THE
 * STRICTEST UNRESOLVED PART'S (`aggregateDisposition`). Every part is required: one rejected part among satisfied ones
 * keeps it REJECTED, and a part with no concluded review — missing from the round, stale, or still in progress — leaves
 * it UNASSESSED. ⛔ A PWA with no part has no review at all, so it is UNASSESSED too: the fold of nothing is not a
 * SATISFIED. ⭑ An escalated part is kept as itself where nothing but escalations is unresolved, so the classifier routes
 * it to a human; the aggregate alone reads a required ESCALATED as INCONCLUSIVE.
 */
export function partsDisposition(parts: readonly Pick<FloorPartView, 'disposition'>[]): string {
	if (parts.length === 0) return 'UNASSESSED';
	const folded = aggregateDisposition(
		parts.map(
			(p): PolicyAssessment => ({
				required: true,
				disposition: CONCLUDED_DISPOSITIONS.has(p.disposition)
					? (p.disposition as PolicyAssessment['disposition'])
					: 'MISSING'
			})
		)
	);
	return folded === 'INCONCLUSIVE' &&
		parts.every((p) => p.disposition === 'SATISFIED' || p.disposition === 'ESCALATED')
		? 'ESCALATED'
		: folded;
}

/** The floor's three policies, in the order every view lists them. */
const FLOOR_ORDER = [
	FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
	FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
	FLOOR_POLICY_IDS.REASONING_REVIEW
];

/**
 * ⭐ B3 — ONE ROUND AS THE PAGE AND THE ROUTE READ IT: the deterministic policies as recorded, and the Reasoning Review as
 * the fold of its parts — its disposition `partsDisposition`'s, its observations every part's in export order, each
 * carrying its type, and its criteria their sum. ⚠ That review entry is a VIEW of the parts, and no assessment of its own.
 */
function floorViewOf(
	pwaId: string,
	round: {
		readonly deterministic: readonly FloorPolicyView[];
		readonly parts: readonly FloorPartView[];
		readonly waived: boolean;
		readonly runToken?: string;
	}
): FloorView {
	const review: FloorPolicyView = {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		disposition: partsDisposition(round.parts),
		independenceOk: round.parts.every((p) => p.independenceOk),
		observations: round.parts.flatMap((p) => p.observations),
		criteria: {
			evaluated: round.parts.reduce((n, p) => n + (p.criteria?.evaluated ?? 0), 0),
			stipulated: round.parts.reduce((n, p) => n + (p.criteria?.stipulated ?? 0), 0)
		}
	};
	const policies = [...round.deterministic, review];
	return {
		subjectId: pwaId,
		aggregate: floorAggregate(FLOOR_ORDER, policies),
		satisfied: FLOOR_ORDER.every(
			(policyId) => policies.find((p) => p.policyId === policyId)?.disposition === 'SATISFIED'
		),
		waived: round.waived,
		policies,
		// ⭐ `JAN-ESCREC` D3 — never the reviewer's recommendation: it stays on `policies`, and is not a finding.
		reasoningGaps: review.observations
			.filter((o) => !isReviewerRecommendation(o))
			.map((o) => o.statement),
		// ⭐ C2 — the shown round's own floor run, read from ITS record: the answer under this floor is joined to it.
		...(round.runToken === undefined ? {} : { reasoningReviewRunToken: round.runToken }),
		parts: round.parts
	};
}

interface LatestAssessment {
	readonly id: string;
	readonly state: Record<string, unknown>;
	readonly at: string;
}

const subjectsOf = (state: Record<string, unknown>): readonly string[] =>
	Array.isArray(state.subjectObjectIds) ? (state.subjectObjectIds as string[]) : [];

const isDeterministicFloorPolicy = (id: unknown): boolean =>
	id === FLOOR_POLICY_IDS.SCHEMA_INVARIANT || id === FLOOR_POLICY_IDS.IDENTITY_PROVENANCE;

const isFloorPolicy = (id: unknown): boolean =>
	isDeterministicFloorPolicy(id) || id === FLOOR_POLICY_IDS.REASONING_REVIEW;

/** The later of two assessments by `updatedAt`, ties to the one seen last — the order every floor reader ranks by. */
const later = (prev: LatestAssessment | undefined, next: LatestAssessment): LatestAssessment =>
	!prev || next.at >= prev.at ? next : prev;

/**
 * ⭐⭐ The review in parts, B3 (`REG-D-125`; design D6) — THE LATEST RECORDED ROUND OF A PWA'S FLOOR, NEVER A PER-POLICY
 * LATEST. The round is the floor run of the latest floor assessment over the PWA's deterministic policies or over one of
 * its live types' Reasoning Review — its floor-run token, `REG-F-433`'s join key, read off its first event. Its
 * deterministic assessments are the PWA's under that token, and its parts the latest Reasoning Review of each live type
 * under that token. ⛔ So a part a newer round does not hold is not read from an older one: a partial newer round never
 * borrows an older part's result. ⚠ A review of the PWA as a whole graph is in no round's inventory.
 */
function latestFloorRound(
	engine: AuthedEngineHandle,
	pwaId: string,
	typeIds: ReadonlySet<string>
):
	| {
			readonly token: string | undefined;
			readonly deterministic: ReadonlyMap<string, LatestAssessment>;
			readonly parts: ReadonlyMap<string, LatestAssessment>;
	  }
	| undefined {
	const tokens = new Map<string, string>();
	for (const e of engine.readAllEvents())
		if (e.aggregateType === 'ASSURANCE_ASSESSMENT' && !tokens.has(e.aggregateId))
			tokens.set(e.aggregateId, e.correlationId);
	const inRound: { readonly a: LatestAssessment; readonly key: string; readonly part: boolean }[] = [];
	let newest: LatestAssessment | undefined;
	// WORKSPACE: the subjects here are a PWA and its types, which no Undertaking owns — the subject filter on the next lines
	// is this query's real scope. An UNDERTAKING scope would return nothing.
	for (const r of listAssessments(engine, { kind: 'WORKSPACE' })) {
		const policy = r.state.assurancePolicyId;
		const subjects = subjectsOf(r.state);
		const a = { id: r.id, state: r.state, at: String((r.state.updatedAt ?? '') as string) };
		if (subjects.includes(pwaId) && isDeterministicFloorPolicy(policy))
			inRound.push({ a, key: String(policy), part: false });
		else if (policy === FLOOR_POLICY_IDS.REASONING_REVIEW) {
			const typeId = subjects.find((s) => typeIds.has(s));
			if (typeId === undefined) continue;
			inRound.push({ a, key: typeId, part: true });
		} else continue;
		newest = later(newest, a);
	}
	if (newest === undefined) return undefined;
	const token = tokens.get(newest.id);
	const deterministic = new Map<string, LatestAssessment>();
	const parts = new Map<string, LatestAssessment>();
	for (const { a, key, part } of inRound) {
		if (tokens.get(a.id) !== token) continue;
		const into = part ? parts : deterministic;
		into.set(key, later(into.get(key), a));
	}
	return { token, deterministic, parts };
}

/** Observations of the named assessments, grouped by their assessment id. */
function observationsOf(
	engine: AuthedEngineHandle,
	assessmentIds: ReadonlySet<string>
): Map<string, FloorObservationView[]> {
	const byId = new Map<string, FloorObservationView[]>();
	// WORKSPACE, for the same reason as the round above: the subjects are a PWA and its types.
	for (const o of listObservations(engine, { kind: 'WORKSPACE' })) {
		const aid = String((o.state.assessmentId ?? '') as string);
		if (!assessmentIds.has(aid)) continue;
		const list = byId.get(aid) ?? [];
		list.push({
			code: String((o.state.findingCode ?? o.state.observationType ?? '') as string),
			severity: String((o.state.severity ?? '') as string),
			statement: String((o.state.statement ?? '') as string)
		});
		byId.set(aid, list);
	}
	return byId;
}

/** The assessment states a COMPLETION concludes in — the five dispositions `CompleteAssuranceAssessment` admits, read from
 *  the contract it reads them from (`rph-application` `assurance.ts`), never restated here. */
const CONCLUDED_DISPOSITIONS: ReadonlySet<string> = new Set(
	AssuranceDispositionRecommendationSchema.options
);

/**
 * The panel's display aggregate from the per-policy dispositions.
 *
 * ⭐ `JAN-ESCREC` D3 — THE PACKAGE'S OWN STRICTEST-UNRESOLVED COMPOSITION (`aggregateDisposition`, §28.2), the one the run
 * computed. ~~SATISFIED, else REJECTED, else UNASSESSED~~ was a hand-written ladder, and it read an ESCALATED or an
 * INCONCLUSIVE review back UNASSESSED — "nothing assessed it", beside a review that ran and concluded — and a
 * CONDITIONALLY_SATISFIED one too. Every floor policy is REQUIRED (§8.4), and one with no recorded assessment is MISSING.
 * ⭑ ONLY A CONCLUDED DISPOSITION IS READ AS ONE. A review still in progress (REQUESTED, EVIDENCE_PENDING, READY,
 * ASSESSING), and any other state that is not one of the five dispositions, is MISSING here, so it keeps the reading the
 * ladder gave it: UNASSESSED, or REJECTED beside a rejection. Passed through, `aggregateDisposition` reads a state it does
 * not know as INCONCLUSIVE — a review nobody concluded would read as one that concluded nothing.
 * ⛔ AND A WAIVED STATE IS NOT PASSED AS WAIVED. It is no completion's disposition (only a waiver GRANT on the assessment
 * reaches it), so it is MISSING here: `aggregateDisposition` counts a required WAIVED policy as satisfying, while the floor
 * is UNCONDITIONAL (ASR-3; `REG-F-202`) — `satisfied` below and the engine's floor gate both block on it. ⚠ No test stages
 * a WAIVED floor assessment; this sentence is read from code.
 */
function floorAggregate(order: readonly string[], policies: readonly FloorPolicyView[]): string {
	return aggregateDisposition(
		order.map((policyId): PolicyAssessment => {
			const disposition = policies.find((p) => p.policyId === policyId)?.disposition ?? '';
			return {
				required: true,
				disposition: CONCLUDED_DISPOSITIONS.has(disposition)
					? (disposition as PolicyAssessment['disposition'])
					: 'MISSING'
			};
		})
	);
}

/**
 * The latest recorded result of each criterion of each named assessment, from `AssuranceCriterionEvaluated` — the
 * judgement lives on the EVENT (no state delta), so this is a fold, latest wins, as Gate E folds it. ⭐ Each row names its
 * criterion (package C's check), so a part's rows reach the inspector as they are (`FloorPartView.criterionResults`).
 */
function latestCriterionRows(
	engine: AuthedEngineHandle,
	assessmentIds: ReadonlySet<string>
): Map<string, CriterionResultView[]> {
	const byAssessment = new Map<string, Map<string, CriterionResultView>>();
	for (const e of engine.readAllEvents()) {
		if (e.eventType !== 'AssuranceCriterionEvaluated' || !assessmentIds.has(e.aggregateId)) continue;
		const p = e.payload as { criterionId?: string; result?: string; stipulated?: string };
		if (typeof p.criterionId !== 'string') continue;
		const rows = byAssessment.get(e.aggregateId) ?? new Map();
		rows.set(p.criterionId, { criterionId: p.criterionId, result: p.result, stipulated: p.stipulated });
		byAssessment.set(e.aggregateId, rows);
	}
	return new Map([...byAssessment].map(([id, rows]) => [id, [...rows.values()]]));
}

/**
 * The latest recorded floor outcome for a PWA, read back from the canonical ASSURANCE_ASSESSMENT/OBSERVATION objects (the
 * read surface the UI renders). Undefined if no floor has been recorded for the subject yet.
 *
 * ⭐⭐ The review in parts, B3 (`REG-D-125`; design D6) — THE LATEST ROUND (`latestFloorRound`), WITH ITS COMPLETE EXPECTED
 * PART INVENTORY: one part per live type of the PWA, in export order, each the round's review of that type at the version
 * the store holds now. A type the round holds no review of — added since, or reviewed only in an older round — and a
 * review bound to another version of its type, are each a `MISSING` part, which keeps the floor unsatisfied.
 */
export function loadPwaFloor(
	pwaId: string,
	engine: AuthedEngineHandle = getEngine().as(SESSION_CREDENTIAL)
): FloorView | undefined {
	const types = storedTypes(engine, pwaId);
	const round = latestFloorRound(engine, pwaId, new Set(types.keys()));
	if (round === undefined) return undefined;
	const ids = new Set([...round.deterministic.values(), ...round.parts.values()].map((a) => a.id));
	const obsByAssessment = observationsOf(engine, ids);
	const criteriaByAssessment = latestCriterionRows(engine, ids);
	const deterministic: FloorPolicyView[] = [];
	for (const policyId of FLOOR_ORDER) {
		const a = round.deterministic.get(policyId);
		if (!a) continue;
		const obs = obsByAssessment.get(a.id) ?? [];
		deterministic.push({
			policyId,
			disposition: String((a.state.assessmentState ?? 'INCONCLUSIVE') as string),
			// Derived from the RECORDED violation, never asserted. This read-back path hardcoded `true`, so every
			// reader — the UI, any caller of loadPwaFloor — saw independence certified regardless of what actually
			// happened, while the run-path (runPwaFloor) carried the real value and dropped it at persistence. The
			// composer now persists an INDEPENDENCE_VIOLATION observation (§8.12), so its absence is a real signal.
			independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION'),
			observations: obs,
			criteria: tallyCriteria(criteriaByAssessment.get(a.id) ?? [])
		});
	}
	const parts: FloorPartView[] = [...types].map(([typeId, type]) => {
		const named = { typeId, typeName: type.name };
		const a = round.parts.get(typeId);
		const bound = (a?.state.subjectSemanticVersions as Record<string, unknown> | undefined)?.[typeId];
		if (a === undefined || bound !== type.semanticVersion)
			return {
				...named,
				semanticVersion: type.semanticVersion,
				disposition: PART_MISSING,
				independenceOk: true,
				observations: []
			};
		const obs = (obsByAssessment.get(a.id) ?? []).map((o) => ({ ...o, ...named }));
		return {
			...named,
			semanticVersion: type.semanticVersion,
			disposition: String((a.state.assessmentState ?? 'INCONCLUSIVE') as string),
			independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION'),
			observations: obs,
			// ⭐ B5 (package C's check) — and the rows the tally below counts, each criterion's own.
			criterionResults: criteriaByAssessment.get(a.id) ?? [],
			criteria: tallyCriteria(criteriaByAssessment.get(a.id) ?? [])
		};
	});
	return floorViewOf(pwaId, {
		deterministic,
		parts,
		waived: hasEffectiveWaiver(engine, pwaId, ...types.keys()),
		...(round.parts.size === 0 || round.token === undefined ? {} : { runToken: round.token })
	});
}

/** Latest recorded floor assessment per policy for the subject (by updatedAt; ties → last seen). */
function latestFloorAssessments(
	engine: AuthedEngineHandle,
	subjectId: string
): Map<string, LatestAssessment> {
	const latest = new Map<string, LatestAssessment>();
	// WORKSPACE: the subject is filtered on the next line, which is this query's real scope.
	for (const a of listAssessments(engine, { kind: 'WORKSPACE' })) {
		if (!subjectsOf(a.state).includes(subjectId) || !isFloorPolicy(a.state.assurancePolicyId)) continue;
		const policyId = String(a.state.assurancePolicyId as string);
		const at = String((a.state.updatedAt ?? '') as string);
		latest.set(policyId, later(latest.get(policyId), { id: a.id, state: a.state, at }));
	}
	return latest;
}

/**
 * The latest recorded floor outcome over ONE subject, policy by policy (by updatedAt; ties → last seen), read back from the
 * canonical ASSURANCE_ASSESSMENT/OBSERVATION objects. Undefined if no floor has been recorded for the subject yet.
 * ⭐ The review in parts, B3 (`REG-D-125`) — THE EXECUTION PLANE'S READER of a work product's floor
 * (`stopped-unit-recovery.ts`), keyed on `subjectObjectIds` alone, as `loadPwaFloor` was before a PWA's floor was read as a
 * round. ⚠ A PWA's floor is `loadPwaFloor`'s: its Reasoning Review is recorded under its types, never under the PWA.
 */
export function loadSubjectFloor(
	subjectId: string,
	engine: AuthedEngineHandle = getEngine().as(SESSION_CREDENTIAL)
): FloorView | undefined {
	const latest = latestFloorAssessments(engine, subjectId);
	if (latest.size === 0) return undefined;
	const ids = new Set([...latest.values()].map((a) => a.id));
	const obsByAssessment = observationsOf(engine, ids);
	const criteriaByAssessment = latestCriterionRows(engine, ids);
	const policies: FloorPolicyView[] = [];
	for (const policyId of FLOOR_ORDER) {
		const a = latest.get(policyId);
		if (!a) continue;
		const obs = obsByAssessment.get(a.id) ?? [];
		policies.push({
			policyId,
			disposition: String((a.state.assessmentState ?? 'INCONCLUSIVE') as string),
			// Derived from the RECORDED violation, never asserted (see `loadPwaFloor`).
			independenceOk: !obs.some((o) => o.code === 'INDEPENDENCE_VIOLATION'),
			observations: obs,
			criteria: tallyCriteria(criteriaByAssessment.get(a.id) ?? [])
		});
	}
	const rr = latest.get(FLOOR_POLICY_IDS.REASONING_REVIEW);
	const runToken = rr === undefined ? undefined : floorRunTokenOf(engine, rr.id);
	return {
		subjectId,
		aggregate: floorAggregate(FLOOR_ORDER, policies),
		satisfied: FLOOR_ORDER.every((p) => latest.get(p)?.state.assessmentState === 'SATISFIED'),
		waived: hasEffectiveWaiver(engine, subjectId),
		policies,
		// ⭐ `JAN-ESCREC` D3 — never the reviewer's recommendation: it stays on `policies`, and is not a finding.
		reasoningGaps: rr
			? (obsByAssessment.get(rr.id) ?? [])
					.filter((o) => !isReviewerRecommendation(o))
					.map((o) => o.statement)
			: [],
		// ⭐ C2 — the shown review's own floor run, read from ITS record: the answer under this floor is joined to it.
		...(runToken === undefined ? {} : { reasoningReviewRunToken: runToken })
	};
}

/**
 * ⭐ C2 (`REG-F-433`) — the floor-run token an assessment carries: the correlation its recording plan was dispatched under
 * (one token for the run's assessments and its reviewer calls, P7-6 B7), read off the assessment's FIRST event, its
 * request. ⛔ Never from the assessment's state, which carries no correlation; and never the subject's latest run's — that
 * is the join this replaces. `undefined` when the record holds no event of it.
 */
function floorRunTokenOf(engine: AuthedEngineHandle, assessmentId: string): string | undefined {
	return engine.readAllEvents().find((e) => e.aggregateId === assessmentId)?.correlationId;
}
