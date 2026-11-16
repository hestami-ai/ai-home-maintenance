// JAN-TOOLCUR T0 — the toolchain instruments' predicted reds (DESIGN-toolchain-currency.md §7; roadmap T0).
//
// ⭐ EACH RED TRIPS ONE CONDITION AND ASSERTS ITS MESSAGE, AND EVERY OTHER CONDITION IS ASSERTED GREEN. A red that
// tripped two conditions would prove neither (two guards, one arrangement), so each test runs the REAL tree and
// overrides only the files its red is about (`--override=<path>=<file>`, scripts/toolchain/tree.ts), then asserts the
// whole verdict line by line: its condition FAILED, the others ok.
//
// ⚠ THE CONTROL COMES FIRST. The unmodified tree must pass every condition; without it a red could be the check failing
// on everything. It reads this machine (the Node on PATH, the running Bun, the Edge major, the SonarLint version), so a
// machine that drifted reddens it — and `toolchain:check`, the gate's first step, has already failed for the same cause.
// ⭐ (package T1a) In the gate's own mode: in the floor lane (`JPWB_TOOLCHAIN_FLOOR_LANE=1`, the floor Node first on
// PATH) every check here runs in floor-lane mode, as the gate's first step does. T0 forced normal mode, so T1a's first
// floor lane failed condition 1 in all ten tests that spawn the check: the Node on PATH, 24.15.0, is not the day-to-day.
//
// Spawned under bun, as the gate runs them: the check reads peer ranges with Bun.semver and compares the running Bun.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOOLCHAIN = join(ROOT, 'scripts', 'toolchain');
const TIMEOUT = 120_000;
const CONDITION_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', 'steps'];

function scratch(): string {
	return mkdtempSync(join(tmpdir(), 'jan-toolcur-'));
}

function put(dir: string, name: string, text: string): string {
	const file = join(dir, name);
	mkdirSync(join(file, '..'), { recursive: true });
	writeFileSync(file, text);
	return file;
}

function real(rel: string): string {
	return readFileSync(join(ROOT, rel), 'utf8');
}

type Json = Record<string, unknown>;

function matrix(): Json {
	return JSON.parse(real('scripts/toolchain/matrix.json')) as Json;
}

function rowOf(m: Json, component: string): Json {
	const row = (m.packages as Json[]).find((p) => p.component === component);
	if (row === undefined) throw new Error(`no ${component} row`);
	return row;
}

function machineRow(m: Json, component: string): Json {
	const row = (m.machine as Json[]).find((t) => t.component === component);
	if (row === undefined) throw new Error(`no machine ${component} row`);
	return row;
}

/** Replace exactly one occurrence, or throw: a fixture that edits nothing would make its red a false one. */
function once(text: string, find: string, replace: string): string {
	const n = text.split(find).length - 1;
	if (n !== 1) throw new Error(`fixture: ${JSON.stringify(find)} occurs ${n} times, not once`);
	return text.replace(find, replace);
}

function run(script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): { status: number | null; out: string } {
	const r = spawnSync('bun', [join(TOOLCHAIN, script), ...args], {
		cwd: ROOT,
		encoding: 'utf8',
		env: { ...process.env, ...env },
		timeout: TIMEOUT - 10_000
	});
	return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function check(overrides: Record<string, string>): { status: number | null; out: string } {
	return run(
		'check.ts',
		Object.entries(overrides).map(([rel, file]) => `--override=${rel}=${file}`),
		// The gate's own mode, read as `check.ts` reads it (only '1' is floor-lane mode): never forced to normal mode.
		{ JPWB_TOOLCHAIN_FLOOR_LANE: process.env.JPWB_TOOLCHAIN_FLOOR_LANE === '1' ? '1' : '' }
	);
}

/** Each condition's verdict, from lines like `  2 installed tree and lock: ok (39 installed copies)`. */
function verdicts(out: string): string[] {
	const found: string[] = [];
	for (const line of out.split(/\r?\n/)) {
		const m = /^ {2}(\d|steps) [^:]+: (ok|FAILED)/.exec(line);
		if (m !== null) found.push(`${m[1]}: ${m[2]}`);
	}
	return found.sort((a, b) => a.localeCompare(b));
}

function onlyFailed(id: string): string[] {
	return CONDITION_IDS.map((c) => `${c}: ${c === id ? 'FAILED' : 'ok'}`).sort((a, b) => a.localeCompare(b));
}

describe('JAN-TOOLCUR T0 — toolchain:check, one condition per red', () => {
	it('CONTROL — the unmodified tree passes every condition', { timeout: TIMEOUT }, () => {
		const r = check({});
		expect(verdicts(r.out)).toEqual(onlyFailed('none'));
		expect(r.out).toContain('toolchain:check — every condition holds');
		expect(r.status).toBe(0);
	});

	it('2 — the lock and the tree hold turbo 2.11.11 while the matrix records 2.10.4', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const lock = put(dir, 'bun.lock', once(real('bun.lock'), '"turbo@2.10.4"', '"turbo@2.11.11"'));
		const installed = JSON.parse(real('node_modules/turbo/package.json')) as Json;
		installed.version = '2.11.11';
		const tree = put(dir, 'turbo-package.json', JSON.stringify(installed));
		const r = check({ 'bun.lock': lock, 'node_modules/turbo/package.json': tree });
		expect(verdicts(r.out)).toEqual(onlyFailed('2'));
		expect(r.out).toContain('turbo: bun.lock resolves 2.11.11; the matrix records 2.10.4');
		expect(r.out).not.toContain('the installed node_modules/turbo is');
		expect(r.status).toBe(1);
	});

	it('2 — node_modules holds turbo 2.11.11 while the lock and the matrix hold 2.10.4', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const installed = JSON.parse(real('node_modules/turbo/package.json')) as Json;
		installed.version = '2.11.11';
		const tree = put(dir, 'turbo-package.json', JSON.stringify(installed));
		const r = check({ 'node_modules/turbo/package.json': tree });
		expect(verdicts(r.out)).toEqual(onlyFailed('2'));
		expect(r.out).toContain('turbo: the installed node_modules/turbo is 2.11.11; bun.lock records 2.10.4');
		expect(r.status).toBe(1);
	});

	it('3 — a caret where the matrix records exact: elkjs ^0.11.1', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const app = put(dir, 'app-package.json', once(real('apps/rph-demo/package.json'), '"elkjs": "0.11.1"', '"elkjs": "^0.11.1"'));
		const r = check({ 'apps/rph-demo/package.json': app });
		expect(verdicts(r.out)).toEqual(onlyFailed('3'));
		expect(r.out).toContain('elkjs is declared ^0.11.1 in apps/rph-demo/package.json; its pin style is exact');
		expect(r.status).toBe(1);
	});

	it('1 — the matrix records Bun 1.3.13 (devEngines agrees, so condition 3 stays green)', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const m = matrix();
		(m.bun as Json).version = '1.3.13';
		const root = JSON.parse(real('package.json')) as Json;
		((root.devEngines as Json).packageManager as Json).version = '1.3.13';
		const r = check({
			'scripts/toolchain/matrix.json': put(dir, 'matrix.json', JSON.stringify(m)),
			'package.json': put(dir, 'package.json', JSON.stringify(root))
		});
		expect(verdicts(r.out)).toEqual(onlyFailed('1'));
		expect(r.out).toContain('the running Bun is 1.3.14; the matrix pins Bun 1.3.13');
		expect(r.status).toBe(1);
	});

	it('7 — the matrix records the Edge major 156', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const m = matrix();
		machineRow(m, 'edge').observed = '156';
		const r = check({ 'scripts/toolchain/matrix.json': put(dir, 'matrix.json', JSON.stringify(m)) });
		expect(verdicts(r.out)).toEqual(onlyFailed('7'));
		expect(r.out).toMatch(/Edge: the machine has major \d+ installed \([^)]*\); the matrix records 156/);
		expect(r.status).toBe(1);
	});

	it('7 — the matrix records a SonarLint other than the installed one', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const m = matrix();
		machineRow(m, 'sonarlint').observed = '6.2.0';
		const r = check({ 'scripts/toolchain/matrix.json': put(dir, 'matrix.json', JSON.stringify(m)) });
		expect(verdicts(r.out)).toEqual(onlyFailed('7'));
		expect(r.out).toMatch(/SonarLint: the machine has \S+ \(under ~\/\.devin\/extensions\); the matrix records 6\.2\.0/);
		expect(r.status).toBe(1);
	});

	it('7 — a matrix that checks no machine tool judged nothing, and fails (I6)', { timeout: TIMEOUT }, () => {
		const m = matrix();
		for (const t of m.machine as Json[]) t.check = 'none';
		const r = check({ 'scripts/toolchain/matrix.json': put(scratch(), 'matrix.json', JSON.stringify(m)) });
		expect(verdicts(r.out)).toEqual(onlyFailed('7'));
		expect(r.out).toContain('it judged 0 machine tools: a check over nothing fails (I6)');
		expect(r.status).toBe(1);
	});

	it('4 — typescript 7.0.2 in the matrix, the lock, the tree and the manifests fails only the peer check', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const m = matrix();
		const ts = rowOf(m, 'typescript');
		ts.locked = '7.0.2';
		ts.declared = { '.': '7.0.2', 'apps/rph-demo': '7.0.2' };
		const installed = JSON.parse(real('node_modules/typescript/package.json')) as Json;
		installed.version = '7.0.2';
		const r = check({
			'scripts/toolchain/matrix.json': put(dir, 'matrix.json', JSON.stringify(m)),
			'bun.lock': put(dir, 'bun.lock', once(real('bun.lock'), '"typescript@5.9.3"', '"typescript@7.0.2"')),
			'node_modules/typescript/package.json': put(dir, 'ts-package.json', JSON.stringify(installed)),
			'package.json': put(dir, 'package.json', once(real('package.json'), '"typescript": "5.9.3"', '"typescript": "7.0.2"')),
			'apps/rph-demo/package.json': put(
				dir,
				'app-package.json',
				once(real('apps/rph-demo/package.json'), '"typescript": "5.9.3"', '"typescript": "7.0.2"')
			)
		});
		expect(verdicts(r.out)).toEqual(onlyFailed('4'));
		expect(r.out).toMatch(/typescript-eslint \S+ declares peer typescript >=\S+ <6\.1\.0; it resolves typescript 7\.0\.2/);
		expect(r.status).toBe(1);
	});

	it('5 — the VS Code floor 1.122.0 runs Node 22.22.1, below a floor of 24.15.0', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const m = matrix();
		(m.node as Json).floor = '24.15.0';
		Object.assign(m.vscode as Json, { floor: '1.122.0', floorElectron: '39.8.8', floorNode: '22.22.1' });
		const root = JSON.parse(real('package.json')) as Json;
		(root.engines as Json).node = '>=24.15.0';
		const r = check({
			'scripts/toolchain/matrix.json': put(dir, 'matrix.json', JSON.stringify(m)),
			'package.json': put(dir, 'package.json', JSON.stringify(root))
		});
		expect(verdicts(r.out)).toEqual(onlyFailed('5'));
		expect(r.out).toContain('the VS Code floor 1.122.0 runs Node 22.22.1 (Electron 39.8.8), below the Node floor 24.15.0');
		expect(r.out).not.toContain('the day-to-day Node');
		expect(r.status).toBe(1);
	});

	it('steps — a gate step that runs `bun --bun vitest run` where the matrix records node', { timeout: TIMEOUT }, () => {
		const dir = scratch();
		const manifest = once(
			real('package.json'),
			'"test:coverage": "vitest run --coverage --maxWorkers=4"',
			'"test:coverage": "bun --bun vitest run --coverage --maxWorkers=4"'
		);
		const r = check({ 'package.json': put(dir, 'package.json', manifest) });
		expect(verdicts(r.out)).toEqual(onlyFailed('steps'));
		expect(r.out).toContain("gate:fast step 'bun run test:coverage' runs on bun");
		expect(r.out).toContain('the matrix records node');
		expect(r.status).toBe(1);
	});

	it('8 — an empty matrix fails, and nothing else is compared', { timeout: TIMEOUT }, () => {
		const r = check({ 'scripts/toolchain/matrix.json': put(scratch(), 'matrix.json', '') });
		expect(verdicts(r.out)).toEqual(['8: FAILED']);
		expect(r.out).toContain('scripts/toolchain/matrix.json is missing or empty');
		expect(r.status).toBe(1);
	});

	it('8 — a machine-path root that names a user is refused', { timeout: TIMEOUT }, () => {
		const paths = JSON.parse(real('scripts/toolchain/machine-paths.json')) as Json;
		(paths.sonarlint as Json).roots = ['C:/Users/someone/.devin/extensions'];
		const r = check({ 'scripts/toolchain/machine-paths.json': put(scratch(), 'machine-paths.json', JSON.stringify(paths)) });
		expect(verdicts(r.out)).toEqual(['8: FAILED']);
		expect(r.out).toContain('names a user');
		expect(r.status).toBe(1);
	});
});

describe('JAN-TOOLCUR T0 — the boundary population guard, each limb alone', () => {
	const a = 'packages/rph-x/src/a.ts';
	const b = 'packages/rph-x/src/b.ts';
	const c = 'packages/rph-x/src/c.ts';

	function guard(cruised: readonly string[], census: readonly string[]): { status: number | null; out: string } {
		const dir = scratch();
		const cruise = put(dir, 'cruise.json', JSON.stringify({ modules: cruised.map((source) => ({ source })) }));
		const list = put(dir, 'census.txt', `${census.join('\n')}\n`);
		return run('boundary.ts', [`--cruise=${cruise}`, `--census=${list}`]);
	}

	function limbs(out: string): string[] {
		return out.split(/\r?\n/).filter((l) => l.startsWith('  - '));
	}

	it('CONTROL — the cruise and the census agree', { timeout: TIMEOUT }, () => {
		const r = guard([a, b, 'node:fs'], [b, a]);
		expect(r.out).toContain('2 package source files cruised, equal to the 2 git tracks');
		expect(r.status).toBe(0);
	});

	it('0 package modules cruised', { timeout: TIMEOUT }, () => {
		const r = guard(['node:fs', 'apps/x.ts'], [a]);
		expect(limbs(r.out)).toEqual(['  - dependency-cruiser cruised 0 package modules: a boundary check over nothing (F-7, I6)']);
		expect(r.status).toBe(1);
	});

	it('a census path the cruise lacks', { timeout: TIMEOUT }, () => {
		const r = guard([a], [a, b]);
		expect(limbs(r.out)).toEqual([`  - 1 tracked package source file(s) were not cruised: ${b}`]);
		expect(r.status).toBe(1);
	});

	it('a cruised path outside the census', { timeout: TIMEOUT }, () => {
		const r = guard([a, c], [a]);
		expect(limbs(r.out)).toEqual([`  - 1 cruised path(s) are not tracked package source: ${c}`]);
		expect(r.status).toBe(1);
	});

	it('a path the cruise lists twice', { timeout: TIMEOUT }, () => {
		const r = guard([a, a], [a]);
		expect(limbs(r.out)).toEqual([`  - the cruise lists 1 path(s) more than once: ${a} (2 times)`]);
		expect(r.status).toBe(1);
	});
});

describe('JAN-TOOLCUR T0 — the generator and the review', () => {
	it('the committed matrix and its page are one generation of themselves', { timeout: TIMEOUT }, () => {
		const r = run('generate.ts', ['--check']);
		expect(r.out).toContain('the matrix and its page are current');
		expect(r.status).toBe(0);
	});

	it('CONTROL — --check reports a matrix whose generated fields are stale', { timeout: TIMEOUT }, () => {
		const m = matrix();
		rowOf(m, 'turbo').locked = '0.0.0';
		const r = run('generate.ts', ['--check', `--override=scripts/toolchain/matrix.json=${put(scratch(), 'matrix.json', `${JSON.stringify(m, null, '\t')}\n`)}`]);
		expect(r.out).toContain('not current: scripts/toolchain/matrix.json');
		expect(r.status).toBe(1);
	});

	function review(lockedEslintJs: string, eslintEol: string): string {
		const dir = scratch();
		const saved = join(dir, 'saved');
		put(
			saved,
			'npm/@eslint__js.json',
			JSON.stringify({
				'dist-tags': { latest: '10.0.1' },
				versions: { '9.39.5': {}, '10.0.0': { deprecated: 'This version should not be used.' }, '10.0.1': {} }
			})
		);
		put(saved, 'endoflife/eslint.json', JSON.stringify({ result: { releases: [{ name: '9', eolFrom: eslintEol }] } }));
		const m = matrix();
		rowOf(m, '@eslint/js').locked = lockedEslintJs;
		const out = join(dir, 'review.md');
		const r = run('review.ts', [
			`--offline=${saved}`,
			'--today=2026-11-16',
			`--out=${out}`,
			`--override=scripts/toolchain/matrix.json=${put(dir, 'matrix.json', JSON.stringify(m))}`
		]);
		expect(r.status).toBe(0);
		return readFileSync(out, 'utf8');
	}

	it('flags @eslint/js 10.0.0, which npm marks deprecated, and an end of life within 90 days', { timeout: TIMEOUT }, () => {
		const text = review('10.0.0', '2026-12-16');
		expect(text).toContain('- DEPRECATED: @eslint/js 10.0.0, the locked version, is marked deprecated by npm: "This version should not be used."');
		expect(text).toContain('- END OF LIFE WITHIN 90 DAYS: eslint (eslint 9) ends 2026-12-16, in 30 days');
	});

	it('CONTROL — the same responses raise neither flag for 9.39.5 and an end of life 197 days away', { timeout: TIMEOUT }, () => {
		const text = review('9.39.5', '2027-06-01');
		expect(text).not.toContain('DEPRECATED:');
		expect(text).not.toContain('END OF LIFE');
		expect(text).toContain('| eslint | eslint 9 | end of life 2027-06-01 (197 days) |');
	});
});
