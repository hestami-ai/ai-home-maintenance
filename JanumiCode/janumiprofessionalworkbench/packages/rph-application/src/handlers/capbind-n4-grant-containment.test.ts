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
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00.000Z';
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69GW1B0';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69GW1S0';
const actor: ActorReference = { actorType: 'HUMAN', actorId: 'usr_1', displayName: 'Sponsor' };

describe('WP-2 / N-4 — AuthorizeRuntimeBinding refuses a grant exceeding its request', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
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
			issuedBy: actor,
			correlationId: 'capbind-n4',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

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
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	it('THE KILL TEST: a FIRST authorization granting an unrequested capability is REFUSED', () => {
		// The binding asked for file-system only. Granting shell.exec alongside it is privilege expansion performed
		// inside someone else's authorization — no new request, no separate decision, and (before this guard) no
		// refusal. This is the first authorization from REQUESTED, so `fromStates` permits it and only the
		// containment guard can refuse.
		request(['file-system']);
		const r = authorize(['file-system', 'shell.exec']);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH_CAPABILITY_NOT_REQUESTED');
		expect(r.error?.message, 'the refusal must NAME the offending capability').toContain(
			'shell.exec'
		);
	});

	it('leaves the granted set UNTOUCHED when it refuses — no partial write', () => {
		// A refusal that had already mutated would confer the excess capability while reporting failure, which is
		// worse than admitting it outright: the audit trail would say REJECTED and the state would say granted.
		request(['file-system']);
		authorize(['file-system', 'shell.exec']);
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

	it('CONTROL: the empty-request / empty-grant case stays ACCEPTED — three live dispatches rely on it', () => {
		// `command-reissue-guard.test.ts` and `execution-detail.test.ts` both authorize with `grantedCapabilities: []`
		// against a binding requesting []. Breaking that would be a regression dressed as an enforcement.
		request([]);
		expect(authorize([]).status).toBe('ACCEPTED');
	});

	it('refuses when the binding requested NOTHING and the grant names something', () => {
		// The sharpest form of the defect: a binding that asked for no capability at all being handed one.
		request([]);
		const r = authorize(['network']);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('network');
	});

	it('names EVERY unrequested capability, not just the first', () => {
		// An operator repairing this needs the whole excess set; reporting one at a time turns one fix into three.
		request(['file-system']);
		const r = authorize(['file-system', 'network', 'shell.exec']);
		expect(r.error?.message).toContain('network');
		expect(r.error?.message).toContain('shell.exec');
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
			issuedBy: actor,
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
			issuedBy: actor,
			correlationId: 'capbind-n4',
			idempotencyKey: `k-${m}`,
			payload: { grantedCapabilities: [{ capability: 'file-system' }, { capability: 'network' }] }
		});
		expect(authorized.status, authorized.error?.message).toBe('ACCEPTED');
	});
});
