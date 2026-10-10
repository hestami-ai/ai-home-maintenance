// ⭐ `JAN-EXEC` Phase 7, P7-4c (DESIGN-the-live-end-to-end-run.md §6) — THE SPAWN CHECK, TESTED ON THE REFERENCE FIXTURE AND
// ON BROKEN COPIES OF IT: do a workspace's end-to-end tests really start the tool?
//
// `scripts/phase7/spawn-check.ts` answers twice. STATICALLY: each `test/e2e/*.test.js`, with the relative modules it
// imports, uses `child_process`, `process.execPath` and the path of `bin/wordfreq.js`. DYNAMICALLY: on a copy, the entry is
// replaced by a stub that records each start and exits 99, and each test that passed before is seen either to fail, or —
// run again alone — to have started the stub or not. The static answer is a reading of text and can be fooled; the
// dynamic one is decisive. So every limb shows an answer that can come out the other way:
//   · the reference SPAWNS, both ways — every one of its 13 tests fails against the stub, having started it once;
//   · ⛔ tests that import `src/` and call it in process are flagged both ways — statically for all three signals, and
//     dynamically DOES_NOT_SPAWN: they pass against the stub, and none of them started it (`neverRan`);
//   · ⛔ one in-process file beside spawning ones is SPAWNS_PARTLY, naming the test that never started the stub;
//   · ⭐ TESTS THAT START THE TOOL AND ASSERT ONLY WHAT A DO-NOTHING PROGRAM ALSO SATISFIES — a non-zero exit, which the
//     stub's 99 is — pass against the stub too, and are named for what they are (`stubUndetected`), NEVER as tests that
//     never ran it. ⚠ The first version of the tool named them so: it read "passed against the stub" as "never ran the
//     entry", and called the weak-e2e overlay's two spawning tests non-spawning (the verifier's finding);
//   · ⛔ an in-process test and a weak spawning test IN ONE FILE are told apart: each test is attributed by a run of its
//     own, never by its file (a start recorded for the file would be credited to both);
//   · ⛔ a test whose name selects more than itself cannot be attributed, and is said to be (`unattributed`);
//   · ⛔ the stub proves itself when installed: one that cannot record its start throws, rather than read every start
//     as none;
//   · ⛔ a suite red before the stub judges nothing (BASELINE_FAILED): its failure under the stub would prove nothing;
//   · ⭐ a helper module that spawns counts for the test file that imports it — the reading follows relative imports.
//
// No model is called. Every run is `node --test` on a private copy.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ENTRY, installStub } from '../scripts/phase7/entry.js';
import { nodeExecutable, runProcess } from '../scripts/phase7/node-tests.js';
import { runnerEnvironment } from '../scripts/phase7/runner-environment.js';
import { dynamicSpawnCheck, staticSpawnCheck, STUB_EXIT_CODE } from '../scripts/phase7/spawn-check.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = join(ROOT, 'verif', 'fixtures', 'phase7');
const REFERENCE = join(FIXTURES, 'reference');
const RUN_BUDGET_MS = 180_000;

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A copy of the reference, with `overlay`'s test directories in place of its own, then `extra` files written in. */
function referenceWith(overlay: string | undefined, extra: Readonly<Record<string, string>> = {}): string {
	const ws = mkdtempSync(join(tmpdir(), `jpwb-p7-spawn-${overlay ?? 'extra'}-`));
	dirs.push(ws);
	cpSync(REFERENCE, ws, { recursive: true });
	if (overlay !== undefined)
		for (const kind of ['unit', 'e2e']) {
			const source = join(FIXTURES, 'overlays', overlay, 'test', kind);
			if (!existsSync(source)) continue;
			rmSync(join(ws, 'test', kind), { recursive: true, force: true });
			cpSync(source, join(ws, 'test', kind), { recursive: true });
		}
	for (const [file, text] of Object.entries(extra)) writeFileSync(join(ws, file), text);
	return ws;
}

/** An end-to-end file that imports the product and runs it in process — one test, true of a correct product. */
const IN_PROCESS = [
	"import assert from 'node:assert/strict';",
	"import { test } from 'node:test';",
	"import { formatTop } from '../../src/count.js';",
	"test('formats a line in process', () => assert.equal(formatTop([['a', 1]]), '1 a\\n'));",
	''
].join('\n');

/**
 * ⛔ ONE FILE, TWO KINDS OF TEST THAT BOTH PASS AGAINST THE STUB: one never starts the tool, one starts it and asserts only
 * a non-zero exit. A start recorded for the FILE would credit both; only a run of each test alone tells them apart.
 */
const MIXED = [
	"import assert from 'node:assert/strict';",
	"import { spawnSync } from 'node:child_process';",
	"import { test } from 'node:test';",
	"import { fileURLToPath } from 'node:url';",
	"import { formatTop } from '../../src/count.js';",
	"const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));",
	"test('formats a line in process', () => assert.equal(formatTop([['a', 1]]), '1 a\\n'));",
	"test('an unknown option fails', () => assert.notEqual(spawnSync(process.execPath, [BIN, '--bogus']).status, 0));",
	''
].join('\n');

/** ⛔ Two in-process tests with ONE name, the second inside a suite: a run selected by that name runs both. */
const TWICE = [
	"import assert from 'node:assert/strict';",
	"import { describe, test } from 'node:test';",
	"import { formatTop } from '../../src/count.js';",
	"test('formats in process', () => assert.equal(formatTop([['a', 1]]), '1 a\\n'));",
	"describe('again', () => {",
	"\ttest('formats in process', () => assert.equal(formatTop([['b', 2]]), '2 b\\n'));",
	'});',
	''
].join('\n');

describe('JAN-EXEC P7-4c — the spawn check', () => {
	it('⭐ STATIC — the reference: its e2e file uses child_process, process.execPath and the bin path', () => {
		const r = staticSpawnCheck(REFERENCE);
		expect(r.verdict).toBe('SPAWNS');
		expect(r.files).toEqual([
			{
				file: 'test/e2e/cli.test.js',
				closure: ['test/e2e/cli.test.js'],
				importsChildProcess: true,
				usesExecPath: true,
				namesBin: true
			}
		]);
	});

	it('⛔ STATIC CONTROL — tests that import src/ and call it in process are flagged for all three signals', () => {
		const r = staticSpawnCheck(referenceWith('no-spawn'));
		expect(r.verdict).toBe('DOES_NOT_SPAWN');
		expect(r.files).toEqual([
			{
				file: 'test/e2e/cli.test.js',
				closure: ['test/e2e/cli.test.js'],
				importsChildProcess: false,
				usesExecPath: false,
				namesBin: false
			}
		]);
	});

	it('⛔ STATIC CONTROL — the product’s own src/ is never read as the test’s: a src that spawns credits no in-process test', () => {
		// ⚠ FOUND BY THE CONTROL ABOVE: the first version of the walk followed `../../src/cli.js` into the product, so a
		// `src/` that re-executed itself would have credited a test that only imports it with all three signals.
		const respawn = [
			"import { spawnSync } from 'node:child_process';",
			"export const again = () => spawnSync(process.execPath, ['bin/wordfreq.js', '--help']);",
			''
		].join('\n');
		const ws = referenceWith('no-spawn', { 'src/respawn.js': respawn });
		writeFileSync(join(ws, 'src', 'cli.js'), `import './respawn.js';\n${readFileSync(join(ws, 'src', 'cli.js'), 'utf8')}`);
		const r = staticSpawnCheck(ws);
		expect(r.verdict).toBe('DOES_NOT_SPAWN');
		expect(r.files.map((f) => f.closure)).toEqual([['test/e2e/cli.test.js']]);
	});

	it('⭐ STATIC — a helper module that spawns counts for the test file that imports it', () => {
		const helper = [
			"import { spawnSync } from 'node:child_process';",
			"import { fileURLToPath } from 'node:url';",
			"const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));",
			'export const run = (args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });',
			''
		].join('\n');
		const test = [
			"import assert from 'node:assert/strict';",
			"import { test } from 'node:test';",
			"import { run } from './run.js';",
			"test('help', () => assert.equal(run(['--help']).status, 0));",
			''
		].join('\n');
		const ws = referenceWith(undefined, { 'test/e2e/run.js': helper, 'test/e2e/helped.test.js': test });
		const r = staticSpawnCheck(ws);
		const helped = r.files.find((f) => f.file === 'test/e2e/helped.test.js');
		expect(helped).toEqual({
			file: 'test/e2e/helped.test.js',
			closure: ['test/e2e/helped.test.js', 'test/e2e/run.js'],
			importsChildProcess: true,
			usesExecPath: true,
			namesBin: true
		});
		// ⛔ The helper is not a test file of its own: only `*.test.js` is read as one.
		expect(r.files.map((f) => f.file)).toEqual(['test/e2e/cli.test.js', 'test/e2e/helped.test.js']);
		expect(r.verdict).toBe('SPAWNS');
	});

	it(
		'⭐ DYNAMIC — the reference: each of its 13 tests fails once the entry is the stub, having started it once',
		async () => {
			const r = await dynamicSpawnCheck(REFERENCE);
			expect(STUB_EXIT_CODE).toBe(99);
			expect(r.verdict).toBe('SPAWNS');
			expect(r.baseline?.exitCode).toBe(0);
			// ⛔ COUNTED, NOT COMPARED: the reference has 13 tests inside ONE `describe`, and the suite is never a test of
			// its own — a reporter that counted it would read 14 here, and 14 failed beside it (M39).
			expect(r.baseline?.passed).toBe(13);
			expect(r.stubbed?.passed).toBe(0);
			expect(r.stubbed?.failed).toBe(13);
			expect(r.baseline?.tests.map((t) => t.name)).not.toContain('wordfreq, end to end');
			// Each test stops at its first assertion against the stub, so each starts it exactly once.
			expect(r.stubStarts).toBe(13);
			expect([r.stillPassing, r.neverRan, r.stubUndetected, r.unattributed]).toEqual([[], [], [], []]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — tests that never start the tool pass against the stub and record no start: DOES_NOT_SPAWN',
		async () => {
			const r = await dynamicSpawnCheck(referenceWith('no-spawn'));
			const three = [
				'test/e2e/cli.test.js > a missing file exits 1',
				'test/e2e/cli.test.js > an unknown option exits 2',
				'test/e2e/cli.test.js > counts standard input'
			];
			expect(r.verdict).toBe('DOES_NOT_SPAWN');
			expect(r.baseline?.exitCode).toBe(0);
			expect(r.stubbed?.exitCode).toBe(0);
			expect(r.stubStarts).toBe(0);
			expect(r.stillPassing).toEqual(three);
			expect(r.neverRan).toEqual(three);
			expect([r.stubUndetected, r.unattributed]).toEqual([[], []]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — one in-process file beside the spawning one: SPAWNS_PARTLY, naming the test that never ran it',
		async () => {
			const r = await dynamicSpawnCheck(referenceWith(undefined, { 'test/e2e/inproc.test.js': IN_PROCESS }));
			expect(r.verdict).toBe('SPAWNS_PARTLY');
			expect(r.stillPassing).toEqual(['test/e2e/inproc.test.js > formats a line in process']);
			expect(r.neverRan).toEqual(['test/e2e/inproc.test.js > formats a line in process']);
			expect([r.stubUndetected, r.unattributed]).toEqual([[], []]);
			expect(r.stubStarts).toBe(13);
		},
		RUN_BUDGET_MS
	);

	it(
		'⭐ DYNAMIC — tests that START the tool and assert only a non-zero exit pass against the stub, and are named as such: SPAWNS',
		async () => {
			// The weak-e2e overlay: six tests that all start the tool; two assert only `notEqual(status, 0)`, which the
			// stub's 99 satisfies. They ran the entry — so they do not make the suite less than SPAWNS — and they cannot
			// tell the tool from a program that does nothing, which is a finding about them of its own.
			const weak = ['test/e2e/cli.test.js > a missing file fails', 'test/e2e/cli.test.js > an unknown option fails'];
			const r = await dynamicSpawnCheck(referenceWith('weak-e2e'));
			expect(r.verdict).toBe('SPAWNS');
			expect(r.baseline?.passed).toBe(6);
			expect([r.stubbed?.passed, r.stubbed?.failed]).toEqual([2, 4]);
			expect(r.stillPassing).toEqual(weak);
			expect(r.stubUndetected).toEqual(weak);
			expect(r.neverRan).toEqual([]);
			expect(r.unattributed).toEqual([]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — an in-process test and a weak spawning test in ONE file are told apart, each by a run of its own',
		async () => {
			const r = await dynamicSpawnCheck(referenceWith(undefined, { 'test/e2e/mixed.test.js': MIXED }));
			expect(r.stillPassing).toEqual([
				'test/e2e/mixed.test.js > an unknown option fails',
				'test/e2e/mixed.test.js > formats a line in process'
			]);
			expect(r.neverRan).toEqual(['test/e2e/mixed.test.js > formats a line in process']);
			expect(r.stubUndetected).toEqual(['test/e2e/mixed.test.js > an unknown option fails']);
			expect(r.unattributed).toEqual([]);
			expect(r.verdict).toBe('SPAWNS_PARTLY');
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — a name that selects two tests attributes neither: both UNATTRIBUTED, and the verdict does not credit them',
		async () => {
			const r = await dynamicSpawnCheck(referenceWith(undefined, { 'test/e2e/twice.test.js': TWICE }));
			const name = 'test/e2e/twice.test.js > formats in process';
			expect(r.stillPassing).toEqual([name, name]);
			expect(r.unattributed).toEqual([name, name]);
			expect([r.neverRan, r.stubUndetected]).toEqual([[], []]);
			// 15 passed at baseline; 13 shown to run the entry, 2 shown nothing.
			expect(r.baseline?.passed).toBe(15);
			expect(r.verdict).toBe('SPAWNS_PARTLY');
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — a suite red before the stub judges nothing: BASELINE_FAILED',
		async () => {
			const r = await dynamicSpawnCheck(referenceWith('red-tests'));
			expect(r.verdict).toBe('BASELINE_FAILED');
			expect(r.stubbed).toBeNull();
			expect(r.stubStarts).toBeNull();
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ DYNAMIC CONTROL — no bin/wordfreq.js: NO_ENTRY, never DOES_NOT_SPAWN for a stub put where no test looks',
		async () => {
			const ws = referenceWith(undefined);
			rmSync(join(ws, 'bin'), { recursive: true, force: true });
			const r = await dynamicSpawnCheck(ws);
			expect(r.verdict).toBe('NO_ENTRY');
			expect(r.baseline).toBeNull();
			expect(r.stubbed).toBeNull();
		},
		RUN_BUDGET_MS
	);

	it('⛔ CONTROL — no test/e2e/*.test.js: NO_E2E_TESTS, both ways', async () => {
		const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-spawn-empty-'));
		dirs.push(ws);
		cpSync(join(REFERENCE, 'bin'), join(ws, 'bin'), { recursive: true });
		expect(staticSpawnCheck(ws).verdict).toBe('NO_E2E_TESTS');
		expect((await dynamicSpawnCheck(ws)).verdict).toBe('NO_E2E_TESTS');
	});
});

describe('JAN-EXEC P7-4c — the stub, which records each start and proves it can when installed', () => {
	const env = runnerEnvironment(process.env);

	it(
		'⭐ installed over the entry, it has run once to prove itself, then counts from zero: one start per run',
		async () => {
			const ws = referenceWith(undefined);
			const stub = await installStub(ws, env);
			try {
				expect(stub.starts()).toBe(0);
				expect(readFileSync(join(ws, ENTRY), 'utf8')).toMatch(/process\.exit\(99\)/);
				const r = await runProcess(nodeExecutable(), [ENTRY, '--bogus'], { cwd: ws, env, timeoutMs: 30_000 });
				expect(r.exitCode).toBe(STUB_EXIT_CODE);
				expect([r.stdout, r.stderr]).toEqual(['', '']);
				expect(stub.starts()).toBe(1);
				stub.reset();
				expect(stub.starts()).toBe(0);
			} finally {
				stub.remove();
			}
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a stub that cannot run where it is put is refused at install, never trusted to count starts it cannot record',
		async () => {
			// A package scope node cannot read: every module under it fails to load, the stub among them.
			const ws = referenceWith(undefined, { 'package.json': '{ "type": "module", ' });
			await expect(installStub(ws, env)).rejects.toThrow(/the stub entry did not run as written/);
		},
		RUN_BUDGET_MS
	);
});
