// THE §36 CONTROL-ACTION MAPPING, ENFORCED AT RETRY — REG-E-025.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// DOC-002 §36 closes with a rule that sits after all five failure families and governs every one of them:
// "Each failure class must map to permitted control actions." Nothing had ever built that mapping, and the two
// `failureClass` payload fields accepted any string — so the rule was ratified, unimplemented, and unenforceable
// all at once.
//
// Minting the enum and writing the table would satisfy the rule on paper. This file is the difference between
// that and a rule with consequences: a step whose last failure was RETRY_EXHAUSTION may not be retried, because
// retrying is precisely what has already been established not to work.
//
// IT IS A DIFFERENT CHECK FROM THE RETRY CAP, and the test below proves it rather than asserting it. The cap
// (RPH-EXE-008) counts attempts against the plan's RetryPolicy. This reads what the failure WAS. A caller that
// reports RETRY_EXHAUSTION on attempt one is refused here and would sail through the cap — which is the whole
// reason the mapping is worth having and not a restatement of a limit already enforced.
//
// WHAT MUST REDDEN: remove the precheck from `retryExecutionStep` -> the refusal below stops firing while the
// CONTROL (a retryable class on the same fixture, same attempt number) stays green.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5R00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5R10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5R20';
const STEP = `${PLAN}-s`;

describe('RetryExecutionStep honours the §36.2 failure-class control-action mapping', () => {
	let engine: Engine;
	let store: SqliteStorageAdapter;
	let seq = 0;

	const dispatch = (
		commandType: string,
		payload: unknown,
		id: string = PLAN,
		aggType: string = 'EXECUTION_PLAN'
	) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		} as DomainCommand);
	};

	const ok = (commandType: string, payload: unknown, id?: string, aggType?: string) => {
		const r = dispatch(commandType, payload, id, aggType);
		expect(r.status, `${commandType}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		return r;
	};

	beforeEach(() => {
		seq = 0;
		store = new SqliteStorageAdapter({ now: () => TS });
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		ok(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		ok(
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
		ok('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: PWU,
			steps: [
				{
					id: STEP,
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
			// A GENEROUS cap on purpose: every refusal below must come from the failure CLASS, never from the
			// attempt count. Without this the two checks would be indistinguishable on the first failure.
			retryPolicy: { maxAttempts: 9 },
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});
		ok('ApproveExecutionPlan', {});
		ok('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
	});

	/** One attempt: start, then fail with `failureClass`. Returns the retry result. */
	const failThenRetry = (failureClass?: string) => {
		ok('StartExecutionStep', { stepId: STEP });
		ok('FailExecutionStep', {
			stepId: STEP,
			failureReason: 'boom',
			...(failureClass ? { failureClass } : {})
		});
		return dispatch('RetryExecutionStep', { stepId: STEP });
	};

	it('CONTROL: a retryable class IS retried — on attempt ONE, so the cap cannot be the cause', () => {
		// TOOL_FAILURE permits RETRY. If this ever reddens, every refusal below is about something other than the
		// mapping and this file proves nothing.
		expect(failThenRetry('TOOL_FAILURE').status).toBe('ACCEPTED');
	});

	it('CONTROL: an UNCLASSIFIED failure is still retryable — the check reads a class, it does not require one', () => {
		// `failureClass` is optional in the ratified payload. Refusing a retry merely because nobody classified
		// the failure would be a new precondition the corpus does not state.
		expect(failThenRetry(undefined).status).toBe('ACCEPTED');
	});

	it('REFUSES a retry after RETRY_EXHAUSTION — on attempt ONE, where the cap has nothing to say', () => {
		const r = failThenRetry('RETRY_EXHAUSTION');
		expect(
			r.status,
			'§36 requires each failure class to map to permitted control actions; RETRY_EXHAUSTION does not permit ' +
				'RETRY, and a mapping that permitted it would be a table that compiled and said nothing'
		).not.toBe('ACCEPTED');
		const msg = JSON.stringify(r.error);
		expect(msg).toContain('RETRY_EXHAUSTION');
		// The refusal must say what MAY be done — a governed refusal that names no alternative strands the caller.
		expect(msg).toContain('REPLAN_EXECUTION');
		expect(msg).toContain('ESCALATE');
		// And it must NOT be the retry cap: that refusal names the cap and this one does not.
		expect(msg, 'this must be the CLASS refusal, not the attempt-count refusal').not.toContain(
			'retry cap'
		);
	});

	it('the refusal is CLEAN — it appends no event and leaves the step FAILED', () => {
		// A refused command must change nothing. Named for what it checks: an earlier draft of this test was
		// called "the same step becomes retryable again once its latest failure is a retryable class" and did not
		// check that at all — it asserted an event count. A test whose name promises more than its body delivers
		// is worse than no test, because it reads as coverage.
		//
		// The stronger claim (that the check reads the LAST failure rather than any failure) is not reachable
		// from here: the step stays FAILED after the refusal, and FAILED -> RUNNING is not an arrow, so a second
		// classified failure cannot be staged without inventing a transition. It is asserted where it IS
		// decidable — `.at(-1)` in the handler — and left unclaimed here rather than faked.
		expect(failThenRetry('RETRY_EXHAUSTION').status).not.toBe('ACCEPTED');
		const failures = store
			.readAllEvents()
			.filter((e) => e.eventType === 'ExecutionStepFailed');
		expect(failures).toHaveLength(1);
		expect(
			store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepRetried')
		).toHaveLength(0);
	});

	it('a non-§36.2 value is REFUSED at the schema, so the mapping never sees an unknown class', () => {
		// `TRANSIENT` was the only value the runtime ever passed and is in no §36 list. Constraining the field is
		// what stops the mapping being asked about a vocabulary the corpus does not contain.
		ok('StartExecutionStep', { stepId: STEP });
		const r = dispatch('FailExecutionStep', {
			stepId: STEP,
			failureReason: 'boom',
			failureClass: 'TRANSIENT'
		});
		expect(r.status).not.toBe('ACCEPTED');
	});
});
