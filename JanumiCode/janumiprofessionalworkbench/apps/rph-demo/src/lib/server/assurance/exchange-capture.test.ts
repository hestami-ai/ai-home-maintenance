// ICP-02 d2b — one PER-9 exchange record per bounded try, with the content actually retained.
//
// The Reasoning Review runs up to FOUR bounded tries per authoring turn (the floor runs twice — `+server.ts:127`
// and the auto-refine pass at `:153` — and each run can call the model twice, at
// `reasoning-review-validator.ts:176` and `:181`). Today that produces ZERO records. Findings #24, #25, #62.
//
// REG-D-050 settles the retention question the sponsor answered: "the governed stream is fully auditable and
// reconstructable", so a materialized assurance input PARTICIPATES and is RETAINED_BY_PARTICIPATION — purging it
// would make the Assessment's conclusion unreproducible, which is PER-8's stated WHY ("a record with holes cannot
// answer who decided what on what basis").
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { captureTry, createExchangeSink } from './exchange-capture.js';

const MODEL = { modelId: 'gemini-2.5-pro', providerId: 'google' };
const TENANT = 'tnt-test';

// The per-try facts PER-9 requires and only the caller can know: where this try sits in its run, and the
// occurrence times bracketing the model call. They are REQUIRED rather than optional because an absent
// ordinal or an absent time is not "unknown" — it is a record that cannot be ordered or reconciled, which is
// the record-plane omission PER-9 forbids. Fixed values here so the gate is not wall-clock dependent.
const CAPTURE_FACTS = {
	attemptOrdinal: 1,
	requestedAt: '2026-09-03T10:00:00Z',
	respondedAt: '2026-09-03T10:00:01Z',
	// E-5's detail. NOT_ATTEMPTED would assert an outcome nobody observed; these fixtures do parse.
	parseOutcome: { outcome: 'PARSED' as const, detail: 'Fixture: coerced without repair.' }
};

function harness() {
	return { store: createInMemoryArtifactStore(), sink: createExchangeSink() };
}

describe('ICP-02 d2b · exchange capture — one record per bounded try', () => {
	it('records the try, and the materialized input is STORED rather than pending', async () => {
		const { store, sink } = harness();

		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: '{"recommendation":"SATISFIED"}',
			disposition: 'accepted'
		});

		// THE MUTANT: leave the ref PENDING_CONTENT_PLANE. That was correct while no store existed; with one, it
		// would be a record claiming its bytes are unretainable when they are sitting in the store.
		expect(rec.materializedInputRef.status).toBe('STORED');
		expect(sink.drain()).toHaveLength(1);

		// ⛔ E-2 IS BLOCKED ON PURPOSE, AND THE BLOCK IS ASSERTED RATHER THAN ASSUMED. Guide §9.7 requires the
		// spans separated at retention; REG-Q-066 (OPEN, sponsor-reserved) forbids writing this field before
		// its ruling. THE MUTANT: store it anyway, which is what REG-F-330 records having shipped.
		expect(rec.rawOutputBeforeCoercionRef.status).toBe('PENDING_CONTENT_PLANE');

		// ⚠ WAS `toMatch(/REG-Q-066|separat/i)`, AND AN ALTERNATION IS SATISFIED BY EITHER HALF — so a reason
		// that named only the separation, or only the register, passed identically. Both limbs are now asserted
		// separately, which is the only arrangement that can tell them apart.
		expect(rec.rawOutputBeforeCoercionRef.reason).toMatch(/REG-Q-066/);
		expect(rec.rawOutputBeforeCoercionRef.reason).toMatch(/separat/i);

		// ⭑ AND THE REASON MUST NOT CLAIM A TECHNICAL IMPOSSIBILITY THAT NO LONGER EXISTS. It used to say the
		// contract "cannot represent a partly-purgeable blob losslessly" — false, and the load-bearing sentence
		// of a filed blocker (REG-F-336). One STORED OBJECT carries one class; a capture may produce several
		// (DOC-003:89). With `splitAnswerSpan` (REG-F-339) and REG-D-053 the remaining block is PROCEDURAL, and
		// a disclosure that misstates why it is blocked sends the next reader to redesign instead of to ask.
		expect(rec.rawOutputBeforeCoercionRef.reason).not.toMatch(/cannot (represent|express)/i);
		expect(rec.rawOutputBeforeCoercionRef.reason).toMatch(/procedural/i);
	});

	it('the stored bytes are the EXACT prompt — retrievable, not merely referenced', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: 'raw',
			disposition: 'accepted'
		});

		// THE MUTANT: store a hash or an excerpt. PER-9: "the exact materialized input", and "a fingerprint
		// identifies that record; it never substitutes for it" — REG-F-314's error as an executable refusal.
		expect(await store.get(rec.materializedInputRef.storageKey ?? '')).toBe('JUDGE THIS GRAPH');
	});

	it('content is RETAINED_BY_PARTICIPATION and REFUSES to purge — REG-D-050', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: 'raw',
			disposition: 'accepted'
		});

		// THE MUTANT: mark it PURGEABLE_AT_EXPIRY. It is the basis of a recorded professional judgement; purging
		// it makes the Assessment unreproducible, which is exactly what the sponsor's "fully auditable and
		// reconstructable" forecloses and what PER-8 forbids.
		const outcome = await store.purge(rec.materializedInputRef.storageKey ?? '');
		expect(outcome.purged).toBe(false);
		// ⚠ ASSERT THE REASON, NOT JUST THE REFUSAL. purge() also returns {purged:false} for an UNKNOWN key, so a
		// bare false cannot tell "refused because it participated" from "refused because nothing was stored" —
		// and a mutant that left the ref PENDING passed this test for the second reason while breaking the first.
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/PER-8|participat/i);
	});

	it('a REPAIR records a SECOND try whose predecessor survives intact — PER-9-a', async () => {
		const { store, sink } = harness();

		const first = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P1',
			rawOutput: 'MALFORMED-FIRST-ANSWER',
			disposition: 'repair-requested'
		});
		const second = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-2',
			role: 'repair',
			predecessor: first,
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P1 + repair suffix',
			rawOutput: '{"ok":true}',
			disposition: 'accepted'
		});

		expect(sink.drain()).toHaveLength(2);
		expect(second.predecessorExchangeId).toBe('exch-1');

		// ⚠ THE FIRST VERSION OF THIS ASSERTION WAS INERT, AND THE MUTANT PROVED IT. It checked only that the
		// FIRST record's bytes survived — which a mutant repointing the SECOND record's ref never touches, so it
		// passed for a reason unrelated to what it claimed. The defect being guarded is that a repair CLOBBERS
		// its predecessor (`raw = await print(...)` at reasoning-review-validator.ts:180, finding #25), and
		// catching that requires asserting the two records hold DIFFERENT, independently readable content.
		// ⚠ THE GUARANTEE NOW RIDES ON E-1, BECAUSE E-2 IS BLOCKED. A repair sends a DIFFERENT prompt (the
		// original plus a repair suffix), so the two tries have distinct, independently readable inputs — which
		// is the same non-clobbering property, asserted on the content that is lawfully retained.
		expect(second.materializedInputRef.storageKey).not.toBe(first.materializedInputRef.storageKey);
		expect(await store.get(first.materializedInputRef.storageKey ?? '')).toBe('P1');
		expect(await store.get(second.materializedInputRef.storageKey ?? '')).toBe('P1 + repair suffix');
		// CSAA-007's rule — "Repair never rewrites predecessor raw output" — is honoured VACUOUSLY for E-2
		// while it is blocked: there is no retained raw output to rewrite. Recorded so a later reader does not
		// mistake the blocked state for a satisfied one.
		expect(first.rawOutputBeforeCoercionRef.status).toBe('PENDING_CONTENT_PLANE');
	});

	it('the parse outcome is recorded on each try — E-5', async () => {
		const { store, sink } = harness();
		await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: 'bad',
			disposition: 'repair-requested'
		});

		// THE MUTANT: drop the disposition. Finding #62 is precisely that the parse outcome is swallowed by a
		// bare catch and recorded nowhere.
		expect(sink.drain()[0].disposition).toBe('repair-requested');
	});

	it('works with NO store and NO sink — capture is optional wiring, not a hard dependency', async () => {
		// THE MUTANT: require them. The validator is constructed fresh on every floor run with an empty opts
		// object (assurance/index.ts:24), so a hard dependency would break the assurance path outright rather
		// than degrade to today's behaviour.
		const rec = await captureTry({
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: 'r',
			disposition: 'accepted'
		});
		expect(rec.materializedInputRef.status).toBe('PENDING_CONTENT_PLANE');
	});
});

describe('captureTry - a store without a sink is a misconfiguration, not a degraded mode', () => {
	it('REFUSES when bytes would be retained with no record to reference them', async () => {
		// H-1, and it arms on ONE added property. `artifacts` and `exchanges` are independently optional on
		// AgyValidatorOptions, and captureTry early-returns only when NO store is supplied. Supply a store
		// without a sink and `put()` runs unconditionally while the record goes to `input.sink?.record(...)`
		// - optional-chained, so it is silently dropped. The result is retained bytes that no record
		// references, which REG-F-336 C-2 forbids in terms: "content on the content plane with no record on
		// the record plane pointing at it. A half-wire is worse than the disclosed absence it replaces."
		//
		// PREDICTED RED BEFORE THE FIX: this test fails, because the current code silently SUCCEEDS.
		const store = createInMemoryArtifactStore();

		await expect(
			captureTry({
				store,
				// no sink - the whole point
				tenantPrefix: 'tnt-local',
				exchangeId: 'exch-1',
				role: 'initial',
				model: { modelId: 'm', providerId: 'p' },
				...CAPTURE_FACTS,
				prompt: 'PROMPT BYTES',
				rawOutput: '{}',
				disposition: 'accepted'
			})
		).rejects.toThrow(/sink|record plane|orphan/i);
	});

	// ⭑ NO NEW CONTROL IS ADDED, AND THAT IS A FINDING RATHER THAN AN OMISSION.
	// Two were drafted — "a store WITH a sink still captures normally" and "NEITHER store nor sink still
	// degrades" — and BOTH were redundant: the first duplicates the five store-using tests above, the second
	// duplicates "works with NO store and NO sink". DRIVEN: the control mutant (refuse whenever a store is
	// present at all) reddens SIX tests, so the discrimination this guard needs is already in the file. A
	// control that cannot get its own single-victim mutant is noise, which this repository keeps recording.
});

describe('the record discloses the DURABILITY of the content it names - H-2', () => {
	it('a STORED ref carries the content store declared durability', async () => {
		const { store, sink } = harness();
		const rec = await captureTry({
			store,
			sink,
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: '{}',
			disposition: 'accepted'
		});

		// H-2, the INVERSE orphan: this record plane can be durable (SqliteStorageAdapter) while the content
		// plane is not. After one restart the reference names bytes that are gone, and the store answer is
		// indistinguishable from a key never written - so the record still LOOKS intact. That is worse than
		// the plain orphan, which at least leaves nothing pointing anywhere.
		//
		// THE MUTANT: hardcode 'DURABLE', or drop the field. Either way a permanent record silently claims
		// content it cannot produce. PER-9: "record-plane omission is not legal."
		expect(rec.materializedInputRef.contentDurability).toBe('PROCESS_LOCAL');
		// Taken FROM THE STORE, not assumed - so a durable adapter changes this without touching captureTry.
		expect(rec.materializedInputRef.contentDurability).toBe(store.durability);
	});

	it('a PENDING ref classifies nothing, because there are no bytes to classify', async () => {
		const rec = await captureTry({
			tenantPrefix: TENANT,
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL,
			...CAPTURE_FACTS,
			prompt: 'P',
			rawOutput: '{}',
			disposition: 'accepted'
		});

		// Same reasoning the file already applies to `purgeability`: a durability claim about absent bytes
		// asserts a fact about nothing.
		expect(rec.materializedInputRef.status).toBe('PENDING_CONTENT_PLANE');
		expect(rec.materializedInputRef.contentDurability).toBeUndefined();
	});
});
