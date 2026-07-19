// W3-INC-2 (WP-3-008 / RPH-ASM-006): approving an execution plan authorizes new work for its PWU; it must not do
// so on a dead assumption. ExpireAssumption instantiates the expiry transition (the assumption lifecycle was
// un-instantiated beyond PROPOSED), and ApproveExecutionPlan now runs canAuthorizeNewWork over the PWU's
// assumptions. This drives the LIVE pipeline: an EXPIRED assumption on the PWU blocks the plan approval.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5J00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5J10';
const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5J20';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5J30';

describe('ApproveExecutionPlan — a dead assumption cannot authorize new work (RPH-ASM-006, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const statusOf = (id: string) =>
		(store.loadObject(id)?.state as { status?: string } | undefined)?.status;

	function proposePlan() {
		return dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [
					{
						id: `${PLAN}-step`,
						executionPlanId: PLAN,
						stepType: 'MODEL_INVOCATION',
						purpose: 'do the work',
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
			PLAN,
			'EXECUTION_PLAN'
		);
	}

	const approvePlan = () => dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
	const expireAssumption = () =>
		dispatch('ExpireAssumption', { expirationCondition: 'stale as of review' }, ASM, 'ASSUMPTION');

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'DetectAssumption',
			{
				assumptionId: ASM,
				statement: 'The tenant identity model is stable',
				introducedBy: actor,
				affectedObjectIds: [PWU],
				materiality: 'MATERIAL'
			},
			ASM,
			'ASSUMPTION'
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [ASM],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
		expect(proposePlan().status).toBe('ACCEPTED');
	});

	it('ExpireAssumption drives the assumption PROPOSED -> EXPIRED', () => {
		expect(statusOf(ASM)).toBe('PROPOSED');
		expect(expireAssumption().status).toBe('ACCEPTED');
		expect(statusOf(ASM)).toBe('EXPIRED');
	});

	it('rejects ApproveExecutionPlan when the PWU depends on an EXPIRED assumption', () => {
		expect(expireAssumption().status).toBe('ACCEPTED');
		const r = approvePlan();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH-ASM-006');
		expect(r.error?.message).toContain(ASM);
		expect(statusOf(PLAN)).toBe('UNDER_REVIEW'); // not advanced to APPROVED
	});

	it('approves the plan while the assumption is still live (the control must discriminate)', () => {
		const r = approvePlan(); // assumption still PROPOSED (live)
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(PLAN)).toBe('APPROVED');
	});
});
