// W1 WIRE-4 (RPH-GOV-003 / Property P5): a decision binds EXACT subject semantic versions; a promotion whose
// PROMOTE_BASELINE decision approved a version that is NOT the subject's CURRENT semantic version must be rejected.
// The kernel rule decisionAuthorizesVersions (packages/rph-domain/src/governance.ts:95) is correct and — before
// this increment — was UNREACHABLE: promoteBaseline never compared the decision's subjectSemanticVersions against
// the subjects' current versions, so a stale-version approval promoted a baseline to AUTHORITATIVE anyway.
//
// §35 / RPH-GOV-003, byte-exact intent: "a decision approval of v_n never authorizes v_{n+1}; the subject becomes
// re-review-required." This drives the REAL command pipeline (engine.dispatch) to ask whether the CALL SITE
// enforces it, not just the kernel.
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
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V04';
const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5V05';

describe('PromoteBaseline call site: stale decision version binding (RPH-GOV-003 / P5, live pipeline)', () => {
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
			correlationId: 'corr-stale-version',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	/** Build the full intent→pwu→assessment→decision→baseline chain, approving the decision at `approvedVersion`
	 *  for the subject (whose current semantic version is 1). */
	function setup(approvedVersion: number) {
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
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU_ID]: approvedVersion }
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

	it('rejects promotion when the decision bound a version other than the subject current version (RPH-GOV-003)', () => {
		setup(2); // decision approved PWU@v2, but the subject's current semantic version is 1 → stale
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('STALE_DECISION_VERSION');
		expect(statusOf(BASE)).toBe('APPROVED'); // not AUTHORITATIVE
	});

	it('promotes when the decision bound the subject current version (the control must discriminate)', () => {
		setup(1); // decision approved PWU@v1 == current → authorizes
		const r = promote();
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});
});
