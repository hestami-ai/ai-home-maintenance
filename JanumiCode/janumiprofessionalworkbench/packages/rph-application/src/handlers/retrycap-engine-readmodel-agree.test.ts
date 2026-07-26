// JAN-RETRYCAP / N-12 — the read-model and the engine AGREE about the retry cap, driven through the bus.
//
// WHY THIS TEST AND NOT TWO SEPARATE ONES. The projection suite proves the limb withholds `retry` at a cap it is
// TOLD about; the handler suite proves the engine refuses at a cap it COMPUTES. Both can pass while the two
// disagree — different counting rules, different defaults, an off-by-one at the boundary — and that disagreement
// IS the finding. F-29's invariant is not "each layer is individually correct", it is "no affordance the engine
// would reject", which is a statement about the PAIR and can only be checked as one.
//
// So this drives a real plan to exhaustion through `Engine.dispatch` and, at EVERY attempt count, asks both:
//
//     offered = does the read-model list `retry`?        (from the aggregate + the event stream, as the loader does)
//     accepted = does the engine accept RetryExecutionStep?
//
// and asserts `offered === accepted`. The boundary is not hardcoded anywhere in this file — whatever the cap turns
// out to be, the two must flip on the same attempt.
//
// THE SHAPING MIRRORS THE PRODUCTION LOADER deliberately, including calling `attemptsMadeFrom` per step: if this
// test built the count its own way it would prove that MY arithmetic agrees with the engine, not that the shipped
// read-model does.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { attemptsMadeFrom, retryCapFrom, DEFAULT_RETRY_CAP } from '@janumipwb/rph-domain';
import { executionPlanView, type ExecutionPlanInput } from '@janumipwb/rph-projections';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69HB300';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69HB310';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69HB320';
const STEP = `${PLAN}-s1`;

describe('N-12 — engine and read-model flip on the SAME attempt', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'retrycap',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	/** Shape the stored plan exactly as the production loader does — including the kernel's own attempt counter. */
	function shapeAsLoaderDoes(): ExecutionPlanInput {
		const pl = store.loadObject(PLAN)!;
		const state = pl.state as Record<string, unknown>;
		const events = store.readAllEvents();
		return {
			id: PLAN,
			workUnitId: String(state.workUnitId),
			status: String(state.status),
			steps: (state.steps as Record<string, unknown>[]).map((s) => ({
				id: String(s.id),
				stepType: String(s.stepType),
				purpose: String(s.purpose ?? ''),
				stepState: String(s.stepState),
				attemptsMade: attemptsMadeFrom(events, PLAN, String(s.id))
			})),
			...(state.retryPolicy === undefined ? {} : { retryPolicy: state.retryPolicy })
		};
	}

	const viewOffersRetry = () =>
		executionPlanView(shapeAsLoaderDoes()).steps[0]!.advanceCommands.includes('retry');

	/** Open an attempt and fail it, leaving the step FAILED with one more Started on the log. */
	function runAndFailOnce() {
		ok(dispatch('StartExecutionStep', { stepId: STEP }), 'start');
		ok(
			dispatch('FailExecutionStep', {
				stepId: STEP,
				failureReason: 'deliberate',
				failureClass: 'TRANSIENT'
			}),
			'fail'
		);
	}

	function arrangeActivePlan(retryPolicy: Record<string, unknown>) {
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
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'MODEL_INVOCATION',
						purpose: 'work',
						inputBindings: [],
						outputBindings: [],
						preconditions: [],
						postconditions: [],
						stepState: 'QUEUED'
					}
				],
				transitions: [],
				retryPolicy,
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	}

	beforeEach(() => arrangeActivePlan({ maxAttempts: 3 }));

	it('THE AGREEMENT: at every attempt count, the view offers retry exactly when the engine accepts it', () => {
		const trace: { attempts: number; offered: boolean; accepted: boolean }[] = [];
		// Bounded well above any plausible cap, so a limb that never refuses fails on the bound rather than hanging.
		for (let i = 0; i < 8; i += 1) {
			runAndFailOnce();
			const attempts = attemptsMadeFrom(store.readAllEvents(), PLAN, STEP);
			const offered = viewOffersRetry();
			const accepted = dispatch('RetryExecutionStep', { stepId: STEP }).status === 'ACCEPTED';
			trace.push({ attempts, offered, accepted });
			expect(offered, `attempt ${attempts}: view offered=${offered}, engine accepted=${accepted}`).toBe(
				accepted
			);
			if (!accepted) break;
		}
		// ANTI-VACUITY, and it is the assertion that matters most: a loop that never reached the cap would satisfy
		// the agreement trivially, and so would one where the engine refused from the very first attempt.
		expect(trace.some((t) => t.offered), 'retry was never offered — the cap fired immediately').toBe(
			true
		);
		expect(trace.some((t) => !t.offered), 'the cap was never reached — agreement is vacuous').toBe(
			true
		);
	});

	it('the flip happens at the plan’s DECLARED cap, not at a number this layer invented', () => {
		/** The attempt count at which the engine first refuses a retry; -1 if it never did. */
		const attemptsWhenRefused = () => {
			for (let i = 0; i < 8; i += 1) {
				runAndFailOnce();
				if (dispatch('RetryExecutionStep', { stepId: STEP }).status !== 'ACCEPTED')
					return attemptsMadeFrom(store.readAllEvents(), PLAN, STEP);
			}
			return -1;
		};
		// MAX TOTAL ATTEMPTS, 1-based: the refusal lands ON the cap, not one short of it. At maxAttempts=3 two
		// retries proceed (opening attempts 2 and 3) and the retry at attemptsMade=3 is refused — which is the
		// engine's own documented reading, asserted here against the DECLARED number rather than a literal.
		expect(attemptsWhenRefused()).toBe(3);

		// The same, with a different declared cap — so the boundary tracks the plan rather than a constant. If
		// either side had kept a hardcoded 3, this second case is where it shows.
		arrangeActivePlan({ maxAttempts: 5 });
		expect(attemptsWhenRefused()).toBe(5);
	});

	it('an absent RetryPolicy falls back to the kernel’s DEFAULT on BOTH sides', () => {
		// The cap convention lives in `retryCapFrom`; if either side kept its own default, this is where they part.
		arrangeActivePlan({});
		expect(retryCapFrom(undefined)).toBe(DEFAULT_RETRY_CAP);
		for (let i = 0; i < 8; i += 1) {
			runAndFailOnce();
			const offered = viewOffersRetry();
			const accepted = dispatch('RetryExecutionStep', { stepId: STEP }).status === 'ACCEPTED';
			expect(offered).toBe(accepted);
			if (!accepted) {
				expect(attemptsMadeFrom(store.readAllEvents(), PLAN, STEP)).toBe(DEFAULT_RETRY_CAP);
				return;
			}
		}
		throw new Error('the default cap never fired');
	});

	it('a wait/resume cycle does NOT consume the budget — on either side', () => {
		// `ResolveExecutionStepWait` is declared UNCAPPED because it emits no ExecutionStepStarted. If that ever
		// stopped being true, a step that waited would exhaust its plan without doing extra work.
		ok(dispatch('StartExecutionStep', { stepId: STEP }), 'start');
		ok(dispatch('EnterExecutionStepWait', { stepId: STEP }), 'wait');
		ok(dispatch('ResolveExecutionStepWait', { stepId: STEP }), 'resume');
		expect(attemptsMadeFrom(store.readAllEvents(), PLAN, STEP), 'a resume opened a new attempt').toBe(
			1
		);
		ok(
			dispatch('FailExecutionStep', {
				stepId: STEP,
				failureReason: 'after a wait',
				failureClass: 'TRANSIENT'
			}),
			'fail'
		);
		expect(viewOffersRetry()).toBe(true);
		ok(dispatch('RetryExecutionStep', { stepId: STEP }), 'retry after a wait/resume cycle');
	});
});
