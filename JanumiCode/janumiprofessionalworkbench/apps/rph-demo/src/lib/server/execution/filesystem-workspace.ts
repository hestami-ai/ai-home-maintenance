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
// ⛔ AND THE RECORD IS KEPT BESIDE THE WORKSPACE DIRECTORY, NEVER INSIDE IT — WHICH IS A CORRECTION, NOT A
// PREFERENCE. It used to live in the directory it describes, under a RESERVED name that `writeFile` and `purge`
// refused. Two adversaries defeated that guard in a row and both won the same way: they spelled the name
// differently from the guard while the FILESYSTEM read both spellings as the same file. First
// `.JPWB-WORKSPACE-TOMBSTONES.JSON` — case, folded away — and then the NTFS 8.3 ALIAS `JPWB-W~1.JSO`, which
// `dir /x` reports verbatim against `.jpwb-workspace-tombstones.json` on this host: driven, `writeFile` answered
// `written: true`, the directory kept its ONE lower-case entry, and `list()` stopped reporting the path actually
// purged. ⭐ PUTTING A RESERVED PATH INSIDE A DIRECTORY THE MODEL WRITES TO IS WHAT CREATES THAT CLASS OF
// BREACH. A sibling has no spelling a contained path can reach — `locate` admits only paths that resolve at or
// under the root — so the guard, the case-folding normaliser and both breaches are gone TOGETHER, rather than
// one spelling being patched at a time while the next one is invented.
//
// ⚠ AND THE NORMALISER WAS WORSE THAN INSUFFICIENT: IT MADE A FALSE STATEMENT ABOUT ITS INPUT. `toLowerCase()`
// folds MORE than NTFS does — measured here, `.jpwb-wor\u212Aspace-tombstones.json` (KELVIN SIGN) and
// `.jpwb-workspace-tombstones.json` coexist as TWO files holding different bytes — yet the guard refused the
// first one claiming it *"is this workspace's own retention record"*, which was untrue of the caller's path. A
// refusal that states something false about what it was given is worse than no refusal at all.
//
// ⛔ ITS ONE PRECONDITION IS CHECKED AT CONSTRUCTION: a directory with no parent (a volume root) has no
// "beside", so the workspace refuses to open rather than quietly reinstating a reserved name inside.
//
// ── ⭐ WHAT THIS BOUNDARY IS, AND WHAT IT IS NOT — SPONSOR RULING, 2026-09-14 ───────────────────────────
// ⭐ THIS IS AN ORGANISATIONAL BOUNDARY TODAY. Verbatim: *"It's both organisational and security with
// organizational now and security later."* What it buys is that ONE Undertaking's work lands in ONE place a
// person can inspect after the undertaking ends; that a step cannot scatter it through the server's own source
// tree; and that the ordinary mistakes — a stray `../`, an absolute path, a name Win32 rewrites, a device, a
// stream — are REFUSED with a fact a step can record instead of silently meaning somewhere else. That is worth
// having and it is what is claimed.
//
// ⛔ IT IS NOT A SECURITY BOUNDARY AGAINST AN ADVERSARIAL MODEL, AND IT CANNOT BE MADE INTO ONE BY COMPARING
// PATH STRINGS IN USERSPACE. Every check here runs in the same process, with the same credentials, on the same
// filesystem as the thing it is checking; the operating system resolves names by rules no string comparison
// reproduces; and this seam's own history is the evidence. The set of spellings it has had to learn grew one
// adversary at a time — `..`, both separators and a drive letter; then a trailing dot, a Win32 device stem and
// a colon; then the retention record's CASE; then the retention record's NTFS 8.3 ALIAS — and every one of them
// was the SAME location wearing a name the comparison did not recognise as that location.
//
// ⭑ THE SECURITY BOUNDARY IS THE DEPLOYMENT ENVIRONMENT'S, AND THAT IS WHY `Workspace` AND `ProcessRunner` ARE
// PORTS RATHER THAN FUNCTIONS: they are the seam an OS-level sandbox SUPPLIES. *"From local to SaaS to
// Enterprise"* — locally the VS Code extension host, on the Janumi Platform OS-level sandboxing (Alibaba's
// OpenSandbox and/or NVIDIA's OpenShell are the named candidates), in Enterprise container isolation. ⭑ The
// corpus already anticipated this and it is not an invention of this commit:
// `packages/rph-contracts/vocab/m1-object-fields.json` records `SandboxPolicy` as *"DEFERRED TO THE PLATFORM
// POLICY PLANE … the sandbox backend sits behind an abstracted runtime boundary precisely so the concrete tool
// (OpenSandbox / K8s Jobs+gVisor / a harness's own policy file) stays swappable."* The ruling is recorded in
// `docs/_working/DESIGN-undertaking-execution-sandbox.md` §4.8.
//
// ── ⛔ THE VECTORS, NAMED, EACH WITH WHAT IS ACTUALLY TRUE OF IT ─────────────────────────────────
// ⛔ THE DISCLOSURE THIS REPLACES SAID *"WHAT REMAINS IS A RACE, NOT A HOLE."* THAT WAS FALSE. Two of the five
// below — the HARD LINK and the ROOT SWAP — are open holes, not races: nothing has to be timed, nothing has to
// be swapped mid-call, and both were driven to completion against this adapter.
//
// ⚠ AND NEITHER NEEDS A PRIVILEGE. `mklink /H` and `mklink /J` both ran on this host as an ordinary user with
// an unelevated shell (measured: `WindowsPrincipal.IsInRole(Administrator)` = False) and Developer Mode off.
// ⛔ THE PRECONDITION IS STATED BECAUSE THE LAST DISCLOSURE OVERSTATED ITS OWN — it said symlinks were the
// exposure and "nothing in this host creates one", and the vector that arrived needed no symlink and no right
// to make one. An exposure whose PRECONDITION is overstated reads as closed.
//
//  1. HARD LINK — ⛔ **OPEN, AND REPORTED AS IN-WORKSPACE.** Driven: a `mklink /H` hard link placed inside the
//     workspace, pointing at a file outside it, was READ (`SECRET=1`), OVERWRITTEN by `writeFile`, and named by
//     `list()` as an ordinary in-workspace entry. Both filesystem questions this adapter knows how to ask answer
//     "contained": `lstat` reports `isSymbolicLink() === false` and `isFile() === true`, and `realpath` returns
//     THE LINK'S OWN PATH under the root — because a hard link is a second NAME for one file, not a pointer to
//     another. The only signal is `nlink === 2`, which says a second name exists and nothing whatever about
//     WHERE it is: a lawful second link inside the workspace reports the same 2.
//  2. ROOT SWAP — ⛔ **OPEN, PERSISTENT AND UNDETECTED.** A junction standing where the workspace ROOT was
//     redirects the ENTIRE workspace: `realpath(root)` resolves to the attacker's directory, every child then
//     resolves under it, and containment holds — against the wrong root. Driven: a planted file was read
//     through the workspace and a step's write landed outside it. ⚠ This is NOT the TOCTOU race below: nothing
//     is swapped mid-call, and the redirection survives a restart.
//  3. JUNCTION OR SYMLINK INSIDE THE WORKSPACE — ⭑ **REFUSED**, and this is the one that IS closed. `locate`
//     resolves the deepest EXISTING ancestor with `realpath` — which resolves junctions, measured — and
//     requires it to be inside the resolved root; `livePaths` walks with `lstat` and neither descends into a
//     link nor reports one. ⚠ WHAT REMAINS HERE IS A RACE: a directory swapped for a junction BETWEEN the
//     check and the write is not caught. One Undertaking drives its steps in sequence; a host that
//     parallelises them needs more than this.
//  4. ALTERNATE DATA STREAM — ⭑ **THE VECTOR IS REFUSED; THE BLIND SPOT IS NOT CLOSED.** A colon anywhere in a
//     workspace path is refused, so nothing a step writes THROUGH this workspace can reach a stream. But
//     `list()` still cannot ENUMERATE streams and no adapter written on `node:fs` can — there is no API — so a
//     stream attached by anything else (a child process under Phase 3, a tool run outside this seam) holds
//     bytes this inventory does not name. **UNREPORTED, not refused.**
//  5. 8.3 SHORT NAMES — ⭑ **NO LONGER A CONTAINMENT VECTOR; STILL AN ALIASING ONE.** With the record outside
//     the workspace, `JPWB-W~1.JSO` reaches nothing it did not already own. Two LONG names a step writes into
//     one directory can still collide through their generated short names, in which case one write lands on the
//     other's bytes — an intra-workspace aliasing fact, not an escape, and `list()` still names every file
//     that exists.
//
// ⚠ AND THE INVENTORY IS BOUNDED IN THE OTHER DIRECTION TOO: `list()` reports what is UNDER the root, so on a
// case-sensitive host a foreign process can leave a name this workspace's own predicate refuses (`a:b`, or a
// file actually called `NUL`) — reported by `list()`, and neither readable nor purgeable THROUGH the workspace.
// Reporting it is the honest answer: the inventory says what is THERE, the refusal says what this seam will
// ADDRESS, and suppressing it would make the inventory lie to protect the symmetry.
//
// ⚠ LAST WRITE WINS. The retention record is read and rewritten per call with no lock, so two concurrent purges
// in one workspace can lose one entry. The owner is ONE Undertaking and this host drives its steps in sequence.
//
// ⚠ AND `list()` IS THE ONE METHOD THAT STILL THROWS. A file removed between the directory walk and its `stat`
// raises out of the promise. `writeFile` and `purge` refuse instead, because they are what a step calls and what
// a step records; `list()` is not claimed to have that property and this line is why.
import {
	lstat,
	mkdir,
	readFile as fsReadFile,
	readdir,
	realpath,
	rm,
	stat,
	writeFile as fsWriteFile
} from 'node:fs/promises';
import { basename, dirname, join, resolve as resolvePath, sep } from 'node:path';
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
 * Appended to the workspace DIRECTORY's own path to name the retention record BESIDE it.
 *
 * ⛔ A SIBLING, NOT A MEMBER, AND NOT EXPORTED. Nothing outside this module needs the name, and a caller that
 * held it could only be trying to address the record — which is the thing this arrangement makes unaddressable.
 * See the header for the two breaches that made a reserved name inside the directory untenable.
 */
const TOMBSTONE_RECORD_SUFFIX = '.jpwb-workspace-tombstones.json';

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
	// ⛔ THE ONE PRECONDITION THE SIBLING ARRANGEMENT HAS, REFUSED RATHER THAN WORKED AROUND. At a volume root
	// `dirname(root) === root`, so "beside the directory" and "inside the directory" are the same place and the
	// guarantee the header rests on would be false. Falling back to a reserved name INSIDE would reinstate the
	// exact breach class this arrangement exists to delete, so the workspace does not open at all.
	if (dirname(root) === root)
		throw new Error(
			`'${input.directoryPath}' cannot be a workspace directory: it has no parent, so this workspace's retention record could only be kept INSIDE the directory a step writes to — and a record a step can name is the delete vector this adapter is arranged to make unreachable. An Undertaking workspace is a subdirectory of a durable root, never a volume root.`
		);
	// ⭐ BESIDE, NOT INSIDE. `locate` admits only paths resolving at or under `root`, so no path this workspace
	// will accept is the record — under any spelling, on any filesystem, without a comparison being right.
	const recordPath = join(dirname(root), `${basename(root)}${TOMBSTONE_RECORD_SUFFIX}`);

	/**
	 * Resolve a caller-supplied path to an absolute location inside this workspace, or refuse.
	 *
	 * ⭑ THE CONTAINMENT CHECK RUNS THREE TIMES, AND ONLY THE THIRD ASKS THE FILESYSTEM. The port's instruction
	 * is the first two: "A workspace-relative path supplied by a model is resolved against it and re-checked for
	 * containment — never concatenated." `containedWorkspacePath` is the primary and it is the one carrying
	 * declared guards; the prefix re-check below is DEFENCE IN DEPTH over the join, and it is honestly redundant
	 * today — no input the predicate admits escapes the root once resolved. It is written anyway because the
	 * predicate lives in another package, and a future weakening of it would otherwise reach this host's real
	 * filesystem with nothing in between.
	 *
	 * ⛔ BOTH OF THOSE ARE PROPERTIES OF THE PATH TEXT, AND A JUNCTION DEFEATS BOTH — which is what
	 * `insideResolvedRoot` is for, and why this function is async. `escape/.env` is a tidy relative path under
	 * the root no matter what `escape` actually is on disk.
	 */
	async function locate(
		path: string
	): Promise<{ readonly rel: string; readonly abs: string } | undefined> {
		const rel = containedWorkspacePath(path);
		if (rel === undefined) return undefined;
		const abs = resolvePath(root, rel);
		if (abs !== root && !abs.startsWith(root + sep)) return undefined;
		return (await insideResolvedRoot(abs)) ? { rel, abs } : undefined;
	}

	/**
	 * The THIRD check, and the only one a JUNCTION cannot walk past — see bound 1 in the header.
	 *
	 * ⛔ IT ASKS THE FILESYSTEM, NOT THE STRING. Both checks above are properties of the path text, and
	 * `<workspace>/escape/.env` is a tidy relative path under the root no matter what `escape` actually is.
	 * `realpath` resolves reparse points — measured on a `mklink /J` junction: `<ws>/escape/.env` resolved to
	 * `<container>/outside/.env`, outside the root — so resolving the deepest ancestor that EXISTS and requiring
	 * IT to be inside the resolved root decides containment for a path that does not exist yet as well. The root
	 * is resolved too, because a short (8.3) or linked root would otherwise never prefix-match its own children.
	 */
	async function insideResolvedRoot(abs: string): Promise<boolean> {
		let resolvedRoot: string;
		try {
			resolvedRoot = await realpath(root);
		} catch {
			// The workspace directory does not exist yet, so nothing exists under it to be traversed THROUGH. An
			// empty workspace is a fact, not a failure — the same posture `livePaths` takes.
			return true;
		}
		let probe = abs;
		for (;;) {
			try {
				const real = await realpath(probe);
				return real === resolvedRoot || real.startsWith(resolvedRoot + sep);
			} catch {
				const parent = dirname(probe);
				// A fixed point is the volume root: nothing on the way to `abs` exists, and it is not under ours.
				if (parent === probe) return false;
				probe = parent;
			}
		}
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

	/** Every live file under the directory, workspace-relative and forward-slashed. */
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
			// ⛔ `lstat`, NEVER `stat`, AND A LINK IS NOT PART OF THE DELIVERABLE. `stat` follows a junction, so the
			// walk descended THROUGH one and reported files from outside the workspace as in-workspace entries — the
			// escape and its concealment in one line. A link is skipped rather than reported because reporting it
			// with a `byteSize` would state that this workspace holds bytes that live somewhere else entirely.
			const info = await lstat(join(dir, name));
			if (info.isSymbolicLink()) continue;
			if (info.isDirectory()) await livePaths(join(dir, name), rel, out);
			else if (info.isFile()) out.push(rel);
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
			const at = await locate(path);
			if (at === undefined)
				return {
					written: false,
					refusedBecause: `'${path}' does not name a location inside this workspace. A workspace path is relative, carries no drive letter and no colon, names no reserved device, has no component ending in a dot or a space, may not resolve above the workspace root, and may not resolve outside it through a directory junction or symlink standing inside it. This boundary is ORGANISATIONAL — it keeps an undertaking's work in one place — and the security boundary is the deployment environment's rather than this refusal's.`
				};
			try {
				await mkdir(dirname(at.abs), { recursive: true });
				await fsWriteFile(at.abs, contents, 'utf8');
			} catch (cause) {
				// ⛔ THE PORT REQUIRES A REFUSAL HERE, NOT A THROW: "a throw becomes a stack trace in a record that was
				// supposed to say what the step was not allowed to do." Every other refusal in this adapter is decided
				// from the path; this is the one that cannot be — writing over an existing DIRECTORY raised `EISDIR`
				// straight out of the promise — and it must reach the same shape. ⚠ THE CODE, NOT THE MESSAGE: the
				// message carries the host's absolute path, which belongs in nothing a step records.
				const code = (cause as NodeJS.ErrnoException | undefined)?.code;
				return {
					written: false,
					refusedBecause: `'${at.rel}' could not be written: the filesystem refused it (${code ?? 'unknown cause'}). Nothing was written, and nothing about the rest of the workspace changed.`
				};
			}
			// ⚠ A REWRITE CLEARS THE TOMBSTONE, DELIBERATELY — the in-memory default's rule restated on disk: a
			// path that was purged and is then written again holds bytes, and reporting it as still purged would
			// state an absence that is no longer true.
			// ⛔ AND A FAILURE TO CLEAR IT MAY NOT BECOME A THROW OUT OF A COMPLETED WRITE. The bytes are on disk;
			// the outcome says so; and `list()` already lets a LIVE path win over its own tombstone, so a record
			// that could not be rewritten changes nothing a reader can see.
			try {
				const stones = await readTombstones();
				if (at.rel in stones) {
					const rest = { ...stones };
					delete rest[at.rel];
					await writeTombstones(rest);
				}
			} catch {
				// See above: superseded by presence, which `list()` enforces without this.
			}
			return { written: true, path: at.rel, byteSize: Buffer.byteLength(contents, 'utf8') };
		},

		async readFile(path: string): Promise<string | undefined> {
			const at = await locate(path);
			if (at === undefined) return undefined;
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
			const at = await locate(path);
			if (at === undefined)
				return {
					purged: false,
					refusedBecause: `'${path}' does not name a location inside this workspace, so nothing was purged. A workspace path is relative, carries no drive letter and no colon, names no reserved device, has no component ending in a dot or a space, may not resolve above the workspace root, and may not resolve outside it through a directory junction or symlink standing inside it. A purge that silently succeeded on an out-of-workspace path would be a delete vector wearing a retention label.`
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
			// ⛔ THE ENTRY IS WRITTEN BEFORE THE BYTES GO, AND THE ORDER IS THE WHOLE OF THE FAILURE STORY. If the
			// record cannot be written, nothing is removed and the caller gets a refusal. If the removal then
			// fails, the record names a path that still holds bytes — and `list()` already lets a LIVE path win
			// over its own tombstone, so the entry reports `purged: false`, which is true. The opposite order has
			// a state NEITHER arm of `PurgeOutcome` can describe: bytes gone, entry lost.
			if (byteSize !== undefined)
				try {
					await writeTombstones({ ...stones, [at.rel]: { byteSize } });
					await rm(at.abs, { force: true });
				} catch (cause) {
					// ⛔ THE SIBLING OF `writeFile`'s SAME CASE, AND THE COMMIT THAT WRAPPED THAT ONE LEFT THIS ONE
					// BARE. Driven: `purge('sub')` on a real subdirectory threw `ERR_FS_EISDIR` (node) / `EFAULT`
					// (bun) straight out of the promise, and BOTH messages carried this host's absolute path. The
					// port's rule is one rule for both methods: a refusal is a fact a step can record; a throw is a
					// stack trace where a retention fact belongs. ⚠ THE CODE, NOT THE MESSAGE, for that reason.
					const code = (cause as NodeJS.ErrnoException | undefined)?.code;
					return {
						purged: false,
						refusedBecause: `'${at.rel}' could not be purged: the filesystem refused it (${code ?? 'unknown cause'}). No bytes were removed, and nothing about the rest of the workspace changed.`
					};
				}
			return { purged: true };
		}
	};
}
