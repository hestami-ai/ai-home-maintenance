/**
 * `bun.lock`, read as data: the one reader every toolchain script uses (JAN-TOOLCUR D-7, D-9; roadmap T0).
 *
 * WHY A READER OF OUR OWN. Nothing in this repository read `bun.lock` before T0, and Bun offers no command that prints
 * it as JSON. The file is JSON with trailing commas (`lockfileVersion` 1), so `JSON.parse` refuses it as written;
 * `stripTrailingCommas` removes exactly the commas that stand before a closing `}` or `]` outside a string.
 *
 * THE KEYS ARE PATHS. `packages` is keyed by where a copy is installed: `vite` is `node_modules/vite`, and
 * `vitest/vite` is `node_modules/vitest/node_modules/vite` (8.1.4 beside the app's 7.3.6, TOOLCUR D-7). A scoped
 * name keeps its two segments, so `@sveltejs/kit/cookie` is `@sveltejs/kit` then `cookie`. `resolveFrom` walks those
 * keys the way Node walks `node_modules`: the nearest nested copy first, then each ancestor's, then the hoisted one.
 */

export interface LockPackage {
	/** The lock's own key, e.g. `vitest/vite`. */
	readonly key: string;
	/** The package's name: the key's last unit. */
	readonly name: string;
	/** The key's units before the name, joined with `/`; '' for a hoisted copy. */
	readonly parent: string;
	/** The resolved version (`vite@8.1.4` gives `8.1.4`); a workspace member reads `workspace:<path>`. */
	readonly version: string;
	/** The executables it declares, name -> path inside the package, as the lock records them. */
	readonly bin: Readonly<Record<string, string>>;
}

export interface LockWorkspace {
	readonly name?: string;
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
}

export interface Lockfile {
	readonly lockfileVersion: number;
	/** Keyed by the workspace's directory, '' for the root. */
	readonly workspaces: Readonly<Record<string, LockWorkspace>>;
	readonly packages: ReadonlyMap<string, LockPackage>;
}

/** The index just past the JSON string whose opening quote is at `start`. */
function jsonStringEnd(text: string, start: number): number {
	let i = start + 1;
	while (i < text.length && text.charAt(i) !== '"') i += text.charAt(i) === '\\' ? 2 : 1;
	return Math.min(i + 1, text.length);
}

/** The first character at or after `from` that is not white space; '' at the end. */
function nextNonSpace(text: string, from: number): string {
	let j = from;
	while (j < text.length && /\s/.test(text.charAt(j))) j++;
	return text.charAt(j);
}

/** Remove each comma that stands before a closing `}` or `]`, outside strings. Everything else is kept byte for byte. */
export function stripTrailingCommas(text: string): string {
	let out = '';
	let i = 0;
	while (i < text.length) {
		const ch = text.charAt(i);
		if (ch === '"') {
			const end = jsonStringEnd(text, i);
			out += text.slice(i, end);
			i = end;
			continue;
		}
		const closes = nextNonSpace(text, i + 1);
		if (ch !== ',' || (closes !== '}' && closes !== ']')) out += ch;
		i++;
	}
	return out;
}

/** A lock key split into package names: `@sveltejs/kit/cookie` -> [`@sveltejs/kit`, `cookie`]. */
export function splitKey(key: string): string[] {
	const segments = key.split('/');
	const units: string[] = [];
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i] ?? '';
		if (segment.startsWith('@')) {
			units.push(`${segment}/${segments[i + 1] ?? ''}`);
			i++;
		} else {
			units.push(segment);
		}
	}
	return units;
}

/** Where a lock key's copy sits, relative to the package root: `vitest/vite` -> `node_modules/vitest/node_modules/vite`. */
export function installedDir(key: string): string {
	return `node_modules/${splitKey(key).join('/node_modules/')}`;
}

/** The version in a lock identifier: `vite@8.1.4` -> `8.1.4`, `@types/node@24.13.3` -> `24.13.3`. */
function versionOf(ident: string): string {
	const at = ident.lastIndexOf('@');
	if (at <= 0) throw new Error(`a bun.lock identifier with no version: ${JSON.stringify(ident)}`);
	return ident.slice(at + 1);
}

function binOf(meta: unknown): Record<string, string> {
	if (meta === null || typeof meta !== 'object') return {};
	const bin = (meta as { bin?: unknown }).bin;
	if (bin === null || typeof bin !== 'object') return {};
	const out: Record<string, string> = {};
	for (const [name, path] of Object.entries(bin as Record<string, unknown>)) {
		if (typeof path === 'string') out[name] = path;
	}
	return out;
}

/** Parse `bun.lock` text. Throws, naming what is wrong, on anything that is not a version-1 lock. */
export function parseLockfile(text: string): Lockfile {
	const raw = JSON.parse(stripTrailingCommas(text)) as {
		lockfileVersion?: unknown;
		workspaces?: unknown;
		packages?: unknown;
	};
	if (raw.lockfileVersion !== 1) {
		throw new Error(`bun.lock: lockfileVersion is ${JSON.stringify(raw.lockfileVersion)}, and this reader knows 1`);
	}
	if (raw.workspaces === null || typeof raw.workspaces !== 'object') throw new Error('bun.lock: no workspaces object');
	if (raw.packages === null || typeof raw.packages !== 'object') throw new Error('bun.lock: no packages object');
	const packages = new Map<string, LockPackage>();
	for (const [key, value] of Object.entries(raw.packages as Record<string, unknown>)) {
		if (!Array.isArray(value) || typeof value[0] !== 'string') {
			throw new TypeError(`bun.lock: the entry for ${key} is not [identifier, ...]`);
		}
		const units = splitKey(key);
		const name = units.at(-1) ?? '';
		packages.set(key, {
			key,
			name,
			parent: units.slice(0, -1).join('/'),
			version: versionOf(value[0]),
			bin: binOf(value[2])
		});
	}
	return {
		lockfileVersion: 1,
		workspaces: raw.workspaces as Record<string, LockWorkspace>,
		packages
	};
}

/** Every copy of a package the lock holds, the hoisted one first, then the nested ones by key. */
export function copiesOf(lock: Lockfile, name: string): LockPackage[] {
	const copies = [...lock.packages.values()].filter((p) => p.name === name);
	// The hoisted copy's sort key is '', which sorts before every nested key.
	const order = (p: LockPackage): string => (p.parent === '' ? '' : p.key);
	return copies.sort((a, b) => order(a).localeCompare(order(b)));
}

/**
 * The copy of `name` that the package at `fromKey` resolves, as Node walks `node_modules`: `fromKey/name`, then each
 * ancestor's `…/name`, then the hoisted `name`. Undefined when none is in the lock.
 */
export function resolveFrom(lock: Lockfile, fromKey: string, name: string): LockPackage | undefined {
	const units = splitKey(fromKey);
	for (let depth = units.length; depth >= 0; depth--) {
		const key = [...units.slice(0, depth), name].join('/');
		const found = lock.packages.get(key);
		if (found !== undefined) return found;
	}
	return undefined;
}
