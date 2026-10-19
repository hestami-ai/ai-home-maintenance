// ⭐⭐ `JAN-MHX` MH-10 (`DESIGN-multi-harness-executor.md` §4.4, D12; the sponsor's answers of 2026-10-18, S4) — THE MUSE
// DRIVER: what differs when Muse 1.4.10 runs headless as a work unit's executor, through the host's own tools
// (`cli-executor-session.ts` does everything the CLIs share).
//
// ⭑ BUILT AS DESIGNED, WITH WHAT MH-10'S PROBES MEASURED WHERE THE DESIGN LEFT A QUESTION OR GUESSED A SPELLING (P1 on
// Muse's echo provider, then P2 and P3 on the operator's Meta login, through a stand-in of the shipping path):
//   · THE PROGRAM is the versioned binary its install's `.muse-version` names, never the `muse.cmd` launcher, which
//     node refuses to start without a shell. A direct start of the binary never updates it; the launcher is what does.
//   · THE MCP ENTRY is `{"command", "args", "framing": "line_delimited_json"}`. Muse refuses the design's spelling: a
//     `"type"` key is "unknown key: no such setting", and `"lineDelimitedJson"` is "the JSON type does not fit this
//     setting". Nor does it take a per-server `tool_timeout_sec`, so D18's 180 s cannot be set per run; P3 measured that
//     Muse waited out a call the host held for 150 s, past the host's own 120 s bound on a command.
//   · THE TOOLSET (`-c run.toolset`) names exactly the minted tools, and it is what takes Muse's own tools away: with it
//     unset, the disable flags alone left 18 of Muse's own tools active (P1h). A name it cannot resolve refuses the run.
//   · THE SESSION LOG IS KEPT, inside a data root of the turn's own (`XDG_DATA_HOME`, in `host/`), in place of the
//     design's `--no-session-log`: it is the only record that names the tools Muse offered its model (D14a). The data root
//     of the turn's own keeps that log and Muse's local tracing out of the operator's own store, which `--no-session-log`
//     alone did not do for the tracing, and keeps the operator's memory out of the turn (D44). ⚠ It goes with the run
//     folder at dispose. Muse's configuration root is not moved: the login is there.
//   · THE PROMPT is the prompt file, the preamble and contract at its head (D15). The only route to Muse's system prompt
//     the probes found is argv (`-c run.system_prompt`), and Muse's echo provider refused it.
//
// ⭑ WHAT IT READS BACK (D20): the session log of the turn's data root, Muse's local tracing beside it, and the JSONL on
// stdout. The surface proof is every `model_request_configured` toolset, with Muse's own count of the tools it registered
// (none deferred, none hosted by the provider) and every MCP tool it saw from the host's server alone. The calls are the
// model's committed tool calls and the tool effects Muse started, in the log's order: a call the model made that Muse
// never started is a refused attempt (D21). The model is every step's `model_completed.model` (D22). The answer is
// stdout's `run.terminal.completed` text; a `run.terminal.failed` reason is an error of a known shape (D19a).
// ⚠ RESIDUALS, STATED: Muse rewrites a call's arguments before it sends them (P3: a string became a one-element list), so
// the record matches the host's by name and order, never by arguments; the host's own transcript is E-1 (D17). How Muse
// records a call it rejects before starting it was not measured: P2 and P3 rejected none. Whether contributor mode and
// telemetry are off in effect is not shown by anything Muse writes locally (D45): the flags are passed, and accepted.
// ⚠ AND WHAT IT SENDS: Muse sends the run folder's paths to its vendor on every step (its workspace and session identity),
// with its own base instructions and context, beside the prompt and every tool result (D45).
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
	CliDriver,
	CliInvocation,
	CliRecordEvent,
	CliRecordReading,
	CliRunFolder,
	CliStderrSignals,
	CliToolRef,
	CliTurnInput,
	CliTurnOutput
} from './cli-executor-session.js';

/**
 * ⭐ D34 — `JPWB_MUSE_BIN`, CAPTURED WHEN THIS MODULE LOADS, as `devin-reviewer.ts` captures `JPWB_DEVIN_BIN`: a program
 * the driver runs in place of the installed one. The executor selector refuses it outside test mode, whatever it names
 * (`EXECUTOR_PROGRAM_OVERRIDDEN`), because the record names Muse whatever program ran (`REG-F-459`).
 */
export const MUSE_BIN_OVERRIDE: string | undefined = process.env.JPWB_MUSE_BIN;

/** What the driver is told of its host. ⭑ A test stands in an install and a home folder of its own. */
export interface MuseDriverHost {
	/** The folder Muse is installed in, `%LOCALAPPDATA%\Programs\muse`, or `undefined` when the host names none. */
	readonly installDirectory: string | undefined;
	/** The user's home folder: Muse's configuration is under its `.config/muse`. */
	readonly home: string;
	/** `JPWB_MUSE_BIN`, as captured. */
	readonly programOverride: string | undefined;
}

/** The host this process runs on. */
function thisHost(): MuseDriverHost {
	const localAppData = process.env.LOCALAPPDATA;
	return {
		installDirectory:
			localAppData === undefined || localAppData === ''
				? undefined
				: join(localAppData, 'Programs', 'muse'),
		home: homedir(),
		programOverride: MUSE_BIN_OVERRIDE
	};
}

/** The release `.muse-version` may name: Muse's own form (`1.4.10-R6427.1`), and so never a path. */
const MUSE_RELEASE = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)?$/;

/** The framing Muse 1.4.10 takes for a stdio server's newline-delimited JSON-RPC (measured: the camel-case form refuses). */
const MCP_FRAMING = 'line_delimited_json';

const OPEN_REFUSED = 'The Muse executor session is refused:';

/**
 * ⭐ §4.4 — the installed binary, by the release its install's `.muse-version` names, as Muse's own launcher finds it.
 * ⛔ IT THROWS, AND SAYS WHY IN WORDS THAT NAME NO PATH: the opener refuses the session with the message, which reaches the
 * record.
 */
function installedProgram(installDirectory: string | undefined): string {
	if (installDirectory === undefined)
		throw new Error(
			`${OPEN_REFUSED} this host names no folder Muse is installed in (LOCALAPPDATA is not set).`
		);
	let release: string;
	try {
		release = readFileSync(join(installDirectory, '.muse-version'), 'utf8').trim();
	} catch (e) {
		throw new Error(
			`${OPEN_REFUSED} its install's version file could not be read ` +
				`(${(e as NodeJS.ErrnoException).code ?? 'no error code'}), so it names no program.`
		);
	}
	if (!MUSE_RELEASE.test(release))
		throw new Error(
			`${OPEN_REFUSED} its install's version file holds no release of the form Muse's take, so it names no program ` +
				'the host will run.'
		);
	return join(installDirectory, `muse-bin-${release}.exe`);
}

/** ⭐ D44 — the turn's own data root, in `host/`: Muse's session log and local tracing for that turn, and nothing else's. */
const dataRootOf = (run: CliRunFolder, turn: number): string =>
	join(run.hostDirectory, `muse-data-${turn}`);

/** Every file under `directory`, or none when it does not exist. */
function filesUnder(directory: string): string[] {
	try {
		return readdirSync(directory, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => join(entry.parentPath, entry.name));
	} catch {
		return [];
	}
}

/** One record of Muse's, as far as the driver reads it. */
interface MuseRecord {
	readonly payload_type?: unknown;
	readonly payload?: {
		readonly event?: Record<string, unknown> & { readonly kind?: unknown };
		readonly record?: Record<string, unknown>;
		readonly entries?: unknown;
		readonly text?: unknown;
		readonly reason?: unknown;
	};
}

/** `raw` as a JSON object, or `undefined` when it is not one. */
function jsonObject(raw: string): Record<string, unknown> | undefined {
	try {
		const value: unknown = JSON.parse(raw);
		return typeof value === 'object' && value !== null && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

/** A retained transaction's records, in their order, or `undefined` when one is not a JSON object. */
function childrenOf(frame: Record<string, unknown>): MuseRecord[] | undefined {
	if (!Array.isArray(frame.children)) return undefined;
	const children: MuseRecord[] = [];
	for (const child of frame.children as { readonly record_json?: unknown }[]) {
		const inner =
			typeof child?.record_json === 'string' ? jsonObject(child.record_json) : undefined;
		if (inner === undefined) return undefined;
		children.push(inner as MuseRecord);
	}
	return children;
}

/**
 * Muse's JSONL, one record per line, each retained transaction's records read in its place (a session log commits some
 * records together, inside one `retained_frame`). `undefined` when any line, or any record, is not a JSON object.
 */
function recordsOf(text: string): MuseRecord[] | undefined {
	const out: MuseRecord[] = [];
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '') continue;
		const record = jsonObject(line);
		if (record === undefined) return undefined;
		const records =
			record.retained_frame === undefined ? [record as MuseRecord] : childrenOf(record);
		if (records === undefined) return undefined;
		out.push(...records);
	}
	return out;
}

/** The run event a session record carries, or `undefined` for a record of another kind. */
const runEvent = (
	record: MuseRecord
): (Record<string, unknown> & { readonly kind?: unknown }) | undefined =>
	record.payload_type === 'runtime.session' ? record.payload?.event : undefined;

/** Every tool Muse's model requests named active, or `undefined` when it configured none, or one names no list of names. */
function activeToolNames(session: readonly MuseRecord[]): Set<string> | undefined {
	const configured = session.map(runEvent).filter((e) => e?.kind === 'model_request_configured');
	if (configured.length === 0) return undefined;
	const names = new Set<string>();
	for (const event of configured) {
		const toolset = event!.toolset as { readonly active_tools?: unknown } | undefined;
		const active = toolset?.active_tools;
		if (!Array.isArray(active) || !active.every((n) => typeof n === 'string')) return undefined;
		for (const name of active as string[]) names.add(name);
	}
	return names;
}

/** Whether one identity catalog of Muse's names only tools of the host's server. */
const catalogIsTheHosts = (entries: unknown, server: string): boolean =>
	Array.isArray(entries) &&
	entries.every((entry) => (entry as { readonly server_name?: unknown })?.server_name === server);

/** Whether every MCP tool Muse saw is the host's server's: the in-turn check that no other server was connected (D14). */
const onlyTheHostsServer = (session: readonly MuseRecord[], server: string): boolean =>
	session.every(
		(record) =>
			record.payload_type !== 'runtime.mcp_tool_identity_catalog' ||
			catalogIsTheHosts(record.payload?.entries, server)
	);

const ACTIVE_COUNT = /\bactive_tool_count=(\d+)\b/;
const DEFERRED_COUNT = /\bdeferred_tool_count=(\d+)\b/;
const HOSTED_COUNT = /\bprovider_hosted_tool_count=(\d+)\b/;

/** The count one of Muse's local-tracing lines gives a field, or `undefined` when it gives none. */
function countIn(line: string, field: RegExp): number | undefined {
	const found = field.exec(line);
	return found === null ? undefined : Number(found[1]);
}

/**
 * Whether Muse's own tracing agrees: at least one line on the tools it registered, and each counting `active` tools
 * active, none deferred and none hosted by the provider — tools no request's list would show.
 */
function tracingAgrees(tracing: readonly string[], active: number): boolean {
	const lines = tracing
		.flatMap((log) => log.split(/\r?\n/))
		.filter((line) => line.includes('event="tool.surface.registered"'));
	if (lines.length === 0) return false;
	return lines.every(
		(line) =>
			countIn(line, ACTIVE_COUNT) === active &&
			countIn(line, DEFERRED_COUNT) === 0 &&
			countIn(line, HOSTED_COUNT) === 0
	);
}

/**
 * ⭐ D14a — THE TOOLS MUSE OFFERED ITS MODEL, or `undefined` when its record does not prove them: every model request it
 * configured names its active tools, every MCP tool it saw is the host's server's, and its own tracing agrees. A tool
 * named `mcp__<server>__<name>` is the host's; any other is Muse's own.
 */
function offeredSurface(
	session: readonly MuseRecord[],
	tracing: readonly string[],
	server: string
): CliToolRef[] | undefined {
	const names = activeToolNames(session);
	if (names === undefined) return undefined;
	if (!onlyTheHostsServer(session, server) || !tracingAgrees(tracing, names.size)) return undefined;
	const prefix = `mcp__${server}__`;
	return [...names].map((name) =>
		name.startsWith(prefix)
			? { party: 'HOST', name: name.slice(prefix.length) }
			: { party: 'OWN', name }
	);
}

/** A call of the host's, by its minted name, or a tool of Muse's own: SENT or RUN when it `happened`, else refused. */
const calledEvent = (name: string, happened: boolean, prefix: string): CliRecordEvent =>
	name.startsWith(prefix)
		? { kind: 'HOST_CALL', name: name.slice(prefix.length), sent: happened }
		: { kind: 'OWN_TOOL', name, ran: happened };

/** The call ids of every tool effect Muse started, or `undefined` when one is not of the measured shape. */
function startedCallIds(session: readonly MuseRecord[]): Set<string> | undefined {
	const ids = new Set<string>();
	for (const record of session) {
		if (record.payload_type !== 'tool_batch.effect.started') continue;
		const started = record.payload?.record;
		if (typeof started?.call_id !== 'string' || typeof started.tool_name !== 'string')
			return undefined;
		ids.add(started.call_id);
	}
	return ids;
}

/** The calls one model step committed, by call id and name, or `undefined` when one is not of the measured shape. */
function committedCallsOf(
	event: Record<string, unknown>
): { readonly callId: string; readonly name: string }[] | undefined {
	if (!Array.isArray(event.tool_calls)) return undefined;
	const calls: { readonly callId: string; readonly name: string }[] = [];
	for (const call of event.tool_calls as {
		readonly call_id?: unknown;
		readonly name?: unknown;
	}[]) {
		if (typeof call?.call_id !== 'string' || typeof call.name !== 'string') return undefined;
		calls.push({ callId: call.call_id, name: call.name });
	}
	return calls;
}

/**
 * ⭐ D21 — THE CALLS, IN THE LOG'S ORDER, or `undefined` when a call or an effect is not of the measured shape. A tool
 * effect Muse started is a call SENT (the host's) or RUN (Muse's own); a call the model committed that Muse never started
 * is a refused attempt, placed where the model made it; an assistant message is the model speaking.
 */
function callsIn(session: readonly MuseRecord[], server: string): CliRecordEvent[] | undefined {
	const started = startedCallIds(session);
	if (started === undefined) return undefined;
	const prefix = `mcp__${server}__`;
	const events: CliRecordEvent[] = [];
	for (const record of session) {
		const event = runEvent(record);
		if (event?.kind === 'assistant_message_committed') events.push({ kind: 'ASSISTANT_MESSAGE' });
		else if (event?.kind === 'assistant_tool_calls_committed') {
			const calls = committedCallsOf(event);
			if (calls === undefined) return undefined;
			for (const call of calls)
				if (!started.has(call.callId)) events.push(calledEvent(call.name, false, prefix));
		} else if (record.payload_type === 'tool_batch.effect.started')
			events.push(calledEvent(record.payload!.record!.tool_name as string, true, prefix));
	}
	return events;
}

/**
 * ⭐ D20 — what Muse's record of one turn says, read whole: the session log of the turn's own data root, its local tracing
 * beside it, and its JSONL on stdout.
 */
function museRecordOf(output: CliTurnOutput): CliRecordReading {
	const root = join(dataRootOf(output.run, output.turn), 'muse');
	const logs = filesUnder(join(root, 'sessions')).filter((path) =>
		/[\\/]session\.jsonl$/.test(path)
	);
	if (logs.length === 0) return { read: 'ABSENT' };
	// ⛔ ONE SESSION PER TURN: a second log in the turn's own root is one the host cannot place.
	const sessionLog = logs.length === 1 ? readFileSync(logs[0]!, 'utf8') : null;
	const raw = JSON.stringify({ stdout: output.stdout, sessionLog });
	if (sessionLog === null) return { read: 'UNPARSEABLE', raw };
	const session = recordsOf(sessionLog);
	const out = recordsOf(output.stdout);
	if (session === undefined || out === undefined) return { read: 'UNPARSEABLE', raw };
	const completed = session.map(runEvent).filter((e) => e?.kind === 'model_completed');
	const models = completed.map((e) => e!.model);
	if (!models.every((m): m is string => typeof m === 'string' && m !== ''))
		return { read: 'UNPARSEABLE', raw };
	const events = callsIn(session, output.run.serverName);
	if (events === undefined) return { read: 'UNPARSEABLE', raw };
	const tracing = filesUnder(join(root, 'local-tracing'))
		.filter((path) => path.endsWith('.log'))
		.map((path) => readFileSync(path, 'utf8'));
	const completedRun = out.filter((r) => r.payload_type === 'run.terminal.completed').at(-1);
	const failedRun = out.filter((r) => r.payload_type === 'run.terminal.failed').at(-1);
	const answer = completedRun?.payload?.text;
	const errorExcerpt = failedRun?.payload?.reason;
	// ⭐ D23 — the reasoning Muse returns as plain text, its summaries; never its encrypted reasoning.
	const summaries = session
		.map(runEvent)
		.filter((e) => e?.kind === 'reasoning_summary_committed')
		.map((e) => e!.text)
		.filter((text): text is string => typeof text === 'string' && text !== '');
	return {
		read: 'PARSED',
		raw,
		surface: offeredSurface(session, tracing, output.run.serverName),
		events,
		reportedModels: models,
		answer: typeof answer === 'string' ? answer : undefined,
		...(summaries.length === 0 ? {} : { volunteeredReasoning: summaries.join('\n\n') }),
		...(typeof errorExcerpt === 'string' ? { errorExcerpt } : {})
	};
}

/** ⭐ D24 — the error lines of a shape Muse is known to write: a `-c` setting it refuses, and a run that ended failed. */
const KNOWN_ERROR_LINES = [/^muse: -c \S+: refusing run: /, /^run ended with Failed: /];

/** ⭐ §4.4 — Muse's driver, on this host unless a test stands another in. */
export function museExecutorDriver(host: MuseDriverHost = thisHost()): CliDriver {
	/** ⭑ Named when the run folder is, once per session: a session whose program cannot be named is refused when it opens. */
	let program: string | undefined;
	const configuration = join(host.home, '.config', 'muse');
	return {
		toolId: 'muse',
		// ⭑ None: Muse offers its model the host's tools directly, as `mcp__jpwb__<name>`.
		carriers: [],
		// ⭐ D44a — the sources Muse reads its configuration from, by `stat` alone; never its login (`auth.json`).
		configSources: [
			{
				name: 'Muse’s settings (.config/muse/settings.json)',
				path: join(configuration, 'settings.json')
			},
			{
				name: 'Muse’s workspace trust (.config/muse/trust.json)',
				path: join(configuration, 'trust.json')
			},
			{ name: 'Muse’s skills (.config/muse/skills)', path: join(configuration, 'skills') },
			...(host.installDirectory === undefined
				? []
				: [
						{
							name: 'Muse’s installed release (.muse-version)',
							path: join(host.installDirectory, '.muse-version')
						},
						{
							name: 'Muse’s release manifest (.muse-release-info.json)',
							path: join(host.installDirectory, '.muse-release-info.json')
						}
					])
		],
		// ⭑ As designed. ⚠ It guards nothing today: Muse's binary names no such variable (its strings, MH-10's probe), and a
		// direct start of the binary never updates it. The launcher, which reads it, is never run.
		environment: { MUSE_NO_AUTO_UPDATE: '1' },
		runFolderFiles: () => {
			program = host.programOverride ?? installedProgram(host.installDirectory);
			return [];
		},
		// ⭑ None: Muse has no command that lists its MCP servers without a run (`muse mcp` only logs in and out), so the
		// identity catalog in each turn's own log is the check that the host's server is the only one (D14, above).
		preflight: () => undefined,
		invocation(turn: CliTurnInput): CliInvocation {
			if (program === undefined)
				throw new Error(
					'The Muse driver was asked for a turn before its run folder named its program.'
				);
			// ⛔ D32 — MUSE TAKES ITS EFFORT AS A FLAG OF ITS OWN: without one its user configuration would decide it.
			if (turn.effort === undefined)
				throw new Error(
					'The Muse executor was handed no effort, and Muse would take its own configuration’s.'
				);
			const server = turn.run.serverName;
			const toolset = turn.run.mintedToolNames.map((name) => `mcp__${server}__${name}`);
			return {
				program,
				args: [
					'exec',
					'--provider',
					'meta',
					'--model',
					turn.modelId,
					'--reasoning-effort',
					turn.effort,
					'--prompt-file',
					turn.promptPath,
					'--json',
					'--disable-shell',
					'--disable-write',
					'--disable-web-tools',
					'--disable-reminders',
					'--disable-request-user-input',
					'--no-foreign-personal-context',
					'--approval-mode',
					'never',
					// ⭑ The approval judge is a model call of its own.
					'--approval-judge',
					'off',
					'--contributor-mode',
					'off',
					// ⭐ D5 — one call at a time, in the order the model meant. ⚠ Not yet run on the Meta provider.
					'--no-parallel-tool-calls',
					'-c',
					'telemetry.enabled=false',
					'-c',
					`run.toolset=${JSON.stringify(toolset)}`,
					'-c',
					`mcpServers.${server}=${JSON.stringify({
						command: turn.run.nodePath,
						args: [turn.run.bridgePath, turn.run.endpointPath],
						framing: MCP_FRAMING
					})}`
				],
				environment: { XDG_DATA_HOME: dataRootOf(turn.run, turn.turn) }
			};
		},
		readRecord: (output) => Promise.resolve(museRecordOf(output)),
		classifyStderr(lines: readonly string[]): CliStderrSignals {
			// ⭑ Muse names the run's working folder on every run ("muse: workspace root: …"): a line of no known shape, so it
			// never reaches a message.
			const known = lines.find((line) => KNOWN_ERROR_LINES.some((shape) => shape.test(line)));
			return known === undefined ? {} : { errorExcerpt: known };
		}
	};
}
