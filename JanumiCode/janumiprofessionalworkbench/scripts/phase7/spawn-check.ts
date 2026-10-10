// ⭐ `JAN-EXEC` Phase 7, P7-4c (DESIGN-the-live-end-to-end-run.md §3.1, §6) — THE SPAWN CHECK: DO A WORKSPACE'S END-TO-END
// TESTS REALLY START THE TOOL?
//
//   bun scripts/phase7/spawn-check.ts --workspace <archived workspace> --out <report.json>
//
// The design asks for end-to-end tests that "start the real tool as a child process (`process.execPath`)". A suite named
// `test/e2e/` that imports `src/` and calls it in process passes every check of the product's OUTPUT and never runs the
// entry, its argument handling, its exit codes or its streams — the very things an end-to-end test is for. Two answers:
//
//   · STATIC — each `test/e2e/*.test.js`, with the relative modules it imports from under `test/` (read through, so a test
//     whose helper spawns is credited with the helper — but never the product's own `src/`), is read by the TypeScript
//     parser for three signals: an import of
//     `child_process`, a use of `process.execPath`, and the entry's path (`bin/wordfreq.js`, as one literal or as the two
//     literals `'bin'` and `'wordfreq.js'`). ⚠ A READING OF TEXT: a test can carry all three and still not run the entry,
//     or reach it another way. It is a pointer for the reader, never the verdict.
//   · ⭐ DYNAMIC — THE VERDICT. On a COPY, the suite runs once as it is (the baseline), then once with `bin/wordfreq.js`
//     replaced by a stub that records each start and exits 99 (`entry.ts` `installStub`). A test that runs the tool and
//     checks what it does fails against the stub. A test that still passes is run again ALONE — its own name as the
//     pattern, its own file — with the stub's count cleared first, and named for what that run shows:
//       · NEVER_RAN — no start recorded: the test does not run the entry;
//       · STUB_UNDETECTED — a start recorded: the test runs the entry, and asserts nothing a program that does nothing
//         fails (a non-zero exit alone, which the stub's 99 is). It spawns; it is a weak test, and is named as one;
//       · UNATTRIBUTED — its name selected more or fewer tests than itself, or it did not pass alone: nothing is claimed.
//     SPAWNS: no test that passed is NEVER_RAN or UNATTRIBUTED. DOES_NOT_SPAWN: every one is. SPAWNS_PARTLY: between.
//     ⛔ "PASSED AGAINST THE STUB" ONCE STOOD FOR "NEVER RAN IT", and this check named two tests that DO start the tool —
//     the weak-e2e overlay's, which assert only a non-zero exit — as tests that never ran it (the verifier's finding). ⛔ AND
//     EACH TEST IS ATTRIBUTED BY A RUN OF ITS OWN, NEVER BY ITS FILE: a file holding an in-process test beside a weak
//     spawning one records a start, and a reading by file would credit both. ⚠ A start a suite's hook makes is credited
//     to the test whose run it was made in.
// ⛔ AND NOTHING IS JUDGED ON A RED BASELINE (BASELINE_FAILED): a suite already failing would fail against the stub too, and
// read SPAWNS for a failure the stub did not cause. Nor where there is no entry to replace (NO_ENTRY, `entry.ts`).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, normalize, sep } from 'node:path';
import ts from 'typescript';
import { parseFlags, reportPathProblem, writeNewReport } from './cli.js';
import { hasEntry, installStub, type InstalledStub } from './entry.js';
import {
	copyWorkspace,
	literalPattern,
	removeCopy,
	runNodeTests,
	suitePassed,
	testFiles,
	testName,
	type SuiteRun,
	type TestOutcome
} from './node-tests.js';
import { runnerEnvironment } from './runner-environment.js';

/** The stub's exit code — shared with the seeded-faults tool (`entry.ts`). */
export { STUB_EXIT_CODE } from './entry.js';

export type SpawnVerdict = 'SPAWNS' | 'SPAWNS_PARTLY' | 'DOES_NOT_SPAWN' | 'NO_E2E_TESTS';

/** One end-to-end file's three signals, read over its relative-import closure. */
export interface StaticFinding {
	readonly file: string;
	/** The files read, workspace-relative: the test file first, then each relative module it reaches. */
	readonly closure: readonly string[];
	readonly importsChildProcess: boolean;
	readonly usesExecPath: boolean;
	readonly namesBin: boolean;
}

/** What one file shows of the three, and the relative modules it names. */
interface FileSignals {
	readonly childProcess: boolean;
	readonly execPath: boolean;
	/** One literal naming the entry's path. */
	readonly binPath: boolean;
	/** The literal `'bin'`, and the literal `'wordfreq.js'` — the entry's path in two parts, as `join` takes it. */
	readonly bin: boolean;
	readonly entry: boolean;
	readonly imports: readonly string[];
}

const CHILD_PROCESS: ReadonlySet<string> = new Set(['child_process', 'node:child_process']);
const BIN_PATH = /(^|[\\/])bin[\\/]wordfreq\.js$/;

/** A string literal's text, for the two literal kinds a path is written in. */
function literalText(node: ts.Node): string | undefined {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

/** The module a node names, if it is an import of any form: declaration, re-export, `import()` or `require()`. */
function moduleNamed(node: ts.Node): string | undefined {
	if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
		return literalText(node.moduleSpecifier);
	if (!ts.isCallExpression(node)) return undefined;
	const callee = node.expression;
	const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
	const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
	const [first] = node.arguments;
	return (isImport || isRequire) && first !== undefined ? literalText(first) : undefined;
}

/** `process.execPath`, or `{ execPath } = process`. */
function namesExecPath(node: ts.Node): boolean {
	if (ts.isPropertyAccessExpression(node))
		return ts.isIdentifier(node.expression) && node.expression.text === 'process' && node.name.text === 'execPath';
	if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer !== undefined)
		return (
			ts.isIdentifier(node.initializer) &&
			node.initializer.text === 'process' &&
			node.name.elements.some((e) => (e.propertyName ?? e.name).getText() === 'execPath')
		);
	return false;
}

function signalsOf(path: string, text: string): FileSignals {
	const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const found = { childProcess: false, execPath: false, binPath: false, bin: false, entry: false };
	const imports: string[] = [];
	const visit = (node: ts.Node): void => {
		const named = moduleNamed(node);
		if (named !== undefined) {
			if (CHILD_PROCESS.has(named)) found.childProcess = true;
			if (named.startsWith('.')) imports.push(named);
		}
		if (namesExecPath(node)) found.execPath = true;
		const literal = literalText(node);
		if (literal !== undefined) {
			if (BIN_PATH.test(literal)) found.binPath = true;
			if (literal === 'bin') found.bin = true;
			if (literal === 'wordfreq.js') found.entry = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return { ...found, imports };
}

/**
 * A relative specifier from `from`, resolved to a file under the workspace's `test/`, or undefined.
 *
 * ⛔ THE CLOSURE STOPS AT `test/`. A test's helpers live there; the product's own modules do not, and must not be read as
 * the test's: a `src/` that re-executes itself with `process.execPath`, or imports `child_process`, would otherwise credit
 * a test that only imports `src/` with spawning the tool (the first version of this walk did exactly that, and
 * `verif/phase7-spawn-check.test.ts`'s in-process control caught it).
 */
function resolveImport(workspace: string, from: string, specifier: string): string | undefined {
	const target = normalize(join(dirname(from), specifier));
	if (target.split(sep)[0] !== 'test') return undefined;
	for (const candidate of [target, `${target}.js`, `${target}.mjs`, `${target}.cjs`, join(target, 'index.js')]) {
		const full = join(workspace, candidate);
		if (existsSync(full) && statSync(full).isFile()) return candidate.split(sep).join('/');
	}
	return undefined;
}

/** `file` and every workspace module it reaches by a relative import, with what each shows. */
function closureOf(workspace: string, file: string): { closure: string[]; signals: FileSignals[] } {
	const closure: string[] = [];
	const signals: FileSignals[] = [];
	const queue = [file];
	while (queue.length > 0) {
		const next = queue.shift()!;
		if (closure.includes(next)) continue;
		closure.push(next);
		const s = signalsOf(next, readFileSync(join(workspace, next), 'utf8'));
		signals.push(s);
		for (const specifier of s.imports) {
			const resolved = resolveImport(workspace, next, specifier);
			if (resolved !== undefined) queue.push(resolved);
		}
	}
	return { closure, signals };
}

/** SPAWNS when all do, DOES_NOT_SPAWN when none does, SPAWNS_PARTLY between. */
function verdictOf(spawning: number, of: number): Exclude<SpawnVerdict, 'NO_E2E_TESTS'> {
	if (spawning === of) return 'SPAWNS';
	if (spawning === 0) return 'DOES_NOT_SPAWN';
	return 'SPAWNS_PARTLY';
}

/** Each end-to-end file's signals over its closure, and the verdict: does every file show all three? */
export function staticSpawnCheck(workspace: string): { readonly verdict: SpawnVerdict; readonly files: readonly StaticFinding[] } {
	const files = testFiles(workspace, 'e2e');
	if (files.length === 0) return { verdict: 'NO_E2E_TESTS', files: [] };
	const findings = files.map((file): StaticFinding => {
		const { closure, signals } = closureOf(workspace, file);
		const shown = (signal: keyof Omit<FileSignals, 'imports'>) => signals.some((s) => s[signal]);
		return {
			file,
			closure,
			importsChildProcess: shown('childProcess'),
			usesExecPath: shown('execPath'),
			namesBin: shown('binPath') || (shown('bin') && shown('entry'))
		};
	});
	const spawning = findings.filter((f) => f.importsChildProcess && f.usesExecPath && f.namesBin).length;
	return { verdict: verdictOf(spawning, findings.length), files: findings };
}

/** What a test that passed against the stub was shown to be, by a run of its own. */
export type StubPassKind = 'NEVER_RAN' | 'STUB_UNDETECTED' | 'UNATTRIBUTED';

export interface DynamicSpawnReport {
	readonly verdict: SpawnVerdict | 'BASELINE_FAILED' | 'NO_ENTRY';
	readonly files: readonly string[];
	readonly baseline: SuiteRun | null;
	readonly stubbed: SuiteRun | null;
	/** How many times the stub started during the stubbed run; null when it was never installed. */
	readonly stubStarts: number | null;
	/** The tests that passed against the stub, sorted — each attributed below by a run of its own, never assumed. */
	readonly stillPassing: readonly string[];
	/** Of `stillPassing`: run alone, no start recorded — tests that never ran the entry. */
	readonly neverRan: readonly string[];
	/** Of `stillPassing`: run alone, the stub started — tests that run the entry and assert nothing a do-nothing program fails. */
	readonly stubUndetected: readonly string[];
	/** Of `stillPassing`: a run of their own could not isolate them (`StubPassKind`). */
	readonly unattributed: readonly string[];
}

/** A report from before the stub, or from none: the verdict and whatever runs were made. */
const unstubbed = (
	verdict: DynamicSpawnReport['verdict'],
	files: readonly string[],
	baseline: SuiteRun | null = null
): DynamicSpawnReport => ({
	verdict,
	files,
	baseline,
	stubbed: null,
	stubStarts: null,
	stillPassing: [],
	neverRan: [],
	stubUndetected: [],
	unattributed: []
});

/**
 * One test that passed against the stub, run again ALONE — its own file, its own name as the pattern — with the stub's
 * count cleared: what the run shows it to be. ⛔ Exactly that one test must have run, and passed, or nothing is claimed.
 */
async function attribute(
	copy: string,
	t: TestOutcome,
	env: Readonly<Record<string, string>>,
	stub: InstalledStub
): Promise<StubPassKind> {
	stub.reset();
	const alone = await runNodeTests({ cwd: copy, files: [t.file], env, namePattern: literalPattern(t.name) });
	const [only, ...more] = alone.tests;
	if (only === undefined || more.length > 0 || only.file !== t.file || only.name !== t.name || !only.passed)
		return 'UNATTRIBUTED';
	return stub.starts() > 0 ? 'STUB_UNDETECTED' : 'NEVER_RAN';
}

/** The decisive answer: the suite against a stub entry that records each start and exits 99, on a copy. */
export async function dynamicSpawnCheck(workspace: string): Promise<DynamicSpawnReport> {
	const files = testFiles(workspace, 'e2e');
	if (files.length === 0) return unstubbed('NO_E2E_TESTS', files);
	// ⛔ A stub written where no entry was is run by no test: that would read DOES_NOT_SPAWN about a file that never existed.
	if (!hasEntry(workspace)) return unstubbed('NO_ENTRY', files);
	const copy = copyWorkspace(workspace, 'spawn-check');
	const env = runnerEnvironment(process.env);
	let stub: InstalledStub | undefined;
	try {
		const baseline = await runNodeTests({ cwd: copy, files, env });
		if (!suitePassed(baseline)) return unstubbed('BASELINE_FAILED', files, baseline);
		stub = await installStub(copy, env);
		const stubbed = await runNodeTests({ cwd: copy, files, env });
		const stubStarts = stub.starts();
		const passing = stubbed.tests
			.filter((t) => t.passed)
			.sort((a, b) => Number(testName(a) > testName(b)) - Number(testName(a) < testName(b)));
		const kinds = new Map<string, StubPassKind>();
		for (const t of passing) {
			// ⚠ One at a time, deliberately: every run shares the one stub's count. And one run per NAME — two tests of one
			// name are one selection, so both read UNATTRIBUTED from it.
			if (!kinds.has(testName(t))) kinds.set(testName(t), await attribute(copy, t, env, stub));
		}
		const stillPassing = passing.map(testName);
		const named = (kind: StubPassKind) => stillPassing.filter((n) => kinds.get(n) === kind);
		const neverRan = named('NEVER_RAN');
		const unattributed = named('UNATTRIBUTED');
		// ⛔ A test is credited with running the entry only when it was SHOWN to: failing against the stub, or starting it.
		const shownToRun = Math.max(0, baseline.passed - neverRan.length - unattributed.length);
		return {
			verdict: verdictOf(shownToRun, baseline.passed),
			files,
			baseline,
			stubbed,
			stubStarts,
			stillPassing,
			neverRan,
			stubUndetected: named('STUB_UNDETECTED'),
			unattributed
		};
	} finally {
		stub?.remove();
		removeCopy(copy);
	}
}

export interface SpawnCheckReport {
	readonly tool: 'phase7/spawn-check';
	/** The workspace's folder name only: its path names the operator's account (`REG-F-536`). */
	readonly workspace: string;
	readonly static: ReturnType<typeof staticSpawnCheck>;
	readonly dynamic: DynamicSpawnReport;
}

/** Returns the exit code: 0 the report is written; 2 refused before anything ran. */
export async function main(argv: readonly string[], write: (s: string) => void): Promise<number> {
	const say = (s: string) => write(`phase7/spawn-check — ${s}\n`);
	const flags = parseFlags(argv, { workspace: 'value', out: 'value' });
	if (typeof flags === 'string') {
		say(`usage: ${flags}`);
		return 2;
	}
	if (typeof flags.workspace !== 'string') {
		say('usage: --workspace is required');
		return 2;
	}
	const problem = reportPathProblem(flags.out);
	if (problem) {
		say(problem);
		return 2;
	}
	const report: SpawnCheckReport = {
		tool: 'phase7/spawn-check',
		workspace: basename(flags.workspace),
		static: staticSpawnCheck(flags.workspace),
		dynamic: await dynamicSpawnCheck(flags.workspace)
	};
	writeNewReport(flags.out as string, report);
	const d = report.dynamic;
	say(
		`static ${report.static.verdict}; dynamic ${d.verdict} (${d.stillPassing.length} test(s) pass against the stub: ` +
			`${d.neverRan.length} never ran it, ${d.stubUndetected.length} ran it and assert nothing it fails, ` +
			`${d.unattributed.length} not attributed)`
	);
	return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2), (s) => process.stderr.write(s));
