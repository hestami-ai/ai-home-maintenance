// JAN-EXEC Phase 2 — the DURABLE Workspace adapter: one directory on disk, owned by one object.
//
// ⭐ `R8`: THE WORKSPACE IS THE DELIVERABLE. *"It must persist, survive a restart, and be inspectable after the
// undertaking ends."* `defaults/workspace.ts` is a lawful Workspace and says so plainly — *"IN-MEMORY MEANS THE
// CONTENTS DO NOT SURVIVE A RESTART, and nothing here pretends otherwise … `R8`'s durable workspace is a
// FILESYSTEM adapter's job, and it is deliberately not this file's."* This is that file.
//
// ⭑ IT LIVES IN THE DEMO, NOT IN THE KERNEL, AND THAT IS `R3` APPLIED RATHER THAN A CONVENIENCE. *"The seam
// belongs in the kernel as PORTS, with adapters in the demo."* The same split `SqliteArtifactStore` already
// follows one plane over: the port and its hermetic default ship together so the repository gate never gains a
// real filesystem by importing a port, and the adapter that DOES touch disk is a host's business.
//
// ── ⛔ THE TOMBSTONE CANNOT BE THE FILE ITSELF, AND THAT IS WHY THIS ADAPTER KEEPS A RECORD ──────────────────
// `Workspace.purge` promises "Remove the BYTES and keep the ENTRY", and `WorkspaceEntry` says why `byteSize` is
// not zeroed: "zeroing the size would read as an EMPTY FILE, which is a different fact." On a filesystem there
// are only two states a path can be in — present, or absent — so neither truncating nor unlinking can carry
// "purged on schedule" as distinct from "never written" and from "lost". The in-memory default gets this for
// free because its entry is a Map value that outlives its bytes; a directory has no such place, so the entry is
// kept in a RECORD beside the files. `SqliteArtifactStore` reaches the same conclusion from the same promise:
// the row survives, the blob does not.
//
// ⚠ AND THE RECORD IS ITSELF A RESERVED PATH, REFUSED TO CALLERS. A step that could write
// `.jpwb-workspace-tombstones.json` could rewrite the retention history of everything else in the workspace — a
// delete vector wearing a filename. The refusal for it is DISTINCT from the containment refusal on purpose: a
// caller naming the record has not tried to escape the workspace, and telling it that it did would be false.
//
// ── ⚠ TWO BOUNDS, DISCLOSED RATHER THAN IMPLIED ─────────────────────────────────────────────────────────────
// 1. SYMLINKS ARE NOT RESOLVED. Containment here is a PATH property, checked twice (see `locate`); a symlink
//    already inside the directory and pointing outside it would not be caught. Nothing in this host creates
//    one, and the sandbox that will is Phase 3's — stated so a reader does not take a stronger guarantee than
//    the one written.
// 2. LAST WRITE WINS. The retention record is read and rewritten per call with no lock, so two concurrent
//    purges in one workspace can lose one entry. The owner is ONE Undertaking and this host drives its steps in
//    sequence; a host that parallelises them needs more than this.
import {
	mkdir,
	readFile as fsReadFile,
	readdir,
	rm,
	stat,
	writeFile as fsWriteFile
} from 'node:fs/promises';
import { dirname, join, resolve as resolvePath, sep } from 'node:path';
import {
	containedWorkspacePath,
	type Purgeability,
	type PurgeOutcome,
	type Workspace,
	type WorkspaceEntry,
	type WorkspaceOwnerKind,
	type WorkspaceWriteOutcome
} from '@janumipwb/rph-ports';

/**
 * The retention record, beside the files it describes.
 *
 * ⛔ RESERVED: `writeFile` and `purge` refuse it by name, and `list` never reports it. See the header.
 */
export const WORKSPACE_TOMBSTONE_RECORD = '.jpwb-workspace-tombstones.json';

/** What a host must STATE to get a durable workspace. Every field is required — `defaults/workspace.ts`'s rule. */
export interface FilesystemWorkspaceInput {
	readonly ownerKind: WorkspaceOwnerKind;
	readonly ownerId: string;
	readonly purgeability: Purgeability;
	/** ⛔ THE ABSOLUTE DIRECTORY THIS WORKSPACE **IS**. Derived by the host from its durable root + the owner id. */
	readonly directoryPath: string;
}

/** One purged path, and what it held. `byteSize` is the only surviving statement of WHAT was removed. */
interface Tombstone {
	readonly byteSize: number;
}

export function createFilesystemWorkspace(input: FilesystemWorkspaceInput): Workspace {
	const root = resolvePath(input.directoryPath);
	const recordPath = join(root, WORKSPACE_TOMBSTONE_RECORD);
	const reserved = (rel: string) => rel === WORKSPACE_TOMBSTONE_RECORD;

	/**
	 * Resolve a caller-supplied path to an absolute location inside this workspace, or refuse.
	 *
	 * ⭑ THE CONTAINMENT CHECK RUNS TWICE, BY THE PORT'S OWN INSTRUCTION: "A workspace-relative path supplied by
	 * a model is resolved against it and re-checked for containment — never concatenated."
	 * `containedWorkspacePath` is the primary and it is the one carrying declared guards; the prefix re-check
	 * below is DEFENCE IN DEPTH over the join, and it is honestly redundant today — no input the predicate
	 * admits escapes the root once resolved. It is written anyway because the predicate lives in another
	 * package, and a future weakening of it would otherwise reach this host's real filesystem with nothing in
	 * between.
	 */
	function locate(path: string): { readonly rel: string; readonly abs: string } | undefined {
		const rel = containedWorkspacePath(path);
		if (rel === undefined) return undefined;
		const abs = resolvePath(root, rel);
		if (abs !== root && !abs.startsWith(root + sep)) return undefined;
		return { rel, abs };
	}

	async function readTombstones(): Promise<Record<string, Tombstone>> {
		try {
			const parsed: unknown = JSON.parse(await fsReadFile(recordPath, 'utf8'));
			// ⚠ A CORRUPT RECORD IS TREATED AS NO RECORD RATHER THAN THROWN OVER. The caller is a step that must
			// be able to record what it was refused; a parse error here would surface as a stack trace where a
			// retention fact belongs. The files themselves are untouched either way.
			return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as Record<string, Tombstone>)
				: {};
		} catch {
			return {};
		}
	}

	async function writeTombstones(next: Record<string, Tombstone>): Promise<void> {
		await mkdir(root, { recursive: true });
		await fsWriteFile(recordPath, JSON.stringify(next, null, '\t'), 'utf8');
	}

	/** Every live file under the directory, workspace-relative and forward-slashed, the record excluded. */
	async function livePaths(dir: string, prefix: string, out: string[]): Promise<void> {
		let names: string[];
		try {
			names = await readdir(dir);
		} catch {
			// The directory does not exist yet. An empty workspace is a fact, not a failure.
			return;
		}
		for (const name of names.sort()) {
			const rel = prefix === '' ? name : `${prefix}/${name}`;
			if (reserved(rel)) continue;
			const info = await stat(join(dir, name));
			if (info.isDirectory()) await livePaths(join(dir, name), rel, out);
			else out.push(rel);
		}
	}

	return {
		ownerId: input.ownerId,
		ownerKind: input.ownerKind,
		// ⭑ DECLARED, NOT INFERRED FROM THE PRESENCE OF `directoryPath` — the same rule the in-memory default
		// states from the other side. `planProcessRun` and `producerWorkingDirectory` both read this field, and
		// a consumer that decided it by probing for a path would be `REG-F-333`'s defect.
		materialization: 'FILESYSTEM',
		purgeability: input.purgeability,
		directoryPath: root,

		async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
			const at = locate(path);
			if (at === undefined)
				return {
					written: false,
					refusedBecause: `'${path}' does not name a location inside this workspace. A workspace path is relative, carries no drive letter, and may not resolve above the workspace root.`
				};
			if (reserved(at.rel))
				return {
					written: false,
					refusedBecause: `'${path}' is this workspace's own retention record and is not writable. It states which paths were purged and what they held, and a caller that could rewrite it could make a purge look like a file that was never written — the one distinction the record exists to keep.`
				};
			await mkdir(dirname(at.abs), { recursive: true });
			await fsWriteFile(at.abs, contents, 'utf8');
			// ⚠ A REWRITE CLEARS THE TOMBSTONE, DELIBERATELY — the in-memory default's rule restated on disk: a
			// path that was purged and is then written again holds bytes, and reporting it as still purged would
			// state an absence that is no longer true.
			const stones = await readTombstones();
			if (at.rel in stones) {
				const rest = { ...stones };
				delete rest[at.rel];
				await writeTombstones(rest);
			}
			return { written: true, path: at.rel, byteSize: Buffer.byteLength(contents, 'utf8') };
		},

		async readFile(path: string): Promise<string | undefined> {
			const at = locate(path);
			if (at === undefined || reserved(at.rel)) return undefined;
			try {
				return await fsReadFile(at.abs, 'utf8');
			} catch {
				// Absent bytes. ⚠ The port is explicit that this covers three facts — never written, escaped the
				// workspace, and PURGED — and that `list` is where retention stays explicable.
				return undefined;
			}
		},

		async list(): Promise<readonly WorkspaceEntry[]> {
			const live: string[] = [];
			await livePaths(root, '', live);
			const stones = await readTombstones();
			const entries: WorkspaceEntry[] = [];
			for (const rel of live) entries.push({ path: rel, byteSize: (await stat(join(root, rel))).size, purged: false });
			const present = new Set(live);
			for (const [rel, stone] of Object.entries(stones)) {
				if (present.has(rel)) continue;
				entries.push({ path: rel, byteSize: stone.byteSize, purged: true });
			}
			return entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		},

		async purge(path: string): Promise<PurgeOutcome> {
			const at = locate(path);
			if (at === undefined)
				return {
					purged: false,
					refusedBecause: `'${path}' does not name a location inside this workspace, so nothing was purged. A purge that silently succeeded on an out-of-workspace path would be a delete vector wearing a retention label.`
				};
			if (reserved(at.rel))
				return {
					purged: false,
					refusedBecause: `'${path}' is this workspace's own retention record and cannot be purged through it. Destroying the record would destroy the evidence that every other purge happened, which is the only reason such a log is kept.`
				};
			// ⛔ PER-8, READ OFF THE WORKSPACE'S DECLARED CLASS — the port header states why a path-named store
			// cannot put the class in its address the way the content-addressed one does.
			if (input.purgeability === 'RETAINED_BY_PARTICIPATION')
				return {
					purged: false,
					refusedBecause: `PER-8 forbids it: this workspace is declared RETAINED_BY_PARTICIPATION, and a canonical object that has participated in execution, assurance, governance, a baseline, or traceability is never hard-deleted. Content is purgeable precisely because it never participates (PER-12); this workspace declares that its content does.`
				};
			const stones = await readTombstones();
			let byteSize: number | undefined;
			try {
				byteSize = (await stat(at.abs)).size;
			} catch {
				byteSize = undefined;
			}
			if (byteSize === undefined && !(at.rel in stones))
				return {
					purged: false,
					// ⭑ AND THIS ADAPTER MAKES THE STRONGER STATEMENT THE IN-MEMORY ONE COULD NOT. Its refusal
					// discloses that it "CANNOT DISTINGUISH 'never written' from 'written and lost at restart'"
					// because its entries do not survive the process. A durable record does survive, so an absent
					// path with no tombstone genuinely was never written here.
					refusedBecause: `no entry is present at '${at.rel}', so nothing was purged. This workspace is durable and its retention record survives a restart, so a path holding no bytes and carrying no tombstone was never written here.`
				};
			// The BYTES go; the ENTRY stays, carrying what was removed.
			if (byteSize !== undefined) {
				await rm(at.abs, { force: true });
				await writeTombstones({ ...stones, [at.rel]: { byteSize } });
			}
			return { purged: true };
		}
	};
}
