// The reference IN-MEMORY Workspace — the default the library ships so the seam is never a bare interface.
//
// It mirrors `defaults/artifact-store.ts` exactly in posture: a WORKING implementation with no platform
// assumption, so a host that has not yet chosen a backend gets lawful behaviour rather than a stub, and every
// invariant that makes the seam lawful (containment, participation-guarded purge, tombstones) is expressed here
// so a filesystem adapter must reproduce it.
//
// ⛔ AND IT IS WHAT KEEPS THE GATE HERMETIC. No existing test may gain a real filesystem by importing this
// port. It genuinely stores and reads back — so it is not a stub that proves nothing — and it DECLARES
// `IN_MEMORY`, so a host that then hands it to a REAL ProcessRunner has made an error `planProcessRun` catches
// rather than one that executes somewhere else.
//
// ⚠ IN-MEMORY MEANS THE CONTENTS DO NOT SURVIVE A RESTART, and nothing here pretends otherwise. That is a
// durability limitation, not a compliance one — `R8`'s durable workspace is a FILESYSTEM adapter's job, and it
// is deliberately not this file's.
import type { Purgeability, PurgeOutcome } from '../ports/artifact-store.js';
import {
	containedWorkspacePath,
	type Workspace,
	type WorkspaceEntry,
	type WorkspaceOwnerKind,
	type WorkspaceWriteOutcome
} from '../ports/workspace.js';

/**
 * What a host must STATE to get a workspace. Every field is required.
 *
 * ⛔ `purgeability` HAS NO DEFAULT, AND THAT IS THE `NO DEFAULT THAT FABRICATES` RULE APPLIED TO RETENTION.
 * Defaulting to `RETAINED_BY_PARTICIPATION` would make every workspace unpurgeable and read as a retention
 * decision nobody made; defaulting to `PURGEABLE_AT_EXPIRY` would be a hard-delete vector wearing a default.
 * The class decides whether destroying a step's work is lawful, so it is said out loud or not at all.
 */
export interface InMemoryWorkspaceInput {
	readonly ownerKind: WorkspaceOwnerKind;
	readonly ownerId: string;
	readonly purgeability: Purgeability;
}

interface Held {
	bytes?: string;
	/** Retained past a purge so the entry can still say what was removed. */
	byteSize: number;
	purged: boolean;
}

export function createInMemoryWorkspace(input: InMemoryWorkspaceInput): Workspace {
	const files = new Map<string, Held>();

	return {
		ownerId: input.ownerId,
		ownerKind: input.ownerKind,
		// ⭑ DECLARED, NOT INFERRED FROM THE ABSENCE OF `directoryPath`. A consumer that decided this by probing
		// for an undefined field would be `REG-F-333`'s defect — reading the name where the property travels by
		// shape — and it would also silently reclassify any adapter that forgot to set the path.
		materialization: 'IN_MEMORY',
		purgeability: input.purgeability,

		async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
			const rel = containedWorkspacePath(path);
			if (rel === undefined)
				return {
					written: false,
					refusedBecause: `'${path}' does not name a location inside this workspace. A workspace path is relative, carries no drive letter, and may not resolve above the workspace root.`
				};
			// ⚠ A REWRITE CLEARS THE TOMBSTONE, DELIBERATELY. A path that was purged and is then written again
			// holds bytes, and reporting it as still purged would state an absence that is no longer true —
			// the inverse of the record defect this repository keeps catching.
			files.set(rel, {
				bytes: contents,
				byteSize: Buffer.byteLength(contents, 'utf8'),
				purged: false
			});
			return { written: true, path: rel, byteSize: Buffer.byteLength(contents, 'utf8') };
		},

		async readFile(path: string): Promise<string | undefined> {
			// An escaping path reads as absent rather than throwing — the same posture `writeFile` takes, and
			// for the same reason: the caller is a step that must be able to record what it was refused.
			const rel = containedWorkspacePath(path);
			return rel === undefined ? undefined : files.get(rel)?.bytes;
		},

		async list(): Promise<readonly WorkspaceEntry[]> {
			return [...files.entries()]
				.map(([path, held]): WorkspaceEntry => ({
					path,
					byteSize: held.byteSize,
					purged: held.purged
				}))
				.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		},

		async purge(path: string): Promise<PurgeOutcome> {
			const rel = containedWorkspacePath(path);
			if (rel === undefined)
				return {
					purged: false,
					refusedBecause: `'${path}' does not name a location inside this workspace, so nothing was purged. A purge that silently succeeded on an out-of-workspace path would be a delete vector wearing a retention label.`
				};
			const held = files.get(rel);
			if (!held)
				return {
					purged: false,
					// ⚠ BOUNDED BY WHAT THIS IMPLEMENTATION CAN OBSERVE, exactly as the in-memory ArtifactStore's
					// refusal is. Files live in a Map, so after a restart a path that HELD bytes minutes earlier
					// is indistinguishable here from one that never existed. Asserting "nothing was ever written
					// there" would state an absence this store cannot observe.
					refusedBecause: `no entry is present at '${rel}', so nothing was purged. ⚠ THIS WORKSPACE CANNOT DISTINGUISH "never written" from "written and lost at restart": it is IN_MEMORY and its entries, tombstones included, do not survive the process. A filesystem adapter must tell these apart.`
				};
			// ⛔ PER-8, READ OFF THE WORKSPACE'S DECLARED CLASS RATHER THAN THE PATH. The store encodes the class
			// in its key; a path-named workspace cannot, so the declaration is the only thing that can carry it.
			if (input.purgeability === 'RETAINED_BY_PARTICIPATION')
				return {
					purged: false,
					refusedBecause: `PER-8 forbids it: this workspace is declared RETAINED_BY_PARTICIPATION, and a canonical object that has participated in execution, assurance, governance, a baseline, or traceability is never hard-deleted. Content is purgeable precisely because it never participates (PER-12); this workspace declares that its content does.`
				};
			// The BYTES go; the ENTRY stays. `byteSize` is kept so the tombstone still says what was removed.
			files.set(rel, { byteSize: held.byteSize, purged: true });
			return { purged: true };
		}
	};
}
