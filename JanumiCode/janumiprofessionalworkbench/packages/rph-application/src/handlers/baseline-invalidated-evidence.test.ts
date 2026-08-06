// W1 WIRE-3b (JAN-ROADMAP-001 gate G1 condition C1): PromoteBaseline now enforces Property P4 / conformance test
// CT-10 — "invalidated evidence re-examines the claims it supported." A baseline promotion is an authoritative
// act; before this increment it could rest on evidence that had since been INVALIDATED, because the trace-graph
// kernel (classifyEvidenceInvalidation) needed a runtime SUPPORTS graph that is never built. This wires the
// corpus's own PULL-GUARD instead (transitions.data §16.2), over forward references only: the required
// assessments' claims' supportingEvidenceIds, and the promotion decision's consideredEvidenceIds. These tests
// drive the LIVE pipeline and assert the CALL SITE blocks a promotion that rests on invalidated evidence.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V02';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V03';
const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5V04';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V05';
const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5V06';

interface SetupOpts {
	assessmentClaimIds: string[];
	consideredEvidenceIds: string[];
	invalidate: boolean;
}

describe('PromoteBaseline blocks on invalidated supporting evidence (P4 / CT-10, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			issuedBy: human,
			correlationId: 'corr-inv-ev',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string): string {
		return (store.loadObject(id)?.state as Record<string, string>)?.status ?? '';
	}

	/** Build intent -> pwu -> claim(+evidence) -> assessment -> decision -> baseline (APPROVED), optionally
	 *  invalidating the evidence at the end. The subject stays at semantic version 1 so only the evidence gate
	 *  can block the promotion. */
	function setup(opts: SetupOpts) {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
		seedPolicy(engine, 'pol_arch');
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT_ID, originatingExpression: 'ship it', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'd',
				intentId: INTENT_ID,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			},
			{ targetAggregateId: PWU_ID }
		);
		dispatch(
			'AssertClaim',
			{
				statement: 'The architecture is fit for its approved need',
				claimType: 'FITNESS',
				subjectObjectIds: [PWU_ID],
				supportingEvidenceIds: [EV]
			},
			{ targetAggregateId: CLAIM, targetAggregateType: 'CLAIM' }
		);
		dispatch(
			'ProposeEvidence',
			{
				evidenceId: EV,
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'file://fixture-artifact' },
				producedBy: human,
				supportsClaimIds: [CLAIM],
				contradictsClaimIds: [],
				scope: 'architecture',
				limitations: [],
				capturedAt: TS
			},
			{ targetAggregateId: EV, targetAggregateType: 'EVIDENCE' }
		);
		dispatch(
			'AdmitEvidence',
			{ admissibilityAssessmentId: 'a', admittedScope: 'architecture', admittedClaimIds: [CLAIM] },
			{ targetAggregateId: EV }
		);
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: opts.assessmentClaimIds
			},
			{ targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
		// assessment in READY, so it must be BEGUN before it can be assessed or completed.
		dispatch(
			'BeginAssuranceAssessment',
			{},
			{ targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		dispatch(
			'CompleteAssuranceAssessment',
			{
				validatorResult: floorValidatorResult({
					assessmentId: ASSESS,
					policyId: 'pol_arch',
					subjectId: PWU_ID,
					subjectSemanticVersion: 1,
					disposition: 'SATISFIED'
				})
			},
			{ targetAggregateId: ASSESS }
		);
		dispatch(
			'ProposeDecision',
			{
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: [PWU_ID],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: human
			},
			{ targetAggregateId: DEC, targetAggregateType: 'DECISION' }
		);
		dispatch(
			'ApproveDecision',
			{
				selectedOption: 'promote',
				rationale: 'ready',
				consideredEvidenceIds: opts.consideredEvidenceIds,
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU_ID]: 1 }
			},
			{ targetAggregateId: DEC }
		);
		dispatch(
			'CreateBaseline',
			{ baselineType: 'ARCHITECTURE', itemObjectIds: [PWU_ID], assuranceAssessmentIds: [ASSESS] },
			{ targetAggregateId: BASE, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: BASE });
		dispatch('ApproveBaseline', {}, { targetAggregateId: BASE });
		if (opts.invalidate) {
			dispatch('InvalidateEvidence', { invalidationReason: 'source retracted' }, { targetAggregateId: EV });
		}
	}

	function promote() {
		return dispatch(
			'PromoteBaseline',
			{
				promotionDecisionId: DEC,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE }
		);
	}

	// REG-F-010 GROUP 3, CLOSED 2026-08-03. This refusal carried the generic `RPH_INVARIANT_VIOLATION` and encoded
	// the actual condition in the MESSAGE PROSE, while `RPH_EVIDENCE_INVALIDATED` sat ratified and carried by no
	// refusal anywhere. A typed, classified error contract whose discriminating value travels in free text is
	// asserting a status nothing performs (CON-000 B7), and it is not cosmetic: `classifyRefusal`, the enforcement
	// register's own instrument, cannot tell apart two refusals that report the same code, and no consumer can
	// route on the contract.
	//
	// ASSERTED ON THE CONTRACT, NOT ON A STRING. The claim is that the refusal is CLASSIFIED as an assurance
	// failure — `category` is derived from `ERROR_CODE_CATEGORY`, so a future fix that chose a different assurance
	// code would still satisfy this, and reverting to `RPH_INVARIANT_VIOLATION` (category INVARIANT) could not.
	// The prose check stays: the code says WHAT KIND, the message still says WHICH evidence.
	it('blocks promotion when a required assessment claim rests on invalidated evidence (CT-10 claim path)', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [], invalidate: true });
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_INVALIDATED');
		expect(r.error?.category, 'an invalidated-evidence refusal is an ASSURANCE failure, not a bare invariant').toBe(
			'ASSURANCE'
		);
		expect(r.error?.message).toContain('INVALIDATED_EVIDENCE');
		expect(r.error?.message).toContain(CLAIM);
		expect(statusOf(BASE)).toBe('APPROVED'); // not AUTHORITATIVE
	});

	it('blocks promotion when the promotion decision considered evidence that is now invalidated (decision path)', () => {
		setup({ assessmentClaimIds: [], consideredEvidenceIds: [EV], invalidate: true });
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.message).toContain('INVALIDATED_EVIDENCE');
		expect(statusOf(BASE)).toBe('APPROVED');
	});

	it('promotes to AUTHORITATIVE when the supporting evidence is still admissible (the control must discriminate)', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [EV], invalidate: false });
		const r = promote();
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});

	// ══ §15.2 — A CONTESTED CLAIM CANNOT AUTHORIZE A PROMOTION (REG-D-024 INC-3) ═══════════════════════════════
	//
	// THESE LIVE HERE RATHER THAN IN THEIR OWN FILE because the arrangement is exactly this one — intent -> pwu ->
	// claim(+evidence) -> assessment -> decision -> baseline(APPROVED) — and a second copy of a 180-line fixture is
	// a second thing to drift. REG-F-015 is this repository's case study in a fixture that silently stopped
	// arranging what its name claimed; one fixture, exercised by every rule that needs it, is the cheaper honesty.
	//
	// WHAT WAS WRONG. `findContestedClaims` is a LIVE, RATIFIED §15.2 kernel predicate, wired into
	// `canPromoteBaseline`, emitting a CONTESTED_CLAIM finding — and `promoteBaseline` passed NO `contestedClaims`
	// argument at all. The field is optional and `?? []` inside, so every production promotion evaluated §15.2
	// against an empty list. Not an absent check: a ratified predicate that runs every time and can never fire,
	// reporting a clean §15.2 result forever. REG-F-022's Gate A shape.
	//
	// AND IT HAD A SECOND, INDEPENDENT REASON TO BE VACUOUS, which is why this is only fixable now: NO claim could
	// reach CONTESTED at all (REG-F-044 — one command targeted a CLAIM and hard-coded OPEN). Feeding the predicate
	// before REG-D-024's build would have handed it a list that was empty for a different reason, and the fix
	// would have looked complete while changing nothing.
	function contest() {
		expect(
			dispatch(
				'RecordClaimAssessment',
				{ targetStatus: 'UNDER_ASSESSMENT' },
				{ targetAggregateId: CLAIM, targetAggregateType: 'CLAIM' }
			).status,
			'arranging: OPEN -> UNDER_ASSESSMENT'
		).toBe('ACCEPTED');
		expect(
			dispatch(
				'RecordClaimAssessment',
				{ targetStatus: 'CONTESTED', rationale: 'the fitness argument does not hold at scale' },
				{ targetAggregateId: CLAIM, targetAggregateType: 'CLAIM' }
			).status,
			'arranging: UNDER_ASSESSMENT -> CONTESTED'
		).toBe('ACCEPTED');
	}

	// PREDICTED RED (run and observed): remove the `contestedClaims` argument from `promoteBaseline`'s
	// `canPromoteBaseline` call and this reddens while every other test in the file stays green — i.e. it
	// reproduces exactly the behaviour that shipped until today.
	it('§15.2 — a CONTESTED claim on a baseline item blocks promotion', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [EV], invalidate: false });
		contest();

		const r = promote();
		expect(r.status, 'a contested claim cannot authorize promotion').not.toBe('ACCEPTED');
		expect(String(r.error?.message)).toContain('CONTESTED_CLAIM');
		expect(statusOf(BASE), 'and the baseline did not move').toBe('APPROVED');
	});

	// THE CONTROL, on the same path and the same claim. Without it, the test above is indistinguishable from a
	// promotion refused for one of the gate's SIX other reasons — which is precisely how REG-F-015's file passed
	// for months while arranging nothing: every assertion was true, about a different refusal.
	// PREDICTED RED: make `contestedClaimsAgainstBaselineItems` report `contested: true` unconditionally and ONLY
	// this test reddens — proving the deriver reads the claim's status rather than merely finding the claim.
	it('CONTROL — the same claim at UNDER_ASSESSMENT does NOT block promotion', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [EV], invalidate: false });
		expect(
			dispatch(
				'RecordClaimAssessment',
				{ targetStatus: 'UNDER_ASSESSMENT' },
				{ targetAggregateId: CLAIM, targetAggregateType: 'CLAIM' }
			).status
		).toBe('ACCEPTED');

		const r = promote();
		expect(r.status, 'only CONTESTED blocks — not "any claim that is not SUPPORTED"').toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});

	// THE SCOPE CONJUNCT. A contested claim about something this baseline does not freeze must not block it —
	// otherwise the deriver is "any contested claim anywhere", which would be a different and unratified rule.
	// This is REG-F-015's OBJECT limb, which in that case turned out to compare a thing with itself.
	it('a CONTESTED claim about an object the baseline does not freeze does not block it', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [EV], invalidate: false });
		const foreign = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V77';
		expect(
			dispatch(
				'AssertClaim',
				{
					statement: 'an unrelated subject is fit',
					claimType: 'FITNESS',
					subjectObjectIds: ['pwu_01ARZ3NDEKTSV4RRFFQ69G5V78']
				},
				{ targetAggregateId: foreign, targetAggregateType: 'CLAIM' }
			).status
		).toBe('ACCEPTED');
		for (const targetStatus of ['UNDER_ASSESSMENT', 'CONTESTED'])
			expect(
				dispatch(
					'RecordClaimAssessment',
					{ targetStatus, rationale: 'unrelated' },
					{ targetAggregateId: foreign, targetAggregateType: 'CLAIM' }
				).status
			).toBe('ACCEPTED');

		const r = promote();
		expect(r.status, 'the contested claim names no item this baseline freezes').toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});
});
