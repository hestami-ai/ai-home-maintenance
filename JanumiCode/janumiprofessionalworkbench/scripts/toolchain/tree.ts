/**
 * The repository inputs the toolchain scripts read, through one reader that a test can redirect (roadmap T0).
 *
 * WHY OVERRIDES RATHER THAN FIXTURE TREES. Each predicted red must trip ONE condition and leave the others green
 * (roadmap T0: "Each red trips one condition and asserts its message"). A hand-built fixture tree would have to
 * reproduce 542 locked packages, 13 manifests and the gate's bins to keep the other conditions green, and a gap in it
 * would trip a second condition — a red that then proves neither. So a test runs the real tree and replaces exactly
 * the files its red is about: `--override=<path relative to the root>=<file>`. Every read goes through `read`, so an
 * override reaches every condition that reads that file, and nothing else changes.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface TreeReader {
	readonly root: string;
	/** The file's text, or undefined when it does not exist. Paths are relative to the root, with `/`. */
	read(rel: string): string | undefined;
	/** The overridden files, for the report's header. */
	readonly overridden: readonly string[];
}

/** `--override=<rel>=<file>` flags -> rel -> file. A malformed flag throws, naming it. */
export function parseOverrides(flags: readonly string[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const flag of flags) {
		if (!flag.startsWith('--override=')) continue;
		const body = flag.slice('--override='.length);
		const eq = body.indexOf('=');
		if (eq <= 0 || eq === body.length - 1) throw new Error(`malformed ${flag}: expected --override=<path>=<file>`);
		out.set(body.slice(0, eq).replaceAll('\\', '/'), body.slice(eq + 1));
	}
	return out;
}

export function makeReader(root: string, overrides: ReadonlyMap<string, string> = new Map()): TreeReader {
	return {
		root,
		overridden: [...overrides.keys()].sort((a, b) => a.localeCompare(b)),
		read(rel: string): string | undefined {
			const file = overrides.get(rel) ?? join(root, rel);
			return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
		}
	};
}

export interface Manifest {
	readonly name?: string;
	readonly workspaces?: readonly string[];
	readonly scripts?: Readonly<Record<string, string>>;
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
	readonly engines?: Readonly<Record<string, string>>;
	readonly devEngines?: { readonly packageManager?: { readonly name?: string; readonly version?: string } };
}

export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

export function readManifest(reader: TreeReader, dir: string): Manifest | undefined {
	const text = reader.read(dir === '.' ? 'package.json' : `${dir}/package.json`);
	return text === undefined ? undefined : (JSON.parse(text) as Manifest);
}

/**
 * The workspace directories the root manifest declares, '.' first. Only `dir/*` patterns are expanded, which is all
 * JPWB uses (`packages/*`, `apps/*`); any other shape throws rather than being silently skipped.
 */
export function workspaceDirs(reader: TreeReader): string[] {
	const root = readManifest(reader, '.');
	if (root === undefined) throw new Error('no root package.json');
	const dirs = ['.'];
	for (const pattern of root.workspaces ?? []) {
		const m = /^([^*]+)\/\*$/.exec(pattern);
		if (m === null) throw new Error(`workspace pattern ${JSON.stringify(pattern)} is not of the form dir/*`);
		const parent = join(reader.root, m[1] ?? '');
		if (!existsSync(parent)) continue;
		for (const name of readdirSync(parent).sort((a, b) => a.localeCompare(b))) {
			const dir = `${m[1]}/${name}`;
			if (statSync(join(parent, name)).isDirectory() && reader.read(`${dir}/package.json`) !== undefined) dirs.push(dir);
		}
	}
	return dirs;
}

/** Every external (non-workspace) dependency a manifest declares: name -> range, across its four sections. */
export function externalDeclarations(manifest: Manifest): Map<string, string> {
	const out = new Map<string, string>();
	for (const section of DEPENDENCY_SECTIONS) {
		for (const [name, range] of Object.entries(manifest[section] ?? {})) {
			if (range.startsWith('workspace:')) continue;
			out.set(name, range);
		}
	}
	return out;
}
