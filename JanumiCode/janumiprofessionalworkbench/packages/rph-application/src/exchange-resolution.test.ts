// JAN-MXREAD — the record's claim about its bytes, checked for the first time.
//
// Every verdict below has a named mutant, because a verification layer is the easiest kind of code to write as
// ceremony: it reports agreement between two copies of one claim and nothing can ever make it fail.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore, type ArtifactStore } from '@janumipwb/rph-ports';
import {
	readAnswerSpan,
	verifyExchangeContent,
	type ResolvableExchange,
	type ResolvableRef
} from './exchange-resolution.js';

const ANSWER = '{"verdict":"ok"}';
const REASONING = 'Let me think about this first.';

const pending = (reason: string): ResolvableRef => ({ status: 'PENDING_CONTENT_PLANE', reason });

async function store_(): Promise<{
	store: ArtifactStore;
	stored: (bytes: string, p: 'RETAINED_BY_PARTICIPATION' | 'PURGEABLE_AT_EXPIRY') => Promise<ResolvableRef>;
}> {
	const store = createInMemoryArtifactStore();
	const stored = async (bytes: string, purgeability: 'RETAINED_BY_PARTICIPATION' | 'PURGEABLE_AT_EXPIRY') => {
		const ref = await store.put({ tenantPrefix: 'tnt-1', bytes, mediaType: 'text/plain', purgeability });
		return {
			status: 'STORED' as const,
			storageKey: ref.storageKey,
			contentHash: ref.contentHash,
			byteSize: ref.byteSize,
			purgeability,
			contentDurability: store.durability
		};
	};
	return { store, stored };
}

function exchange(over: Partial<ResolvableExchange> = {}): ResolvableExchange {
	return {
		exchangeId: 'mex_1',
		materializedInputRef: pending('no store'),
		rawOutputBeforeCoercionRef: pending('separated at retention per §9.7'),
		answerSpanRef: pending('no store'),
		volunteeredReasoningRef: pending('none arrived'),
		...over
	};
}

describe('MXREAD-01 — verifyExchangeContent', () => {
	it('VERIFIES a ref whose stored bytes hash to what the record claims', async () => {
		const { store, stored } = await store_();
		const report = await verifyExchangeContent(
			exchange({ answerSpanRef: await stored(ANSWER, 'RETAINED_BY_PARTICIPATION') }),
			store
		);
		const answer = report.refs.find((r) => r.field === 'answerSpanRef')!;
		expect(answer.verdict).toBe('VERIFIED');
		expect(report.intact, 'disclosed absences do not make a record un-intact').toBe(true);
	});

	it('⭑ catches bytes that CHANGED under a record that still claims the old hash', async () => {
		// ⭑⭑ THE MUTANT THIS WHOLE MODULE STANDS OR FALLS ON: compare `stat().contentHash` to the record's copy
		// instead of re-hashing the bytes. `stat` returns the hash recorded AT PUT TIME, so that version compares
		// two transcriptions of ONE claim and CANNOT FAIL when the bytes later diverge. It looks exactly like
		// verification and checks nothing. This test is the only thing that tells the two implementations apart.
		const { store, stored } = await store_();
		const ref = await stored(ANSWER, 'RETAINED_BY_PARTICIPATION');

		// Tamper: same key, different bytes. `put` is keyed on tenant+class+hash, so write through the driver's
		// own upsert path by storing different content and pointing the record's key at it.
		const other = await store.put({
			tenantPrefix: 'tnt-1',
			bytes: '{"verdict":"TAMPERED"}',
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const lying = { ...ref, storageKey: other.storageKey };

		const report = await verifyExchangeContent(exchange({ answerSpanRef: lying }), store);
		const answer = report.refs.find((r) => r.field === 'answerSpanRef')!;
		expect(answer.verdict).toBe('HASH_MISMATCH');
		expect(answer.detail, 'the report must quote both hashes, not merely disagree').toMatch(/sha256:/);
		expect(report.intact).toBe(false);
	});

	it('⭑⭑ catches a store whose METADATA and BYTES disagree — the test the first draft did not have', async () => {
		// ⚠ THIS TEST EXISTS BECAUSE THE MUTANT SURVIVED. The sibling test above tampers by REPOINTING the
		// record at a different key, so `stat().contentHash` and the bytes at that key still agree with each
		// other — and the ceremony implementation (`const actual = meta.contentHash`) passed all ten tests.
		// DRIVEN before this was written: mutant applied, suite green.
		//
		// ⭑ Only an arrangement where the STORE ITSELF is inconsistent separates the two implementations: stale
		// metadata over changed bytes is what a caching adapter, an interrupted write, or an out-of-band edit
		// actually produces, and it is the case a hash exists to detect at all.
		//
		// THE MUTANT, RESTATED: `const actual = meta.contentHash`. Then metadata is compared to the record's
		// copy of metadata, both descend from one `put`, and the bytes are never examined. This is the only
		// test in the file that reddens.
		const inner = createInMemoryArtifactStore();
		const good = await inner.put({
			tenantPrefix: 'tnt-1',
			bytes: ANSWER,
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const inconsistent: ArtifactStore = {
			durability: 'DURABLE',
			put: (i) => inner.put(i),
			purge: (k) => inner.purge(k),
			// The metadata still describes the ORIGINAL bytes...
			stat: (k) => inner.stat(k),
			// ...and the content plane has moved on underneath it.
			// ⚠⚠ EXACTLY THE SAME LENGTH, AND THAT IS THE SECOND CORRECTION THIS TEST NEEDED. The first version
			// substituted '{"verdict":"SILENTLY CHANGED"}' — 30 bytes against 16 — so the BYTE-SIZE arm caught it
			// whichever hash the implementation used, and the mutant survived a second time. A test that detects
			// tampering by its size is not testing the hash at all. Both strings below are 16 bytes.
			get: async (k) => (k === good.storageKey ? '{"verdict":"NO"}' : inner.get(k))
		};

		const report = await verifyExchangeContent(
			exchange({
				answerSpanRef: {
					status: 'STORED',
					storageKey: good.storageKey,
					contentHash: good.contentHash,
					byteSize: good.byteSize,
					purgeability: 'RETAINED_BY_PARTICIPATION',
					contentDurability: 'DURABLE'
				}
			}),
			inconsistent
		);
		const r = report.refs.find((f) => f.field === 'answerSpanRef')!;
		expect(r.verdict, 'metadata agreeing with the record proves nothing about the bytes').toBe(
			'HASH_MISMATCH'
		);
		// The control that keeps the isolation honest: if these ever differ, the size arm is doing the work
		// again and this test has quietly stopped testing the hash.
		expect(Buffer.byteLength('{"verdict":"NO"}'), 'the substitute must be the same length').toBe(
			Buffer.byteLength(ANSWER)
		);
		expect(report.intact).toBe(false);
	});

	it('reports a purge as PURGED, not as absence — the tombstone is the disclosure', async () => {
		// THE MUTANT: treat a tombstone as UNRESOLVABLE. A lawful, scheduled removal under PER-12 would then read
		// identically to bytes that were never written — the exact conflation the tombstone exists to prevent.
		const { store, stored } = await store_();
		const ref = await stored(REASONING, 'PURGEABLE_AT_EXPIRY');
		expect((await store.purge(ref.storageKey!)).purged).toBe(true);

		const report = await verifyExchangeContent(exchange({ volunteeredReasoningRef: ref }), store);
		const r = report.refs.find((f) => f.field === 'volunteeredReasoningRef')!;
		expect(r.verdict).toBe('PURGED');
		expect(r.detail).toMatch(/tombstone/i);
	});

	it('⚠ an absent key on a PROCESS_LOCAL store is NOT reported as "never written"', async () => {
		// THE MUTANT: set `distinguishable: true` unconditionally, or write "the key was never written" into the
		// detail. This store's entries live in a Map: after a restart a key that HELD bytes is byte-identical
		// here to one that never existed. Asserting the difference would be claiming an observation nobody made
		// — worse than omitting it, because a reader cannot discount it.
		const { store } = await store_();
		const report = await verifyExchangeContent(
			exchange({
				answerSpanRef: {
					status: 'STORED',
					storageKey: 'tnt-1/RETAINED_BY_PARTICIPATION/never-written',
					contentHash: 'sha256:0',
					byteSize: 1,
					purgeability: 'RETAINED_BY_PARTICIPATION',
					contentDurability: 'PROCESS_LOCAL'
				}
			}),
			store
		);
		const r = report.refs.find((f) => f.field === 'answerSpanRef')!;
		expect(r.verdict).toBe('UNRESOLVABLE');
		expect(r.distinguishable, 'a process-local store cannot tell the two cases apart').toBe(false);
		expect(r.detail).not.toMatch(/never written/);
		expect(r.detail).toMatch(/PROCESS_LOCAL/);
	});

	it('CONTROL — a DURABLE store CAN say the key was never written, so the qualifier is about the store', async () => {
		// Without this, the assertion above could not be told apart from "never claim distinguishability", which
		// would throw away a true statement a durable store is entitled to make.
		const durable: ArtifactStore = { ...createInMemoryArtifactStore(), durability: 'DURABLE' };
		const report = await verifyExchangeContent(
			exchange({
				answerSpanRef: {
					status: 'STORED',
					storageKey: 'tnt-1/RETAINED_BY_PARTICIPATION/never-written',
					contentHash: 'sha256:0',
					byteSize: 1,
					purgeability: 'RETAINED_BY_PARTICIPATION'
				}
			}),
			durable
		);
		const r = report.refs.find((f) => f.field === 'answerSpanRef')!;
		expect(r.distinguishable).toBe(true);
		expect(r.detail).toMatch(/never written/);
	});

	it('a PENDING ref is NOT_CLAIMED and carries the reason the record gave', async () => {
		const { store } = await store_();
		const report = await verifyExchangeContent(exchange(), store);
		const raw = report.refs.find((f) => f.field === 'rawOutputBeforeCoercionRef')!;
		expect(raw.verdict).toBe('NOT_CLAIMED');
		// THE MUTANT: drop the reason. PER-9 permits a DISCLOSED absence and forbids a silent one; a verdict
		// that says "not claimed" without saying why turns the disclosed one back into the silent one.
		expect(raw.detail).toMatch(/separated at retention/i);
	});
});

describe('MXREAD-02 — readAnswerSpan', () => {
	it('returns the exact bytes of the participating half', async () => {
		const { store, stored } = await store_();
		const read = await readAnswerSpan(
			exchange({ answerSpanRef: await stored(ANSWER, 'RETAINED_BY_PARTICIPATION') }),
			store
		);
		expect(read.available && read.bytes).toBe(ANSWER);
	});

	it('⛔ REFUSES purgeable material even when it arrives in the answer field — PER-12', async () => {
		// ⭑ THE MUTANT: gate on the FIELD NAME instead of the stored retention class. This fixture puts
		// PURGEABLE_AT_EXPIRY bytes in `answerSpanRef`, which is exactly what a mis-wiring produces — and a
		// name-based guard hands PER-12 material to the caller while looking correct. The class is the fact;
		// the field name is a convention.
		const { store, stored } = await store_();
		const read = await readAnswerSpan(
			exchange({ answerSpanRef: await stored(REASONING, 'PURGEABLE_AT_EXPIRY') }),
			store
		);
		expect(read.available).toBe(false);
		expect(!read.available && read.refusedBecause).toMatch(/PURGEABLE_AT_EXPIRY/);
		expect(!read.available && read.refusedBecause).toMatch(/REG-Q-077/);
	});

	it('⛔ REFUSES bytes that do not verify, rather than returning them unannounced', async () => {
		// THE MUTANT: skip the verification call and return `store.get` directly. The caller then cannot tell a
		// verified span from an unverified one — which is the defect this module exists to remove, reintroduced
		// by the module itself.
		const { store, stored } = await store_();
		const ref = await stored(ANSWER, 'RETAINED_BY_PARTICIPATION');
		const other = await store.put({
			tenantPrefix: 'tnt-1',
			bytes: '{"verdict":"TAMPERED"}',
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const read = await readAnswerSpan(
			exchange({ answerSpanRef: { ...ref, storageKey: other.storageKey } }),
			store
		);
		expect(read.available).toBe(false);
		expect(!read.available && read.refusedBecause).toMatch(/HASH_MISMATCH/);
	});

	it('refuses a span that was never retained, and says why the record said it was not', async () => {
		const { store } = await store_();
		const read = await readAnswerSpan(
			exchange({ answerSpanRef: pending('No answer span could be located, so §9.7 blocks retention.') }),
			store
		);
		expect(read.available).toBe(false);
		expect(!read.available && read.refusedBecause).toMatch(/§9.7/);
	});
});
