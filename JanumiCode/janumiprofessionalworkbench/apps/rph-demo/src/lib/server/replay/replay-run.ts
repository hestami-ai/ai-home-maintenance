// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2, D3; `REG-D-111` (5); `REG-F-530`) — ONE REPLAY OF ONE
// RECORDING: the three cursors the replay's arms serve from, in the order the run dispatched them, and the one rule they
// share — a call that does not match its recording FAILS CLOSED, and so does every call after it.
//
// ── ⛔ WHAT EACH ARM CHECKS BEFORE IT ANSWERS ──────────────────────────────────────────────────────────────────────────
//   · ⭐ FIRST, ONCE (`REG-D-112` (c); the review of E4, finding 4): the published PWA, digested, is the recording's
//     (`checkPublishedPwa`) — until it has been held so, no executor try is served (`REPLAY_PWA_UNCHECKED`);
//   · the EXECUTOR (`replay-executor.ts`): the turn's text, scrubbed, hashes to the recorded `turnSha256` — ⭐ and the
//     executor's instructions and its tool definitions, recomputed from the code under test, to the recorded
//     `instructionsSha256` and `toolsSha256` (finding 1); ⭐ and, call by call, the result the model read, rendered again
//     by the code under test, to the recorded `resultSha256` (`checkToolResult`; the lead's delegated decision of
//     2026-10-15, to be registered);
//   · the RUNNER (`replayed-runner.ts`): the argv it is asked to run, scrubbed, is the recorded argv;
//   · the REVIEWER (`reviewerPrint`, below): the prompt, scrubbed, hashes to the recorded `promptSha256`.
// A mismatch is `REPLAY_STALE`, naming the call and both hashes; a call past the end is `REPLAY_EXHAUSTED`. ⛔ AND THE
// FIRST ONE POISONS THE RUN: a recording that has diverged once describes a different run from then on, so every later
// call — of any arm — refuses as stale rather than answering from a recording that no longer applies. In particular the
// validator's one retry of a call that threw (`P7-2b`) is refused too, and never takes the next recorded reply.
//
// ── ⛔ NEVER BY ORDER ALONE (`REG-D-067`) ────────────────────────────────────────────────────────────────────────────
// The qualification runner's precedent, `replayReplies` (`scripts/reviewer-qual/runner.ts`), serves recorded replies in
// order and asks nothing of the prompt: right for re-scoring a record against itself, and exactly the cache `REG-D-067`
// attacked to fatal — *"a content-keyed cache is honest only if the cached thing is a function of the key"*. Here the
// key is the prompt's hash, checked on every call, so a judgement is replayed only about the subject it was made about
// (`REG-D-068`'s *"bound to the subject"*). ⚠ Whether a replayed judgement may COUNT in the test lane stays the sponsor's
// question (the design's §8, still to come); this replays it, binds it, and grades it HOST_CONFIGURED, never as a report.
//
// ── ⭐ THE CLOCK (`reasoning-review-validator.ts`, `thrownCallDisposal`) ──────────────────────────────────────────────
// Whether a call that threw is run once more depends on its elapsed time against the tool's bound. The replay hands the
// validator `clock`, a virtual time that only `reviewerPrint` advances — by each call's RECORDED elapsed time — so the
// validator measures exactly the time the run measured, and a retry happens exactly where it happened.
// ⭐ AND THE BOUND IS THE PRODUCT's (the review of E4, finding 8): ~~the recording's~~ `REVIEWER_CALL_BOUND_MS` for the
// recorded reviewing tool, as the product's own validator holds it (`productCallBoundFor`). A recording whose thrown
// calls that bound would dispose otherwise than the run did — retried where it would stand, or standing where it would
// be retried — was made under another bound, and is refused when the replay opens (`boundDisagreements`).
import { mkdirSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEWER_CALL_BOUND_MS } from '../assurance/reasoning-review-validator.js';
import { answerFromText, type ToolInvocationResult } from '../tools/backing-tool.js';
import { OutputLimitReached } from '../tools/output-limit.js';
import {
	expandText,
	instructionsSha256,
	pwaContentDigest,
	readRecording,
	RecordingRefusal,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	toolDefinitionsSha256,
	type ExecutorTry,
	type PwaObjectRow,
	type RecordedCommand,
	type Recording,
	type ReviewerCall,
	type ScrubPair,
	type ToolDefinitionKey
} from './recording.js';

/**
 * Why a replayed call was refused: the recording no longer matches, or it has no call left — ⭐ or the published PWA was
 * never held to the recording before a try was asked for (`REG-D-112` (c); finding 4).
 */
export type ReplayRefusalCode = 'REPLAY_STALE' | 'REPLAY_EXHAUSTED' | 'REPLAY_PWA_UNCHECKED';

/**
 * ⭐ WHAT THE EXECUTOR WAS GIVEN BESIDE ITS TURN (the review of E4, finding 1): its instructions and the tools it was
 * offered, as the code under test would give them (`replay-executor.ts`, `executorKeyOf`).
 */
export interface ExecutorKey {
	readonly instructions: string;
	readonly tools: readonly ToolDefinitionKey[];
}

/** ⛔ A replay's refusal. Its message opens with its code, so a floor or a step that records it says which. */
export class ReplayRefusal extends Error {
	constructor(
		readonly code: ReplayRefusalCode,
		detail: string
	) {
		super(`${code}: ${detail}`);
	}
}

/** Where the replay's virtual clock starts. ⭑ Fixed, so two replays of one recording record the same times. */
export const REPLAY_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');

/** What the REPLAYED runner draws on: the next recorded command, checked, and the expansion of its bytes. */
export interface ReplayCommandSource {
	/** The next recorded command if `argv` is the one recorded, else the refusal — never a throw: `run` may not throw. */
	nextCommand(
		argv: readonly string[]
	): { readonly recorded: RecordedCommand } | { readonly refusal: ReplayRefusal };
	expand(text: string): string;
}

export interface ReplayRun extends ReplayCommandSource {
	readonly recording: Recording;
	/** ⭐ D3 — the disposable root this replay's FILESYSTEM workspaces are made under: made once, on first need. */
	root(): string;
	/** The Undertaking whose sandbox the replay is running in now: its directories are what the scrub replaces. */
	useSandbox(places: { readonly workspace: string; readonly processOutput: string }): void;
	scrub(text: string): string;
	/** Every string inside `value`, expanded — a recorded tool call's arguments, as this host's tools must receive them. */
	expandArguments(value: Readonly<Record<string, unknown>>): Record<string, unknown>;
	/**
	 * ⭐ HOLD THE PUBLISHED PWA TO THE RECORDING (`REG-D-112` (c); finding 4): `objects` are the store's, and their
	 * published PWA must digest to the recording's `pwaContentDigest`. ⛔ Throws `ReplayRefusal` (and poisons) otherwise;
	 * until it has passed, no executor try is served.
	 */
	checkPublishedPwa(objects: readonly PwaObjectRow[]): void;
	/**
	 * The next recorded executor try, if `turnText` hashes to it — ⭐ and `key`, the executor's instructions and tools, to
	 * the try's recorded key (finding 1). ⛔ Throws `ReplayRefusal` otherwise.
	 */
	nextExecutorTry(turnText: string, key: ExecutorKey): ExecutorTry;
	/**
	 * ⭐⭐ WHAT THE MODEL READ OF A CALL, HELD TO THE RECORDING (the lead's delegated decision of 2026-10-15, to be
	 * registered): `rendered` — call `index` of `tried`'s result as the code under test renders it, and as Pi would send it
	 * (`toolResultAsSent`) — must hash, scrubbed, to the call's recorded `resultSha256`. ⛔ Throws `ReplayRefusal` (and
	 * poisons) otherwise, naming the call and both hashes.
	 */
	checkToolResult(tried: ExecutorTry, index: number, rendered: string): void;
	/** ⭐ The reviewer's `print`: the next recorded reply, if the prompt hashes to it. ⛔ Rejects `ReplayRefusal` otherwise. */
	readonly reviewerPrint: (prompt: string) => Promise<ToolInvocationResult>;
	/** ⭐ The validator's clock: virtual time, advanced by each replayed call's recorded elapsed time. */
	readonly clock: () => string;
	/** Mark the replay stale from an arm's own check (a tool's outcome that differs from the recording's). */
	stale(detail: string): ReplayRefusal;
	/** How many of each the replay has served — a regression asserts it served them all. */
	consumed(): { readonly executor: number; readonly commands: number; readonly reviewer: number };
	/** The refusal that poisoned the replay, if one did. */
	poisonedBy(): ReplayRefusal | undefined;
}

/**
 * A reviewer call's recorded reply as the text the product parses exactly as it parsed the original — the qualification
 * runner's `replayText`, applied to the product's own forms: a retained reply is itself; a reply not retained replays as
 * the empty string, which does not parse either; a reply with no answer span as `null` if the product's parse accepted it.
 */
function replyText(call: ReviewerCall, expand: (s: string) => string): string {
	switch (call.reply.status) {
		case 'ANSWERED':
			return expand(call.reply.text);
		case 'NOT_RETAINED':
			return '';
		case 'NO_ANSWER_SPAN':
			return call.reply.parses ? 'null' : '';
		case 'THROWN':
		case 'OUTPUT_LIMIT':
			// Never reached: a THROWN reply, and (P5 package A) a cut one, is thrown again before its text is asked for
			// (`reviewerPrint`).
			return '';
	}
}

/** What a replayed reviewer call reports of tool calls: nothing, in its own words. */
const REPLAYED_REVIEW_OBSERVATION = {
	canObserve: false,
	reason:
		'This reply was replayed from a recording: no reviewing tool ran, so nothing was in a position to observe tool ' +
		'calls. This record is not evidence that none ran in the recorded call.'
} as const;

const describeCall = (index: number, call: ReviewerCall): string =>
	`reviewer call ${index + 1} (unit ${call.unit ?? 'none'}, ${call.framing}, ${call.role})`;

/**
 * ⭐ D3 — A REPLAY'S DISPOSABLE ROOT: `<temp>/jpwb-replay-XXXXXX/replay.sqlite.workspaces`, a fresh temporary folder each
 * time. ⭑ Named as the durable arm names its root — `<JPWB_DEMO_DB>.workspaces` (`workspace-host.ts`) — so the run report's
 * one derivation of a workspace from a store's path (`workspaceDirectoryFor`) holds for a replay too, its store's path
 * being `<temp>/jpwb-replay-XXXXXX/replay.sqlite`. ⚠ No store is ever written there: a replay's stores stay in memory.
 */
function disposableRoot(): string {
	const root = join(mkdtempSync(join(tmpdir(), 'jpwb-replay-')), REPLAY_ROOT_NAME);
	mkdirSync(root);
	return root;
}

/** The disposable root's own folder name (`disposableRoot`): `<store>.workspaces`, the store never written. */
export const REPLAY_ROOT_NAME = 'replay.sqlite.workspaces';

/**
 * ⭐ ONE REPLAY OF `recording`. `makeRoot` makes the disposable root (`root()`); a test hands its own. `home` is this
 * host's home folder, scrubbed and expanded as the recording's `JPWB_REPLAY_HOME_NATIVE` (`scrubPairs`).
 * ⚠ Its state is the cursors, the clock and the poison: one replay serves ONE run, from its first call.
 */
export function createReplayRun(
	recording: Recording,
	makeRoot: () => string = disposableRoot,
	home: string = homedir()
): ReplayRun {
	let pairs: readonly ScrubPair[] = scrubPairs({ HOME: home });
	let root: string | undefined;
	let virtualMs = REPLAY_EPOCH_MS;
	const next = { executor: 0, commands: 0, reviewer: 0 };
	let poisoned: ReplayRefusal | undefined;
	/** ⭐ Whether the published PWA has been held to the recording's digest (`checkPublishedPwa`). */
	let pwaChecked = false;

	/** ⛔ THE FIRST REFUSAL POISONS THE REPLAY; every later call refuses as stale, naming it. */
	const poison = (refusal: ReplayRefusal): ReplayRefusal => {
		poisoned ??= refusal;
		return refusal;
	};
	const afterPoison = (what: string): ReplayRefusal | undefined =>
		poisoned === undefined
			? undefined
			: new ReplayRefusal(
					'REPLAY_STALE',
					`${what} was not replayed: the replay already refused (${poisoned.message}), and a recording that has ` +
						'diverged once describes another run from there on.'
				);
	const exhausted = (what: string, held: number): ReplayRefusal =>
		poison(
			new ReplayRefusal(
				'REPLAY_EXHAUSTED',
				`${what} was asked for, and the recording holds ${held}: this run made a call the recorded one did not.`
			)
		);

	const scrub = (text: string): string => scrubText(text, pairs);
	const expand = (text: string): string => expandText(text, pairs);
	const expandValue = (value: unknown): unknown => {
		if (typeof value === 'string') return expand(value);
		if (Array.isArray(value)) return value.map(expandValue);
		if (typeof value === 'object' && value !== null)
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandValue(v)]));
		return value;
	};

	return {
		recording,
		root: () => (root ??= makeRoot()),
		useSandbox(places) {
			pairs = scrubPairs({
				WORKSPACE: places.workspace,
				PROCESS_OUTPUT: places.processOutput,
				HOME: home
			});
		},
		scrub,
		expand,
		expandArguments: (value) => expandValue(value) as Record<string, unknown>,
		stale: (detail) => poison(new ReplayRefusal('REPLAY_STALE', detail)),
		consumed: () => ({ ...next }),
		poisonedBy: () => poisoned,
		clock: () => new Date(virtualMs).toISOString(),

		checkPublishedPwa(objects) {
			const already = afterPoison('the published PWA');
			if (already) throw already;
			const actual = pwaContentDigest(objects);
			if (typeof actual !== 'string')
				throw poison(
					new ReplayRefusal(
						'REPLAY_STALE',
						`the published PWA cannot be held to the recording: ${actual.join('; ')}.`
					)
				);
			// ⭐ WHAT THE CHECK CATCHES, SAID (the confirm of E4's second fix round): ~~"this run's PWA is not the one the
			// recording was made on"~~ — since `REG-D-112` (c) the replay re-creates the recording's OWN `pwa` before this
			// (`replay-pwa.ts`), so a mismatch is the recording against itself, or the re-creation against what was recorded.
			if (actual !== recording.manifest.pwaContentDigest)
				throw poison(
					new ReplayRefusal(
						'REPLAY_STALE',
						`the published PWA's content digest is ${actual}, and the recording's is ` +
							`${recording.manifest.pwaContentDigest}: the PWA the replay re-created from the recording ` +
							"(REG-D-112 (c)) does not digest as the recording says — the recording's own `pwa` and its digest " +
							'disagree, or the engine stored the re-created PWA otherwise than recorded, in the fields the digest ' +
							'covers. No try is served to it.'
					)
				);
			pwaChecked = true;
		},

		nextExecutorTry(turnText, key) {
			const index = next.executor;
			const what = `executor try ${index + 1}`;
			const already = afterPoison(what);
			if (already) throw already;
			// ⛔ `REG-D-112` (c); finding 4 — NO TRY BEFORE THE PWA WAS HELD TO THE RECORDING: a recorded answer answers the
			// instruction the recorded PWA rendered, and a replay that skipped the check could serve it to another PWA's.
			if (!pwaChecked)
				throw poison(
					new ReplayRefusal(
						'REPLAY_PWA_UNCHECKED',
						`${what} was asked for before the published PWA was held to the recording's digest ` +
							'(checkPublishedPwa): a recorded try is served only to the PWA it was made on (REG-D-112 (c)).'
					)
				);
			const recorded = recording.executor[index];
			if (recorded === undefined) throw exhausted(what, recording.executor.length);
			const stale = (
				part: string,
				actual: string,
				recordedHash: string,
				sentence: string
			): ReplayRefusal =>
				poison(
					new ReplayRefusal(
						'REPLAY_STALE',
						`${what} (unit ${recorded.unit}): ${part} SHA-256 is ${actual}, and the recording's is ` +
							`${recordedHash}. ${sentence}`
					)
				);
			const turn = sha256Hex(scrub(turnText));
			if (turn !== recorded.turnSha256)
				throw stale(
					"the turn text's",
					turn,
					recorded.turnSha256,
					'The executor was sent another turn than the one recorded.'
				);
			// ⭐ FINDING 1 — THE REST OF WHAT THE MODEL WAS GIVEN: its system prompt and its tools, as this code gives them.
			const instructions = instructionsSha256(key.instructions, scrub);
			if (instructions !== recorded.instructionsSha256)
				throw stale(
					"the executor's instructions'",
					instructions,
					recorded.instructionsSha256,
					'The executor would be given another system prompt than the one the recorded answer was made under.'
				);
			const tools = toolDefinitionsSha256(key.tools, scrub);
			if (tools !== recorded.toolsSha256)
				throw stale(
					"the executor's tool definitions'",
					tools,
					recorded.toolsSha256,
					'The executor would be offered other tools than the ones the recorded answer was made with.'
				);
			next.executor += 1;
			return recorded;
		},

		checkToolResult(tried, index, rendered) {
			const call = tried.toolCalls[index];
			const what = `executor try ${next.executor} (unit ${tried.unit}), tool call ${index + 1} (${call?.name ?? 'none'})`;
			const already = afterPoison(`${what}'s result`);
			if (already) throw already;
			const actual = sha256Hex(scrub(rendered));
			if (actual === call?.resultSha256) return;
			// ⚠ THE KEY'S STATED LIMIT (`recording.ts`, the header's size of a scrubbed path), said where it bites: a call
			// whose arguments name the run's own directories may report a size measured of them, which is ~~this host's~~ ⭐
			// this replay's, measured in its sandbox — on the recording's own host too (the check of E4's polish round, F2).
			const named =
				call !== undefined && SCRUB_TOKENS.some((token) => JSON.stringify(call.arguments).includes(token));
			throw poison(
				new ReplayRefusal(
					'REPLAY_STALE',
					`${what}: the result's SHA-256 as this code renders it is ${actual}, and the recording's is ` +
						`${call?.resultSha256 ?? 'absent'}. The model read another result than this code renders, and the ` +
						'recorded answer was made reading it.' +
						(named
							? " ⚠ Its arguments name the run's own directories (a scrub token), so a size the tool reports of " +
								"them is measured in this replay's sandbox — a fresh temporary folder, on the recording's own host " +
								"too — and differs wherever the sandbox's directories are not as long as the run's: the " +
								"recording's stated limit."
							: '')
				)
			);
		},

		nextCommand(argv) {
			const index = next.commands;
			const what = `command ${index + 1}`;
			const already = afterPoison(what);
			if (already) return { refusal: already };
			const recorded = recording.commands[index];
			if (recorded === undefined) return { refusal: exhausted(what, recording.commands.length) };
			const actual = argv.map(scrub);
			if (JSON.stringify(actual) !== JSON.stringify(recorded.argv))
				return {
					refusal: poison(
						new ReplayRefusal(
							'REPLAY_STALE',
							`${what}: this run asked to run ${JSON.stringify(actual)}, and the recording ran ` +
								`${JSON.stringify(recorded.argv)} there. Nothing was run.`
						)
					)
				};
			next.commands += 1;
			return { recorded };
		},

		async reviewerPrint(prompt) {
			const index = next.reviewer;
			const already = afterPoison(`reviewer call ${index + 1}`);
			if (already) throw already;
			const call = recording.reviewer[index];
			if (call === undefined)
				throw exhausted(`reviewer call ${index + 1}`, recording.reviewer.length);
			const actual = sha256Hex(scrub(prompt));
			// ⛔ THE PROMPT'S HASH, ON EVERY CALL — the key a recorded judgement is bound to (`REG-D-067`, `REG-D-068`).
			if (actual !== call.promptSha256)
				throw poison(
					new ReplayRefusal(
						'REPLAY_STALE',
						`${describeCall(index, call)}: the prompt's SHA-256 is ${actual}, and the recording's is ` +
							`${call.promptSha256}. The reviewer was asked something other than what the recorded reply answered.`
					)
				);
			next.reviewer += 1;
			// ⭐ THE RECORDED ELAPSED TIME, through the validator's clock: its `respondedAt` is read after this returns.
			virtualMs += call.elapsedMs;
			// ⭐ A RECORDED THROW IS THROWN AGAIN, with the tool's own message: the validator's seam sanitises it as it did.
			if (call.reply.status === 'THROWN') throw new Error(expand(call.reply.message));
			// ⭐ P5 package A (F1) — A RECORDED CUT IS CUT AGAIN: the product's class, the tool's message, the partial reply and
			// what the tool reported of the cut — and, as for every replayed reply, no identity a provider reported.
			if (call.reply.status === 'OUTPUT_LIMIT')
				throw new OutputLimitReached(expand(call.reply.message), {
					facts: {
						...(call.reply.finishReason === null ? {} : { finishReason: call.reply.finishReason }),
						...(call.reply.outputTokens === null ? {} : { outputTokens: call.reply.outputTokens })
					},
					partialReply: expand(call.reply.partialReply),
					observedToolCalls: REPLAYED_REVIEW_OBSERVATION
				});
			const text = replyText(call, expand);
			return {
				answer: answerFromText(text),
				rawOutput: text,
				producer: { ...call.evaluator },
				// ⛔ NEVER `PROVIDER_REPORTED`: no provider reported this call, and a replayed record that said one did would
				// state a fact about a call that did not happen (`REG-F-530`, "Identity"). The host asserts the recorded
				// identity, and the record grades it so.
				identityEvidence: 'HOST_CONFIGURED',
				observedToolCalls: REPLAYED_REVIEW_OBSERVATION
			};
		}
	};
}

/**
 * ⭐ THE PRODUCT'S BOUND FOR A REVIEWING TOOL (finding 8): `REVIEWER_CALL_BOUND_MS`, the bound the product's own validator
 * holds that tool's thrown calls to, or undefined for a tool the product declares none for (whose throws then stand).
 */
export function productCallBoundFor(agentId: string): number | undefined {
	return agentId === 'devin' || agentId === 'agy' ? REVIEWER_CALL_BOUND_MS[agentId] : undefined;
}

/**
 * ⭐⭐ FINDING 8 — WHERE THE PRODUCT'S BOUND WOULD DISPOSE A RECORDED THROW OTHERWISE THAN THE RUN DID, one sentence each.
 * The validator runs a thrown call once more when it threw short of the bound, and lets it stand at or past it, or when
 * it was itself the retry (`thrownCallDisposal`); the recording says what the run did by its NEXT call, a `retry` or not.
 * A disagreement means the recording was made under another bound — the review's case among them, a throw that elapsed
 * beyond the product's bound and was retried — and a replay of it would ask for a call the recording does not hold, or
 * skip one it does. ⚠ A throw past the bound that the run let stand AGREES (a timeout, killed at the bound): it replays.
 */
export function boundDisagreements(recording: Recording, bound: number | undefined): string[] {
	const out: string[] = [];
	recording.reviewer.forEach((call, index) => {
		// ⭐ P5 package A (F1) — a recorded cut is a thrown call too, disposed by the same bound.
		if ((call.reply.status !== 'THROWN' && call.reply.status !== 'OUTPUT_LIMIT') || call.role === 'retry') return;
		const recordedRetry = recording.reviewer[index + 1]?.role === 'retry';
		const productRetries = bound !== undefined && call.elapsedMs < bound;
		if (recordedRetry === productRetries) return;
		out.push(
			`${describeCall(index, call)} threw after ${call.elapsedMs} ms and the recorded run ` +
				`${recordedRetry ? 'ran it once more' : 'let it stand'}, where the product's bound for ` +
				`'${recording.manifest.models.reviewer.agentId}' — ` +
				`${bound === undefined ? 'none declared' : `${bound} ms`} — would ` +
				`${productRetries ? 'run it once more' : 'let it stand'}`
		);
	});
	return out;
}

/** The replays this process has opened, by recording folder: one replay per recording, from its first call. */
const opened = new Map<string, ReplayRun>();

/**
 * ⭐ THE REPLAY OF THE RECORDING `JPWB_REPLAY` NAMES — opened on first use and held, so the executor, the runner and the
 * reviewer of one run draw on one set of cursors. ⛔ Throws `RecordingRefusal` when the folder is not a recording this
 * replay can read: every caller records the refusal on what it was opening, and nothing replays.
 * ⭐ FINDING 8 — AND WHEN THE PRODUCT'S BOUND WOULD DISPOSE ONE OF ITS THROWS OTHERWISE (`boundDisagreements`): refused
 * at open, by every arm alike, rather than diverging at the throw.
 */
export function replayRunFor(dir: string): ReplayRun {
	let run = opened.get(dir);
	if (run === undefined) {
		const recording = readRecording(dir);
		const disagreements = boundDisagreements(
			recording,
			productCallBoundFor(recording.manifest.models.reviewer.agentId)
		);
		if (disagreements.length > 0)
			throw new RecordingRefusal(
				"the recording is refused: its thrown reviewer calls were disposed under another bound than the product's " +
					`(finding 8): ${disagreements.join('; ')}`
			);
		run = createReplayRun(recording);
		opened.set(dir, run);
	}
	return run;
}

/** Forget every opened replay — so a test that replays twice starts each from its first call. */
export function forgetReplayRuns(): void {
	opened.clear();
}
