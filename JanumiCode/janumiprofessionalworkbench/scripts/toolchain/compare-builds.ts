/**
 * "The upgrade changed nothing it should not": the `dist` byte-diff and the test counts, recorded before and after a
 * change and compared (JAN-TOOLCUR D-11; roadmap T0, which builds it because T1a is the first package to rely on it).
 *
 * `record` builds the packages when asked (`turbo run build`), hashes every file under `packages/*\/dist` (SHA-256),
 * and reads the test counts from the gate's vitest output given as logs (`Test Files  548 passed (548)`,
 * `Tests  10562 passed | 4 skipped (10566)`). `compare` names every file that differs, appears or disappears, by
 * package, and every count that moved; it exits 1 when anything did, so a change that should move nothing can be
 * shown to move nothing. A record with no dist file fails: a comparison over nothing would pass (I6).
 *
 * usage: bun run scripts/toolchain/compare-builds.ts record --out=<file> [--build] [--tests-from=<log> ...] [--root=<dir>]
 *        bun run scripts/toolchain/compare-builds.ts compare <before.json> <after.json>
 * exit:  0 recorded, or nothing differs; 1 something differs; 2 a usage or input error.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BuildRecord {
	readonly schema: 'jpwb-build-record/1';
	/** `packages/<name>/dist/<path>` -> SHA-256 hex. */
	readonly dist: Readonly<Record<string, string>>;
	/** log file -> the last `Test Files` and `Tests` summary lines it holds. */
	readonly tests: Readonly<Record<string, { readonly files: string; readonly tests: string }>>;
}

function walk(dir: string, rel: string, out: Map<string, string>): void {
	for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
		const full = join(dir, name);
		const r = `${rel}/${name}`;
		if (statSync(full).isDirectory()) walk(full, r, out);
		else out.set(r, createHash('sha256').update(readFileSync(full)).digest('hex'));
	}
}

export function hashDist(root: string): Record<string, string> {
	const out = new Map<string, string>();
	const packages = join(root, 'packages');
	for (const pkg of readdirSync(packages).sort((a, b) => a.localeCompare(b))) {
		const dist = join(packages, pkg, 'dist');
		if (existsSync(dist) && statSync(dist).isDirectory()) walk(dist, `packages/${pkg}/dist`, out);
	}
	return Object.fromEntries(out);
}

/** ANSI colour codes, built from the escape's code point as `scripts/mutants/run.ts` builds it (no control character in a literal). */
const ANSI_COLOUR = new RegExp(String.raw`${String.fromCodePoint(27)}\[[0-9;]*m`, 'g');

/** The last vitest summary lines in a log, ANSI colour removed. */
export function testCounts(log: string): { files: string; tests: string } {
	const plain = log.replace(ANSI_COLOUR, '');
	const pick = (re: RegExp): string => {
		const all = plain.split(/\r?\n/).filter((l) => re.test(l));
		return (all.at(-1) ?? '').trim().replace(/\s+/g, ' ');
	};
	return { files: pick(/^\s*Test Files\s+\d/), tests: pick(/^\s*Tests\s+\d/) };
}

export interface Difference {
	readonly kind: 'changed' | 'added' | 'removed' | 'tests';
	readonly what: string;
}

export function compareRecords(before: BuildRecord, after: BuildRecord): Difference[] {
	const out: Difference[] = [];
	const keys = [...new Set([...Object.keys(before.dist), ...Object.keys(after.dist)])].sort((a, b) => a.localeCompare(b));
	for (const k of keys) {
		const a = before.dist[k];
		const b = after.dist[k];
		if (a === undefined) out.push({ kind: 'added', what: k });
		else if (b === undefined) out.push({ kind: 'removed', what: k });
		else if (a !== b) out.push({ kind: 'changed', what: k });
	}
	for (const log of [...new Set([...Object.keys(before.tests), ...Object.keys(after.tests)])].sort((a, b) => a.localeCompare(b))) {
		const a = before.tests[log];
		const b = after.tests[log];
		if (a?.files !== b?.files || a?.tests !== b?.tests) {
			out.push({ kind: 'tests', what: `${log}: ${JSON.stringify(a ?? null)} -> ${JSON.stringify(b ?? null)}` });
		}
	}
	return out;
}

function parseRecord(file: string): BuildRecord {
	const r = JSON.parse(readFileSync(file, 'utf8')) as BuildRecord;
	if (r.schema !== 'jpwb-build-record/1') throw new Error(`${file} is not a build record`);
	if (Object.keys(r.dist).length === 0) throw new Error(`${file} records no dist file: a comparison over nothing (I6)`);
	return r;
}

function record(rest: readonly string[], out: (s: string) => void): number {
	const flag = (name: string): string | undefined => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const root = flag('root') ?? fileURLToPath(new URL('../../', import.meta.url));
	const file = flag('out');
	if (file === undefined) throw new Error('record needs --out=<file>');
	if (rest.includes('--build')) {
		// S4036: kept - bunx resolves the lock's own turbo, as every `bun run build` step does.
		const b = spawnSync('bunx', ['turbo', 'run', 'build'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
		if (b.status !== 0) throw new Error(`turbo run build exited ${b.status}: ${(b.stderr || b.stdout).slice(-400)}`);
	}
	const dist = hashDist(root);
	if (Object.keys(dist).length === 0) throw new Error('no file under packages/*/dist: build first, or pass --build');
	const tests: Record<string, { files: string; tests: string }> = {};
	for (const log of rest.filter((a) => a.startsWith('--tests-from=')).map((a) => a.slice('--tests-from='.length))) {
		tests[log] = testCounts(readFileSync(log, 'utf8'));
	}
	const built: BuildRecord = { schema: 'jpwb-build-record/1', dist, tests };
	writeFileSync(file, `${JSON.stringify(built, null, '\t')}\n`);
	out(`compare-builds — recorded ${Object.keys(dist).length} dist files and ${Object.keys(tests).length} test log(s) in ${file}.\n`);
	return 0;
}

function compare(rest: readonly string[], out: (s: string) => void): number {
	const [beforeFile, afterFile] = rest;
	if (beforeFile === undefined || afterFile === undefined) throw new Error('compare needs <before.json> <after.json>');
	const differences = compareRecords(parseRecord(beforeFile), parseRecord(afterFile));
	if (differences.length === 0) {
		out('compare-builds — nothing differs: every dist file and every test count is the same.\n');
		return 0;
	}
	const byPackage = new Map<string, number>();
	for (const d of differences) {
		const pkg = /^packages\/([^/]+)\//.exec(d.what)?.[1] ?? '(tests)';
		byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + 1);
	}
	const summary = [...byPackage].map(([pkg, n]) => `${pkg} ${n}`).join(', ');
	out(`compare-builds — ${differences.length} difference(s): ${summary}\n`);
	for (const d of differences) out(`  ${d.kind} ${d.what}\n`);
	return 1;
}

export function main(argv: readonly string[], out: (s: string) => void): number {
	const [command, ...rest] = argv;
	try {
		if (command === 'record') return record(rest, out);
		if (command === 'compare') return compare(rest, out);
		throw new Error('usage: compare-builds.ts record --out=<file> [--build] [--tests-from=<log> ...] | compare <before> <after>');
	} catch (e) {
		out(`compare-builds — ${(e as Error).message}\n`);
		return 2;
	}
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
