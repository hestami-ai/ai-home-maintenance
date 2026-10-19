// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D12–D24, D40–D44a) — THE CLI EXECUTOR SESSION: one opener for
// every external CLI that executes a work unit, and one driver per CLI for what differs.
//
// ⭑ WHAT THE OPENER DOES, ONCE, FOR EVERY CLI (D12). It mints the step's tools as Pi's opener does, serves them on a
// host tool server of the session's own (`host-tool-server.ts`), and runs the CLI in a fresh run folder under a dedicated
// root — never the workspace and never the server's folder (D13). Each turn it composes the prompt (D15, D16), mints a
// token and writes it to the endpoint file in `host/` (D2, D41), starts the CLI in `cli/` with an allowlisted environment
// (D43), bounds the turn (D18), and closes the gate when the CLI exits or is killed (D8). Then it classifies the turn
// (D19): it reads the CLI's own record through the driver, requires its proof of the tool surface (D14a), checks that the
// workspace changed only inside the host's calls (D14b), merges the CLI's own calls among the host's (D21), grades the
// model (D22), and returns the host's envelope as E-1 (D17).
// ⭑ WHAT A DRIVER SUPPLIES (`CliDriver`): the files of its run folder, which the opener writes; its no-model preflight,
// which the opener runs and bounds; its argv and stdin; its config sources; and how to read what its CLI wrote back. A
// driver never writes a file, never starts a process and never touches the child, so it cannot weaken a guarantee by
// forgetting one. ⛔ AND A DRIVER THAT THROWS FAILS THE TURN CLOSED: a change to the workspace outside the host's calls
// is decided from the manifests alone, and marked, before any of the driver's reading runs (D21a); a throw from
// `readRecord` is held as a record that could not be read (`CLI_SURFACE_UNPROVEN`), and one from `classifyStderr` as an
// error stream that could not be classified (`CLI_ERROR`). ⚠ A reading the opener cannot use past that point (one whose
// events are not a list) still throws the turn, the workspace already marked.
//
// ⛔ THE CLI'S OWN TOOLS ARE THE PART THE HOST CANNOT OWN (D4). Only the CLI's config withholds them, and that is the
// vendor's control, so the host does not rely on it: a turn whose record does not prove the CLI's tool surface, or whose
// workspace changed outside the host's calls, fails. A breach — a tool of the CLI's own that ran, or an unexplained change
// — taints the workspace (D21a), and the CLI's record is kept beside the try (D20).
// ⚠ What the manifest does not catch, stated (D14b): a CLI's own write made while a host call is running; its reads and
// its network use, which change no file; and writes outside the workspace. Those rest on the CLI's record alone.
//
// ══ ⭐⭐ THE RETENTION DISPOSITION THIS FILE OWES, BECAUSE IT BINDS `stderr` (`REG-Q-066`; D24) ══════════════════════
//
// `verif/agy-stderr-unbound.test.ts` reddened when this file bound a CLI's stderr, and this is the answer it asks for.
//   · ONE BINDING, HERE: `spawnCli` reads the CLI's stderr into memory, bounded (`CLI_ERROR_TEXT_BYTES`), and hands the
//     lines to the driver's `classifyStderr` for CLASSIFICATION ONLY — agy's error and timeout lines, devin's rejection
//     line, a CLI's error text. A driver is handed lines, never the child, so no driver binds a stream. ⭐ (`JAN-MHX`
//     MH-6's check fix) A stream cut at the bound is handed to no driver: the turn is `CLI_ERROR`.
//   · NEVER RETAINED: no byte of the stream is written to a file, an artifact or a record. What can reach a record is a
//     failure CODE and, where the driver recognised a known error shape, an excerpt of at most `EXCERPT_LIMIT` characters,
//     withheld whenever it carries the prompt, an argument or result the host served in the turn, the run folder's path,
//     the server's port or the turn's token (`checkedExcerpt`, D19a). An unrecognised line never reaches a message.
//   · ⚠ THE RESIDUAL: a known-shape excerpt that echoes something none of those checks name — a secret a CLI read from
//     disk — reaches the exchange's parse outcome, on the record plane, which has no removal path. The excerpt's bound
//     and the driver's recognition of a shape are what keep it short and specific.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { childEnvironment } from '../execution/child-process-runner.js';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import type { RunnableExecutorSelection } from '../execution/executor-selection.js';
import {
	producerWorkingDirectory,
	type ProducerSession,
	type ProducerSessionContext
} from '../execution/producer-session.js';
import { writeWorkspaceTaint, type WorkspaceTaintCode } from '../execution/workspace-taint.js';
import type {
	AdapterAnswer,
	AdapterToolCall,
	AdapterToolObservation,
	ToolIdentityEvidence,
	ToolInvocationResult
} from './backing-tool.js';
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';
import { mintExecutionTools } from './execution-tool-surface.js';
import { writeBridge } from './host-tool-bridge.js';
import {
	HOST_TOOL_SERVER_NAME,
	startHostToolServer,
	type HostToolCall,
	type HostToolServer
} from './host-tool-server.js';
import { createProcessRunObserver } from './process-run-observer.js';
import { createToolCallObserver } from './tool-call-observer.js';

/**
 * ⭐ D15 — WHAT OPENS EVERY CLI EXECUTOR'S PROMPT, before the execution contract. Some CLIs' own system prompts push the
 * other way (devin's tells the model to explore and to create `AGENTS.md`), so the host says it once, in bytes
 * `cli-executor-session.test.ts` pins by literal. ⚠ It names no path, port or folder, and it is true of every grant: the
 * server lists only what the step was granted. ⚠ It changes the executor's instruction from Pi's, and E-1 holds it (D17).
 */
export const EXECUTOR_HOST_TOOLS_PREAMBLE =
	'You work through the tools of one MCP server, named jpwb, and through nothing else.\n' +
	'Its tools are your only tools: at most write_file, which writes a file in this work unit’s workspace, and ' +
	'run_command, which runs a command there. The server lists the ones this step was granted.\n' +
	'The workspace is reached only through those tools. No other tool will work, and you must not try one: a file ' +
	'written or a command run any other way fails this turn.\n' +
	'Do not create files the instruction does not ask for, such as AGENTS.md.';

/**
 * ⭐ D18 — THE HOST'S BOUND ON ONE CLI TURN. ⚠ AUTHORED, not derived: nothing bounds a step's call count (W-2), and 32 is
 * how many process runs the observer retains, not a limit on calls. Past it the CLI's process tree is killed, the gate
 * closed, the token revoked, and the turn is CALL_ABORTED.
 */
export const EXECUTOR_TURN_TIMEOUT_MS = 4_440_000;

/**
 * ⭐ D16 — HOW MUCH EARLIER WORK A RE-SENT PROMPT CARRIES: the earlier tries' answers and the findings on each, counted
 * in characters. Past it the oldest tries are left out whole, never cut, and the prompt says how many. ⚠ AUTHORED.
 */
export const EXECUTOR_RESEND_HISTORY_CHARS = 120_000;

/** ⭐ D19a — the longest excerpt of a known error shape a failure message may carry. ⚠ AUTHORED. */
const EXCERPT_LIMIT = 300;

/**
 * ⭐ D18 — THE HOST'S BOUND ON A DRIVER'S NO-MODEL PREFLIGHT, which is a run of the CLI like any other: past it the
 * preflight's process tree is killed and the session refused. ⚠ AUTHORED.
 */
const CLI_PREFLIGHT_TIMEOUT_MS = 60_000;

/** How long the opener waits for a killed CLI to be reported gone before it stops waiting. ⚠ AUTHORED. */
const KILL_WAIT_MS = 5_000;

/** How long the capture keeps draining after the CLI has exited, while a descendant still holds its pipes. */
const DRAIN_GRACE_MS = 1_000;

/** The most of a CLI's stdout the opener keeps. Past it the turn is CLI_ERROR: a cut record is not one. ⚠ AUTHORED. */
const CLI_OUTPUT_BYTES = 32 * 1024 * 1024;

/**
 * The most of a CLI's error stream the opener reads for classification. ⚠ AUTHORED. ⭐ `JAN-MHX` MH-6's check fix — past
 * it the stream is not classified, and the turn is CLI_ERROR: a cut stream is not one, as a cut record is not.
 */
const CLI_ERROR_TEXT_BYTES = 256 * 1024;

/**
 * ⭐ D13 — WHAT NO ANCESTOR OF THE DEDICATED ROOT MAY HOLD: a CLI's project configuration, which a CLI that walks up from
 * its working folder could read. How far devin and agy walk without a repository root is unknown until their probes;
 * this check does not depend on the answer.
 */
const CLI_PROJECT_CONFIGURATION = [
	'.devin',
	'.agents',
	'.claude',
	'.codex',
	'.pi',
	'.mcp.json',
	'AGENTS.md',
	'CLAUDE.md'
];

/**
 * ⚠ THE ONE EXCEPTION, IN THE USER'S HOME DIRECTORY ONLY, AND IT IS THIS BUILD'S, NOT THE DESIGN'S (to be confirmed by
 * the lead). The dedicated root is under the system's temporary folder, which on Windows is under the home directory — and
 * there `.claude`, `.codex`, `.devin` and `.pi` are the CLIs' own USER-level directories (Claude Code's and Codex's user
 * configuration, devin's user store, Pi's agent folder), not project configuration. Refused there, the check refused
 * every session on this host. Every other name is still refused in the home directory, and every name in every other
 * ancestor. ⚠ The residual: a CLI that walks up as far as the home directory would read its user directory there as a
 * project's. Each CLI's probe measures how far it walks.
 */
const CLI_USER_DIRECTORIES_IN_HOME = ['.claude', '.codex', '.devin', '.pi'];

/** The prefix of every run folder's name, which the stale sweep reads (D13). */
const RUN_FOLDER_PREFIX = 'jpwb-exec-';

/** The selection the opener runs: the `CLI` kind. */
export type CliExecutorSelection = Extract<RunnableExecutorSelection, { readonly kind: 'CLI' }>;

/** One run's folder, as a driver is told it (D13). Every path is absolute. */
export interface CliRunFolder {
	/** The run folder: `<root>/jpwb-exec-<tool>-<server pid>-XXXXXX`. */
	readonly directory: string;
	/** The CLI's working folder. It holds only the CLI's own configuration files. */
	readonly cliDirectory: string;
	/** The endpoint file, the bridge, the prompts and the CLI's own record. */
	readonly hostDirectory: string;
	/** The bridge's file, for the CLI's MCP entry's `args` (D10). */
	readonly bridgePath: string;
	/** The endpoint file, the bridge's other argument (D41). */
	readonly endpointPath: string;
	/** The server's own runtime, by absolute path: the CLI's MCP entry's `command` (D11). */
	readonly nodePath: string;
	/** The MCP server's name. */
	readonly serverName: string;
	/** The preamble and the execution contract, for a driver whose CLI takes a system prompt from a file (D15). */
	readonly systemPrompt: string;
}

/** A file a driver declares for its run folder. ⛔ The opener writes it, and refuses a path outside the run folder (D44). */
export interface CliRunFile {
	/** Relative to the run folder, e.g. `cli/.devin/config.json`. */
	readonly path: string;
	readonly bytes: string;
}

/** What a driver asks the opener to start. ⭑ The opener sets the working folder and the environment. */
export interface CliInvocation {
	/** By absolute path: no `PATH` search. */
	readonly program: string;
	readonly args: readonly string[];
	/** What the CLI reads on stdin, or nothing: stdin is closed at once. */
	readonly stdin?: string;
}

/** One turn, as a driver is told it. */
export interface CliTurnInput {
	readonly run: CliRunFolder;
	/** 1-based: the work unit's try. */
	readonly turn: number;
	readonly modelId: string;
	readonly effort: string | undefined;
	/** The whole prompt: the system prompt, then `userPrompt` (D15). E-1 records this. */
	readonly prompt: string;
	/** The prompt without the system prompt, for a driver that puts that in a file of its own. */
	readonly userPrompt: string;
	/** `prompt`, already written to `host/prompt-<turn>.txt`. */
	readonly promptPath: string;
}

/** What the CLI left, for the driver to read. */
export interface CliTurnOutput {
	readonly run: CliRunFolder;
	readonly turn: number;
	readonly exitCode: number | null;
	readonly stdout: string;
}

/** A tool as the CLI's record names it: one of the host's, by its minted name, or one of the CLI's own. */
export interface CliToolRef {
	readonly party: 'HOST' | 'OWN';
	readonly name: string;
}

/** One event of the CLI's record, in the record's order (D21). */
export type CliRecordEvent =
	/** A call to a tool of the host's server: SENT to it, or rejected by the CLI before it was sent (D3). */
	| { readonly kind: 'HOST_CALL'; readonly name: string; readonly sent: boolean }
	/** A tool of the CLI's own, carriers included: it RAN, or it was denied or rejected. */
	| { readonly kind: 'OWN_TOOL'; readonly name: string; readonly ran: boolean }
	/** The model said something. */
	| { readonly kind: 'ASSISTANT_MESSAGE' };

/** What a driver read of its CLI's record (D20). */
export type CliRecordReading =
	| { readonly read: 'ABSENT' }
	| { readonly read: 'UNPARSEABLE'; readonly raw: string }
	| {
			readonly read: 'PARSED';
			/** The record as the CLI wrote it — kept beside a breach (D20), and never otherwise. */
			readonly raw: string;
			/** ⭐ D14a — the tools the CLI offered its model this turn, or `undefined`: the record holds no proof. */
			readonly surface: readonly CliToolRef[] | undefined;
			readonly events: readonly CliRecordEvent[];
			/** ⭐ D22 — every distinct model the CLI reports serving the turn. Empty: it reports none. */
			readonly reportedModels: readonly string[];
			/** The answer, as the CLI returned it. */
			readonly answer: string | undefined;
			/** ⭐ D23 — reasoning the CLI returned apart from the answer. */
			readonly volunteeredReasoning?: string;
			/** ⭐ D19a — the excerpt of an error event of a shape the driver knows. */
			readonly errorExcerpt?: string;
	  };

/** ⭐ D24 — what a driver recognised in the lines its CLI wrote to stderr. */
export interface CliStderrSignals {
	/** The CLI says it rejected a call (devin: "rejected a tool call that requires confirmation"). */
	readonly rejectedACall?: boolean;
	/** The CLI's own timeout warning (agy). */
	readonly timedOut?: boolean;
	/** The excerpt of an error line of a shape the driver knows. */
	readonly errorExcerpt?: string;
}

/** ⭐ D14 — a no-model check the opener runs in the run folder before the first turn. */
export interface CliPreflight {
	readonly invocation: CliInvocation;
	/** A refusal sentence, or `undefined` when the check passed. */
	refusal(output: { readonly exitCode: number | null; readonly stdout: string }): string | undefined;
}

/** ⭐ D12 — what differs between CLIs. One driver per CLI, in `tools/<tool>-executor-driver.ts`. */
export interface CliDriver {
	readonly toolId: string;
	/**
	 * ⭐ D21 — the CLI's own plumbing for reaching the host's server. A carrier that runs is not a breach; one the CLI
	 * refused is a refused attempt, as any tool of its own is.
	 */
	readonly carriers: readonly string[];
	/** ⭐ D44a — the files the CLI reads configuration from, by name: fingerprinted by `stat` before each turn. */
	readonly configSources: readonly { readonly name: string; readonly path: string }[];
	/** ⭐ D43 — constants the CLI's environment carries beside the allowlist. */
	readonly environment: Readonly<Record<string, string>>;
	/** ⭐ D43 — a secret the CLI needs, by variable name: given to the CLI's process only, never to the allowlist. */
	readonly secretVariable?: string;
	runFolderFiles(run: CliRunFolder): readonly CliRunFile[];
	/**
	 * ⭐ D14 — its no-model check, or `undefined` for none. ⭐ `JAN-MHX` MH-6 — handed the session's selection, so a driver
	 * can refuse, before any turn, a model or an effort its CLI's tool surface was not measured on (Codex's, §4.3).
	 * ⭐ MH-6's check fix — OR A LIST OF CHECKS, which the opener runs in order, each under its bound, the first refusal
	 * refusing the session: Codex's driver asks its version, then its MCP listing.
	 */
	preflight(
		run: CliRunFolder,
		selection: CliExecutorSelection
	): CliPreflight | readonly CliPreflight[] | undefined;
	invocation(turn: CliTurnInput): CliInvocation;
	readRecord(output: CliTurnOutput): Promise<CliRecordReading>;
	classifyStderr(lines: readonly string[]): CliStderrSignals;
}

/** What the opener asks the exec seam to start. */
export interface CliExecRequest {
	readonly program: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env: Readonly<Record<string, string>>;
	readonly stdin: string | undefined;
}

/** How a started CLI ended. */
export interface CliRun {
	readonly exitCode: number | null;
	/** The errno code, when the program could not be started at all. */
	readonly startFailure?: string;
	readonly stdout: string;
	/** `false` when stdout passed `CLI_OUTPUT_BYTES`. */
	readonly stdoutComplete: boolean;
	/** The CLI's error stream, as lines, for the driver's classification only (D24). */
	readonly errorLines: readonly string[];
	/**
	 * `false` when the error stream passed `CLI_ERROR_TEXT_BYTES`, so `errorLines` holds only its start. ⭐ `JAN-MHX` MH-6's
	 * check fix — the opener then reads the stream as one it could not classify (D24): for Codex it is the only record of a
	 * call Codex rejected before sending it (MH-0c F4), and the lines before that one can be as long as the model chooses.
	 */
	readonly errorLinesComplete: boolean;
}

/** A started CLI. */
export interface CliChild {
	readonly done: Promise<CliRun>;
	/** ⭐ D18 — end the CLI's whole process tree. */
	kill(): Promise<void>;
}

/**
 * The exec seam — `AgyExec`'s and `DevinExec`'s shape, for their reason: without it the opener could be driven only by a
 * real CLI. ⭑ A seam standing in for a CLI reads the endpoint file and calls the real server, as a CLI's bridge does.
 */
export type CliExec = (request: CliExecRequest) => CliChild;

export interface CliSessionDeps {
	readonly exec?: CliExec;
	/** The dedicated root (D13). Default: `<tmpdir>/jpwb-exec`. */
	readonly root?: string;
	readonly turnTimeoutMs?: number;
	/** The bound on the driver's preflight (D18). Default: `CLI_PREFLIGHT_TIMEOUT_MS`. */
	readonly preflightTimeoutMs?: number;
	readonly now?: () => string;
	/** Where `dispose` reports what it could not finish. ⭑ A fixed sentence and an errno code: never a path. */
	readonly log?: (line: string) => void;
}

/** The failure codes of a CLI turn (D19, D44a), each with its fixed sentence (D19a). */
type CliFailureCode =
	| 'CLI_ENDED_ON_REFUSAL'
	| 'CLI_ERROR'
	| 'CLI_SURFACE_UNPROVEN'
	| 'CLI_OWN_TOOL_RAN'
	| 'CLI_UNEXPLAINED_CHANGE'
	| 'CLI_MODEL_SUBSTITUTED'
	| 'EXECUTOR_CONFIG_CHANGED';

const FAILURE_SENTENCES: Readonly<Record<CliFailureCode, string>> = {
	CLI_ENDED_ON_REFUSAL:
		'The CLI had a call refused and stopped there, with no answer after it, so what it returned is not an answer.',
	CLI_ERROR:
		'The CLI reported an error, exited with a failing status, or left what the host could not read whole, so the turn ' +
		'produced no answer.',
	CLI_SURFACE_UNPROVEN:
		'The CLI’s own record of the turn is absent, unreadable, or does not prove which tools it offered its model, or ' +
		'its account of the host’s calls differs from the host’s, so nothing shows that only the host’s tools were used.',
	CLI_OWN_TOOL_RAN:
		'The CLI ran a tool of its own, or offered its model one, where only the CLI’s configuration was there to withhold ' +
		'it. The workspace is marked tainted.',
	CLI_UNEXPLAINED_CHANGE:
		'The workspace changed outside the host’s calls, so something other than the host’s tools wrote to it. The ' +
		'workspace is marked tainted.',
	CLI_MODEL_SUBSTITUTED: 'The CLI reports that a model other than the configured one served the turn.',
	EXECUTOR_CONFIG_CHANGED:
		'A configuration source the CLI reads changed since the session opened, so the turn was refused before the CLI ' +
		'was started.'
};

/** ⭐ D19a — a failure message: the code, its fixed sentence, and any checked excerpt or naming the opener adds. */
function failure(code: CliFailureCode, tail = ''): AdapterAnswer {
	return {
		arrived: false,
		cause: 'CALL_FAILED',
		reportedBy: 'TOOL',
		message: `${code}: ${FAILURE_SENTENCES[code]}${tail}`
	};
}

/**
 * ⭐ D13 — which of the CLIs' project configuration names an ancestor of `root` holds, each named with how far above the
 * root it is. ⭑ Never a path: the answer reaches a refusal. Exported for its test, with `exists` injected so a home
 * directory can be arranged; the opener passes `existsSync` and the system's home directory.
 */
export function ancestorConfiguration(
	root: string,
	home: string,
	exists: (path: string) => boolean
): string[] {
	const hits: string[] = [];
	const homeDirectory = resolve(home);
	let above = 1;
	for (let dir = dirname(resolve(root)); ; dir = dirname(dir), above += 1) {
		const isHome = dir === homeDirectory;
		for (const name of CLI_PROJECT_CONFIGURATION)
			if (!(isHome && CLI_USER_DIRECTORIES_IN_HOME.includes(name)) && exists(join(dir, name)))
				hits.push(`${name}, ${above} folder${above === 1 ? '' : 's'} above the root`);
		if (dirname(dir) === dir) return hits;
	}
}

/** Whether a process is alive. ⭑ EPERM means it exists and is not ours to signal. */
function processIsAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return (e as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/**
 * ⭐ D13 — remove every run folder under the root whose server pid is not a live process. A killed server leaves its run
 * folders behind, holding prompts, records and a token, and `finally` does not run on a kill.
 */
function sweepStaleRunFolders(root: string): void {
	for (const name of readdirSync(root)) {
		const pid = /^jpwb-exec-.+-(\d+)-[A-Za-z0-9]+$/.exec(name)?.[1];
		if (pid === undefined || processIsAlive(Number(pid))) continue;
		try {
			rmSync(join(root, name), { recursive: true, force: true });
		} catch {
			// ⭑ A folder a dead server left that cannot be removed now is tried again at the next session's open.
		}
	}
}

/** ⭐ D44a — a source's fingerprint, by `stat` alone: no file is opened. */
function fingerprintOf(path: string): string {
	try {
		const s = statSync(path);
		return `${s.isDirectory() ? 'directory' : 'file'}:${s.size}:${s.mtimeMs}`;
	} catch {
		return 'absent';
	}
}

/** ⭐ D14b — a workspace's manifest: each entry's path, size and modified time. No contents are read. */
async function workspaceManifest(root: string): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const walk = async (dir: string, prefix: string): Promise<void> => {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (e) {
			out.set(`${prefix}/`, `unreadable:${(e as NodeJS.ErrnoException).code ?? 'unknown'}`);
			return;
		}
		for (const entry of entries) {
			const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
			if (entry.isDirectory()) {
				out.set(`${path}/`, 'directory');
				await walk(join(dir, entry.name), path);
				continue;
			}
			try {
				const s = await lstat(join(dir, entry.name));
				out.set(path, `${s.size}:${s.mtimeMs}`);
			} catch (e) {
				out.set(path, `unreadable:${(e as NodeJS.ErrnoException).code ?? 'unknown'}`);
			}
		}
	};
	await walk(root, '');
	return out;
}

/** The paths that differ between two manifests. */
function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
	const changed = new Set<string>();
	for (const [path, entry] of after) if (before.get(path) !== entry) changed.add(path);
	for (const path of before.keys()) if (!after.has(path)) changed.add(path);
	return [...changed].sort();
}

/**
 * What the opener holds of the CLI's record: the driver's reading, or, when the driver's `readRecord` threw, the fact
 * that it could not be read — of which nothing is kept (D20).
 */
type HeldRecord = CliRecordReading | { readonly read: 'DRIVER_THREW' };

/**
 * ⭐ D14a, D20 — the driver's reading of its CLI's record, or `ABSENT` when the CLI left none to read. ⛔ A DRIVER THAT
 * THROWS FAILS THE TURN CLOSED: its throw is held as `DRIVER_THREW`, so the turn is `CLI_SURFACE_UNPROVEN`, never a throw
 * of the turn's own, which would end it before its classification (a missing export is an expected case: devin only
 * warns when it fails to write one).
 */
async function recordOf(driver: CliDriver, output: CliTurnOutput | undefined): Promise<HeldRecord> {
	if (output === undefined) return { read: 'ABSENT' };
	try {
		return await driver.readRecord(output);
	} catch {
		return { read: 'DRIVER_THREW' };
	}
}

/**
 * ⭐ D24 — what the driver recognised in the CLI's stderr lines, or `undefined` when its classifier threw. ⛔ The opener
 * reads that as an error stream it could not classify, never as one that said nothing: no signal would accept a turn
 * whose only sign of a refusal is its stderr line (devin's, D19).
 */
function signalsOf(driver: CliDriver, lines: readonly string[]): CliStderrSignals | undefined {
	try {
		return driver.classifyStderr(lines);
	} catch {
		return undefined;
	}
}

/**
 * ⭐ D14a — whether the CLI's record fails to prove its tool surface: absent, unparseable, unreadable by its driver,
 * holding no proof, or naming a host tool the host did not serve. ⭑ Each arm its own, so each can be shown to matter.
 */
function surfaceProofFails(record: HeldRecord, mintedToolNames: readonly string[]): boolean {
	if (record.read === 'ABSENT') return true;
	if (record.read === 'UNPARSEABLE') return true;
	if (record.read === 'DRIVER_THREW') return true;
	if (record.surface === undefined) return true;
	return record.surface.some((t) => t.party === 'HOST' && !mintedToolNames.includes(t.name));
}

/** Every string inside a JSON-like value. */
function stringsIn(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (Array.isArray(value)) for (const v of value) stringsIn(v, out);
	else if (typeof value === 'object' && value !== null) for (const v of Object.values(value)) stringsIn(v, out);
	return out;
}

/** Text with each run of control characters blanked to one space, so an echo is compared as it would be printed. */
// eslint-disable-next-line no-control-regex
const blanked = (text: string): string => text.replace(/[\u0000-\u001f\u007f]+/g, ' ');

/**
 * ⭐ D19a — an excerpt a failure message may carry, or `undefined`. Kept to `EXCERPT_LIMIT` characters, its control
 * characters blanked, and WITHHELD when it carries any of `withheld` under `diagnosticCarriesPrompt`'s window rule —
 * each compared blanked as the excerpt is, so a result echoed across its line breaks is still found.
 */
function checkedExcerpt(raw: string | undefined, withheld: readonly string[]): string | undefined {
	if (raw === undefined || raw.trim() === '') return undefined;
	const excerpt = blanked(raw).trim().slice(0, EXCERPT_LIMIT);
	return withheld.some((secret) => diagnosticCarriesPrompt(excerpt, blanked(secret))) ? undefined : excerpt;
}

/** A model name a failure message may print, or a sentence saying it was not printed. */
function printableModel(name: string): string {
	return /^[A-Za-z0-9._:/@()+ -]{1,100}$/.test(name) ? `'${name}'` : 'a model name this host will not print';
}

/** A bounded text capture of one stream. */
function capture(limit: number) {
	const kept: Buffer[] = [];
	let size = 0;
	let cut = false;
	return {
		take(chunk: Buffer): void {
			if (size >= limit) {
				cut = true;
				return;
			}
			const room = limit - size;
			if (chunk.length > room) cut = true;
			const slice = chunk.length <= room ? chunk : chunk.subarray(0, room);
			kept.push(slice);
			size += slice.length;
		},
		text: () => Buffer.concat(kept).toString('utf8'),
		complete: () => !cut
	};
}

/**
 * ⭐ D18 — end a process and every process under it. ⛔ `taskkill /T /F` on Windows, where a descendant survives its
 * parent's kill: devin runs its agent in a child, and agy's language server spawns its stdio servers. On POSIX the CLI
 * leads its own process group, and the group is killed. ⚠ A descendant whose parent already exited is beyond either; it
 * holds a revoked token and meets a shut gate (D2, D8).
 */
function killTree(pid: number | undefined): Promise<void> {
	if (pid === undefined) return Promise.resolve();
	if (process.platform !== 'win32') {
		try {
			process.kill(-pid, 'SIGKILL');
		} catch {
			// ⭑ The group is already gone.
		}
		return Promise.resolve();
	}
	// ⭑ Named by the system folder's own variable, so no `PATH` search finds another `taskkill`; a host that has unset
	// both variables is left to its `PATH`.
	const systemRoot = process.env.SystemRoot ?? process.env.windir;
	const taskkill = systemRoot === undefined ? 'taskkill.exe' : join(systemRoot, 'System32', 'taskkill.exe');
	return new Promise((done) => {
		const killer = spawn(taskkill, ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
		killer.on('error', () => done());
		killer.on('exit', () => done());
	});
}

/** The exec seam's production form: a child process, with no shell, its streams bounded. */
const spawnCli: CliExec = (request) => {
	const child = spawn(request.program, [...request.args], {
		cwd: request.cwd,
		env: { ...request.env },
		stdio: ['pipe', 'pipe', 'pipe'],
		shell: false,
		windowsHide: true,
		detached: process.platform !== 'win32'
	});
	const out = capture(CLI_OUTPUT_BYTES);
	const err = capture(CLI_ERROR_TEXT_BYTES);
	child.stdout.on('data', (chunk: Buffer) => out.take(chunk));
	// ⛔ D24 — THE ONE BINDING OF A CLI'S STDERR: read into memory, bounded, handed to the driver as lines, never retained.
	child.stderr.on('data', (chunk: Buffer) => err.take(chunk));
	child.stdout.on('error', () => undefined);
	child.stderr.on('error', () => undefined);
	child.stdin.on('error', () => undefined);
	child.stdin.end(request.stdin ?? '');
	const done = new Promise<CliRun>((settle) => {
		let settled = false;
		const finish = (exitCode: number | null, startFailure?: string): void => {
			if (settled) return;
			settled = true;
			settle({
				exitCode,
				...(startFailure === undefined ? {} : { startFailure }),
				stdout: out.text(),
				stdoutComplete: out.complete(),
				errorLines: err.text().split(/\r?\n/).filter((line) => line !== ''),
				errorLinesComplete: err.complete()
			});
		};
		child.on('error', (cause: NodeJS.ErrnoException) => {
			if (child.pid === undefined) finish(null, cause.code ?? 'unknown');
		});
		child.on('exit', (code) => {
			const drain = setTimeout(() => finish(code), DRAIN_GRACE_MS);
			child.on('close', () => {
				clearTimeout(drain);
				finish(code);
			});
		});
	});
	return { done, kill: () => killTree(child.pid) };
};

/** A promise that settles after `ms`, with a handle to cancel it. */
function delay(ms: number): { readonly elapsed: Promise<'ELAPSED'>; cancel(): void } {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const elapsed = new Promise<'ELAPSED'>((settle) => {
		timer = setTimeout(() => settle('ELAPSED'), ms);
	});
	return { elapsed, cancel: () => clearTimeout(timer) };
}

/**
 * ⭐ D14, D18 — run a driver's preflight under the host's bound, and say why it refuses the session, or `undefined`.
 * ⛔ THE BOUND AND THE RUN'S OWN FAILURES ARE THE OPENER'S, ASKED BEFORE THE DRIVER'S REFUSAL (D12): a preflight past the
 * bound is killed, tree and all; one that could not be started, or whose output was cut, proves nothing, whatever the
 * driver's refusal would make of what it left.
 */
async function preflightRefusal(
	check: CliPreflight,
	exec: CliExec,
	request: Pick<CliExecRequest, 'cwd' | 'env'>,
	timeoutMs: number
): Promise<string | undefined> {
	const child = exec({
		...request,
		program: check.invocation.program,
		args: check.invocation.args,
		stdin: check.invocation.stdin
	});
	const bound = delay(timeoutMs);
	const first = await Promise.race([child.done, bound.elapsed]);
	bound.cancel();
	if (first === 'ELAPSED') {
		await child.kill();
		const wait = delay(KILL_WAIT_MS);
		await Promise.race([child.done, wait.elapsed]);
		wait.cancel();
		return `it outlasted the host's bound of ${timeoutMs} ms, and its process tree was killed.`;
	}
	if (first.startFailure !== undefined) return `it could not be started (${first.startFailure}).`;
	if (!first.stdoutComplete) return 'its output passed the host’s bound, so it could not be read whole.';
	return check.refusal({ exitCode: first.exitCode, stdout: first.stdout });
}

/** ⛔ D44 — write a driver's file into the run folder, refusing a path outside it. */
async function writeInside(directory: string, file: CliRunFile, toolId: string): Promise<void> {
	const target = resolve(directory, file.path);
	const inside = relative(directory, target);
	if (inside === '' || inside.startsWith('..') || isAbsolute(inside))
		throw new Error(
			`The driver for '${toolId}' declared a run-folder file outside its run folder. The session is refused: a CLI ` +
				'executor writes nothing outside its run folder (JAN-MHX D44).'
		);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, file.bytes, 'utf8');
}

/** The CLI's environment (D43): the allowlist, the driver's constants, and its declared secret, if the server holds one. */
function cliEnvironment(driver: CliDriver): Record<string, string> {
	const env: Record<string, string> = { ...childEnvironment(process.env), ...driver.environment };
	const secret = driver.secretVariable === undefined ? undefined : process.env[driver.secretVariable];
	if (driver.secretVariable !== undefined && secret !== undefined) env[driver.secretVariable] = secret;
	return env;
}

/** The run folder's manifest-checking state for one turn (D14b). */
interface TurnManifests {
	checkpoint: Map<string, string>;
	readonly unexplained: Set<string>;
}

/** What merging the CLI's record with the host's own calls found (D21). */
interface MergedRecord {
	/** Every call, the CLI's own among the host's, in the record's order. */
	readonly calls: readonly AdapterToolCall[];
	/** The tools of the CLI's own that ran, carriers aside. */
	readonly ownRan: readonly string[];
	/** The record's host calls differ from the host's, in order or by name. */
	readonly mismatch: boolean;
	/** A refusal came after the last thing the model said. */
	readonly refusedSinceAnswer: boolean;
}

/**
 * ⭐ D21 — THE CLI'S OWN CALLS, MERGED AMONG THE HOST'S IN THE ORDER ITS RECORD GIVES, the host's cross-checked by order and
 * by name. A carrier is the CLI's plumbing for reaching the host's server: one that RAN is passed over, and one the CLI
 * refused is a refused attempt like any other (devin's print mode ends the session on a rejected `mcp_call_tool`,
 * `REG-F-549`).
 */
function mergedWithHostCalls(
	events: readonly CliRecordEvent[],
	hostCalls: readonly AdapterToolCall[],
	carriers: readonly string[]
): MergedRecord {
	const merged: AdapterToolCall[] = [];
	const ownRan: string[] = [];
	let mismatch = false;
	let refusedSinceAnswer = false;
	let next = 0;
	for (const event of events) {
		if (event.kind === 'ASSISTANT_MESSAGE') {
			refusedSinceAnswer = false;
			continue;
		}
		if (event.kind === 'HOST_CALL') {
			if (!event.sent) {
				merged.push({ name: event.name, outcome: 'REFUSED' });
				refusedSinceAnswer = true;
				continue;
			}
			const host = hostCalls[next];
			next += 1;
			if (host === undefined || host.name !== event.name) mismatch = true;
			else merged.push(host);
			continue;
		}
		if (event.ran && carriers.includes(event.name)) continue;
		// ⛔ A TOOL OF THE CLI'S OWN, under a name no minted tool can have, so the record keeps the fact of the call and
		// drops its name (NOT_MINTED).
		if (event.ran) {
			ownRan.push(event.name);
			merged.push({ name: `cli:${event.name}`, outcome: 'UNKNOWN' });
		} else {
			merged.push({ name: `cli:${event.name}`, outcome: 'REFUSED' });
			refusedSinceAnswer = true;
		}
	}
	if (next !== hostCalls.length) mismatch = true;
	return { calls: merged, ownRan, mismatch, refusedSinceAnswer };
}

/** ⭐ D19a — what a `CLI_ERROR` message adds when the driver's classifier threw (D24). */
const UNCLASSIFIED_ERROR_STREAM =
	' What the CLI wrote to its error stream could not be classified, so nothing shows it reported no error.';

/** ⭐ D19a — what a `CLI_ERROR` message adds when the error stream was cut at `CLI_ERROR_TEXT_BYTES` (D24). */
const CUT_ERROR_STREAM =
	' What the CLI wrote to its error stream passed the host’s bound, so it could not be read whole, and nothing shows ' +
	'it reported no error.';

/**
 * ⭐ D19a — what follows a `CLI_ERROR` message's fixed sentence: the checked excerpt of a known error shape, if any, and
 * the sentence saying the error stream went unclassified, if it was cut or the driver's classifier threw.
 */
function cliErrorTail(errorExcerpt: string | undefined, t: TurnFacts): string {
	const excerpt = checkedExcerpt(errorExcerpt, t.withheld);
	const said = excerpt === undefined ? '' : ` The CLI reported: “${excerpt}”`;
	if (!t.signalsUnread) return said;
	return `${said}${t.errorStreamCut ? CUT_ERROR_STREAM : UNCLASSIFIED_ERROR_STREAM}`;
}

/** What the opener knows of a turn when it classifies it (D19). */
interface TurnFacts {
	readonly breach: WorkspaceTaintCode | undefined;
	/** The host's bound ran out and the tree was killed. */
	readonly bound: boolean;
	readonly timeoutMs: number;
	readonly cliRun: CliRun | undefined;
	readonly record: HeldRecord;
	readonly surfaceUnproven: boolean;
	readonly reported: readonly string[];
	readonly modelId: string;
	readonly refusedSinceAnswer: boolean;
	readonly signals: CliStderrSignals;
	/**
	 * The error stream was not classified — the driver's classifier threw, or ⭐ (`JAN-MHX` MH-6's check fix) the stream
	 * was cut — so `signals` is empty for want of a reading, not for want of a signal (D24).
	 */
	readonly signalsUnread: boolean;
	/** The error stream passed `CLI_ERROR_TEXT_BYTES`, so it was not handed to the classifier at all. */
	readonly errorStreamCut: boolean;
	/** ⭐ D19a — what an excerpt may not carry. */
	readonly withheld: readonly string[];
}

/**
 * ⭐ D19 — THE TURN'S ANSWER, OR THE STATED REASON THERE IS NONE, IN THIS ORDER, and an answer only when no other row
 * applies: a breach; the host's bound; a CLI that could not start; an unproven surface; a substituted model; a refusal the
 * CLI stopped on; its own timeout; its error.
 */
function turnAnswer(t: TurnFacts): AdapterAnswer {
	if (t.breach !== undefined) return failure(t.breach);
	if (t.bound)
		return {
			arrived: false,
			cause: 'CALL_ABORTED',
			message: `The CLI outlasted the host's bound of ${t.timeoutMs} ms on one turn, and its process tree was killed.`
		};
	if (t.cliRun?.startFailure !== undefined)
		return failure('CLI_ERROR', ` It could not be started (${t.cliRun.startFailure}).`);
	if (t.surfaceUnproven) return failure('CLI_SURFACE_UNPROVEN');
	if (t.reported.some((m) => m !== t.modelId))
		return failure(
			'CLI_MODEL_SUBSTITUTED',
			` Configured: ${printableModel(t.modelId)}; reported: ${t.reported.map(printableModel).join(', ')}.`
		);
	if (t.refusedSinceAnswer || t.signals.rejectedACall === true) return failure('CLI_ENDED_ON_REFUSAL');
	if (t.signals.timedOut === true)
		return {
			arrived: false,
			cause: 'CALL_ABORTED',
			message: 'The CLI reported that its own time limit expired, so what it returned is not an answer.'
		};
	const errorExcerpt =
		t.record.read === 'PARSED' && t.record.errorExcerpt !== undefined ? t.record.errorExcerpt : t.signals.errorExcerpt;
	if (
		t.cliRun === undefined ||
		t.cliRun.exitCode !== 0 ||
		!t.cliRun.stdoutComplete ||
		errorExcerpt !== undefined ||
		t.signalsUnread
	)
		return failure('CLI_ERROR', cliErrorTail(errorExcerpt, t));
	const text = t.record.read === 'PARSED' ? (t.record.answer ?? '') : '';
	return text.trim() === '' ? { arrived: false, cause: 'ENDED_WITHOUT_ANSWER' } : { arrived: true, text };
}

/** ⭐ D16 — the turn's prompt, without and with the system prompt, from the session's tries so far. */
function composedPrompt(
	systemPrompt: string,
	turns: readonly string[],
	answers: readonly (string | undefined)[]
): { readonly prompt: string; readonly userPrompt: string } {
	const n = turns.length;
	if (n === 1) return { prompt: `${systemPrompt}\n\n${turns[0]}`, userPrompt: turns[0]! };
	// ⭑ Each earlier try: its answer verbatim, then the findings on it — the next turn's text. The last earlier try's
	// findings are this turn's own text, which ends the prompt.
	const tries = turns.slice(0, n - 1).map((_, k) => {
		const answer = answers[k];
		const said =
			answer === undefined
				? `On try ${k + 1} no answer arrived.`
				: `Your answer on try ${k + 1}:\n\n${answer}`;
		return k < n - 2
			? `${said}\n\nWhat the independent review found on try ${k + 1}:\n\n${turns[k + 1]}`
			: said;
	});
	// ⛔ PAST THE BOUND, THE OLDEST TRIES ARE LEFT OUT WHOLE, NEVER CUT.
	let kept = 0;
	let size = 0;
	for (let k = tries.length - 1; k >= 0; k--) {
		if (size + tries[k]!.length > EXECUTOR_RESEND_HISTORY_CHARS) break;
		size += tries[k]!.length;
		kept += 1;
	}
	const leftOut = tries.length - kept;
	const parts = [`The instruction, as it was given on your first try:\n\n${turns[0]}`];
	if (leftOut > 0)
		parts.push(
			`${leftOut} earlier ${leftOut === 1 ? 'try is' : 'tries are'} left out here, to keep this prompt within its ` +
				`bound; the record holds ${leftOut === 1 ? 'it' : 'them'}.`
		);
	parts.push(...tries.slice(leftOut), `This turn:\n\n${turns[n - 1]}`);
	const userPrompt = parts.join('\n\n');
	return { prompt: `${systemPrompt}\n\n${userPrompt}`, userPrompt };
}

/**
 * Open one CLI executor session for a work unit.
 *
 * ⛔ IT THROWS, as `openPiExecutionSession` does, for its reason: a producer's location or tool surface may not be a
 * fiction — a workspace with no directory, an ancestor of the root holding a CLI's project configuration, a driver's file
 * outside the run folder, a preflight that refused. A refusal once the run folder exists removes it and closes the server
 * first.
 */
export async function openCliExecutionSession(
	context: ProducerSessionContext,
	selection: CliExecutorSelection,
	driver: CliDriver,
	deps: CliSessionDeps = {}
): Promise<ProducerSession> {
	const working = producerWorkingDirectory(context);
	if (!working.resolved) throw new Error(working.refusedBecause);
	const workspaceDirectory = working.directoryPath;
	const toolId = selection.toolId;
	if (driver.toolId !== toolId || !/^[a-z0-9][a-z0-9-]*$/.test(toolId))
		throw new Error(`No CLI executor driver for '${toolId}' was handed to its opener; refusing to open the session.`);
	const exec = deps.exec ?? spawnCli;
	const timeoutMs = deps.turnTimeoutMs ?? EXECUTOR_TURN_TIMEOUT_MS;
	const now = deps.now ?? (() => new Date().toISOString());
	const log = deps.log ?? ((line: string) => console.warn(line));
	const root = resolve(deps.root ?? join(tmpdir(), 'jpwb-exec'));
	const home = homedir();

	await mkdir(root, { recursive: true });
	const above = ancestorConfiguration(root, home, existsSync);
	if (above.length > 0)
		throw new Error(
			`The CLI executor session is refused: an ancestor of its dedicated root holds a CLI's project configuration ` +
				`(${above.join('; ')}), which a CLI that walks up from its working folder could read (JAN-MHX D13).`
		);
	sweepStaleRunFolders(root);

	// ⭑ MINTED AS PI'S ARE (`pi-executor.ts`), the process-run observer in the ports, before anything is started.
	const processRuns = createProcessRunObserver();
	const tools = mintExecutionTools({
		ports: { workspace: context.workspace, runner: context.runner, processRuns },
		grantedCapabilities: context.grantedCapabilities,
		bindingAuthorizationStatus: context.bindingAuthorizationStatus
	});
	const mintedToolNames = tools.map((t) => t.name);
	const observer = createToolCallObserver();

	let manifests: TurnManifests | undefined;
	const directory = await mkdtemp(join(root, `${RUN_FOLDER_PREFIX}${toolId}-${process.pid}-`));
	let server: HostToolServer | undefined;
	let run: CliRunFolder;
	let fingerprints: readonly (readonly [string, string, string])[];
	try {
		const cliDirectory = join(directory, 'cli');
		const hostDirectory = join(directory, 'host');
		await mkdir(cliDirectory);
		await mkdir(hostDirectory);
		server = await startHostToolServer({
			tools,
			observer,
			aroundCall: {
				async before() {
					if (manifests === undefined) return;
					const at = await workspaceManifest(workspaceDirectory);
					for (const path of changedPaths(manifests.checkpoint, at)) manifests.unexplained.add(path);
				},
				async after() {
					if (manifests === undefined) return;
					manifests.checkpoint = await workspaceManifest(workspaceDirectory);
				}
			}
		});
		// ⛔ D41 — THE ENDPOINT FILE IS IN `host/`, OUTSIDE THE CLI'S WORKING FOLDER. Until a turn opens it holds no token.
		const endpointPath = join(hostDirectory, 'endpoint.json');
		writeFileSync(endpointPath, JSON.stringify({ url: server.url, token: null }), 'utf8');
		run = {
			directory,
			cliDirectory,
			hostDirectory,
			bridgePath: await writeBridge(hostDirectory),
			endpointPath,
			nodePath: process.execPath,
			serverName: HOST_TOOL_SERVER_NAME,
			systemPrompt: `${EXECUTOR_HOST_TOOLS_PREAMBLE}\n\n${EXECUTION_CONTRACT_PROMPT}`
		};
		for (const file of driver.runFolderFiles(run)) await writeInside(directory, file, toolId);
		fingerprints = driver.configSources.map((s) => [s.name, s.path, fingerprintOf(s.path)] as const);
		const declared = driver.preflight(run, selection);
		// ⭐ `JAN-MHX` MH-6's check fix — every check the driver declares, in its order; the first refusal refuses the session.
		const checks = declared === undefined ? [] : 'invocation' in declared ? [declared] : declared;
		for (const check of checks) {
			const refusal = await preflightRefusal(
				check,
				exec,
				{ cwd: cliDirectory, env: cliEnvironment(driver) },
				deps.preflightTimeoutMs ?? CLI_PREFLIGHT_TIMEOUT_MS
			);
			if (refusal !== undefined)
				throw new Error(`The CLI executor session for '${toolId}' is refused by its preflight: ${refusal}`);
		}
	} catch (e) {
		await server?.close();
		await rm(directory, { recursive: true, force: true }).catch(() => undefined);
		throw e;
	}
	const openServer = server;
	const runFolder = run;
	const sources = fingerprints;

	/** Every turn's text, as `run-model-step` sent it, and each try's answer, if one arrived (D16). */
	const turns: string[] = [];
	const answers: (string | undefined)[] = [];
	let disposed = false;
	let active: CliChild | undefined;
	let lastTurn: AdapterToolObservation = {
		canObserve: false,
		reason:
			'This session has taken no turn yet, so there is no turn for this adapter to report an observation about. It ' +
			'is not evidence that no tool ran.'
	};

	/** ⭐ D44a — what changed since the session opened, before any spawn, or `undefined`. */
	function configChange(): string | undefined {
		const changed = sources.filter(([, path, at]) => fingerprintOf(path) !== at).map(([name]) => name);
		const appeared = ancestorConfiguration(root, home, existsSync);
		const named = [...changed, ...appeared.map((hit) => `an ancestor of the dedicated root now holds ${hit}`)];
		return named.length === 0 ? undefined : named.join('; ');
	}

	const NOT_STARTED: AdapterToolObservation = {
		canObserve: false,
		reason:
			'This turn was refused before the CLI was started, so no model ran on it and nothing was in a position to ' +
			'call a tool.'
	};

	/** ⭐ D21a — add the turn's breach to the marker beside the workspace. */
	const taintWith = (code: WorkspaceTaintCode, turn: number): void =>
		writeWorkspaceTaint(workspaceDirectory, { code, toolId, turn, at: now() });

	async function takeTurn(text: string): Promise<ToolInvocationResult> {
		turns.push(text);
		answers.push(undefined);
		const n = turns.length;
		lastTurn = NOT_STARTED;
		const producerOf = (modelId: string) => ({
			agentId: 'execution.model-invocation',
			modelId,
			providerId: toolId
		});
		const changed = configChange();
		if (changed !== undefined)
			return {
				answer: failure('EXECUTOR_CONFIG_CHANGED', ` It names: ${changed}.`),
				rawOutput: '',
				producer: producerOf(selection.modelId),
				identityEvidence: 'HOST_CONFIGURED',
				observedToolCalls: NOT_STARTED
			};

		const { prompt, userPrompt } = composedPrompt(runFolder.systemPrompt, turns, answers);
		const promptPath = join(runFolder.hostDirectory, `prompt-${n}.txt`);
		await writeFile(promptPath, prompt, 'utf8');
		const invocation = driver.invocation({
			run: runFolder,
			turn: n,
			modelId: selection.modelId,
			effort: selection.effort,
			prompt,
			userPrompt,
			promptPath
		});
		const callsBefore = observer.count();
		manifests = {
			checkpoint: await workspaceManifest(workspaceDirectory),
			unexplained: new Set()
		};
		// ⛔ D2 — THE TURN'S TOKEN IS MINTED AND WRITTEN BEFORE THE SPAWN, AND ONLY TO THE ENDPOINT FILE.
		const token = openServer.openTurn();
		writeFileSync(runFolder.endpointPath, JSON.stringify({ url: openServer.url, token }), 'utf8');
		let outcome: { readonly bound: boolean; readonly run: CliRun | undefined };
		try {
			const child = exec({
				program: invocation.program,
				args: invocation.args,
				cwd: runFolder.cliDirectory,
				env: cliEnvironment(driver),
				stdin: invocation.stdin
			});
			active = child;
			const bound = delay(timeoutMs);
			const first = await Promise.race([child.done, bound.elapsed]);
			bound.cancel();
			if (first === 'ELAPSED') {
				// ⛔ D18 — PAST THE BOUND THE WHOLE TREE IS KILLED; what it left is read if it is reported gone in time.
				await child.kill();
				const wait = delay(KILL_WAIT_MS);
				const after = await Promise.race([child.done, wait.elapsed]);
				wait.cancel();
				outcome = { bound: true, run: after === 'ELAPSED' ? undefined : after };
			} else outcome = { bound: false, run: first };
		} finally {
			active = undefined;
			// ⛔ D8 — THE GATE CLOSES WHEN THE CLI EXITS OR IS KILLED, and the token is revoked with it.
			await openServer.closeTurn();
			// ⭐ `B-2` — IN THE `finally`, so a turn that throws still says which calls reached the host.
			lastTurn = { canObserve: true, mintedToolNames, calls: observer.since(callsBefore) };
		}

		const turnManifests = manifests;
		manifests = undefined;
		const end = await workspaceManifest(workspaceDirectory);
		for (const path of changedPaths(turnManifests.checkpoint, end)) turnManifests.unexplained.add(path);
		const unexplained = [...turnManifests.unexplained].sort();
		const transcript: readonly HostToolCall[] = openServer.transcript();
		const hostCalls: readonly AdapterToolCall[] = observer.since(callsBefore);
		const cliRun = outcome.run;

		// ⛔ D21a — A CHANGE NOTHING THE HOST RAN EXPLAINS IS DECIDED FROM THE MANIFESTS ALONE, AND MARKED, BEFORE ANY OF THE
		// DRIVER'S READING RUNS: the CLI's own writes must not be left unmarked in a workspace a re-run reuses because a
		// driver's code threw.
		if (unexplained.length > 0) taintWith('CLI_UNEXPLAINED_CHANGE', n);
		const record = await recordOf(
			driver,
			cliRun === undefined || cliRun.startFailure !== undefined
				? undefined
				: { run: runFolder, turn: n, exitCode: cliRun.exitCode, stdout: cliRun.stdout }
		);
		// ⛔ `JAN-MHX` MH-6's check fix — A CUT ERROR STREAM IS NOT CLASSIFIED: what it held past the bound is unknown, so its
		// first lines cannot show it reported no error, or no call the CLI rejected before sending it (MH-0c F4).
		const errorStreamCut = cliRun !== undefined && !cliRun.errorLinesComplete;
		const classified = errorStreamCut ? undefined : signalsOf(driver, cliRun?.errorLines ?? []);
		const signals: CliStderrSignals = classified ?? {};
		const merge: MergedRecord =
			record.read === 'PARSED'
				? mergedWithHostCalls(record.events, hostCalls, driver.carriers)
				: { calls: hostCalls, ownRan: [], mismatch: false, refusedSinceAnswer: false };
		const offeredOwn =
			record.read === 'PARSED' && record.surface !== undefined
				? record.surface.filter((t) => t.party === 'OWN' && !driver.carriers.includes(t.name)).map((t) => t.name)
				: [];
		const surfaceUnproven = surfaceProofFails(record, mintedToolNames) || merge.mismatch;
		const observation: AdapterToolObservation = {
			canObserve: true,
			mintedToolNames,
			calls: merge.mismatch ? hostCalls : merge.calls
		};
		lastTurn = observation;

		// ⭐ D19a — what an excerpt may not carry: the prompt, what the host served, the run folder, the port, the token.
		const withheld = [
			prompt,
			...transcript.flatMap((call) => [...stringsIn(call.arguments), ...(call.result === null ? [] : [call.result])]),
			runFolder.directory,
			runFolder.directory.replaceAll('\\', '/'),
			String(openServer.port),
			token
		];
		const reported = record.read === 'PARSED' ? [...new Set(record.reportedModels)] : [];
		let breach: WorkspaceTaintCode | undefined;
		if (merge.ownRan.length > 0 || offeredOwn.length > 0) breach = 'CLI_OWN_TOOL_RAN';
		else if (unexplained.length > 0) breach = 'CLI_UNEXPLAINED_CHANGE';

		const answer = turnAnswer({
			breach,
			bound: outcome.bound,
			timeoutMs,
			cliRun,
			record,
			surfaceUnproven,
			reported,
			modelId: selection.modelId,
			refusedSinceAnswer: merge.refusedSinceAnswer,
			signals,
			signalsUnread: classified === undefined,
			errorStreamCut,
			withheld
		});

		// ⭑ An unexplained change was marked above, before the driver's reading; a tool of the CLI's own is known only from it.
		if (breach === 'CLI_OWN_TOOL_RAN') taintWith(breach, n);
		if (answer.arrived) answers[n - 1] = answer.text;
		const identityEvidence: ToolIdentityEvidence =
			answer.arrived && reported.length === 1 ? 'PROVIDER_REPORTED' : 'HOST_CONFIGURED';
		// ⭐ D17 — E-1: what the host sent the CLI, and what the host's server served it, in order.
		const envelope = { e1: 'HOST_TO_CLI', prompt, tools: openServer.tools, calls: transcript };
		return {
			answer,
			...(answer.arrived && record.read === 'PARSED' && record.volunteeredReasoning !== undefined
				? { volunteeredReasoning: record.volunteeredReasoning }
				: {}),
			rawOutput: answer.arrived ? answer.text : '',
			producer: producerOf(selection.modelId),
			identityEvidence,
			observedToolCalls: observation,
			materializedInput: JSON.stringify(envelope),
			// ⭐ D20 — ON A BREACH, AND ONLY THEN, THE CLI'S RECORD AND THE CHANGED PATHS GO WITH THE ANSWER, for the caller to
			// keep beside the try (`captureTry`'s `breachRecord`). On a turn that passes they are not retained.
			...(breach === undefined
				? {}
				: {
						sessionExport: JSON.stringify({
							breach,
							cliRecord: record.read === 'ABSENT' || record.read === 'DRIVER_THREW' ? null : record.raw,
							unexplainedChanges: unexplained
						})
					})
		};
	}

	return {
		retainsHistory: true,
		lastTurnObservation: () => lastTurn,
		processRuns: () => processRuns.observed(),
		async turn(text: string): Promise<ToolInvocationResult> {
			// ⛔ Before anything is written or started, and in its own words: a fixed sentence, naming nothing of the run.
			if (disposed) throw new Error('This CLI executor session has been disposed; it takes no further turn.');
			try {
				return await takeTurn(text);
			} catch (e) {
				// ⛔ D42 — a thrown failure reaches the record's parse outcome, so it carries an errno code and nothing else.
				const code = (e as NodeJS.ErrnoException | undefined)?.code;
				throw new Error(
					`The CLI executor for '${toolId}' could not run this turn (${typeof code === 'string' ? code : 'no error code'}).`
				);
			}
		},
		dispose() {
			// ⛔ D8, D13 — THE GATE CLOSES AND THE TOKEN IS REVOKED BEFORE THIS RETURNS; the rest finishes afterwards.
			disposed = true;
			const closing = openServer.close();
			void active?.kill();
			void closing.catch(() => log('The CLI executor session’s host tool server did not close cleanly.'));
			void rm(runFolder.directory, { recursive: true, force: true, maxRetries: 3 }).catch(
				(e: NodeJS.ErrnoException) =>
					log(`The CLI executor session’s run folder could not be removed (${e.code ?? 'no error code'}).`)
			);
		}
	};
}
