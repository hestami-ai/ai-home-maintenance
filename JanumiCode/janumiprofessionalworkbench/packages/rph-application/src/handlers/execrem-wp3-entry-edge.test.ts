// JAN-EXECREM WP-3 — the entry-edge BLOCKERs (F-03/F-04/F-05) proved through the REAL command bus.
//
// The pure-predicate proof lives in rph-domain (transition-gate-entry.test.ts). This file exists because the
// defect's consequence was an AUTHORITY failure, not merely a read-model one: with the live set empty, every step
// was simultaneously unstartable and waiver-free prunable, so `PruneExecutionStep` — which exists only to clear a
// not-taken BRANCH arm and deliberately bypasses the mandatory/waiver rule of `SkipExecutionStep` — would have
// driven ANY step of a contract-legal plan to terminal-success SKIPPED with no waiver at all.
//
// So the assertion that matters is dispatched, not computed: propose a plan with a plan-entry edge, activate it,
// and confirm the engine (a) lets the entry step start and (b) REFUSES to prune a reachable step.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GX100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GX110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GX120';
const sid = (i: number) => `${PLAN}-s${i}`;

describe('JAN-EXECREM WP-3 — a plan-entry edge through the live bus', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, aggType: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'wp3',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepStateOf = (i: number) => {
		const plan = store.loadObject(PLAN)?.state as { steps: { id: string; stepState: string }[] };
		return plan.steps.find((s) => s.id === sid(i))?.stepState;
	};

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
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
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
		// s1 -> s2 -> s3, with an explicit PLAN-ENTRY edge (no sourceStepId) into s1.
		const proposed = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1), mkStep(2), mkStep(3)],
				transitions: [
					{ id: 'entry', executionPlanId: PLAN, targetStepId: sid(1), transitionType: 'SEQUENTIAL' },
					{
						id: 't12',
						executionPlanId: PLAN,
						sourceStepId: sid(1),
						targetStepId: sid(2),
						transitionType: 'SEQUENTIAL'
					},
					{
						id: 't23',
						executionPlanId: PLAN,
						sourceStepId: sid(2),
						targetStepId: sid(3),
						transitionType: 'SEQUENTIAL'
					}
				],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		// The entry edge is contract-legal and propose-time validation accepts it — that acceptance, combined with the
		// runtime voiding the graph, is precisely what made this a BLOCKER rather than a rejected authoring mistake.
		expect(proposed.status, JSON.stringify(proposed.error)).toBe('ACCEPTED');
		expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
		).toBe('ACCEPTED');
	});

	it('the entry step STARTS (the engine gate does not declare the graph unreachable)', () => {
		const r = dispatch('StartExecutionStep', { stepId: sid(1) }, PLAN, 'EXECUTION_PLAN');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('REFUSES to prune a reachable step — Prune is not a waiver-free skip of the whole plan', () => {
		// THE BLOCKER, as the engine sees it. Before WP-3 the live set was empty, so s2 read unreachable and this
		// prune was ACCEPTED — driving a mandatory step to terminal-success SKIPPED with no waiver.
		const r = dispatch('PruneExecutionStep', { stepId: sid(2) }, PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('still reachable');
		expect(stepStateOf(2), 'the step must be untouched').toBe('QUEUED');
	});

	it('REFUSES to prune the entry step itself', () => {
		const r = dispatch('PruneExecutionStep', { stepId: sid(1) }, PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(stepStateOf(1)).toBe('QUEUED');
	});

	it('a later step is BLOCKED BY ITS PREDECESSOR, not declared unreachable', () => {
		const r = dispatch('StartExecutionStep', { stepId: sid(2) }, PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		// The honest reason: s1 has not finished. "unreachable" would be the defect's voice.
		expect(r.error?.message).not.toContain('unreachable');
		expect(stepStateOf(2)).toBe('QUEUED');
	});

	it('the plan SEQUENCES to completion through the entry edge', () => {
		const complete = (i: number) =>
			dispatch(
				'CompleteExecutionStep',
				{
					executionStepId: sid(i),
					executionAttemptId: `${sid(i)}-a1`,
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [],
					detectedAssumptionIds: [],
					structuredResult: {},
					// WP-11 / RPH-EXE-006: the no-output result is ASSERTED, not inferred. These are sequencing steps
					// that author nothing; the assertion is what makes that a stated fact rather than an omission.
					noOutputResult: {
						reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
						detail: 'Sequencing fixture: the step exercises the entry edge and authors no artifact.'
					},
					executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
				},
				PLAN,
				'EXECUTION_PLAN'
			);
		for (const i of [1, 2, 3]) {
			expect(dispatch('StartExecutionStep', { stepId: sid(i) }, PLAN, 'EXECUTION_PLAN').status, `start ${i}`).toBe(
				'ACCEPTED'
			);
			expect(complete(i).status, `complete ${i}`).toBe('ACCEPTED');
		}
		const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
		expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
	});
});
