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
		async put(input: ArtifactContentInput): Promise<StoredArtifactRef> {
			const contentHash = hashBytes(input.bytes);
			// §31.2 — the tenant prefix is part of the key, and the suffix is the opaque content address rather
			// than anything derived from a name or a path the caller controls.
			const storageKey = `${input.tenantPrefix}/${contentHash.slice('sha256:'.length)}`;
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
					refusedBecause: `unknown storageKey '${storageKey}' — nothing was stored under it, so nothing was purged. Reported rather than answered with success, because a purge log that cannot tell "removed" from "was not there" cannot evidence that a retention policy ran.`
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
