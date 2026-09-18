// ⭐⭐ ONE ATOMIC ACT, TWO ACTING PARTIES — `JAN-EXEC` `R23`, design §4.16.
//
// ── ⛔ WHY THIS EXISTS: TWO RATIFIED RULES THAT COULD NOT BOTH HOLD ───────────────────────────────────────────
//
// `SPEC-001-INV-14` / FORK-23 (b): *"a multi-Command Affordance is ATOMIC where an atomic dispatch exists, and a
// partially-applied sequence SHALL NOT leave committed state behind."*
// DOC-004 §39 invariant 8: an assessment may not be satisfied unless its evaluator is independent of the
// producer.
//
// `dispatchBatchAs` wraps its loop in ONE `store.transaction()` and stamps EVERY command from ONE principal, so
// an affordance needing both parties had to break one of the two rules. ⚠ Nothing had to notice, because the
// only such affordance in this product was reviewing its own work (`REG-F-400`) — the conflict became reachable
// the moment that was fixed, and it showed up as **3 orphan assessments** behind a refused affordance.
//
// ⭑ AND IT IS THE GENERAL FORM. A governance Decision proposed by one party and approved by another, a waiver
// granted beside the work it waives: none of those can be atomic without this.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { TEST_CRED, UNKNOWN_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const TS = '2026-09-18T00:00:00Z';

describe('⭐ dispatchMultiPartyBatch — all-or-nothing ACROSS parties', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	/** `CaptureIntent` is the cheapest real creation in the product: one command, one aggregate, no prior state.
	 *  The rule under test is about the ENVELOPE, so a fixture that needed a lifecycle would be measuring the
	 *  lifecycle. */
	const capture = (id: string): DomainCommand => {
		seq += 1;
		return {
			commandId: `c-${seq}`,
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${seq}`,
			payload: {
				intentId: id,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			}
		};
	};

	/** A command that the engine REFUSES — an unknown command type. The refusal must be the ENVELOPE's business,
	 *  not a particular guard's, so the cheapest refusal is the honest fixture here. */
	const refused = (): DomainCommand => {
		seq += 1;
		return {
			commandId: `c-${seq}`,
			commandType: 'ThisCommandDoesNotExist',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: 'int_01ARZ3NDEKTSV4RRFFQ69GMP99',
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${seq}`,
			payload: {}
		};
	};

	const A = 'int_01ARZ3NDEKTSV4RRFFQ69GMP01';
	const B = 'int_01ARZ3NDEKTSV4RRFFQ69GMP02';

	const issuerOf = (id: string) =>
		(store.loadObject(id)?.state as { createdBy?: { actorId?: string } } | undefined)?.createdBy
			?.actorId;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		});
	});

	// ── `PR-8` — the property with NO other detector ──────────────────────────────────────────────────────────
	it('⭐⭐ each command is stamped from the principal of the credential THAT ENTRY carried', () => {
		// ⛔ THIS IS THE ONE THAT FAILS SILENTLY AND THE ONLY INSTRUMENT FOR IT IS THIS ASSERTION. Independence is
		// computed from `producer` / `evaluator` IN THE PAYLOAD and never from the issuer — so a batch that
		// stamped every command from the composing session would satisfy §39 inv-8, satisfy `SPEC-001-INV-14`,
		// and write a record saying one party did both halves. That is the forgery `R22` forbids, reached from
		// underneath it.
		const batch = engine.as(TEST_CRED.human).dispatchMultiPartyBatch([
			{ command: capture(A) },
			{ command: capture(B), as: TEST_CRED.reviewer }
		]);
		expect(batch.ok, JSON.stringify(batch.results.at(-1)?.error)).toBe(true);
		expect(issuerOf(A), 'no `as` means the COMPOSING session — u1, the operator').toBe('u1');
		expect(issuerOf(B), 'the reviewer’s entry must be stamped from the REVIEWER').toBe('user-2');
	});

	// ── `PR-7` — the rule the orphan assessments broke ────────────────────────────────────────────────────────
	it('⛔ a refusal in ONE party’s command rolls back EVERY party’s work', () => {
		// The shape that produced 3 orphan assessments: the reviewer's acts committed, then the controller's were
		// refused. `SPEC-001-INV-14` — *"a partially-applied sequence SHALL NOT leave committed state behind."*
		const batch = engine
			.as(TEST_CRED.human)
			.dispatchMultiPartyBatch([
				{ command: capture(A), as: TEST_CRED.reviewer },
				{ command: refused() }
			]);
		expect(batch.ok).toBe(false);
		expect(batch.failedIndex).toBe(1);
		expect(store.loadObject(A), 'the other party’s command must not survive the refusal').toBeUndefined();
		expect(store.readAllEvents(), 'a refused multi-party batch appends NO event').toHaveLength(0);
	});

	// ── `PR-9` ───────────────────────────────────────────────────────────────────────────────────────────────
	it('⛔ an unresolvable credential refuses ITS entry and aborts — it never inherits a neighbour’s identity', () => {
		// ⚠ THE TEMPTING IMPLEMENTATION IS THE DANGEROUS ONE: falling back to the composing session would make an
		// unknown credential act as the operator, silently. §13.3 — *"Fail closed on missing identity, tenant,
		// POLICY, schema, or authority context"* — and `actingActor()` THROWS rather than substitute for exactly
		// this reason.
		const batch = engine
			.as(TEST_CRED.human)
			.dispatchMultiPartyBatch([{ command: capture(A), as: UNKNOWN_CRED }, { command: capture(B) }]);
		expect(batch.ok).toBe(false);
		expect(batch.failedIndex, 'the FIRST entry is the one that fails').toBe(0);
		expect(batch.results[0]?.error?.code).toBe('RPH_AUTHENTICATION_REQUIRED');
		expect(store.loadObject(A)).toBeUndefined();
		expect(store.loadObject(B)).toBeUndefined();
	});

	// ── `C-4` ────────────────────────────────────────────────────────────────────────────────────────────────
	it('⭑ CONTROL — an all-accepted multi-party batch commits IN FULL', () => {
		// Without this, an implementation that committed NOTHING would satisfy `PR-7` and `PR-9` perfectly. The
		// atomicity spec's own control makes the same argument: *"the reason the fix cannot be 'make runSteps
		// commit nothing ever'."*
		const batch = engine
			.as(TEST_CRED.human)
			.dispatchMultiPartyBatch([
				{ command: capture(A) },
				{ command: capture(B), as: TEST_CRED.reviewer }
			]);
		expect(batch.ok).toBe(true);
		expect(store.loadObject(A)).toBeDefined();
		expect(store.loadObject(B)).toBeDefined();
		expect(store.readAllEvents().length).toBeGreaterThanOrEqual(2);
	});

	// ── `C-5` ────────────────────────────────────────────────────────────────────────────────────────────────
	it('⭑ CONTROL — an entry with NO `as` is the composing session, so a single-party batch is unchanged', () => {
		// The migration property: `dispatchMultiPartyBatch` with no `as` anywhere must mean exactly what
		// `dispatchBatch` meant, or every existing caller changes meaning on adoption.
		const batch = engine
			.as(TEST_CRED.reviewer)
			.dispatchMultiPartyBatch([{ command: capture(A) }, { command: capture(B) }]);
		expect(batch.ok).toBe(true);
		expect(issuerOf(A)).toBe('user-2');
		expect(issuerOf(B)).toBe('user-2');
	});
});
