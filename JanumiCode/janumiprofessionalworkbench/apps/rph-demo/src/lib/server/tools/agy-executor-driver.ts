// ⭐⭐ `JAN-MHX` MH-5 (`DESIGN-multi-harness-executor.md` §4.2, D12–D24; the agy probes MH-0b ran on agy 1.4.2) — THE agy
// DRIVER: what differs about agy as a CLI executor, for `openCliExecutionSession` to run. P5's executor (the sponsor's Q3).
//
// ⭑ THE RUN FOLDER IS ONE FILE, `cli/.agents/agents/jpwb-executor.md`: agy reads `.agents/` from its working folder only
// (MH-0b B14), loads it from a fresh, untrusted folder in headless mode (B1), and starts the agent's own `mcpServers` entry
// at turn start (B15). Its frontmatter is the one P1b ran, and its body is the system prompt (D15).
//   · ⛔ NO `tools:` LINE (B4): `tools: [call_mcp_tool]`, a name agy's own init event lists, failed executor construction
//     with exit 3 ("unknown component: tool "call_mcp_tool" not found in registry"), and no registry name is known.
//     Without one, agy offers the host's tools directly as `mcp_jpwb_<tool>` (B3), so this driver has NO CARRIERS.
//   · ⚠ NO `hooks.json` — THIS BUILD'S, NOT THE DESIGN'S (§4.2 names a PreToolUse hook as a second guard; to be confirmed
//     by the lead). P1b showed the host's tools run headless with no hook and no skip flag (B3); whether a PreToolUse hook
//     fires on an MCP step at all, and under which name, is unmeasured (B16), and a hook that denied the host's call would
//     fail every turn where only a paid call could show it. So the preflight refuses EVERY hook instead (below).
//
// ⭑ THE PREFLIGHT, ONCE PER SESSION: `-p /hooks` in `cli/`, which agy answers without a model turn (B16: no turns, no
// tokens, no conversation left). The session is refused unless agy lists no hook at all — a hook from any source runs a
// command on agy's tool calls that neither the host nor agy's record of the turn shows (design §4.2, R23). ⛔ Never with
// `--disable-slash-commands`, which would send `/hooks` to the model as a prompt; and a listing that shows a turn was
// taken refuses the session, so an agy that stopped answering it free would be refused, not paid on every open.
// ⚠ ONCE, NOT EVERY TURN, because the opener runs one preflight: a hook file created later is caught before each turn by
// D44a's fingerprint of `~/.gemini/config/hooks.json` and of the plugins folder (`AGY_CONFIG_SOURCES`). The residual: a
// hook added inside a plugin folder that already exists changes neither, and goes unseen until the next session.
//
// ⛔⛔ THE SURFACE PROOF (D14a): NONE. agy's record cannot show which tools it offered its model. Its stream-json `init`
// event lists the same 60 tools — its own shell, file and browser tools among them — whatever the agent file says: for
// the default agent, for this one, and for four variants (B5). Its step records show only what RAN or was rejected, and
// its log names no tool (MH-5's read of P1b's log). So every reading returns `surface: undefined`, and every turn ends
// `CLI_SURFACE_UNPROVEN` unless a breach or the host's bound outranks it. ⚠ THAT IS THE DESIGN'S OWN RULE APPLIED TO WHAT
// MH-0b MEASURED, and it holds until the lead rules which proof stands for agy: MH-0b's open question 1 (a version-pinned
// measurement, as the design accepts for Codex; a recording hook, which needs P2; or another). The tools agy's model said
// it was offered in P3 — the two host tools and `manage_task`, `list_resources`, `read_resource` — are its own report,
// which no record attests, and whether those three would be tolerated is the lead's open question 2.
//
// ⭑ WHAT THE RECORD DOES SHOW, READ FROM ITS STREAM-JSON (B17, as P1a and P1b wrote it):
//   · a tool step named `mcp_jpwb_<tool>` is a host call, the host's minted name after the prefix; any other tool step is
//     agy's own, and one that ran is a breach (D21);
//   · a step that ended `ERROR` with a `TOOL_ERROR` reading "invalid arguments" was rejected before it was sent (B7: the
//     host received no call), so it is a refused attempt, not a call that ran;
//   · `result.denied_actions` (agy's changelog: headless runs that skip an action they were not permitted end with a
//     notice and report it there) are refused attempts, after the steps, since the record places them nowhere else;
//   · every `agent_response` step that ended `DONE` is the model saying something, so a refusal before it was gone past.
//   ⛔ A line, event, step type or state of another shape fails the reading closed (UNPARSEABLE): the breach and refusal
//   rules rest on knowing every step agy recorded. ⚠ An own tool's step that ended `ERROR` in any other way is read as one
//   that RAN — the closed direction, since nothing shows it did not.
//
// ⭑ THE MODEL (D22): HOST_CONFIGURED. agy reports no model it was served (B9): `init.model` echoes `--model`, and its log
// says what it asked for (`model_resolver.go:107] Resolving model <slug>`), not what answered. So a reading reports no
// model for a turn that names only the configured one, and names any OTHER model these three name: `init.model`; a
// resolution line; and the alias line `model_resolver.go:155 … resolved to …` the design names, never seen in MH-0b's 47
// logs, whose target is read as the design quotes it (an alias line whose target cannot be read fails the reading
// closed). ⚠ `resolver.go:85` and `resolver.go:111` appear on every run and are not read as substitution (B9).
// ⚠ What no signal covers (B10): each invocation makes one more model request than its steps, unreported in `usage`, of
// unknown purpose and model.
//
// ⛔ agy's LOG HOLDS THE ACCOUNT'S E-MAIL ADDRESS AT EVERY LAUNCH (B12). It is written into `host/`, one file per turn, read
// in memory for its model lines alone, and never part of the reading's `raw` (which the opener keeps beside a breach,
// D20); the run folder goes at dispose. ⚠ The retention residual this driver cannot close (B11, D44): every stream-json
// process leaves a conversation in the operator's `~/.gemini/antigravity-cli/conversations`.
//
// ⭑ ITS PROGRAM: the override `agy-cli.ts` captured when it loaded — honoured in test mode only, since the selector refuses
// one outside it (`JPWB_AGY_BIN`, `REG-F-459`) — else the first `agy.exe` (`agy` off Windows) on the server's PATH, as the
// agy judge finds its program, resolved to an absolute path when the session opens and run by that path. None found
// refuses the session at its preflight, before anything is started.
// ⚠ THE CLI's ERROR STREAM IS NEVER TOUCHED HERE: the opener binds it and hands this driver its lines (D24).
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { AGY_BIN_OVERRIDE } from '../assurance/agy-cli.js';
import type {
	CliDriver,
	CliRecordEvent,
	CliRecordReading,
	CliRunFolder,
	CliStderrSignals
} from './cli-executor-session.js';
import { EXECUTION_TOOL_CATALOG } from './execution-tool-surface.js';

/** The tool id this driver serves, as `WIRED_EXECUTORS` and the backing-tool catalog name it. */
const AGY_TOOL_ID = 'agy';

/** The run-scoped agent's name: its file's name, its frontmatter's `name`, and `--agent`'s value. */
export const AGY_EXECUTOR_AGENT = 'jpwb-executor';

/** Where the agent file lies in the run folder, relative to it (B14: agy reads `.agents/` in its working folder only). */
export const AGY_AGENT_FILE = `cli/.agents/agents/${AGY_EXECUTOR_AGENT}.md`;

/**
 * ⭐ D18 — agy's per-call MCP tool timeout, above the host's 120 s command bound so the model is never shown a failure for
 * a command the host is still running. ⭑ MEASURED: with it, a call the stand-in held for 150 s completed (B8). agy's
 * default without it is unmeasured.
 */
const AGY_MCP_TIMEOUT_SECONDS = 180;

/**
 * ⭐ D44a — the files agy reads its configuration from, by name, fingerprinted by `stat` before each turn (B13, measured
 * by stat alone). ⚠ The Antigravity desktop app shares `~/.gemini`. ⚠ LEFT OUT, because agy writes it itself on every
 * stream-json run (B11): `~/.gemini/antigravity-cli/conversations`.
 */
const AGY_CONFIG_SOURCES: readonly { readonly name: string; readonly path: readonly string[] }[] = [
	{
		name: 'agy’s shared permissions (~/.gemini/config/config.json)',
		path: ['.gemini', 'config', 'config.json']
	},
	{
		name: 'agy’s settings (~/.gemini/antigravity-cli/settings.json)',
		path: ['.gemini', 'antigravity-cli', 'settings.json']
	},
	{
		name: 'agy’s global hooks (~/.gemini/config/hooks.json)',
		path: ['.gemini', 'config', 'hooks.json']
	},
	{
		name: 'agy’s global MCP servers (~/.gemini/config/mcp_config.json)',
		path: ['.gemini', 'config', 'mcp_config.json']
	},
	{ name: 'agy’s plugins (~/.gemini/config/plugins)', path: ['.gemini', 'config', 'plugins'] },
	{
		name: 'agy’s project grants (~/.gemini/config/projects)',
		path: ['.gemini', 'config', 'projects']
	}
];

/** The step types agy 1.4.2's stream-json was seen to write (B17), and the states a step was seen in. */
const STEP_TYPES: ReadonlySet<unknown> = new Set([
	'user_input',
	'agent_response',
	'tool',
	'error_message'
]);
const STEP_STATES: ReadonlySet<unknown> = new Set(['ACTIVE', 'DONE', 'ERROR']);

/** The prefix of the line agy writes its structured error on, on its error stream (B17). */
const AGY_ERROR_PREFIX = 'AGY_ERROR: ';

/**
 * ⚠ agy's own time-limit warning (D19), recognised by its form, not by bytes MH-0b saw: agy's changelog (1.1.28) says an
 * expired `--print-timeout` returns the partial output and exits 0 with a warning on its error stream, and the one agy
 * warning MH-0b saw began `warning: ` (B17). ⭑ The driver never passes `--print-timeout`, whose default is no limit, so
 * this is a guard for an agy whose default changes.
 */
const TIME_LIMIT_WARNING = /^warning:.*\b(time ?out|timed out|time limit|deadline)\b/i;

/** The agy program, by absolute path, or `undefined` when there is none to run (see the header). */
function agyProgram(): string | undefined {
	if (AGY_BIN_OVERRIDE !== undefined) return AGY_BIN_OVERRIDE;
	const name = process.platform === 'win32' ? 'agy.exe' : 'agy';
	for (const dir of (process.env.PATH ?? '').split(delimiter)) {
		if (!isAbsolute(dir)) continue;
		try {
			if (statSync(join(dir, name)).isFile()) return join(dir, name);
		} catch {
			// ⭑ Not in this folder; the next one is asked.
		}
	}
	return undefined;
}

/** The sentence a session without an agy program is refused with. ⭑ It names no folder. */
const NO_PROGRAM =
	'The agy executor has no program to run: no agy.exe was found on the server’s PATH (and no test-mode JPWB_AGY_BIN ' +
	'was captured), so the session is refused before anything is started.';

/**
 * ⭐ D15 — the agent file: P1b's frontmatter, with no `tools:` line (B4), and the preamble and execution contract as its
 * body, after the H1 agy reads a Markdown agent's system prompt from. ⭑ Every path is written as a JSON string, which is
 * a YAML double-quoted scalar, so a backslash or a quote in it is read back as written.
 */
function agentFile(run: CliRunFolder): string {
	const quoted = (path: string): string => JSON.stringify(path);
	return [
		'---',
		`name: ${AGY_EXECUTOR_AGENT}`,
		'description: The JPWB executor; only the host tools on the jpwb server.',
		'inheritCustomizations: false',
		'inheritMcp: false',
		'excludeDefaultComponents: true',
		'commandExecutionPolicy: off',
		'mcpServers:',
		`  - name: ${run.serverName}`,
		`    command: ${quoted(run.nodePath)}`,
		'    args:',
		`      - ${quoted(run.bridgePath)}`,
		`      - ${quoted(run.endpointPath)}`,
		'    enabledTools:',
		...EXECUTION_TOOL_CATALOG.map((tool) => `      - ${tool.name}`),
		`    timeoutSeconds: ${AGY_MCP_TIMEOUT_SECONDS}`,
		'---',
		`# ${AGY_EXECUTOR_AGENT}`,
		run.systemPrompt,
		''
	].join('\n');
}

/** The turn's log file, in `host/` (D44: `--log-file` keeps agy's log in the run folder). */
const logOf = (run: CliRunFolder, turn: number): string =>
	join(run.hostDirectory, `agy-${turn}.log`);

/** Why `/hooks`' listing refuses the session, or `undefined` when agy lists no hook and took no turn. */
function hooksRefusal(output: {
	readonly exitCode: number | null;
	readonly stdout: string;
}): string | undefined {
	if (output.exitCode !== 0) return `agy's hooks listing exited ${String(output.exitCode)}.`;
	let listing: unknown;
	try {
		listing = JSON.parse(output.stdout.trim());
	} catch {
		return "agy's hooks listing could not be read as JSON.";
	}
	const answer = isRecord(listing) ? listing : {};
	if (answer.num_turns !== 0)
		return (
			'agy took the hooks listing as a model turn, or did not say it took none, so it is not the free check this ' +
			'preflight is.'
		);
	const command = isRecord(answer.command) ? answer.command : {};
	const data = isRecord(command.data) ? command.data : {};
	if (command.name !== 'hooks' || !Array.isArray(data.hooks))
		return "agy's answer is not a listing of its hooks.";
	if (data.hooks.length > 0)
		return (
			`agy lists ${data.hooks.length} hook${data.hooks.length === 1 ? '' : 's'}, and this executor runs with none: a ` +
			'hook runs a command on agy’s tool calls that neither the host nor agy’s record of the turn shows.'
		);
	return undefined;
}

/** Whether a JSON value is an object (not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A reading's failure: the record holds what this driver cannot read whole. */
class UnreadableRecord extends Error {}

/** What a stream-json record says, read whole (B17). */
interface AgyStream {
	readonly events: readonly CliRecordEvent[];
	readonly initModel: string | undefined;
	readonly answer: string | undefined;
	readonly errorExcerpt: string | undefined;
}

/** The name of one entry of `result.denied_actions`: a string, or an object naming its tool. */
function deniedName(entry: unknown): string {
	if (typeof entry === 'string' && entry !== '') return entry;
	if (isRecord(entry))
		for (const key of ['name', 'tool_name', 'tool']) {
			const value = entry[key];
			if (typeof value === 'string' && value !== '') return value;
		}
	throw new UnreadableRecord('a denied action of a shape this driver does not know');
}

/** ⭐ B7 — whether a step that ended `ERROR` was rejected before it was sent: agy's own check of its arguments. */
function rejectedBeforeSending(update: Record<string, unknown>): boolean {
	const info = isRecord(update.tool_info) ? update.tool_info : {};
	const error = isRecord(info.error) ? info.error : {};
	return (
		update.state === 'ERROR' &&
		error.type === 'TOOL_ERROR' &&
		typeof error.message === 'string' &&
		error.message.startsWith('invalid arguments')
	);
}

/** One line of the record: its event's name and payload. ⛔ It throws `UnreadableRecord` on any other shape. */
function eventOf(line: string): {
	readonly event: string;
	readonly payload: Record<string, unknown>;
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		throw new UnreadableRecord('a line that is not JSON');
	}
	if (!isRecord(parsed) || typeof parsed.event !== 'string')
		throw new UnreadableRecord('a line that is not an event');
	const payload = parsed[parsed.event];
	if (!isRecord(payload)) throw new UnreadableRecord('an event without its payload');
	return { event: parsed.event, payload };
}

/** A step's index, once its type and state are ones agy was seen to write. ⛔ It throws `UnreadableRecord` otherwise. */
function stepIndexOf(step: Record<string, unknown>): number {
	const index = step.step_index;
	if (typeof index !== 'number' || !Number.isInteger(index) || index < 0)
		throw new UnreadableRecord('a step without its index');
	if (!STEP_TYPES.has(step.step_type) || !STEP_STATES.has(step.state))
		throw new UnreadableRecord('a step of a type or state this driver does not know');
	return index;
}

/** The record's one `init`, its one `result`, and each step's last update, by index. */
function eventsOf(lines: readonly string[]): {
	readonly init: Record<string, unknown> | undefined;
	readonly result: Record<string, unknown> | undefined;
	readonly steps: ReadonlyMap<number, Record<string, unknown>>;
} {
	const steps = new Map<number, Record<string, unknown>>();
	let init: Record<string, unknown> | undefined;
	let result: Record<string, unknown> | undefined;
	for (const line of lines) {
		const { event, payload } = eventOf(line);
		if (event === 'init' && init === undefined) init = payload;
		else if (event === 'result' && result === undefined) result = payload;
		else if (event === 'step_update') steps.set(stepIndexOf(payload), payload);
		else
			throw new UnreadableRecord('an event this driver does not know, or a second init or result');
	}
	return { init, result, steps };
}

/** ⭐ D21 — what one step adds to the record's events: a model message, a host call, or a tool of agy's own. */
function stepEvent(step: Record<string, unknown>, prefix: string): CliRecordEvent | undefined {
	if (step.step_type === 'agent_response')
		return step.state === 'DONE' ? { kind: 'ASSISTANT_MESSAGE' } : undefined;
	if (step.step_type !== 'tool') return undefined;
	const info = isRecord(step.tool_info) ? step.tool_info : {};
	const name = typeof step.tool_name === 'string' ? step.tool_name : info.name;
	if (typeof name !== 'string' || name === '')
		throw new UnreadableRecord('a tool step without its tool');
	const rejected = rejectedBeforeSending(step);
	return name.startsWith(prefix) && name.length > prefix.length
		? { kind: 'HOST_CALL', name: name.slice(prefix.length), sent: !rejected }
		: { kind: 'OWN_TOOL', name, ran: !rejected };
}

/**
 * ⭐ D20, D21 — the stream-json record, read whole. ⛔ It throws `UnreadableRecord` on any line, event, step type or state
 * of a shape it does not know (see the header).
 */
function readStream(lines: readonly string[], serverName: string): AgyStream {
	const { init, result, steps } = eventsOf(lines);
	const events: CliRecordEvent[] = [];
	for (const index of [...steps.keys()].sort((a, b) => a - b)) {
		const event = stepEvent(steps.get(index)!, `mcp_${serverName}_`);
		if (event !== undefined) events.push(event);
	}
	const status = result?.status;
	if (result !== undefined && status !== 'SUCCESS' && status !== 'ERROR')
		throw new UnreadableRecord('a result of a status this driver does not know');
	const denied = result?.denied_actions ?? [];
	if (!Array.isArray(denied)) throw new UnreadableRecord('denied actions that are not a list');
	for (const entry of denied)
		events.push({ kind: 'OWN_TOOL', name: deniedName(entry), ran: false });
	return {
		events,
		initModel: typeof init?.model === 'string' ? init.model : undefined,
		answer:
			status === 'SUCCESS' && typeof result?.response === 'string' ? result.response : undefined,
		// ⭑ P1a: an executor agy could not construct ended `status: "ERROR"` with its `error` a string.
		errorExcerpt: status === 'ERROR' && typeof result?.error === 'string' ? result.error : undefined
	};
}

/**
 * ⭐ D22 — every model agy's log names as the one it resolves (see the header), in the order named. ⛔ It throws
 * `UnreadableRecord` for an alias line whose target cannot be read.
 */
function modelsTheLogNames(log: string): string[] {
	const named: string[] = [];
	for (const line of log.split(/\r?\n/)) {
		const resolving = /model_resolver\.go:107\] Resolving model ([^\s"]+)/.exec(line);
		if (resolving) named.push(resolving[1]!);
		if (!line.includes('model_resolver.go:155]')) continue;
		const alias = /resolved to "?([^\s",]+)"?/.exec(line);
		if (!alias) throw new UnreadableRecord('an alias line whose target this driver cannot read');
		named.push(alias[1]!);
	}
	return named;
}

/** ⭐ D24 — the `short_error` of agy's `AGY_ERROR: {…}` line, a shape agy documents and MH-0b saw (B4, B17). */
function shortErrorOf(line: string): string | undefined {
	try {
		const error: unknown = JSON.parse(line.slice(AGY_ERROR_PREFIX.length));
		return isRecord(error) && typeof error.short_error === 'string' ? error.short_error : undefined;
	} catch {
		return undefined;
	}
}

/** The agy driver, for one session: its program resolved when the session opens (`cli-executor-drivers.ts`). */
export function agyExecutorDriver(): CliDriver {
	const program = agyProgram();
	/** The model each turn was asked to run, by turn: what a reading compares the models agy names with. */
	const modelOfTurn = new Map<number, string>();
	const programOrRefuse = (): string => {
		if (program === undefined) throw new Error(NO_PROGRAM);
		return program;
	};
	return {
		toolId: AGY_TOOL_ID,
		// ⭑ B3 — none: agy offers the host's tools directly, by their own names.
		carriers: [],
		configSources: AGY_CONFIG_SOURCES.map((source) => ({
			name: source.name,
			path: join(homedir(), ...source.path)
		})),
		// ⭑ Its effect is unverified: agy updates itself at launch, so the lane records its version (D36).
		environment: { AGY_CLI_DISABLE_AUTO_UPDATE: '1' },
		runFolderFiles: (run) => [{ path: AGY_AGENT_FILE, bytes: agentFile(run) }],
		preflight: (run) => ({
			invocation: {
				program: programOrRefuse(),
				args: [
					'-p',
					'/hooks',
					'--agent',
					AGY_EXECUTOR_AGENT,
					'--output-format',
					'json',
					'--log-file',
					join(run.hostDirectory, 'agy-preflight.log')
				]
			},
			refusal: hooksRefusal
		}),
		invocation(turn) {
			modelOfTurn.set(turn.turn, turn.modelId);
			return {
				program: programOrRefuse(),
				// ⛔ Never `--dangerously-skip-permissions`, `--mode`, `--effort` (D32) or `--print-timeout` (D18).
				args: [
					'--agent',
					AGY_EXECUTOR_AGENT,
					'--model',
					turn.modelId,
					'--input-format',
					'stream-json',
					'--output-format',
					'stream-json',
					'--log-file',
					logOf(turn.run, turn.turn),
					'--disable-slash-commands'
				],
				// ⭐ B17 — the turn as one stream-json line; the system prompt is the agent file's body (D15).
				stdin: `${JSON.stringify({ event: 'user', message: { content: turn.userPrompt } })}\n`
			};
		},
		async readRecord(output): Promise<CliRecordReading> {
			const lines = output.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
			if (lines.length === 0) return { read: 'ABSENT' };
			const configured = modelOfTurn.get(output.turn);
			if (configured === undefined)
				throw new Error('The agy driver was asked to read a turn it did not start.');
			let stream: AgyStream;
			let logged: string[];
			try {
				stream = readStream(lines, output.run.serverName);
				// ⛔ B12 — the log, read for its model lines alone: none of its text reaches the reading.
				logged = modelsTheLogNames(
					await readFile(logOf(output.run, output.turn), 'utf8').catch(() => '')
				);
			} catch (e) {
				if (e instanceof UnreadableRecord) return { read: 'UNPARSEABLE', raw: output.stdout };
				throw e;
			}
			const named = [...(stream.initModel === undefined ? [] : [stream.initModel]), ...logged];
			return {
				read: 'PARSED',
				raw: output.stdout,
				// ⛔ B5 — agy's record holds no proof of the tools it offered (see the header).
				surface: undefined,
				events: stream.events,
				reportedModels: [...new Set(named.filter((model) => model !== configured))],
				answer: stream.answer,
				...(stream.errorExcerpt === undefined ? {} : { errorExcerpt: stream.errorExcerpt })
			};
		},
		classifyStderr(lines): CliStderrSignals {
			const error = lines.find((line) => line.startsWith(AGY_ERROR_PREFIX));
			const excerpt = error === undefined ? undefined : shortErrorOf(error);
			return {
				...(excerpt === undefined ? {} : { errorExcerpt: excerpt }),
				...(lines.some((line) => TIME_LIMIT_WARNING.test(line)) ? { timedOut: true } : {})
			};
		}
	};
}
