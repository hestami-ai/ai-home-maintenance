// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 — THE ONE READER OF BYTES CHECKED AGAINST THEIR HASH, `verifiedBytes`, MOVED HERE WHOLE from
// `stopped-unit-recovery.ts` (which re-exports it, so its every caller reads it as before): the record's reader (`earlier-attempt-record.ts`) checks
// every exchange's bytes through it, as D89 says, and that module must load where the floor's module does not — the census's project among them.
import { createHash } from 'node:crypto';
import type { ArtifactStore } from '@janumipwb/rph-ports';

const sha256 = (bytes: string): string => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;

/**
 * Bytes from the content store, re-hashed against the hash their record names — or why not. ⭐⭐ Package L15 — D69 — exported: the
 * route reads a unit's accepted work product through it before writing it to the unit's file, as this rebuild reads one.
 */
export async function verifiedBytes(
	store: ArtifactStore,
	storageKey: string,
	contentHash: string,
	what: string
): Promise<{ readonly ok: true; readonly value: string } | { readonly ok: false; readonly refusedBecause: string }> {
	const bytes = await store.get(storageKey);
	if (bytes === undefined)
		return {
			ok: false,
			refusedBecause: `${what} at '${storageKey}' are not in the content store.`
		};
	if (sha256(bytes) !== contentHash)
		return {
			ok: false,
			refusedBecause: `${what} at '${storageKey}' hash to ${sha256(bytes)}, not the ${contentHash} its record names.`
		};
	return { ok: true, value: bytes };
}

/**
 * ⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 5 of §23 (the lead's O-2), and ruling 2's general form — A REFERENCE RECORDED AS `STORED`
 * THAT NAMES NO STORAGE KEY, OR NO CONTENT HASH, IN WORDS: it cannot be read, and is never read as one not stored. Said where one of the two is not a
 * string; the record's reader (`earlier-attempt-record.ts`) and the narrative writer's answer line (`narrative-chapter.ts`) say it alike.
 */
export function storedButUnnamed(what: string, ref: { readonly storageKey?: unknown; readonly contentHash?: unknown }): string {
	const missing = [typeof ref.storageKey === 'string' ? '' : 'no storage key', typeof ref.contentHash === 'string' ? '' : 'no content hash'];
	return `the ${what} is recorded as stored, but its reference names ${missing.filter((m) => m !== '').join(' and ')}`;
}
