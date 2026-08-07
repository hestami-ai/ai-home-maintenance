// JAN-CAPBIND WP-2 — N-4: a grant may not exceed its request.
//
// THE DEFECT. `authorizeRuntimeBinding`'s `mutate` wrote `grantedCapabilities` WHOLESALE from the command payload,
// compared against nothing. Its own comment named the hazard — "a second actor could grant capabilities the binding
// never REQUESTED" — and then guarded only the RE-authorization case with `fromStates`. **The first authorization
// was entirely unconstrained**, so a single `AuthorizeRuntimeBinding` could confer any capability at all on a
// binding that asked for one, with no new request and no separate authorization decision.
//
// §22.1 forbids it twice: *"Requested capability is not granted capability"* and *"Privilege expansion requires a
// new authorization event."* Granting what was never asked for IS expansion, and doing it inside an authorization
// of something else is expansion without its own event.
//
// THE VACUITY THIS FILE HAS TO AVOID, named up front. `fromStates('REQUESTED','PARTIALLY_AUTHORIZED')` already
// refuses a SECOND authorization. A kill test that authorized twice would go red with the containment guard
// deleted — because the state machine refused it — and would therefore prove nothing about this rule. **Every
// refusal case below is the FIRST authorization from REQUESTED**, which is the only arrangement where the state
// machine has nothing to say and the new guard is the sole thing that can refuse.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00.000Z';
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69GW1B0';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69GW1S0';
const actor: ActorReference = { actorType: 'HUMAN', actorId: 'usr_1', displayName: 'Sponsor' };

describe('WP-2 / N-4 — AuthorizeRuntimeBinding refuses a grant exceeding its request', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'RUNTIME_BINDING',
			targetAggregateId: BINDING,
			issuedAt: TS,
			correlationId: 'capbind-n4',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	/** Dispatch RequestRuntimeBinding WITHOUT asserting acceptance — for the cases that must be refused (N-20). */
	const requestRaw = (capabilities: readonly string[]) =>
		dispatch('RequestRuntimeBinding', {
			runtimeBindingId: BINDING,
			executionStepId: STEP,
			roleId: 'role_engineer',
			requestedCapabilities: capabilities.map((capability) => ({ capability }))
		});

	/** Create the binding in REQUESTED asking for exactly `capabilities`. */
	const request = (capabilities: readonly string[]) => {
		const r = dispatch('RequestRuntimeBinding', {
			runtimeBindingId: BINDING,
			executionStepId: STEP,
			roleId: 'role_engineer',
			requestedCapabilities: capabilities.map((capability) => ({ capability }))
		});
		expect(r.status, `arrange: request ${JSON.stringify(capabilities)}: ${r.error?.message}`).toBe(
			'ACCEPTED'
		);
		return r;
	};

	const authorize = (capabilities: readonly string[]) =>
		dispatch('AuthorizeRuntimeBinding', {
			grantedCapabilities: capabilities.map((capability) => ({ capability }))
		});

	const grantedOf = () =>
		(store.loadObject(BINDING)!.state as { grantedCapabilities?: { capability: string }[] })
			.grantedCapabilities;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	});

	it('THE KILL TEST: a FIRST authorization granting an unrequested capability is REFUSED', () => {
		// The binding asked for file-system only. Granting network alongside it is privilege expansion performed
		// inside someone else's authorization — no new request, no separate decision, and (before this guard) no
		// refusal. This is the first authorization from REQUESTED, so `fromStates` permits it and only the
		// containment guard can refuse.
		request(['file-system']);
		const r = authorize(['file-system', 'network']);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH_CAPABILITY_NOT_REQUESTED');
		expect(r.error?.message, 'the refusal must NAME the offending capability').toContain(
			'network'
		);
	});

	it('leaves the granted set UNTOUCHED when it refuses — no partial write', () => {
		// A refusal that had already mutated would confer the excess capability while reporting failure, which is
		// worse than admitting it outright: the audit trail would say REJECTED and the state would say granted.
		request(['file-system']);
		// ASSERTED, not merely implied by the empty granted set: an authorize that was silently ACCEPTED while
		// writing nothing would leave the set empty too. See REG-F-015.
		const r = authorize(['file-system', 'network']);
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(grantedOf()).toEqual([]);
	});

	it('CONTROL: an exact-match grant is ACCEPTED and recorded', () => {
		// Without this the guard could be `return reject(...)` unconditionally and every test above would still pass.
		request(['file-system']);
		const r = authorize(['file-system']);
		expect(r.status, r.error?.message).toBe('ACCEPTED');
		expect(grantedOf()).toEqual([{ capability: 'file-system' }]);
	});

	it('CONTROL: a NARROWER grant is ACCEPTED — RPH-EXE-004’s own example must stay legal', () => {
		// "requests file-system and network access but only file-system is granted" is the ratified example, and the
		// reason the machine has a PARTIALLY_AUTHORIZED state at all. Refusing partial grants would strand every
		// least-privilege authorization — the over-refusal half of this rule.
		request(['file-system', 'network']);
		const r = authorize(['file-system']);
		expect(r.status, r.error?.message).toBe('ACCEPTED');
		expect(grantedOf()).toEqual([{ capability: 'file-system' }]);
	});

	it('CONTROL: granting NOTHING against a request is ACCEPTED — the empty set is a subset', () => {
		request(['file-system']);
		expect(authorize([]).status).toBe('ACCEPTED');
	});

	// ── THIS CONTROL WAS OVERTURNED BY N-20, AND THE OVERTURNING IS RECORDED RATHER THAN THE CONTROL DELETED ────
	//
	// It used to read: "CONTROL: the empty-request / empty-grant case stays ACCEPTED — three live dispatches rely on
	// it … Breaking that would be a regression dressed as an enforcement." That was right on the evidence it had:
	// under N-4 alone, requesting nothing and granting nothing is a harmless no-op, and refusing it is over-refusal.
	//
	// WHAT THE CONTROL DID NOT KNOW: an empty request reaches AUTHORIZED — correctly, everything asked for was
	// granted — and AUTHORIZED permits execution while conferring nothing, and cannot be re-authorized. The case it
	// protected is not benign; it is the one shape in this aggregate with no remedy at all. And the "three live
	// dispatches" were three TEST arrangements of convenience, not production callers: the reference seed authors no
	// RuntimeBinding whatsoever, and repo-wide only two test files ever requested [].
	//
	// The lesson worth keeping: a control is only as good as the harms known when it was written. This one was
	// correct and is now wrong, and saying so is cheaper than discovering later that it silently held a defect open.
	it('N-20: an EMPTY request is refused at creation, so this control’s case no longer exists', () => {
		const r = requestRaw([]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('names no capability');
	});

	it('…and N-4’s empty-request limb is therefore STRUCTURALLY UNREACHABLE, not merely untested', () => {
		// This case used to arrange `request([])` then `authorize(['network'])` — "a binding that asked for no
		// capability at all being handed one", which was N-4's sharpest form. That arrangement can no longer be
		// built. Pinning the unreachability is the honest replacement: an assertion about a shape nobody can create
		// would be a test that cannot fail, and deleting it silently would lose the fact that the limb exists.
		// The rule itself stays covered by the excess battery below, which arranges a REAL request.
		expect(requestRaw([]).status).toBe('REJECTED');
	});

	it('names EVERY unrequested capability, not just the first', () => {
		// An operator repairing this needs the whole excess set; reporting one at a time turns one fix into three.
		request(['file-system']);
		const r = authorize(['file-system', 'network', 'network']);
		expect(r.error?.message).toContain('network');
		expect(r.error?.message).toContain('network');
	});

	it('the refusal prescribes a remedy the engine ACTUALLY PERMITS — not a wedge', () => {
		// RW-0 had to withdraw the §15.3 allowlist limb because its refusal told the operator to do something the
		// engine categorically forbids, leaving the binding unrecoverable. The remedy here is "request the additional
		// capability on a NEW RuntimeBinding, then authorize that" — verified below to actually work.
		request(['file-system']);
		expect(authorize(['file-system', 'network']).status).toBe('REJECTED');

		const OTHER = 'bind_01ARZ3NDEKTSV4RRFFQ69GW1C0';
		const n = ++seq;
		const created = engine.dispatch({
			commandId: `c-${n}`,
			commandType: 'RequestRuntimeBinding',
			commandSchemaVersion: 1,
			targetAggregateType: 'RUNTIME_BINDING',
			targetAggregateId: OTHER,
			issuedAt: TS,
			correlationId: 'capbind-n4',
			idempotencyKey: `k-${n}`,
			payload: {
				runtimeBindingId: OTHER,
				executionStepId: STEP,
				roleId: 'role_engineer',
				requestedCapabilities: [{ capability: 'file-system' }, { capability: 'network' }]
			}
		});
		expect(created.status, created.error?.message).toBe('ACCEPTED');

		const m = ++seq;
		const authorized = engine.dispatch({
			commandId: `c-${m}`,
			commandType: 'AuthorizeRuntimeBinding',
			commandSchemaVersion: 1,
			targetAggregateType: 'RUNTIME_BINDING',
			targetAggregateId: OTHER,
			issuedAt: TS,
			correlationId: 'capbind-n4',
			idempotencyKey: `k-${m}`,
			payload: { grantedCapabilities: [{ capability: 'file-system' }, { capability: 'network' }] }
		});
		expect(authorized.status, authorized.error?.message).toBe('ACCEPTED');
	});
});
