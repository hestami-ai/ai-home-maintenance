// SPIKE (spike/tool-execution) — the reference IN-MEMORY Workspace, mirroring `defaults/artifact-store.ts`.
//
// ⛔ THE GATE MUST STAY HERMETIC. This is the default precisely so that no existing test gains a real
// filesystem by importing the port. It genuinely stores and reads back, so it is a working implementation
// rather than a stub — and it declares `IN_MEMORY`, so a host that then hands it to a real ProcessRunner
// has made a detectable error rather than a silent one.
import {
	containedWorkspacePath,
	type Workspace,
	type WorkspaceEntry,
	type WorkspaceOwnerKind,
	type WorkspaceWriteOutcome
} from '../ports/workspace.js';

export function createInMemoryWorkspace(ownerKind: WorkspaceOwnerKind, ownerId: string): Workspace {
	const files = new Map<string, string>();
	return {
		ownerId,
		ownerKind,
		materialization: 'IN_MEMORY',
		async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
			const rel = containedWorkspacePath(path);
			if (rel === undefined)
				return {
					written: false,
					refusedBecause: `'${path}' does not name a location inside this workspace. A workspace path is relative, uses no drive letter, and may not resolve above the workspace root.`
				};
			files.set(rel, contents);
			return { written: true, path: rel, byteSize: Buffer.byteLength(contents, 'utf8') };
		},
		async readFile(path: string): Promise<string | undefined> {
			const rel = containedWorkspacePath(path);
			return rel === undefined ? undefined : files.get(rel);
		},
		async list(): Promise<readonly WorkspaceEntry[]> {
			return [...files.entries()]
				.map(([path, contents]): WorkspaceEntry => ({ path, byteSize: Buffer.byteLength(contents, 'utf8') }))
				.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		}
	};
}
