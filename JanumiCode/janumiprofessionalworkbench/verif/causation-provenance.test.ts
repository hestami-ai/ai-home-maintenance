// PER-9: A DERIVED ACT SHALL SAY WHAT CAUSED IT — and an originating act shall not pretend to have a cause.
//
// THE RATIFIED OBLIGATION IS CANON, AND IT IS NOT THE ONE USUALLY CITED. JPWB-DOC-003 §9 PER-9: "Every material
// act in the stream retains identity, scope, actor and provenance, CORRELATION AND CAUSATION, exact
// input/subject/context/policy/evidence/output references…". PER-2 adds that every material semantic change
// produces an event "preserving prior values, actor, rationale, timestamp, and CAUSAL RELATIONSHIPS".
// DOC-003's `doesNotGovern` cedes exact shapes to the repository, so canon obliges the RETENTION and the
// repository chooses the field. The sentence people quote for `causationId`'s meaning lives in RPH-DOC-007,
// which CON-000 B1 makes historical material (REG-F-049) — the FIELD is authoritative as repository shape, the
// SENTENCE is not, and this file rests on PER-9 rather than on it.
//
// WHY THE RULE IS TWO-SIDED. `causationId` earns its keep only by being ABSENT on acts a person issued. If every
// event carried one, the field would duplicate `commandId` (already 446/446) and mark nothing. So this file
// asserts BOTH directions: a synthesized act carries its cause, and an issued act does not acquire a fabricated
// one. The second assertion is what stops a future "just populate it everywhere" from passing.
//
// WHAT THIS IS FOR. REG-E-030 ruled that a cascade is attributed to the actor whose act triggered it. Without
// causation, the governed record would say a human performed an act they did not. With it, the two axes are
// distinct: `issuedBy` is WHO IT IS ATTRIBUTED TO, `causationId` is WHAT CAUSED IT.

import { createEngine, seedWorkbench } from '@janumipwb/rph-engine';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';

const TS = '2026-08-07T00:00:00Z';

/** Drive the shipped seed and return its committed events. */
function drive() {
	let n = 0;
	const store = new SqliteStorageAdapter({ now: () => TS });
	seedWorkbench(createEngine({ authenticate: testAuthenticator(), ontology, store, now: () => TS, newEventId: () => `evt_${++n}` }).as(TEST_CRED.human));
	return store.readAllEvents() as unknown as {
		eventType: string;
		commandId?: string;
		causationId?: string;
		correlationId?: string;
	}[];
}

describe('PER-9 — causation is retained on derived acts and absent on issued ones', () => {
	// THE SYNTHESIZED-COMMAND MARKER. `bumpPwaSemanticVersion` is the only act in the engine that no caller
	// issues, and it derives its id as `<originating>#pwa-version`. That suffix is load-bearing elsewhere too:
	// `idempotency-key-reuse.test.ts` proves the receipt table's primary key depends on it.
	const DERIVED_SUFFIX = '#pwa-version';

	it('every synthesized command records the act that caused it', () => {
		const events = drive();
		const derived = events.filter((e) => (e.commandId ?? '').includes(DERIVED_SUFFIX));

		// ── THE CONTROL FOR THE CENSUS ITSELF ────────────────────────────────────────────────────────────────
		// REG-F-015's anatomy: a census over an empty population asserts nothing and reports green. If the seed
		// ever stops producing derived commands, THIS is the line that fails rather than the assertion below
		// silently passing over zero rows.
		expect(derived.length, 'no derived acts in the drive — the census below would be vacuous').toBeGreaterThan(
			0
		);

		const uncaused = derived.filter((e) => !e.causationId);
		expect(
			uncaused.map((e) => `${e.eventType}/${e.commandId}`),
			'a derived act with no recorded cause is an event whose actor did not perform it and whose reason ' +
				'the record does not hold (PER-9)'
		).toEqual([]);

		// And the cause must be the ORIGINATING command, not the derived one naming itself.
		for (const e of derived)
			expect(e.causationId, `${e.commandId} must name its originator, not itself`).toBe(
				(e.commandId ?? '').replace(DERIVED_SUFFIX, '')
			);
	});

	// THE OTHER DIRECTION, and the reason the field means anything. MUTANT: set `causationId` unconditionally in
	// `makeEvent` (the naive implementation this repository's own design record first proposed) -> this reddens
	// and the test above stays green.
	it('an act a caller ISSUED acquires no fabricated cause', () => {
		const events = drive();
		const issued = events.filter((e) => !(e.commandId ?? '').includes(DERIVED_SUFFIX));
		expect(issued.length, 'control: the drive must contain issued acts too').toBeGreaterThan(100);

		const fabricated = issued.filter((e) => e.causationId !== undefined);
		expect(
			fabricated.map((e) => `${e.eventType}/${e.commandId}`),
			'causation marks a DERIVED act; populating it on an issued one duplicates `commandId` and marks nothing'
		).toEqual([]);
	});

	// CORRELATION IS A SEPARATE AXIS AND MUST NOT BE CONFLATED. JPWB-SPEC-001 §11.4.25 (ratified) cuts against
	// naive inheritance: a shared correlation id "SHALL be per-batch, never per-process", and "a constant
	// correlation id retains the FIELD and not the CORRELATION". A derived act belongs to the SAME professional
	// operation as its originator, so sharing here is the per-act case that clause permits — pinned so that a
	// future change cannot quietly widen it into a per-process constant.
	it('a derived act stays inside its originator’s correlation, and correlation is never empty', () => {
		const events = drive();
		expect(events.every((e) => (e.correlationId ?? '') !== '')).toBe(true);
		const derived = events.filter((e) => (e.commandId ?? '').includes(DERIVED_SUFFIX));
		const distinct = new Set(events.map((e) => e.correlationId));
		expect(derived.length).toBeGreaterThan(0);
		expect(
			distinct.size,
			'more than one correlation id exists, so correlation is not a per-process constant (SPEC-001 §11.4.25)'
		).toBeGreaterThan(1);
	});
});
