// The reference in-memory ArtifactStore — the default the library ships so the seam is never a bare interface.
//
// It mirrors `defaults/logger.ts`: a working implementation with no platform assumption, so a host that has
// not yet chosen a backend still gets lawful behaviour rather than a stub. A §31 S3-compatible adapter slots
// in behind the same interface later; every invariant that makes retention LAWFUL (participation-guarded
// purge, tombstones, byte-level hashing, tenant-scoped keys) is expressed here so both must honour it.
//
// ⚠ IN-MEMORY MEANS THE BYTES DO NOT SURVIVE RESTART. That is a durability limitation, not a compliance one:
// PER-12's obligation is that retained content CAN be purged, and content that does not survive restart has
// not escaped that. A host needing durable retention supplies a durable adapter; the guard below is what it
// must reproduce.
import { createHash } from 'node:crypto';
import type {
	ArtifactContentInput,
	ArtifactStore,
	PurgeOutcome,
	StoredArtifactMeta,
	StoredArtifactRef
} from '../ports/artifact-store.js';

export const IN_MEMORY_STORAGE_PROVIDER = 'jpwb:in-memory';

/**
 * SHA-256 over the BYTES.
 *
 * ⚠ DELIBERATELY NOT `contentHash()` FROM rph-contracts. That one canonicalizes JSON first
 * (`sha256(canonicalJson(value))`), which is correct for OBJECT identity and wrong here: `{"a":1}` and
 * `{ "a" : 1 }` are the same object and DIFFERENT bytes, so an object hash would deduplicate two distinct
 * artifacts into one. §31.3 requires a cryptographic hash OF THE ARTIFACT, and the artifact is the bytes.
 */
function hashBytes(bytes: string): string {
	return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
}

interface Entry {
	meta: StoredArtifactMeta;
	bytes?: string;
}

export function createInMemoryArtifactStore(): ArtifactStore {
	const entries = new Map<string, Entry>();

	return {
		// The bytes live in a Map. Declaring this is what lets a record disclose that the content it names is
		// process-local, instead of a durable record silently pointing at content that a restart erased.
		durability: 'PROCESS_LOCAL',

		async put(input: ArtifactContentInput): Promise<StoredArtifactRef> {
			const contentHash = hashBytes(input.bytes);
			// §31.2 — the tenant prefix is part of the key, and the suffix is the opaque content address rather
			// than anything derived from a name or a path the caller controls.
			//
			// ⭑ RETENTION CLASS IS PART OF THE IDENTITY, AND THAT IS A PER-8 REQUIREMENT RATHER THAN A
			// CONVENIENCE. Keyed on `tenantPrefix/hash` alone, two puts of the SAME BYTES under DIFFERENT
			// classes collided, and `entries.set` is unconditional — so a later `PURGEABLE_AT_EXPIRY` put
			// silently DOWNGRADED an existing `RETAINED_BY_PARTICIPATION` entry, after which `purge()`
			// succeeded and the bytes a recorded assessment rested on were destroyed. PER-8: participating
			// material "is never hard-deleted", and participation is irreversible.
			//
			// ⚠ THE FIX IS IDENTITY, NOT A DOWNGRADE GUARD, AND THE DIFFERENCE MATTERS. A guard would have to
			// pick a winner for one key, and either choice breaks a rule: keeping RETAINED over-retains the
			// volunteered copy that PER-12 requires to stay purgeable, and keeping PURGEABLE is the very
			// hard-delete this closes. Two retention fates are two stored objects. Canon licenses exactly
			// that — DOC-003:89, "One Representation may have several Artifacts".
			//
			// `contentHash` is NOT affected: §31.3 requires the hash to be over the artifact's bytes, and the
			// test above pins it. Only the KEY carries the class.
			const storageKey = `${input.tenantPrefix}/${input.purgeability}/${contentHash.slice('sha256:'.length)}`;
			const byteSize = Buffer.byteLength(input.bytes, 'utf8');
			entries.set(storageKey, {
				bytes: input.bytes,
				meta: {
					storageKey,
					contentHash,
					byteSize,
					mediaType: input.mediaType,
					purgeability: input.purgeability,
					purged: false
				}
			});
			return { storageProvider: IN_MEMORY_STORAGE_PROVIDER, storageKey, contentHash, byteSize };
		},

		async get(storageKey: string): Promise<string | undefined> {
			return entries.get(storageKey)?.bytes;
		},

		async stat(storageKey: string): Promise<StoredArtifactMeta | undefined> {
			return entries.get(storageKey)?.meta;
		},

		async purge(storageKey: string): Promise<PurgeOutcome> {
			const entry = entries.get(storageKey);
			if (!entry)
				return {
					purged: false,
					// ⚠ IT USED TO ASSERT "nothing was stored under it", AND THIS STORE CANNOT KNOW THAT.
					// Entries live in a Map, so after a restart a key that HELD bytes minutes earlier is
					// indistinguishable here from one that never existed — and the old wording stated the
					// second as fact. `PER-9`: "record-plane omission is not legal"; asserting an absence you
					// cannot observe is worse than omitting it, because a reader cannot discount it.
					// The refusal is unchanged; only the claim about WHY is now bounded by what is knowable.
					refusedBecause: `no entry is present under storageKey '${storageKey}', so nothing was purged. ⚠ THIS STORE CANNOT DISTINGUISH "never stored" from "stored and lost at restart": it is PROCESS_LOCAL and its entries, including tombstones, do not survive the process. A durable adapter must tell these apart. Reported rather than answered with success, because a purge log that cannot tell "removed" from "was not there" cannot evidence that a retention policy ran.`
				};
			if (entry.meta.purgeability === 'RETAINED_BY_PARTICIPATION')
				return {
					purged: false,
					refusedBecause: `PER-8 forbids it: this content is marked RETAINED_BY_PARTICIPATION, and a canonical object that has participated in execution, assurance, governance, a baseline, or traceability is never hard-deleted. Reasoning traces are purgeable precisely because they never participate (PER-12); this content is not one.`
				};
			// The BYTES go; the ENTRY stays. See the port's note on tombstones.
			entry.bytes = undefined;
			entry.meta = { ...entry.meta, purged: true };
			return { purged: true };
		}
	};
}
