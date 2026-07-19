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
				contentReference: {},
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

	it('blocks promotion when a required assessment claim rests on invalidated evidence (CT-10 claim path)', () => {
		setup({ assessmentClaimIds: [CLAIM], consideredEvidenceIds: [], invalidate: true });
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
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
});
