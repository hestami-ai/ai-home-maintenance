// ⭐ `JAN-EXEC` Phase 7, P7-4b (DESIGN-the-live-end-to-end-run.md §6) — SEEDED FAULTS, TESTED ON THE REFERENCE FIXTURE AND
// ON BROKEN COPIES OF IT.
//
// `scripts/phase7/seeded-faults.ts` asks of a phase's archived workspace: would the model's OWN tests catch a known
// fault? (a) end to end — seven single-deviation variants of the CLI swapped in for `bin/wordfreq.js`, the workspace's
// end-to-end tests run on each; (a′) end to end on the product's own code — generic operator mutations of `src/*.js`,
// one at a time, the end-to-end tests run on each through the product's own entry; (b) unit — the same mutations, the
// unit tests run on each. Each answers "caught" or "missed/survived", and each is an instrument, so each limb below shows
// one can FAIL:
//   · the reference's own tests catch all seven variants and every mutant — the tool CAN say "caught";
//   · ⛔ a weak end-to-end suite MISSES the four variants it does not test, named, and catches the three it does — the
//     tool CAN say "missed", and says it of the right variants;
//   · ⛔ weak unit tests let a removed `toLowerCase()` SURVIVE — the tool CAN say "survived";
//   · ⛔ a suite already red on a correct product judges NOTHING (BASELINE_FAILED), and names the tests that failed:
//     otherwise every variant and every mutant would read "caught" for a failure no fault caused — and nor does a suite
//     whose every test is skipped, which exits 0 having checked nothing, and would read "missed" for every variant;
//   · ⭐ a suite that pins wording beyond the brief fails the faithful CLI, so (a) judges nothing there — and (a′), whose
//     baseline is the product's OWN entry, still judges, both ways;
//   · ⛔ end-to-end tests that never start the entry are ENTRY_NOT_RUN — and ⭐ tests that DO start it, and assert only a
//     non-zero exit, are judged (every variant MISSED, which is true of them), never refused as tests that never ran it:
//     the stub records its starts, and the refusal is keyed on those, not on the suite passing;
//   · ⛔ a mutant is judged on its own: one caught mutant left in place, or run in a copy another worker shares, makes a
//     survivor in another file read caught — at one worker and at two (`ISOLATION`);
//   · ⛔ a variant whose anchor is absent or ambiguous is NOT_APPLIED, never run as the faithful text under a variant's name;
//   · ⭐ the target is never edited: its tree is byte-identical afterwards.
//
// No model is called. Every run is `node --test` on a private copy.
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
	applyVariant,
	endToEndDiscrimination,
	endToEndSourceDiscrimination,
	END_TO_END_VARIANTS,
	faithfulText,
	MUTATION_OPERATORS,
	mutantsOf,
	unitDiscrimination,
	type Mutant,
	type SourceReport,
	type UnitScope
} from '../scripts/phase7/seeded-faults.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = join(ROOT, 'verif', 'fixtures', 'phase7');
const REFERENCE = join(FIXTURES, 'reference');
/** A whole discrimination run: nine end-to-end suite runs, or a hundred-odd unit runs. */
const RUN_BUDGET_MS = 300_000;

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A copy of the reference with `overlay`'s test directories in place of its own — each one it holds, whole. */
function referenceWith(overlay: string): string {
	const ws = mkdtempSync(join(tmpdir(), `jpwb-p7-${overlay}-`));
	dirs.push(ws);
	cpSync(REFERENCE, ws, { recursive: true });
	const from = join(FIXTURES, 'overlays', overlay);
	for (const kind of ['unit', 'e2e']) {
		const source = join(from, 'test', kind);
		if (!existsSync(source)) continue;
		rmSync(join(ws, 'test', kind), { recursive: true, force: true });
		cpSync(source, join(ws, 'test', kind), { recursive: true });
	}
	return ws;
}

/** Every file under `dir` with its SHA-256, by path — what "byte-identical afterwards" is checked against. */
function treeDigest(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (d: string) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else out[relative(dir, p).split('\\').join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
		}
	};
	walk(dir);
	return out;
}

const ALL_VARIANTS = END_TO_END_VARIANTS.map((v) => v.id);

describe('JAN-EXEC P7-4b (a) — end-to-end discrimination: seven variants of the CLI', () => {
	it('⭐ seven variants, each one find that occurs EXACTLY ONCE in the faithful CLI, each changing it', () => {
		expect(ALL_VARIANTS).toEqual([
			'DEFAULT_TOP_20',
			'NO_CASE_FOLDING',
			'TIES_UNSORTED',
			'STOP_WORDS_IGNORED',
			'UNKNOWN_OPTION_EXIT_1',
			'MISSING_FILE_EXIT_2',
			'STDIN_IGNORED'
		]);
		const base = faithfulText();
		for (const v of END_TO_END_VARIANTS) {
			const applied = applyVariant(base, v);
			expect(applied, v.id).toHaveProperty('text');
			if ('text' in applied) expect(applied.text, v.id).not.toBe(base);
			expect(base.split(v.find).length - 1, `${v.id}: occurrences of its find`).toBe(1);
		}
	});

	it('⛔ CONTROL — a find that is absent, or present twice, is refused (NOT_APPLIED), never the faithful text renamed', () => {
		const v = { id: 'X', what: 'x', find: 'needle', replace: 'thread' };
		expect(applyVariant('no such text', v)).toEqual({
			problem: "X: its find occurs 0 times in the faithful CLI, not once: 'needle'"
		});
		expect(applyVariant('needle and needle', v)).toEqual({
			problem: "X: its find occurs 2 times in the faithful CLI, not once: 'needle'"
		});
		expect(applyVariant('a needle', { ...v, replace: 'needle' })).toEqual({
			problem: 'X: its replacement is its find, so it would run the faithful CLI under a variant’s name'
		});
	});

	it(
		'⭐ the reference: its suite passes on its own entry and on the faithful CLI, then CATCHES all seven variants',
		async () => {
			const before = treeDigest(REFERENCE);
			const r = await endToEndDiscrimination(REFERENCE);
			expect(r.verdict).toBe('JUDGED');
			expect(r.own?.exitCode).toBe(0);
			expect(r.faithful?.exitCode).toBe(0);
			expect(r.faithful?.failed).toBe(0);
			expect(r.baselineFailing).toEqual([]);
			// Its 13 tests each start the stub once, and fail on it.
			expect([r.stubStarts, r.stubUndetected]).toEqual([13, false]);
			expect(r.variants.map((v) => [v.id, v.outcome])).toEqual(ALL_VARIANTS.map((id) => [id, 'CAUGHT']));
			expect(r.caught).toBe(7);
			expect(r.missed).toBe(0);
			// Each catch names the tests that failed on it — never a bare exit code.
			for (const v of r.variants) expect(v.failing.length, v.id).toBeGreaterThan(0);
			expect(treeDigest(REFERENCE), 'the target is byte-identical afterwards').toEqual(before);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a weak end-to-end suite MISSES the four variants it does not test, and catches the other three',
		async () => {
			const r = await endToEndDiscrimination(referenceWith('weak-e2e'));
			expect(r.verdict).toBe('JUDGED');
			expect(Object.fromEntries(r.variants.map((v) => [v.id, v.outcome]))).toEqual({
				DEFAULT_TOP_20: 'MISSED',
				NO_CASE_FOLDING: 'CAUGHT',
				TIES_UNSORTED: 'MISSED',
				STOP_WORDS_IGNORED: 'CAUGHT',
				UNKNOWN_OPTION_EXIT_1: 'MISSED',
				MISSING_FILE_EXIT_2: 'MISSED',
				STDIN_IGNORED: 'CAUGHT'
			});
			expect([r.caught, r.missed]).toEqual([3, 4]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a suite red on a correct CLI judges no variant: BASELINE_FAILED, every variant NOT_JUDGED',
		async () => {
			const r = await endToEndDiscrimination(referenceWith('red-tests'));
			expect(r.verdict).toBe('BASELINE_FAILED');
			expect(r.faithful?.exitCode).not.toBe(0);
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'NOT_JUDGED'));
			expect([r.caught, r.missed]).toEqual([0, 0]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — the baseline is the FAITHFUL CLI, not the product’s own entry: a suite pinning more than the brief cannot judge',
		async () => {
			// The reference words a bad N as "-n must be a positive integer, not '0'"; the faithful CLI leaves out the value.
			// The brief fixes only "wordfreq: " and one line — so this suite passes the product and fails the faithful CLI,
			// and a variant's failure under it could be the wording's, not the variant's.
			const exact = [
				"import assert from 'node:assert/strict';",
				"import { spawnSync } from 'node:child_process';",
				"import { test } from 'node:test';",
				"import { fileURLToPath } from 'node:url';",
				"const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));",
				"test('a bad N names the value it refused', () => {",
				"\tconst r = spawnSync(process.execPath, [BIN, '-n', '0'], { input: 'a', encoding: 'utf8' });",
				"\tassert.equal(r.stderr, \"wordfreq: -n must be a positive integer, not '0'\\n\");",
				'});',
				''
			].join('\n');
			const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-exact-'));
			dirs.push(ws);
			cpSync(REFERENCE, ws, { recursive: true });
			rmSync(join(ws, 'test', 'e2e'), { recursive: true, force: true });
			mkdirSync(join(ws, 'test', 'e2e'));
			writeFileSync(join(ws, 'test', 'e2e', 'exact.test.js'), exact);
			const r = await endToEndDiscrimination(ws);
			expect(r.own?.exitCode, 'the product passes its own suite').toBe(0);
			expect(r.faithful?.exitCode, 'the faithful CLI does not').not.toBe(0);
			expect(r.verdict).toBe('BASELINE_FAILED');
			// ⛔ And it says WHICH tests failed the faithful CLI, so a reader can see it is the wording and not the product.
			expect(r.baselineFailing).toEqual(['test/e2e/exact.test.js > a bad N names the value it refused']);
			// ⭐ (a′) judges where (a) cannot: its baseline is the product's OWN entry, which this suite passes. A fault in
			// parseTop's first guard changes the message the suite pins (CAUGHT); one in the stop-word branch, which `-n 0`
			// never reaches, changes nothing it sees (SURVIVED).
			const src = await endToEndSourceDiscrimination(ws, {
				files: ['src/options.js'],
				operators: ['CONDITION_NEGATE']
			});
			expect(src.suite).toBe('e2e');
			expect(src.verdict).toBe('JUDGED');
			expect(src.baseline?.exitCode).toBe(0);
			expect(src.baselineFailing).toEqual([]);
			const outcomeOf = (original: string) => src.mutants.find((m) => m.original === original)?.outcome;
			expect(outcomeOf('value === undefined')).toBe('CAUGHT');
			expect(outcomeOf('argv[i] === undefined')).toBe('SURVIVED');
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a suite whose every test is skipped checked nothing: BASELINE_FAILED, never seven MISSED',
		async () => {
			const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-skipped-'));
			dirs.push(ws);
			cpSync(REFERENCE, ws, { recursive: true });
			rmSync(join(ws, 'test', 'e2e'), { recursive: true, force: true });
			mkdirSync(join(ws, 'test', 'e2e'));
			writeFileSync(
				join(ws, 'test', 'e2e', 'skipped.test.js'),
				"import { test } from 'node:test';\ntest.skip('the tool, some day', () => {});\n"
			);
			const r = await endToEndDiscrimination(ws);
			// It exited 0 with nothing failed — and nothing passed, so it is no baseline.
			expect(r.faithful?.exitCode).toBe(0);
			expect([r.faithful?.passed, r.faithful?.failed, r.faithful?.skipped]).toEqual([0, 0, 1]);
			expect(r.verdict).toBe('BASELINE_FAILED');
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'NOT_JUDGED'));
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — end-to-end tests that never run the entry cannot catch a variant there: ENTRY_NOT_RUN, never seven MISSED',
		async () => {
			// The in-process suite passes on a correct product — and on the stub entry too, so a variant written over
			// bin/wordfreq.js is run by none of its tests, and "missed" would describe the entry, not the tests.
			const r = await endToEndDiscrimination(referenceWith('no-spawn'));
			expect(r.verdict).toBe('ENTRY_NOT_RUN');
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'NOT_JUDGED'));
			expect([r.caught, r.missed]).toEqual([0, 0]);
			expect(r.faithful?.exitCode).toBe(0);
			expect(r.stubbed?.exitCode).toBe(0);
			// ⛔ The refusal stands on the count, not on the pass: the stub was never started.
			expect(r.stubStarts).toBe(0);
		},
		RUN_BUDGET_MS
	);

	it(
		'⭐ end-to-end tests that START the entry and assert only a non-zero exit are judged — every variant MISSED, which is true — never ENTRY_NOT_RUN',
		async () => {
			// ⛔ The first version refused this suite as ENTRY_NOT_RUN: it passes against the stub, and the tool read that as
			// "never ran the entry". It does run it — twice — and catches nothing a do-nothing program would not also pass.
			const weakOnly = [
				"import assert from 'node:assert/strict';",
				"import { spawnSync } from 'node:child_process';",
				"import { test } from 'node:test';",
				"import { fileURLToPath } from 'node:url';",
				"const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));",
				"const run = (args) => spawnSync(process.execPath, [BIN, ...args], { input: '', encoding: 'utf8' });",
				"test('an unknown option fails', () => assert.notEqual(run(['--bogus']).status, 0));",
				"test('a missing file fails', () => assert.notEqual(run(['no-such-file.txt']).status, 0));",
				''
			].join('\n');
			const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-weakonly-'));
			dirs.push(ws);
			cpSync(REFERENCE, ws, { recursive: true });
			rmSync(join(ws, 'test', 'e2e'), { recursive: true, force: true });
			mkdirSync(join(ws, 'test', 'e2e'));
			writeFileSync(join(ws, 'test', 'e2e', 'weak.test.js'), weakOnly);
			const r = await endToEndDiscrimination(ws);
			expect(r.verdict).toBe('JUDGED');
			expect(r.stubbed?.exitCode, 'the suite passes against the stub').toBe(0);
			expect(r.stubStarts, 'and started it, once per test').toBe(2);
			expect(r.stubUndetected).toBe(true);
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'MISSED'));
			expect([r.caught, r.missed]).toEqual([0, 7]);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a workspace with tests but no bin/wordfreq.js is NO_ENTRY: a variant written there replaces nothing',
		async () => {
			const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-noentry-'));
			dirs.push(ws);
			cpSync(REFERENCE, ws, { recursive: true });
			rmSync(join(ws, 'bin'), { recursive: true, force: true });
			const r = await endToEndDiscrimination(ws);
			expect(r.verdict).toBe('NO_ENTRY');
			expect(r.own).toBeNull();
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'NOT_JUDGED'));
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a workspace with no test/e2e/*.test.js is NO_E2E_TESTS, and runs nothing',
		async () => {
			const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-empty-'));
			dirs.push(ws);
			cpSync(join(REFERENCE, 'bin'), join(ws, 'bin'), { recursive: true });
			const r = await endToEndDiscrimination(ws);
			expect(r.verdict).toBe('NO_E2E_TESTS');
			expect(r.own).toBeNull();
			expect(r.variants.map((v) => v.outcome)).toEqual(ALL_VARIANTS.map(() => 'NOT_JUDGED'));
		},
		RUN_BUDGET_MS
	);
});

/** The mutants of the reference file `file`. */
const referenceMutants = (file: string): Mutant[] =>
	mutantsOf(file, readFileSync(join(REFERENCE, file), 'utf8'));
const all = (): Mutant[] => ['src/options.js', 'src/count.js', 'src/cli.js'].flatMap(referenceMutants);

describe('JAN-EXEC P7-4b (b) — unit discrimination: generic operator mutations of src/*.js', () => {
	it('⭐ every operator finds sites in the reference, and the mutants the design names are among them', () => {
		const mutants = all();
		const operators = new Set(mutants.map((m) => m.operator));
		expect([...operators].sort()).toEqual([...MUTATION_OPERATORS].sort());
		// "a removed toLowerCase()", "a negated sort comparator", "a changed numeric literal", "a flipped comparison".
		expect(mutants.some((m) => m.operator === 'CALL_REMOVE' && m.original === 'word.toLowerCase()')).toBe(true);
		expect(mutants.some((m) => m.operator === 'COMPARATOR_NEGATE' && m.original === 'byFrequency')).toBe(true);
		expect(mutants.some((m) => m.operator === 'NUMBER' && m.file === 'src/options.js' && m.original === '10')).toBe(true);
		expect(mutants.some((m) => m.operator === 'COMPARISON_FLIP' && m.original === '<')).toBe(true);
		// Every id is unique, and every mutant changes its file.
		expect(new Set(mutants.map((m) => m.id)).size).toBe(mutants.length);
		for (const m of mutants) expect(m.text, m.id).not.toBe(readFileSync(join(REFERENCE, m.file), 'utf8'));
	});

	it(
		'⭐ the reference: its unit tests pass unmutated, then CATCH every mutant',
		async () => {
			const before = treeDigest(REFERENCE);
			const r = await unitDiscrimination(REFERENCE);
			expect(r.verdict).toBe('JUDGED');
			expect(r.baseline?.exitCode).toBe(0);
			const notCaught = r.mutants.filter((m) => m.outcome !== 'CAUGHT').map((m) => `${m.id}: ${m.outcome}`);
			expect(notCaught).toEqual([]);
			expect(r.counts.caught).toBe(all().length);
			expect(treeDigest(REFERENCE), 'the target is byte-identical afterwards').toEqual(before);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — weak unit tests: the same CALL_REMOVE mutants of src/count.js SURVIVE, the reference catches them',
		async () => {
			const scope: UnitScope = { files: ['src/count.js'], operators: ['CALL_REMOVE'] };
			const weak = await unitDiscrimination(referenceWith('weak-unit'), scope);
			const strong = await unitDiscrimination(REFERENCE, scope);
			expect(weak.verdict).toBe('JUDGED');
			const outcomes = (r: typeof weak) => Object.fromEntries(r.mutants.map((m) => [m.original, m.outcome]));
			// words()'s fold, parseStopWords' trim and its fold: three sites.
			expect(weak.mutants.map((m) => m.original).sort()).toEqual(['line.trim()', 'word.toLowerCase()', 'word.toLowerCase()']);
			expect(outcomes(weak)).toEqual({ 'line.trim()': 'SURVIVED', 'word.toLowerCase()': 'SURVIVED' });
			expect(outcomes(strong)).toEqual({ 'line.trim()': 'CAUGHT', 'word.toLowerCase()': 'CAUGHT' });
			expect(weak.counts.survived).toBe(3);
		},
		RUN_BUDGET_MS
	);

	it(
		'⭐ (a′) — the same three mutants judged END TO END on the reference: the stop-word trim SURVIVES there, and the unit tests catch it',
		async () => {
			// The reference's end-to-end stop-word file has no line with a space in it, so no end-to-end test can see
			// `trim()` removed; its unit tests can. (a′) and (b) answer different questions, and can disagree — the reference's
			// whole (a′) run, measured once: 72 of its 89 source mutants caught, 17 survived; (b) catches all 89.
			const scope: UnitScope = { files: ['src/count.js'], operators: ['CALL_REMOVE'] };
			const e2e = await endToEndSourceDiscrimination(REFERENCE, scope);
			expect(e2e.suite).toBe('e2e');
			expect(e2e.verdict).toBe('JUDGED');
			expect(e2e.files).toEqual(['test/e2e/cli.test.js']);
			expect(e2e.mutants.map((m) => [m.original, m.outcome])).toEqual([
				['word.toLowerCase()', 'CAUGHT'],
				['line.trim()', 'SURVIVED'],
				['word.toLowerCase()', 'CAUGHT']
			]);
			const unit = await unitDiscrimination(REFERENCE, scope);
			expect(unit.suite).toBe('unit');
			expect(unit.mutants.map((m) => m.outcome)).toEqual(['CAUGHT', 'CAUGHT', 'CAUGHT']);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — unit tests red before any mutation judge no mutant: BASELINE_FAILED, every mutant NOT_JUDGED',
		async () => {
			const r = await unitDiscrimination(referenceWith('red-tests'), { files: ['src/count.js'] });
			expect(r.verdict).toBe('BASELINE_FAILED');
			expect(r.mutants.length).toBeGreaterThan(0);
			expect(new Set(r.mutants.map((m) => m.outcome))).toEqual(new Set(['NOT_JUDGED']));
			expect(r.counts.caught).toBe(0);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — ISOLATION: a caught mutant in one file never makes a survivor in another read CAUGHT, at one worker or two',
		async () => {
			// ⛔ THE REFERENCE CANNOT SHOW THIS: its tests catch every mutant, and a leftover mutant only turns CAUGHT into
			// CAUGHT. So a hand-made pair: first a mutant of src/count.js that is slow to load and then throws (caught by
			// any suite that imports it, and in place for two seconds), then a change to src/options.js no test can see (a
			// survivor). At one worker the second runs after the first in the same copy, so only the restore between them
			// keeps count.js whole; at two workers they run at once, so only a copy of each worker's own does.
			const count = readFileSync(join(REFERENCE, 'src', 'count.js'), 'utf8');
			const options = readFileSync(join(REFERENCE, 'src', 'options.js'), 'utf8');
			const handMade = (file: string, text: string, what: string): Mutant => ({
				id: `${file}:1:1 HAND-MADE ${what}`,
				file,
				operator: 'NUMBER',
				line: 1,
				column: 1,
				original: '',
				replacement: what,
				text
			});
			const caught = handMade(
				'src/count.js',
				`${count}\nconst until = Date.now() + 2000;\nwhile (Date.now() < until);\nthrow new Error('a seeded fault: count.js does not load');\n`,
				'slow to load, then throws'
			);
			const survivor = handMade('src/options.js', `${options}\n// a seeded change that no test can observe\n`, 'a comment');
			for (const concurrency of [1, 2]) {
				const r: SourceReport = await unitDiscrimination(REFERENCE, { mutants: [caught, survivor], concurrency });
				expect(r.mutants.map((m) => m.outcome), `at ${concurrency} worker(s)`).toEqual(['CAUGHT', 'SURVIVED']);
			}
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — a mutant that does not parse is INVALID, never CAUGHT',
		async () => {
			const original = readFileSync(join(REFERENCE, 'src', 'count.js'), 'utf8');
			const broken: Mutant = {
				id: 'src/count.js:1:1 HAND-MADE',
				file: 'src/count.js',
				operator: 'NUMBER',
				line: 1,
				column: 1,
				original: '',
				replacement: '(((',
				text: `(((\n${original}`
			};
			const r = await unitDiscrimination(REFERENCE, { mutants: [broken] });
			expect(r.mutants.map((m) => m.outcome)).toEqual(['INVALID']);
			expect(r.counts).toEqual({ caught: 0, survived: 0, timedOut: 0, invalid: 1, notJudged: 0 });
		},
		RUN_BUDGET_MS
	);
});
