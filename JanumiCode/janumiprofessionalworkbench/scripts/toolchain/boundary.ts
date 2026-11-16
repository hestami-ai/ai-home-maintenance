/**
 * The boundary step's population guard: dependency-cruiser must have cruised exactly the package source git tracks
 * (JAN-TOOLCUR D-4, I6; roadmap T0).
 *
 * WHY. dependency-cruiser 16.10.4 goes blind under TypeScript 6: its `meta.cjs` admits TypeScript `<6`, so under 6.x
 * no `.ts` module is cruised, and `bun run boundary` still prints its green line over nothing (F-7). A check whose
 * population is empty must fail (I6). This guard makes the next upgrade of either tool visible.
 *
 * THE RULE (roadmap T0). The set of distinct source paths under `packages/` in dependency-cruiser's JSON is compared
 * with an INDEPENDENT census: the files git tracks under `packages/` with a source extension, less the committed
 * config's own exclusion (`options.exclude.path` in `.dependency-cruiser.cjs`). Never both sides from the cruise. Four
 * limbs, each failing alone with its own message: zero package modules; a census path the cruise lacks; a cruised path
 * outside the census; a path the cruise lists twice. Measured at T0's base: 423 cruised = 423 tracked `.ts` files; the
 * 163 tracked `.json` and 1 `.jsonl` are not source and are not cruised.
 *
 * The cruise that judges the RULES is the first command of `boundary`, unchanged (`verif/dependency-boundary-rules.test.ts`
 * pins its prefix); this guard runs its own JSON cruise of the same perimeter with the same config, so the rules'
 * output and exit status stay exactly as they were.
 *
 * usage: bun run scripts/toolchain/boundary.ts [--cruise=<json file>] [--census=<file, one path per line>] [--root=<dir>]
 *   --cruise and --census replace the live cruise and the live census, so a test can hand in doctored inputs.
 * exit:  0 the populations agree; 1 a limb failed; 2 an input could not be produced or read.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The extensions dependency-cruiser parses as source here: TypeScript and JavaScript in their module flavours. */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** 64 MiB. The cruise's JSON was 1,007,810 bytes at T0's base, under spawnSync's 1 MiB default by 4% (REG-F-584's ENOBUFS). */
const MAX_BUFFER = 64 * 1024 * 1024;

export function normalise(path: string): string {
	return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isSource(path: string): boolean {
	return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/** The four limbs. Empty when the populations agree. */
export function compareBoundary(cruised: readonly string[], census: readonly string[]): string[] {
	const failures: string[] = [];
	const inPackages = cruised.map(normalise).filter((p) => p.startsWith('packages/') && isSource(p));
	if (inPackages.length === 0) {
		failures.push('dependency-cruiser cruised 0 package modules: a boundary check over nothing (F-7, I6)');
		return failures;
	}
	const counts = new Map<string, number>();
	for (const p of inPackages) counts.set(p, (counts.get(p) ?? 0) + 1);
	const twice = [...counts].filter(([, n]) => n > 1).map(([p, n]) => `${p} (${n} times)`);
	if (twice.length > 0) failures.push(`the cruise lists ${twice.length} path(s) more than once: ${twice.slice(0, 10).join(', ')}`);
	const censusSet = new Set(census.map(normalise));
	const missing = [...censusSet].filter((p) => !counts.has(p)).sort((a, b) => a.localeCompare(b));
	if (missing.length > 0) {
		failures.push(`${missing.length} tracked package source file(s) were not cruised: ${missing.slice(0, 10).join(', ')}`);
	}
	const extra = [...counts.keys()].filter((p) => !censusSet.has(p)).sort((a, b) => a.localeCompare(b));
	if (extra.length > 0) {
		failures.push(`${extra.length} cruised path(s) are not tracked package source: ${extra.slice(0, 10).join(', ')}`);
	}
	return failures;
}

/** The committed config's exclusion, read from the config itself so the census follows it. */
function configExclusion(root: string): RegExp {
	const require = createRequire(join(root, 'package.json'));
	const config = require(join(root, '.dependency-cruiser.cjs')) as { options?: { exclude?: { path?: unknown } } };
	const path = config.options?.exclude?.path;
	if (typeof path !== 'string' || path === '') throw new Error('.dependency-cruiser.cjs has no options.exclude.path string');
	return new RegExp(path);
}

function liveCensus(root: string): string[] {
	// S4036: kept - git is the operator's own, found on PATH as every gate step finds its tools; a fixed path would name a user.
	const r = spawnSync('git', ['ls-files', '-z', '--', 'packages'], { cwd: root, encoding: 'utf8', maxBuffer: MAX_BUFFER });
	if (r.error !== undefined || r.status !== 0) throw new Error(`git ls-files failed: ${r.error?.message ?? r.stderr}`);
	const exclude = configExclusion(root);
	return r.stdout
		.split('\0')
		.filter((p) => p !== '')
		.map(normalise)
		.filter((p) => isSource(p) && !exclude.test(p));
}

function liveCruise(root: string): string[] {
	const bin = join(root, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs');
	// S4036: kept - the cruise runs on the Node PATH finds, as the bin's `#!/usr/bin/env node` does in the rules' cruise.
	const r = spawnSync('node', [bin, 'packages', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: MAX_BUFFER
	});
	if (r.error !== undefined) throw new Error(`the JSON cruise could not run: ${r.error.message}`);
	if (r.status !== 0) throw new Error(`the JSON cruise exited ${r.status}: ${r.stderr.slice(0, 400)}`);
	return modulesOf(r.stdout);
}

function modulesOf(json: string): string[] {
	const parsed = JSON.parse(json) as { modules?: { source?: unknown }[] };
	if (!Array.isArray(parsed.modules)) throw new Error('the cruise JSON has no modules array');
	return parsed.modules.map((m) => (typeof m.source === 'string' ? m.source : ''));
}

export function main(argv: readonly string[], out: (s: string) => void): number {
	const flag = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const root = flag('root') ?? fileURLToPath(new URL('../../', import.meta.url));
	let cruised: string[];
	let census: string[];
	try {
		const cruiseFile = flag('cruise');
		cruised = cruiseFile === undefined ? liveCruise(root) : modulesOf(readFileSync(cruiseFile, 'utf8'));
		const censusFile = flag('census');
		census =
			censusFile === undefined
				? liveCensus(root)
				: readFileSync(censusFile, 'utf8')
						.split(/\r?\n/)
						.filter((p) => p.trim() !== '');
	} catch (e) {
		out(`boundary population guard — ${(e as Error).message}\n`);
		return 2;
	}
	const failures = compareBoundary(cruised, census);
	if (failures.length > 0) {
		const lines = failures.map((f) => `  - ${f}\n`).join('');
		out(`boundary population guard — FAILED:\n${lines}`);
		return 1;
	}
	const n = new Set(cruised.map(normalise).filter((p) => p.startsWith('packages/') && isSource(p))).size;
	out(`boundary population guard — ${n} package source files cruised, equal to the ${census.length} git tracks.\n`);
	return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
