// Drives the PWU lifecycle machine LIVE. Proves: ProposePwu requires an intent (PWU-002); the authored path
// PROPOSED -> SHAPING -> READY; the controller's ChangePwuState advancing a derived state (READY -> PLANNED)
// AND rejecting an illegal lifecycle jump (PROPOSED -> SATISFIED — the canAdvanceWorkLifecycle guard is wired),
// a stale previousState, and an illegal sub-axis jump (executionState NOT_PLANNED -> RUNNING skipping QUEUED).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';

describe('PWU lifecycle handlers (live command drive)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
	});

	function cmd(
		commandType: string,
		payload: unknown,
		over: Partial<DomainCommand> = {}
	): DomainCommand {
		const n = ++seq;
		return {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
	}

	function seedIntent(): void {
		engine.dispatch(
			cmd(
				'CaptureIntent',
				{
					intentId: INTENT_ID,
					originatingExpression: 'Build a field service management SaaS',
					ontologyId: 'product-realization-pwa',
					ontologyVersion: '1.3.0'
				},
				{ targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' }
			)
		);
	}

	function proposePayload() {
		return {
			pwuId: PWU_ID,
			pwuKind: 'ARCHITECTURE',
			title: 'Architecture Definition',
			description: 'Define a coherent technical structure',
			intentId: INTENT_ID,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'MEDIUM',
				uncertainty: 'MEDIUM',
				irreversibility: 'LOW',
				securitySensitivity: 'LOW',
				regulatoryExposure: 'NONE'
			}
		};
	}

	function lifecycle(): string {
		return (store.loadObject(PWU_ID)?.state as { workLifecycleState: string }).workLifecycleState;
	}

	function change(over: Record<string, unknown>): DomainCommand {
		return cmd('ChangePwuState', {
			previousState: 'READY',
			newState: 'PLANNED',
			executionState: 'PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'UNKNOWN',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [],
			...over
		});
	}

	it('ProposePwu requires an existing intent (PWU-002)', () => {
		const r = engine.dispatch(cmd('ProposePwu', proposePayload()));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
	});

	it('drives PROPOSED -> SHAPING -> READY and advances READY -> PLANNED via ChangePwuState', () => {
		seedIntent();
		expect(engine.dispatch(cmd('ProposePwu', proposePayload())).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('PROPOSED');
		expect(engine.dispatch(cmd('BeginPwuShaping', {})).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('SHAPING');
		expect(
			engine.dispatch(
				cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
			).status
		).toBe('ACCEPTED');
		expect(lifecycle()).toBe('READY');
		expect(engine.dispatch(change({})).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('PLANNED');
		const axes = store.loadObject(PWU_ID)?.state as { executionState: string };
		expect(axes.executionState).toBe('PLANNED');
	});

	it('ChangePwuState rejects an illegal lifecycle jump PROPOSED -> SATISFIED (guard wired)', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		const r = engine.dispatch(
			change({
				previousState: 'PROPOSED',
				newState: 'SATISFIED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED'
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	it('ChangePwuState rejects a stale previousState', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		// current is PROPOSED, but we claim READY
		const r = engine.dispatch(change({}));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('ChangePwuState rejects an illegal sub-axis jump (executionState NOT_PLANNED -> RUNNING)', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'a', expectedSemanticVersion: 1 })
		);
		const r = engine.dispatch(change({ newState: 'EXECUTING', executionState: 'RUNNING' }));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	it('SupersedePwu moves a non-baselined PWU -> SUPERSEDED', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		expect(engine.dispatch(cmd('SupersedePwu', { supersedingWorkUnitId: 'pwu_new' })).status).toBe(
			'ACCEPTED'
		);
		expect(lifecycle()).toBe('SUPERSEDED');
	});
});
