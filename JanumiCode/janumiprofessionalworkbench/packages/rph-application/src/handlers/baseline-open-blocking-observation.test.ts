// Drives the REAL command pipeline (engine.dispatch) to ask the question no other test asks: does the CALL SITE
// enforce RPH-BAS-003, or only the kernel? packages/rph-domain/src/governance.test.ts:189 already proves
// canPromoteBaseline({ openObservations: [{ blocking: true, waived: false }] }) yields OPEN_BLOCKING_FINDING.
// That kernel is correct and unreachable: promoteBaseline (handlers/governance.ts:279) passes a hard-coded
// `openObservations: []` into the gate, so findOpenBlockingObservations always iterates an empty array and the
// control is structurally incapable of firing. No observation a professional records can ever block a promotion.
//
// Guide § 9.3 "Authoritative Command pipeline" (header L1202), L1218, byte-exact:
//   "→ revalidate impact/revalidation closure and reject missing, failed, stale, invalidated, or bypassed assurance"
// and L1217, byte-exact:
//   "→ require current Assessments, conforming actual Validator executions, admissible Evidence, required independence, and transition-permitting dispositions"
// § 8.16 "Decisions and Baselines" (header L1105), L1122, byte-exact:
//   "- no unresolved blocking/critical finding except a policy-permitted scoped waiver;"
// § 16 "Do-not-guess decision register" (header L2492), item 13, L2510, byte-exact:
//   "If owner/subject/authority cannot be resolved through accepted contract/trace, do not promote."
//
// The promotion below is otherwise immaculate — SATISFIED required assessment, EFFECTIVE human-authored
// PROMOTE_BASELINE decision, pinned item versions — so the ONLY reason to reject is the open BLOCKING
// observation. Today the dispatch returns ACCEPTED and the baseline reaches AUTHORITATIVE anyway.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-07-15T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5H00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5H01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5H02';
const OBS = 'obs_01ARZ3NDEKTSV4RRFFQ69G5H03';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5H04';
const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5H05';

describe('PromoteBaseline call site: open blocking observation (RPH-BAS-003, live pipeline)', () => {
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
			correlationId: 'corr-blocking-obs',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
		seedPolicy(engine, 'pol_arch'); // the assessment below cites pol_arch — now it must exist
		dispatch(
			'CaptureIntent',
			{
				intentId: INTENT_ID,
				originatingExpression: 'ship the tenant-isolated architecture',
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
				subjectSemanticVersions: { [PWU_ID]: 1 }
			},
			{ targetAggregateId: DEC }
		);
		dispatch(
			'CreateBaseline',
			{
				baselineType: 'ARCHITECTURE',
				itemObjectIds: [PWU_ID],
				assuranceAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: BASE });
		dispatch('ApproveBaseline', {}, { targetAggregateId: BASE });
	});

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

	it('rejects promotion while a BLOCKING observation against the baselined item is still OPEN (RPH-BAS-003)', () => {
		// A real, recorded, unwaived blocking finding on the exact subject the baseline freezes.
		expect(
			dispatch(
				'RecordAssuranceObservation',
				{
					assessmentId: ASSESS,
					observationType: 'POLICY_VIOLATION',
					findingCode: 'TENANT_ISOLATION_BREACH',
					severity: 'BLOCKING',
					statement: 'cross-tenant read path is unguarded',
					evidenceIds: []
				},
				{ targetAggregateId: OBS, targetAggregateType: 'ASSURANCE_OBSERVATION' }
			).status
		).toBe('ACCEPTED');
		// Guard the fixture: the finding must actually be OPEN and BLOCKING, or the assertion below is vacuous.
		expect(statusOf(OBS, 'disposition')).toBe('OPEN');
		expect(statusOf(OBS, 'severity')).toBe('BLOCKING');

		const r = promote();

		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('OPEN_BLOCKING_FINDING');
		expect(statusOf(BASE)).toBe('APPROVED');
	});

	it('promotes the same baseline when no blocking observation exists (the control must discriminate)', () => {
		expect(promote().status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});
});
