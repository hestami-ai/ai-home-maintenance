// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2, D3; `REG-D-111` (5); `REG-F-530`) — ONE REPLAY OF ONE
// RECORDING: the three cursors the replay's arms serve from, in the order the run dispatched them, and the one rule they
// share — a call that does not match its recording FAILS CLOSED, and so does every call after it.
//
// ── ⛔ WHAT EACH ARM CHECKS BEFORE IT ANSWERS ──────────────────────────────────────────────────────────────────────────
//   · the EXECUTOR (`replay-executor.ts`): the turn's text, scrubbed, hashes to the recorded `turnSha256`;
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
import { mkdirSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerFromText, type ToolInvocationResult } from '../tools/backing-tool.js';
import {
	expandText,
	readRecording,
	scrubPairs,
	scrubText,
	sha256Hex,
	type ExecutorTry,
	type RecordedCommand,
	type Recording,
	type ReviewerCall,
	type ScrubPair
} from './recording.js';

/** Why a replayed call was refused: the recording no longer matches, or it has no call left. */
export type ReplayRefusalCode = 'REPLAY_STALE' | 'REPLAY_EXHAUSTED';

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
	/** The next recorded executor try, if `turnText` hashes to it. ⛔ Throws `ReplayRefusal` otherwise. */
	nextExecutorTry(turnText: string): ExecutorTry;
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
			// Never reached: a THROWN reply is thrown again before its text is asked for (`reviewerPrint`).
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

		nextExecutorTry(turnText) {
			const index = next.executor;
			const what = `executor try ${index + 1}`;
			const already = afterPoison(what);
			if (already) throw already;
			const recorded = recording.executor[index];
			if (recorded === undefined) throw exhausted(what, recording.executor.length);
			const actual = sha256Hex(scrub(turnText));
			if (actual !== recorded.turnSha256)
				throw poison(
					new ReplayRefusal(
						'REPLAY_STALE',
						`${what} (unit ${recorded.unit}): the turn text's SHA-256 is ${actual}, and the recording's is ` +
							`${recorded.turnSha256}. The executor was sent another turn than the one recorded.`
					)
				);
			next.executor += 1;
			return recorded;
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

/** The replays this process has opened, by recording folder: one replay per recording, from its first call. */
const opened = new Map<string, ReplayRun>();

/**
 * ⭐ THE REPLAY OF THE RECORDING `JPWB_REPLAY` NAMES — opened on first use and held, so the executor, the runner and the
 * reviewer of one run draw on one set of cursors. ⛔ Throws `RecordingRefusal` when the folder is not a recording this
 * replay can read: every caller records the refusal on what it was opening, and nothing replays.
 */
export function replayRunFor(dir: string): ReplayRun {
	let run = opened.get(dir);
	if (run === undefined) {
		run = createReplayRun(readRecording(dir));
		opened.set(dir, run);
	}
	return run;
}

/** Forget every opened replay — so a test that replays twice starts each from its first call. */
export function forgetReplayRuns(): void {
	opened.clear();
}
