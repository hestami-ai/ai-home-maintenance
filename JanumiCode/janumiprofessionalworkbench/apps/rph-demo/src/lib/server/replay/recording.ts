// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1; `REG-D-111` (5); `REG-F-530`) — THE REPLAY'S RECORDING:
// what a paid run leaves for CI to replay at no cost, as one folder of four files.
//
//   recording.json   the commit, the reviewer fingerprint, the PWA-content digest, the models, the scrub's token kinds,
//                    and the expected stage matrix (the run report's cells: stage, row, value);
//   executor.jsonl   one line per EXECUTOR TRY, in dispatch order: the unit, `turnSha256` (over the scrubbed turn text),
//                    the tool calls in the order the model made them, with their arguments and what the host observed
//                    of each, the answer, and the producer;
//   commands.jsonl   one line per command the REAL runner was asked to run, in the order it was asked: the argv and the
//                    recorded outcome — exit, timedOut, durationMs, outputComplete, the declared omissions, and the
//                    capture's bytes (stdout, stderr) — or the refusal it gave;
//   reviewer.jsonl   one line per REVIEWER CALL, in dispatch order: the unit, the framing, the role, `promptSha256` (over
//                    the scrubbed prompt), the prompt's own bytes, the reply (ANSWERED / NOT_RETAINED / NO_ANSWER_SPAN /
//                    THROWN with its sanitised message), the evaluator, and the call's ELAPSED time.
//
// ⛔ ALL THREE MUST REPLAY (`REG-F-530`): a replay of the executor alone either pays the reviewer and runs real commands,
// or reviews with the stand-in and stops at the first unit. So the recording holds the reviewer's answers and the
// commands' results beside the executor's turns, and the replay serves each from here (`replay-run.ts`).
//
// ⛔ SCRUBBED BEFORE IT IS WRITTEN, AND HASHED OVER THE SCRUBBED BYTES (`REG-F-536`). Every executor prompt carries the
// host's absolute workspace path, which names the operator's account, and a command's output can carry it too. The
// recorder (`scripts/phase7/record-replay.ts`) replaces the run's own directories by TOKENS (`scrubPairs`), and every
// hash in the recording is taken over the scrubbed text. The replay scrubs ITS OWN directories to the same tokens before
// it hashes, so a recorded prompt and a replayed one compare equal exactly when they differ only in where they ran.
// ⚠ A path the scrub does not know — a home folder in a stack trace — is not scrubbed: the recorder's archive scan
// refuses the recording instead (`archive-scan.ts`), so what cannot be scrubbed is never written.
//
// ── ⛔ `REG-Q-066` — THE RECORDING CARRIES A COMMAND'S stderr, AND THIS IS ITS DISPOSITION ──────────────────────────────
// `commands.jsonl` holds each command's captured stdout AND stderr (D1): commands are replayed, never re-run, so the
// bytes a review was shown must be written back exactly. They are the recorded run's own capture (`PURGEABLE_AT_EXPIRY`,
// `child-process-runner.ts`) and its evidence's mint (`RETAINED_BY_PARTICIPATION`, `R16`); what the recording adds is a
// COMMITTED copy. ⭑ The recorder writes it only scrubbed of the run's directories, and refuses on any archive-scan hit —
// the account name or an absolute path (`REG-F-536`). ⚠ THE RESIDUAL IS LARGER THAN THE STORES', AND IT IS STATED: the
// scan cannot see a secret a command read from disk and printed, and a committed file has no purge — git history is its
// removal path. `verif/agy-stderr-unbound.test.ts` lists this module among the disposed sites, for this paragraph.
//
// ⭑ THE FORMAT LIVES IN THE PRODUCT, NOT IN THE RECORDER, because the product READS it: the replay arms open a recording
// under `JPWB_REPLAY` in test mode (`replay-switch.ts`). The recorder writes through `recordingFiles` and every reader
// reads through `readRecording`, so the two cannot disagree about a field.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { ProcessOutputOmission } from '@janumipwb/rph-ports';

/** The format's own name and version. ⛔ A reader refuses any other: a recording of another shape replays another run. */
export const RECORDING_FORMAT = 'jpwb-replay-recording/1';

/** The four files, by role. */
export const RECORDING_FILES = {
	manifest: 'recording.json',
	executor: 'executor.jsonl',
	commands: 'commands.jsonl',
	reviewer: 'reviewer.jsonl'
} as const;

/**
 * The directories a run's text names, each replaced by a token. ⭑ The two the run's own bytes can carry: the
 * Undertaking's deliverable workspace, which Pi prints into every executor prompt (`REG-F-536`) and a test runner prints
 * into its output, and the process-output workspace beside it (`workspace-host.ts`) — ⭐ and the HOME folder of the
 * account the run ran as, which a tool's failure prints (devin's prompt and export files live under its temp folder, in
 * P3's thrown reviewer call) and which names the account itself.
 */
export type ScrubPlace = 'WORKSPACE' | 'PROCESS_OUTPUT' | 'HOME';

const PLACES: readonly ScrubPlace[] = ['WORKSPACE', 'PROCESS_OUTPUT', 'HOME'];

/**
 * How a path is spelled in text. ⭑ THREE, BECAUSE THE RUN WRITES THREE: the host's own (`\` on Windows), the forward-slash
 * form Pi prints the working directory in, and the JSON-escaped form (each `\` doubled) a record that holds JSON keeps.
 * Each has its own token, so expanding a token gives back the very spelling it replaced.
 */
export type ScrubSpelling = 'native' | 'posix' | 'json';

const SPELLINGS: readonly ScrubSpelling[] = ['json', 'native', 'posix'];

/**
 * The token one place in one spelling is replaced by: `JPWB_REPLAY_<PLACE>_<SPELLING>`, e.g. `JPWB_REPLAY_WORKSPACE_NATIVE`.
 * ⛔ IT ENDS IN A WORD CHARACTER, ON PURPOSE, AND NO TOKEN IS ANOTHER'S PREFIX. The archive scan (`archive-scan.ts`) reads a
 * separator after a non-word character as the start of an absolute path: a token closed by `}` made every path relative
 * to it — `{{HOME}}\AppData\…` in a JSON line — read as a UNC path, and refused the recording it was there to make
 * committable (driven on this test's own fixture). After a word character the scan's lookbehinds hold, and a token
 * is never mistaken for the start of a path. Distinct final words keep `expandText`'s plain `replaceAll` exact.
 */
export const scrubToken = (place: ScrubPlace, spelling: ScrubSpelling): string =>
	`JPWB_REPLAY_${place}_${spelling.toUpperCase()}`;

/** Every token a recording can carry, in a stable order: what `recording.json` lists as its scrub's token kinds. */
export const SCRUB_TOKENS: readonly string[] = PLACES.flatMap((place) =>
	SPELLINGS.map((spelling) => scrubToken(place, spelling))
);

/** One literal spelling and the token that stands for it. */
export interface ScrubPair {
	readonly literal: string;
	readonly token: string;
}

/**
 * ⭐ THE SCRUB'S PAIRS for a run's own directories — every spelling of each, LONGEST FIRST, so a path that another
 * contains (the workspace inside its own `.process-output` sibling's name, or inside the home folder) is never replaced
 * before the longer one.
 * ⚠ On a host where two spellings coincide (POSIX: native is posix), the first token in `SPELLINGS`'s order keeps the
 * literal and the other is kept for EXPANSION only (`expandText`), so a recording made on either host reads on either.
 * ⛔ A PLACE THAT IS EMPTY OR A FILESYSTEM ROOT IS LEFT OUT: `/` as a home would replace every separator in the text.
 */
export function scrubPairs(
	places: Readonly<Partial<Record<ScrubPlace, string>>>
): readonly ScrubPair[] {
	const pairs: ScrubPair[] = [];
	for (const place of PLACES) {
		const native = places[place] ?? '';
		if (native === '' || dirname(native) === native) continue;
		const posix = native.replaceAll('\\', '/');
		const json = native.replaceAll('\\', '\\\\');
		const spelled: Readonly<Record<ScrubSpelling, string>> = { native, posix, json };
		for (const spelling of SPELLINGS)
			pairs.push({ literal: spelled[spelling], token: scrubToken(place, spelling) });
	}
	return pairs.sort((a, b) => b.literal.length - a.literal.length);
}

/** `text` with each literal replaced by its token — longest literal first (`scrubPairs`'s order). */
export function scrubText(text: string, pairs: readonly ScrubPair[]): string {
	let out = text;
	for (const { literal, token } of pairs) if (literal !== '') out = out.replaceAll(literal, token);
	return out;
}

/** `text` with each token replaced by the literal it stands for: `scrubText`'s inverse, for this host's directories. */
export function expandText(text: string, pairs: readonly ScrubPair[]): string {
	let out = text;
	for (const { literal, token } of pairs) out = out.replaceAll(token, literal);
	return out;
}

/** SHA-256 of `text`'s UTF-8 bytes, as lower-case hex — every hash a recording holds. */
export const sha256Hex = (text: string): string =>
	createHash('sha256').update(text, 'utf8').digest('hex');

/** Who answered: the identity the run's record named for a call. */
export interface RecordedIdentity {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

/** One cell of the run report's stage matrix (`run-report-core.ts`, `MatrixCell`), as the recording expects it. */
export interface RecordedCell {
	readonly stage: string;
	readonly row: string;
	/** One of §1's five values, or null where the report could not decide the cell. */
	readonly value: string | null;
}

export interface RecordingManifest {
	readonly format: typeof RECORDING_FORMAT;
	/** The commit the recorded run ran on. */
	readonly commit: string;
	/** The reviewer fingerprint (`scripts/reviewer-qual/fingerprint.ts`) the recorded run's reviewer was qualified at. */
	readonly reviewerFingerprint: string;
	/** SHA-256 of the published PWA's declared content (`record-replay.ts`, `pwaContentDigest`). */
	readonly pwaContentDigest: string;
	readonly models: {
		readonly executor: RecordedIdentity;
		/**
		 * ⭐ AND THE BOUND THE REVIEWING TOOL WAS HELD TO (`REVIEWER_CALL_BOUND_MS`): with the recorded elapsed time, it is
		 * what decides whether a call that threw is run once more — so a retry replays exactly where it happened. Null when
		 * the recorded reviewer declared none, and then no thrown call is run again.
		 */
		readonly reviewer: RecordedIdentity & { readonly callBoundMs: number | null };
	};
	/** The scrub's token kinds (`SCRUB_TOKENS`): what the recording's text may carry in place of a run's path. */
	readonly scrub: { readonly tokens: readonly string[] };
	readonly expectedMatrix: readonly RecordedCell[];
}

/** What the host observed of a call (`AdapterToolCall['outcome']`). */
export type RecordedToolOutcome = 'COMPLETED' | 'REFUSED' | 'FAILED' | 'UNKNOWN';
const TOOL_OUTCOMES: ReadonlySet<unknown> = new Set<RecordedToolOutcome>([
	'COMPLETED',
	'REFUSED',
	'FAILED',
	'UNKNOWN'
]);

export interface RecordedToolCall {
	readonly name: string;
	/** The arguments the model gave, scrubbed. */
	readonly arguments: Readonly<Record<string, unknown>>;
	/** What the host observed happen to the call in the recorded run — the replay must observe the same. */
	readonly outcome: RecordedToolOutcome;
}

/** The turn's answer, or why none arrived (`AdapterAnswer`'s shape, so the replay hands back what the run's adapter did). */
export type RecordedAnswer =
	| { readonly arrived: true; readonly text: string }
	| {
			readonly arrived: false;
			readonly cause: 'CALL_FAILED' | 'CALL_ABORTED' | 'ENDED_WITHOUT_ANSWER';
			readonly message?: string;
	  };

export interface ExecutorTry {
	/** The unit the try was for, by its slug or id as the recorder names it: what a REPLAY_STALE names. */
	readonly unit: string;
	/** SHA-256 of the scrubbed turn text — what the replay checks the turn it is sent against. */
	readonly turnSha256: string;
	/** ⛔ IN THE ORDER THE MODEL MADE THEM, and replayed one at a time in it (`REG-F-518`). */
	readonly toolCalls: readonly RecordedToolCall[];
	readonly answer: RecordedAnswer;
	readonly producer: RecordedIdentity;
}

export type RecordedCommand =
	| {
			readonly argv: readonly string[];
			readonly ran: true;
			readonly exitCode: number | null;
			readonly timedOut: boolean;
			readonly durationMs: number;
			readonly outputComplete: boolean;
			readonly omissions: readonly ProcessOutputOmission[];
			readonly stdout: string;
			readonly stderr: string;
	  }
	| { readonly argv: readonly string[]; readonly ran: false; readonly refusedBecause: string };

/**
 * A reviewer call's reply, in each retention form a record can hold — the qualification record's forms
 * (`scripts/reviewer-qual/record.ts`, `CallReply`), with THROWN for a call whose `print` threw.
 * ⭐ THROWN CARRIES THE TOOL'S OWN MESSAGE, before the validator's seam sanitised it: the replay throws it again and the
 * seam sanitises it again (`sanitiseToolFailure`), so the record of the replayed call says what the recorded one said.
 */
export type RecordedReply =
	| { readonly status: 'ANSWERED'; readonly text: string }
	| { readonly status: 'NOT_RETAINED' }
	| { readonly status: 'NO_ANSWER_SPAN'; readonly parses: boolean }
	| { readonly status: 'THROWN'; readonly message: string };

export type RecordedRole = 'initial' | 'repair' | 'retry';
const ROLES: ReadonlySet<unknown> = new Set<RecordedRole>(['initial', 'repair', 'retry']);

export interface ReviewerCall {
	/** The unit the reviewed subject belongs to, when the recorder could name one. */
	readonly unit: string | null;
	/** What was reviewed: `work-product`, `command`, `pwa`, … — the recorder's reading of the subject. */
	readonly framing: string;
	readonly role: RecordedRole;
	/** SHA-256 of the scrubbed prompt. */
	readonly promptSha256: string;
	/** The prompt's own bytes, scrubbed — for a person diagnosing a stale call, never compared by the replay. */
	readonly prompt: string;
	readonly reply: RecordedReply;
	readonly evaluator: RecordedIdentity;
	/** ⭐ The call's ELAPSED time in ms: replayed through the validator's clock, so a retry happens where it happened. */
	readonly elapsedMs: number;
}

export interface Recording {
	readonly manifest: RecordingManifest;
	readonly executor: readonly ExecutorTry[];
	readonly commands: readonly RecordedCommand[];
	readonly reviewer: readonly ReviewerCall[];
}

/**
 * ⛔ Why a folder is not a recording this replay can read: the file and line, and what is wrong there. Its message opens
 * with its code, so a floor or a step that records it says which refusal it was.
 */
export class RecordingRefusal extends Error {
	readonly code = 'REPLAY_RECORDING_REFUSED';
	constructor(detail: string) {
		super(`REPLAY_RECORDING_REFUSED: ${detail}`);
	}
}

function refuse(where: string, what: string): never {
	throw new RecordingRefusal(`the recording is refused: ${where} ${what}`);
}

type Json = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is Json =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function field<T>(
	o: Json,
	key: string,
	where: string,
	check: (v: unknown) => v is T,
	kind: string
): T {
	const v = o[key];
	if (!check(v)) refuse(where, `has no ${kind} \`${key}\``);
	return v as T;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isHex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

function identity(v: unknown, where: string): RecordedIdentity {
	if (!isRecord(v)) return refuse(where, 'has no identity object');
	return {
		agentId: field(v, 'agentId', where, isString, 'string'),
		modelId: field(v, 'modelId', where, isString, 'string'),
		providerId: field(v, 'providerId', where, isString, 'string')
	};
}

function manifestOf(v: unknown, where: string): RecordingManifest {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	if (v.format !== RECORDING_FORMAT)
		refuse(
			where,
			`names the format ${JSON.stringify(v.format)}, not ${RECORDING_FORMAT}: a recording of another shape replays another run`
		);
	const models = isRecord(v.models) ? v.models : refuse(where, 'has no `models`');
	const reviewer = isRecord(models.reviewer)
		? models.reviewer
		: refuse(where, 'has no `models.reviewer`');
	const bound = reviewer.callBoundMs;
	if (bound !== null && !isCount(bound))
		refuse(where, 'has a `models.reviewer.callBoundMs` that is neither a count nor null');
	const scrub = isRecord(v.scrub) ? v.scrub : refuse(where, 'has no `scrub`');
	const tokens = field(scrub, 'tokens', where, isStringArray, 'string list');
	const known = new Set(SCRUB_TOKENS);
	const unknown = tokens.filter((t) => !known.has(t));
	if (unknown.length > 0)
		refuse(where, `lists scrub tokens this replay does not know: ${unknown.join(', ')}`);
	const matrix = Array.isArray(v.expectedMatrix)
		? v.expectedMatrix
		: refuse(where, 'has no `expectedMatrix` list');
	return {
		format: RECORDING_FORMAT,
		commit: field(v, 'commit', where, isString, 'string'),
		reviewerFingerprint: field(v, 'reviewerFingerprint', where, isString, 'string'),
		pwaContentDigest: field(v, 'pwaContentDigest', where, isString, 'string'),
		models: {
			executor: identity(models.executor, `${where} models.executor`),
			reviewer: {
				...identity(reviewer, `${where} models.reviewer`),
				callBoundMs: bound as number | null
			}
		},
		scrub: { tokens },
		expectedMatrix: matrix.map((c, i) => {
			const at = `${where} expectedMatrix[${i}]`;
			if (!isRecord(c)) return refuse(at, 'is not an object');
			if (c.value !== null && !isString(c.value))
				refuse(at, 'has a `value` that is neither a string nor null');
			return {
				stage: field(c, 'stage', at, isString, 'string'),
				row: field(c, 'row', at, isString, 'string'),
				value: c.value as string | null
			};
		})
	};
}

function answerOf(v: unknown, where: string): RecordedAnswer {
	if (!isRecord(v)) return refuse(where, 'has no `answer` object');
	if (v.arrived === true)
		return { arrived: true, text: field(v, 'text', where, isString, 'string') };
	if (v.arrived !== false) return refuse(where, 'has an `answer` that neither arrived nor did not');
	const cause = v.cause;
	if (cause !== 'CALL_FAILED' && cause !== 'CALL_ABORTED' && cause !== 'ENDED_WITHOUT_ANSWER')
		return refuse(where, 'has an `answer.cause` this replay does not know');
	if (v.message !== undefined && !isString(v.message))
		refuse(where, 'has an `answer.message` that is not a string');
	return { arrived: false, cause, ...(isString(v.message) ? { message: v.message } : {}) };
}

function executorTryOf(v: unknown, where: string): ExecutorTry {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	const calls = Array.isArray(v.toolCalls) ? v.toolCalls : refuse(where, 'has no `toolCalls` list');
	return {
		unit: field(v, 'unit', where, isString, 'string'),
		turnSha256: field(v, 'turnSha256', where, isHex64, 'SHA-256'),
		toolCalls: calls.map((c, i) => {
			const at = `${where} toolCalls[${i}]`;
			if (!isRecord(c)) return refuse(at, 'is not an object');
			const outcome = c.outcome;
			if (!TOOL_OUTCOMES.has(outcome)) refuse(at, 'has no known `outcome`');
			return {
				name: field(c, 'name', at, isString, 'string'),
				arguments: field(c, 'arguments', at, isRecord, 'object'),
				outcome: outcome as RecordedToolOutcome
			};
		}),
		answer: answerOf(v.answer, where),
		producer: identity(v.producer, `${where} producer`)
	};
}

function omissionsOf(v: unknown, where: string): ProcessOutputOmission[] {
	if (!Array.isArray(v)) return refuse(where, 'has no `omissions` list');
	return v.map((o, i) => {
		const at = `${where} omissions[${i}]`;
		if (!isRecord(o) || (o.stream !== 'STDOUT' && o.stream !== 'STDERR'))
			return refuse(at, 'names no stream');
		return {
			stream: o.stream,
			reason: field(o, 'reason', at, isString, 'string'),
			byteSize: field(o, 'byteSize', at, isCount, 'count'),
			byteOffset: field(o, 'byteOffset', at, isCount, 'count')
		};
	});
}

function commandOf(v: unknown, where: string): RecordedCommand {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	const argv = field(v, 'argv', where, isStringArray, 'string list');
	if (v.ran === false)
		return {
			argv,
			ran: false,
			refusedBecause: field(v, 'refusedBecause', where, isString, 'string')
		};
	if (v.ran !== true) return refuse(where, 'neither ran nor was refused');
	const exitCode = v.exitCode;
	if (exitCode !== null && !(typeof exitCode === 'number' && Number.isInteger(exitCode)))
		refuse(where, 'has an `exitCode` that is neither an integer nor null');
	return {
		argv,
		ran: true,
		exitCode: exitCode as number | null,
		timedOut: field(v, 'timedOut', where, isBoolean, 'boolean'),
		durationMs: field(v, 'durationMs', where, isCount, 'count'),
		outputComplete: field(v, 'outputComplete', where, isBoolean, 'boolean'),
		omissions: omissionsOf(v.omissions, where),
		stdout: field(v, 'stdout', where, isString, 'string'),
		stderr: field(v, 'stderr', where, isString, 'string')
	};
}

function replyOf(v: unknown, where: string): RecordedReply {
	if (!isRecord(v)) return refuse(where, 'has no `reply` object');
	switch (v.status) {
		case 'ANSWERED':
			return { status: 'ANSWERED', text: field(v, 'text', where, isString, 'string') };
		case 'NOT_RETAINED':
			return { status: 'NOT_RETAINED' };
		case 'NO_ANSWER_SPAN':
			return { status: 'NO_ANSWER_SPAN', parses: field(v, 'parses', where, isBoolean, 'boolean') };
		case 'THROWN':
			return { status: 'THROWN', message: field(v, 'message', where, isString, 'string') };
		default:
			return refuse(where, 'has a `reply.status` this replay does not know');
	}
}

function reviewerCallOf(v: unknown, where: string): ReviewerCall {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	if (v.unit !== null && !isString(v.unit))
		refuse(where, 'has a `unit` that is neither a string nor null');
	if (!ROLES.has(v.role)) refuse(where, 'has no known `role`');
	return {
		unit: v.unit as string | null,
		framing: field(v, 'framing', where, isString, 'string'),
		role: v.role as RecordedRole,
		promptSha256: field(v, 'promptSha256', where, isHex64, 'SHA-256'),
		prompt: field(v, 'prompt', where, isString, 'string'),
		reply: replyOf(v.reply, where),
		evaluator: identity(v.evaluator, `${where} evaluator`),
		elapsedMs: field(v, 'elapsedMs', where, isCount, 'count')
	};
}

/** One `.jsonl` file's lines, each parsed by `of`, each refusal naming its file and line. */
function linesOf<T>(dir: string, file: string, of: (v: unknown, where: string) => T): T[] {
	const path = join(dir, file);
	if (!existsSync(path)) return refuse(file, 'is absent');
	const out: T[] = [];
	const lines = readFileSync(path, 'utf8').split('\n');
	lines.forEach((line, i) => {
		if (line.trim() === '') return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			refuse(`${file}:${i + 1}`, 'is not one JSON value');
		}
		out.push(of(parsed, `${file}:${i + 1}`));
	});
	return out;
}

/**
 * ⭐ READ A RECORDING, WHOLE, OR REFUSE IT. Every field of every line is checked against the shape above, and a refusal
 * names the file, the line and the field — so a replay never starts on half a recording and fails at the call it could
 * not read.
 * ⛔ THE FOLDER MUST BE ABSOLUTE: a relative one resolves against whichever process reads it (the test runner's folder or
 * the server's), and the two would read two recordings.
 */
export function readRecording(dir: string): Recording {
	if (!isAbsolute(dir))
		return refuse(
			'its folder',
			`'${dir}' is not absolute, so it would be read relative to whichever process opened it`
		);
	if (!existsSync(dir) || !statSync(dir).isDirectory())
		return refuse('its folder', 'does not exist');
	const manifestPath = join(dir, RECORDING_FILES.manifest);
	if (!existsSync(manifestPath)) return refuse(RECORDING_FILES.manifest, 'is absent');
	let manifest: unknown;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	} catch {
		refuse(RECORDING_FILES.manifest, 'is not one JSON value');
	}
	return {
		manifest: manifestOf(manifest, RECORDING_FILES.manifest),
		executor: linesOf(dir, RECORDING_FILES.executor, executorTryOf),
		commands: linesOf(dir, RECORDING_FILES.commands, commandOf),
		reviewer: linesOf(dir, RECORDING_FILES.reviewer, reviewerCallOf)
	};
}

/**
 * ⭐ A RECORDING AS ITS FOUR FILES' TEXT — the one serialisation, so the recorder and a test that constructs a recording
 * write the same bytes. The manifest is tab-indented JSON; each `.jsonl` line is one JSON value, in order, newline-ended.
 */
export function recordingFiles(recording: Recording): Readonly<Record<string, string>> {
	const jsonl = (rows: readonly unknown[]): string =>
		rows.map((r) => `${JSON.stringify(r)}\n`).join('');
	return {
		[RECORDING_FILES.manifest]: `${JSON.stringify(recording.manifest, null, '\t')}\n`,
		[RECORDING_FILES.executor]: jsonl(recording.executor),
		[RECORDING_FILES.commands]: jsonl(recording.commands),
		[RECORDING_FILES.reviewer]: jsonl(recording.reviewer)
	};
}
