// JAN-EXEBIND WP-B1 (RPH-EXE-003) + JAN-REVREM RW-0 — runtime binding authority, as a DECLARED COLUMN.
//
// WHAT WAS WRONG ORIGINALLY. `bindingPermitsExecution` is ratified, correct and unit-tested, and had — repo-wide
// — exactly two references: its own definition and its own unit test. `startExecutionStep` never resolved the
// step's runtimeBindingId at all, so a step started freely against a REQUESTED, DENIED or REVOKED binding, while
// the M12 manifest certified the whole RPH-EXE family COVERED "001..009 by id".
//
// AND WHAT WAS WRONG WITH THE FIX — the post-build adversarial review's only BLOCKER. WP-B1 wired the rule as a
// hand-inlined precheck inside `startExecutionStep`. **TWO ARROWS DRIVE A STEP INTO RUNNING.**
// `resolveExecutionStepWait` passed no precheck at all, so:
//
//     Start (binding AUTHORIZED) -> EnterExecutionStepWait -> RevokeRuntimeCapability -> ResolveExecutionStepWait
//     = ACCEPTED, step RUNNING, binding REVOKED.
//
// Revocation was unenforceable for every step that can be parked in WAITING, while the engine's own refusal
// message asserted that state was impossible. That is the exact shape `STEP_COMMAND_SPECS` exists to end — WP-8:
// "an omission is invisible in a list that does not exist" — reintroduced ONE work package after WP-12b moved the
// other two authorities into it as columns. A guard that must be remembered per call site will be forgotten at
// one of them.
//
// SO THE AXIS IS NOW A COLUMN (`bindingAuthority`), declared per command with a rationale, evaluated ONCE in
// `stepAuthorityRefusal` for all nine. B3 below iterates the table, so a tenth command declaring
// REQUIRES_AUTHORIZED_BINDING without enforcement fails HERE rather than in the next review.
//
// THE §15.3 ALLOWLIST LIMB IS WITHDRAWN, and its two tests went with it. The review proved it an unrecoverable
// wedge whose message prescribed a remedy the engine forbids, while both shipped activation sites pass `[]` —
// so any step naming a binding was permanently unstartable. See `bindingAuthorityRefusal`'s header for why it is
// withdrawn rather than repaired.
//
// THE CODE IS NEVER ASSERTED ALONE. `RPH_INVARIANT_VIOLATION` is also returned by the PWU-openness limb, the
// retry cap and the prunability precheck, so a code-only assertion proves that SOMETHING refused — the vacuous
// negative this lineage keeps removing. Each case asserts the marker.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { STEP_COMMAND_SPECS, STEP_COMMAND_TYPES } from '@janumipwb/rph-domain';
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
/** The marker only the SCOPE limb produces (JAN-REVREM RW-3). */
const SCOPE_MARKER = 'a binding authorizes the step it names and no other';

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
	 * authorized. They are still separate arguments so a test CAN make them disagree — which is now a POSITIVE
	 * case (P4), since the allowlist limb was withdrawn.
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

	/** Fresh store + engine + intent + PWU. Extracted so the class battery can re-arrange per command. */
	function resetEngine() {
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
	}

	beforeEach(resetEngine);

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

		it('P4: a binding NOT in the activation allowlist starts — the withdrawn §15.3 limb', () => {
			// The limb WP-B1 added refused this, and both shipped activation sites pass `[]`, so every step naming a
			// binding was permanently unstartable and its plan could never complete. Withdrawn; this pins that it
			// stays withdrawn, and it is the mutant that reddens if anyone restores it.
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, []); // the activation authorized NOTHING
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			expect(stepStateOf(1)).toBe('RUNNING');
		});
	});

	// ── SCOPE: WHICH step did this binding authorize? (JAN-REVREM RW-3, review finding #2) ────────────────────
	describe('limb 2 — the binding must be the one authorized FOR THIS STEP', () => {
		// ── WHY THESE TWO WERE RE-ARRANGED (JAN-BINDEXCL / N-11) ────────────────────────────────────────────────
		//
		// Both originally arranged their misbinding BEFORE proposing, and propose now REFUSES both arrangements:
		// S1 named one binding on two steps (L4 exclusivity), and S2 named an already-stored binding scoped to a
		// different step (the handler's store half). That is the fix working — the misbinding is caught where the
		// author can still edit the proposal, instead of becoming a step no command can ever start.
		//
		// AND THE LIMB IS STILL REACHABLE THROUGH THE BUS, which is the point of the new arrangement and a
		// CORRECTION to this work package's own recorded analysis. That analysis concluded the SCOPE limb becomes
		// unreachable for new plans and would need a seeded legacy aggregate to test at all. It does not: propose
		// deliberately ALLOWS a step to name a binding that does not exist yet (the dangling case — refusing it
		// would be a wedge, since `RequestRuntimeBinding` needs the step's id), so the misbinding can still be
		// created AFTER the plan is stored. Both tests now do exactly that, entirely through `Engine.dispatch`,
		// which is stronger evidence than any fixture would have been — and no fixture was written.
		//
		// So the residual population of the Start-time limb is real and reachable, not merely historical: any
		// binding requested after its plan was proposed can name the wrong step.

		/** A two-step plan: step 1 under BINDING (correctly scoped), step 2 under a binding not yet created. */
		function planWithLaterBindingForStep2(second: string) {
			ok(
				dispatch('ProposeExecutionPlan', {
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [mkStep(1, BINDING), mkStep(2, second)],
					transitions: [],
					retryPolicy: { maxAttempts: 5 },
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				}),
				'propose'
			);
			ok(dispatch('ApproveExecutionPlan', {}), 'approve');
			ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
		}

		it('S1 THE KILL TEST: a binding authorized for step 1 does NOT back step 2', () => {
			// Every status check passes — the binding is genuinely AUTHORIZED — and the authority being exercised was
			// granted for DIFFERENT work, with whatever capabilities that step's risk justified. A privilege-SCOPE
			// hole, not a privilege-STATUS one, and the same shape as an unscoped waiver.
			const SECOND = 'bind_01ARZ3NDEKTSV4RRFFQ69HB131';
			ok(requestBinding(), 'request binding'); // names sid(1)
			ok(authorizeBinding(), 'authorize');
			planWithLaterBindingForStep2(SECOND); // SECOND does not exist yet — propose allows it
			// …and NOW the misbinding is created: a second, distinct binding that also names step 1, while step 2 is
			// what points at it. Distinct ids, so L4 exclusivity is satisfied; the pairing is still wrong.
			ok(
				dispatch(
					'RequestRuntimeBinding',
					{
						runtimeBindingId: SECOND,
						executionStepId: sid(1),
						roleId: 'role-architect',
						requestedCapabilities: [{ capability: 'file-system' }]
					},
					SECOND,
					'RUNTIME_BINDING'
				),
				'request the second binding, for step 1'
			);
			ok(authorizeBinding(SECOND), 'authorize the second binding');
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'step 1 is in scope');
			ok(
				dispatch('CompleteExecutionStep', {
					executionStepId: sid(1),
					executionAttemptId: `${sid(1)}-a1`,
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [],
					detectedAssumptionIds: [],
					structuredResult: {},
					noOutputResult: { reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT', detail: 'fixture' },
					executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
				}),
				'complete s1'
			);

			const r = dispatch('StartExecutionStep', { stepId: sid(2) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toContain(SCOPE_MARKER);
			// …and demonstrably NOT the status limb: the binding is AUTHORIZED, so a status refusal here would mean
			// the two limbs are one.
			expect(r.error?.message).not.toContain(STATUS_MARKER);
			expect(stepStateOf(2)).toBe('QUEUED');
		});

		it('S2: a binding naming a step that does not exist authorizes nothing', () => {
			// The plan is proposed FIRST, naming a binding that does not exist yet (allowed — K4 is the Start-time
			// half of that same disposition). The binding is then created for a phantom step, so the misbinding is
			// authored after the plan and propose never saw it.
			activePlan(BINDING, []);
			ok(
				dispatch(
					'RequestRuntimeBinding',
					{
						runtimeBindingId: BINDING,
						executionStepId: `${PLAN}-does-not-exist`,
						roleId: 'r',
						requestedCapabilities: [{ capability: 'file-system' }]
					},
					BINDING,
					'RUNTIME_BINDING'
				),
				'request binding for a phantom step'
			);
			ok(authorizeBinding(), 'authorize');
			const r = dispatch('StartExecutionStep', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain(SCOPE_MARKER);
		});

		it('S3 the over-refusal half: the binding’s OWN step still starts', () => {
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, []);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			expect(stepStateOf(1)).toBe('RUNNING');
		});
	});

	// ── THE BLOCKER, AND THE CLASS BEHIND IT (JAN-REVREM RW-0) ────────────────────────────────────────────────
	describe('the SECOND arrow into RUNNING', () => {
		/** Start a step under an AUTHORIZED binding, park it in WAITING, then revoke the binding. */
		function runningThenRevoked() {
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, [BINDING]);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			ok(dispatch('EnterExecutionStepWait', { stepId: sid(1) }), 'wait');
			ok(
				dispatch(
					'RevokeRuntimeCapability',
					{ reason: 'credential rotated mid-flight' },
					BINDING,
					'RUNTIME_BINDING'
				),
				'revoke'
			);
			expect(stepStateOf(1)).toBe('WAITING');
		}

		it('B1 THE BLOCKER: ResolveExecutionStepWait REFUSES a resume against a REVOKED binding', () => {
			// This exact sequence was ACCEPTED before RW-0, leaving the step RUNNING against a REVOKED binding —
			// which made revocation unenforceable for every step that can be parked in WAITING.
			runningThenRevoked();
			const r = dispatch('ResolveExecutionStepWait', { stepId: sid(1) });
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toContain(STATUS_MARKER);
			expect(r.error?.message).toContain('REVOKED');
			expect(stepStateOf(1), 'the step must stay parked').toBe('WAITING');
		});

		it('…and CANCEL still works on that step, so revocation never strands it', () => {
			// The other half of the ruling: Cancel is NOT_EXECUTING by declaration, precisely so the step whose
			// binding was revoked has an exit. Gating cancel on the binding would strand exactly the case
			// revocation exists to stop.
			runningThenRevoked();
			ok(
				dispatch('CancelExecutionStep', { stepId: sid(1), reason: 'binding revoked; abandoning' }),
				'cancel'
			);
			expect(stepStateOf(1)).toBe('CANCELLED');
		});

		it('…and a RUNNING step whose binding is revoked can still FAIL', () => {
			// Reporting trouble must never require a live authority. Arranged from RUNNING rather than WAITING
			// because Fail drivesFrom RUNNING — which is itself worth naming: from WAITING under a revoked binding
			// the ONLY exit is Cancel, and that is precisely why Cancel is the one command exempt from every
			// authority limb in the table.
			ok(requestBinding(), 'request binding');
			ok(authorizeBinding(), 'authorize');
			activePlan(BINDING, [BINDING]);
			ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
			ok(
				dispatch('RevokeRuntimeCapability', { reason: 'rotated' }, BINDING, 'RUNTIME_BINDING'),
				'revoke'
			);
			ok(
				dispatch('FailExecutionStep', { stepId: sid(1), failureReason: 'binding revoked' }),
				'fail'
			);
			expect(stepStateOf(1)).toBe('FAILED');
		});
	});

	describe('B3 — the CLASS: every command the table declares is enforced', () => {
		it('every REQUIRES_AUTHORIZED_BINDING command refuses an unauthorized binding', () => {
			// DERIVED FROM THE TABLE, so a tenth command declaring the column without enforcement fails HERE rather
			// than in the next adversarial review. This is the difference between fixing the instance and fixing the
			// class — and the instance is what WP-B1 fixed.
			const gated = STEP_COMMAND_TYPES.filter(
				(c) => STEP_COMMAND_SPECS[c].bindingAuthority === 'REQUIRES_AUTHORIZED_BINDING'
			);
			expect(gated.length, 'the table must actually declare some').toBeGreaterThan(1);

			for (const commandType of gated) {
				// Arrange the step in this command's own source state, with the binding REVOKED.
				const spec = STEP_COMMAND_SPECS[commandType];
				resetEngine();
				ok(requestBinding(), 'request binding');
				ok(authorizeBinding(), 'authorize');
				activePlan(BINDING, [BINDING]);
				if (spec.sourceStates.includes('WAITING')) {
					ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
					ok(dispatch('EnterExecutionStepWait', { stepId: sid(1) }), 'wait');
				}
				ok(
					dispatch('RevokeRuntimeCapability', { reason: 'r' }, BINDING, 'RUNTIME_BINDING'),
					'revoke'
				);

				const r = dispatch(commandType, { stepId: sid(1) });
				expect(r.status, `${commandType} must refuse an unauthorized binding`).toBe('REJECTED');
				expect(r.error?.message, `${commandType}: not the binding limb`).toContain(STATUS_MARKER);
			}
		});

		it('and every NOT_EXECUTING command is UNAFFECTED by binding status (the over-refusal half)', () => {
			// A column that gated everything would pass the test above and strand every revoked step. Cancel and Fail
			// are the two that matter most: they are the exits.
			for (const commandType of ['CancelExecutionStep', 'FailExecutionStep'] as const) {
				expect(STEP_COMMAND_SPECS[commandType].bindingAuthority).toBe('NOT_EXECUTING');
				resetEngine();
				ok(requestBinding(), 'request binding');
				ok(authorizeBinding(), 'authorize');
				activePlan(BINDING, [BINDING]);
				ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
				ok(
					dispatch('RevokeRuntimeCapability', { reason: 'r' }, BINDING, 'RUNTIME_BINDING'),
					'revoke'
				);
				const payload =
					commandType === 'FailExecutionStep'
						? { stepId: sid(1), failureReason: 'x' }
						: { stepId: sid(1), reason: 'x' };
				ok(dispatch(commandType, payload), `${commandType} under a revoked binding`);
			}
		});

		it('the two gated commands are exactly the two arrows into RUNNING', () => {
			// Stated LITERALLY rather than derived, per the WP-12b ruling: a matrix generated from the table proves
			// totality only — mutating a row moves the generated expectation along with the behaviour. The
			// CLASSIFICATION is asserted by a case that does not read the table for its expectation.
			const gated = STEP_COMMAND_TYPES.filter(
				(c) => STEP_COMMAND_SPECS[c].bindingAuthority === 'REQUIRES_AUTHORIZED_BINDING'
			);
			expect([...gated].sort()).toEqual(['ResolveExecutionStepWait', 'StartExecutionStep']);
			for (const c of gated) expect(STEP_COMMAND_SPECS[c].target, c).toBe('RUNNING');
		});
	});
});
