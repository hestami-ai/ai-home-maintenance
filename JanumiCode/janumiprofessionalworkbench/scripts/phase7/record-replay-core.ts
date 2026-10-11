// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1, D4; `REG-D-111` (5); `REG-F-530`; `REG-F-536`) — THE
// RECORDER'S DECISIONS: a final archive's rows, read by the run report's readers, into a REPLAY RECORDING
// (`apps/rph-demo/src/lib/server/replay/recording.ts`) — scrubbed, hashed over the scrubbed bytes, and checked.
// `record-replay.ts` reads and writes; this decides, and is pure but for `verifyWrites`, which writes into a scratch folder.
//
// ── ⭑ WHERE EACH PART OF THE RECORDING COMES FROM ─────────────────────────────────────────────────────────────────────
//   · EXECUTOR TRIES — the EXECUTION plane's `MODEL_EXCHANGE`s, in the order they were requested. A try's materialized
//     input is the provider payload Pi sent last (`pi-executor.ts`: the composite, every message of the turn): its last
//     user message is the TURN TEXT, and every `function_call` after it is a TOOL CALL, with its arguments, in the order
//     the model made them. The host's own observation (`observedToolCalls`) gives each call's outcome, paired by position.
//     ⚠ INFERRED, AS `REG-F-530` SAYS: the record names tool calls and their outcomes only, so `write_file`'s contents
//     exist only in that payload — which is why `verifyWrites` replays every write and holds the result to each unit
//     archive's workspace tree.
//   · COMMANDS — each `run_command` call that reached the runner, in call order: its argv, the EVIDENCE its run became
//     (exit, timedOut, duration, the capture's paths), the capture's own bytes from the archive's `process-output`, and
//     `outputComplete` from the tool's structured result. A call the runner refused is recorded as that refusal.
//   · REVIEWER CALLS — the ASSURANCE plane's `MODEL_EXCHANGE`s, in the order they were requested: the prompt (its
//     materialized input), the reply (its retained raw output; a call that threw, its cause, as the tool printed it), the
//     evaluator, and the ELAPSED time (`respondedAt` − `requestedAt`).
//   · THE MATRIX — the run report's own (`lane/report/report.json`): the recording expects the run it records.
// ⛔ ANYTHING THAT CANNOT BE READ AS ABOVE IS A PROBLEM, AND A RECORDING WITH ONE IS NEVER WRITTEN: a replay of half a run
// is another run.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	expandText,
	RECORDING_FORMAT,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	type ExecutorTry,
	type RecordedAnswer,
	type RecordedCell,
	type RecordedCommand,
	type RecordedIdentity,
	type RecordedReply,
	type RecordedRole,
	type RecordedToolOutcome,
	type Recording,
	type ReviewerCall,
	type ScrubPair
} from '../../apps/rph-demo/src/lib/server/replay/recording.js';
import { workspaceTreeSha256 } from './node-tests.js';
import type { StoredObject, StoreRows } from './run-report-core.js';

/**
 * ⭑ EACH REVIEWING TOOL'S BOUND, BY ITS AGENT ID — restated from the validator (`reasoning-review-validator.ts`,
 * `REVIEWER_CALL_BOUND_MS`), which this script does not load: `verif/phase7-record-replay.test.ts` holds the two equal.
 * The recording carries the bound so the replay's validator holds a thrown call to the bound the run held it to.
 */
export const RECORDED_CALL_BOUND_MS: Readonly<Record<string, number>> = Object.freeze({
	devin: 240_000,
	agy: 180_000
});

/** One run unit, as the lane's `run.json` names it. */
export interface RecorderUnit {
	readonly slug: string;
	readonly unitId: string;
	readonly archive: string;
}

/** One capture folder's three files, from the final archive's `process-output/captures/<id>/`. */
export interface ArchivedCapture {
	readonly stdout: string;
	readonly stderr: string;
	/** `omissions.json`, parsed. */
	readonly omissions: unknown;
}

export interface RecorderInput {
	readonly store: StoreRows;
	/** The content store's bytes, by storage key. */
	readonly content: ReadonlyMap<string, string>;
	readonly units: readonly RecorderUnit[];
	/** The run's deliverable workspace directory, spelled as the run's host spelled it (`workspace-host.ts`). */
	readonly workspace: string;
	/** The home folder of the account that ran it — scrubbed as `JPWB_REPLAY_HOME_NATIVE`. */
	readonly home: string;
	/** Capture folders by their workspace-relative directory, `captures/<id>`. */
	readonly captures: ReadonlyMap<string, ArchivedCapture>;
	readonly expectedMatrix: readonly RecordedCell[];
	readonly commit: string;
	readonly reviewerFingerprint: string;
}

export interface RecorderOutput {
	/** The recording, or null when a problem stopped it. */
	readonly recording: Recording | null;
	readonly problems: readonly string[];
	/** The run's own scrub, for `verifyWrites` (which writes with the run's paths, so a tree hash compares). */
	readonly pairs: readonly ScrubPair[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const rec = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
const byRequest = (a: StoredObject, b: StoredObject): number =>
	Date.parse(str(a.state.requestedAt)) - Date.parse(str(b.state.requestedAt)) ||
	a.firstSequence - b.firstSequence;

/** The stored bytes a ref names, or undefined when it names none the archive holds. */
function contentOf(ref: unknown, content: ReadonlyMap<string, string>): string | undefined {
	const r = rec(ref);
	return r.status === 'STORED' ? content.get(str(r.storageKey)) : undefined;
}

/** Every string inside `value`, scrubbed — a tool call's arguments as the recording keeps them. */
function scrubValue(value: unknown, pairs: readonly ScrubPair[]): unknown {
	if (typeof value === 'string') return scrubText(value, pairs);
	if (Array.isArray(value)) return value.map((v) => scrubValue(v, pairs));
	if (typeof value === 'object' && value !== null)
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v, pairs)]));
	return value;
}

/** The text of a provider-payload message's content: its `input_text`/`text` parts, joined. */
function messageText(item: Record<string, unknown>): string {
	const content = item.content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content.map((part) => str(rec(part).text)).join('');
}

const OUTCOMES: ReadonlySet<string> = new Set(['COMPLETED', 'REFUSED', 'FAILED', 'UNKNOWN']);

/** One `function_call` of the composite, with the output the host gave it. */
interface PayloadCall {
	readonly name: string;
	readonly arguments: Record<string, unknown>;
	readonly output: string;
}

/** The turn text and the turn's calls, from one EXECUTION exchange's composite payload — or why they cannot be read. */
function turnOf(
	payload: string | undefined
): { readonly text: string; readonly calls: readonly PayloadCall[] } | string {
	if (payload === undefined)
		return 'its materialized input is not retained, so its turn and tool calls cannot be read';
	let composite: Record<string, unknown>;
	try {
		composite = rec(JSON.parse(payload));
	} catch {
		return 'its materialized input is not the provider payload (not JSON), so its tool calls cannot be read';
	}
	const items = Array.isArray(composite.input) ? composite.input.map(rec) : undefined;
	if (items === undefined)
		return 'its materialized input carries no `input` list, so its tool calls cannot be read';
	const lastUser = items.map((i) => i.role).lastIndexOf('user');
	if (lastUser < 0)
		return 'its materialized input holds no user message, so its turn text cannot be read';
	const outputs = new Map(
		items
			.filter((i) => i.type === 'function_call_output')
			.map((i) => [str(i.call_id), str(i.output)] as const)
	);
	const calls: PayloadCall[] = [];
	for (const item of items.slice(lastUser + 1).filter((i) => i.type === 'function_call')) {
		let args: unknown;
		try {
			args = JSON.parse(str(item.arguments));
		} catch {
			return `its call to ${str(item.name)} carries arguments that are not JSON`;
		}
		calls.push({
			name: str(item.name),
			arguments: rec(args),
			output: outputs.get(str(item.call_id)) ?? ''
		});
	}
	return { text: messageText(items[lastUser]!), calls };
}

/** The host's observed outcome of each call of a try, in start order (`observedToolCalls`), or why there is none. */
function observedOutcomes(x: StoredObject): readonly RecordedToolOutcome[] | string {
	const observed = rec(x.state.observedToolCalls);
	if (observed.observation === 'NONE_OBSERVED') return [];
	if (observed.observation !== 'OBSERVED')
		return `its record observed no tool calls (${str(observed.observation) || 'nothing'})`;
	const calls = Array.isArray(observed.calls) ? observed.calls.map(rec) : [];
	const observedCount = typeof observed.observedCount === 'number' ? observed.observedCount : -1;
	if (observedCount !== calls.length)
		return `its record names ${calls.length} of ${observedCount} observed calls (the record's cap)`;
	const outcomes = calls.map((c) => str(c.outcome));
	return outcomes.every((o) => OUTCOMES.has(o))
		? (outcomes as RecordedToolOutcome[])
		: 'its record names an unknown outcome';
}

/** The structured result a tool's output text ends with (`toPiToolResult`), parsed, or {} when it has none. */
function structuredResult(output: string): Record<string, unknown> {
	const at = output.lastIndexOf('Structured result:\n');
	if (at < 0) return {};
	try {
		return rec(JSON.parse(output.slice(at + 'Structured result:\n'.length)));
	} catch {
		return {};
	}
}

/** What the reviewer's `print` threw, as the tool printed it — the validator's E-5 detail, unwrapped of the seam's prefix. */
const THROWN_MARKER = 'What the tool reported, sanitised: ';
const SEAM_PREFIX = 'reasoning-review backing tool invocation failed: ';

const ROLE: Readonly<Record<string, RecordedRole>> = {
	INITIAL: 'initial',
	REPAIR: 'repair',
	RETRY: 'retry'
};
const FRAMING: Readonly<Record<string, string>> = {
	ARTIFACT: 'work-product',
	EVIDENCE: 'command',
	PROFESSIONAL_WORK_ARCHITECTURE: 'pwa'
};

/**
 * ⭐ THE PUBLISHED PWA'S DECLARED CONTENT, DIGESTED: each of its types' name, kind, purpose, root mark, discharge, policies
 * and prompt (its text and output contract), sorted by name, as canonical JSON. What the recorded run ran on — so a
 * replay of another PWA is told apart before its first call.
 */
export function pwaContentDigest(objects: readonly StoredObject[]): string | string[] {
	const published = objects.filter(
		(o) =>
			o.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE' && o.state.publicationStatus === 'PUBLISHED'
	);
	if (published.length !== 1)
		return [`the store holds ${published.length} published PWAs, and a recording is of one`];
	const pwaId = published[0]!.id;
	const types = objects
		.filter((o) => o.objectType === 'PWU_TYPE' && o.state.pwaId === pwaId)
		.map((t) => {
			const prompt = rec(t.state.promptTemplate);
			return {
				name: str(t.state.name),
				pwuKind: str(t.state.pwuKind),
				purpose: str(t.state.purpose),
				isRoot: t.state.isRoot === true,
				workDischarge: str(t.state.workDischarge),
				requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
					? [...(t.state.requiredAssurancePolicyIds as unknown[])].map(String).sort(byCodeUnit)
					: [],
				prompt: str(prompt.templateText),
				outputContract: prompt.outputContract ?? null
			};
		})
		.sort((a, b) => byCodeUnit(a.name, b.name));
	return createHash('sha256').update(JSON.stringify(types), 'utf8').digest('hex');
}

/** What the extraction carries from one archive row to the next: the run's scrub, its units, and the evidence used. */
interface Extraction {
	readonly input: RecorderInput;
	readonly pairs: readonly ScrubPair[];
	readonly scrub: (text: string) => string;
	readonly unitOf: ReadonlyMap<string, string>;
	/** The run's EVIDENCE, in the order it was recorded; each paired with one command at most. */
	readonly evidence: readonly StoredObject[];
	readonly usedEvidence: Set<string>;
	readonly problems: string[];
}

/**
 * One `run_command` call's command, as the recording keeps it — or undefined when the call never reached the runner (the
 * tool's own refusal of its argument), or a problem was pushed. ⭑ Paired with the first unused EVIDENCE of the same argv:
 * evidence is minted in COMPLETION order (`REG-F-518`), calls are kept in CALL order, and the argv is what joins them.
 */
function commandOf(
	call: PayloadCall,
	where: string,
	x: Extraction
): { readonly command: RecordedCommand; readonly completedAt?: number } | undefined {
	const argv = (call.arguments.argv as unknown[]).map(String);
	if (call.output.startsWith('Refused: '))
		return {
			command: {
				argv: argv.map(x.scrub),
				ran: false,
				refusedBecause: x.scrub(call.output.slice('Refused: '.length))
			}
		};
	if (!call.output.startsWith('exit ')) return undefined;
	const run = x.evidence.find(
		(e) =>
			!x.usedEvidence.has(e.id) &&
			JSON.stringify(rec(e.state.contentReference).command) === JSON.stringify(argv)
	);
	if (run === undefined) {
		x.problems.push(
			`${where}: its command ${JSON.stringify(argv.map(x.scrub))} became no evidence, so its capture cannot be paired (REG-F-517)`
		);
		return undefined;
	}
	x.usedEvidence.add(run.id);
	const ref = rec(run.state.contentReference);
	const capture = rec(ref.capture);
	const files = x.input.captures.get(str(capture.stdoutPath).replace(/\/stdout\.txt$/, ''));
	if (capture.retained !== true || files === undefined) {
		x.problems.push(
			`${where}: its command ${JSON.stringify(argv.map(x.scrub))} has no capture in the final archive`
		);
		return undefined;
	}
	const omissions = rec(files.omissions).omittedRegions;
	return {
		command: {
			argv: argv.map(x.scrub),
			ran: true,
			exitCode: typeof ref.exitCode === 'number' ? ref.exitCode : null,
			timedOut: ref.timedOut === true,
			durationMs: typeof ref.durationMs === 'number' ? ref.durationMs : 0,
			outputComplete: structuredResult(call.output).outputComplete !== false,
			omissions: Array.isArray(omissions)
				? (omissions as Extract<RecordedCommand, { ran: true }>['omissions'])
				: [],
			stdout: x.scrub(files.stdout),
			stderr: x.scrub(files.stderr)
		},
		// ⭑ When its evidence was minted — the order the run's command reviews were dispatched in.
		completedAt: run.firstSequence
	};
}

/**
 * ⛔ `REG-F-518` — WHETHER A TRY'S RUNS COMPLETED IN THE ORDER THEY WERE CALLED. Pi starts one message's calls together, the
 * host mints each run's evidence as it COMPLETES, and the command reviews are dispatched in that order. A replay runs the
 * recorded calls one at a time, in call order, so its reviews come in call order: where the run's came otherwise, the
 * replay asks the recorded prompts in another order and goes stale there — driven on P3's archive (the end-to-end
 * phase's second command review). So such a try is refused at recording, naming the cause.
 */
function completedInCallOrder(completions: readonly (number | undefined)[]): boolean {
	const known = completions.filter((c): c is number => c !== undefined);
	return known.every((c, k) => k === 0 || known[k - 1]! < c);
}

/** One EXECUTION exchange's try, and the commands its calls ran — or undefined, a problem pushed. */
function executorTryOf(
	row: StoredObject,
	n: number,
	x: Extraction
): { readonly tried: ExecutorTry; readonly commands: readonly RecordedCommand[] } | undefined {
	const where = `executor try ${n + 1} (${row.id})`;
	const turn = turnOf(contentOf(row.state.materializedInputRef, x.input.content));
	const outcomes = observedOutcomes(row);
	const raw = contentOf(row.state.rawOutputBeforeCoercionRef, x.input.content);
	let problem: string | undefined;
	if (typeof turn === 'string') problem = turn;
	else if (typeof outcomes === 'string') problem = outcomes;
	else if (turn.calls.length !== outcomes.length)
		problem = `its payload holds ${turn.calls.length} tool calls and its record observed ${outcomes.length}`;
	else if (rec(row.state.volunteeredReasoningRef).status === 'STORED')
		problem =
			'its answer arrived with volunteered reasoning, and separating the two again is not built';
	else if (raw === undefined)
		problem = "its answer's bytes are not retained, so its answer cannot be replayed";
	if (
		problem !== undefined ||
		typeof turn === 'string' ||
		typeof outcomes === 'string' ||
		raw === undefined
	) {
		x.problems.push(`${where}: ${problem ?? 'unreadable'}`);
		return undefined;
	}
	const paired = turn.calls
		.filter((c) => c.name === 'run_command' && Array.isArray(c.arguments.argv))
		.map((c) => commandOf(c, where, x))
		.filter((c) => c !== undefined);
	if (!completedInCallOrder(paired.map((p) => p.completedAt))) {
		x.problems.push(
			`${where}: its commands completed out of the order they were called — Pi ran them together (REG-F-518) — so ` +
				'their reviews were dispatched in an order a replay, which runs them one at a time, cannot reproduce'
		);
		return undefined;
	}
	const commands = paired.map((p) => p.command);
	return {
		tried: {
			unit: x.unitOf.get(str(row.state.subjectObjectId)) ?? str(row.state.subjectObjectId),
			turnSha256: sha256Hex(x.scrub(turn.text)),
			toolCalls: turn.calls.map((c, k) => ({
				name: c.name,
				arguments: scrubValue(c.arguments, x.pairs) as Record<string, unknown>,
				outcome: outcomes[k]!
			})),
			answer: { arrived: true, text: x.scrub(raw) } satisfies RecordedAnswer,
			producer: {
				agentId: str(row.state.invokerId).split(':')[0] ?? '',
				modelId: str(rec(row.state.resolvedModel).value),
				providerId: str(rec(row.state.resolvedProvider).value)
			}
		},
		commands
	};
}

/** A reviewer call's reply: a call that threw, its cause as the tool printed it; else its retained raw reply. */
function replyOf(row: StoredObject, x: Extraction): RecordedReply | string {
	if (row.state.disposition === 'NO_RESPONSE') {
		const detail = str(rec(row.state.parseOutcome).detail);
		const at = detail.indexOf(THROWN_MARKER);
		const told = at < 0 ? detail : detail.slice(at + THROWN_MARKER.length);
		return {
			status: 'THROWN',
			message: x.scrub(told.startsWith(SEAM_PREFIX) ? told.slice(SEAM_PREFIX.length) : told)
		};
	}
	const raw =
		contentOf(row.state.rawOutputBeforeCoercionRef, x.input.content) ?? reassembled(row, x);
	if (raw === undefined)
		return 'its reply is retained neither whole nor in two halves that reassemble, so it cannot be replayed';
	return { status: 'ANSWERED', text: x.scrub(raw) };
}

/**
 * ⭐ A REPLY KEPT IN TWO HALVES, REASSEMBLED as its record says to (`REG-D-057`; `exchange-capture.ts`): a reply with a
 * located answer span is retained as the answer (`answerSpanRef`) and the rest (`volunteeredReasoningRef`), the answer's
 * place declared as a `MODEL_ANSWER` region — *"Reassemble the reply as reasoning.slice(0, byteOffset) + answer +
 * reasoning.slice(byteOffset), in BYTES."* Measured on P3's archive: every answered reviewer call was kept so, the whole
 * reply never. ⛔ Undefined unless both halves are held and the region's byte size is the answer's, so nothing is guessed.
 */
function reassembled(row: StoredObject, x: Extraction): string | undefined {
	const answer = contentOf(row.state.answerSpanRef, x.input.content);
	const rest = contentOf(row.state.volunteeredReasoningRef, x.input.content);
	const regions = Array.isArray(row.state.omittedRegions) ? row.state.omittedRegions.map(rec) : [];
	const region = regions.find((r) => r.role === 'MODEL_ANSWER');
	if (answer === undefined || rest === undefined || region === undefined) return undefined;
	const answerBytes = Buffer.from(answer, 'utf8');
	const restBytes = Buffer.from(rest, 'utf8');
	const at = region.byteOffset;
	if (
		typeof at !== 'number' ||
		at < 0 ||
		at > restBytes.length ||
		region.byteSize !== answerBytes.length
	)
		return undefined;
	return Buffer.concat([restBytes.subarray(0, at), answerBytes, restBytes.subarray(at)]).toString(
		'utf8'
	);
}

/** The unit whose try was requested last at or before `at` — the unit a reviewer call is about. */
function unitAt(
	tries: readonly { readonly at: number; readonly unit: string }[],
	at: number
): string | null {
	let unit: string | null = null;
	for (const t of tries) if (t.at <= at) unit = t.unit;
	return unit;
}

/** One ASSURANCE exchange's reviewer call — or undefined, a problem pushed. */
function reviewerCallOf(
	row: StoredObject,
	n: number,
	x: Extraction,
	evaluatorAgent: string,
	tries: readonly { readonly at: number; readonly unit: string }[]
): ReviewerCall | undefined {
	const where = `reviewer call ${n + 1} (${row.id})`;
	const prompt = contentOf(row.state.materializedInputRef, x.input.content);
	const reply = replyOf(row, x);
	const requested = Date.parse(str(row.state.requestedAt));
	const elapsedMs = Date.parse(str(row.state.respondedAt)) - requested;
	let problem: string | undefined;
	if (prompt === undefined) problem = 'its prompt is not retained, so it cannot be hashed';
	else if (typeof reply === 'string') problem = reply;
	else if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
		problem =
			'its time cannot be read off its record, so its retry cannot be replayed where it happened';
	if (problem !== undefined || prompt === undefined || typeof reply === 'string') {
		x.problems.push(`${where}: ${problem ?? 'unreadable'}`);
		return undefined;
	}
	const subjectType = str(row.state.subjectObjectType);
	return {
		unit: unitAt(tries, requested),
		framing: FRAMING[subjectType] ?? subjectType.toLowerCase(),
		role: ROLE[str(row.state.exchangeRole)] ?? 'initial',
		promptSha256: sha256Hex(x.scrub(prompt)),
		prompt: x.scrub(prompt),
		reply,
		evaluator: {
			agentId: evaluatorAgent,
			modelId: str(rec(row.state.resolvedModel).value),
			providerId: str(rec(row.state.resolvedProvider).value)
		},
		elapsedMs
	};
}

/**
 * The bound the recorded reviewer was held to: what a thrown call's own record says it was held to, else the tool's
 * known bound (`RECORDED_CALL_BOUND_MS`), else none.
 */
function reviewerBound(rows: readonly StoredObject[], agent: string): number | null {
	for (const row of rows) {
		const bound = /tool’s (\d+) ms bound/.exec(str(rec(row.state.parseOutcome).detail));
		if (bound) return Number(bound[1]);
	}
	return RECORDED_CALL_BOUND_MS[agent] ?? null;
}

/**
 * ⭐⭐ THE RECORDING, OR THE PROBLEMS THAT STOP IT. Every text is scrubbed of the run's directories (`scrubPairs`) and every
 * hash taken over the scrubbed bytes, so a replay that scrubs its own directories compares equal.
 */
export function buildRecording(i: RecorderInput): RecorderOutput {
	const pairs = scrubPairs({
		WORKSPACE: i.workspace,
		PROCESS_OUTPUT: `${i.workspace}.process-output`,
		HOME: i.home
	});
	const x: Extraction = {
		input: i,
		pairs,
		scrub: (text) => scrubText(text, pairs),
		unitOf: new Map(i.units.map((u) => [u.unitId, u.slug])),
		evidence: i.store.objects
			.filter((o) => o.objectType === 'EVIDENCE')
			.sort((a, b) => a.firstSequence - b.firstSequence),
		usedEvidence: new Set(),
		problems: []
	};
	const exchanges = i.store.objects
		.filter((o) => o.objectType === 'MODEL_EXCHANGE')
		.sort(byRequest);
	const executionRows = exchanges.filter((e) => e.state.plane === 'EXECUTION');
	const assuranceRows = exchanges.filter((e) => e.state.plane === 'ASSURANCE');

	const tried = executionRows.map((row, n) => executorTryOf(row, n, x));
	const executor = tried.flatMap((t) => (t ? [t.tried] : []));
	const commands = tried.flatMap((t) => (t ? t.commands : []));
	const tries = executionRows.map((row) => ({
		at: Date.parse(str(row.state.requestedAt)),
		unit: x.unitOf.get(str(row.state.subjectObjectId)) ?? str(row.state.subjectObjectId)
	}));
	// ⭑ The reviewing agent, as the Reasoning Review's assessments name their evaluator (`actorId`, read off P3's archive):
	// the exchange record keeps the model and provider only.
	const agent =
		i.store.objects
			.filter(
				(o) =>
					o.objectType === 'ASSURANCE_ASSESSMENT' &&
					o.state.assurancePolicyId === 'floor.reasoning-review'
			)
			.map((a) => rec(a.state.evaluator))
			.filter((e) => e.actorType === 'AGENT')
			.map((e) => str(e.actorId))
			.find((id) => id !== '') ?? '';
	const reviewer = assuranceRows
		.map((row, n) => reviewerCallOf(row, n, x, agent, tries))
		.filter((c): c is ReviewerCall => c !== undefined);

	const digest = pwaContentDigest(i.store.objects);
	if (typeof digest !== 'string') x.problems.push(...digest);
	if (i.expectedMatrix.length === 0)
		x.problems.push('the run report holds no matrix, and a recording expects the run it records');
	if (executionRows.length === 0) x.problems.push('the archive holds no executor try');
	if (x.problems.length > 0 || typeof digest !== 'string')
		return { recording: null, problems: x.problems, pairs };
	const none: RecordedIdentity = { agentId: '', modelId: '', providerId: '' };
	return {
		recording: {
			manifest: {
				format: RECORDING_FORMAT,
				commit: i.commit,
				reviewerFingerprint: i.reviewerFingerprint,
				pwaContentDigest: digest,
				models: {
					executor: executor[0]?.producer ?? none,
					reviewer: {
						...(reviewer[0]?.evaluator ?? none),
						callBoundMs: reviewerBound(assuranceRows, agent)
					}
				},
				scrub: { tokens: [...SCRUB_TOKENS] },
				expectedMatrix: i.expectedMatrix
			},
			executor,
			commands,
			reviewer
		},
		problems: [],
		pairs
	};
}

/** Every file under `dir`, by `/`-separated relative path, with its SHA-256 — `.git` left out, as the tree hash leaves it. */
function filesOf(dir: string): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (d: string, rel: string): void => {
		for (const entry of readdirSync(d)) {
			if (entry === '.git') continue;
			const path = join(d, entry);
			const at = rel === '' ? entry : `${rel}/${entry}`;
			if (statSync(path).isDirectory()) walk(path, at);
			else out.set(at, createHash('sha256').update(readFileSync(path)).digest('hex'));
		}
	};
	walk(dir, '');
	return out;
}

/** One unit archive's workspace, held to the writes replayed up to it. */
export interface WriteCheck {
	readonly archive: string;
	/** The unit archive's workspace tree hash, or null when it holds no workspace. */
	readonly expected: string | null;
	readonly replayed: string;
	/** Null when there is nothing to hold it to. */
	readonly match: boolean | null;
	/** The files that differ, by path — in one tree and not the other, or with other bytes. */
	readonly differing: readonly string[];
}

/**
 * ⭐ `REG-F-530`'s "INFERRED", CHECKED: each recorded `write_file` the run completed is replayed, in order, into `scratch`
 * — its arguments EXPANDED TO THE RUN'S OWN DIRECTORIES (`pairs`), so its bytes are the run's — and after each unit's
 * tries the tree is held to that unit's archived workspace (`workspaceTreeSha256`, the run report's own). A mismatch says
 * the payload did not carry what was written, or that something other than `write_file` wrote into the workspace (a
 * command) — either way a replay would not rebuild the deliverable, and the recorder refuses.
 */
export function verifyWrites(
	recording: Recording,
	units: readonly RecorderUnit[],
	archiveWorkspace: (archive: string) => string | null,
	pairs: readonly ScrubPair[],
	scratch: string
): WriteCheck[] {
	mkdirSync(scratch, { recursive: true });
	const checks: WriteCheck[] = [];
	for (const unit of units) {
		for (const t of recording.executor.filter((e) => e.unit === unit.slug))
			for (const call of t.toolCalls) {
				if (call.name !== 'write_file' || call.outcome !== 'COMPLETED') continue;
				const path = expandText(str(call.arguments.path), pairs);
				const target = join(scratch, ...path.split('/'));
				mkdirSync(dirname(target), { recursive: true });
				writeFileSync(target, expandText(str(call.arguments.contents), pairs), 'utf8');
			}
		const replayed = workspaceTreeSha256(scratch);
		const archived = archiveWorkspace(unit.archive);
		if (archived === null) {
			checks.push({ archive: unit.archive, expected: null, replayed, match: null, differing: [] });
			continue;
		}
		const expected = workspaceTreeSha256(archived);
		const mine = filesOf(scratch);
		const theirs = filesOf(archived);
		const differing = [...new Set([...mine.keys(), ...theirs.keys()])]
			.filter((p) => mine.get(p) !== theirs.get(p))
			.sort(byCodeUnit);
		checks.push({
			archive: unit.archive,
			expected,
			replayed,
			match: expected === replayed,
			differing
		});
	}
	return checks;
}
