// REG-D-049 — the ArtifactStore seam, and PURGE is the clause that makes the rest of it lawful.
//
// Retention of model content is currently ILLEGAL rather than merely unbuilt: `domain_events` is immutable and
// permanent (§9.4), and PER-12 requires retained reasoning "purgeable at retention expiry (PER-8)". A store
// without purge would not make retention lawful — it would only move the unlawfulness. So purge is proven
// first, and the guard that refuses to purge PARTICIPATING content is proven before the happy path.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore } from './artifact-store.js';

const REASONING = {
	tenantPrefix: 'tnt-7f3a',
	bytes: 'the model reasoned at length',
	mediaType: 'text/plain',
	purgeability: 'PURGEABLE_AT_EXPIRY'
} as const;

const EVIDENCE = { ...REASONING, purgeability: 'RETAINED_BY_PARTICIPATION' } as const;

describe('ArtifactStore — PER-8 / PER-12', () => {
	it('REFUSES to purge content that participated — PER-8 has no exception', async () => {
		const store = createInMemoryArtifactStore();
		const ref = await store.put(EVIDENCE);

		const outcome = await store.purge(ref.storageKey);

		// THE MUTANT: purge anything on request. PER-8: a canonical object that "has participated in execution,
		// assurance, governance, a baseline, or traceability is never hard-deleted". A store that purges on
		// demand is a hard-delete vector wearing a retention label — it would make this port the mechanism by
		// which PER-8 is violated, which is the opposite of why it exists.
		expect(outcome.purged).toBe(false);
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/PER-8|participat/i);
		// And the bytes are still there — a refusal that lost the content anyway would be worse than either.
		expect(await store.get(ref.storageKey)).toBe(EVIDENCE.bytes);
	});

	it('purges content that never participated, and the bytes are GONE — PER-12', async () => {
		const store = createInMemoryArtifactStore();
		const ref = await store.put(REASONING);

		expect(await store.get(ref.storageKey)).toBe(REASONING.bytes);
		expect((await store.purge(ref.storageKey)).purged).toBe(true);

		// THE MUTANT: mark it purged without removing the bytes. "Purgeable at retention expiry" is not a flag;
		// a purge that leaves the content readable is the fiction that lets an unpurgeable store claim
		// compliance.
		expect(await store.get(ref.storageKey)).toBeUndefined();
	});

	it('a purge leaves a TOMBSTONE — the reference stays explicable', async () => {
		const store = createInMemoryArtifactStore();
		const ref = await store.put(REASONING);
		await store.purge(ref.storageKey);

		// THE MUTANT: delete the entry entirely. Then a record still holding this storageKey points at nothing
		// with no explanation — which reproduces the silent-omission defect one layer down: a reader cannot
		// tell "purged on schedule" from "never stored" from "lost". CSAA-009 §20 names this action
		// `tombstone-or-unavailable-record`, and it is the difference between a disclosed absence and a hole.
		const meta = await store.stat(ref.storageKey);
		expect(meta).toBeDefined();
		expect(meta?.purged).toBe(true);
		expect(meta?.contentHash).toBe(ref.contentHash); // identity survives the content
	});

	it('the storage key carries the opaque tenant prefix — §31.2', async () => {
		const store = createInMemoryArtifactStore();
		const ref = await store.put(REASONING);

		// §31.2, verbatim: "Object keys SHALL include opaque tenant-scoped prefixes."
		// THE MUTANT: a flat global key. Cross-tenant reads then depend on nothing but a hash collision.
		expect(ref.storageKey.startsWith(`${REASONING.tenantPrefix}/`)).toBe(true);
	});

	it('the content hash is over the BYTES, not a canonicalized object — §31.3', async () => {
		const store = createInMemoryArtifactStore();
		const a = await store.put({ ...REASONING, bytes: '{"a":1}' });
		const b = await store.put({ ...REASONING, bytes: '{ "a" : 1 }' });

		// THE MUTANT: hash with `contentHash()` from rph-contracts, which canonicalizes JSON first. These two
		// byte strings are DIFFERENT bytes and the same canonical object — so an object hash would call them
		// identical and a byte store would deduplicate two distinct artifacts into one. §31.3 says "Artifacts
		// SHALL use cryptographic content hashes"; of the artifact, which is the bytes.
		expect(a.contentHash).not.toBe(b.contentHash);
		expect(a.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it('a PURGEABLE re-put of participating bytes CANNOT downgrade them — PER-8 is a one-way door', async () => {
		const store = createInMemoryArtifactStore();

		// ⚠ REASONING and EVIDENCE carry IDENTICAL BYTES and differ only in purgeability. That collision was
		// already latent in this file's fixtures and nothing exercised it. Before the fix the storage key was
		// `tenantPrefix/contentHash` alone, so the second put OVERWROTE the first: `stat` then reported
		// PURGEABLE_AT_EXPIRY for content that had participated, `purge` succeeded, and the bytes a recorded
		// assessment was based on were destroyed. PER-8: participation "is never hard-deleted", and it is
		// irreversible — so a store that lets a later, lower classification reach an existing entry is a
		// hard-delete vector wearing a retention label.
		const participating = await store.put(EVIDENCE);
		const volunteered = await store.put(REASONING);

		// THE FIX IS STRUCTURAL, NOT A GUARD: retention class is part of the stored object's identity, so a put
		// under a different class cannot address — and therefore cannot overwrite — the existing entry.
		expect(volunteered.storageKey).not.toBe(participating.storageKey);
		expect((await store.stat(participating.storageKey))?.purgeability).toBe('RETAINED_BY_PARTICIPATION');

		// THE MUTANT: drop purgeability from the key. Both keys collide, the entry is overwritten, and all four
		// of these fail together.
		expect((await store.purge(participating.storageKey)).purged).toBe(false);
		expect(await store.get(participating.storageKey)).toBe(EVIDENCE.bytes);
	});

	it('CONTROL — the purgeable copy of those same bytes IS still purgeable', async () => {
		const store = createInMemoryArtifactStore();
		await store.put(EVIDENCE);
		const volunteered = await store.put(REASONING);

		// Without this the fix above could not be told apart from "refuse every purge". PER-12 requires the
		// volunteered half to remain purgeable at retention expiry; separating identity must not over-retain it.
		expect((await store.purge(volunteered.storageKey)).purged).toBe(true);
		expect(await store.get(volunteered.storageKey)).toBeUndefined();
	});

	it('purging something never stored says so, rather than reporting success', async () => {
		const store = createInMemoryArtifactStore();
		const outcome = await store.purge('tnt-7f3a/nothing-here');

		// THE MUTANT: return {purged:true} for an unknown key. A purge log that cannot distinguish "removed" from
		// "was not there" cannot evidence a retention policy was executed.
		expect(outcome.purged).toBe(false);
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/unknown|not stored|no such/i);
	});
});
