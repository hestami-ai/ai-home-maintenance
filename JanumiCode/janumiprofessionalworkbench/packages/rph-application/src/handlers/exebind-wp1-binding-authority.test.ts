// JAN-EXEBIND WP-B1 — RPH-EXE-003 becomes ENFORCED, and §15.3's allowlist becomes load-bearing.
//
// WHAT WAS WRONG. `bindingPermitsExecution` is ratified, correct and unit-tested, and had — repo-wide — exactly
// two references: its own definition and its own unit test. RPH-EXE-003's ratified statement is "starting
// execution with a runtime binding still in REQUESTED is REJECTED"; `startExecutionStep` never resolved the
// step's `runtimeBindingId` at all, so a step started freely against a REQUESTED, DENIED or REVOKED binding. The
// M12 conformance manifest meanwhile certified the whole RPH-EXE family COVERED "001..009 by id" on the strength
// of that unit test — a pure-predicate assertion accepted as evidence for a rule whose ratified `then` is "the
// command is rejected".
//
// That is F-28's shape exactly, and it was found by the register JAN-EXECREM WP-16 built BECAUSE F-28 happened.
//
// TWO LIMBS, AND K5 IS THE TEST THAT MATTERS. Limb 3 asks "is this binding authorized at all?" (RPH-EXE-003,
// ratified); limb 4 asks "did THIS ACTIVATION authorize it?" (§15.3, authored). Every negative except K5 is
// satisfied by limb 3 alone — so without K5 the two limbs are ONE limb wearing two names, and deleting the
// allowlist check would fail nothing. K5 therefore arranges a genuinely AUTHORIZED binding, which is the only
// arrangement in which limb 4 can be the thing that refuses.
//
// AND THE CODE IS NEVER ASSERTED ALONE. Limbs 3 and 4 share `RPH_INVARIANT_VIOLATION`, which is also returned by
// the PWU-openness limb, the retry cap and the prunability precheck. A code-only assertion proves that SOMETHING
// refused — the vacuous negative this lineage keeps removing. Each case asserts its own marker.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedRuntimeBindingStatus_FIXTURE } from './__tests__/binding-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69HB100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69HB110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69HB120';
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69HB130';
const sid = (i: number) => `${PLAN}-s${i}`;

/** The marker only the RPH-EXE-003 status limb produces. */
const STATUS_MARKER =
	'a step may only execute against an AUTHORIZED or PARTIALLY_AUTHORIZED binding';
/** The marker only the §15.3 allowlist limb produces. */
const ALLOWLIST_MARKER = 'it is not among the bindings THIS ACTIVATION authorized';

describe('JAN-EXEBIND WP-B1 — runtime binding authority at Start', () => {
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
			correlationId: 'exebind',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const stepStateOf = (i: number) =>
		(store.loadObject(PLAN)!.state as { steps: { id: string; stepState: string }[] }).steps.find(
			(s) => s.id === sid(i)
		)?.stepState;

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

	/** Create the binding in REQUESTED (its initial state). */
	const requestBinding = (id = BINDING) =>
		dispatch(
			'RequestRuntimeBinding',
			{
				runtimeBindingId: id,
				executionStepId: sid(1),
				roleId: 'role-architect',
				requestedCapabilities: [{ capability: 'file-system' }]
			},
			id,
			'RUNTIME_BINDING'
		);

	const authorizeBinding = (id = BINDING) =>
		dispatch(
			'AuthorizeRuntimeBinding',
			{ grantedCapabilities: [{ capability: 'file-system' }] },
			id,
			'RUNTIME_BINDING'
		);

	/**
	 * An ACTIVE one-step plan. `bindingOnStep` is what the STEP names; `authorized` is what the ACTIVATION
	 * authorized — kept as separate arguments precisely so K5 can make them disagree.
	 */
	function activePlan(bindingOnStep?: string, authorized: string[] = []) {
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1, bindingOnStep)],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: authorized }), 'activate');
	}

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

	// ── THE RATIFIED LIMB (RPH-EXE-003) ───────────────────────────────────────────────────────────────────────
	describe('limb 3 — RPH-EXE-003: the binding must be authorized AT ALL', () => {
		it('K1: a REQUESTED binding REFUSES the start — the rule, stated verbatim', () => {
			ok(requestBinding(), 'request binding');
			activePlan(BINDING, [BINDING]); // allowlisted, so ONLY the status can refuse
			const before = store.readAllEvents().length;

			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			// The kernel's own verdict, carried into the message — `RPH_BINDING_NOT_AUTHORIZED` is NOT a ratified
			// wire code (RphErrorCodeSchema is a closed 15-value enum), so it travels here or nowhere.
			expect(r.error?.message).toContain('RPH_BINDING_NOT_AUTHORIZED');
			expect(r.error?.message).toContain(STATUS_MARKER);
			expect(r.error?.message).toContain('REQUESTED');
			// Refused means refused: nothing appended, and the step did not move.
			expect(store.readAllEvents().length, 'appended an event').toBe(before);
			expect(stepStateOf(1)).toBe('QUEUED');
		});

		it('K2: a DENIED binding REFUSES', () => {
			ok(requestBinding(), 'request binding');
			ok(dispatch('DenyRuntimeBinding', { reason: 'no' }, BINDING, 'RUNTIME_BINDING'), 'deny');
			activePlan(BINDING, [BINDING]);
			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(STATUS_MARKER);
			expect(r.error?.message).toContain('DENIED');
			expect(stepStateOf(1)).toBe('QUEUED');
		});

		it('K3: a REVOKED binding REFUSES — authorization is not permanent', () => {
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			ok(
				dispatch(
					'RevokeRuntimeCapability',
					{ reason: 'credential rotated' },
					BINDING,
					'RUNTIME_BINDING'
				),
				'revoke'
			);
			activePlan(BINDING, [BINDING]);
			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(STATUS_MARKER);
			expect(r.error?.message).toContain('REVOKED');
			expect(stepStateOf(1)).toBe('QUEUED');
		});

		it('K4: a runtimeBindingId that resolves to NOTHING fails CLOSED', () => {
			// An execution act whose authority cannot be READ cannot be authorized by it — the same disposition, and
			// the same code, as pwuOpennessRefusal's unresolvable case.
			activePlan('bind_01ARZ3NDEKTSV4RRFFQ69HBZZZ', ['bind_01ARZ3NDEKTSV4RRFFQ69HBZZZ']);
			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
			expect(r.error?.message).toContain('does not resolve to a RUNTIME_BINDING');
			expect(stepStateOf(1)).toBe('QUEUED');
		});
	});

	// ── THE AUTHORED LIMB (§15.3) ─────────────────────────────────────────────────────────────────────────────
	describe('limb 4 — §15.3: did THIS ACTIVATION authorize this binding?', () => {
		it('K5 THE LIMB-SEPARATION PROOF: an AUTHORIZED binding outside the allowlist still REFUSES', () => {
			// Without this case the allowlist check is unkillable: every other negative in this file is satisfied by
			// the status limb alone, so deleting limb 4 would fail nothing. The binding here is genuinely AUTHORIZED,
			// which is the only arrangement in which limb 4 can be the thing that refuses.
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, []); // the activation authorized NO bindings

			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message, 'the ALLOWLIST limb, not the status limb').toContain(
				ALLOWLIST_MARKER
			);
			// …and it is demonstrably NOT the status limb: that limb's marker must be absent, or the two rows are
			// one row and K1-K3 prove nothing about limb 4.
			expect(r.error?.message).not.toContain(STATUS_MARKER);
			expect(stepStateOf(1)).toBe('QUEUED');
		});

		it('THE ORDER PROOF: a binding that fails BOTH limbs is refused by the RATIFIED one', () => {
			// ADDED AFTER A SURVIVING MUTANT. Moving the allowlist limb ahead of the status check survived the whole
			// battery above, because every other case allowlists the binding — so the ORDER this design argued for
			// was asserted in prose and tested nowhere. This is the only input that can tell the two orders apart: a
			// REQUESTED binding that is ALSO outside the allowlist.
			//
			// It must be RPH-EXE-003 that refuses. If the authored §15.3 limb answered first it would MASK the
			// ratified rule for exactly the population the ratified rule exists to catch — and RPH-EXE-003's kill
			// tests would be measuring the allowlist, which is the defect class reintroduced by its own fix.
			ok(requestBinding(), 'request binding');
			activePlan(BINDING, []); // unauthorized AND unallowlisted

			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message, 'the RATIFIED rule must answer first').toContain(STATUS_MARKER);
			expect(r.error?.message).not.toContain(ALLOWLIST_MARKER);
		});

		it('a binding authorized for a DIFFERENT plan is not authorized for this one', () => {
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, ['bind_01ARZ3NDEKTSV4RRFFQ69HBOTH']);
			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(ALLOWLIST_MARKER);
		});
	});

	// ── THE POSITIVE HALF ─────────────────────────────────────────────────────────────────────────────────────
	describe('the widest legitimate input still starts', () => {
		it('P1: AUTHORIZED and allowlisted — ACCEPTED', () => {
			// Without the positive half a resolver that refused everything would pass every case above. Over-refusal
			// is the failure mode a refusal-only battery cannot see, and this lineage has already shipped one.
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, [BINDING]);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			expect(stepStateOf(1)).toBe('RUNNING');
		});

		it('P2: PARTIALLY_AUTHORIZED is startable — the ratified kernel says so, and this fix does not narrow it', () => {
			// THE STATUS IS SEEDED, AND THAT IS A FINDING (N-6). The machine ratifies
			// `REQUESTED -> PARTIALLY_AUTHORIZED` ("partial grant") and NO COMMAND DRIVES IT — registry.ts wires
			// Request/Authorize/Deny/Revoke and nothing else. So the rule this work package wires has an ACCEPTANCE
			// limb the command bus cannot reach. Writing it as a pure-function assertion instead would be the exact
			// substitution WP-16's register exists to stop, so the arrangement is seeded and the acceptance is driven.
			ok(requestBinding(), 'request binding');
			seedRuntimeBindingStatus_FIXTURE(store, BINDING, 'PARTIALLY_AUTHORIZED');
			activePlan(BINDING, [BINDING]);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			expect(stepStateOf(1)).toBe('RUNNING');
		});

		it('P3: a step naming NO binding starts — the rule’s antecedent is "WITH a runtime binding"', () => {
			// DS-001 §4-R5. This is a SCOPE decision, not a fail-open, and it is load-bearing: the reference seed
			// authors no RuntimeBinding at all, so refusing the absent case would make every existing plan
			// unstartable. DISCLOSED: an AI step running unbound stays governed only by executionAttempts'
			// `aiNoBinding` advisory, which gates nothing. Closing that needs a NEW rule, not a wider reading.
			activePlan(undefined, []);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			expect(stepStateOf(1)).toBe('RUNNING');
		});

		it('P4: a plan with NO allowlist field at all still starts an authorized binding (the legacy residual)', () => {
			// Plans activated BEFORE JAN-EXECREM WP-14 persisted the field carry no array. Skipping them is the
			// "legacy stored plans are never re-validated" residual this lineage has disclosed throughout — and it is
			// distinguishable from an EMPTY array, which REFUSES (K5): an activation that authorized no bindings
			// authorized no bindings.
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, [BINDING]);
			const stored = store.loadObject(PLAN)!;
			const state = stored.state as Record<string, unknown>;
			expect(state.authorizedRuntimeBindingIds, 'WP-14 persists it').toEqual([BINDING]);
		});
	});
});
