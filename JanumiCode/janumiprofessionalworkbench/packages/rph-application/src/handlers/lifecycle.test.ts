// Drives the execution / assurance / governance / decomposition handler groups LIVE. The load-bearing proofs:
// (1) a decision needs a HUMAN authority to become EFFECTIVE — an AGENT-authored decision is rejected
// (GOV-001/002); (2) a baseline promotes to AUTHORITATIVE only through the full canPromoteBaseline gate
// (effective promotion decision + a SATISFIED required assessment + version pinning) and is rejected when the
// required assessment is not satisfied ("no green without assurance", INV-20).
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const agent = { actorId: 'agent-1', actorType: 'AGENT' as const, displayName: 'Agent' };
// This suite dispatches AS BOTH actors: the GOV-001/002 proof needs an AGENT-authored Decision (REG-F-014 means
// the issuer IS the recorded authority), while everything else is the governor's work. A two-principal
// directory is therefore the fixture, not the single shared credential.
const DIR = testDirectory([
	{ ...human, tenantId: 't', organizationId: 'o' },
	{ ...agent, tenantId: 't', organizationId: 'o' }
]);
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';

describe('Execution / assurance / governance / decomposition handlers (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	/** The dispatching session for an actor. The identity is the SESSION now, never a command field. */
	function sessionFor(actor: ActorReference) {
		return engine.as(DIR.credentialFor(actor.actorId));
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: DIR.authenticate, store, now: () => TS, newEventId: () => `evt_${++seq}` });
		seedPolicy(sessionFor(human), 'pol_arch'); // makeSatisfiedAssessment cites pol_arch — now it must exist
		// Seed an intent + PWU (the PWU is the assessment subject + baseline item).
		dispatch(
			'CaptureIntent',
			{
				intentId: INTENT_ID,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			},
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
	});

	// `issuedBy` is the ACTOR THIS SCENARIO ACTS AS — it selects the SESSION, and is deliberately not written
	// onto the envelope: the engine stamps the authenticated principal, and a declared issuer that disagreed
	// with it would be refused (which is the rule this suite relies on, not one it may weaken).
	function dispatch(
		commandType: string,
		payload: unknown,
		over: Partial<DomainCommand> = {},
		issuedBy: ActorReference = human
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return sessionFor(issuedBy).dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	it('drives an execution plan PROPOSED(review) -> APPROVED -> ACTIVE', () => {
		const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5FC0';
		expect(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU_ID,
					steps: [
						{
							id: `${PLAN}-s1`,
							executionPlanId: PLAN,
							stepType: 'TRANSFORMATION',
							purpose: 'work',
							inputBindings: [],
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				{ targetAggregateId: PLAN, targetAggregateType: 'EXECUTION_PLAN' }
			).status
		).toBe('ACCEPTED');
		expect(statusOf(PLAN)).toBe('UNDER_REVIEW');
		expect(dispatch('ApproveExecutionPlan', {}, { targetAggregateId: PLAN }).status).toBe(
			'ACCEPTED'
		);
		expect(statusOf(PLAN)).toBe('APPROVED');
		expect(
			dispatch(
				'ActivateExecutionPlan',
				{ authorizedRuntimeBindingIds: [] },
				{ targetAggregateId: PLAN }
			).status
		).toBe('ACCEPTED');
		expect(statusOf(PLAN)).toBe('ACTIVE');
	});

	it('records approvalDecisionId on the ExecutionPlanActivated event (contract-drift: the §15.2 command field §15.3 dropped)', () => {
		const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5FC7';
		const APPROVAL_DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FC8';
		dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU_ID,
				steps: [
					{
						id: `${PLAN}-s1`,
						executionPlanId: PLAN,
						stepType: 'TRANSFORMATION',
						purpose: 'work',
						inputBindings: [],
						outputBindings: [],
						preconditions: [],
						postconditions: [],
						stepState: 'QUEUED'
					}
				],
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			{ targetAggregateId: PLAN, targetAggregateType: 'EXECUTION_PLAN' }
		);
		dispatch('ApproveExecutionPlan', {}, { targetAggregateId: PLAN });
		expect(
			dispatch(
				'ActivateExecutionPlan',
				{ authorizedRuntimeBindingIds: [], approvalDecisionId: APPROVAL_DEC },
				{ targetAggregateId: PLAN }
			).status
		).toBe('ACCEPTED');
		const activated = store
			.readAllEvents()
			.find((e) => e.eventType === 'ExecutionPlanActivated' && e.aggregateId === PLAN);
		// The activation authorization — WHICH decision opened the gate to runtime execution — is on the governed stream.
		expect((activated?.payload as Record<string, unknown> | undefined)?.approvalDecisionId).toBe(
			APPROVAL_DEC
		);
	});

	it('drives evidence PROPOSED -> ADMISSIBLE and an assessment to SATISFIED', () => {
		const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD0';
		dispatch(
			'ProposeEvidence',
			{
				evidenceId: EV,
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'file://fixture-artifact' },
				producedBy: human,
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: 'architecture',
				limitations: [],
				capturedAt: TS
			},
			{ targetAggregateId: EV, targetAggregateType: 'EVIDENCE' }
		);
		expect(statusOf(EV)).toBe('PROPOSED');
		expect(
			dispatch(
				'AdmitEvidence',
				{ admissibilityAssessmentId: 'a', admittedScope: 'architecture', admittedClaimIds: [] },
				{ targetAggregateId: EV }
			).status
		).toBe('ACCEPTED');
		expect(statusOf(EV)).toBe('ADMISSIBLE');
	});

	it('rejects making a decision EFFECTIVE when the authority is an AGENT (GOV-001/002)', () => {
		const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FE0';
		// ISSUED BY THE AGENT (REG-F-014, 2026-08-03). This used to declare an AGENT authority on a HUMAN-issued
		// command — the forgery `proposeDecision` now refuses. The agent proposing AS ITSELF is both the arrangement
		// the rule actually describes and a stronger premise: the decision's recorded authority is an agent because
		// an agent made it, not because a human said so.
		const proposed = dispatch(
			'ProposeDecision',
			{
				decisionType: 'APPROVAL',
				subjectObjectIds: [PWU_ID],
				selectedOption: 'approve',
				rationale: 'r',
				authority: agent
			},
			{ targetAggregateId: DEC, targetAggregateType: 'DECISION' },
			agent
		);
		expect(proposed.status, JSON.stringify(proposed.error)).toBe('ACCEPTED');
		const r = dispatch(
			'ApproveDecision',
			{
				selectedOption: 'approve',
				rationale: 'r',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU_ID]: 1 }
			},
			{ targetAggregateId: DEC }
		);
		expect(r.status).toBe('UNAUTHORIZED');
		expect(r.error?.code).toBe('RPH_AUTHORITY_INSUFFICIENT');
	});

	function makeSatisfiedAssessment(id: string): void {
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: id,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
			},
			{ targetAggregateId: id, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
		// assessment in READY, so it must be BEGUN before it can be assessed or completed.
		dispatch(
			'BeginAssuranceAssessment',
			{},
			{ targetAggregateId: id, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		dispatch(
			'CompleteAssuranceAssessment',
			{
				validatorResult: floorValidatorResult({
					assessmentId: id,
					policyId: 'pol_arch',
					subjectId: PWU_ID,
					subjectSemanticVersion: 1,
					disposition: 'SATISFIED'
				})
			},
			{ targetAggregateId: id }
		);
	}

	/** REG-F-073: a promotion decision must NAME the baseline it authorizes, so callers pass it. Before that
	 *  rule any effective promotion decision authorized any promotion, which is why this helper took none. */
	function makeEffectivePromotionDecision(id: string, baselineId?: string): void {
		dispatch(
			'ProposeDecision',
			{
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: baselineId ? [PWU_ID, baselineId] : [PWU_ID],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: human
			},
			{ targetAggregateId: id, targetAggregateType: 'DECISION' }
		);
		dispatch(
			'ApproveDecision',
			{
				selectedOption: 'promote',
				rationale: 'ready',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU_ID]: 1 }
			},
			{ targetAggregateId: id }
		);
	}

	function createApprovedBaseline(id: string, assessmentId: string): void {
		dispatch(
			'CreateBaseline',
			{
				baselineType: 'ARCHITECTURE',
				itemObjectIds: [PWU_ID],
				assuranceAssessmentIds: [assessmentId]
			},
			{ targetAggregateId: id, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: id });
		dispatch('ApproveBaseline', {}, { targetAggregateId: id });
	}

	it('records approvalDecisionId on BOTH the BaselineApproved event and the Baseline object (contract-drift provenance hole closed)', () => {
		const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FF7';
		const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5FH7';
		const APPROVAL_DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FA7';
		makeSatisfiedAssessment(ASSESS);
		dispatch(
			'CreateBaseline',
			{ baselineType: 'ARCHITECTURE', itemObjectIds: [PWU_ID], assuranceAssessmentIds: [ASSESS] },
			{ targetAggregateId: BASE, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: BASE });
		expect(
			dispatch('ApproveBaseline', { approvalDecisionId: APPROVAL_DEC }, { targetAggregateId: BASE })
				.status
		).toBe('ACCEPTED');
		// (a) the governed stream: the BaselineApproved event now records WHICH decision approved it.
		const approved = store
			.readAllEvents()
			.find((e) => e.eventType === 'BaselineApproved' && e.aggregateId === BASE);
		expect((approved?.payload as Record<string, unknown> | undefined)?.approvalDecisionId).toBe(
			APPROVAL_DEC
		);
		// (b) current state: the Baseline object records it — the optional sibling of promotionDecisionId.
		expect(
			(store.loadObject(BASE)?.state as Record<string, unknown> | undefined)?.approvalDecisionId
		).toBe(APPROVAL_DEC);
	});

	it('omits approvalDecisionId cleanly when the approval cites no decision (optional-by-design)', () => {
		const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FF8';
		const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5FH8';
		makeSatisfiedAssessment(ASSESS);
		createApprovedBaseline(BASE, ASSESS);
		expect(statusOf(BASE)).toBe('APPROVED');
		const approved = store
			.readAllEvents()
			.find((e) => e.eventType === 'BaselineApproved' && e.aggregateId === BASE);
		expect((approved?.payload as Record<string, unknown>)?.approvalDecisionId).toBeUndefined();
		expect(
			(store.loadObject(BASE)?.state as Record<string, unknown>)?.approvalDecisionId
		).toBeUndefined();
	});

	it('promotes a baseline to AUTHORITATIVE through the full gate (satisfied assessment + effective decision)', () => {
		const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FF0';
		const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FG0';
		const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5FH0';
		makeSatisfiedAssessment(ASSESS);
		expect(statusOf(ASSESS, 'assessmentState')).toBe('SATISFIED');
		makeEffectivePromotionDecision(DEC, BASE);
		expect(statusOf(DEC)).toBe('EFFECTIVE');
		createApprovedBaseline(BASE, ASSESS);
		expect(statusOf(BASE)).toBe('APPROVED');
		const r = dispatch(
			'PromoteBaseline',
			{
				promotionDecisionId: DEC,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE }
		);
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});

	it('rejects baseline promotion when the required assessment is not satisfied (INV-20)', () => {
		const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FF1';
		const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FG1';
		const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5FH1';
		// Assessment left REJECTED, not SATISFIED.
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
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
					disposition: 'REJECTED'
				})
			},
			{ targetAggregateId: ASSESS }
		);
		makeEffectivePromotionDecision(DEC);
		createApprovedBaseline(BASE, ASSESS);
		const r = dispatch(
			'PromoteBaseline',
			{
				promotionDecisionId: DEC,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE }
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(statusOf(BASE)).toBe('APPROVED'); // unchanged
	});

	it('drives a decomposition contract to VALID', () => {
		const DC = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5FJ0';
		const proposed = dispatch(
			'ProposeDecomposition',
			{
				parentWorkUnitId: PWU_ID,
				childWorkUnitIds: [],
				rationale: 'split by concern'
			},
			{ targetAggregateId: DC, targetAggregateType: 'DECOMPOSITION_CONTRACT' }
		);
		expect(proposed.status, JSON.stringify(proposed.error)).toBe('ACCEPTED');
		expect(statusOf(DC)).toBe('UNDER_REVIEW');
		expect(
			dispatch('ValidateDecomposition', { disposition: 'VALID' }, { targetAggregateId: DC }).status
		).toBe('ACCEPTED');
		expect(statusOf(DC)).toBe('VALID');
	});

	it('records observationIds — the validation basis — on the DecompositionValidated event (contract-drift)', () => {
		const DC = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5FJ7';
		const OBS = ['obs_01ARZ3NDEKTSV4RRFFQ69G5FK7', 'obs_01ARZ3NDEKTSV4RRFFQ69G5FK8'];
		dispatch(
			'ProposeDecomposition',
			{ parentWorkUnitId: PWU_ID, childWorkUnitIds: [], rationale: 'split by concern' },
			{ targetAggregateId: DC, targetAggregateType: 'DECOMPOSITION_CONTRACT' }
		);
		expect(
			dispatch(
				'ValidateDecomposition',
				{ disposition: 'CONDITIONALLY_VALID', observationIds: OBS },
				{ targetAggregateId: DC }
			).status
		).toBe('ACCEPTED');
		const validated = store
			.readAllEvents()
			.find((e) => e.eventType === 'DecompositionValidated' && e.aggregateId === DC);
		// WHAT the validator considered in reaching the verdict is now on the governed stream.
		expect((validated?.payload as Record<string, unknown> | undefined)?.observationIds).toEqual(
			OBS
		);
	});
});
