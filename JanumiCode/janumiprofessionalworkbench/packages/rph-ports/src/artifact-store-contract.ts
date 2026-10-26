// The ArtifactStore CONTRACT SUITE — the invariants every implementation must honour, run against each.
//
// ── WHY THIS IS SHARED RATHER THAN COPIED ────────────────────────────────────────────────────────────────────
// A second adapter is where a guarantee quietly stops being universal. `REG-F-337` recorded a PER-8 hard-delete
// vector in the in-memory default — retention class was not part of the storage identity, so a later
// PURGEABLE put of the same bytes downgraded a participating entry and `purge` then destroyed it. That defect
// is a property of the KEY DERIVATION, so every adapter can reproduce it independently, and a duplicated test
// suite would drift adapter by adapter until one of them does.
//
// So the invariants live here once and each adapter runs them. An adapter that cannot pass this is not an
// ArtifactStore, whatever its type signature says.
import { expect, it } from 'vitest';

import type { ArtifactStore } from './ports/artifact-store.js';

const REASONING = {
	tenantPrefix: 'tnt-7f3a',
	bytes: 'the model reasoned at length',
	mediaType: 'text/plain',
	purgeability: 'PURGEABLE_AT_EXPIRY'
} as const;

/** IDENTICAL BYTES, different class — the collision REG-F-337 turned on. */
const EVIDENCE = { ...REASONING, purgeability: 'RETAINED_BY_PARTICIPATION' } as const;

/**
 * Run the contract against one implementation.
 *
 * `make` must return a FRESH store per call: several cases depend on starting empty, and a shared instance
 * would let one case's writes satisfy another's assertions.
 */
export function artifactStoreContract(make: () => ArtifactStore): void {
	it('REFUSES to purge content that participated — PER-8 has no exception', async () => {
		const store = make();
		const ref = await store.put(EVIDENCE);
		const outcome = await store.purge(ref.storageKey);

		expect(outcome.purged).toBe(false);
		// Assert the REASON, not just the refusal: `purge` also returns false for an absent key, so a bare
		// false cannot tell "refused because it participated" from "refused because nothing is there".
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/PER-8|participat/i);
		expect(await store.get(ref.storageKey), 'a refusal that lost the bytes anyway is worse').toBe(
			EVIDENCE.bytes
		);
	});

	it('purges content that never participated, and the bytes are GONE — PER-12', async () => {
		const store = make();
		const ref = await store.put(REASONING);
		expect(await store.get(ref.storageKey)).toBe(REASONING.bytes);
		expect((await store.purge(ref.storageKey)).purged).toBe(true);
		// A purge that leaves the content readable is the fiction that lets an unpurgeable store claim
		// compliance with "purgeable at retention expiry".
		expect(await store.get(ref.storageKey)).toBeUndefined();
	});

	it('a purge leaves a TOMBSTONE — the reference stays explicable', async () => {
		const store = make();
		const ref = await store.put(REASONING);
		await store.purge(ref.storageKey);
		const meta = await store.stat(ref.storageKey);

		// Deleting the entry outright leaves a record pointing at nothing, and a reader cannot then tell
		// "purged on schedule" from "never stored" from "lost".
		expect(meta, 'the entry did not survive its purge').toBeDefined();
		expect(meta?.purged).toBe(true);
		expect(meta?.contentHash, 'identity survives the content').toBe(ref.contentHash);
	});

	it('⛔ a PURGEABLE re-put of participating bytes CANNOT downgrade them — REG-F-337', async () => {
		const store = make();
		const participating = await store.put(EVIDENCE);
		const volunteered = await store.put(REASONING);

		// Retention class is part of the stored object's IDENTITY, so a put under a different class cannot
		// address — and therefore cannot overwrite — the existing entry. This is the invariant most likely to
		// be lost in a new adapter, because it lives in the key derivation rather than in any guard.
		expect(volunteered.storageKey).not.toBe(participating.storageKey);
		expect((await store.stat(participating.storageKey))?.purgeability).toBe(
			'RETAINED_BY_PARTICIPATION'
		);
		expect((await store.purge(participating.storageKey)).purged).toBe(false);
		expect(await store.get(participating.storageKey)).toBe(EVIDENCE.bytes);
	});

	it('CONTROL — the purgeable copy of those same bytes IS still purgeable', async () => {
		// Without this the invariant above could not be told apart from "refuse every purge", which would
		// over-retain the volunteered half PER-12 requires to stay purgeable.
		const store = make();
		await store.put(EVIDENCE);
		const volunteered = await store.put(REASONING);
		expect((await store.purge(volunteered.storageKey)).purged).toBe(true);
	});

	it('the storage key carries the opaque tenant prefix — §31.2', async () => {
		// §31.2 is one of §31's two actual SHALLs: "Object keys SHALL include opaque tenant-scoped prefixes."
		const ref = await make().put(REASONING);
		expect(ref.storageKey.startsWith(`${REASONING.tenantPrefix}/`)).toBe(true);
	});

	it('the content hash is over the BYTES, not a canonicalized object — §31.3', async () => {
		const store = make();
		const a = await store.put({ ...REASONING, bytes: '{"a":1}' });
		const b = await store.put({ ...REASONING, bytes: '{ "a" : 1 }' });

		// Two byte strings that are the same canonical OBJECT are different ARTIFACTS. An object hash would
		// deduplicate them into one, which is why §31.3's "cryptographic content hashes" is read as over the
		// artifact — and the artifact is the bytes.
		expect(a.contentHash).not.toBe(b.contentHash);
		expect(a.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it('purging an absent key refuses rather than reporting success', async () => {
		// A purge log that cannot distinguish "removed" from "was not there" cannot evidence that a retention
		// policy ran, which is the only reason to keep such a log.
		const outcome = await make().purge('tnt-7f3a/PURGEABLE_AT_EXPIRY/never-written');
		expect(outcome.purged).toBe(false);
		expect(outcome.purged === false && outcome.refusedBecause.length).toBeGreaterThan(0);
	});

	it('declares its durability, so a record can disclose what it references', () => {
		// captureTry copies this onto every STORED ref. A wrong declaration here makes a permanent record
		// claim content that a restart erased (REG-F-342) — so it is asserted, not assumed.
		expect(['DURABLE', 'PROCESS_LOCAL']).toContain(make().durability);
	});

	// ── ⭐⭐ `JAN-EXEC` Phase 7, package O — A NAME THE HOST DERIVES, BOUND ONCE TO AN ENTRY (design D22, D23, revision 3) ──────
	// The store stays content-addressed: `put` derives every key from the bytes. A NAME is the one key a host can compute
	// without the bytes — from the step and the try whose view an entry holds, or from the unit whose first baseline it holds —
	// so a later reader can reach an entry no record points at. ⛔ BOUND ONCE: what a name names is never rewritten (PER-8's
	// participation is irreversible, and a reader must get the entry the first binding named, or nothing). ⛔ AND NEVER TO
	// NOTHING: a name binds only to an entry the store holds.
	const NAME = `${EVIDENCE.tenantPrefix}/deliverable-view/step_1#1/1`;

	it('⭐ a NAME binds once to an entry this store holds, and resolves to that entry’s ref', async () => {
		const store = make();
		const ref = await store.put(EVIDENCE);
		expect(await store.bindName(NAME, ref.storageKey)).toEqual({ bound: true });
		expect(await store.resolveName(NAME)).toEqual(ref);
		expect(await store.get((await store.resolveName(NAME))!.storageKey)).toBe(EVIDENCE.bytes);
	});

	it('⛔ a name is NEVER REBOUND: binding it to another entry is refused, naming both, and the first binding stands', async () => {
		const store = make();
		const first = await store.put(EVIDENCE);
		const second = await store.put({ ...EVIDENCE, bytes: 'another view' });
		await store.bindName(NAME, first.storageKey);
		const again = await store.bindName(NAME, second.storageKey);
		expect(again.bound, 'a name was rebound to another entry').toBe(false);
		expect(again.bound === false && again.refusedBecause).toContain(first.storageKey);
		expect(again.bound === false && again.refusedBecause).toContain(second.storageKey);
		expect((await store.resolveName(NAME))?.storageKey, 'the first binding was rewritten').toBe(first.storageKey);
	});

	it('⭑ CONTROL — binding a name to the entry it already names is admitted: the act repeated, nothing rewritten', async () => {
		const store = make();
		const ref = await store.put(EVIDENCE);
		await store.bindName(NAME, ref.storageKey);
		expect(await store.bindName(NAME, ref.storageKey)).toEqual({ bound: true });
		expect(await store.resolveName(NAME)).toEqual(ref);
	});

	it('⛔ a name never points at nothing: binding it to a key the store does not hold is refused, and nothing is bound', async () => {
		const store = make();
		const refused = await store.bindName(NAME, `${EVIDENCE.tenantPrefix}/RETAINED_BY_PARTICIPATION/never-written`);
		expect(refused.bound, 'a name was bound to an entry the store does not hold').toBe(false);
		expect(refused.bound === false && refused.refusedBecause.length).toBeGreaterThan(0);
		expect(await store.resolveName(NAME)).toBeUndefined();
	});

	it('an unbound name resolves to nothing, and a name is no storage key: `get` and `stat` do not answer it', async () => {
		const store = make();
		const ref = await store.put(EVIDENCE);
		expect(await store.resolveName(`${NAME}-unbound`)).toBeUndefined();
		await store.bindName(NAME, ref.storageKey);
		expect(await store.get(NAME)).toBeUndefined();
		expect(await store.stat(NAME)).toBeUndefined();
	});
}
