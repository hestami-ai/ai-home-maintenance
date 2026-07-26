// JAN-PARTAUTH / N-6 — one command, two ratified outcomes, and a grant that may not shrink.
//
// N-6 WAS: `RuntimeBinding.authorizationStatus` ratifies PARTIALLY_AUTHORIZED, `bindingPermitsExecution` PERMITS
// execution on it, and NO COMMAND PRODUCED IT. A ratified rule with an acceptance limb the command bus cannot
// reach, whose only coverage was a fixture writing the aggregate directly.
//
// AND THE FIX IS A DERIVATION, WHICH THIS REGISTER GOT WRONG FIRST. It concluded a
// `PartiallyAuthorizeRuntimeBinding` command was needed, from two premises that both failed on inspection: that
// the arrow's prose trigger ("partial grant") named a distinct event — 206 of the corpus's 290 triggers are prose
// — and that `advanceStatus` taking a single `target` was a fact about the domain rather than about a helper. The
// authored vocabulary answers it directly: `RuntimeBindingAuthorized` declares `authorizationStatus` REQUIRED,
// noted "REQUESTED->AUTHORIZED|PARTIALLY_AUTHORIZED".
//
// THE MONOTONICITY LIMB IS HERE BECAUSE THIS WORK PACKAGE CREATES ITS CASE. `mutate` writes the granted set
// wholesale and the precondition already admits PARTIALLY_AUTHORIZED, so making that state reachable makes a
// silent privilege REDUCTION reachable with it — recorded as an authorization rather than as the revocation it is.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69HB400';
const STEP = 'plan_01ARZ3NDEKTSV4RRFFQ69HB410-s1';
const cap = (c: string) => ({ capability: c });

describe('JAN-PARTAUTH — the authorization outcome is DERIVED from the grant', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'RUNTIME_BINDING',
			targetAggregateId: BINDING,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'partauth',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const statusOf = () =>
		(store.loadObject(BINDING)!.state as { authorizationStatus: string }).authorizationStatus;
	const grantedOf = () =>
		((store.loadObject(BINDING)!.state as { grantedCapabilities: { capability: string }[] })
			.grantedCapabilities ?? []).map((g) => g.capability);

	const request = (...capabilities: string[]) =>
		dispatch('RequestRuntimeBinding', {
			runtimeBindingId: BINDING,
			executionStepId: STEP,
			roleId: 'role-architect',
			requestedCapabilities: capabilities.map(cap)
		});

	const authorize = (...capabilities: string[]) =>
		dispatch('AuthorizeRuntimeBinding', { grantedCapabilities: capabilities.map(cap) });

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	describe('the two outcomes, both driven through the bus', () => {
		it('N-6 CLOSED: a grant that does NOT cover the request yields PARTIALLY_AUTHORIZED', () => {
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'grant one');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			expect(grantedOf()).toEqual(['file-system']);
		});

		it('a grant that COVERS the request yields AUTHORIZED — the outcome is not always partial', () => {
			// The over-refusal half of the derivation: a rule that returned PARTIALLY_AUTHORIZED unconditionally
			// would satisfy the case above and silently downgrade every full authorization in the system.
			ok(request('file-system'), 'request one');
			ok(authorize('file-system'), 'grant it');
			expect(statusOf()).toBe('AUTHORIZED');
		});

		it('N-20: a VACUOUS request is refused at creation, because nothing downstream could repair it', () => {
			// It would reach AUTHORIZED — correctly, everything asked for was granted — and AUTHORIZED permits
			// execution while conferring nothing. Refusing it at Start would be a WEDGE: `fromStates` does not admit
			// AUTHORIZED as a source, so there is no second authorization, and no command re-points a step's
			// runtimeBindingId. Here, nothing is stored yet and the remedy is to request again.
			const r = request();
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('names no capability');
			expect(r.error?.message).toContain('may not be re-authorized');
			expect(store.loadObject(BINDING), 'the binding must not exist').toBeUndefined();
		});

		it('N-18 RULED (option C): an empty grant against a real request is PARTIALLY_AUTHORIZED and NOT executable', () => {
			// The state is RIGHT and is deliberately kept: "reviewed, granted nothing, still live" is a first-class
			// multi-party position — a first approver in a chain, a tenant policy pending, an auditor's record that a
			// review happened and produced nothing. It is distinct from REQUESTED (nobody looked) and from DENIED
			// (refused, terminal). What was wrong was the PREDICATE: the binding permitted execution.
			ok(request('file-system'), 'request one');
			ok(authorize(), 'grant nothing');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			expect(grantedOf()).toEqual([]);
		});
	});

	describe('the PARTIALLY_AUTHORIZED -> AUTHORIZED arrow (privilege expansion)', () => {
		it('a second authorization that completes the grant drives to AUTHORIZED', () => {
			// The machine's own arrow, reachable for the first time: "new authorization event (privilege expansion)".
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'partial');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			ok(authorize('file-system', 'network'), 'expand to the full request');
			expect(statusOf()).toBe('AUTHORIZED');
			expect(grantedOf().sort()).toEqual(['file-system', 'network']);
		});

		it('THE GUARD THIS COMMIT OWES: a second authorization may not silently SHRINK the grant', () => {
			// Unreachable before N-6 closed, because PARTIALLY_AUTHORIZED was unreachable. `mutate` writes the granted
			// set wholesale, so without this the capability is dropped and the removal is recorded as a
			// RuntimeBindingAuthorized event — while RevokeRuntimeCapability exists to record removal with a reason.
			//
			// THE SOURCE STATE MATTERS, and the first draft of this case got it wrong: it shrank from AUTHORIZED,
			// where `fromStates` refuses first and the verdict was RPH_ILLEGAL_STATE_TRANSITION — a refusal, but not
			// THIS one, and a test satisfied by the wrong limb is the vacuous negative this lineage keeps removing.
			// The reduction has to be attempted from PARTIALLY_AUTHORIZED, which is an admissible source, so only
			// the monotonicity guard can refuse it.
			ok(request('file-system', 'network', 'secrets'), 'request three');
			ok(authorize('file-system', 'network'), 'grant two of three — PARTIALLY_AUTHORIZED');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			const before = store.readAllEvents().length;

			const r = authorize('file-system');
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toContain('RPH_CAPABILITY_SILENTLY_REDUCED');
			expect(r.error?.message).toContain('network');
			// The remedy must be one the engine can actually perform.
			expect(r.error?.message).toContain('RevokeRuntimeCapability');
			// Refused means refused: the grant stands and nothing was appended.
			expect(grantedOf().sort()).toEqual(['file-system', 'network']);
			expect(store.readAllEvents().length, 'appended an event').toBe(before);
		});

		it('…and REVOKING is still available, so the refusal above is not a wedge', () => {
			// The reduction path exists; it is a different command, with its own event and a reason.
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'partial');
			ok(dispatch('RevokeRuntimeCapability', { reason: 'credential rotated' }), 'revoke');
			expect(statusOf()).toBe('REVOKED');
		});

		it('re-issuing the SAME grant is refused as a no-op, not accepted as a fresh authorization', () => {
			// `fromStates` owns this, and the derivation must not have quietly widened it: AUTHORIZED is not an
			// admissible source, so an identical re-authorization cannot append a second event for a change that
			// did not happen.
			ok(request('file-system'), 'request');
			ok(authorize('file-system'), 'authorize');
			expect(authorize('file-system').status).toBe('REJECTED');
		});
	});

	describe('R2 — the EVENT records the outcome, not just the grant', () => {
		const authorizedEvents = () =>
			store.readAllEvents().filter((e) => e.eventType === 'RuntimeBindingAuthorized');

		it('records PARTIALLY_AUTHORIZED on the event, not only in the aggregate', () => {
			// Before this, the handler emitted the raw COMMAND payload — so the log carried the grant and NOT the
			// outcome, and an auditor could not tell a full authorization from a partial one. That is the exact
			// distinction JAN-PARTAUTH's derivation exists to make, and the vocabulary declares the field REQUIRED on
			// this very event.
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'grant one');
			const [e] = authorizedEvents();
			expect((e!.payload as { authorizationStatus?: string }).authorizationStatus).toBe(
				'PARTIALLY_AUTHORIZED'
			);
			expect((e!.payload as { grantedCapabilities?: unknown[] }).grantedCapabilities).toEqual([
				cap('file-system')
			]);
		});

		it('records AUTHORIZED for a covering grant — the two outcomes are distinguishable in the log', () => {
			// The control: a field pinned to one constant would satisfy the case above while recording nothing.
			ok(request('file-system'), 'request one');
			ok(authorize('file-system'), 'grant it');
			expect(
				(authorizedEvents()[0]!.payload as { authorizationStatus?: string }).authorizationStatus
			).toBe('AUTHORIZED');
		});

		it('takes the status from the COMMITTED state, so event and aggregate cannot disagree', () => {
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'partial');
			ok(authorize('file-system', 'network'), 'expand to full');
			const statuses = authorizedEvents().map(
				(e) => (e.payload as { authorizationStatus?: string }).authorizationStatus
			);
			expect(statuses).toEqual(['PARTIALLY_AUTHORIZED', 'AUTHORIZED']);
			expect(statuses[statuses.length - 1]).toBe(statusOf());
		});
	});

	describe('N-4 still holds — the derivation did not displace it', () => {
		it('a grant exceeding the request is refused before any outcome is derived', () => {
			ok(request('file-system'), 'request one');
			const r = authorize('file-system', 'network');
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('RPH_CAPABILITY_NOT_REQUESTED');
			expect(statusOf(), 'the binding must not have moved').toBe('REQUESTED');
		});

		it('an entirely unrequested grant cannot reach PARTIALLY_AUTHORIZED by the back door', () => {
			// Without N-4 running first, `authorizationOutcome` would see a grant that does not cover the request and
			// happily return PARTIALLY_AUTHORIZED — laundering privilege expansion into a partial authorization.
			ok(request('file-system'), 'request one');
			expect(authorize('network').status).toBe('REJECTED');
			expect(statusOf()).toBe('REQUESTED');
		});
	});

	// ── N-22 NARROWED — INCREMENTAL MULTI-PARTY AUTHORIZATION IS EXPRESSIBLE AFTER ALL ─────────────────────────────
	//
	// I disclosed to the sponsor that the ratified machine makes this inexpressible, because it declares no
	// PARTIALLY_AUTHORIZED self-loop. That was wrong twice over: `checkTransition` admits `from === to` as a NOOP by
	// design, and this codebase ALREADY runs two genuine same-state HOLDS (`ApplyTacticalChange` ACTIVE -> ACTIVE).
	// A same-state transition here is UNDECLARED, not forbidden — a different thing.
	//
	// What the precondition discipline actually forbids is "an event for a change THAT DID NOT HAPPEN". Adding a
	// capability IS a change. So the guard now refuses only the genuinely null authorization, and the case the
	// sponsor's own N-18 correction was about — a two- or three-approver chain — works.
	describe('N-22 narrowed — a partial grant may be built up, but not re-recorded unchanged', () => {
		it('THE PLATFORM CASE: three approvers each add a capability, reaching AUTHORIZED', () => {
			ok(request('file-system', 'network', 'secrets'), 'request three');
			ok(authorize('file-system'), 'approver 1 grants file-system');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			expect(grantedOf().sort()).toEqual(['file-system']);
			ok(authorize('file-system', 'network'), 'approver 2 ADDS network — same status, real change');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
			expect(grantedOf().sort()).toEqual(['file-system', 'network']);
			ok(authorize('file-system', 'network', 'secrets'), 'approver 3 completes the request');
			expect(statusOf()).toBe('AUTHORIZED');
		});
		it('…and every step of that chain is recorded, so the audit trail shows WHO added WHAT', () => {
			// The reason the intermediate step must be recordable rather than merely permitted: a multi-party
			// authorization whose middle act leaves no event is a chain no auditor can reconstruct.
			ok(request('file-system', 'network', 'secrets'), 'request three');
			ok(authorize('file-system'), 'first');
			ok(authorize('file-system', 'network'), 'second');
			const grants = store
				.readAllEvents()
				.filter((e) => e.eventType === 'RuntimeBindingAuthorized')
				.map((e) => (e.payload as { grantedCapabilities?: { capability: string }[] }).grantedCapabilities?.length);
			expect(grants).toEqual([1, 2]);
		});
		it('THE GUARD SURVIVES THE NARROWING: an authorization adding nothing is still refused', () => {
			ok(request('file-system', 'network'), 'request two');
			ok(authorize('file-system'), 'partial');
			const before = store.readAllEvents().length;
			const r = authorize('file-system');
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('grants nothing the binding does not already have');
			expect(store.readAllEvents().length, 'appended an event for a non-change').toBe(before);
		});
		it('the FIRST authorization may still deliberately grant nothing — N-18’s ruled case is untouched', () => {
			// `added.length === 0` alone would have refused this. Both conditions are load-bearing: this transition
			// REQUESTED -> PARTIALLY_AUTHORIZED changes the status, and the sponsor ruled that "reviewed, granted
			// nothing, still live" must stay recordable.
			ok(request('file-system'), 'request one');
			ok(authorize(), 'a review that conferred nothing');
			expect(statusOf()).toBe('PARTIALLY_AUTHORIZED');
		});
	});
});

// ── N-18 (SPONSOR RULING 2026-07-26, option C) + N-22, DRIVEN THROUGH THE BUS ───────────────────────────────────
//
// THE RULING. A binding may sit in an executable STATUS while granting NOTHING. The sponsor's correction is what
// settled it: my argument that such a state "has no consumer in this engine" was engine-local reasoning about a
// plane of a product that will have multi-party authorization, tenants, delegation and human auditors. "Reviewed,
// granted nothing, still live" is a first-class position — distinct from REQUESTED (nobody looked) and from DENIED
// (refused, and TERMINAL, which is why refusing the empty grant would have destroyed the binding outright).
//
// So the STATE is right and the PREDICATE was wrong. `NOTHING_GRANTED` is its own limb — not RPH-EXE-003's, which
// is about status — and it runs LAST, so a DENIED binding still reports DENIED rather than "grants nothing".
describe('N-18 — a binding that confers nothing does not authorize a start', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69HB500';
	const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69HB510';
	const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69HB520';
	const BIND = 'bind_01ARZ3NDEKTSV4RRFFQ69HB530';
	const STEP1 = `${PLAN}-s1`;

	function send(commandType: string, payload: unknown, id: string, aggType: string) {
		const n = ++seq;
		return engine.dispatch({
			commandId: `n18-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'n18',
			idempotencyKey: `n18k-${n}`,
			payload
		} as DomainCommand);
	}
	const accept = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	/** An ACTIVE one-step plan whose step names BIND, with BIND requesting `caps` and granted `granted`. */
	function arrange(caps: string[], granted: string[]) {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `n18e${++seq}` });
		send('CaptureIntent', { intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' }, INTENT, 'INTENT');
		send('ProposePwu', {
			pwuId: PWU, pwuKind: 'ARCHITECTURE', title: 'Arch', description: 'd', intentId: INTENT,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [], constraintIds: [], assumptionIds: [], expectedOutputs: [], assurancePolicyIds: [],
			riskProfile: { consequence: 'MEDIUM', uncertainty: 'MEDIUM', irreversibility: 'LOW', securitySensitivity: 'LOW', regulatoryExposure: 'NONE' }
		}, PWU, 'PROFESSIONAL_WORK_UNIT');
		accept(send('RequestRuntimeBinding', {
			runtimeBindingId: BIND, executionStepId: STEP1, roleId: 'role-architect',
			requestedCapabilities: caps.map(cap)
		}, BIND, 'RUNTIME_BINDING'), 'request');
		accept(send('AuthorizeRuntimeBinding', { grantedCapabilities: granted.map(cap) }, BIND, 'RUNTIME_BINDING'), 'authorize');
		accept(send('ProposeExecutionPlan', {
			executionPlanId: PLAN, workUnitId: PWU,
			steps: [{ id: STEP1, executionPlanId: PLAN, stepType: 'MODEL_INVOCATION', purpose: 'w', inputBindings: [], outputBindings: [], runtimeBindingId: BIND, preconditions: [], postconditions: [], stepState: 'QUEUED' }],
			transitions: [], retryPolicy: { maxAttempts: 5 }, tacticalChangePolicy: {}, escalationPolicy: {}, terminationPolicy: {}
		}, PLAN, 'EXECUTION_PLAN'), 'propose');
		accept(send('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN'), 'approve');
		accept(send('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN'), 'activate');
	}

	const start = () => send('StartExecutionStep', { stepId: STEP1 }, PLAN, 'EXECUTION_PLAN');
	const stepState = () =>
		(store.loadObject(PLAN)!.state as { steps: { id: string; stepState: string }[] }).steps[0]!.stepState;

	it('THE KILL TEST: a PARTIALLY_AUTHORIZED binding granting NOTHING refuses the start', () => {
		arrange(['file-system'], []);
		const r = start();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('confers NO capability');
		// …and demonstrably NOT the status limb: the status is executable, which is the whole point of the ruling.
		expect(r.error?.message).not.toContain(
			'a step may only execute against an AUTHORIZED or PARTIALLY_AUTHORIZED binding'
		);
		expect(stepState()).toBe('QUEUED');
	});

	it('names a remedy the engine can PERFORM — and the remedy really clears it', () => {
		// The whole reason option (C) is safe where (B) was not: PARTIALLY_AUTHORIZED can be re-authorized, so the
		// refusal is curative on the SAME aggregate. This drives the cure rather than asserting it.
		arrange(['file-system'], []);
		expect(start().error?.message).toContain('may be expanded');
		accept(send('AuthorizeRuntimeBinding', { grantedCapabilities: [cap('file-system')] }, BIND, 'RUNTIME_BINDING'), 'expand');
		accept(start(), 'start after the grant');
		expect(stepState()).toBe('RUNNING');
	});

	it('THE OVER-REFUSAL HALF: a binding granting something still starts', () => {
		arrange(['file-system', 'network'], ['file-system']);
		accept(start(), 'a partial grant that confers something is executable');
		expect(stepState()).toBe('RUNNING');
	});

	it('N-22: a further authorization that changes nothing is refused, not recorded', () => {
		// The hole JAN-PARTAUTH opened: with the target DERIVED, PARTIALLY_AUTHORIZED -> PARTIALLY_AUTHORIZED became
		// reachable, and checkTransition admits from === to as a NOOP — so an identical re-authorization would append
		// an event for a change that did not happen.
		//
		// THE ASSERTION WAS NARROWED WITH THE GUARD. It used to demand the message "declares no
		// PARTIALLY_AUTHORIZED -> PARTIALLY_AUTHORIZED arrow", which was the over-broad reasoning: a same-state
		// transition is UNDECLARED here, not forbidden, and this codebase already runs two of them. The defect is
		// that nothing CHANGED, which is what the message and this assertion now say.
		arrange(['file-system', 'network'], ['file-system']);
		const before = store.readAllEvents().length;
		const r = send('AuthorizeRuntimeBinding', { grantedCapabilities: [cap('file-system')] }, BIND, 'RUNTIME_BINDING');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('grants nothing the binding does not already have');
		expect(store.readAllEvents().length, 'appended an event for a non-change').toBe(before);
	});

	it('…and a further authorization that COMPLETES the request is still accepted', () => {
		// N-22's over-refusal half: the forward arrow the machine does declare must stay open.
		arrange(['file-system', 'network'], ['file-system']);
		accept(send('AuthorizeRuntimeBinding', { grantedCapabilities: [cap('file-system'), cap('network')] }, BIND, 'RUNTIME_BINDING'), 'complete');
		expect((store.loadObject(BIND)!.state as { authorizationStatus: string }).authorizationStatus).toBe('AUTHORIZED');
	});
});
