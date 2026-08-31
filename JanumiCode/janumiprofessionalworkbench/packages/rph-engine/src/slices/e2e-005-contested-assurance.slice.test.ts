// JAN-SLICE-SWP-03 — RPH-E2E-005, the journey where two competent professionals look at the same work and
// DISAGREE.
//
// The ratified statement (`m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When one architecture validator approves tenant isolation and an independent security validator rejects it,
//    both assessments are preserved, aggregate assurance is contested or rejected, the human review package
//    summarizes the disagreement, and the baseline is not promoted automatically."
//
// The worked scenario it was distilled from, quoted from `docs/Recursive Professional Harness/Janumi Professional
// Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md`,
// heading `## RPH-E2E-005 — Validator disagreement`, verbatim and in document order:
//
//   ### Given
//   one architecture validator approves tenant isolation.
//   ### And
//   an independent security validator rejects it.
//   ### Then
//   * both assessments are preserved;
//   * aggregate assurance is contested or rejected;
//   * human review package summarizes disagreement;
//   * baseline is not promoted automatically.
//
// ⚠ NOTE WHAT §24 DOES NOT SAY, because the M12 statement's grammar hides it. §24 has NO `When` limb — it has a
// `Given` and an `And`. The disagreement is the STANDING SITUATION, not an event. So there is no act whose
// acceptance or refusal is the rule's subject, which is exactly why three of its four consequents turn out to be
// properties of READ MODELS and why the only one a dispatch can reach is the last.
//
// ── THE CLAUSE LETTERS USED BELOW ────────────────────────────────────────────────────────────────────────────
// The statement is read as two antecedent limbs and four consequent limbs, and the tests are named for them:
// (a) an architecture validator approves; (b) an independent security validator rejects; (c) both assessments are
// preserved; (d) aggregate assurance is contested or rejected; (e) the human review package summarizes the
// disagreement; (f) the baseline is not promoted automatically.
//
// ── WHAT HOLDS, WHAT IS NARROWED, AND WHAT IS ABSENT ─────────────────────────────────────────────────────────
//   (a)+(b) HOLD, and more strongly than a Slice built on the shared fixture alone could say: independence is not
//           asserted by giving the two validators different NAMES — the §39-invariant-8 check is actually RUN, and
//           both assessments carry `independenceStatus: 'VERIFIED'` in the §38 view. Driven.
//
//           ⚠ AND NOT AS STRONGLY AS THE RATIFIED WORD "INDEPENDENT" READS, WHICH THE FIRST DRAFT DID NOT SAY.
//           Both operands of that check are fields of ONE command written by ONE session; nothing compares the
//           declared `producer` to the subject's recorded producer, and nothing compares either to the
//           authenticated principal. See the note on `complete()` and the last ⚠ of this header.
//   (c)     HOLDS. Both verdicts survive, at the object AND in the event log, and nothing curates either away.
//           It has NO MUTANT, and the inability is itself the finding — see the test's own note.
//   (d)     SPLIT IN THREE. The `rejected` disjunct HOLDS in the read model and is asserted. The `contested`
//           disjunct is REFUTED — not merely unperformed but UNREPRESENTABLE — in a test that says so. And the
//           whole clause is DISCLOSED as holding only because this journey's two verdicts arrive under two
//           DIFFERENT policies: under one policy the read model arbitrates the disagreement BY REQUEST ORDER —
//           the LAST-REQUESTED completed verdict is reported and the other is dropped silently.
//
//           ⚠ AND THE ARBITRATION IS *NOT* BY COMPLETION RECENCY, WHICH IS WHAT THIS SLICE FIRST CLAIMED IN FOUR
//           PLACES AND WHAT REG-F-215 ITSELF SAYS ("Last-completed-wins"). Both are WRONG. `buildApplicablePolicies`
//           reduces with `completed.at(-1)` over `Object.values(view.assessments)`, and that record is built by
//           `withAssessment` as `{...view.assessments, [id]: assessment}` — re-assigning an EXISTING string key
//           keeps its FIRST-insertion position, which is set by `AssuranceAssessmentRequested` and never by the
//           completion. So `at(-1)` selects the last-REQUESTED completed assessment. DRIVEN, in three arrangements
//           that vary request order and completion order independently; see `O-d(disclosure)`. The register wording
//           was corrected under REG-F-299; REG-F-215 is cited here as corrected, not re-filed.
//   (e)     ABSENT — AND THE ABSENCE IS OF A BUILDER, NOT OF A VOCABULARY OR OF EVERY PACKAGE. Nothing assembles
//           a human review package: both search directions and a positive control are recorded in the test. Two
//           narrowings the first draft got wrong and this one states: `EscalationRuleSchema.requiredPackage` IS a
//           ratified field naming a package's contents (read by no production line), and the BASELINE package is
//           not absent at all — `stageBaseline` builds one and `O-f(partial)` promotes it. Clause (e) of this rule
//           names the HUMAN REVIEW package alone. What IS true is asserted instead: the disagreement is RECORDABLE
//           as a governed `CONFLICT` observation, and it is summarized by nothing.
//   (f)     PARTIAL, and its narrowing was found by driving the CONTROL rather than the refusal. The promotion IS
//           refused — and the byte-adjacent promotion that simply OMITS the rejecting assessment is ACCEPTED,
//           taking the baseline to AUTHORITATIVE with the rejection still REJECTED and its finding still OPEN.
//           "Not promoted automatically" is true; "not promoted" is not.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the same prohibition the E2E-001 and E2E-002 Slices record. It
// converts a false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
//
// ⚠ AND WHAT A READER MUST NOT CONCLUDE FROM THIS SLICE BEING GREEN: that the engine DETECTS disagreement. It
// does not. No predicate anywhere loads the OTHER assessments over a subject and compares them —
// `rejectUnbackedDisposition` is an existential over the assessments the CALLER cites, `buildApplicablePolicies`
// reduces N verdicts to one by REQUEST ORDER, and `promoteBaseline` reads the required set the PROMOTER names.
// Every green below is a green about an arrangement this Slice built deliberately, never about a disagreement the
// engine noticed on its own.
//
// ⚠ AND NOR DOES IT CHECK INDEPENDENCE BETWEEN TWO ACTING PARTIES. The §39-invariant-8 check RUNS and PASSES here
// — that is real and `E2E-005-M1` pins it — but it compares two strings the SAME session supplied inside ONE
// command: `completeAssuranceAssessment` reads `producer` straight off the payload and `evaluator` off
// `validatorResult.executionProvenance`, and `checkIndependence` then compares only `agentId`. Nothing binds the
// declared `producer` to the subject's recorded producer (the evidence `producedBy` that `executeWork` writes),
// and nothing binds either operand to the authenticated principal. See `O-a+O-b`'s own disclosure; it is the same
// caller-supplies-the-antecedent shape clause (f) discloses for RPH-BAS-004.
import { describe, expect, it } from 'vitest';

import {
	aggregateDispositionFor,
	buildApplicablePolicies,
	buildAssuranceView
} from '@janumipwb/rph-projections';

import {
	beginJourney,
	changeState,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	verdict,
	JOURNEY_ACTOR,
	JOURNEY_POLICY,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-005',
	title: 'Two independent validators disagree about tenant isolation, and neither verdict silently wins',
	plane: 'ENGINE',
	// ⚠ RATIFIED HERE, NOT INHERITED. The roadmap's §9 table PROPOSES an assignment and its own preamble forbids
	// taking it: the assignments "MUST be ratified in SWP-02 and SWP-03, not inherited from this table".
	//
	// THE REASON, and it is the same shape as E2E-002's without being a copy of it. Every act OF THE JOURNEY is
	// ACCEPTED — two policies created and activated, an intent approved, a plan run to SUCCEEDED, TWO assessments
	// requested, begun and completed, observations recorded, a baseline created, reviewed and approved. Nothing the
	// journey does is malformed (not a `user-error path` — read the correction below), nothing failed (not a
	// `system-failure path`), no authority is refused (not a `permission-denied path`), nothing is interrupted or
	// cancelled, no datum is unavailable. What makes
	// it not the `normal path` is that two competent validators reach OPPOSITE professional conclusions about the
	// same work — a legitimate outcome of professional judgment, not an error in it. That is the definition of an
	// alternate valid path.
	//
	// ⚠ CORRECTED. THIS BLOCK FIRST READ "Nothing is malformed", FULL STOP, AND THAT PREMISE IS FALSE — `O-d(refuted)`
	// deliberately dispatches TWO malformed commands (`assuranceState: 'CONTESTED'` and
	// `validatorResult.dispositionRecommendation: 'CONTESTED'`) and asserts both are refused
	// RPH_VALIDATION_SCHEMA_FAILED. The conclusion survives and the premise is repaired rather than the class
	// changed: those two dispatches are REFUTATION INSTRUMENTS, not acts of the journey. Their purpose is to make
	// the engine print its own range so a disjunct the ratified clause offers can be refuted on the engine's words
	// instead of on a grep. `user-error path` classifies the PROFESSIONAL JOURNEY — a practitioner making a mistake
	// the engine then handles — and no participant in this journey makes one. A probe the Slice fires at a schema to
	// measure it is not the journey being classified. SL-5 asks the choice to be ratified with a reason; this is the
	// reason, stated in a form that is true.
	//
	// ⚠ THE COMPETING CANDIDATE WAS CONSIDERED AND REJECTED, because the temptation is real: `data-unavailable
	// path`, on the reading that the "human review package" the rule names is missing. It is not that class. That
	// class is about a DATUM the journey needed and could not obtain; here the journey needs nothing it lacks — it
	// is the RULE that names a surface this engine never built. An absent ratified surface is a finding about the
	// engine, not a scenario class of the journey.
	scenarioClass: 'alternate valid path',
	citedRules: ['RPH-E2E-005'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-005-M1',
			file: 'packages/rph-application/src/handlers/assurance.ts',
			find: "independenceResult = 'VERIFIED';",
			replace: "independenceResult = 'MUTANT_UNCHECKED';",
			expectRed: ['O-a+O-b'],
			predictedMessage:
				'the §39-invariant-8 independence check must have RUN AND PASSED, not merely been skipped — clause (b). ⚠ AND NO FURTHER: both operands are supplied by the caller in this same command, so this certifies a relation between two payload fields, never between two acting parties',
			why: "Proves (a)+(b) rest on the independence check having RUN AND PASSED, not on the two validators carrying different id strings. Two different `validatorId` values are free and prove nothing: `checkIndependence` compares the PRODUCER of the subject against the EVALUATOR of the assessment on `agentId`, and it runs only when the policy resolves, its requirement is not NONE, and BOTH operands are supplied. The shared `slice-journey` fixture supplies NEITHER — its `assess` takes no `producer` and its `verdict` builder hard-codes an empty `executionProvenance` — so a Slice built on the fixture alone has the check silently skipped and `independenceStatus` left undefined, which the view is careful to call unknown rather than a pass. ⚠ THE REPLACEMENT SHARES NO SUBSTRING WITH 'VERIFIED', ON PURPOSE: E2E-002-M1 records a mutant that stayed GREEN because its replacement CONTAINED its anchor. CORRECTED — the first draft of this mutant claimed that safeguard while replacing with 'MUTANT_UNVERIFIED', and `'MUTANT_UNVERIFIED'.includes('VERIFIED')` is `true`. It happened to redden anyway, because `O-a+O-b` asserts with `toEqual` rather than `toContain`; the claim was false even so, in the field the next Slice author reads as precedent. 'MUTANT_UNCHECKED' makes it true and still type-checks — `independenceResult` is `string | undefined` in the handler and `z.string().optional()` on the event."
		},
		{
			id: 'E2E-005-M2',
			file: 'packages/rph-domain/src/aggregate-assurance.ts',
			find: "if (required.some((i) => dispositionOf(i) === 'REJECTED')) return 'REJECTED';",
			replace:
				"if (required.some((i) => dispositionOf(i) === 'MUTANT_NO_SUCH_DISPOSITION')) return 'REJECTED';",
			expectRed: ['O-d(partial)'],
			predictedMessage:
				'one rejection among two applicable policies must carry the aggregate to REJECTED — DOC-004 §28.2 rung 1, and the only half of clause (d) this engine can express',
			why: "Proves clause (d)'s surviving disjunct is asserted on §28.2's FIRST RUNG — the rung that makes a rejection outrank an approval — rather than on some incidental property of the fold. The kernel FAILS CLOSED at the bottom, so disabling rung 1 does not yield SATISFIED; it yields INCONCLUSIVE, which is still wrong and still red. That is the point: the assertion is on the exact ratified value, not on `not SATISFIED`. Sited on the KERNEL and not on the read model because the read model merely supplies rows, while §28.1's strictest-unresolved rule lives here."
		},
		{
			id: 'E2E-005-M3',
			file: 'packages/rph-projections/src/assurance-view.ts',
			find: 'const chosen = completed.at(-1) ?? covering.at(-1);',
			replace: 'const chosen = completed.at(0) ?? covering.at(-1);',
			expectRed: ['O-d(disclosure)'],
			predictedMessage:
				'the §38 policy row must report the verdict of the LAST-REQUESTED completed assessment and drop the other — arbitration by REQUEST ORDER, not by completion recency (REG-F-215 as corrected by REG-F-299), pinned so that repairing it cannot land silently',
			why: "Proves the disclosure is asserted on the exact expression REG-F-215 names by line (`assurance-view.ts:485`), and pins it: `at(-1)` -> `at(0)` flips the reported verdict in ALL THREE arrangements the test drives, so the assertion fails the day the arbitration changes — including the day it is fixed, which is what keeps this disclosure from outliving the defect. ⚠ AND THE THREE ARRANGEMENTS ARE WHY THIS MUTANT MEANS ANYTHING. The first draft drove two runs that shared one act ordering and merely swapped which disposition rode which id; under that arrangement `at(0)` and `at(-1)` are told apart, but LAST-REQUESTED, LAST-COMPLETED and 'RIVAL_B always wins' are not — and the reading the file committed to in four places was the one driving refutes. It CANNOT redden `O-d(partial)`, and that is SL-3a made structural rather than hoped for: in that test each policy has exactly ONE completed assessment, so `at(0)` and `at(-1)` select the same element and the mutant is invisible to it."
		},
		{
			id: 'E2E-005-M4',
			file: 'packages/rph-application/src/handlers/assurance.ts',
			find: 'observationType: p.observationType,',
			replace: "observationType: 'FINDING',",
			expectRed: ['O-e(absent)'],
			predictedMessage:
				'the disagreement must be recordable as a governed CONFLICT observation — the one carrier clause (e) actually has, against the review package it does not',
			why: "Proves the POSITIVE half of clause (e) is asserted on the ratified `CONFLICT` member of `ObservationTypeSchema` and not merely on the existence of some observation. An observation recorded as a FINDING satisfies a count and does not say that two VALID assessments contradict each other, which is the whole content of this clause. ⚠ THE ABSENT HALF OF THIS CLAUSE HAS NO MUTANT AND CANNOT HAVE ONE — a mutant removes a mechanism, and there is no review-package mechanism anywhere to remove. That inability is recorded in the test rather than papered over."
		},
		{
			id: 'E2E-005-M5',
			file: 'packages/rph-domain/src/governance.ts',
			find: "const PROMOTABLE_DISPOSITIONS = new Set(['SATISFIED', 'WAIVED']);",
			replace: "const PROMOTABLE_DISPOSITIONS = new Set(['SATISFIED', 'WAIVED', 'REJECTED']);",
			expectRed: ['O-f(partial)'],
			predictedMessage:
				'a promotion that NAMES the rejecting assessment must be refused, and refused for THAT assessment alone — clause (f), with the approving verdict already in the store and not lifting it',
			why: "Proves clause (f) is asserted on the disposition gate the RPH-BAS-004 register row names, and it is that row's OWN declared mutation ('add REJECTED to the satisfied set so a rejected assessment authorizes promotion') driven from a journey instead of from a probe. It cannot redden the CONTROL inside the same test: the control lists only the SATISFIED assessment, which is promotable with or without the mutant, so a green control under this mutant still means what it means."
		},
		{
			id: 'E2E-005-M6',
			file: 'packages/rph-contracts/src/enums.ts',
			find: 'export const AssuranceStateSchema = z.enum([',
			replace: "export const AssuranceStateSchema = z.enum([\n\t'CONTESTED',",
			expectRed: ['O-d(refuted)'],
			predictedMessage:
				'the PWU assurance axis must refuse CONTESTED at the SCHEMA, enumerating its eleven legal values and omitting that one — the disjunct the rule offers and the engine cannot hold',
			why: "Proves the refutation rests on the CLOSED ENUM and not on some guard that happens to refuse today. ⚠ THE SHAPE OF THIS MUTANT IS ITSELF THE FINDING: an absence cannot be disabled, so the only way to test that this refusal is real is to ADD the missing member and watch the schema stop objecting. Note that widening the enum does NOT make the move legal — `PWU.assuranceState` has no CONTESTED node in its machine either, so the command is still refused, by a different mechanism and with a different message. That is exactly why the test asserts the MESSAGE and the enumeration inside it rather than the bare status: only the message tells the schema refusal apart from the machine refusal, which is `an arrangement that trips two guards` avoided by construction."
		}
	]
};

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V10';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5V30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5V40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5V50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5V60';
/** The SECURITY policy. Created here rather than in the shared fixture — see `seedSecurityPolicy`. */
const SECURITY_POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5S99';
const ARCH_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V70';
const SEC_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V71';
const THIRD_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V72';
const SEC_FINDING = 'obs_01ARZ3NDEKTSV4RRFFQ69G5V80';
const CONFLICT_OBSERVATION = 'obs_01ARZ3NDEKTSV4RRFFQ69G5V81';
const DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V90';
const BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5VA0';
/** The same-policy disagreement of `O-d(disclosure)`, which must not share ids with the two-policy journey. */
const RIVAL_A = 'assess_01ARZ3NDEKTSV4RRFFQ69G5W70';
const RIVAL_B = 'assess_01ARZ3NDEKTSV4RRFFQ69G5W71';

/**
 * One side of the same-policy disagreement, carried as a VALUE so `O-d(disclosure)` can permute the ORDERS
 * without permuting anything else.
 *
 * ⚠ THE DISPOSITION IS NAILED TO THE ID, AND THAT IS THE REPAIR. The first draft of that test held ONE act
 * ordering fixed and swapped which disposition rode which id, which cannot distinguish an arbitration by order
 * from "RIVAL_B always wins" — and the id it reported was RIVAL_B in both runs. Here RIVAL_A is always the
 * approving architecture verdict and RIVAL_B always the rejecting security one, so across the three arrangements
 * the ONLY variables are the REQUEST order and the COMPLETION order.
 */
interface Rival {
	readonly id: string;
	readonly disposition: string;
	readonly validatorId: string;
	readonly evaluator: typeof ARCH_EVALUATOR;
}

/**
 * The two evaluators, and the producer they must both differ from.
 *
 * ⚠ THESE ARE NOT DECORATION. Both policies declare `independenceRequirement: 'DIFFERENT_AGENT'`, which
 * `checkIndependence` resolves to `producer.agentId !== evaluator.agentId` after `actorReferenceToIdentity` maps
 * `ActorReference.actorId` onto `Identity.agentId`. The producer of the architecture is `JOURNEY_ACTOR`
 * (`owner-1`) — `executeWork` records it as the produced evidence's `producedBy` and it is the session principal
 * that ran the step. Either evaluator sharing that id would land its assessment in `INDEPENDENCE_VIOLATION`
 * instead of the disposition asked for; the shared fixture's own header warns of exactly this, and it would make
 * (a) and (b) red for a reason unrelated to what they measure.
 */
const ARCH_EVALUATOR = {
	actorId: 'arch-reviewer-1',
	actorType: 'AGENT' as const,
	displayName: 'Architecture Coverage Validator'
};
const SECURITY_EVALUATOR = {
	actorId: 'sec-reviewer-1',
	actorType: 'AGENT' as const,
	displayName: 'Independent Security Validator'
};

/** The approving side of the same-policy disagreement. Its disposition never changes; only its position does. */
const RIVAL_ARCH: Rival = {
	id: RIVAL_A,
	disposition: 'SATISFIED',
	validatorId: 'deterministic.architecture',
	evaluator: ARCH_EVALUATOR
};
/** The rejecting side. Same subject, same policy, same version, opposite verdict. */
const RIVAL_SEC: Rival = {
	id: RIVAL_B,
	disposition: 'REJECTED',
	validatorId: 'deterministic.security',
	evaluator: SECURITY_EVALUATOR
};

/**
 * The SECOND governing policy — the security review the ratified statement's second validator works under.
 *
 * ⚠ INLINED HERE RATHER THAN ADDED TO `slice-journey.ts`, and not for convenience: the shared fixture is being
 * edited by other Slices in parallel, so this Slice may not touch it. Recorded as a fixture need instead.
 *
 * ⚠ AND THE SECOND POLICY IS LOAD-BEARING, NOT SCENERY. `buildApplicablePolicies` groups by POLICY, so two
 * assessments citing ONE policy collapse to a single row before the aggregate fold ever sees them — the defect
 * `O-d(disclosure)` drives. Modelling "an architecture validator" and "an independent SECURITY validator" as two
 * disciplines is also the faithful reading of §24, not a convenience that happens to dodge the bug.
 *
 * ⚠ ITS FINDING'S `defaultSeverity` IS MATERIAL, AND THAT IS A DELIBERATE, DISCLOSED CHOICE. A BLOCKING finding
 * would independently trip `canPromoteBaseline`'s `OPEN_BLOCKING_FINDING` arm, and clause (f)'s refusal would
 * then trip TWO guards at once and prove NEITHER. MATERIAL sits outside `BLOCKING_SEVERITIES` (= {BLOCKING,
 * CRITICAL}), so the promotion below is refused on the assessment disposition ALONE and the message is asserted
 * to prove it. RPH-BAS-003's blocking-observation refusal already has live coverage of its own
 * (`execrem-wp16-enforcement-observed.test.ts`, `promotionProbe('blocking-observation')`) and is not this Slice's
 * to re-prove.
 */
function seedSecurityPolicy(j: Journey): void {
	j.send('CreateAssurancePolicy', 'ASSURANCE_POLICY', SECURITY_POLICY, {
		policyId: SECURITY_POLICY,
		version: '1.0.0',
		name: 'Slice Journey Independent Security Review',
		purpose:
			'Determine whether the architecture actually withstands an adversary attempting to cross the tenant boundary',
		rationale:
			'RPH-E2E-005 turns on TWO policies reaching opposite verdicts over one subject. A second discipline is what makes the disagreement expressible at all: buildApplicablePolicies groups by policy, so a second opinion under the same policy is arbitrated away before the aggregate fold ever sees it.',
		applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
		evaluatedClaimTypes: ['FITNESS'],
		criteria: [
			{
				id: 'SJ-SEC-01',
				name: 'Tenant isolation withstands adversarial review',
				description:
					'The stated isolation boundary cannot be crossed by a tenant using only the affordances the architecture grants it.',
				criterionType: 'QUALITATIVE',
				evaluationMethod: 'HUMAN_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		evaluatorRole: 'REVIEWER',
		// Mirrors the journey policy. NONE would disarm the very check clause (b) rests on.
		independenceRequirement: 'DIFFERENT_AGENT',
		findingDefinitions: [
			{
				code: 'ISOLATION_BYPASS',
				name: 'The isolation boundary can be crossed',
				description:
					'A tenant can reach another tenant data through an affordance the architecture grants, so the isolation claim does not hold on the admitted evidence.',
				defaultSeverity: 'MATERIAL',
				affectedClaimTypes: ['FITNESS'],
				defaultControlActions: ['RESHAPE_PWU', 'REQUEST_HUMAN_DECISION']
			}
		],
		permittedControlActions: ['CONTINUE', 'GATHER_CONTEXT', 'RESHAPE_PWU', 'REQUEST_HUMAN_DECISION']
	});
	j.send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', SECURITY_POLICY, {
		policyId: SECURITY_POLICY
	});
}

/**
 * Request an assessment over the architecture PWU under `policyId`.
 *
 * ⚠ SPLIT FROM `begin` DELIBERATELY, AND `O-d(disclosure)` IS THE WHOLE REASON. The REQUEST is the act that
 * decides the arbitration: `foldRequested` is what CREATES the row in `AssuranceView.assessments`, so the request
 * order is the `Object.values` order the §38 reduction reads. A helper that fused request-and-begin (as this one
 * did) makes request order and later act order impossible to vary independently, which is exactly how the first
 * draft of this Slice came to assert an arbitration rule the engine does not have.
 */
function request(j: Journey, assessmentId: string, policyId: string): void {
	j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
		assessmentId,
		assurancePolicyId: policyId,
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU],
		subjectSemanticVersions: { [PWU]: 1 },
		claimIds: [CLAIM]
	});
}

/**
 * READY -> ASSESSING.
 *
 * ⚠ NOT OPTIONAL. `RequestAssuranceAssessment` lands the assessment in READY, and every terminal disposition is
 * reachable ONLY from ASSESSING. Omitting it does not fail here — it fails at the COMPLETION, one act away from
 * the omission.
 *
 * ⚠ AND IT DOES NOT MOVE THE ROW. `foldStarted` upserts an id that already exists, and re-assigning an existing
 * string key leaves its insertion position alone — which is why beginning in a different order than requesting
 * changes nothing the §38 reduction can see. Driven, alongside the completion order, in `O-d(disclosure)`.
 */
function begin(j: Journey, assessmentId: string): void {
	j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {});
}

/** The ordinary case: request and begin as one act, for every test that does not vary the two orders. */
function requestAndBegin(j: Journey, assessmentId: string, policyId: string): void {
	request(j, assessmentId, policyId);
	begin(j, assessmentId);
}

/**
 * Complete one assessment with a real, INDEPENDENCE-CHECKED verdict, returning the raw result.
 *
 * ⚠ THIS IS THE ONE PLACE THE SHARED FIXTURE COULD NOT BE USED, AND IT IS A REAL GAP RATHER THAN A PREFERENCE.
 * `slice-journey`'s `assess()` neither accepts a `producer` nor lets a caller put an `evaluator` into
 * `validatorResult.executionProvenance` — its `verdict()` builder hard-codes `executionProvenance: {}`. The
 * independence gate in `completeAssuranceAssessment` runs only when BOTH operands are present, so an assessment
 * driven through the fixture completes with the check SKIPPED and `independenceStatus` left `undefined`. A Slice
 * about an "independent security validator" that skipped the independence check would be asserting the rule's
 * central word about a world it never built. So `verdict()` is reused for everything it does carry, and the two
 * missing operands are supplied here.
 *
 * ⚠⚠ AND SUPPLYING THEM IS ALSO THE LIMIT OF WHAT CLAUSE (b) CAN MEAN HERE — DISCLOSED, NOT ASSERTED AWAY.
 * BOTH operands of the §39-invariant-8 check are fields of THIS ONE COMMAND, written by THIS ONE SESSION.
 * `completeAssuranceAssessment` reads `producer` straight off the payload and `evaluator` off
 * `validatorResult.executionProvenance.evaluator`; `checkIndependence` then compares only `agentId`. THREE
 * comparisons the ratified word "independent" would seem to promise are performed nowhere:
 *   - the declared `producer` is never compared against the subject's RECORDED producer. `executeWork` writes the
 *     produced evidence's `producedBy`, and `producedBy` appears in `assurance.ts` only inside the EVIDENCE
 *     handlers — never on this path. `JOURNEY_ACTOR` is passed below because it is TRUE, not because it is checked.
 *   - neither operand is compared against the AUTHENTICATED PRINCIPAL. `beginJourney` binds one credential, so
 *     every command in this journey — including the "independent security validator's" rejection — is issued by
 *     `owner-1`, the producer.
 *   - `agentId` is a string the caller chose. Two different strings are what makes the check pass.
 * So `independenceStatus: 'VERIFIED'` certifies a relation between two PAYLOAD FIELDS, not between two ACTING
 * PARTIES. The check having RUN AND PASSED is real and worth pinning (`E2E-005-M1` pins exactly that, and nothing
 * more), and this is the same caller-supplies-the-antecedent shape `O-f(partial)` discloses for RPH-BAS-004. Both
 * are disclosed; neither is asserted as more than it is.
 */
function complete(
	j: Journey,
	args: {
		readonly assessmentId: string;
		readonly policyId: string;
		readonly disposition: string;
		readonly validatorId: string;
		readonly evaluator: typeof ARCH_EVALUATOR;
	}
): ReturnType<Journey['attempt']> {
	const base = verdict({
		assessmentId: args.assessmentId,
		subjectId: PWU,
		subjectSemanticVersion: 1,
		disposition: args.disposition,
		validatorId: args.validatorId,
		policyId: args.policyId
	});
	return j.attempt('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {
		// The identity that PRODUCED the subject. `executeWork` runs the step as the session principal and records
		// it as the produced evidence's `producedBy`, so this is not a convenient fiction — it is who made the
		// thing being judged.
		producer: JOURNEY_ACTOR,
		validatorResult: { ...base, executionProvenance: { evaluator: args.evaluator } }
	});
}

/** The shared prefix: two policies, an approved intent, an architecture PWU, and work that RAN and SUCCEEDED. */
function baseJourney(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedSecurityPolicy(j);
	// BOTH policies are declared on the PWU. `buildApplicablePolicies` joins the PWU's OWN `assurancePolicyIds`
	// (plus its PwuType's required set) against the assessments, so a policy the PWU never declared would produce
	// no row at all and the aggregate would be computed over one opinion instead of two.
	seedIntentAndArchitecture(
		j,
		{ intentId: INTENT, pwuId: PWU },
		{ assurancePolicyIds: [JOURNEY_POLICY, SECURITY_POLICY] }
	);
	executeWork(j, {
		pwuId: PWU,
		planId: PLAN,
		stepId: STEP,
		attemptId: ATTEMPT,
		claimId: CLAIM,
		evidenceId: EVIDENCE
	});
	return j;
}

/**
 * The full disagreement: the architecture validator APPROVES, the security validator REJECTS, both independently.
 *
 * ⚠ ORDER IS LOAD-BEARING AND IS NOT ARBITRARY. Both observations are recorded while the security assessment is
 * still OPEN, because `RecordAssuranceObservation` INHERITS its `subjectObjectIds` from the assessment — the
 * caller never names the PWU — and a terminal assessment can carry no more. It is also why the CONFLICT
 * observation can only hang off ONE of the two assessments; see `O-e(absent)`.
 */
function journey(): Journey {
	const j = baseJourney();

	// (a) The architecture validator looks at coverage and says the isolation is there.
	requestAndBegin(j, ARCH_ASSESSMENT, JOURNEY_POLICY);
	const approved = complete(j, {
		assessmentId: ARCH_ASSESSMENT,
		policyId: JOURNEY_POLICY,
		disposition: 'SATISFIED',
		validatorId: 'deterministic.architecture',
		evaluator: ARCH_EVALUATOR
	});
	if (approved.status !== 'ACCEPTED')
		throw new Error(
			`arrangement: the approving assessment was refused ${JSON.stringify(approved.error)}`
		);

	// (b) The independent security validator looks at the same architecture, at the same version, and says no.
	requestAndBegin(j, SEC_ASSESSMENT, SECURITY_POLICY);
	j.send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', SEC_FINDING, {
		assessmentId: SEC_ASSESSMENT,
		observationType: 'FINDING',
		findingCode: 'ISOLATION_BYPASS',
		severity: 'MATERIAL',
		statement:
			'A tenant can read another tenant rows through the shared reporting view, so the stated isolation boundary does not hold.'
	});
	// The disagreement itself, recorded as the one governed carrier this engine offers for it.
	j.send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', CONFLICT_OBSERVATION, {
		assessmentId: SEC_ASSESSMENT,
		observationType: 'CONFLICT',
		findingCode: 'ISOLATION_BYPASS',
		severity: 'MATERIAL',
		statement:
			'The architecture coverage validator judged tenant isolation SATISFIED at this same version; this security review rejects it on the reporting-view bypass.'
	});
	const rejected = complete(j, {
		assessmentId: SEC_ASSESSMENT,
		policyId: SECURITY_POLICY,
		disposition: 'REJECTED',
		validatorId: 'deterministic.security',
		evaluator: SECURITY_EVALUATOR
	});
	if (rejected.status !== 'ACCEPTED')
		throw new Error(
			`arrangement: the rejecting assessment was refused ${JSON.stringify(rejected.error)}`
		);
	return j;
}

/**
 * The §38 policy rows for the architecture PWU.
 *
 * ⚠ THE POLICY IDS ARE PASSED IN, NOT READ FROM THE PWU, AND THAT IS THE READ MODEL'S OWN LIMIT RATHER THAN A
 * SHORTCUT TAKEN HERE. `buildApplicablePolicies` is documented as PURE OVER ID ARRAYS — it never loads a policy,
 * so it cannot run the §5.1 applicability determination and the caller must supply the join. The arrays passed
 * are exactly the PWU's declared `assurancePolicyIds`, which is what a caller that DID load the object would
 * supply. No `outcomeByPolicy` is given: nobody determined applicability in this journey, and supplying one would
 * be inventing a determination.
 */
function policyRowsFor(
	j: Journey,
	policyIds: readonly string[]
): ReturnType<typeof buildApplicablePolicies> {
	return buildApplicablePolicies({
		pwuId: PWU,
		directPolicyIds: [...policyIds],
		typeRequiredPolicyIds: [],
		view: buildAssuranceView(j.engine.readAllEvents())
	});
}

/**
 * Carry the REJECTING verdict onto the work itself.
 *
 * ⚠ FOUR HOPS, AND BOTH MACHINES ARE WHY — the same walk the E2E-002 Slice records. `PWU.assuranceState` has no
 * `UNASSESSED -> ASSESSING` arrow, and `workLifecycleState` has no `EXECUTING -> UNDER_ASSURANCE` arrow.
 * `ChangePwuState` is a multi-axis setter, so an axis that is not moving is restated at its current value.
 *
 * ⚠ AND WHICH VERDICT IS CARRIED IS A CHOICE THE ENGINE LEAVES ENTIRELY TO THE CALLER — the disclosure that makes
 * clause (d) worth reading twice. `rejectUnbackedDisposition` is an EXISTENTIAL over the assessments the hop
 * CITES: one agreeing citation discharges it, and nothing loads the other assessments over the same subject. So
 * this journey could just as legally cite the APPROVING assessment and take the same PWU to SATISFIED — the live
 * admission `disclosure-observed.test.ts` already drives under RPH-PWU-007, whose arrangement is literally "a PWU
 * whose required assessment came back REJECTED, moved to SATISFIED by citing a second, satisfied assessment".
 * Not re-driven here; cited, so the honest hop below is not mistaken for the only available one.
 */
function carryRejectionToPwu(j: Journey): void {
	const hop = (previousState: string, newState: string, assuranceState: string): void =>
		changeState(j, PWU, {
			previousState,
			newState,
			executionState: 'SUCCEEDED',
			assuranceState,
			supportingObjectIds: [SEC_ASSESSMENT]
		});
	hop('EXECUTING', 'EVIDENCE_PENDING', 'EVIDENCE_REQUIRED');
	hop('EVIDENCE_PENDING', 'EVIDENCE_PENDING', 'READY_FOR_ASSESSMENT');
	hop('EVIDENCE_PENDING', 'UNDER_ASSURANCE', 'ASSESSING');
	hop('UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'REJECTED');
}

/**
 * Bring a candidate baseline all the way to APPROVED, with an EFFECTIVE promotion decision that NAMES it.
 *
 * Everything a promotion needs EXCEPT a satisfied required set, so the only thing left to decide clause (f) is
 * which assessments the promoter names. The decision's `authority` is `JOURNEY_ACTOR` because `REG-F-014` refuses
 * a Decision whose declared authority is not the issuing principal, and it names `[PWU, BASELINE]` because
 * `REG-F-073` refuses a promotion whose decision does not name the baseline.
 */
function stageBaseline(j: Journey): void {
	j.send('ProposeDecision', 'DECISION', DECISION, {
		decisionType: 'PROMOTE_BASELINE',
		subjectObjectIds: [PWU, BASELINE],
		selectedOption: 'promote',
		rationale: 'the architecture has an approving assurance verdict on record',
		authority: JOURNEY_ACTOR
	});
	j.send('ApproveDecision', 'DECISION', DECISION, {
		selectedOption: 'promote',
		rationale: 'the architecture has an approving assurance verdict on record',
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		subjectSemanticVersions: { [PWU]: 1 }
	});
	// BOTH assessments are frozen into the baseline's own record. The promotion gate does NOT read this list — it
	// reads `requiredAssessmentIds` off the promoting command — which is precisely what `O-f(partial)` measures.
	j.send('CreateBaseline', 'BASELINE', BASELINE, {
		baselineType: 'ARCHITECTURE',
		itemObjectIds: [PWU],
		assuranceAssessmentIds: [ARCH_ASSESSMENT, SEC_ASSESSMENT]
	});
	j.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
	j.send('ApproveBaseline', 'BASELINE', BASELINE, {});
}

/** The schema issues a refusal carries, flattened to `path: message` — the only place the enumeration lives. */
function schemaIssues(result: ReturnType<Journey['attempt']>): string {
	const details = (
		result.error as { details?: { issues?: { path?: string; message?: string }[] } } | undefined
	)?.details;
	return (details?.issues ?? []).map((i) => `${i.path}: ${i.message}`).join(' | ');
}

describe('SLICE E2E-005 — an architecture validator approves and an independent security validator rejects', () => {
	// ⚠ (a) AND (b) ARE ASSERTED TOGETHER *ON PURPOSE*, AND IT IS THE ONLY SUCH TEST HERE. Read separately they
	// are two ordinary assessments; read together they are the rule's entire antecedent — two OPPOSITE verdicts
	// about the SAME subject at the SAME semantic version, each attributable to its own validator and each
	// independently produced. `SL-3a`'s concern does not arise: the one mutant claimed for this pairing
	// (`E2E-005-M1`) breaks the INDEPENDENCE limb, which is the only limb here that is not a value read back.
	//
	// ⚠ AND `independenceStatus` IS ASSERTED RATHER THAN THE VALIDATOR NAMES ALONE, BECAUSE THE NAMES PROVE
	// NOTHING. Two different `validatorId` strings are free. What the ratified word "independent" names is the
	// §39-invariant-8 check, which compares the PRODUCER of the subject against the EVALUATOR of the assessment
	// and runs only when both are supplied. A first draft of this Slice drove both assessments through the shared
	// fixture's `assess()`, and `independenceStatus` came back `undefined` on BOTH — the check had never run. The
	// view is careful to call that unknown rather than a pass; the test would have been green and would have
	// proved nothing at all about the rule's central word.
	//
	// ⚠⚠ AND THE LAST MESSAGE BELOW NOW SAYS EXACTLY HOW FAR THAT GOES, BECAUSE THE FIRST DRAFT DID NOT. It read
	// "the security validator must be INDEPENDENT of the producer, checked and not merely named differently",
	// which asserts a relation between two ACTING PARTIES. The engine establishes a relation between two PAYLOAD
	// FIELDS: `producer` off the command, `evaluator` off `validatorResult.executionProvenance`, compared on
	// `agentId` alone — both written by the same session in the same command, and neither compared against the
	// subject's recorded `producedBy` nor against the authenticated principal (which, `beginJourney` having bound
	// ONE credential, is `owner-1` — the producer — for the rejection too). The mechanism and all three missing
	// comparisons are set out on `complete()`. The clause is NOT weakened to get there: what is asserted is what
	// is true — the check RAN and PASSED over the two identities this completion declares, which is strictly more
	// than two different `validatorId` strings and strictly less than independence. Disclosing it here matches
	// what `O-f(partial)` already discloses for RPH-BAS-004; disclosing it there and not here was the asymmetry.
	it('O-a+O-b — two INDEPENDENT validators reach opposite verdicts on the same architecture at the same version', () => {
		const j = journey();
		const view = buildAssuranceView(j.engine.readAllEvents());
		const arch = view.assessments[ARCH_ASSESSMENT];
		const sec = view.assessments[SEC_ASSESSMENT];

		expect(
			arch?.disposition,
			'the architecture validator must APPROVE — clause (a) of the ratified antecedent'
		).toBe('SATISFIED');
		expect(
			sec?.disposition,
			'and the security validator must REJECT the same work — clause (b). Both at once is the whole rule.'
		).toBe('REJECTED');
		// The two verdicts must be about the SAME subject. Without this, the "disagreement" could be two
		// validators judging two different things, which is not a disagreement at all.
		expect(
			[arch?.subjectObjectIds, sec?.subjectObjectIds],
			'both verdicts must name the same architecture PWU as their subject — otherwise there is no disagreement, only two unrelated opinions'
		).toEqual([[PWU], [PWU]]);
		expect(
			[arch?.validatorImplementationIdentity, sec?.validatorImplementationIdentity],
			'each verdict must be attributable to its OWN validator implementation — §38 "validator implementation identity"'
		).toEqual(['deterministic.architecture', 'deterministic.security']);
		expect(
			[arch?.independenceStatus, sec?.independenceStatus],
			'the §39-invariant-8 independence check must have RUN AND PASSED, not merely been skipped — clause (b). ⚠ AND NO FURTHER: both operands are supplied by the caller in this same command, so this certifies a relation between two payload fields, never between two acting parties'
		).toEqual(['VERIFIED', 'VERIFIED']);
	});

	// ⚠ ASSERTED AT THE OBJECT AND AT THE EVENT LOG, NOT AT A PROJECTION, AND THE SITING IS THE ARGUMENT.
	// "Preserved" is a claim about the RECORD. A projection that happened to show both would not prove the record
	// kept both, while a record that kept both makes every faithful projection show them.
	//
	// ⚠ THIS TEST HAS NO MUTANT, AND THE INABILITY IS ITSELF THE FINDING (`SL-3`). A mutant disables a MECHANISM,
	// and there is no curation mechanism to disable. The enforcement register says so of this exact clause:
	// RPH-ASR-011 records that "'Both remain visible' is a property of the event log and the projections over it —
	// nothing curates an assessment away, because no command exists that could", and REG-F-215 re-checked it
	// independently ("'Both remain visible' HOLDS — checked, not assumed"). So this green is real AND it is cheap:
	// it holds because the engine is append-only and has no supersession command for assessments, not because
	// anything defends it. A reader must not take it as evidence that a future curation path would be refused.
	it('O-c — both assessments are preserved: neither verdict is curated away by the other', () => {
		const j = journey();
		expect(
			[
				(j.state(ARCH_ASSESSMENT) ?? {}).assessmentState,
				(j.state(SEC_ASSESSMENT) ?? {}).assessmentState
			],
			'both assessment OBJECTS must still read their own terminal verdict — clause (c) at the record, not at a projection'
		).toEqual(['SATISFIED', 'REJECTED']);
		// And in the log, which is what any later projection is rebuilt from.
		const completions = j.engine
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentCompleted')
			.map((e) => {
				const p = e.payload as { assessmentId?: string; disposition?: string };
				return `${p.assessmentId}=${p.disposition}`;
			});
		expect(
			completions,
			'and the event log must carry BOTH completions, in the order they happened — nothing rewrote or removed the losing verdict'
		).toEqual([`${ARCH_ASSESSMENT}=SATISFIED`, `${SEC_ASSESSMENT}=REJECTED`]);
	});

	// ⚠ NAMED `(partial)` BECAUSE THE RATIFIED CLAUSE IS A DISJUNCTION AND ONLY ONE DISJUNCT IS EXPRESSIBLE. See
	// `O-d(refuted)` for the other, and `O-d(disclosure)` for the condition under which even this one holds.
	//
	// ⚠ AND "AGGREGATE ASSURANCE" IS A READ-MODEL FACT HERE, NOT THE PWU'S OWN AXIS. RPH-ASR-012 is
	// UNENFORCED_DISCLOSED for exactly this reason: the kernel composes strictest-unresolved correctly and "the
	// command surface never asks it to" — a PWU's `assuranceState` is set by `ChangePwuState`, which never
	// consults the fold. So this test asserts what the fold says and asserts nothing about what the PWU's axis
	// will read; `carryRejectionToPwu`'s own note records that the controller could legally carry the OTHER
	// verdict onto the same work.
	it('O-d(partial) — aggregate assurance reads REJECTED across the two policies, by §28.2 strictest-unresolved', () => {
		const j = journey();
		// ⚠ THE JOIN IS ASSERTED BEFORE IT IS USED, BECAUSE `policyRowsFor` HANDS THE READ MODEL THE TWO IDS AS
		// LITERALS. `buildApplicablePolicies` is pure over id arrays and loads no object, so nothing downstream can
		// tell a caller that read the PWU from a caller that invented the list. Without this line the green would
		// rest on the test's own literal: if the fixture's `over.assurancePolicyIds` override stopped applying —
		// `slice-journey.ts` is edited by other Slices in parallel, which this file notes above — the PWU would
		// declare ONE policy, "aggregate assurance" would in truth be computed over one opinion, and every
		// assertion below would stay green. This is the record saying what the literal claims.
		expect(
			(j.state(PWU) ?? {}).assurancePolicyIds,
			'the PWU must itself DECLARE both policies — the applicability join below is supplied to the read model as literals, so this is the only place the record backs it'
		).toEqual([JOURNEY_POLICY, SECURITY_POLICY]);
		const rows = policyRowsFor(j, [JOURNEY_POLICY, SECURITY_POLICY]);
		// The fold must be GIVEN two opinions or "aggregate" means nothing. Asserted, because a row that silently
		// failed to find its assessment would leave the aggregate REJECTED for the wrong reason (rung 3, missing).
		expect(
			rows.map((r) => `${r.policyId}=${r.assessed ? r.disposition : 'UNASSESSED'}`),
			'the fold must see BOTH policies, each carrying its own completed verdict — an aggregate over one opinion is not an aggregate'
		).toEqual([`${JOURNEY_POLICY}=SATISFIED`, `${SECURITY_POLICY}=REJECTED`]);
		expect(
			aggregateDispositionFor(rows),
			'one rejection among two applicable policies must carry the aggregate to REJECTED — DOC-004 §28.2 rung 1, and the only half of clause (d) this engine can express'
		).toBe('REJECTED');
	});

	// ⚠⚠ AN ABSENT VALUE IS A RESULT, AND THIS ONE WAS CHECKED IN BOTH DIRECTIONS BEFORE BEING RECORDED.
	//
	// The ratified clause offers `contested OR rejected`. CONTESTED is a member of NO assurance enum in this
	// system. It exists here only as a `ClaimStatus` — a different aggregate, over a different subject (a CLAIM,
	// not an assessment and not a PWU) — and both routes a caller could take to it are refused AT THE SCHEMA:
	//
	//   ChangePwuState assuranceState=CONTESTED   -> RPH_VALIDATION_SCHEMA_FAILED, path `assuranceState`
	//   CompleteAssuranceAssessment -> CONTESTED  -> RPH_VALIDATION_SCHEMA_FAILED, path
	//                                                `validatorResult.dispositionRecommendation`
	//
	// Both were DRIVEN, not read off an enum declaration. The register reached the same verdict independently and
	// states it more strongly than "unperformed": RPH-ASR-011 records CONTESTED as "NEITHER DERIVED NOR
	// PERFORMABLE", having swept BOTH aggregation kernels over every ratified disposition and found a range of
	// exactly six values containing neither CONTESTED nor ESCALATED — so "TWO OF THE THREE CONSEQUENTS ARE
	// UNDERIVABLE, NOT MERELY UNDERIVED". Cited, not re-filed.
	//
	// ⚠ THE ASSERTION IS ON THE ENUMERATION IN THE MESSAGE, NOT ON THE BARE REFUSAL. A `not.toBe('ACCEPTED')`
	// would pass for a dozen unrelated reasons — including, under `E2E-005-M6`, a refusal from the TRANSITION
	// MACHINE once the schema stops objecting. The message is what tells those two apart, and the enumeration it
	// carries is the engine stating its own range rather than this test restating a grep.
	it('O-d(refuted) — "contested" is a value no assurance axis and no disposition can hold; both routes to it are refused at the schema', () => {
		const j = journey();

		const onThePwu = j.attempt('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', PWU, {
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'CONTESTED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});
		const pwuIssues = schemaIssues(onThePwu);
		expect(
			pwuIssues,
			'the PWU assurance axis must refuse CONTESTED at the SCHEMA, enumerating its eleven legal values and omitting that one — the disjunct the rule offers and the engine cannot hold'
		).toContain('assuranceState: Invalid option: expected one of');
		expect(
			pwuIssues,
			'and CONTESTED must be absent from the enumeration the engine itself prints — the range as stated by the engine, not as read off the enum file'
		).not.toContain('"CONTESTED"');

		// The same word, on the other surface that could carry it: a validator's own recommendation.
		requestAndBegin(j, THIRD_ASSESSMENT, SECURITY_POLICY);
		const asAVerdict = complete(j, {
			assessmentId: THIRD_ASSESSMENT,
			policyId: SECURITY_POLICY,
			disposition: 'CONTESTED',
			validatorId: 'deterministic.security',
			evaluator: SECURITY_EVALUATOR
		});
		const verdictIssues = schemaIssues(asAVerdict);
		expect(
			verdictIssues,
			'and a validator may not RECOMMEND contested either — the five ratified dispositions are enumerated and CONTESTED is not among them'
		).toContain('validatorResult.dispositionRecommendation: Invalid option: expected one of');
		expect(
			verdictIssues,
			'so CONTESTED is absent from the disposition range too — checked in both directions, on the message the engine emits rather than on a grep'
		).not.toContain('"CONTESTED"');
	});

	// ⚠⚠ THIS IS THE CONDITION UNDER WHICH `O-d(partial)` IS TRUE, AND IT IS NARROWER THAN THE RULE READS.
	//
	// `O-d(partial)`'s aggregate is REJECTED because the two verdicts arrive under two DIFFERENT policies, so the
	// §38 join hands the kernel two rows and the kernel composes them correctly. Under ONE policy the two verdicts
	// never reach the kernel at all: `buildApplicablePolicies` collects every covering assessment and then reduces
	// N to one at `assurance-view.ts:485` — `const chosen = completed.at(-1) ?? covering.at(-1);` — and the loser is
	// dropped with NO MARKER THAT A CHOICE WAS MADE.
	//
	// ⚠⚠ AND `at(-1)` IS NOT "THE LAST COMPLETED". IT IS THE LAST *REQUESTED*. THIS CORRECTS THIS SLICE AND THE
	// REGISTER ENTRY IT CITES. The first draft of this test named its arbitration "by RECENCY" and asserted "the
	// last-completed verdict" in its name, in its message and in `E2E-005-M3`'s `predictedMessage`; REG-F-215 says
	// "Last-completed-wins". All of it is wrong, and the mechanism says why in three lines:
	//   1. `buildApplicablePolicies` reduces over `Object.values(args.view.assessments)` — a RECORD, so the order
	//      is the record's own key order.
	//   2. Every fold writes through `withAssessment`, which returns `{...view.assessments, [id]: assessment}`.
	//      Re-assigning an EXISTING string key keeps its FIRST-insertion position; the spread does not move it.
	//   3. The key is first inserted by `foldRequested`, on `AssuranceAssessmentRequested`. `foldStarted` and
	//      `foldCompleted` both upsert an id that already exists, so neither the BEGIN nor the COMPLETION can move
	//      a row. `completed.at(-1)` therefore selects the last-REQUESTED completed assessment.
	// The register wording is corrected under REG-F-299; REG-F-215 is cited below AS CORRECTED, not re-filed. Its
	// engine-side twin in `latestFloorDispositions` is a different expression over a different collection and is
	// NOT re-characterised here — this correction is scoped to the §38 read model, which is what this test drives.
	//
	// ⚠⚠ DRIVEN IN THREE ARRANGEMENTS, BECAUSE TWO WERE NOT ENOUGH AND THE FIRST DRAFT'S TWO WERE THE SAME ONE.
	// Its two runs shared one act ordering (request A, complete A, request B, complete B) and merely swapped which
	// disposition rode which id — so the chosen assessment came back RIVAL_B both times and the arrangement could
	// not tell request-order from completion-order from "RIVAL_B always wins". What discriminates is varying the
	// REQUEST order and the COMPLETION order INDEPENDENTLY, with each rival's disposition nailed to its id:
	//
	//   #1  requested A,B   completed B,A   -> reports B=REJECTED    (request order and completion order DISAGREE)
	//   #2  requested B,A   completed A,B   -> reports A=SATISFIED   (both orders inverted from #1)
	//   #3  requested A,B   completed A,B   -> reports B=REJECTED    (the orders AGREE — the first draft's case)
	//
	// Six candidate rules, six distinct signatures, and only one matches:
	//   last-REQUESTED  (the truth) [B, A, B]      last-completed          [A, B, B]
	//   first-requested (`M3`)      [A, B, A]      first-completed         [B, A, A]
	//   "RIVAL_B always wins"       [B, B, B]      "RIVAL_A always wins"   [A, A, A]
	// The same disagreement, over the same subject, at the same version, reading either way depending on nothing a
	// professional would recognise as a reason.
	//
	// ⚠ THE CANON ANCHOR IS UNCHANGED BY THE CORRECTION, WHICH IS WHY THE DISCLOSURE STILL STANDS. JPWB-DOC-003
	// §8.4 ASR-10 limb 3: "disagreement between valid assessments is never silently arbitrated — both remain
	// visible and the aggregate becomes contested, inconclusive, or escalated", stated scope "aggregation across
	// policies AND assessments" — which is why the two-policy reading in `O-d(partial)` does not discharge the
	// rule. Arbitrating by request order violates that clause exactly as badly as arbitrating by recency would;
	// what changes is only what a repairer must go and look at.
	//
	// ⚠ AND THE `1 row(s):` PREFIX IS GONE. It read as evidence that N assessments were reduced to one row and was
	// not that evidence: `policyRowsFor` is handed ONE policy id and `buildApplicablePolicies` emits one row per
	// distinct id, so the count was 1 in every possible world — including one where no assessment was ever
	// requested. What is counted instead is the number of COMPLETED assessments the view attributes to this policy
	// over this subject, which is what makes the reduction a reduction, and which goes wrong if either rival stops
	// covering the policy or the subject.
	//
	// ⚠ ASSERTED ON THE ROW, NOT ON THE AGGREGATE, AND THAT IS `SL-3a` MADE STRUCTURAL. The aggregate is wrong
	// here too, but asserting it would put this test inside `E2E-005-M2`'s blast radius, and one mutant reddening
	// two clauses proves neither. The row is where the arbitration happens; the kernel is innocent.
	it('O-d(disclosure) — under ONE policy the disagreement is arbitrated by REQUEST ORDER: the read model reports the LAST-REQUESTED completed verdict, not the last-completed one, and drops the other (REG-F-215 as corrected by REG-F-299)', () => {
		const reported = (
			requestOrder: readonly Rival[],
			completionOrder: readonly Rival[]
		): string => {
			const j = baseJourney();
			// The two orders are driven as two separate passes, which is the only way to vary them independently.
			for (const r of requestOrder) request(j, r.id, JOURNEY_POLICY);
			for (const r of completionOrder) {
				begin(j, r.id);
				const done = complete(j, {
					assessmentId: r.id,
					policyId: JOURNEY_POLICY,
					disposition: r.disposition,
					validatorId: r.validatorId,
					evaluator: r.evaluator
				});
				// Fail-loud on the ARRANGEMENT. A refused completion would leave `disposition` undefined and quietly
				// turn this into a test about one verdict, which is the failure mode the whole disclosure is about.
				if (done.status !== 'ACCEPTED')
					throw new Error(
						`arrangement: completing ${r.id} was refused ${JSON.stringify(done.error)}`
					);
			}
			const view = buildAssuranceView(j.engine.readAllEvents());
			const completedCovering = Object.values(view.assessments).filter(
				(a) =>
					a.policyId === JOURNEY_POLICY &&
					a.disposition !== undefined &&
					a.subjectObjectIds.includes(PWU)
			).length;
			const rows = policyRowsFor(j, [JOURNEY_POLICY]);
			return `${completedCovering} completed -> ${rows.map((row) => `${row.assessmentId}=${row.disposition}`).join(', ')}`;
		};
		expect(
			[
				reported([RIVAL_ARCH, RIVAL_SEC], [RIVAL_SEC, RIVAL_ARCH]),
				reported([RIVAL_SEC, RIVAL_ARCH], [RIVAL_ARCH, RIVAL_SEC]),
				reported([RIVAL_ARCH, RIVAL_SEC], [RIVAL_ARCH, RIVAL_SEC])
			],
			'the §38 policy row must report the verdict of the LAST-REQUESTED completed assessment and drop the other — arbitration by REQUEST ORDER, not by completion recency (REG-F-215 as corrected by REG-F-299). The three arrangements vary request order and completion order independently, so this tuple separates last-requested from last-completed (which predicts [A=SATISFIED, B=REJECTED, B=REJECTED]), from first-requested (`E2E-005-M3`: [A, B, A]), from first-completed ([B, A, A]) and from "RIVAL_B always wins" ([B, B, B])'
		).toEqual([
			`2 completed -> ${RIVAL_B}=REJECTED`,
			`2 completed -> ${RIVAL_A}=SATISFIED`,
			`2 completed -> ${RIVAL_B}=REJECTED`
		]);
	});

	// ⚠⚠ THE HUMAN REVIEW PACKAGE DOES NOT EXIST, AND THE VERDICT IS `ABSENT` ONLY BECAUSE THE SEARCH WAS RUN IN
	// BOTH DIRECTIONS AND WITH A POSITIVE CONTROL. An ABSENT verdict that is really PRESENT is the worst outcome
	// available here, so the searches are recorded rather than summarized:
	//
	//   (1) BY NAME, over `packages/` and `apps/`:
	//       `ReviewPackage|REVIEW_PACKAGE|reviewPackage|HumanReviewPackage`                  -> 0 files.
	//   (2) BY CONTENT — the components DOC-006 requires of the package and DOC-004 §37's field names, so that an
	//       implementation living under a DIFFERENT name could still be found:
	//       `decisionRequested|executiveSummary|materialClaims|availableOptions|consequencesOfDelay|
	//        originatingIntentSummary|recommendedOption`                                     -> 0 files.
	//   (3) BY CONCEPT — anything that could SUMMARIZE a disagreement rather than merely hold one:
	//       `disagreement|dissent|conflictingAssessment|contradictingAssessment|arbitrat`    -> no production
	//       symbol; the hits are prose in the enforcement register and unrelated uses of "disagree" in
	//       projection comments.
	//   (4) POSITIVE CONTROL, same population and same filters: `ASSURANCE_ASSESSMENT` -> 68 files. The
	//       instrument can find a concept that exists, so the three zeroes are about the repository rather than
	//       about the search.
	//   (5) AND THE CENSUS IS RE-RUN LIVE BELOW, over the projections barrel itself rather than over my memory of
	//       a grep — DERIVED from the module at runtime, with `buildAssuranceView` as the control that the module
	//       actually loaded. A hand-listed absence is the defect one level up.
	//
	// ⚠⚠ AND (5) MEASURES EXPORT IDENTIFIERS, NOT THE CONCEPT — SAID PLAINLY, BECAUSE THE FIRST DRAFT'S MESSAGE DID
	// NOT. `exported.filter((name) => /review|package/i.test(name))` reads NAMES. A projection called
	// `buildDecisionBrief` or `assembleEscalationDossier` would pass it untouched, and search (2) above exists for
	// precisely that reason — but (2) is an OFFLINE grep recorded here, not the thing re-run live. So the runtime
	// pin is narrower than the searches it sits under, and its message now says which of the two it is. What the
	// pin genuinely delivers: the day this barrel acquires an export named for a review or a package, it reddens.
	//
	// ⚠⚠ AND "NO FIELD CARRIES A PACKAGE" WOULD BE FALSE, SO IT IS NOT CLAIMED. `EscalationRuleSchema.requiredPackage`
	// is `z.array(z.string())` (rph-contracts/src/objects.ts:221, transcribed from DOC-004 §13) — a RATIFIED field
	// naming what a package handed to an escalation target must contain. Checked the other direction too: outside
	// its own declaration, generated schemas, the canonical vocabulary and test fixtures, NO production line reads
	// it. So the true claim is about BUILDERS — nothing assembles a package — not about the vocabulary, which has
	// the word.
	//
	// ⚠⚠ AND THE BASELINE PACKAGE IS *NOT* AN ABSENT SURFACE. THE FIRST DRAFT'S MESSAGE SAID CLAUSE (e) NAMES "a
	// surface this engine has never had" AND THEN LISTED THE BASELINE PACKAGE AMONG THEM, TWELVE LINES BELOW A
	// HELPER THAT BUILDS ONE. `stageBaseline` dispatches `CreateBaseline` with `itemObjectIds: [PWU]` and
	// `assuranceAssessmentIds: [ARCH_ASSESSMENT, SEC_ASSESSMENT]`, and `O-f(partial)` drives that Baseline to
	// AUTHORITATIVE; the frozen contents survive into `itemObjectVersions`, `BaselineCreated` and
	// `BaselinePromoted`. The parallel E2E-004 Slice records the same correction from its own driving —
	// `CreateBaselinePayload.itemObjectIds` is `z.array(z.string())` with no type restriction, so package contents
	// are real. Clause (e) of RPH-E2E-005 names the HUMAN REVIEW package and nothing else; the baseline package is
	// a different ratified surface (RPH-E2E-004, RPH-ASR-009) and it EXISTS. The narrow register reading
	// (JPWB-REG-005:9863 — no artifact NAMED baseline package) supports "no export is named that", which is all
	// the assertion below now says.
	//
	// ⚠ ALREADY RECORDED — CITE, DO NOT RE-FILE. `docs/_working/AUDIT-shape-survivorship-2026-08-20.md:144`
	// carries the row `HumanReviewPackage (§37) | ABSENT` with its own both-directions search, `:370` records the
	// independent refutation stage as HELD and names `m12-conformance.json RPH-E2E-005` among the prose-only hits,
	// and JPWB-REG-005 records that `RPH-ASR-009`'s NOT_A_COMMAND_REFUSAL disposition rests on four surfaces of
	// which "Two of the four have ZERO implementation".
	//
	// ⚠ WHAT IS ASSERTED INSTEAD, AND IT IS NOT NOTHING. The disagreement IS recordable as a governed, durable
	// fact: `ObservationTypeSchema` carries `CONFLICT` as a first-class member, and an observation recorded under
	// it holds the statement, inherits the subject and lands OPEN. That is the same shape as E2E-002's finding
	// that `DecisionType.RESHAPE` is a real carrier for a clause whose surface had been reported absent — and the
	// lesson there was that a search for ONE token family had reported a gap that was not there. So the carrier is
	// asserted, and the third assertion records what the carrier CANNOT do: it hangs off one assessment and names
	// only that one, so even the carrier does not join the two verdicts. Nothing summarizes; nothing even relates.
	it('O-e(absent) — there is NO human review package; the disagreement is recordable as a CONFLICT observation and is summarized by nothing', async () => {
		const j = journey();
		const conflict = j.state(CONFLICT_OBSERVATION) ?? {};
		expect(
			conflict.observationType,
			'the disagreement must be recordable as a governed CONFLICT observation — the one carrier clause (e) actually has, against the review package it does not'
		).toBe('CONFLICT');
		expect(
			[conflict.disposition, conflict.subjectObjectIds],
			'and it must be OPEN and name the architecture PWU, inherited from the assessment rather than stated by the caller'
		).toEqual(['OPEN', [PWU]]);
		// PINS THE LIMIT OF THE CARRIER. The observation belongs to the REJECTING assessment and names it alone;
		// the approving assessment appears in no field of it, under any key.
		expect(
			[conflict.assessmentId, JSON.stringify(conflict).includes(ARCH_ASSESSMENT)],
			'PINNED LIMIT: the CONFLICT observation hangs off ONE assessment and names only that one — nothing in the record joins the two contradicting verdicts'
		).toEqual([SEC_ASSESSMENT, false]);

		// (5) The live census. DERIVED from the barrel, never hand-listed.
		const projections = await import('@janumipwb/rph-projections');
		const exported = Object.keys(projections);
		expect(
			exported,
			'CONTROL — the projections barrel must actually have loaded, or the absence census below would be vacuous'
		).toContain('buildAssuranceView');
		expect(
			exported.filter((name) => /review|package/i.test(name)),
			'PINNED ABSENCE, AND ONLY AS WIDE AS ITS FILTER: no export IDENTIFIER in the projections barrel is named for a review or a package. This measures NAMES — a builder living under another name would pass it untouched, which is what the offline by-content search (2) is for and this is not. It is NOT a claim that no baseline package exists: `stageBaseline` builds one and `O-f(partial)` promotes it. What is absent is a BUILDER, and this assertion is what tells you the day the barrel acquires one'
		).toEqual([]);
	});

	// ⚠⚠ THE REFUSAL HALF OF THIS CLAUSE ALREADY HAS LIVE COVERAGE AND IS NOT DUPLICATED HERE.
	// `execrem-wp16-enforcement-observed.test.ts` drives RPH-BAS-004 at the bus as
	// `promotionProbe('unsatisfied-assessment')`, arrangement "PromoteBaseline listing a REJECTED assessment among
	// its required set, against the identical promotion listing only the SATISFIED one", and the register row
	// names the site (`canPromoteBaseline`'s `findAssessmentDefects`) and the marker
	// (`REQUIRED_ASSESSMENT_NOT_SATISFIED`). What THIS test adds is the thing only a journey can say: the refusal
	// stands even though a SATISFIED verdict from a second, independence-VERIFIED validator is sitting in the same
	// store, over the same subject, at the same version. An approval does not lift a rejection.
	//
	// ⚠ AND THE CONTROL IS WHY THIS IS NAMED `(partial)`. The byte-adjacent promotion that changes ONE field —
	// dropping the rejecting assessment from `requiredAssessmentIds` and touching nothing else — is ACCEPTED, and
	// the baseline goes AUTHORITATIVE with the rejection still REJECTED and its finding still OPEN. Nothing in the
	// engine consults the SET of assessments over the baselined item; `promoteBaseline` reads the list the
	// PROMOTER hands it. The Baseline object froze BOTH assessment ids at `CreateBaseline` and the gate never
	// looks at them. So the ratified word that survives is "automatically": promotion does not happen by itself.
	// "The baseline is not promoted", full stop, is FALSE — and a Slice that ran only the refusal would have
	// reported it as true. The register knew: RPH-BAS-004's own row records "THE ANTECEDENT IS SATISFIED BY THE
	// CALLER, NOT THE SYSTEM ... A promotion listing NONE passes this arm vacuously". This is that admission
	// driven from an E2E journey in which a real, contradicting verdict is what gets left off the list.
	//
	// ⚠ ONE GUARD, PROVED BY THE MESSAGE. This promotion is refusable on several independent grounds at once, and
	// a bare `not.toBe('ACCEPTED')` cannot tell them apart. The gate joins EVERY finding code into one message, so
	// asserting that the message ENDS with the code — nothing after it — proves the assessment disposition was the
	// SOLE ground. That is also why the security finding is MATERIAL rather than BLOCKING: a blocking severity
	// would have added `OPEN_BLOCKING_FINDING` to the same list, and the arrangement would have tripped two guards
	// and proved neither.
	it('O-f(partial) — promotion is refused for the REJECTED assessment, and the CONTROL shows the refusal is only as wide as the required set the promoter names', () => {
		const j = journey();
		carryRejectionToPwu(j);
		stageBaseline(j);

		const naming = j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
			promotionDecisionId: DECISION,
			expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
			requiredAssessmentIds: [ARCH_ASSESSMENT, SEC_ASSESSMENT]
		});
		expect(
			naming.status,
			'a promotion that NAMES the rejecting assessment must be refused, and refused for THAT assessment alone — clause (f), with the approving verdict already in the store and not lifting it'
		).not.toBe('ACCEPTED');
		expect(
			String((naming.error as { message?: string } | undefined)?.message ?? ''),
			'and the refusal must carry REQUIRED_ASSESSMENT_NOT_SATISFIED as its SOLE ground — the gate joins every finding code into this one message, so a single trailing code is what proves ONE guard fired rather than several'
		).toMatch(/: REQUIRED_ASSESSMENT_NOT_SATISFIED$/);

		// THE CONTROL. One field differs: the rejecting assessment is not named. Nothing else changes — same
		// baseline, same decision, same items, same store, and the REJECTED assessment still sitting in it.
		const omitting = j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
			promotionDecisionId: DECISION,
			expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
			requiredAssessmentIds: [ARCH_ASSESSMENT]
		});
		expect(
			omitting.status,
			'CONTROL — the identical promotion that merely OMITS the rejecting assessment is ACCEPTED: the refusal above proves only that the caller named it, never that the engine consulted the set'
		).toBe('ACCEPTED');
		expect(
			[
				(j.state(BASELINE) ?? {}).status,
				(j.state(SEC_ASSESSMENT) ?? {}).assessmentState,
				(j.state(SEC_FINDING) ?? {}).disposition
			],
			'PINNED ADMISSION: the baseline reaches AUTHORITATIVE while the rejection still reads REJECTED and its finding still reads OPEN — "not promoted AUTOMATICALLY" is the whole of what clause (f) delivers'
		).toEqual(['AUTHORITATIVE', 'REJECTED', 'OPEN']);
	});
});
