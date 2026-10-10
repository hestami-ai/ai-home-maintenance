// ⭐ `JAN-EXEC` Phase 7, P7-4 (DESIGN-the-live-end-to-end-run.md §6) — HOW THE P7-4 TOOLS RUN A WORKSPACE'S TESTS, AND
// ON WHAT: one process runner, one reading of `node:test`'s results, and private copies.
//
// ⛔ NEVER IN PLACE. Every tool here works on a COPY of the workspace it is given (`copyWorkspace`): the archived workspace
// is the run's record, and a tool that wrote a variant over its `bin/` and was killed before restoring it would have
// changed the evidence it was measuring. A copy left behind by a kill is litter in the OS temp folder; an edit left
// behind in the archive is a falsified record.
//
// ⛔ A DEADLINE THAT KILLS THE WHOLE TREE. `node --test` starts a process per test file, and a test may start the product;
// killing only the parent leaves grandchildren holding the pipes, and the wait for them never ends (the shape this
// repository met as a hung `npm test` child). So the deadline kills the tree — `taskkill /T /F` on Windows, the process
// group elsewhere — and a run that outlives it is reported `timedOut`, with no exit code: a killed process's exit
// status is the kill (`process-result-floor.ts` `processVerdictObserved`).
//
// ⚠ WHICH TESTS PASSED IS READ FROM A REPORTER WE SUPPLY (`node-test-reporter.mjs`), never from the default output: Node
// 24's default reporter is `spec` even into a pipe, and its text is for people. A test's identity is its file, relative
// to the workspace, and its own name — `test/e2e/cli.test.js > reads a file` — which is not unique if a file repeats a
// name under two suites; the tools compare counts and exit codes, and use names only to say which tests.
import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { EXECUTION_COMMAND_TIMEOUT_MS } from './runner-environment.js';

/** The reporter, by URL: `--test-reporter` takes a module specifier, and a Windows path is not one. */
const REPORTER = new URL('./node-test-reporter.mjs', import.meta.url).href;
const MARK = 'jpwb-phase7:';

/**
 * Each test's own deadline inside a run, so one hanging test fails as a test rather than holding the run to the command
 * deadline. ⚠ AUTHORED, and said to be: nothing measured says 30 seconds; the reference's slowest test takes under 0.2 s.
 */
export const TEST_TIMEOUT_MS = 30_000;
/** How long a run's pipes may stay open after its process exits, or after the kill, before the result is taken anyway. */
const DRAIN_GRACE_MS = 2_000;
/** What is kept of each stream: enough for any reporter output; a test that prints more is cut, and says so below. */
const CAPTURE_CAP_BYTES = 16 * 1024 * 1024;

/**
 * The Node.js that runs a workspace's tests. Under Node itself, this one. ⚠ Under bun, `process.execPath` is bun — which
 * is not the toolchain the brief names — so the CLIs, run with bun, start `node` from PATH.
 */
export function nodeExecutable(): string {
	return process.versions.bun === undefined ? process.execPath : 'node';
}

/** What one process did. `started: false` means no process existed, and then there is no exit code to report. */
export interface ProcessResult {
	readonly started: boolean;
	/** The platform's errno code, when the process could not be started. */
	readonly startError?: string;
	/** `null` when the run timed out or ended by a signal — never folded into a number. */
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly durationMs: number;
	readonly stdout: string;
	readonly stderr: string;
	/** True when a stream printed more than `CAPTURE_CAP_BYTES` and its tail was dropped. */
	readonly outputCut: boolean;
}

type PipedChild = ChildProcessByStdio<null, Readable, Readable>;

function killTree(child: PipedChild): void {
	if (child.pid === undefined) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
		return;
	}
	try {
		process.kill(-child.pid, 'SIGKILL');
	} catch {
		child.kill('SIGKILL');
	}
}

/**
 * Run `program` with `args` in `cwd`, with exactly `env`: no shell, standard input closed (a command that reads it gets
 * EOF, not a wait), both streams captured, the tree killed at `timeoutMs`.
 */
export function runProcess(
	program: string,
	args: readonly string[],
	o: { readonly cwd: string; readonly env: Readonly<Record<string, string>>; readonly timeoutMs: number }
): Promise<ProcessResult> {
	return new Promise((done) => {
		const startedAt = Date.now();
		const notStarted = (cause: unknown): ProcessResult => ({
			started: false,
			startError: (cause as NodeJS.ErrnoException | undefined)?.code ?? 'unknown cause',
			exitCode: null,
			timedOut: false,
			durationMs: Date.now() - startedAt,
			stdout: '',
			stderr: '',
			outputCut: false
		});
		let child: PipedChild;
		try {
			child = spawn(program, [...args], {
				cwd: o.cwd,
				env: { ...o.env },
				shell: false,
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
				// A process group of its own, so the deadline can kill the tree (POSIX); Windows uses taskkill /T.
				detached: process.platform !== 'win32'
			});
		} catch (cause) {
			done(notStarted(cause));
			return;
		}
		const streams = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
		const kept = { stdout: 0, stderr: 0 };
		let outputCut = false;
		const take = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
			const room = CAPTURE_CAP_BYTES - kept[stream];
			if (room <= 0) {
				outputCut = true;
				return;
			}
			const slice = chunk.length <= room ? chunk : chunk.subarray(0, room);
			if (slice.length < chunk.length) outputCut = true;
			streams[stream].push(slice);
			kept[stream] += slice.length;
		};
		child.stdout.on('data', take('stdout'));
		child.stderr.on('data', take('stderr'));
		let timedOut = false;
		let exitCode: number | null = null;
		let settled = false;
		let grace: NodeJS.Timeout | undefined;
		const settle = () => {
			if (settled) return;
			settled = true;
			clearTimeout(deadline);
			if (grace) clearTimeout(grace);
			done({
				started: true,
				exitCode: timedOut ? null : exitCode,
				timedOut,
				durationMs: Date.now() - startedAt,
				stdout: Buffer.concat(streams.stdout).toString('utf8'),
				stderr: Buffer.concat(streams.stderr).toString('utf8'),
				outputCut
			});
		};
		const deadline = setTimeout(() => {
			timedOut = true;
			killTree(child);
			grace = setTimeout(settle, DRAIN_GRACE_MS);
		}, o.timeoutMs);
		child.on('error', (cause) => {
			// No process was started: there is no exit to wait for.
			if (child.pid === undefined && !settled) {
				settled = true;
				clearTimeout(deadline);
				done(notStarted(cause));
			}
		});
		child.on('exit', (code) => {
			exitCode = code;
			// A descendant may still hold the pipes: take what arrived, after a bounded wait for the rest.
			grace ??= setTimeout(settle, DRAIN_GRACE_MS);
		});
		child.on('close', (code) => {
			exitCode ??= code;
			settle();
		});
	});
}

/** One finished test, as the reporter saw it. Skipped and todo tests are counted apart and not listed. */
export interface TestOutcome {
	/** The test's file, relative to the workspace, with `/` separators. */
	readonly file: string;
	readonly name: string;
	readonly passed: boolean;
}

/** A `node --test` run: the process's facts, and each test's outcome. */
export interface SuiteRun {
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly durationMs: number;
	readonly tests: readonly TestOutcome[];
	readonly passed: number;
	readonly failed: number;
	readonly skipped: number;
	readonly startError?: string;
}

/** `file` relative to the workspace `cwd`, however the platform spelled the folder. */
function workspaceRelative(file: string | null, cwd: string): string {
	if (file === null) return '(no file)';
	const bases = [resolve(cwd)];
	try {
		bases.push(realpathSync.native(cwd));
	} catch {
		// The folder is gone; the resolved spelling is all there is.
	}
	for (const base of bases) {
		const rel = relative(base, file);
		if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) return rel.split(sep).join('/');
	}
	return basename(file);
}

/** The reporter's lines in `stdout`, as outcomes. A line that is not the reporter's is not read. */
function outcomes(stdout: string, cwd: string): { tests: TestOutcome[]; skipped: number } {
	const tests: TestOutcome[] = [];
	let skipped = 0;
	for (const line of stdout.split(/\r?\n/)) {
		if (!line.startsWith(MARK)) continue;
		let e: { outcome?: unknown; file?: unknown; name?: unknown; skip?: unknown; todo?: unknown };
		try {
			e = JSON.parse(line.slice(MARK.length)) as typeof e;
		} catch {
			continue;
		}
		if (e.skip === true || e.todo === true) {
			skipped += 1;
			continue;
		}
		tests.push({
			file: workspaceRelative(typeof e.file === 'string' ? e.file : null, cwd),
			name: String(e.name),
			passed: e.outcome === 'pass'
		});
	}
	return { tests, skipped };
}

export interface NodeTestsInput {
	/** The workspace the tests run in. */
	readonly cwd: string;
	/** Test files, relative to `cwd` (or glob patterns node expands). */
	readonly files: readonly string[];
	/** Exactly the environment the run gets — the runner's allowlist (`runnerEnvironment`) unless a caller says why not. */
	readonly env: Readonly<Record<string, string>>;
	readonly node?: string;
	/** The whole run's deadline. Default: the runner's per-command deadline. */
	readonly timeoutMs?: number;
	/** Each test's deadline. Default `TEST_TIMEOUT_MS`. */
	readonly testTimeoutMs?: number;
	/**
	 * Only the tests whose name matches this regular expression, one file at a time (`--test-name-pattern`,
	 * `--test-concurrency=1`). ⚠ Node matches it against a test's own name AND its name joined to its suites' (measured on
	 * Node 24: `^alpha one$` runs a top-level "alpha one" and one inside a suite alike), so a pattern can select more than
	 * one test — a caller that means one test counts what ran.
	 */
	readonly namePattern?: string;
}

/** `node --test` over `files`, read through our reporter. */
export async function runNodeTests(i: NodeTestsInput): Promise<SuiteRun> {
	const args = [
		'--test',
		`--test-reporter=${REPORTER}`,
		'--test-reporter-destination=stdout',
		`--test-timeout=${i.testTimeoutMs ?? TEST_TIMEOUT_MS}`,
		...(i.namePattern === undefined ? [] : [`--test-name-pattern=${i.namePattern}`, '--test-concurrency=1']),
		...i.files
	];
	const r = await runProcess(i.node ?? nodeExecutable(), args, {
		cwd: i.cwd,
		env: i.env,
		timeoutMs: i.timeoutMs ?? EXECUTION_COMMAND_TIMEOUT_MS
	});
	const { tests, skipped } = outcomes(r.stdout, i.cwd);
	return {
		exitCode: r.exitCode,
		timedOut: r.timedOut,
		durationMs: r.durationMs,
		tests,
		passed: tests.filter((t) => t.passed).length,
		failed: tests.filter((t) => !t.passed).length,
		skipped,
		...(r.started ? {} : { startError: r.startError ?? 'unknown cause' })
	};
}

/**
 * ⭐ A run that shows the suite GREEN: it exited 0 within its deadline, no test failed, and at least one passed. ⛔ "Exited 0"
 * alone is not enough — a suite whose every test is skipped exits 0 having checked nothing, and a baseline of nothing
 * would let every later run read as a catch.
 */
export function suitePassed(r: SuiteRun): boolean {
	return r.exitCode === 0 && !r.timedOut && r.failed === 0 && r.passed > 0;
}

/** A run that shows the suite RED: anything but a clean exit 0. A timeout counts — the suite did not pass. */
export function suiteFailed(r: SuiteRun): boolean {
	return r.exitCode !== 0 || r.timedOut || r.failed > 0;
}

/** `test/<kind>/*.test.js`, as the brief names them: relative to the workspace, `/`-separated, sorted. */
export function testFiles(workspace: string, kind: 'unit' | 'e2e'): string[] {
	let names: string[];
	try {
		names = readdirSync(join(workspace, 'test', kind), { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith('.test.js'))
			.map((e) => e.name);
	} catch {
		return [];
	}
	return names.sort().map((name) => `test/${kind}/${name}`);
}

/** A private copy of `workspace` in the OS temp folder — everything but `.git`. */
export function copyWorkspace(workspace: string, label: string): string {
	if (!statSync(workspace).isDirectory()) throw new Error(`not a workspace folder: ${basename(workspace)}`);
	const dir = mkdtempSync(join(tmpdir(), `jpwb-p7-${label}-`));
	cpSync(workspace, dir, { recursive: true, filter: (source) => basename(source) !== '.git' });
	return dir;
}

/**
 * ⭐ THE WORKSPACE'S TREE DIGEST, as the command manifest records it per unit (`rerun-commands.ts`): the SHA-256 of one
 * line per file, `<SHA-256 of its bytes> <path>\n`, the path relative to the workspace and `/`-separated, the lines in
 * code-unit order of path, over every file `copyWorkspace` copies — everything but a `.git`. A symbolic link is hashed as
 * its target's text, never followed; an empty folder adds nothing. ⚠ The P7-2 lane computes it with THIS function, or to
 * this definition exactly: the re-runner refuses any archive whose digest is not the one recorded for its unit.
 * ⚠ WIDER THAN DESIGN §6's "SHA-256 of `src/`, `test/` and `docs/`": `bin/` and `package.json` decide a run's exit too,
 * so the tree a record is checked against is every file a copy carries.
 */
export function workspaceTreeSha256(workspace: string): string {
	const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
	const files: (readonly [string, string])[] = [];
	const walk = (dir: string, rel: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === '.git') continue;
			const full = join(dir, entry.name);
			const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
			if (entry.isSymbolicLink()) files.push([path, sha(readlinkSync(full))]);
			else if (entry.isDirectory()) walk(full, path);
			else if (entry.isFile()) files.push([path, sha(readFileSync(full))]);
		}
	};
	walk(workspace, '');
	files.sort(([a], [b]) => Number(a > b) - Number(a < b));
	return sha(files.map(([path, digest]) => `${digest} ${path}\n`).join(''));
}

/** Remove a private copy. Windows can hold a file a moment after its process ends, so it retries. */
export function removeCopy(dir: string): void {
	rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

/** A test's name as the reports print it: `<file> > <name>`. */
export const testName = (t: TestOutcome): string => `${t.file} > ${t.name}`;

/** `text` as a regular expression that matches it, and only it, character for character. */
export function literalPattern(text: string): string {
	const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
	return `^${escaped}$`;
}
