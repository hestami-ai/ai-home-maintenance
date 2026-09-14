// SPIKE (spike/tool-execution) — Workspace port: the directory an execution step may write into.
//
// ── WHY A PORT AND NOT A HELPER ─────────────────────────────────────────────────────────────────────────────
// The kernel must be able to say "this step wrote a file" without knowing whether the host is a SvelteKit demo,
// a CLI, or a container. `artifact-store.ts` already draws this line for ARTIFACT BYTES; this draws it for the
// MUTABLE WORKING SET a step builds up while it works. They are different things and both are needed: an
// artifact is content-addressed, immutable and retained; a workspace file is a path the next step overwrites.
//
// ── ⭑ THE SCOPE IS ONE DIRECTORY, AND THE OWNER IS DECLARED, NOT ASSUMED ────────────────────────────────────
// `ownerKind` exists because the spike could not answer "whose lifecycle owns this directory?" by reading the
// code — nothing in the repository owns a workspace today. So the port makes the answer a FIELD a host must
// state, rather than a convention a reader would have to infer from where the object happens to be created.
//
// ── ⛔ `materialization` IS LOAD-BEARING, AND THE SPIKE DISCOVERED IT ────────────────────────────────────────
// A ProcessRunner needs a real `cwd`. An in-memory workspace has none — you cannot spawn a child process
// against a Map. So the two ports are NOT independent, and a host that wires a real runner against an
// in-memory workspace has made an error that must be detectable BEFORE anything runs. This declares it, the
// way `ArtifactStore.durability` declares that its bytes do not survive a restart.

/** Who the directory belongs to — i.e. how long it lives and who else can see what a step wrote. */
export type WorkspaceOwnerKind = 'UNDERTAKING' | 'EXECUTION_PLAN' | 'EXECUTION_STEP';

/** Whether this workspace has a real filesystem location a process can be run in. */
export type WorkspaceMaterialization = 'IN_MEMORY' | 'FILESYSTEM';

export interface WorkspaceEntry {
	/** Workspace-relative, always forward-slashed, never absolute, never containing `..`. */
	readonly path: string;
	readonly byteSize: number;
}

export type WorkspaceWriteOutcome =
	| { readonly written: true; readonly path: string; readonly byteSize: number }
	| { readonly written: false; readonly refusedBecause: string };

export interface Workspace {
	/** The id of the object whose lifecycle owns this directory. */
	readonly ownerId: string;
	/** ⭑ DECLARED BY THE HOST. See the header: nothing in the repository owns a workspace yet. */
	readonly ownerKind: WorkspaceOwnerKind;
	readonly materialization: WorkspaceMaterialization;
	/**
	 * The absolute directory, present IFF `materialization === 'FILESYSTEM'`.
	 *
	 * ⛔ This is the only value that may ever be handed to a `ProcessRunner` as `cwd`. A workspace-relative
	 * path supplied by a model must be resolved against it and re-checked for containment, never concatenated.
	 */
	readonly directoryPath?: string;

	/**
	 * Write UTF-8 text at a workspace-relative path.
	 *
	 * ⛔ MUST REFUSE, NEVER THROW, on a path that escapes the workspace (absolute, drive-qualified, or
	 * containing a `..` segment that resolves outside). A refusal is a fact a step can record; a throw becomes
	 * a stack trace in a record that was supposed to say what the step was not allowed to do.
	 */
	writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome>;
	/** `undefined` when no such path exists — distinct from an empty file, which returns `''`. */
	readFile(path: string): Promise<string | undefined>;
	/** Every file currently in the workspace, sorted by path so two listings are comparable. */
	list(): Promise<readonly WorkspaceEntry[]>;
}

/**
 * The containment predicate BOTH implementations must honour, expressed once.
 *
 * ⭑ EXPORTED FROM THE PORT ON PURPOSE. `artifact-store.ts` records the same lesson about `purge`: the
 * invariant that makes the seam lawful belongs with the interface, so a second adapter cannot quietly
 * implement a weaker one. Returns the normalized relative path, or `undefined` when the path escapes.
 */
export function containedWorkspacePath(path: string): string | undefined {
	if (path.length === 0) return undefined;
	// A drive letter or a leading separator is absolute — reject before any normalization, because
	// normalization of an absolute path yields an absolute path that still looks tidy.
	if (/^[A-Za-z]:/.test(path)) return undefined;
	if (path.startsWith('/') || path.startsWith('\\')) return undefined;
	const parts = path.split(/[\\/]+/);
	const out: string[] = [];
	for (const part of parts) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			// ⛔ POPPING WOULD BE WRONG WHEN THE STACK IS EMPTY: `a/../../b` normalizes to `../b`, which is
			// outside. Refusing on underflow is the containment check; refusing on every `..` would also be
			// sound but would reject `a/../b`, which is inside.
			if (out.length === 0) return undefined;
			out.pop();
			continue;
		}
		out.push(part);
	}
	if (out.length === 0) return undefined;
	return out.join('/');
}
