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

		it('a vacuous request is fully AUTHORIZED — nothing was asked, so nothing is outstanding', () => {
			ok(request(), 'request nothing');
			ok(authorize(), 'grant nothing');
			expect(statusOf()).toBe('AUTHORIZED');
		});

		it('N-18, DISCLOSED: an empty grant against a real request is PARTIALLY_AUTHORIZED, not refused', () => {
			// Recorded rather than decided. Refusing this and directing the authorizer to DenyRuntimeBinding is an
			// INFERENCE the corpus does not make, and JAN-CAPBIND's withdrawn `scope` field is the standing lesson
			// about acting on one. The consequence is stated so it is not discovered later: `bindingPermitsExecution`
			// PERMITS execution against this binding, which grants nothing.
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
});
