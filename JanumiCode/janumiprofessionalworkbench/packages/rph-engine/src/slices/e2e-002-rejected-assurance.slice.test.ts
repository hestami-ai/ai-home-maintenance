// JAN-SLICE-SWP-03 — RPH-E2E-002, the journey where the work RAN and the profession said NO.
//
// The ratified statement (`m12-conformance.json`, `sourceRef: "§24"`), verbatim:
//   "When architecture generation succeeds but lacks enforceable tenant isolation, execution is SUCCEEDED,
//    assurance is REJECTED, the Architecture PWU is not satisfied, a blocking observation is created, baseline
//    promotion is unavailable, and the controller recommends reshape or replan."
//
// ── WHY THIS IS THE SECOND SLICE AND NOT THE FIFTH ──────────────────────────────────────────────────────────
// `RPH-E2E-001` proves the engine can carry a journey to a good end. This one proves it can REFUSE one — and the
// distinction between the two is the product. An engine that reports success because the work ran is a workflow
// engine; an engine that separates "it ran" from "it was right" is a professional harness. That separation is
// `INV-5` and Property `P1`, and this Slice is where a journey exercises it end to end: clause (a) and clause (b)
// are TRUE AT THE SAME TIME, about the same work.
//
// ── WHAT IS ASSERTED, AND WHAT IS DISCLOSED INSTEAD ─────────────────────────────────────────────────────────
// Four of the six clauses hold as ratified and are asserted as such. TWO DO NOT, and each is named for what it
// actually proves rather than for the clause it would like to claim:
//
//   (c) is PARTIAL. The PWU demonstrably cannot reach SATISFIED here, but not for the ratified REASON:
//       `RPH-PWU-007` ("any rejected mandatory assessment blocks satisfaction") is UNENFORCED_DISCLOSED in the
//       enforcement register, because the engine checks the assessment it was HANDED and never the SET. A second
//       satisfied assessment would let this same PWU through. The test name says so.
//   (f) is PARTIAL, and its defect was found by driving it rather than by reading. See `O-f(partial)` below.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE — the same prohibition the E2E-001 Slice records. It converts a
// false clause into a green suite, which is `SL-8`'s "weakened to green" wearing a different hat.
import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	changeState,
	executeWork,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'E2E-002',
	title: 'Execution succeeds, assurance rejects, and nothing downstream is permitted to proceed',
	plane: 'ENGINE',
	// ⚠ THE ROADMAP'S §9 TABLE PROPOSES THIS ASSIGNMENT AND ITS OWN PREAMBLE FORBIDS INHERITING IT — the
	// assignments "MUST be ratified in SWP-02 and SWP-03, not inherited from this table". Ratified here, with the
	// reason: every command in this journey is ACCEPTED and the work genuinely succeeds. What differs from the
	// normal path is the professional VERDICT, not an error, a failure or an unavailability. That is the
	// definition of an alternate valid path, and it is why this is not a `user-error path` (nothing is malformed)
	// nor a `system-failure path` (nothing failed).
	scenarioClass: 'alternate valid path',
	citedRules: ['RPH-E2E-002'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'E2E-002-M1',
			file: 'packages/rph-domain/src/governance.ts',
			find: "code: 'OPEN_BLOCKING_FINDING'",
			replace: "code: 'MUTANT_UNRELATED_REFUSAL'",
			expectRed: ['O-e'],
			predictedMessage:
				'promotion must be refused for the OPEN BLOCKING observation specifically — clause (e) of the ratified Then block',
			why: "Proves clause (e) is asserted on the CODE the promotion gate emits, not merely on the fact that some refusal occurred. A promotion can be refused for a dozen unrelated reasons; only this code says it was the blocking finding. ⚠ THE FIRST VERSION REPLACED THE CODE WITH 'OPEN_BLOCKING_FINDING_MUTANT' AND STAYED GREEN — the replacement CONTAINS the original, and the assertion is a `toContain`. A mutant whose replacement is a superstring of its anchor cannot redden a substring check; the replacement must share no substring with what the assertion looks for. This is the same trap the register records for \bENFORCED\b inside UNENFORCED."
		},
		{
			id: 'E2E-002-M2',
			file: 'packages/rph-application/src/handlers/assurance.ts',
			find: 'recommendedControlActions: p.validatorResult?.recommendedControlActions ?? [],',
			replace: 'recommendedControlActions: [],',
			expectRed: ['O-f(partial)'],
			predictedMessage:
				'the validator recommendation must survive into the emitted event — clause (f), the only half of it that survives anywhere',
			why: "Proves clause (f) is asserted on the EVENT payload, which is the one place the recommendation actually reaches. Siting this mutant on the object's field instead would have proved nothing: that field is already, always empty."
		},
		{
			id: 'E2E-002-M3',
			file: 'packages/rph-domain/src/pwuGuards.ts',
			find: "'UNDER_ASSURANCE->SATISFIED': (a) => a.assuranceState === 'SATISFIED',",
			replace: "'UNDER_ASSURANCE->SATISFIED': () => true,",
			expectRed: ['O-c(partial)'],
			predictedMessage:
				'the architecture PWU must not reach SATISFIED on a rejected assessment — clause (c), narrowed to the one assessment this journey has',
			why: "Proves clause (c) is asserted on the CROSS-AXIS GUARD that is the structural expression of property P1 — the only legal path into workLifecycle SATISFIED runs through assuranceState SATISFIED. ⚠ TWO EARLIER VERSIONS WERE WRONG AND THE MUTANT IS WHAT SAID SO. The first RENAMED a function, which breaks compilation rather than changing behaviour. The second disabled `rejectUnbackedDisposition` at its call site — a plausible guess, and the Slice STAYED GREEN, proving that guard is not what refuses this move. Only then was the real mechanism found. A clause whose stated reason has never been mutated is a clause whose reason is a guess."
		}
	]
};

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5T00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5T10';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5T20';
const EVIDENCE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5T30';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5T40';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5T50';
const ATTEMPT = 'att_01ARZ3NDEKTSV4RRFFQ69G5T60';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5T70';
const OBSERVATION = 'obs_01ARZ3NDEKTSV4RRFFQ69G5T80';
const DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5T90';
const BASELINE = 'base_01ARZ3NDEKTSV4RRFFQ69G5TA0';
const RESHAPE_DECISION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5TB0';

/**
 * The journey, to the point where every clause is decidable.
 *
 * ⚠ THE OBSERVATION IS RECORDED WHILE THE ASSESSMENT IS OPEN, NOT AFTER IT COMPLETES, AND THAT ORDER IS FORCED.
 * `RecordAssuranceObservation` inherits its `subjectObjectIds` FROM THE ASSESSMENT — the caller never names the
 * PWU — so the observation can only reach the right subject through a live assessment. Recording it after
 * completion was driven first and is not available: the assessment is terminal by then.
 */
function journey(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });

	// (a) The work RUNS, and succeeds. Earned through a real plan, a real step and a real produced output.
	executeWork(j, { pwuId: PWU, planId: PLAN, stepId: STEP, attemptId: ATTEMPT, claimId: CLAIM, evidenceId: EVIDENCE });

	// The profession looks at what was produced.
	j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		assessmentId: ASSESSMENT,
		assurancePolicyId: 'pol_01ARZ3NDEKTSV4RRFFQ69G5S00',
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU],
		subjectSemanticVersions: { [PWU]: 1 },
		claimIds: [CLAIM]
	});
	j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {});

	// (d) The finding: no enforceable tenant boundary. BLOCKING, and OPEN.
	j.send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBSERVATION, {
		assessmentId: ASSESSMENT,
		observationType: 'FINDING',
		findingCode: 'MISSING_SECURITY_BOUNDARY',
		severity: 'BLOCKING',
		statement: 'The architecture asserts tenant isolation but establishes no enforceable boundary.'
	});

	// (b) and (f): the verdict, carrying the validator's recommended corrective action.
	j.send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESSMENT, {
		validatorResult: {
			validatorId: 'deterministic.slice-journey',
			validatorVersion: '1',
			policyId: 'pol_01ARZ3NDEKTSV4RRFFQ69G5S00',
			policyVersion: '1.0.0',
			assessmentId: ASSESSMENT,
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimResults: [],
			evidenceConsideredIds: [EVIDENCE],
			evidenceRejected: [],
			observations: [],
			dispositionRecommendation: 'REJECTED',
			recommendedControlActions: [
				{ action: 'RESHAPE_PWU', rationale: 'the isolation boundary must be designed before this can be assured' }
			],
			residualUncertainty: [],
			limitations: [],
			executionProvenance: {}
		}
	});
	return j;
}

/**
 * Move the PWU's assurance axis onto the verdict. A separate act from the assessment: see `O-b` below.
 *
 * ⚠ FOUR HOPS, NOT ONE, AND BOTH MACHINES ARE WHY. `PWU.assuranceState` has no `UNASSESSED -> ASSESSING` arrow —
 * the ratified path is `UNASSESSED -> EVIDENCE_REQUIRED -> READY_FOR_ASSESSMENT -> ASSESSING -> REJECTED`. And
 * `workLifecycleState` has no `EXECUTING -> UNDER_ASSURANCE` arrow either; it goes through EVIDENCE_PENDING. Two
 * successive drafts were refused here, each naming the exact missing arrow, and the hops below are the ratified
 * paths rather than a guess. A multi-axis setter permits an axis to HOLD, which is how the two machines are
 * walked in step.
 *
 * ⚠ NOTE WHAT THIS MAKES TRUE FOR CLAUSE (c): `UNDER_ASSURANCE -> SATISFIED` IS a legal arrow in the matrix. So
 * the refusal that clause asserts cannot be the machine declining an undeclared move — it has to come from the
 * disposition guard. That is what makes the (c) assertion worth anything.
 */
function carryVerdictToPwu(j: Journey): void {
	const hop = (previousState: string, newState: string, assuranceState: string): void =>
		changeState(j, PWU, {
			previousState,
			newState,
			executionState: 'SUCCEEDED',
			assuranceState,
			supportingObjectIds: [ASSESSMENT]
		});
	hop('EXECUTING', 'EVIDENCE_PENDING', 'EVIDENCE_REQUIRED');
	hop('EVIDENCE_PENDING', 'EVIDENCE_PENDING', 'READY_FOR_ASSESSMENT');
	hop('EVIDENCE_PENDING', 'UNDER_ASSURANCE', 'ASSESSING');
	hop('UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'REJECTED');
}

describe('SLICE E2E-002 — architecture generation succeeds and assurance rejects it', () => {
	// ⚠ THE TWO CLAUSES BELOW ARE ASSERTED IN ONE TEST *ON PURPOSE*, AND IT IS THE ONLY SUCH TEST HERE. Read
	// separately they are two ordinary facts; read together they are the rule's entire point, and `SL-3a`'s
	// concern (one mutant appearing to prove several clauses) does not arise because no mutant is claimed for
	// this pairing — it is claimed for (a) and (b) individually, below.
	it('O-a + O-b — execution reads SUCCEEDED and assurance reads REJECTED, about the same work at the same time', () => {
		const j = journey();
		const pwu = j.state(PWU) ?? {};
		expect(
			pwu.executionState,
			'execution must read SUCCEEDED — the work RAN, and clause (a) says so'
		).toBe('SUCCEEDED');
		expect(
			(j.state(ASSESSMENT) ?? {}).assessmentState,
			'and the assessment over that same work must read REJECTED — clause (b). Both at once is INV-5: an engine that could not hold these two facts together would be a workflow engine, not a harness.'
		).toBe('REJECTED');
	});

	// ⚠ THE PWU'S ASSURANCE AXIS IS A SECOND, SEPARATE FACT FROM THE ASSESSMENT'S STATE, AND A FIRST DRAFT OF THIS
	// SLICE MISSED IT. Completing the assessment as REJECTED leaves the PWU at `assuranceState: 'UNASSESSED'` —
	// driven and observed. The controller must CARRY the verdict onto the work with `ChangePwuState`. That is not
	// a defect: it is the exec≠assurance separation appearing a second time, one level up. But a Slice that
	// asserted only the assessment would have reported clause (b) as holding while the PWU still read UNASSESSED.
	it('O-b — the verdict is carried onto the work itself, not left on the assessment', () => {
		const j = journey();
		carryVerdictToPwu(j);
		expect(
			(j.state(PWU) ?? {}).assuranceState,
			'the Architecture PWU itself must read REJECTED — clause (b) at the level of the work, not merely of the assessment'
		).toBe('REJECTED');
	});

	// ⚠⚠ NAMED FOR WHAT IT PROVES, NOT FOR THE CLAUSE IT WOULD LIKE TO CLAIM. The ratified clause is "the
	// Architecture PWU is not satisfied", whose ratified GROUND is `RPH-PWU-007`: *any* rejected mandatory
	// assessment blocks satisfaction. That rule is UNENFORCED_DISCLOSED — the engine checks the assessment it was
	// handed, never the SET, and `disclosure-observed.test.ts` drives the live admission where a PWU with a
	// REJECTED assessment reaches SATISFIED by citing a second, satisfied one.
	//
	// What IS true, and what this asserts: in a journey whose only assessment is the rejected one, the move to
	// SATISFIED is refused. That is the narrower claim, and the name carries the narrowing so no reader mistakes
	// this green for `RPH-PWU-007` being enforced.
	//
	// ⚠ AND THE MECHANISM IS NOT THE ONE THIS TEST FIRST CLAIMED. `UNDER_ASSURANCE -> SATISFIED` is a LEGAL arrow,
	// so the matrix does not refuse it. The refusal comes from the cross-axis guard
	// `WORK_LIFECYCLE_CROSS_AXIS_GUARDS['UNDER_ASSURANCE->SATISFIED']` in `pwuGuards.ts`, which is property P1
	// itself: the only path into workLifecycle SATISFIED runs through assuranceState SATISFIED. A draft of this
	// Slice attributed the refusal to `rejectUnbackedDisposition`; driving the mutant showed the Slice stayed
	// GREEN with that guard disabled, which is how the true mechanism was found.
	it('O-c(partial) — with only the rejected assessment to cite, SATISFIED is refused; the ratified "any rejected assessment" rule is NOT enforced (RPH-PWU-007)', () => {
		const j = journey();
		carryVerdictToPwu(j);
		const refused = j.attempt('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', PWU, {
			previousState: 'UNDER_ASSURANCE',
			newState: 'SATISFIED',
			executionState: 'SUCCEEDED',
			assuranceState: 'REJECTED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [ASSESSMENT]
		});
		expect(
			refused.status,
			'the architecture PWU must not reach SATISFIED on a rejected assessment — clause (c), narrowed to the one assessment this journey has'
		).not.toBe('ACCEPTED');
	});

	it('O-d — a BLOCKING observation exists, is OPEN, and names the architecture as its subject', () => {
		const j = journey();
		const obs = j.state(OBSERVATION) ?? {};
		expect(obs.severity, 'the finding must be BLOCKING — clause (d) of the ratified Then block').toBe('BLOCKING');
		expect(obs.disposition, 'and it must be OPEN; a closed finding blocks nothing').toBe('OPEN');
		// NOT asserted by existence alone. An observation that named some other subject would satisfy a count and
		// block nothing — and the caller never names the PWU here, so this also proves the inheritance works.
		expect(
			obs.subjectObjectIds,
			'and it must name the architecture PWU it is about — inherited from the assessment, never stated by the caller'
		).toEqual([PWU]);
	});

	it('O-e — baseline promotion is refused, and refused FOR the open blocking finding', () => {
		const j = journey();
		carryVerdictToPwu(j);
		j.send('ProposeDecision', 'DECISION', DECISION, {
			decisionType: 'PROMOTE_BASELINE',
			subjectObjectIds: [PWU, BASELINE],
			selectedOption: 'promote',
			rationale: 'the architecture is ready to baseline',
			authority: { actorId: 'owner-1', actorType: 'HUMAN', displayName: 'Undertaking Owner' }
		});
		j.send('ApproveDecision', 'DECISION', DECISION, {
			selectedOption: 'promote',
			rationale: 'the architecture is ready to baseline',
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: { [PWU]: 1 }
		});
		j.send('CreateBaseline', 'BASELINE', BASELINE, {
			baselineType: 'ARCHITECTURE',
			itemObjectIds: [PWU],
			assuranceAssessmentIds: [ASSESSMENT]
		});
		j.send('SubmitBaselineForReview', 'BASELINE', BASELINE, {});
		j.send('ApproveBaseline', 'BASELINE', BASELINE, {});

		const promotion = j.attempt('PromoteBaseline', 'BASELINE', BASELINE, {
			promotionDecisionId: DECISION,
			expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
			requiredAssessmentIds: [ASSESSMENT]
		});
		expect(promotion.status, 'baseline promotion must be unavailable — clause (e)').not.toBe('ACCEPTED');
		// ⚠ THE CODE, NOT MERELY THE REFUSAL. This promotion is refusable on several independent grounds at once
		// (a REJECTED required assessment is another), and a bare `not.toBe('ACCEPTED')` cannot tell them apart —
		// the arrangement would trip two guards and prove neither. The message must name the blocking finding.
		expect(
			JSON.stringify(promotion.error ?? {}),
			'promotion must be refused for the OPEN BLOCKING observation specifically — clause (e) of the ratified Then block'
		).toContain('OPEN_BLOCKING_FINDING');
	});

	// ⚠⚠ THIS CLAUSE IS WHERE DRIVING FOUND WHAT READING DID NOT, AND THE FINDING IS RECORDED RATHER THAN
	// SMOOTHED OVER.
	//
	// The ratified clause is *"the controller recommends reshape or replan"*. Three things are true, and they had
	// to be driven to be told apart:
	//
	//   1. A governed carrier EXISTS. `DecisionType` has `RESHAPE` and `REPLAN` as first-class members, so the
	//      recommendation can be recorded as a real Decision. That is asserted below. An earlier reading of this
	//      repository concluded the opposite — that no carrier existed anywhere — on the strength of a search for
	//      the `ControlAction` token family alone. It was wrong, and a Slice built on it would have recorded a
	//      gap that is not there.
	//   2. The VALIDATOR's recommendation reaches the emitted event, and is asserted here.
	//   3. ⚠ AND IT NEVER REACHES THE OBJECT. `completeAssuranceAssessment` writes
	//      `recommendedControlActions` into the EVENT payload, while the sibling `mutate` builds the object state
	//      from `base` — where the field was initialised to `[]` at request time and is never updated. So every
	//      read model that reads the object sees an empty list forever, no matter what any validator recommends.
	//      OBSERVED, not inferred: the completion was ACCEPTED, the event carried the recommendation, and the
	//      object's field was still `[]`.
	//
	// So the clause is asserted at the two levels where it is true, and its third level is disclosed. What is NOT
	// claimed: that any read model surfaces this to a professional. It does not.
	it('O-f(partial) — the recommendation is recordable as a governed Decision and survives into the event; it never reaches the assessment OBJECT', () => {
		const j = journey();
		carryVerdictToPwu(j);

		// (1) The controller records the corrective action as a governed fact.
		j.send('ProposeDecision', 'DECISION', RESHAPE_DECISION, {
			decisionType: 'RESHAPE',
			subjectObjectIds: [PWU],
			selectedOption: 'reshape the architecture around an enforceable tenant boundary',
			rationale: 'assurance rejected the architecture for want of an enforceable isolation boundary',
			authority: { actorId: 'owner-1', actorType: 'HUMAN', displayName: 'Undertaking Owner' }
		});
		expect(
			(j.state(RESHAPE_DECISION) ?? {}).decisionType,
			'the controller must be able to record RESHAPE as a governed decision — clause (f), the carrier half'
		).toBe('RESHAPE');

		// (2) The validator's recommendation survives into the emitted event.
		const completed = j.engine
			.readAllEvents()
			.find((e) => e.eventType === 'AssuranceAssessmentCompleted');
		expect(
			(completed?.payload as { recommendedControlActions?: unknown[] } | undefined)?.recommendedControlActions,
			'the validator recommendation must survive into the emitted event — clause (f), the only half of it that survives anywhere'
		).toEqual([
			{ action: 'RESHAPE_PWU', rationale: 'the isolation boundary must be designed before this can be assured' }
		]);

		// (3) And the object does not carry it. This assertion PINS A DEFECT rather than certifying a behaviour:
		// it is written to FAIL the day the object starts carrying the recommendation, so the fix cannot land
		// silently and this disclosure cannot outlive the thing it discloses.
		expect(
			(j.state(ASSESSMENT) ?? {}).recommendedControlActions,
			'PINNED DEFECT: the assessment OBJECT drops the recommendation the event carried, so no read model can surface it. Repair this and this assertion is what tells you the disclosure above is now stale.'
		).toEqual([]);
	});
});
