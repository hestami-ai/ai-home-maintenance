// JAN-EXECREM WP-13 — the attempt fold becomes TOTAL, and a close becomes a close (F-36, F-45).
//
// THE OMISSION. The fold handled THREE of the ten ExecutionStep* event types and silently skipped seven. Only
// `ExecutionStepRetried`'s absence was documented; `ExecutionStepCancelled` was simply unconsidered — so
// cancelling a RUNNING step (a first-class, tested path, legal even under a superseded plan) left its attempt
// `state: 'RUNNING'` with no `completedAt`, FOREVER, on every replay. Deterministic and deterministically WRONG:
// the projection permanently contradicted the aggregate, and the UI rendered a live in-flight attempt for a step
// the operator had aborted. An event type absent from a Map of appliers is invisible; a table over a closed set,
// where NONE is a declaration with a reason, is not.
//
// THE CORRUPTION THE OMISSION WAS HIDING. `current` records the step's LATEST draft and is never cleared, and the
// two closers looked it up by PRESENCE. So the naive repair — "add a Cancelled applier that closes `current`" —
// would have introduced a worse defect than the one it fixed: on Start -> Fail -> Retry -> Cancel (fully legal,
// ONE Started, therefore ONE attempt, already closed as FAILED) it would find attempt #1 and rewrite it
// FAILED -> CANCELLED, MOVING its completedAt. The record would then say the attempt that failed had been
// cancelled, at a time it was not. Closing on OPENNESS (`completedAt === undefined`) is what makes a close a
// close rather than an overwrite — and it is why these tests assert openness, never presence.
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { EVENTS } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	ATTEMPT_EFFECT_EVENT_TYPES,
	attemptsByStep,
	executionAttempts
} from './execution-attempts.js';

const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H4100';
const S1 = `${PLAN}-s1`;

let seq = 0;
/** A minimal DomainEvent on PLAN. `occurredAt` increments so a moved completedAt is VISIBLE, not merely equal. */
const ev = (eventType: string, payload: Record<string, unknown>): DomainEvent =>
	({
		eventId: `e${++seq}`,
		eventType,
		aggregateType: 'EXECUTION_PLAN',
		aggregateId: PLAN,
		aggregateRevision: seq,
		occurredAt: `2026-07-12T00:00:${String(seq).padStart(2, '0')}Z`,
		recordedAt: `2026-07-12T00:00:${String(seq).padStart(2, '0')}Z`,
		payload
	}) as unknown as DomainEvent;

const started = () => ev('ExecutionStepStarted', { stepId: S1, stepState: 'RUNNING' });
const failed = (failureReason = 'boom') =>
	ev('ExecutionStepFailed', { stepId: S1, failureReason, stepState: 'FAILED' });
const retried = () => ev('ExecutionStepRetried', { stepId: S1, stepState: 'QUEUED' });
const cancelled = (reason = 'operator aborted') =>
	ev('ExecutionStepCancelled', { stepId: S1, reason, stepState: 'CANCELLED' });
const succeeded = () =>
	ev('ExecutionStepSucceeded', { executionStepId: S1, resultingExecutionState: 'SUCCEEDED' });

describe('WP-13 / F-36 — a cancelled attempt is CLOSED, not left running forever', () => {
	it('THE KILL TEST: Start -> Cancel closes the attempt as CANCELLED with its reason and time', () => {
		seq = 0;
		const attempts = executionAttempts([started(), cancelled()]);
		expect(attempts).toHaveLength(1);
		expect(attempts[0]!.state, 'reported RUNNING forever before WP-13').toBe('CANCELLED');
		expect(attempts[0]!.completedAt).toBe('2026-07-12T00:00:02Z');
		expect(attempts[0]!.error).toBe('operator aborted');
	});

	it('and the per-step rollup the UI renders agrees — latestState is not RUNNING', () => {
		seq = 0;
		const rollup = attemptsByStep(executionAttempts([started(), cancelled()]));
		expect(rollup[0]!.latestState).toBe('CANCELLED');
	});
});

describe('WP-13 — a CLOSE closes an OPEN attempt, and never overwrites a closed one', () => {
	it('THE CORRUPTION TEST: Start -> Fail -> Retry -> Cancel leaves the FAILED attempt untouched', () => {
		// Every link is legal: Retry drives FAILED -> QUEUED, and Cancel's source set includes QUEUED. Exactly ONE
		// Started, so exactly ONE attempt — already closed as FAILED. A presence-based close would rewrite it.
		seq = 0;
		const attempts = executionAttempts([started(), failed('the tool crashed'), retried(), cancelled()]);
		expect(attempts, 'a retry is a re-queue MARKER, not an attempt').toHaveLength(1);
		expect(attempts[0]!.state, 'the attempt that FAILED did not become CANCELLED').toBe('FAILED');
		expect(attempts[0]!.error).toBe('the tool crashed');
		expect(attempts[0]!.completedAt, 'and its completedAt did not MOVE').toBe('2026-07-12T00:00:02Z');
	});

	it('the retried step opens attempt #2, and THAT one closes on the cancel', () => {
		// The complement: once a new attempt is genuinely open, the cancel closes THAT. Without this the test above
		// would pass for a fold that simply ignored Cancelled — which is the defect it is meant to have fixed.
		seq = 0;
		const attempts = executionAttempts([started(), failed(), retried(), started(), cancelled()]);
		expect(attempts).toHaveLength(2);
		expect(attempts[0]!.state).toBe('FAILED');
		expect(attempts[1]!.state).toBe('CANCELLED');
		expect(attempts[1]!.attemptNumber).toBe(2);
	});

	it('a stray second terminal event for a closed attempt changes nothing', () => {
		// Not reachable through the bus (the source sets refuse a re-issue), but the fold is fed a RAW event list
		// and must be total over it. A presence-based close also left a stale `error` on a re-closed attempt.
		seq = 0;
		const attempts = executionAttempts([started(), failed('real failure'), succeeded()]);
		expect(attempts).toHaveLength(1);
		expect(attempts[0]!.state).toBe('FAILED');
		expect(attempts[0]!.error, 'no stale error, because nothing re-closed it').toBe('real failure');
	});
});

describe('WP-13 / F-45 — suspension is not termination', () => {
	it('a WAITING step reports WAITING, not RUNNING — and its attempt stays OPEN', () => {
		seq = 0;
		const attempts = executionAttempts([started(), ev('ExecutionStepWaiting', { stepId: S1, stepState: 'WAITING' })]);
		expect(attempts[0]!.state, 'the attempt row contradicted the step row on the same page').toBe('WAITING');
		expect(attempts[0]!.completedAt, 'waiting ENDS nothing').toBeUndefined();
	});

	it('resolving the wait returns it to RUNNING, and the SAME attempt later closes', () => {
		seq = 0;
		const attempts = executionAttempts([
			started(),
			ev('ExecutionStepWaiting', { stepId: S1, stepState: 'WAITING' }),
			ev('ExecutionStepWaitResolved', { stepId: S1, stepState: 'RUNNING' }),
			succeeded()
		]);
		expect(attempts, 'a wait/resume cycle continues the SAME attempt (RPH-EXE-008)').toHaveLength(1);
		expect(attempts[0]!.state).toBe('SUCCEEDED');
		expect(attempts[0]!.completedAt).toBeDefined();
	});
});

describe('WP-13 — the effect table is TOTAL over the contract registry (the anti-recurrence instrument)', () => {
	it('every ExecutionStep* event the contracts declare has a DECLARED effect', () => {
		// This is what makes the omission impossible to repeat: a new ExecutionStep* event with no row fails HERE,
		// rather than being silently skipped by the fold until the next adversarial review notices.
		const declared = Object.keys(EVENTS).filter((e) => e.startsWith('ExecutionStep'));
		expect(declared.length, 'the registry must actually contain the step events').toBeGreaterThan(5);
		const covered = new Set(ATTEMPT_EFFECT_EVENT_TYPES);
		const missing = declared.filter((e) => !covered.has(e));
		expect(missing, 'ExecutionStep* event(s) with no declared attempt effect').toEqual([]);
	});

	it('and the table declares nothing the contracts do not (no fictional event types)', () => {
		const declared = new Set(Object.keys(EVENTS));
		expect(ATTEMPT_EFFECT_EVENT_TYPES.filter((e) => !declared.has(e))).toEqual([]);
	});

	it('the declared NON-effects are exactly the four that open or close nothing', () => {
		// Stated literally rather than derived from the table, so flipping a row to NONE turns this RED instead of
		// moving the expectation with it.
		seq = 0;
		const noEffect = ['ExecutionStepRetried', 'ExecutionStepSkipped', 'ExecutionStepPruned', 'ExecutionStepReady'];
		for (const eventType of noEffect) {
			const attempts = executionAttempts([started(), ev(eventType, { stepId: S1 })]);
			expect(attempts, `${eventType} must not open an attempt`).toHaveLength(1);
			expect(attempts[0]!.state, `${eventType} must not close one`).toBe('RUNNING');
			expect(attempts[0]!.completedAt, eventType).toBeUndefined();
		}
	});

	it('a hostile eventType resolves to nothing rather than surfacing Object.prototype', () => {
		seq = 0;
		expect(() => executionAttempts([started(), ev('__proto__', { stepId: S1 })])).not.toThrow();
		expect(executionAttempts([started(), ev('constructor', { stepId: S1 })])).toHaveLength(1);
	});

	it('each entry reads the step id from ITS OWN key — Succeeded uses executionStepId, the rest stepId', () => {
		// The per-entry key extractor. A table assuming one key would silently no-op on the events using the other
		// — the same invisibility in a new place. Succeeded under the WRONG key must close nothing.
		seq = 0;
		const wrongKey = executionAttempts([
			started(),
			ev('ExecutionStepSucceeded', { stepId: S1, resultingExecutionState: 'SUCCEEDED' })
		]);
		expect(wrongKey[0]!.state, 'a Succeeded keyed on stepId names no step this fold knows').toBe('RUNNING');
		seq = 0;
		expect(executionAttempts([started(), succeeded()])[0]!.state).toBe('SUCCEEDED');
	});
});
