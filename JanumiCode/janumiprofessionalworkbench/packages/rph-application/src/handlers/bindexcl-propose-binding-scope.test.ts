// JAN-BINDEXCL / N-11 (MAJOR) — the STORE half of propose-time binding admissibility.
//
// THE FINDING, in one line: a step could name a binding that already belonged to a DIFFERENT step, the plan would
// activate, and that step would then be refused at Start FOREVER by a refusal whose remedy no command can perform.
// `ProposeExecutionPlan` is the only writer of `steps[]`; `executionStepId` is written once at request. Neither
// side is rewritable, so the pairing is unrepairable the instant it is stored — and repairable up to that instant.
// L4 in `plan-proposal.ts` decides the half that needs no store (two steps, one binding); this decides the half
// that does (one step, somebody else's binding).
//
// ── WHY HALF OF THIS FILE IS POSITIVE CASES, AND WHY THAT IS THE POINT ──────────────────────────────────────
//
// The FIRST draft of this fix also refused a step naming a binding that does not resolve, on the reasonable-looking
// ground that the step could not start. THAT REFUSAL WAS ITSELF A WEDGE, of exactly the class N-11 is about:
// `RequestRuntimeBinding` carries an `executionStepId`, so a binding for step 2 can only be requested once step 2
// has an id — which in practice means once the plan exists. Refusing the dangling case therefore refuses the
// ordinary authoring order and leaves NO order that works.
//
// The same trap sits one step further on: consulting the binding's `authorizationStatus` here would refuse every
// plan whose bindings are not yet authorized, and authorization is a later act too. So the propose-time check asks
// exactly one question — is this binding somebody ELSE's? — and P2/P3 below are what stop it asking a second one.
//
// A refusal-only battery would pass under a check that refused every plan naming any binding, which is the failure
// this file exists to make impossible.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69HB200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69HB210';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69HB220';
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69HB230';
const OTHER_BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69HB231';
const sid = (i: number) => `${PLAN}-s${i}`;

/** The marker only the propose-time SCOPE refusal produces. */
const MISBOUND_MARKER = 'a binding authorizes the step it names and no other';

describe('JAN-BINDEXCL — ProposeExecutionPlan refuses a step bound to somebody else’s binding', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
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
			correlationId: 'bindexcl',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const mkStep = (i: number, runtimeBindingId?: string) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'MODEL_INVOCATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		...(runtimeBindingId ? { runtimeBindingId } : {}),
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	const propose = (steps: ReturnType<typeof mkStep>[]) =>
		dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: PWU,
			steps,
			transitions: [],
			retryPolicy: { maxAttempts: 5 },
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});

	/** Create a binding in REQUESTED (its initial state), scoped to `forStepId`. */
	const requestBindingFor = (id: string, forStepId: string) =>
		dispatch(
			'RequestRuntimeBinding',
			{
				runtimeBindingId: id,
				executionStepId: forStepId,
				roleId: 'role-architect',
				requestedCapabilities: [{ capability: 'file-system' }]
			},
			id,
			'RUNTIME_BINDING'
		);

	const authorize = (id: string) =>
		dispatch(
			'AuthorizeRuntimeBinding',
			{ grantedCapabilities: [{ capability: 'file-system' }] },
			id,
			'RUNTIME_BINDING'
		);

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
	});

	// ── THE KILL CASES ───────────────────────────────────────────────────────────────────────────────────────
	describe('the store half — a binding that RESOLVES and names another step', () => {
		it('K1 THE KILL TEST: a step naming a binding requested for a different step is REFUSED at propose', () => {
			ok(requestBindingFor(BINDING, sid(1)), 'request binding for step 1');
			const before = store.readAllEvents().length;

			// Step 2 points at step 1's binding. Nothing about the proposal alone is contradictory — only the store
			// knows the binding is already spoken for.
			const r = propose([mkStep(1), mkStep(2, BINDING)]);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
			expect(r.error?.message).toContain(MISBOUND_MARKER);
			expect(r.error?.message).toContain(sid(2));
			expect(r.error?.message, 'the message must name the step the binding DOES authorize').toContain(
				sid(1)
			);
			// Refused means refused: no plan, no events.
			expect(store.loadObject(PLAN), 'the plan must not exist').toBeUndefined();
			expect(store.readAllEvents().length, 'appended an event').toBe(before);
		});

		it('K2: the refusal names a remedy the engine can actually perform', () => {
			// The whole argument for moving this refusal to propose-time is that the Start-time one cannot say
			// anything actionable — its advice mints a binding no step names. This one has to do better.
			ok(requestBindingFor(BINDING, sid(1)), 'request');
			const r = propose([mkStep(1), mkStep(2, BINDING)]);
			expect(r.error?.message).toContain('RequestRuntimeBinding carries executionStepId');
			expect(r.error?.message).toContain('or leave the step unbound');
		});

		it('K3: an AUTHORIZED binding is refused on the same ground — this is SCOPE, not status', () => {
			ok(requestBindingFor(BINDING, sid(1)), 'request');
			ok(authorize(BINDING), 'authorize');
			const r = propose([mkStep(2, BINDING)]);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(MISBOUND_MARKER);
		});

		it('K4: a binding whose executionStepId names a step in NO plan is refused too', () => {
			// The fail-closed reading of `String(state.executionStepId ?? '')`: whatever it names, it does not name
			// this step, and the plan being proposed cannot change that.
			ok(requestBindingFor(BINDING, `${PLAN}-does-not-exist`), 'request for a phantom step');
			const r = propose([mkStep(1, BINDING)]);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(MISBOUND_MARKER);
		});
	});

	// ── THE PURE HALF, REACHED THROUGH THE BUS ───────────────────────────────────────────────────────────────
	it('K5: two steps naming ONE binding is refused by L4, before the store is consulted at all', () => {
		// No binding exists here. The contradiction is in the proposal itself, so it must be caught without a store
		// read — which is also what makes L4 testable as a pure function.
		const r = propose([mkStep(1, BINDING), mkStep(2, BINDING)]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('exactly one executionStepId');
		expect(r.error?.message, 'the pure rule must not claim to know what the store says').not.toContain(
			MISBOUND_MARKER
		);
	});

	// ── THE POSITIVE HALF: THE THREE THINGS THIS CHECK MUST NOT DO ───────────────────────────────────────────
	describe('what propose must still ACCEPT', () => {
		it('P1: a step naming the binding requested FOR IT', () => {
			ok(requestBindingFor(BINDING, sid(1)), 'request');
			ok(authorize(BINDING), 'authorize');
			ok(propose([mkStep(1, BINDING)]), 'propose');
			expect(store.loadObject(PLAN)?.objectType).toBe('EXECUTION_PLAN');
		});

		it('P2 THE ANTI-WEDGE CASE: a step naming a binding that does not exist YET', () => {
			// THE FIRST DRAFT OF THIS FIX REFUSED THIS, and that refusal was a wedge. `RequestRuntimeBinding` needs
			// an `executionStepId`, so the binding for a step cannot be requested before the step has an id —
			// refusing the dangling case would leave no authoring order that works at all. The dangling case is
			// already handled, fail-closed, at Start (exebind K4), and creating the binding repairs it.
			ok(propose([mkStep(1, BINDING), mkStep(2, OTHER_BINDING)]), 'propose with dangling bindings');
			expect(store.loadObject(PLAN)?.objectType).toBe('EXECUTION_PLAN');
			// …and the repair really is available afterwards, which is what makes this "not yet right" rather than
			// "wrong forever".
			ok(requestBindingFor(BINDING, sid(1)), 'the binding can be created after the plan');
			ok(requestBindingFor(OTHER_BINDING, sid(2)), 'and so can the other');
		});

		it('P3 THE SECOND ANTI-WEDGE CASE: a correctly-scoped binding still in REQUESTED', () => {
			// Consulting `authorizationStatus` here would be the same mistake one move later: authorization is also
			// a LATER act, so refusing an unauthorized binding at propose would refuse the ordinary order too. The
			// verdict is deliberately called without a status, and this is what pins that.
			ok(requestBindingFor(BINDING, sid(1)), 'request only — never authorized');
			expect(
				(store.loadObject(BINDING)?.state as { authorizationStatus?: string }).authorizationStatus
			).toBe('REQUESTED');
			ok(propose([mkStep(1, BINDING)]), 'propose');
		});

		it('P4: a DENIED binding scoped to its own step still proposes — status is not this rule’s business', () => {
			// The sharper form of P3: even a binding that will never authorize anything is not a MISBINDING. Start
			// refuses it (exebind K2), which is the right layer — a plan may legitimately be authored while its
			// authorizations are still being fought over.
			ok(requestBindingFor(BINDING, sid(1)), 'request');
			ok(dispatch('DenyRuntimeBinding', { reason: 'no' }, BINDING, 'RUNTIME_BINDING'), 'deny');
			ok(propose([mkStep(1, BINDING)]), 'propose');
		});

		it('P5: distinct steps under distinct, correctly-scoped bindings', () => {
			ok(requestBindingFor(BINDING, sid(1)), 'request 1');
			ok(requestBindingFor(OTHER_BINDING, sid(2)), 'request 2');
			ok(propose([mkStep(1, BINDING), mkStep(2, OTHER_BINDING)]), 'propose');
		});

		it('P6: a plan whose steps name no binding at all — the reference seed’s shape', () => {
			ok(propose([mkStep(1), mkStep(2), mkStep(3)]), 'propose');
		});
	});
});
