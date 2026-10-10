// ⭐ `JAN-EXEC` Phase 7, P7-4b (DESIGN-the-live-end-to-end-run.md §6) — SEEDED FAULTS: WOULD THE MODEL'S OWN TESTS CATCH A
// KNOWN FAULT?
//
//   bun scripts/phase7/seeded-faults.ts --workspace <archived workspace> --out <report.json> [--only e2e|e2e-source|unit]
//
// A phase's tests passing says nothing until they are seen to fail on a wrong product. So, on a COPY of a phase's
// archived workspace (`node-tests.ts`; never in place):
//
//   (a) END TO END. Seven faulty variants of the CLI, each ONE known deviation from the brief, cut from the faithful
//       single-file CLI (`faithful-wordfreq.js`) by one find-and-replace. Each is written over the copy's
//       `bin/wordfreq.js`, the copy's own `test/e2e/*.test.js` are run, and a variant is CAUGHT when they fail.
//   (a′) END TO END, ON THE PRODUCT'S OWN CODE. The generic mutations of (b), one at a time — but judged by the copy's
//       END-TO-END tests, through the product's own entry. This is the design's own shape for P7-4b (§6: "hand-made faults
//       in `src/` ... Each must make the model's own suite fail"), with the operators standing in for the hand-made list
//       (a wrong N is a changed number, folding off a removed `toLowerCase()`), because `src/` is the model's, shaped as
//       the model chose, and no fixed list can be written against it before the run.
//   (b) UNIT. Generic operator mutations of the copy's `src/*.js`, one at a time — a changed number, a flipped
//       comparison, a removed `toLowerCase()`, a negated sort comparator and the rest (`MUTATION_OPERATORS`) — found by
//       walking the TypeScript parser's syntax tree, never by a pattern over text. The copy's `test/unit/*.test.js` are
//       run on each, and a mutant is CAUGHT when they fail.
//
// ⛔ EACH ARM JUDGES NOTHING UNTIL ITS BASELINE IS GREEN. (a) runs the target's end-to-end tests on the faithful CLI
// first, (a′) and (b) run their suites on the unmutated product first; a suite already red there would fail on every
// variant and every mutant, and each would read CAUGHT for a failure no fault caused. Such a suite is BASELINE_FAILED,
// every variant and mutant is NOT_JUDGED, and the tests that failed are NAMED (`baselineFailing`). ⭐ (a)'s baseline is the
// faithful CLI, not the product's own entry: a variant differs from the faithful CLI by exactly its deviation, so only
// that baseline makes a catch the deviation's. The product's own entry is run too, and reported (`own`), because a
// product whose own tests fail it is a finding of its own.
// ⚠ AND SO (a) IS LIKELY BASELINE_FAILED FOR A SUITE THAT PINS WORDING BEYOND THE BRIEF. The brief fixes "wordfreq: " and
// one line; the faithful CLI's words after it are its own ("unknown option", "no such file"), and a model's test that
// asserts /Unknown option/ or /not found/ fails on it. (a) then judges nothing, and names the tests; (a′), whose baseline
// is the product's own entry, still judges — which is why it exists.
// ⛔ AND (a) JUDGES NOTHING WHERE ITS VARIANTS WOULD GO UNRUN (`entry.ts`): a workspace with no `bin/wordfreq.js` is
// NO_ENTRY, and one whose end-to-end tests never START the entry — replaced by a stub that records each start, it
// records none — is ENTRY_NOT_RUN. Without those two, a suite that never ran the entry would read seven MISSED — a verdict
// about the entry, not the tests. ⛔ THE REFUSAL STANDS ON THE STUB'S COUNT, NEVER ON THE SUITE PASSING AGAINST IT: the
// first version refused any suite that passed against the stub, and so would have refused tests that DO start the entry
// and assert only a non-zero exit (the stub's 99 is one) — tests whose seven MISSED are true. Those are judged, and
// flagged (`stubUndetected`): they start the entry, and nothing they assert fails a program that does nothing.
// ⛔ A VARIANT WHOSE FIND IS NOT IN THE FAITHFUL CLI EXACTLY ONCE IS NOT_APPLIED — never run as the faithful text under a
// variant's name, which would read MISSED for a fault never planted (the mutation ledger's anchor rule).
// ⛔ A MUTANT THAT DOES NOT PARSE (`node --check`) IS INVALID, never CAUGHT: a syntax error fails every suite.
//
// ⚠ WHAT IT DOES NOT SAY. A MISSED variant or a SURVIVED mutant is a fault the tests do not see; a CAUGHT one says only that
// some test failed, not that a test was written for it. An equivalent mutant — one no test could ever tell apart — would
// read SURVIVED and be no gap at all; none survives (b) on the reference fixture (`verif/phase7-seeded-faults.test.ts`), and
// on a phase's workspace each survivor is read before it is counted as a gap. ⚠ (a′) SURVIVORS ARE EXPECTED EVEN OF A
// SOUND PRODUCT: measured once on the reference (2026-10-09), 17 of its 89 source mutants survive its end-to-end suite —
// defaults the CLI always overrides (equivalent through the entry), tie-break and `--` branches its inputs never reach, a
// stop-word `trim()` no end-to-end file needs — where (b) catches all 89. An (a′) survivor is read, not counted.
// ⚠ `src/*.js` is the brief's layout. A product that put its code elsewhere is NO_SOURCES here, and says so; one that put
// its tests elsewhere is NO_UNIT_TESTS / NO_E2E_TESTS.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import ts from 'typescript';
import { parseFlags, reportPathProblem, writeNewReport } from './cli.js';
import { ENTRY, hasEntry, installStub, STUB_EXIT_CODE, writeEntry, type InstalledStub } from './entry.js';
import {
	copyWorkspace,
	nodeExecutable,
	removeCopy,
	runNodeTests,
	runProcess,
	suiteFailed,
	suitePassed,
	testFiles,
	testName,
	type SuiteRun
} from './node-tests.js';
import { EXECUTION_COMMAND_TIMEOUT_MS, runnerEnvironment } from './runner-environment.js';

// ── (a) the end-to-end variants ──────────────────────────────────────────────────────────────────────────────────

/** One faulty variant of the faithful CLI: one deviation from the brief, as one find-and-replace. */
export interface EndToEndVariant {
	readonly id: string;
	readonly what: string;
	readonly find: string;
	readonly replace: string;
}

/**
 * ⭐ THE SEVEN, one per deviation the design names (§6, P7-4b: "a wrong N, case folding off, a wrong exit code, a broken
 * entry point"; the task's seven). Each is a slip a real implementation makes, and each is one an adequate end-to-end suite
 * must catch:
 *   · a default of 20 rather than of 5: only a test that feeds MORE than 10 distinct words can tell 20 from 10;
 *   · ties in first-seen order: only a tie met out of ascending order shows it;
 *   · the two exit codes swapped for each other's: only a test of the exact code catches either.
 */
export const END_TO_END_VARIANTS: readonly EndToEndVariant[] = [
	{
		id: 'DEFAULT_TOP_20',
		what: 'the default N is 20, not 10',
		find: 'const DEFAULT_TOP = 10;',
		replace: 'const DEFAULT_TOP = 20;'
	},
	{
		id: 'NO_CASE_FOLDING',
		what: 'words are counted as written: no case folding by default',
		find: 'const words = caseSensitive ? found : found.map((word) => word.toLowerCase());',
		replace: 'const words = found;'
	},
	{
		id: 'TIES_UNSORTED',
		what: 'a tie is left in the order its words were first met, not broken by the word',
		find: 'return wordA < wordB ? -1 : wordA > wordB ? 1 : 0;',
		replace: 'return 0;'
	},
	{
		id: 'STOP_WORDS_IGNORED',
		what: 'the stop-word file is read, and then ignored',
		find: 'if (stopWords.has(word)) continue;',
		replace: '// the stop words are never consulted'
	},
	{
		id: 'UNKNOWN_OPTION_EXIT_1',
		what: 'an unknown option exits 1, not 2',
		find: "return { exit: fail(`unknown option '${arg}'`, EXIT_USAGE) };",
		replace: "return { exit: fail(`unknown option '${arg}'`, EXIT_UNREADABLE) };"
	},
	{
		id: 'MISSING_FILE_EXIT_2',
		what: 'a missing input file exits 2, not 1',
		find: 'return fail(`cannot read ${name}: ${reason(error)}`, EXIT_UNREADABLE);',
		replace: 'return fail(`cannot read ${name}: ${reason(error)}`, EXIT_USAGE);'
	},
	{
		id: 'STDIN_IGNORED',
		what: 'standard input is never read: with no file there is no text',
		find: "text = fromStdin ? await readStdin() : await readFile(options.file, 'utf8');",
		replace: "text = fromStdin ? '' : await readFile(options.file, 'utf8');"
	}
];

/** The faithful single-file CLI every variant is cut from. */
export function faithfulText(): string {
	return readFileSync(new URL('./faithful-wordfreq.js', import.meta.url), 'utf8');
}

/** `variant` applied to `base`, or why it cannot be: its find must occur exactly once, and its replacement must differ. */
export function applyVariant(base: string, variant: EndToEndVariant): { readonly text: string } | { readonly problem: string } {
	const occurrences = base.split(variant.find).length - 1;
	if (occurrences !== 1)
		return {
			problem: `${variant.id}: its find occurs ${occurrences} times in the faithful CLI, not once: '${variant.find}'`
		};
	if (variant.replace === variant.find)
		return { problem: `${variant.id}: its replacement is its find, so it would run the faithful CLI under a variant’s name` };
	// A replacer function, so a `$` in the replacement is text, never a substitution pattern.
	return { text: base.replace(variant.find, () => variant.replace) };
}

export interface VariantOutcome {
	readonly id: string;
	readonly what: string;
	readonly outcome: 'CAUGHT' | 'MISSED' | 'NOT_APPLIED' | 'NOT_JUDGED';
	/** The tests that failed on this variant, as `<file> > <name>`. */
	readonly failing: readonly string[];
	readonly note?: string;
}

export interface EndToEndReport {
	readonly verdict: 'JUDGED' | 'BASELINE_FAILED' | 'ENTRY_NOT_RUN' | 'NO_ENTRY' | 'NO_E2E_TESTS';
	readonly files: readonly string[];
	/** The target's tests on its OWN entry — reported, never the baseline. */
	readonly own: SuiteRun | null;
	/** The target's tests on the faithful CLI — the baseline every variant is judged against. */
	readonly faithful: SuiteRun | null;
	/** The tests that failed on the faithful CLI, as `<file> > <name>` — what a BASELINE_FAILED stands on. */
	readonly baselineFailing: readonly string[];
	/** The target's tests on the stub entry (`entry.ts`). */
	readonly stubbed: SuiteRun | null;
	/** ⭐ How many times the stub started during that run — the proof that the tests run the entry at all. */
	readonly stubStarts: number | null;
	/** ⚠ The tests started the stub, and still passed: nothing they assert fails a program that does nothing. */
	readonly stubUndetected: boolean;
	readonly variants: readonly VariantOutcome[];
	readonly caught: number;
	readonly missed: number;
}

const notJudged = (v: EndToEndVariant, note?: string): VariantOutcome => ({
	id: v.id,
	what: v.what,
	outcome: 'NOT_JUDGED',
	failing: [],
	...(note ? { note } : {})
});

/** The tests of `r` that failed, as `<file> > <name>`. */
const failingIn = (r: SuiteRun | null | undefined): string[] =>
	(r?.tests ?? []).filter((t) => !t.passed).map(testName);

/** A report that judges no variant, saying why, with whichever runs were made. */
function refused(
	verdict: Exclude<EndToEndReport['verdict'], 'JUDGED'>,
	why: string,
	files: readonly string[],
	runs: Partial<Pick<EndToEndReport, 'own' | 'faithful' | 'stubbed' | 'stubStarts'>> = {}
): EndToEndReport {
	return {
		verdict,
		files,
		own: runs.own ?? null,
		faithful: runs.faithful ?? null,
		baselineFailing: failingIn(runs.faithful),
		stubbed: runs.stubbed ?? null,
		stubStarts: runs.stubStarts ?? null,
		stubUndetected: false,
		variants: END_TO_END_VARIANTS.map((v) => notJudged(v, why)),
		caught: 0,
		missed: 0
	};
}

/**
 * (a): the seven variants, each swapped in for `bin/wordfreq.js` on a copy of `workspace` — after three runs that must
 * each come out as stated, or no variant is judged: the product's own entry (reported only), the faithful CLI (GREEN, the
 * baseline) and the stub entry (STARTED at least once, or the tests never run the entry and could catch nothing written
 * there).
 */
export async function endToEndDiscrimination(workspace: string): Promise<EndToEndReport> {
	const files = testFiles(workspace, 'e2e');
	if (files.length === 0) return refused('NO_E2E_TESTS', 'the workspace holds no test/e2e/*.test.js', files);
	if (!hasEntry(workspace))
		return refused('NO_ENTRY', `the workspace has no ${ENTRY}, so a variant written there replaces nothing`, files);
	const copy = copyWorkspace(workspace, 'e2e-faults');
	const env = runnerEnvironment(process.env);
	const run = () => runNodeTests({ cwd: copy, files, env });
	let stub: InstalledStub | undefined;
	try {
		const own = await run();
		const base = faithfulText();
		writeEntry(copy, base);
		const faithful = await run();
		if (!suitePassed(faithful))
			return refused(
				'BASELINE_FAILED',
				'the target’s end-to-end tests do not pass on the faithful CLI, so no failure is a variant’s (if the ' +
					'tests that failed pin wording the brief does not fix, see the end-to-end source arm)',
				files,
				{ own, faithful }
			);
		stub = await installStub(copy, env);
		const stubbed = await run();
		const stubStarts = stub.starts();
		if (stubStarts === 0)
			return refused(
				'ENTRY_NOT_RUN',
				`the target’s end-to-end tests never started ${ENTRY}: replaced by a stub that records each start (and ` +
					`exits ${STUB_EXIT_CODE}), it recorded none, so no variant written there would be run (see the spawn check)`,
				files,
				{ own, faithful, stubbed, stubStarts }
			);
		const variants: VariantOutcome[] = [];
		for (const v of END_TO_END_VARIANTS) {
			const applied = applyVariant(base, v);
			if (!('text' in applied)) {
				variants.push({ id: v.id, what: v.what, outcome: 'NOT_APPLIED', failing: [], note: applied.problem });
				continue;
			}
			// ⚠ One at a time, deliberately: every variant is written over the same copy's entry.
			writeEntry(copy, applied.text);
			const r = await run();
			variants.push({
				id: v.id,
				what: v.what,
				outcome: suiteFailed(r) ? 'CAUGHT' : 'MISSED',
				failing: r.tests.filter((t) => !t.passed).map(testName),
				...(r.timedOut ? { note: 'the suite timed out on this variant' } : {})
			});
		}
		return {
			verdict: 'JUDGED',
			files,
			own,
			faithful,
			baselineFailing: [],
			stubbed,
			stubStarts,
			stubUndetected: !suiteFailed(stubbed),
			variants,
			caught: variants.filter((v) => v.outcome === 'CAUGHT').length,
			missed: variants.filter((v) => v.outcome === 'MISSED').length
		};
	} finally {
		stub?.remove();
		removeCopy(copy);
	}
}

// ── (b) the unit mutations ───────────────────────────────────────────────────────────────────────────────────────

/** The generic operators, each named for what it does to one site. */
export const MUTATION_OPERATORS = [
	'NUMBER',
	'COMPARISON_FLIP',
	'COMPARISON_BOUNDARY',
	'EQUALITY_NEGATE',
	'LOGICAL_SWAP',
	'ARITHMETIC_SWAP',
	'BOOLEAN_FLIP',
	'NEGATION_REMOVE',
	'CONDITION_NEGATE',
	'CALL_REMOVE',
	'COMPARATOR_NEGATE'
] as const;
export type MutationOperator = (typeof MUTATION_OPERATORS)[number];

/** One mutant: one operator at one site of one file, and the whole file as it then reads. */
export interface Mutant {
	readonly id: string;
	/** Relative to the workspace, `/`-separated. */
	readonly file: string;
	readonly operator: MutationOperator;
	/** 1-based. */
	readonly line: number;
	readonly column: number;
	readonly original: string;
	readonly replacement: string;
	readonly text: string;
}

const K = ts.SyntaxKind;
/** Each binary operator token an operator rewrites, and what to. */
const BINARY: ReadonlyArray<readonly [MutationOperator, ReadonlyMap<ts.SyntaxKind, string>]> = [
	[
		'COMPARISON_FLIP',
		new Map([
			[K.LessThanToken, '>'],
			[K.GreaterThanToken, '<'],
			[K.LessThanEqualsToken, '>='],
			[K.GreaterThanEqualsToken, '<=']
		])
	],
	[
		'COMPARISON_BOUNDARY',
		new Map([
			[K.LessThanToken, '<='],
			[K.LessThanEqualsToken, '<'],
			[K.GreaterThanToken, '>='],
			[K.GreaterThanEqualsToken, '>']
		])
	],
	[
		'EQUALITY_NEGATE',
		new Map([
			[K.EqualsEqualsEqualsToken, '!=='],
			[K.ExclamationEqualsEqualsToken, '==='],
			[K.EqualsEqualsToken, '!='],
			[K.ExclamationEqualsToken, '==']
		])
	],
	[
		'LOGICAL_SWAP',
		new Map([
			[K.AmpersandAmpersandToken, '||'],
			[K.BarBarToken, '&&']
		])
	],
	[
		'ARITHMETIC_SWAP',
		new Map([
			[K.PlusToken, '-'],
			[K.MinusToken, '+'],
			[K.AsteriskToken, '/'],
			[K.SlashToken, '*'],
			[K.PercentToken, '*']
		])
	]
];
/** Calls that return a transformed copy of their receiver: removing one leaves the receiver as it was. */
const REMOVABLE_CALLS: ReadonlySet<string> = new Set(['toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd']);
/** Calls that take a comparator. */
const SORTING_CALLS: ReadonlySet<string> = new Set(['sort', 'toSorted']);

/** What one numeric literal becomes: 0 → 1, 1 → 0, anything else n → n + 1. */
function nextNumber(text: string): string | undefined {
	const n = Number(text.replaceAll('_', ''));
	if (!Number.isFinite(n)) return undefined;
	if (n === 0) return '1';
	if (n === 1) return '0';
	return String(n + 1);
}

/** A site's text, short enough for an id. */
const short = (s: string): string => (s.length <= 48 ? s : `${s.slice(0, 45)}...`).replaceAll(/\s+/g, ' ');

/**
 * ⭐ Every mutant of `file`, whose text is `source`, in source order — one per operator per site. Each kind of site has its
 * own small reader below; `visit` only dispatches, so no reader is more than a few branches deep.
 */
export function mutantsOf(file: string, source: string): Mutant[] {
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const out: Mutant[] = [];
	const seen = new Set<string>();
	const add = (operator: MutationOperator, start: number, end: number, replacement: string) => {
		const original = source.slice(start, end);
		if (original === replacement) return;
		const { line, character } = sf.getLineAndCharacterOfPosition(start);
		const id = `${file}:${line + 1}:${character + 1} ${operator} ${short(original)} -> ${short(replacement)}`;
		if (seen.has(id)) return;
		seen.add(id);
		out.push({
			id,
			file,
			operator,
			line: line + 1,
			column: character + 1,
			original,
			replacement,
			text: `${source.slice(0, start)}${replacement}${source.slice(end)}`
		});
	};
	/** Replace the whole of `node`. */
	const replace = (operator: MutationOperator, node: ts.Node, replacement: string) =>
		add(operator, node.getStart(sf), node.getEnd(), replacement);
	const literal = (node: ts.Node): void => {
		if (ts.isNumericLiteral(node)) {
			const next = nextNumber(node.getText(sf));
			if (next !== undefined) replace('NUMBER', node, next);
		} else if (node.kind === K.TrueKeyword) replace('BOOLEAN_FLIP', node, 'false');
		else if (node.kind === K.FalseKeyword) replace('BOOLEAN_FLIP', node, 'true');
	};
	const binary = (node: ts.BinaryExpression): void => {
		for (const [operator, table] of BINARY) {
			const to = table.get(node.operatorToken.kind);
			if (to !== undefined) replace(operator, node.operatorToken, to);
		}
	};
	const condition = (c: ts.Expression): void => replace('CONDITION_NEGATE', c, `!(${c.getText(sf)})`);
	const call = (node: ts.CallExpression): void => {
		if (!ts.isPropertyAccessExpression(node.expression)) return;
		const method = node.expression.name.text;
		if (REMOVABLE_CALLS.has(method) && node.arguments.length === 0)
			replace('CALL_REMOVE', node, node.expression.expression.getText(sf));
		const [comparator] = node.arguments;
		if (SORTING_CALLS.has(method) && node.arguments.length === 1 && comparator !== undefined)
			replace('COMPARATOR_NEGATE', comparator, `(a, b) => -(${comparator.getText(sf)})(a, b)`);
	};
	const visit = (node: ts.Node): void => {
		literal(node);
		if (ts.isBinaryExpression(node)) binary(node);
		else if (ts.isPrefixUnaryExpression(node) && node.operator === K.ExclamationToken)
			// Only the `!` itself: from its start to its operand's.
			add('NEGATION_REMOVE', node.getStart(sf), node.operand.getStart(sf), '');
		else if (ts.isIfStatement(node)) condition(node.expression);
		else if (ts.isConditionalExpression(node)) condition(node.condition);
		else if (ts.isCallExpression(node)) call(node);
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return out;
}

export interface MutantOutcome {
	readonly id: string;
	readonly file: string;
	readonly operator: MutationOperator;
	readonly line: number;
	readonly column: number;
	readonly original: string;
	readonly replacement: string;
	readonly outcome: 'CAUGHT' | 'SURVIVED' | 'TIMED_OUT' | 'INVALID' | 'NOT_JUDGED';
	/** The tests that failed on this mutant, as `<file> > <name>`. */
	readonly failing: readonly string[];
}

/** Which of the target's suites judges a source mutant: its unit tests (b), or its end-to-end tests (a′). */
export type SourceSuite = 'unit' | 'e2e';

export interface SourceReport {
	readonly suite: SourceSuite;
	readonly verdict: 'JUDGED' | 'BASELINE_FAILED' | 'NO_UNIT_TESTS' | 'NO_E2E_TESTS' | 'NO_SOURCES';
	/** The suite's test files. */
	readonly files: readonly string[];
	readonly sources: readonly string[];
	/** The suite on the unmutated product, through its OWN entry — the baseline every mutant is judged against. */
	readonly baseline: SuiteRun | null;
	/** The tests that failed in the baseline, as `<file> > <name>` — what a BASELINE_FAILED stands on. */
	readonly baselineFailing: readonly string[];
	readonly mutants: readonly MutantOutcome[];
	readonly counts: {
		readonly caught: number;
		readonly survived: number;
		readonly timedOut: number;
		readonly invalid: number;
		readonly notJudged: number;
	};
}
/** (b)'s report, under the name it was first given. */
export type UnitReport = SourceReport;

export interface UnitScope {
	/** Only these sources (`src/<name>.js`). Default: every `src/*.js`. */
	readonly files?: readonly string[];
	/** Only these operators. Default: all of them. */
	readonly operators?: readonly MutationOperator[];
	/** These mutants instead of the generated ones — a targeted re-run, or a test's hand-made one. */
	readonly mutants?: readonly Mutant[];
	/** How many copies run mutants at once. Default: up to 4. */
	readonly concurrency?: number;
}

/** The brief's sources: `src/*.js`, relative to the workspace, sorted. */
export function sourceFiles(workspace: string): string[] {
	try {
		return readdirSync(join(workspace, 'src'), { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith('.js'))
			.map((e) => `src/${e.name}`)
			.sort();
	} catch {
		return [];
	}
}

const tally = (mutants: readonly MutantOutcome[]): UnitReport['counts'] => ({
	caught: mutants.filter((m) => m.outcome === 'CAUGHT').length,
	survived: mutants.filter((m) => m.outcome === 'SURVIVED').length,
	timedOut: mutants.filter((m) => m.outcome === 'TIMED_OUT').length,
	invalid: mutants.filter((m) => m.outcome === 'INVALID').length,
	notJudged: mutants.filter((m) => m.outcome === 'NOT_JUDGED').length
});

const judged = (m: Mutant, outcome: MutantOutcome['outcome'], failing: readonly string[] = []): MutantOutcome => ({
	id: m.id,
	file: m.file,
	operator: m.operator,
	line: m.line,
	column: m.column,
	original: m.original,
	replacement: m.replacement,
	outcome,
	failing
});

/**
 * (a′) and (b): each mutant of `src/*.js` written into a copy of `workspace`, one at a time, and `suite`'s tests run on it
 * through the product's own entry. ⛔ A mutant is judged ALONE: each worker has a copy of its own, and restores the file
 * it mutated before it takes the next mutant — a caught mutant left in place, or written into a copy another worker is
 * running, would make the next one read CAUGHT for a fault it did not plant.
 */
export async function sourceDiscrimination(
	workspace: string,
	suite: SourceSuite,
	scope: UnitScope = {}
): Promise<SourceReport> {
	const files = testFiles(workspace, suite);
	const sources = sourceFiles(workspace).filter((f) => scope.files === undefined || scope.files.includes(f));
	const mutants =
		scope.mutants ??
		sources
			.flatMap((f) => mutantsOf(f, readFileSync(join(workspace, f), 'utf8')))
			.filter((m) => scope.operators === undefined || scope.operators.includes(m.operator));
	const nothing = (verdict: SourceReport['verdict'], baseline: SuiteRun | null): SourceReport => {
		const outcomes = mutants.map((m) => judged(m, 'NOT_JUDGED'));
		const baselineFailing = failingIn(baseline);
		return { suite, verdict, files, sources, baseline, baselineFailing, mutants: outcomes, counts: tally(outcomes) };
	};
	if (files.length === 0) return nothing(suite === 'unit' ? 'NO_UNIT_TESTS' : 'NO_E2E_TESTS', null);
	if (scope.mutants === undefined && sources.length === 0) return nothing('NO_SOURCES', null);
	const env = runnerEnvironment(process.env);
	const label = `${suite}-source-faults`;
	const copies = [copyWorkspace(workspace, label)];
	try {
		const baseline = await runNodeTests({ cwd: copies[0]!, files, env });
		if (!suitePassed(baseline)) return nothing('BASELINE_FAILED', baseline);
		const workers = Math.max(1, Math.min(scope.concurrency ?? Math.min(4, availableParallelism()), mutants.length));
		while (copies.length < workers) copies.push(copyWorkspace(workspace, label));
		const outcomes: MutantOutcome[] = new Array(mutants.length);
		let next = 0;
		const worker = async (copy: string) => {
			while (next < mutants.length) {
				const index = next++;
				const m = mutants[index]!;
				const path = join(copy, m.file);
				const original = readFileSync(path, 'utf8');
				writeFileSync(path, m.text);
				try {
					outcomes[index] = await judge(copy, m, files, env);
				} finally {
					writeFileSync(path, original);
				}
			}
		};
		await Promise.all(copies.map(worker));
		return {
			suite,
			verdict: 'JUDGED',
			files,
			sources,
			baseline,
			baselineFailing: [],
			mutants: outcomes,
			counts: tally(outcomes)
		};
	} finally {
		for (const copy of copies) removeCopy(copy);
	}
}

/** (b): each source mutant judged by the target's unit tests. */
export const unitDiscrimination = (workspace: string, scope: UnitScope = {}): Promise<SourceReport> =>
	sourceDiscrimination(workspace, 'unit', scope);

/** (a′): each source mutant judged by the target's end-to-end tests, through the product's own entry. */
export const endToEndSourceDiscrimination = (workspace: string, scope: UnitScope = {}): Promise<SourceReport> =>
	sourceDiscrimination(workspace, 'e2e', scope);

/** One mutant, already written into `copy`: INVALID if node cannot parse it, else what the unit tests say. */
async function judge(
	copy: string,
	m: Mutant,
	files: readonly string[],
	env: Readonly<Record<string, string>>
): Promise<MutantOutcome> {
	const check = await runProcess(nodeExecutable(), ['--check', m.file], { cwd: copy, env, timeoutMs: 30_000 });
	if (check.exitCode !== 0) return judged(m, 'INVALID');
	const r = await runNodeTests({ cwd: copy, files, env, timeoutMs: EXECUTION_COMMAND_TIMEOUT_MS });
	const failing = r.tests.filter((t) => !t.passed).map(testName);
	if (r.timedOut) return judged(m, 'TIMED_OUT', failing);
	return judged(m, suiteFailed(r) ? 'CAUGHT' : 'SURVIVED', failing);
}

// ── the command line ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SeededFaultsReport {
	readonly tool: 'phase7/seeded-faults';
	/** The workspace's folder name only: its path names the operator's account (`REG-F-536`). */
	readonly workspace: string;
	/** (a): the seven variants of the CLI, judged by the end-to-end tests. */
	readonly endToEnd: EndToEndReport | null;
	/** (a′): the source mutants, judged by the end-to-end tests through the product's own entry. */
	readonly endToEndSource: SourceReport | null;
	/** (b): the source mutants, judged by the unit tests. */
	readonly unit: SourceReport | null;
}

/** The arms `--only` names. */
const ARMS = ['e2e', 'e2e-source', 'unit'] as const;

/** One arm's line in the summary. */
const sourceLine = (name: string, r: SourceReport): string =>
	`${name} ${r.verdict}: ${r.counts.caught} caught, ${r.counts.survived} survived of ${r.mutants.length} mutants`;

/** Returns the exit code: 0 the report is written; 2 refused before anything ran. */
export async function main(argv: readonly string[], write: (s: string) => void): Promise<number> {
	const say = (s: string) => write(`phase7/seeded-faults — ${s}\n`);
	const flags = parseFlags(argv, { workspace: 'value', out: 'value', only: 'value' });
	if (typeof flags === 'string') {
		say(`usage: ${flags}`);
		return 2;
	}
	const workspace = flags.workspace;
	if (typeof workspace !== 'string') {
		say('usage: --workspace is required');
		return 2;
	}
	const only = flags.only;
	if (only !== undefined && !(ARMS as readonly unknown[]).includes(only)) {
		say(`usage: --only is one of ${ARMS.join(', ')}`);
		return 2;
	}
	const problem = reportPathProblem(flags.out);
	if (problem) {
		say(problem);
		return 2;
	}
	const runs = (arm: (typeof ARMS)[number]) => only === undefined || only === arm;
	const report: SeededFaultsReport = {
		tool: 'phase7/seeded-faults',
		workspace: basename(workspace),
		endToEnd: runs('e2e') ? await endToEndDiscrimination(workspace) : null,
		endToEndSource: runs('e2e-source') ? await endToEndSourceDiscrimination(workspace) : null,
		unit: runs('unit') ? await unitDiscrimination(workspace) : null
	};
	writeNewReport(flags.out as string, report);
	const e = report.endToEnd;
	say(
		[
			e ? `end to end ${e.verdict}: ${e.caught} caught, ${e.missed} missed of ${e.variants.length} variants` : undefined,
			report.endToEndSource ? sourceLine('end to end on the source', report.endToEndSource) : undefined,
			report.unit ? sourceLine('unit', report.unit) : undefined
		]
			.filter((s) => s !== undefined)
			.join('; ')
	);
	return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2), (s) => process.stderr.write(s));
