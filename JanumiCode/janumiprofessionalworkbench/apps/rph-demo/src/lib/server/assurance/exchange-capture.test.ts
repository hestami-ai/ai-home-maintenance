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
			prompt: 'JUDGE THIS GRAPH',
			rawOutput: '{"recommendation":"SATISFIED"}',
			disposition: 'accepted'
		});

		// THE MUTANT: leave the ref PENDING_CONTENT_PLANE. That was correct while no store existed; with one, it
		// would be a record claiming its bytes are unretainable when they are sitting in the store.
		expect(rec.materializedInputRef.status).toBe('STORED');
		expect(rec.rawOutputBeforeCoercionRef.status).toBe('STORED');
		expect(sink.drain()).toHaveLength(1);
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
		expect(second.rawOutputBeforeCoercionRef.storageKey).not.toBe(
			first.rawOutputBeforeCoercionRef.storageKey
		);
		expect(await store.get(first.rawOutputBeforeCoercionRef.storageKey ?? '')).toBe(
			'MALFORMED-FIRST-ANSWER'
		);
		// CSAA-007 states the rule: "Repair never rewrites predecessor raw output."
		expect(await store.get(second.rawOutputBeforeCoercionRef.storageKey ?? '')).toBe('{"ok":true}');
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
			prompt: 'P',
			rawOutput: 'r',
			disposition: 'accepted'
		});
		expect(rec.materializedInputRef.status).toBe('PENDING_CONTENT_PLANE');
	});
});
