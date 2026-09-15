/**
 * The PURE half of `gen:check` — population, parsing and comparison, with no filesystem mutation and no exit.
 *
 * ── ⛔ WHY IT IS SPLIT OUT, WHICH IS THE `N-14` LESSON APPLIED TO A NEW INSTRUMENT ──────────────────────────
 * `scripts/gen-freshness.ts` runs the generators and REWRITES a scratch copy at module scope. A test importing
 * it would perform the very work it is trying to check, and every assertion would then pass by construction —
 * exactly what `emit.ts` does to `schemas/`, which is why `schema-manifest.ts` exists beside it. ⭑ This file is
 * that `schema-manifest.ts`: the driver imports it, the test imports it, and neither owns the logic.
 *
 * ⚠ AND IT IS WHAT LETS THE CHECKER BE CHECKED AT ALL. `REG-005` records a standing ratchet dying silently in
 * `verif/` for two days because nothing gated the gate. A freshness check whose population could silently become
 * empty would report *"every generated artifact matches its source"* over nothing at all, and read as a pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Directories that are build output or dependencies — never generated source, never compared. */
export const NOT_SOURCE: ReadonlySet<string> = new Set([
	'node_modules',
	'dist',
	'build',
	'coverage',
	'.turbo',
	'.svelte-kit'
]);

export interface GenPackage {
	/** Repo-relative, forward-slashed, e.g. `packages/rph-contracts`. */
	readonly dir: string;
	/** Generator entrypoints, relative to `dir`, in the order the package's own script runs them. */
	readonly generators: readonly string[];
	/** Files the package's `gen:format` step formats, relative to `dir`. */
	readonly formatted: readonly string[];
}

export function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/**
 * Every workspace directory, DERIVED from the root `workspaces` globs rather than listed here.
 *
 * ⛔ A glob shape this cannot expand is a hard error, not a skip. Silently returning fewer packages makes the
 * whole gate pass over a smaller population, and a population that shrinks unnoticed is the one failure mode a
 * freshness check must not have.
 */
export function workspaceDirs(root: string): string[] {
	const globs = readJson(`${root}package.json`).workspaces;
	if (!Array.isArray(globs))
		throw new Error(
			'gen:check — the root package.json declares no `workspaces` array, so no package would be compared.'
		);
	const dirs: string[] = [];
	for (const glob of globs as string[]) {
		if (!glob.endsWith('/*'))
			throw new Error(
				`gen:check does not understand the workspace glob '${glob}'. It handles '<dir>/*' only — widen it deliberately rather than letting a workspace go uncompared.`
			);
		const base = glob.slice(0, -2);
		const abs = join(root, base);
		for (const name of readdirSync(abs))
			if (statSync(join(abs, name)).isDirectory()) dirs.push(`${base}/${name}`);
	}
	return dirs;
}

/**
 * Parse one package's `gen` script into its generator entrypoints and its formatted file list.
 *
 * ⛔ EVERY STEP MUST BE RECOGNISED. `bun run <path>.ts` is a generator; `bun run gen:format` is the formatter,
 * resolved through the package's own `gen:format` script. Anything else THROWS, because a step silently skipped
 * is a generated artifact silently uncompared — the same false-record shape `N-14` records for the schemas test,
 * where a header claimed 107 artifacts and the code read one.
 */
export function parseGen(dir: string, scripts: Record<string, string>): GenPackage {
	const generators: string[] = [];
	let formatted: readonly string[] = [];
	for (const raw of (scripts.gen ?? '').split('&&')) {
		const step = raw.trim();
		if (step === '') continue;
		if (step === 'bun run gen:format') {
			const format = scripts['gen:format'] ?? '';
			const parts = format.split(/\s+/).filter((p) => p !== '');
			if (parts[0] !== 'prettier')
				throw new Error(
					`${dir}: its gen:format script is '${format}', which this gate cannot reproduce. It reproduces 'prettier --write ... <files>' only.`
				);
			formatted = parts.filter((p) => p.endsWith('.ts'));
			if (formatted.length === 0)
				throw new Error(
					`${dir}: its gen:format script formats no .ts file, so nothing would be compared in its formatted form.`
				);
			continue;
		}
		const generator = /^bun run (\S+\.ts)$/.exec(step);
		if (!generator)
			throw new Error(
				`${dir}: its gen script contains the step '${step}', which this gate does not recognise. A step it cannot run is a generated artifact it is not comparing — widen this parser rather than leaving the artifact unchecked.`
			);
		generators.push(generator[1]!);
	}
	if (generators.length === 0)
		throw new Error(`${dir}: its gen script runs no generator, so this gate would compare nothing for it.`);
	return { dir, generators, formatted };
}

/** Every package that declares a `gen` script, parsed. The population the gate actually covers. */
export function genPackages(root: string): GenPackage[] {
	return workspaceDirs(root)
		.map((dir) => ({ dir, manifest: join(root, dir, 'package.json') }))
		.filter((p) => {
			try {
				return typeof (readJson(p.manifest).scripts as Record<string, string> | undefined)?.gen === 'string';
			} catch {
				return false;
			}
		})
		.map((p) => parseGen(p.dir, readJson(p.manifest).scripts as Record<string, string>));
}

/** Every file under `abs`, as forward-slashed paths relative to it, skipping dependency and build directories. */
export function filesUnder(abs: string, prefix = ''): string[] {
	const out: string[] = [];
	for (const name of readdirSync(abs)) {
		if (NOT_SOURCE.has(name)) continue;
		const child = join(abs, name);
		const rel = prefix === '' ? name : `${prefix}/${name}`;
		if (statSync(child).isDirectory()) out.push(...filesUnder(child, rel));
		else out.push(rel);
	}
	return out;
}

/**
 * Compare a regenerated copy against the committed package, in BOTH directions, byte-exactly.
 *
 * ⚠ `Buffer.equals`, NEVER A TEXT READ. Line endings differ by ONE BYTE, and a text comparison returns the same
 * answer for a subject and its control — the instrument failure this register already records. ⚠ And both
 * directions matter: a generator that STOPS emitting a file leaves the committed one behind describing a
 * contract that no longer exists, which a one-way loop cannot see.
 */
export function compareTrees(dir: string, source: string, copy: string): string[] {
	const drifted: string[] = [];
	const regenerated = new Set(filesUnder(copy));
	const committed = new Set(filesUnder(source));
	for (const rel of regenerated) {
		if (!committed.has(rel)) {
			drifted.push(`${dir}/${rel} — the generators emit this file and it is NOT COMMITTED.`);
			continue;
		}
		const a = readFileSync(join(source, rel));
		const b = readFileSync(join(copy, rel));
		if (!a.equals(b))
			drifted.push(
				`${dir}/${rel} — committed ${a.byteLength} bytes, regenerated ${b.byteLength} bytes; they differ.`
			);
	}
	for (const rel of committed)
		if (!regenerated.has(rel))
			drifted.push(
				`${dir}/${rel} — committed, but the generators DELETE it. A generator that stops emitting a file leaves the old one describing a contract that no longer exists.`
			);
	return drifted;
}
