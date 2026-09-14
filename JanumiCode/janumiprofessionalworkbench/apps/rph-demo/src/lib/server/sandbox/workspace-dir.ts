// SPIKE (spike/tool-execution) — the HOST's real Workspace adapter: one directory on disk.
//
// ⚠ THE ADAPTER LIVES IN THE APP, NOT THE LIBRARY, and that is the sponsor's ruling restated: the kernel
// holds the seam, the host holds the filesystem. `packages/rph-ports` never imports `node:fs`.
//
// ⛔ CONTAINMENT IS CHECKED TWICE AND THAT IS DELIBERATE. `containedWorkspacePath` normalizes the model's
// string; `resolve` + prefix test then re-checks the RESULT, because normalization and the platform's own
// path resolution are different functions and only the second one is what `writeFileSync` will obey.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
	containedWorkspacePath,
	type Workspace,
	type WorkspaceEntry,
	type WorkspaceOwnerKind,
	type WorkspaceWriteOutcome
} from '@janumipwb/rph-ports';

/** Every file under `dir`, workspace-relative and forward-slashed. */
function walk(root: string, dir: string, out: WorkspaceEntry[]): void {
	for (const name of readdirSync(dir)) {
		const abs = join(dir, name);
		const st = statSync(abs);
		if (st.isDirectory()) walk(root, abs, out);
		else out.push({ path: relative(root, abs).split(sep).join('/'), byteSize: st.size });
	}
}

export function createDirectoryWorkspace(
	ownerKind: WorkspaceOwnerKind,
	ownerId: string,
	directoryPath: string
): Workspace {
	mkdirSync(directoryPath, { recursive: true });
	const root = resolve(directoryPath);
	/** The second containment check — against what the OS will actually resolve. */
	const inside = (rel: string): string | undefined => {
		const abs = resolve(root, rel);
		return abs === root || abs.startsWith(root + sep) ? abs : undefined;
	};
	return {
		ownerId,
		ownerKind,
		materialization: 'FILESYSTEM',
		directoryPath: root,
		async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
			const rel = containedWorkspacePath(path);
			const abs = rel === undefined ? undefined : inside(rel);
			if (rel === undefined || abs === undefined)
				return {
					written: false,
					refusedBecause: `'${path}' does not name a location inside this workspace. A workspace path is relative, uses no drive letter, and may not resolve above the workspace root.`
				};
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, contents, 'utf8');
			return { written: true, path: rel, byteSize: Buffer.byteLength(contents, 'utf8') };
		},
		async readFile(path: string): Promise<string | undefined> {
			const rel = containedWorkspacePath(path);
			const abs = rel === undefined ? undefined : inside(rel);
			if (abs === undefined) return undefined;
			try {
				return readFileSync(abs, 'utf8');
			} catch {
				return undefined;
			}
		},
		async list(): Promise<readonly WorkspaceEntry[]> {
			const out: WorkspaceEntry[] = [];
			walk(root, root, out);
			return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		}
	};
}

/** A fresh temp directory workspace. ⚠ The CALLER decides the owner — see the port's note on `ownerKind`. */
export function createTempWorkspace(ownerKind: WorkspaceOwnerKind, ownerId: string): Workspace {
	return createDirectoryWorkspace(ownerKind, ownerId, mkdtempSync(join(tmpdir(), 'jpwb-ws-')));
}
