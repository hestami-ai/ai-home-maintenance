// ⭐ `JAN-EXEC` Phase 7, P7-4d (DESIGN-the-live-end-to-end-run.md §6) — PER-COMMAND RE-RUNS: EACH RECORDED `node --test`
// COMMAND'S EVIDENCE VERDICT, BESIDE OUR OWN RE-RUN OF THE SAME ARGV.
//
//   bun scripts/phase7/rerun-commands.ts --manifest <commands.json> --workspace <that unit's archived workspace>
//       --out <report.json> [--unit <unit>] [--test-timeout-ms 120000]
//
// Under `R18` each completed command a phase ran became one OBSERVATION evidence — "this command ran and exited with this
// code" — and the reviewer judged it against the phase's account (`REG-D-102` item 5). Nothing in the product ran it twice.
// This does: for ONE unit, on private copies of THAT UNIT's archived workspace, each `node --test` command is re-run with
// the same argv, plus `--test-timeout`, under the child-process runner's environment allowlist and per-command deadline
// (`runner-environment.ts`, mirrored from the product). A command whose re-run exits as recorded AGREES; one that does
// not DISAGREES.
//
// ⛔ ONE UNIT, ON ITS OWN ARCHIVE. The manifest holds every unit's commands, and the run's units share ONE workspace
// (design K3), archived after each unit (§6, P7-2): each unit's commands ran on a tree the later units went on to change.
// So a unit's commands are re-run only against the archive of the tree THAT unit ended on. `--unit` names the unit —
// required when the manifest holds more than one unit's commands — and `--workspace` must be its archive: CHECKED, never
// assumed — the archive's tree digest (`workspaceTreeSha256`) must equal the one the manifest records for the unit, or
// nothing runs. ⚠ The first version took one workspace for every unit, so a later unit's archive was read against an
// earlier unit's honest record, and the reading rule below then called it "a record that does not reproduce" (the
// verifier's finding).
//
// ⚠ WHAT AGREEMENT IS, AND IS NOT.
//   · It compares EXIT STATUS: the recorded `exitCode` and `timedOut` against the re-run's (`exitAgreement`). Nothing else.
//   · ⛔ THE EVIDENCE VERDICT IS CARRIED, NEVER COMPARED. A reviewer's SATISFIED can rightly stand on a failing exit (an
//     account that narrated the failure), and its REJECTED on a passing one (an account that claimed more than the run
//     showed). So each outcome carries the recorded verdict beside the re-run, for the adjudication table (P7-4f), which
//     decides whether the reviewer was right; this tool decides only whether the record's exit is reproducible.
//   · ⚠ THE ARCHIVE IS THE UNIT'S END STATE, NOT EACH RUN'S. A unit that ran its suite, fixed the code and ran it again
//     recorded two runs of one argv against two trees, and only the tree it ended on is archived. So each outcome says
//     whether it is the last run of its argv in the unit (`lastOfItsArgv`): a DISAGREES on an earlier run is the
//     fail-then-fix shape (`REG-F-485`), expected. ⚠ A DISAGREES on a LAST run says only that the archived tree does not
//     give the recorded exit. Either the record does not reproduce, or the tree changed after that run: the executor
//     writes files with no command at all, and can start a command before a file written in the same message exists
//     (`REG-F-518`). Neither the record nor this tool can tell which; the outcome is read, not counted as a defect.
//   · ⛔ A RE-RUN NEVER CUTS WHAT THE RECORD ALLOWED. The recorded run was bounded only by the runner's per-command
//     deadline (120 s), so the default per-test deadline is that same 120 s, and no test is cut before its command would
//     be. A shorter `--test-timeout-ms` is the operator's to choose, and a re-run whose injected deadline then cut a test
//     (`cancelled` in Node's summary) is NOT_COMPARABLE, never DISAGREES: it ran a different experiment. ⚠ The first
//     version injected 30 s, so a 35-second test the record let pass read DISAGREES, and its cut test was counted nowhere
//     (the verifier's finding). ⚠ The cut is read from Node's spec or TAP summary; a run whose argv chose another reporter
//     has no counts, and a cut there goes unread — which the default deadline makes moot.
//   · Only `node --test` commands are re-run (`isNodeTestRun`). Every other command is NOT_RERUN and never started: a
//     re-run of the model's other commands would re-run its side effects, which no re-runner should own.
//
// ⛔ NEVER IN PLACE, AND CHECKED. Each command runs on a fresh copy of a PRIVATE copy taken before the first command —
// never on, and never copied from, the workspace given — so nothing one re-run does reaches the next. Two doors stay open
// that no copy closes, and each is shut or watched:
//   · AN ARGUMENT CAN NAME A PATH OUTSIDE THE COPY. An absolute one is refused by the format (below): the verifier's
//     manifest named a test by the original's absolute path, the re-run ran the ORIGINAL file, and it wrote into the
//     original tree. One that climbs out with `..` is NOT_RERUN, never started.
//   · A TEST'S OWN CODE CAN NAME ONE — the model's prompt carries the workspace's absolute path (`REG-F-536`), and a test
//     may bake it in. No argv rule sees that. So the workspace given is HASHED after every command; a command during
//     which it changed is marked (`touchedOriginal`), and the command line exits 3: the archive is the run's record, and
//     a re-run that wrote into it has changed the evidence it was measuring.
//
// ══ ⭐ THE COMMAND MANIFEST, VERSION 1 — WHAT ROUND 2'S LIVE LANE WRITES, ONE FILE PER RUN ═══════════════════════════════
//
//   { "manifestVersion": 1,
//     "run": "<optional: what run this is, for a reader — never a path>",
//     "units": [ <one UnitTree per unit that ran a command, in the order the units ran> ],
//     "commands": [ <one RecordedCommand per completed command, every unit's, in each unit's start order> ] }
//
//   UnitTree, both keys required, NO OTHER KEY:
//     unit             the unit, spelt as its commands spell it; each unit once
//     treeSha256       `workspaceTreeSha256` (`node-tests.ts`) of the workspace as the unit LEFT it — of the lane's archive
//                      of it, taken after the unit (§6, P7-2): 64 lower-case hex digits
//
//   RecordedCommand, every key required, NO OTHER KEY (a misspelt key is refused, never ignored):
//     unit             the work unit whose step ran it — its id, or the phase label the lane uses; one value per unit,
//                      and that value has its entry in `units`
//     ordinal          `ObservedProcessRun.ordinal`: 1-based, in the order the host STARTED the unit's runs
//     argv             `ObservedProcessRun.argv` as the runner received it — ⛔ EXCEPT that no argument after the program
//                      is an absolute path (a drive or a root, a UNC share, a `file:` URL; alone, or as an option's
//                      `=value`): the lane writes a path inside the workspace RELATIVE to the workspace root,
//                      `/`-separated — the lane knows the root. An absolute path names the operator's account
//                      (`REG-F-536`), and it is the door a re-run would take out of its copy. A test-name pattern is not
//                      a path, and is exempt (`--test-name-pattern`, `--test-skip-pattern`). The program itself may be
//                      absolute: it is where the host found node, and P7-2's scan of every summary for the account name
//                      before it is committed covers it.
//     cwd              where it ran, RELATIVE to the workspace root, `/`-separated: "." for the root — the only directory
//                      the runner runs in (`child-process-runner.ts` `B8`). ⛔ Never absolute: a host path names the
//                      operator's account (`REG-F-536`), and the manifest is a summary that may be committed.
//     exitCode         `ObservedProcessRun.exitCode`: an integer, or null when no exit status was observed (a signal, or
//                      the host's deadline)
//     timedOut         `ObservedProcessRun.timedOut`
//     evidenceId       the EVIDENCE object the run became (`JoinedProcessEvidence.evidenceId`), or null when it became
//                      none: a run past the 32nd (`OBSERVED_PROCESS_RUN_LIMIT`; `REG-F-517`), or a step that stopped
//                      before its evidence join
//     evidenceVerdict  what the evidence's floor concluded: SATISFIED when the join reports `satisfied`; otherwise the
//                      disposition of the FIRST policy in `unsatisfiedPolicies` (the floor plan's order) — one of
//                      `EVIDENCE_VERDICTS`; NOT_EVIDENCE exactly when `evidenceId` is null
//   (unit, ordinal) is unique. A manifest the format refuses runs nothing (`manifestProblems`).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, posix } from 'node:path';
import { parseFlags, reportPathProblem, writeNewReport } from './cli.js';
import { copyWorkspace, removeCopy, runProcess, workspaceTreeSha256 } from './node-tests.js';
import {
	EXECUTION_COMMAND_TIMEOUT_MS,
	INHERITED_ENVIRONMENT_NAMES,
	runnerEnvironment
} from './runner-environment.js';

export const MANIFEST_VERSION = 1;

/**
 * What an evidence's floor can conclude — `FloorPolicyOutcome['disposition']` (`packages/rph-assurance/src/floor.ts`): the
 * five dispositions and the three pseudo-values a floor records — and NOT_EVIDENCE, for a run that became none.
 */
export const EVIDENCE_VERDICTS = [
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED',
	'VALIDATOR_FAILED',
	'BOUNDARY_REJECTED',
	'MISSING',
	'NOT_EVIDENCE'
] as const;
export type EvidenceVerdict = (typeof EVIDENCE_VERDICTS)[number];

export interface RecordedCommand {
	readonly unit: string;
	readonly ordinal: number;
	readonly argv: readonly string[];
	readonly cwd: string;
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly evidenceId: string | null;
	readonly evidenceVerdict: EvidenceVerdict;
}

/** One unit's tree, as the lane archived it after the unit. */
export interface UnitTree {
	readonly unit: string;
	readonly treeSha256: string;
}

export interface CommandManifest {
	readonly manifestVersion: 1;
	readonly run?: string;
	readonly units: readonly UnitTree[];
	readonly commands: readonly RecordedCommand[];
}

const TOP_KEYS: ReadonlySet<string> = new Set(['manifestVersion', 'run', 'units', 'commands']);
const UNIT_KEYS: ReadonlySet<string> = new Set(['unit', 'treeSha256']);
const COMMAND_KEYS: ReadonlySet<string> = new Set([
	'unit',
	'ordinal',
	'argv',
	'cwd',
	'exitCode',
	'timedOut',
	'evidenceId',
	'evidenceVerdict'
]);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Why `cwd` cannot name a directory inside the workspace, or undefined. */
function cwdProblem(cwd: unknown): string | undefined {
	if (typeof cwd !== 'string' || cwd === '') return 'must be a non-empty string';
	if (isAbsolute(cwd) || /^[A-Za-z]:/.test(cwd) || cwd.startsWith('/') || cwd.startsWith('\\'))
		return 'must be relative to the workspace ("." for its root)';
	if (normalize(cwd).split(/[\\/]/).includes('..')) return 'may not leave the workspace';
	return undefined;
}

/** The options whose value is a test-name pattern — a regular expression, which may well begin with `/` — never a path. */
const PATTERN_OPTIONS: ReadonlySet<string> = new Set(['--test-name-pattern', '--test-skip-pattern']);

/**
 * Each string of `argv` after the program that could name a path, with its index: an argument, or the value of an
 * `--option=value` — never a test-name pattern, given in either form.
 */
function pathCandidates(argv: readonly string[]): { readonly index: number; readonly text: string }[] {
	const out: { index: number; text: string }[] = [];
	for (let index = 1; index < argv.length; index++) {
		const arg = argv[index]!;
		if (PATTERN_OPTIONS.has(argv[index - 1]!)) continue;
		const eq = arg.startsWith('-') ? arg.indexOf('=') : -1;
		if (eq === -1) out.push({ index, text: arg });
		else if (!PATTERN_OPTIONS.has(arg.slice(0, eq))) out.push({ index, text: arg.slice(eq + 1) });
	}
	return out;
}

/** Whether `text` names an absolute path: a drive (`C:`), a root (`/`, `\`, so a UNC share too), or a `file:` URL. */
const absolutePath = (text: string): boolean => /^[A-Za-z]:/.test(text) || /^[\\/]/.test(text) || /^file:/i.test(text);

/** Whether `text`, a relative path from `cwd` (itself relative to the workspace root), leaves the workspace. */
function leavesWorkspace(text: string, cwd: string): boolean {
	const resolved = posix.normalize(posix.join(cwd.replaceAll('\\', '/'), text.replaceAll('\\', '/')));
	return resolved === '..' || resolved.startsWith('../');
}

/** Every way one command breaks the format, each prefixed with where. */
function commandProblems(c: unknown, at: string): string[] {
	if (!isRecord(c)) return [`${at} must be an object`];
	const out = Object.keys(c)
		.filter((k) => !COMMAND_KEYS.has(k))
		.map((k) => `${at}: unknown key "${k}"`);
	if (typeof c.unit !== 'string' || c.unit === '') out.push(`${at}.unit must be a non-empty string`);
	if (!Number.isSafeInteger(c.ordinal) || (c.ordinal as number) < 1) out.push(`${at}.ordinal must be an integer from 1`);
	const argv = c.argv;
	if (!Array.isArray(argv) || argv.length === 0 || !argv.every((a) => typeof a === 'string') || argv[0] === '')
		out.push(`${at}.argv must be a non-empty array of strings`);
	else
		for (const { index } of pathCandidates(argv as string[]).filter((p) => absolutePath(p.text)))
			out.push(
				`${at}.argv[${index}] names an absolute path: write a path inside the workspace relative to its root (REG-F-536)`
			);
	const cwd = cwdProblem(c.cwd);
	if (cwd) out.push(`${at}.cwd ${cwd}`);
	if (c.exitCode !== null && !Number.isSafeInteger(c.exitCode)) out.push(`${at}.exitCode must be an integer or null`);
	if (typeof c.timedOut !== 'boolean') out.push(`${at}.timedOut must be a boolean`);
	if (c.evidenceId !== null && (typeof c.evidenceId !== 'string' || c.evidenceId === ''))
		out.push(`${at}.evidenceId must be a non-empty string or null`);
	if (!(EVIDENCE_VERDICTS as readonly unknown[]).includes(c.evidenceVerdict))
		out.push(`${at}.evidenceVerdict must be one of ${EVIDENCE_VERDICTS.join(', ')}`);
	else if ((c.evidenceId === null) !== (c.evidenceVerdict === 'NOT_EVIDENCE'))
		out.push(`${at}: evidenceId is null exactly when evidenceVerdict is NOT_EVIDENCE`);
	return out;
}

/** Every way `units` breaks the format, pushed onto `out`; the units it lists, when it is a list at all. */
function unitsProblems(units: unknown, out: string[]): ReadonlySet<string> | undefined {
	if (!Array.isArray(units)) {
		out.push('units must be an array');
		return undefined;
	}
	const listed = new Set<string>();
	units.forEach((u: unknown, i: number) => {
		const at = `units[${i}]`;
		if (!isRecord(u)) {
			out.push(`${at} must be an object`);
			return;
		}
		out.push(
			...Object.keys(u)
				.filter((k) => !UNIT_KEYS.has(k))
				.map((k) => `${at}: unknown key "${k}"`)
		);
		if (typeof u.unit !== 'string' || u.unit === '') out.push(`${at}.unit must be a non-empty string`);
		else if (listed.has(u.unit)) out.push(`${at}: ${u.unit} is listed twice`);
		else listed.add(u.unit);
		if (typeof u.treeSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(u.treeSha256))
			out.push(`${at}.treeSha256 must be 64 lower-case hex digits`);
	});
	return listed;
}

/** ⭐ Every way `value` breaks the manifest format, by name. Empty means well formed. */
export function manifestProblems(value: unknown): string[] {
	if (!isRecord(value)) return ['the manifest must be a JSON object'];
	const out = Object.keys(value)
		.filter((k) => !TOP_KEYS.has(k))
		.map((k) => `unknown key "${k}" at the top level`);
	if (value.manifestVersion !== MANIFEST_VERSION) out.push(`manifestVersion must be ${MANIFEST_VERSION}`);
	if (value.run !== undefined && typeof value.run !== 'string') out.push('run must be a string');
	const listed = unitsProblems(value.units, out);
	if (!Array.isArray(value.commands)) return [...out, 'commands must be an array'];
	const seen = new Set<string>();
	value.commands.forEach((c: unknown, i: number) => {
		const at = `commands[${i}]`;
		out.push(...commandProblems(c, at));
		if (!isRecord(c) || typeof c.unit !== 'string' || c.unit === '') return;
		if (listed !== undefined && !listed.has(c.unit)) out.push(`${at}: unit "${c.unit}" has no entry in units`);
		if (typeof c.ordinal === 'number') {
			const key = `${c.unit} #${c.ordinal}`;
			if (seen.has(key)) out.push(`${at}: ${key} is recorded twice`);
			seen.add(key);
		}
	});
	return out;
}

/**
 * ⭐ The unit a re-run is for, with the tree the manifest records for it — or why no re-run may start: no unit named
 * where the manifest holds several units' commands, a unit it does not list, or a `workspace` that is NOT the tree it
 * records for that unit. ⛔ The workspace is hashed, never trusted to be the archive it is said to be.
 */
export function selectUnit(
	manifest: CommandManifest,
	workspace: string,
	unit?: string
): UnitTree | { readonly problem: string } {
	const ran = [...new Set(manifest.commands.map((c) => c.unit))];
	const name = unit ?? (ran.length === 1 ? ran[0] : undefined);
	if (name === undefined)
		return {
			problem:
				ran.length === 0
					? 'the manifest holds no commands: there is nothing to re-run'
					: `the manifest holds the commands of ${ran.length} units (${ran.join(', ')}): name one (--unit), and ` +
						'give that unit’s archived workspace'
		};
	const entry = manifest.units.find((u) => u.unit === name);
	if (entry === undefined) return { problem: `unit "${name}" is not in the manifest’s units` };
	const tree = workspaceTreeSha256(workspace);
	if (tree !== entry.treeSha256)
		return {
			problem:
				`the workspace is not the archive the manifest records for unit ${name}: its tree’s SHA-256 is ${tree}, the ` +
				`manifest’s ${entry.treeSha256} — a unit’s commands are re-run only on the tree that unit ended on`
		};
	return entry;
}

/** The program a command names, as its file name without `.exe`, lower case. */
const programName = (program: string): string =>
	(program.split(/[\\/]/).at(-1) ?? '').toLowerCase().replace(/\.exe$/, '');

/** ⭐ A `node --test` run: the program is `node`, and `--test` is one of its arguments. */
export function isNodeTestRun(argv: readonly string[]): boolean {
	return argv.length > 0 && programName(argv[0]!) === 'node' && argv.slice(1).includes('--test');
}

/** The argv re-run: `--test-timeout=<ms>` after the program, unless the argv already sets one. */
export function rerunArgv(argv: readonly string[], testTimeoutMs: number): string[] {
	if (argv.some((a) => a === '--test-timeout' || a.startsWith('--test-timeout='))) return [...argv];
	return [argv[0]!, `--test-timeout=${testTimeoutMs}`, ...argv.slice(1)];
}

/** How a process ended, as far as an exit can be compared. */
interface ExitStatus {
	readonly exitCode: number | null;
	readonly timedOut: boolean;
}

/**
 * ⭐ Whether a re-run ended as the record says its run did: the same exit code AND the same timing out. ⛔ Both halves:
 * two runs that each report no exit code — one ended by a signal, one by the deadline — did not end alike.
 */
export function exitAgreement(recorded: ExitStatus, rerun: ExitStatus): boolean {
	return recorded.exitCode === rerun.exitCode && recorded.timedOut === rerun.timedOut;
}

/** The test counts a run printed — Node's spec (`ℹ pass 3`) or TAP (`# pass 3`) summary — or null if it printed none. */
function testCounts(stdout: string): { passed: number; failed: number; cancelled: number } | null {
	const count = (word: 'pass' | 'fail' | 'cancelled'): number | undefined => {
		const m = new RegExp(`^[ℹ#] ${word} (\\d+)\\s*$`, 'm').exec(stdout);
		return m ? Number(m[1]) : undefined;
	};
	const passed = count('pass');
	const failed = count('fail');
	const cancelled = count('cancelled');
	return passed === undefined || failed === undefined || cancelled === undefined ? null : { passed, failed, cancelled };
}

export interface RerunOutcome {
	readonly unit: string;
	readonly ordinal: number;
	readonly argv: readonly string[];
	readonly cwd: string;
	readonly recorded: ExitStatus;
	readonly evidenceId: string | null;
	readonly evidenceVerdict: EvidenceVerdict;
	/**
	 * Whether no later command of the unit ran the same argv: the run nearest the tree the unit ended on, which is the
	 * tree re-run. ⚠ Not proof that this run ran on that tree — the header's `REG-F-518` note.
	 */
	readonly lastOfItsArgv: boolean;
	readonly outcome: 'AGREES' | 'DISAGREES' | 'NOT_COMPARABLE' | 'NOT_RERUN' | 'NOT_STARTED';
	readonly rerun: {
		readonly argv: readonly string[];
		readonly exitCode: number | null;
		readonly timedOut: boolean;
		readonly durationMs: number;
		readonly tests: { readonly passed: number; readonly failed: number; readonly cancelled: number } | null;
	} | null;
	/** ⛔ The workspace given CHANGED while this command was re-run — by a path in the test's own code (header). */
	readonly touchedOriginal: boolean;
	readonly note?: string;
}

export interface RerunReport {
	readonly tool: 'phase7/rerun-commands';
	/** The unit re-run, and the tree digest its archive was checked against. */
	readonly unit: string;
	readonly treeSha256: string;
	readonly testTimeoutMs: number;
	readonly commandTimeoutMs: number;
	/** The environment names a re-run may see — the runner's allowlist. */
	readonly environmentNames: readonly string[];
	readonly outcomes: readonly RerunOutcome[];
	readonly counts: {
		readonly commands: number;
		readonly rerun: number;
		readonly agrees: number;
		readonly disagrees: number;
		readonly notComparable: number;
		readonly notRerun: number;
		readonly notStarted: number;
		readonly touchedOriginal: number;
	};
}

/** Re-run one command on a fresh copy of `pristine` — the private copy, never the workspace given. */
async function rerunOne(
	c: RecordedCommand,
	pristine: string,
	testTimeoutMs: number
): Promise<Pick<RerunOutcome, 'outcome' | 'rerun' | 'note'>> {
	if (!isNodeTestRun(c.argv)) return { outcome: 'NOT_RERUN', rerun: null, note: 'not a node --test command' };
	const leaving = pathCandidates(c.argv).find((p) => leavesWorkspace(p.text, c.cwd));
	if (leaving !== undefined)
		return {
			outcome: 'NOT_RERUN',
			rerun: null,
			note:
				`argv[${leaving.index}] leaves the workspace ('${leaving.text}'): a copy cannot reproduce what it names, and ` +
				'its re-run would run outside the copy'
		};
	const copy = copyWorkspace(pristine, 'rerun');
	try {
		const cwd = join(copy, c.cwd);
		if (!existsSync(cwd) || !statSync(cwd).isDirectory())
			return { outcome: 'NOT_STARTED', rerun: null, note: `cwd '${c.cwd}' is not a directory in the workspace copy` };
		const argv = rerunArgv(c.argv, testTimeoutMs);
		const r = await runProcess(argv[0]!, argv.slice(1), {
			cwd,
			env: runnerEnvironment(process.env),
			timeoutMs: EXECUTION_COMMAND_TIMEOUT_MS
		});
		if (!r.started) return { outcome: 'NOT_STARTED', rerun: null, note: `the program could not be started (${r.startError})` };
		const tests = testCounts(r.stdout);
		const rerun = { argv, exitCode: r.exitCode, timedOut: r.timedOut, durationMs: r.durationMs, tests };
		// ⛔ Only OUR deadline makes a cut incomparable: one the argv set itself was the record's own experiment.
		if (argv.length !== c.argv.length && tests !== null && tests.cancelled > 0)
			return {
				outcome: 'NOT_COMPARABLE',
				rerun,
				note:
					`the re-run's own per-test deadline (${testTimeoutMs} ms) cut ${tests.cancelled} test(s), which the recorded ` +
					'run was not bound by: its exit is not the record’s experiment'
			};
		return { outcome: exitAgreement(c, r) ? 'AGREES' : 'DISAGREES', rerun };
	} finally {
		removeCopy(copy);
	}
}

/**
 * ⭐ ONE unit's commands of `manifest`, in order, each `node --test` one re-run on its own fresh copy of a private copy of
 * `workspace` — which must be that unit's archive (`selectUnit`). Throws, running nothing, on a manifest the format
 * refuses or a unit that cannot be selected.
 */
export async function rerunCommands(
	manifest: CommandManifest,
	workspace: string,
	o: { readonly unit?: string; readonly testTimeoutMs?: number } = {}
): Promise<RerunReport> {
	const problems = manifestProblems(manifest);
	if (problems.length > 0) throw new Error(`the manifest is refused, and nothing was run:\n  ${problems.join('\n  ')}`);
	const selected = selectUnit(manifest, workspace, o.unit);
	if ('problem' in selected) throw new Error(`refused, and nothing was run: ${selected.problem}`);
	const testTimeoutMs = o.testTimeoutMs ?? EXECUTION_COMMAND_TIMEOUT_MS;
	const commands = manifest.commands.filter((c) => c.unit === selected.unit);
	// ⛔ Every command's copy is taken from this one, made before the first command — never from the workspace given,
	// which a test that writes outside its copy could change under the commands after it.
	const pristine = copyWorkspace(workspace, 'rerun-pristine');
	let tree = selected.treeSha256;
	const outcomes: RerunOutcome[] = [];
	try {
		for (const [i, c] of commands.entries()) {
			const lastOfItsArgv = !commands
				.slice(i + 1)
				.some((later) => JSON.stringify(later.argv) === JSON.stringify(c.argv));
			// ⚠ One at a time, deliberately: re-runs in parallel would contend, and a deadline that a loaded host trips is a
			// DISAGREES no record caused — and the hash below must belong to one command.
			const result = await rerunOne(c, pristine, testTimeoutMs);
			const now = workspaceTreeSha256(workspace);
			const touchedOriginal = now !== tree;
			tree = now;
			const notes = [
				result.note,
				touchedOriginal ? 'the re-run wrote into the given workspace: its tree changed while this command ran' : undefined
			].filter((n) => n !== undefined);
			outcomes.push({
				unit: c.unit,
				ordinal: c.ordinal,
				argv: c.argv,
				cwd: c.cwd,
				recorded: { exitCode: c.exitCode, timedOut: c.timedOut },
				evidenceId: c.evidenceId,
				evidenceVerdict: c.evidenceVerdict,
				lastOfItsArgv,
				outcome: result.outcome,
				rerun: result.rerun,
				touchedOriginal,
				...(notes.length > 0 ? { note: notes.join('; ') } : {})
			});
		}
	} finally {
		removeCopy(pristine);
	}
	const count = (outcome: RerunOutcome['outcome']) => outcomes.filter((x) => x.outcome === outcome).length;
	return {
		tool: 'phase7/rerun-commands',
		unit: selected.unit,
		treeSha256: selected.treeSha256,
		testTimeoutMs,
		commandTimeoutMs: EXECUTION_COMMAND_TIMEOUT_MS,
		environmentNames: INHERITED_ENVIRONMENT_NAMES,
		outcomes,
		counts: {
			commands: outcomes.length,
			rerun: count('AGREES') + count('DISAGREES'),
			agrees: count('AGREES'),
			disagrees: count('DISAGREES'),
			notComparable: count('NOT_COMPARABLE'),
			notRerun: count('NOT_RERUN'),
			notStarted: count('NOT_STARTED'),
			touchedOriginal: outcomes.filter((x) => x.touchedOriginal).length
		}
	};
}

/**
 * Returns the exit code: 0 the report is written; 2 refused before anything ran; 3 the report is written, and the
 * workspace given CHANGED while the re-runs ran — the archive is no longer the run's record.
 */
export async function main(argv: readonly string[], write: (s: string) => void): Promise<number> {
	const say = (s: string) => write(`phase7/rerun-commands — ${s}\n`);
	const flags = parseFlags(argv, {
		manifest: 'value',
		workspace: 'value',
		out: 'value',
		unit: 'value',
		'test-timeout-ms': 'value'
	});
	if (typeof flags === 'string') {
		say(`usage: ${flags}`);
		return 2;
	}
	const { manifest: manifestFile, workspace } = flags;
	if (typeof manifestFile !== 'string' || typeof workspace !== 'string') {
		say('usage: --manifest and --workspace are required');
		return 2;
	}
	if (!existsSync(workspace) || !statSync(workspace).isDirectory()) {
		say(`usage: --workspace names no folder: ${basename(workspace)}`);
		return 2;
	}
	const timeout = flags['test-timeout-ms'];
	if (timeout !== undefined && (typeof timeout !== 'string' || !/^[1-9]\d*$/.test(timeout))) {
		say('usage: --test-timeout-ms is a positive integer');
		return 2;
	}
	const problem = reportPathProblem(flags.out);
	if (problem) {
		say(problem);
		return 2;
	}
	let manifest: unknown;
	try {
		manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
	} catch (e) {
		say(`${basename(manifestFile)} is not readable JSON: ${(e as Error).message}`);
		return 2;
	}
	const problems = manifestProblems(manifest);
	if (problems.length > 0) {
		say(`the manifest is refused, and nothing was run:\n  ${problems.join('\n  ')}`);
		return 2;
	}
	const selected = selectUnit(manifest as CommandManifest, workspace, flags.unit as string | undefined);
	if ('problem' in selected) {
		say(`refused, and nothing was run: ${selected.problem}`);
		return 2;
	}
	const report = await rerunCommands(manifest as CommandManifest, workspace, {
		unit: selected.unit,
		...(timeout === undefined ? {} : { testTimeoutMs: Number(timeout) })
	});
	writeNewReport(flags.out as string, report);
	const c = report.counts;
	say(
		`unit ${report.unit}: ${c.commands} commands: ${c.rerun} re-run (${c.agrees} agree, ${c.disagrees} disagree), ` +
			`${c.notComparable} not comparable, ${c.notRerun} not re-run, ${c.notStarted} not started` +
			(c.touchedOriginal > 0
				? ` — ⛔ the given workspace CHANGED during ${c.touchedOriginal} re-run(s): it is no longer the run's record`
				: '')
	);
	return c.touchedOriginal > 0 ? 3 : 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2), (s) => process.stderr.write(s));
