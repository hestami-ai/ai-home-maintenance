// ⭐ `JAN-EXEC` Phase 7, P7-4a (DESIGN-the-live-end-to-end-run.md §3.1, §6) — THE ACCEPTANCE SUITE IS ITSELF TESTED, ON THE
// REFERENCE FIXTURE AND ON SEVEN BROKEN COPIES OF IT, BEFORE IT IS TRUSTED WITH A PAID RUN'S ARCHIVE.
//
// The suite (`scripts/phase7/acceptance/wordfreq.test.mjs`) decides whether a phase's archived workspace does what the brief
// asks. An instrument that passes a correct product says nothing until it is also seen to FAIL a wrong one — a
// measurement nothing attacks is not a guard. So each limb here is one of:
//   · it PASSES the reference fixture (`verif/fixtures/phase7/reference/`), seven cases of seven;
//   · it passes the faithful single-file CLI as well — a second implementation of the same brief, so a case that encoded
//     one implementation's accident rather than the brief would show here;
//   · ⛔ it FAILS each seeded end-to-end variant (`seeded-faults.ts` `END_TO_END_VARIANTS`), in exactly the cases that
//     variant's deviation breaks — pinned case by case, so a case that stops discriminating reddens by name;
//   · ⛔ it FAILS, every case, when `WORDFREQ_WORKSPACE` names nothing — a suite that skipped there would read as a pass;
//   · ⭐ it PASSES the readings the brief leaves open — lines ended CRLF, as `os.EOL` writes them on this Windows host, and
//     a last line with no terminator — and ⛔ FAILS the error shapes the brief closes: a second line, a missing prefix
//     (`READINGS`). ⚠ The first of these was red when written: the suite compared standard output byte for byte, LF-ended,
//     and failed five of seven cases on a CRLF product while its header said no case depended on a reading.
// And the brief it was written from is pinned by hash: an edit to the brief is an edit to what the suite must test.
//
// No model is called. Each run is `node --test` over the suite, with the product started as a child process.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runNodeTests, type SuiteRun } from '../scripts/phase7/node-tests.js';
import {
	applyVariant,
	END_TO_END_VARIANTS,
	faithfulText,
	type EndToEndVariant
} from '../scripts/phase7/seeded-faults.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SUITE = 'scripts/phase7/acceptance/wordfreq.test.mjs';
const REFERENCE = join(ROOT, 'verif', 'fixtures', 'phase7', 'reference');
/** One budget for a whole suite run: seven cases, at most three starts of the product each. */
const SUITE_BUDGET_MS = 120_000;

/** The seven cases, in the order design §3.1 lists them. */
const CASES = [
	'case 1 — a file: "<count> <word>" lines, most frequent first, 10 by default',
	'case 2 — standard input, when no file is given and when the file is "-"',
	'case 3 — N: -n 3 and --top 3 print the three most frequent words',
	'case 4 — case folding: words are folded to lower case by default, and kept with --case-sensitive',
	'case 5 — a stop-word list: its words are excluded, compared after folding unless --case-sensitive',
	'case 6 — an unknown option: exit 2, and one line on standard error beginning "wordfreq: "',
	'case 7 — a missing file: exit 1, and one line on standard error beginning "wordfreq: "'
] as const;
const caseNamed = (n: number): string => CASES[n - 1]!;

/**
 * ⛔ WHICH CASES EACH VARIANT MUST FAIL — derived from each case's input and the variant's one deviation, and pinned. A
 * case missing here that the variant fails, or one listed that it passes, reddens by name: the suite's discrimination is
 * the thing under test, not merely that "something failed".
 */
const MUST_FAIL: Readonly<Record<string, readonly number[]>> = {
	// 12 distinct words: a default of 20 prints 12 lines. Case 3 names its N and is untouched.
	DEFAULT_TOP_20: [1],
	// Case 4's default run keeps three spellings; case 5's folded stop words then miss "The" and "THE".
	NO_CASE_FOLDING: [4, 5],
	// Case 5's folded run is the one three-way tie, met as dog, cat, bird.
	TIES_UNSORTED: [5],
	STOP_WORDS_IGNORED: [5],
	UNKNOWN_OPTION_EXIT_1: [6],
	MISSING_FILE_EXIT_2: [7],
	// Every case whose text arrives on standard input: 2, 4 and 5.
	STDIN_IGNORED: [2, 4, 5]
};

/**
 * ⭐ READINGS OF THE BRIEF, EACH A ONE-LINE CHANGE TO THE FAITHFUL CLI, AND THE CASES EACH MUST FAIL.
 *   · "One per line" fixes neither the line terminator nor a final newline: a product ending its lines CRLF, or its last
 *     line with none, prints the same lines — so both must pass all seven. The run is on Windows (`REG-D-102` item 3),
 *     where a product that writes `os.EOL` ends every line CRLF.
 *   · "Errors go to standard error, as one line beginning "wordfreq: "" closes the error's shape: a second line, or another
 *     prefix, must fail the two cases that make an error — and nothing else.
 */
const READINGS: readonly { readonly variant: EndToEndVariant; readonly mustFail: readonly number[] }[] = [
	{
		variant: {
			id: 'CRLF_LINES',
			what: 'each output line ends CRLF, as os.EOL writes it on Windows',
			find: "process.stdout.write(top.map(([word, count]) => `${count} ${word}\\n`).join(''));",
			replace: "process.stdout.write(top.map(([word, count]) => `${count} ${word}\\r\\n`).join(''));"
		},
		mustFail: []
	},
	{
		variant: {
			id: 'NO_FINAL_NEWLINE',
			what: 'the last output line has no terminator',
			find: "process.stdout.write(top.map(([word, count]) => `${count} ${word}\\n`).join(''));",
			replace: "process.stdout.write(top.map(([word, count]) => `${count} ${word}`).join('\\n'));"
		},
		mustFail: []
	},
	{
		variant: {
			id: 'TWO_LINE_ERROR',
			what: 'an error is written as two lines',
			find: "process.stderr.write(`wordfreq: ${String(message).replace(/[\\r\\n]+/g, ' ')}\\n`);",
			replace: "process.stderr.write(`wordfreq: ${String(message).replace(/[\\r\\n]+/g, ' ')}\\nTry --help for usage.\\n`);"
		},
		mustFail: [6, 7]
	},
	{
		variant: {
			id: 'NO_ERROR_PREFIX',
			what: 'an error begins "error: ", not "wordfreq: "',
			find: 'process.stderr.write(`wordfreq: ${',
			replace: 'process.stderr.write(`error: ${'
		},
		mustFail: [6, 7]
	}
];

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** The suite, run against `workspace` — or with `WORDFREQ_WORKSPACE` unset when `workspace` is undefined. */
function acceptance(workspace: string | undefined): Promise<SuiteRun> {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env))
		if (v !== undefined && k.toUpperCase() !== 'WORDFREQ_WORKSPACE') env[k] = v;
	if (workspace !== undefined) env.WORDFREQ_WORKSPACE = workspace;
	return runNodeTests({ cwd: ROOT, files: [SUITE], env, timeoutMs: SUITE_BUDGET_MS });
}

/** A workspace holding only what the suite reads: an ES-module package and `bin/wordfreq.js` = `entry`. */
function workspaceWith(entry: string): string {
	const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-acceptance-'));
	dirs.push(ws);
	mkdirSync(join(ws, 'bin'));
	writeFileSync(join(ws, 'package.json'), '{ "type": "module" }\n');
	writeFileSync(join(ws, 'bin', 'wordfreq.js'), entry);
	return ws;
}

const passedNames = (r: SuiteRun) => r.tests.filter((t) => t.passed).map((t) => t.name);
const failedNames = (r: SuiteRun) => r.tests.filter((t) => !t.passed).map((t) => t.name);

describe('JAN-EXEC P7-4a — the acceptance suite, written from the brief', () => {
	it('⭐ the brief is the canonical text the suite was written from — pinned by hash, LF only', () => {
		const brief = readFileSync(join(ROOT, 'scripts', 'phase7', 'product-brief.md'));
		expect(brief.includes(13), 'no CR byte').toBe(false);
		expect(createHash('sha256').update(brief).digest('hex')).toBe(
			'ef1b696cab064ffcebc4d23411a3a43fca5142b8bcbfd006f88f3095284b25c8'
		);
	});

	it('⭐ the brief can be carried VERBATIM in a work unit’s prompt: it holds no brace, so it adds no marker', () => {
		// The run's prompts must carry this text, or this suite measures the gap between the brief a phase was given and
		// the brief it is tested against, not the product (design §3.2: "Each prompt carries the same short product
		// brief"). A prompt may hold no brace but around a marker a work unit fills (`REG-F-507`); this one holds none.
		const brief = readFileSync(join(ROOT, 'scripts', 'phase7', 'product-brief.md'), 'utf8');
		expect(brief).not.toMatch(/[{}]/);
	});

	it(
		'⭐ the reference fixture passes all seven cases',
		async () => {
			const r = await acceptance(REFERENCE);
			expect(failedNames(r)).toEqual([]);
			expect([...passedNames(r)].sort()).toEqual([...CASES].sort());
			expect(r.exitCode).toBe(0);
		},
		SUITE_BUDGET_MS
	);

	it(
		'⭐ the faithful single-file CLI passes all seven too — a second implementation of the same brief',
		async () => {
			const r = await acceptance(workspaceWith(faithfulText()));
			expect(failedNames(r)).toEqual([]);
			expect(passedNames(r)).toHaveLength(7);
			expect(r.exitCode).toBe(0);
		},
		SUITE_BUDGET_MS
	);

	it(
		'⛔ CONTROL — WORDFREQ_WORKSPACE unset: all seven cases FAIL, and none passes',
		async () => {
			const r = await acceptance(undefined);
			expect(passedNames(r)).toEqual([]);
			expect([...failedNames(r)].sort()).toEqual([...CASES].sort());
			expect(r.exitCode).not.toBe(0);
		},
		SUITE_BUDGET_MS
	);

	it('⛔ the pinned table covers every variant, and every variant fails at least one case', () => {
		expect(Object.keys(MUST_FAIL).sort()).toEqual(END_TO_END_VARIANTS.map((v) => v.id).sort());
		for (const [id, cases] of Object.entries(MUST_FAIL)) expect(cases.length, id).toBeGreaterThan(0);
	});

	for (const variant of END_TO_END_VARIANTS)
		it(
			`⛔ CONTROL — variant ${variant.id} (${variant.what}) fails exactly the cases its deviation breaks`,
			async () => {
				const applied = applyVariant(faithfulText(), variant);
				if (!('text' in applied)) throw new Error(`${variant.id}: ${applied.problem}`);
				const r = await acceptance(workspaceWith(applied.text));
				const expected = (MUST_FAIL[variant.id] ?? []).map(caseNamed);
				expect([...failedNames(r)].sort()).toEqual([...expected].sort());
				expect(passedNames(r)).toHaveLength(7 - expected.length);
				expect(r.exitCode).not.toBe(0);
			},
			SUITE_BUDGET_MS
		);

	for (const { variant, mustFail } of READINGS)
		it(
			`${mustFail.length === 0 ? '⭐' : '⛔ CONTROL —'} reading ${variant.id} (${variant.what}): ${
				mustFail.length === 0 ? 'all seven cases pass' : `fails exactly case(s) ${mustFail.join(' and ')}`
			}`,
			async () => {
				const applied = applyVariant(faithfulText(), variant);
				if (!('text' in applied)) throw new Error(`${variant.id}: ${applied.problem}`);
				const r = await acceptance(workspaceWith(applied.text));
				expect([...failedNames(r)].sort()).toEqual(mustFail.map(caseNamed).sort());
				expect(passedNames(r)).toHaveLength(7 - mustFail.length);
				expect(r.exitCode === 0).toBe(mustFail.length === 0);
			},
			SUITE_BUDGET_MS
		);
});
