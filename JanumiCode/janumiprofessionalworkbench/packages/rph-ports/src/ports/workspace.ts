// Workspace port — the MUTABLE WORKING SET an execution step builds up while it works, as distinct from the
// immutable, content-addressed bytes `artifact-store.ts` keeps.
//
// ── WHY A SECOND CONTENT SEAM AND NOT A REUSE OF THE FIRST ──────────────────────────────────────────────────
// An `ArtifactStore` is content-addressed: the same bytes under the same retention class ARE the same stored
// object, and ~~nothing has a name~~ ⭐ no bytes have a name (2026-10-26, `JAN-EXEC` Phase 7 package O, design D22, D23: a host
// may bind a NAME it derives to an entry, once — `ArtifactStore.bindName` — which holds no content and addresses none, so a
// reader no record points at an entry can still reach it). A workspace is the opposite in the one respect that matters — it is
// PATH-NAMED and MUTABLE, because `src/index.ts` means the same thing across two steps while its bytes change.
// A step that writes a file, builds over it and then rewrites it is doing something an address-by-hash store
// cannot express at all.
//
// ── ⭑ THE SCOPE IS ONE DIRECTORY, AND EVERY FACT ABOUT IT IS DECLARED RATHER THAN INFERRED ───────────────────
// `ownerKind`, `materialization` and `purgeability` are all fields a host must STATE. Nothing in this
// repository owns a workspace today, so there is no convention a reader could infer them from — and the three
// facts decide, respectively, how long the directory lives, whether a process can be run in it, and whether its
// contents may lawfully be destroyed. `ArtifactStore.durability` set this precedent and records the reason: a
// host cannot be asked to know such a thing about an injected implementation, and a gate that recognised the
// property BY NAME would be `REG-F-333`'s defect — probing for the name while the property travels by shape.
//
// ── ⛔ `materialization` IS LOAD-BEARING: THE TWO PORTS ARE NOT INDEPENDENT ───────────────────────────────────
// A `ProcessRunner` needs a real `cwd`; an IN_MEMORY workspace has none, because a child process cannot be
// spawned against a Map. A host wiring a REAL runner against an IN_MEMORY workspace has made an error that must
// be caught BEFORE anything runs — otherwise the command executes in SOME OTHER DIRECTORY, which is the one
// failure this seam must never have. `planProcessRun` in `process-runner.ts` is where that is refused, and this
// field is what it reads.
//
// ── ⭑ PURGE MIRRORS `ArtifactStore.purge` IN SIGNATURE AND SEMANTICS — AND NOT IN ADDRESSING ─────────────────
// SAME: one argument, no actor, no clock, no reason; and "Remove the BYTES and keep the ENTRY", because a
// record referencing a purged location must stay EXPLICABLE — a reader must be able to tell "purged on
// schedule" from "never written" from "lost".
// ⛔ DIFFERENT, AND THE DIFFERENCE IS FORCED: the store puts the purgeability class IN the storage key
// (`tenantPrefix/purgeability/hash`), which is how one flat key space keeps retention legible and is what
// `REG-F-337` fixed. A workspace is path-named, so it CANNOT carry the class in its address — the same path
// must keep meaning the same file across a rewrite. The class is therefore DECLARED ON THE WORKSPACE, once,
// for everything in it.
// ⚠ AND THAT IS A REAL LOSS, STATED RATHER THAN SMOOTHED OVER: one workspace cannot hold participating and
// purgeable material side by side. A host needing both declares two workspaces. Collapsing them by coining a
// third `Purgeability` member is what this paragraph exists to forbid — `REG-Q-056` is OPEN, and the binary
// here is `PER-8`'s participation predicate rather than a retention taxonomy.
import type { Purgeability, PurgeOutcome } from './artifact-store.js';

/** Who the directory belongs to — i.e. how long it lives, and who else can see what a step wrote into it. */
export type WorkspaceOwnerKind = 'UNDERTAKING' | 'EXECUTION_PLAN' | 'EXECUTION_STEP';

/** Whether this workspace has a real filesystem location a process can be run in. */
export type WorkspaceMaterialization = 'IN_MEMORY' | 'FILESYSTEM';

/**
 * One path the workspace knows about.
 *
 * ⭑ AN ENTRY SURVIVES ITS OWN PURGE, WHICH IS WHY `purged` EXISTS AND WHY `byteSize` IS NOT ZEROED. Dropping
 * the entry would leave any record naming the path pointing at nothing; zeroing the size would read as an EMPTY
 * FILE, which is a different fact. `StoredArtifactMeta` keeps `contentHash` and `byteSize` past a purge for
 * exactly this reason, and this mirrors it.
 */
export interface WorkspaceEntry {
	/** Workspace-relative, always forward-slashed, never absolute, never containing a `..` segment. */
	readonly path: string;
	/** UTF-8 bytes the entry HELD. ⚠ After a purge the bytes are gone and this states what was removed. */
	readonly byteSize: number;
	/** True once the bytes have been purged. The entry stays — see the port header. */
	readonly purged: boolean;
	/**
	 * ⭐⭐ HOW MANY NAMES HOLD THESE BYTES — **1 means this workspace's inventory is an exclusive statement.**
	 *
	 * ⛔ IT EXISTS BECAUSE THE INVENTORY WAS FOUND MAKING A CLAIM IT COULD NOT SUPPORT (`B-6`). A HARD LINK
	 * planted inside a workspace is a SECOND NAME for a file that lives anywhere — `lstat` calls it a plain
	 * file, `realpath` answers with the link's own path under the root, and both filesystem questions a
	 * containment predicate knows how to ask answer *"contained"*. `list()` then reported **another
	 * undertaking's file as this workspace's own entry**, with a size, as an ordinary deliverable.
	 *
	 * ⭑ WHAT IS REPORTABLE IS THE COUNT, NOT THE OTHER LOCATION, AND THE FIELD IS SHAPED TO THAT LIMIT. A
	 * second name may be lawful and inside this very workspace, or it may be outside it; the filesystem answers
	 * *how many* and answers *where* to nobody. So this states the fact that IS knowable and does not imply the
	 * one that is not — the alternative being an inventory that reads as exclusive and is not.
	 *
	 * ⛔ REQUIRED, NOT OPTIONAL, AND NOT DEFAULTED. An absent value cannot distinguish *"one name"* from
	 * *"this implementation does not know"*, and the first is a measurement a reader may rely on. An
	 * implementation whose entries cannot be aliased says `1` and means it (`defaults/workspace.ts` does: a Map
	 * key is one name).
	 *
	 * ⚠ A PURGED ENTRY REPORTS `1`, AND THAT IS A STATEMENT ABOUT THE PRESENT rather than a lost measurement:
	 * the bytes are gone, so there is nothing left for a second name to hold. ⛔ It is `byteSize` that carries
	 * WHAT WAS REMOVED, because that is the only surviving statement of it; sharing was a property of bytes that
	 * no longer exist, so preserving a count for them would assert a live alias for an absent file.
	 */
	readonly nameCount: number;
}

/**
 * ⛔ A UNION, SO A REFUSAL CANNOT BE READ AS A NARROWED WRITE. A single shape with an optional error would let
 * a caller read `path` off a write that never happened — the same fabrication `ProcessRunOutcome` refuses.
 */
export type WorkspaceWriteOutcome =
	| { readonly written: true; readonly path: string; readonly byteSize: number }
	| { readonly written: false; readonly refusedBecause: string };

export interface Workspace {
	/** WHICH object owns it. A kind without an id classifies nothing, and the refusals name both. */
	readonly ownerId: string;
	/** ⭑ DECLARED BY THE HOST — see the header. Nothing in this repository owns a workspace yet. */
	readonly ownerKind: WorkspaceOwnerKind;
	readonly materialization: WorkspaceMaterialization;
	/**
	 * ⭑ DECLARED, NOT ADDRESSED — the one place this port CANNOT mirror `ArtifactStore`.
	 *
	 * It governs everything in the workspace, and `purge` reads it. `RETAINED_BY_PARTICIPATION` makes `purge`
	 * REFUSE, because `PER-8` says a thing that has participated is never hard-deleted and participation is
	 * irreversible.
	 */
	readonly purgeability: Purgeability;
	/**
	 * The absolute directory, present IFF `materialization === 'FILESYSTEM'`.
	 *
	 * ⛔ THIS IS THE ONLY VALUE THAT MAY EVER REACH A `ProcessRunner` AS `cwd`, and `planProcessRun` is the only
	 * thing that should read it. A workspace-relative path supplied by a model is resolved against it and
	 * re-checked for containment — never concatenated.
	 */
	readonly directoryPath?: string;

	/**
	 * Write UTF-8 text at a workspace-relative path.
	 *
	 * ⛔ MUST REFUSE, NEVER THROW, on a path that escapes the workspace. A refusal is a fact a step can record;
	 * a throw becomes a stack trace in a record that was supposed to say what the step was not allowed to do.
	 */
	writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome>;
	/**
	 * `undefined` when the bytes are not readable.
	 *
	 * ⚠ THAT COVERS THREE DIFFERENT FACTS — never written, escaped the workspace, and PURGED — and this method
	 * deliberately does not distinguish them, because a reader who needs to is asking a RETENTION question and
	 * `list` is where retention stays explicable. An empty file still returns the empty string, which is a
	 * fourth fact and stays distinct from all three.
	 */
	readFile(path: string): Promise<string | undefined>;
	/** Every path the workspace knows about, PURGED ONES INCLUDED, sorted so two listings are comparable. */
	list(): Promise<readonly WorkspaceEntry[]>;
	/**
	 * Remove the BYTES at one path and keep the ENTRY.
	 *
	 * Signature and semantics mirror `ArtifactStore.purge` exactly — one argument, no actor, clock or reason —
	 * so a host never learns two retention idioms. See the port header for the addressing difference.
	 */
	purge(path: string): Promise<PurgeOutcome>;
}

/**
 * The Win32 reserved device names — the stems that name a DEVICE from inside any directory rather than a file
 * in one. Derived as a pattern rather than enumerated, so `com0`, `lpt0`, `com10` and `console` stay lawful.
 */
const WIN32_DEVICE_STEM = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * The containment predicate BOTH implementations must honour, expressed once.
 *
 * ⭑ EXPORTED FROM THE PORT ON PURPOSE. `artifact-store.ts` records the same lesson about `purge`: the invariant
 * that makes a seam lawful belongs WITH the interface, so a second adapter cannot quietly implement a weaker
 * one. Returns the normalized relative path, or `undefined` when the path escapes.
 *
 * ⚠ IT REFUSES BEFORE IT NORMALIZES, for the absolute cases. Normalizing an absolute path yields an absolute
 * path that still looks tidy, so the same check applied afterwards reads as passing.
 *
 * ── ⛔ AND IT ASKS WHAT THE FILESYSTEM RESOLVES, NOT WHAT THE STRING SPELLS ───────────────────────
 * Three shapes pass every check above and still name a DIFFERENT location than they spell. All three were
 * DRIVEN before this paragraph was written:
 *   1. TRAILING DOTS AND SPACES ARE STRIPPED BY WIN32 AND KEPT BY `node:path`, so the two disagree about which
 *      directory a name means. `mkdirSync` created literal entries `'.. '`, `'...'`, `'....'`, `' ..'`,
 *      `'UND-1 '` and `'UND-1.'` in ONE directory, and a real child process launched with each of them as its
 *      `cwd` reported the first four as the PARENT directory and the last two as `UND-1` — an existing,
 *      DIFFERENT directory. Seven distinct names to a string comparison; two directories to the operating
 *      system. ⚠ LEADING spaces are PRESERVED and are therefore not refused: `' foo'` stayed `' foo'`.
 *   2. A COLON INSIDE A COMPONENT NAMES AN NTFS ALTERNATE DATA STREAM. `report.md:stolen` wrote bytes that
 *      `readdir` does not name and `stat` does not size — so any inventory built from a directory walk is
 *      incomplete BY CONSTRUCTION. The drive-letter check above only ever sees a colon in position two.
 *   3. A WIN32 DEVICE NAME IS NOT A LOCATION. Under bun, `writeFileSync(<dir>/NUL, …)` returned normally and
 *      the path did not exist afterwards (`existsSync` false, `readdir` empty, read-back ENOENT); under node
 *      the same call created a real file, because libuv reaches the filesystem through the long-path prefix
 *      that bypasses device translation. This repository runs BOTH runtimes — vitest under bun, the SvelteKit
 *      server under node — so a predicate that was right on one would be silently wrong on the other.
 *
 * ⛔ ALL THREE ARE REFUSED ON EVERY PLATFORM, AND THE OVER-REFUSAL ON POSIX IS DELIBERATE: it is the rule this
 * predicate already follows for separators — "BOTH separator spellings are refused: a Windows host accepts
 * either, so a guard that knew only one would hold on one platform and silently not on the other." A path that
 * named a file on Linux and a device on Windows would make ONE workspace path mean two things.
 */
export function containedWorkspacePath(path: string): string | undefined {
	if (path.length === 0) return undefined;
	// A drive letter (`C:` and anything after it) or a leading separator is absolute. BOTH separator spellings
	// are refused: a Windows host accepts either, so a guard that knew only one would hold on one platform and
	// silently not on the other.
	if (/^[A-Za-z]:/.test(path)) return undefined;
	if (path.startsWith('/') || path.startsWith('\\')) return undefined;
	// ⛔ A COLON ANYWHERE NAMES A STREAM OR A VOLUME, NEVER A FILE IN THIS WORKSPACE. The drive check above sees
	// only position two, and `report.md:stolen` carries its colon further along — into an NTFS alternate data
	// stream that `readdir` cannot name and `list()` therefore cannot report.
	if (path.includes(':')) return undefined;
	const out: string[] = [];
	for (const part of path.split(/[\\/]+/)) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			// ⛔ POPPING AN EMPTY STACK WOULD BE WRONG: `a/../../b` normalizes to `../b`, which is OUTSIDE.
			// Refusing on underflow IS the containment check. Refusing on EVERY `..` would also be sound but
			// would reject `a/../b`, which is inside — and a guard that refuses lawful paths teaches its
			// callers to route around it.
			if (out.length === 0) return undefined;
			out.pop();
			continue;
		}
		// ⛔ A COMPONENT THE FILESYSTEM REWRITES IS REFUSED, NEVER NORMALIZED. `'UND-1 '` and `'UND-1.'` both OPEN
		// `UND-1` and `'...'` opens the parent (measured — see the header), so stripping the suffix here would hand
		// the caller a normalized path that means a DIFFERENT directory than the one it asked for; the caller has
		// to learn that, not be rerouted.
		if (part !== part.replace(/[. ]+$/, '')) return undefined;
		// ⛔ AND A DEVICE IS NOT A LOCATION. The STEM decides, because Win32 resolves `NUL.txt` to the null device
		// just as it resolves `NUL`.
		if (WIN32_DEVICE_STEM.test(part.replace(/\.[\s\S]*$/, ''))) return undefined;
		out.push(part);
	}
	// `a/..` normalizes to the workspace ROOT, which is a directory and not a file location.
	if (out.length === 0) return undefined;
	return out.join('/');
}
