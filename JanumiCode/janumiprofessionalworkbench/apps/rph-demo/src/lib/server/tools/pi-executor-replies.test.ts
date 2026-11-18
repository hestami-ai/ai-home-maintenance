// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D92 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.46; `REG-F-651`), D91 (§12.45; `REG-F-649`)
// and D89 (§12.43) — WHAT THE EXECUTOR'S ADAPTER GATHERS INTO A TRY'S ANSWER, AND WHAT IT SAYS BESIDE IT: a reply Pi dropped to go on — by its retry,
// or by its overflow recovery — leaves the answer and is recorded beside it with its error and its place among the try's replies (D92; §7.4 (3)); the
// stops of the messages the answer was gathered from are given with it, as each message's end gives them (D91, the lead's ruling 11); and the session
// says which tools it minted (D89).
// ⭑ WHAT IT DRIVES: `openPiExecutionSession` itself, Pi's real settings manager, loader and session, over pi-ai's faux core, as
// `pi-executor-session.test.ts` does. Measured first at Stage 0 (`l17b3-facts.md` §2.8): the errored reply's `message_end` arrives, then
// `agent_end` with `willRetry`, then `auto_retry_start`, then the retry's own messages; an overflow goes on through `compaction_start` and
// `compaction_end` with `willRetry`, and no retry event.
// ⭑ THE TEMPORARY AGENT FOLDER SETS TWO SETTINGS OF ITS OWN: `retry.baseDelayMs` 5 (Pi's default 2,000), so a retry waits little, and
// `compaction.keepRecentTokens` 1 (Pi's default 20,000), so a short session has something to compact. Neither is the executor's: it sets
// neither, and Pi's retry and compaction stay on (D92).
// ⭐ STRENGTHENED 2026-11-18 (the review's L17-11 and L17-15, §7.4 (1) and (2)): kept replies before and after a tool call, joined as today; a kept
// reply before a compaction, kept; retries exhausted, the last errored reply kept with its stop; a recovery that cannot go on, its last reply kept;
// the last captured request holding no dropped reply's message; and a provider stream whose message STARTS with stop `stop` and only at its END
// is `error` or `aborted`, as a real provider's stream is (`openai-responses.js`), so an adapter that read the stop at `message_start` fails.
// ⛔ NO MODEL, NO NETWORK, NOTHING OF THE OPERATOR'S: the agent and home folders are temporary, `PI_OFFLINE` is set, the faux core answers in
// process, and a compaction's summary requests are answered by the same script.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import {
	createFauxCore,
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	registerApiProvider,
	unregisterApiProviders,
	type FauxResponseFactory
} from '@earendil-works/pi-ai/compat';
import { convertResponsesMessages, convertResponsesTools } from '@earendil-works/pi-ai/api/openai-responses-shared';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { IN_MEMORY_SESSION, type ProducerSessionContext } from '../execution/producer-session.js';
import { isToolInvocationResult, type ToolInvocationResult } from './backing-tool.js';
import { openPiExecutionSession } from './pi-executor.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-pi-executor-replies-'));
const AGENT = join(ROOT, 'agent');
const WORKSPACE = join(ROOT, 'runs', 'workspace');
const PROVIDER = 'jpwb-faux';
const API = 'jpwb-faux-replies';
const SOURCE_ID = 'pi-executor-replies.test';
const MODEL = `${PROVIDER}/faux-model`;
const SUMMARY_SYSTEM = 'You are a context summarization assistant';
const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

/**
 * One scripted reply: its text, a tool call where it makes one, and how it ends. ⭐ `provisional`: the reply is streamed as a real provider streams
 * one — its `start` saying stop `stop`, its END saying `error` or `aborted` — never as the faux core does, whose start already carries the end.
 */
type Reply = {
	readonly text: string;
	readonly toolCall?: { readonly name: string; readonly args: Record<string, unknown> };
	readonly stopReason?: 'stop' | 'error' | 'toolUse';
	readonly errorMessage?: string;
	readonly provisional?: 'error' | 'aborted';
};
let script: Reply[] = [];
const faux = createFauxCore({ api: API, provider: PROVIDER, models: [{ id: 'faux-model' }] });
/** Hand Pi's `onPayload` the request a Responses provider builds from this context, as a real provider does before it sends. */
const payloadOf = async (context: Parameters<FauxResponseFactory>[0], options: Parameters<FauxResponseFactory>[1], model: Parameters<FauxResponseFactory>[3]) =>
	options?.onPayload?.(
		{
			model: model.id,
			input: convertResponsesMessages(model, context, new Set([model.provider])),
			...(context.tools && context.tools.length > 0 ? { tools: convertResponsesTools(context.tools) } : {})
		},
		model
	);
/** Every faux call is answered here: a compaction's summary request apart, else the script's next reply, after handing `onPayload` the request. */
const dispatcher: FauxResponseFactory = async (context, options, _state, model) => {
	if (typeof context.systemPrompt === 'string' && context.systemPrompt.startsWith(SUMMARY_SYSTEM)) return fauxAssistantMessage('A summary of the earlier turns.');
	await payloadOf(context, options, model);
	const next = script.shift() ?? { text: '', stopReason: 'error', errorMessage: 'the test’s script is exhausted' };
	const content = next.toolCall === undefined ? [fauxText(next.text)] : [fauxText(next.text), fauxToolCall(next.toolCall.name, next.toolCall.args)];
	return fauxAssistantMessage(content, { stopReason: next.stopReason ?? 'stop', ...(next.errorMessage ? { errorMessage: next.errorMessage } : {}) });
};
/** ⭐ L17-15 — a reply streamed as a real provider streams it: `start` with stop `stop`, its text, then the END — `error` or `aborted` — carrying it. */
function provisionalStream(model: { readonly api: string; readonly provider: string; readonly id: string }, reply: Reply) {
	const stream = createAssistantMessageEventStream();
	const base = { role: 'assistant' as const, content: [] as { type: 'text'; text: string }[], api: model.api, provider: model.provider, model: model.id, usage: ZERO_USAGE, stopReason: 'stop' as const, timestamp: Date.now() };
	queueMicrotask(() => {
		stream.push({ type: 'start', partial: { ...base } } as never);
		const partial = { ...base, content: [{ type: 'text' as const, text: '' }] };
		stream.push({ type: 'text_start', contentIndex: 0, partial: { ...partial } } as never);
		partial.content[0]!.text = reply.text;
		stream.push({ type: 'text_delta', contentIndex: 0, delta: reply.text, partial: { ...partial, content: [{ type: 'text', text: reply.text }] } } as never);
		stream.push({ type: 'text_end', contentIndex: 0, content: reply.text, partial: { ...partial, content: [{ type: 'text', text: reply.text }] } } as never);
		const final = {
			...base,
			content: [{ type: 'text' as const, text: reply.text }],
			stopReason: reply.provisional!,
			errorMessage: reply.errorMessage ?? (reply.provisional === 'aborted' ? 'Request was aborted' : 'provider error')
		};
		stream.push({ type: 'error', reason: reply.provisional, error: final } as never);
		stream.end(final as never);
	});
	return stream;
}
/** The provider registered for the faux API: the faux core's stream, but a provisional reply streamed as a real provider streams it. */
const routed = (model: Parameters<typeof faux.stream>[0], context: Parameters<typeof faux.stream>[1], options: Parameters<typeof faux.stream>[2]) => {
	const summary = typeof context.systemPrompt === 'string' && context.systemPrompt.startsWith(SUMMARY_SYSTEM);
	if (!summary && script[0]?.provisional !== undefined) {
		const reply = script.shift()!;
		void payloadOf(context as never, options as never, model as never);
		return provisionalStream(model, reply);
	}
	return faux.stream(model, context, options);
};

const context: ProducerSessionContext = {
	workspace: {
		ownerId: 'pi-executor-replies-test',
		ownerKind: 'UNDERTAKING',
		materialization: 'FILESYSTEM',
		directoryPath: WORKSPACE,
		purgeability: 'PURGEABLE_AT_EXPIRY'
	} as unknown as Workspace,
	runner: { kind: 'REAL' } as unknown as ProcessRunner,
	grantedCapabilities: [],
	bindingAuthorizationStatus: 'AUTHORIZED'
};

/** Each turn of `turns` on one session, each answered from its replies: the results, in order. The session is disposed after. */
async function turnsOf(turns: readonly { readonly text: string; readonly replies: readonly Reply[] }[], over: Partial<ProducerSessionContext> = {}) {
	faux.setResponses(Array.from({ length: 64 }, () => dispatcher));
	const session = await openPiExecutionSession({ ...context, ...over }, MODEL, IN_MEMORY_SESSION);
	const results: ToolInvocationResult[] = [];
	try {
		for (const turn of turns) {
			script = [...turn.replies];
			const r = await session.turn(turn.text);
			expect(isToolInvocationResult(r), 'arrangement: Pi’s adapter answers with a result').toBe(true);
			results.push(r as ToolInvocationResult);
		}
	} finally {
		session.dispose();
	}
	return results;
}
const answerOf = (r: ToolInvocationResult): string => (r.answer.arrived ? r.answer.text : `(no answer: ${r.answer.cause})`);
/** A call of a tool this session was never given (none is minted here): Pi answers it with an error result and the prompt goes on. */
const A_TOOL_CALL = { name: 'write_file', args: { path: 'notes.txt', contents: 'x' } } as const;
/** An earlier turn whose answer gives a compaction something to fold. */
const EARLIER = { text: 'Write the Source.', replies: [{ text: `FIRST-TURN-ANSWER ${'x'.repeat(400)}` }] } as const;

beforeAll(() => {
	const write = (path: string, text: string): void => {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
	};
	write(
		join(AGENT, 'models.json'),
		JSON.stringify({
			providers: {
				[PROVIDER]: {
					// ⭑ Required by Pi's schema of a provider that declares models; never reached — the API is the faux one.
					baseUrl: 'http://127.0.0.1:9',
					apiKey: 'unused-by-the-faux-provider',
					api: API,
					models: [{ id: 'faux-model', reasoning: false, input: ['text'] }]
				}
			}
		})
	);
	write(join(AGENT, 'settings.json'), JSON.stringify({ retry: { baseDelayMs: 5 }, compaction: { keepRecentTokens: 1 } }));
	mkdirSync(WORKSPACE, { recursive: true });
	vi.stubEnv('PI_CODING_AGENT_DIR', AGENT);
	vi.stubEnv('HOME', join(ROOT, 'home'));
	vi.stubEnv('USERPROFILE', join(ROOT, 'home'));
	vi.stubEnv('PI_OFFLINE', '1');
	registerApiProvider({ api: faux.api, stream: routed as never, streamSimple: routed as never }, SOURCE_ID);
});

afterAll(() => {
	unregisterApiProviders(SOURCE_ID);
	vi.unstubAllEnvs();
	rmSync(ROOT, { recursive: true, force: true });
});

describe('⭐⭐ L17b3 (D92) — a reply Pi dropped to go on leaves the answer and is recorded beside it', () => {
	it('⛔ RED FIRST — a reply that streams text and then ends in a retryable error, then a retry that answers: the answer is the retry’s text alone, the dropped reply recorded beside it with its error', async () => {
		const [r] = await turnsOf([
			{
				text: 'Write the Source.',
				replies: [{ text: 'PARTIAL-A1 text before the break. ', stopReason: 'error', errorMessage: '503 Service Unavailable' }, { text: 'ANSWER-B1 the retry answers.' }]
			}
		]);
		expect(answerOf(r!), 'the answer joined the dropped reply to the retry’s').toBe('ANSWER-B1 the retry answers.');
		expect(r!.rawOutput, 'the raw output joined the dropped reply to the retry’s').toBe('ANSWER-B1 the retry answers.');
		expect(r!.droppedReplies, 'the dropped reply is not recorded beside the answer, with its error, how Pi went on and its place').toEqual([
			{ text: 'PARTIAL-A1 text before the break. ', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }
		]);
		// ⭐ L17-11 (e) — the last request the adapter captured, the retry's, holds no message of the dropped reply (D92: "holds no message of a dropped reply").
		expect([r!.materializedInput?.includes('Write the Source.'), r!.materializedInput?.includes('PARTIAL-A1')], 'the last captured request holds a dropped reply’s message').toEqual([true, false]);
	});

	it('⛔ RED FIRST — two retries: each dropped reply recorded, in order, with its attempt and its place', async () => {
		const [r] = await turnsOf([
			{
				text: 'Write the Source.',
				replies: [
					{ text: 'PARTIAL-A2a ', stopReason: 'error', errorMessage: 'overloaded' },
					{ text: 'PARTIAL-A2b ', stopReason: 'error', errorMessage: '502 Bad Gateway' },
					{ text: 'ANSWER-B2 the second retry answers.' }
				]
			}
		]);
		expect(answerOf(r!), 'the answer joined the dropped replies to the last').toBe('ANSWER-B2 the second retry answers.');
		expect(r!.droppedReplies, 'the dropped replies are not recorded in order, each with its attempt and place').toEqual([
			{ text: 'PARTIAL-A2a ', stopReason: 'error', errorMessage: 'overloaded', wentOnBy: 'RETRY', attempt: 1, place: 1 },
			{ text: 'PARTIAL-A2b ', stopReason: 'error', errorMessage: '502 Bad Gateway', wentOnBy: 'RETRY', attempt: 2, place: 2 }
		]);
	});

	it('⛔ RED FIRST — a reply that streams text and then overflows the context, then a compaction and a reply that answers: the answer is the last reply’s text alone, the dropped reply recorded as gone on by the compaction', async () => {
		const [, r] = await turnsOf([
			EARLIER,
			{
				text: 'Produce it again.',
				replies: [{ text: 'PARTIAL-P3 text before the overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded' }, { text: 'ANSWER-Q3 the reply after the compaction.' }]
			}
		]);
		expect(answerOf(r!), 'the answer joined the overflowed reply to the one after the compaction').toBe('ANSWER-Q3 the reply after the compaction.');
		expect(r!.droppedReplies, 'the overflowed reply is not recorded as gone on by the compaction').toEqual([
			{ text: 'PARTIAL-P3 text before the overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded', wentOnBy: 'COMPACTION', place: 1 }
		]);
	});

	it('⛔ RED FIRST — the last reply of a prompt ending in an error is kept in the answer as today, its stop given with it (D91)', async () => {
		const [r] = await turnsOf([
			{ text: 'Write the Source.', replies: [{ text: 'PARTIAL-Z4 text before a non-retryable error. ', stopReason: 'error', errorMessage: 'invalid request: unsupported parameter' }] }
		]);
		expect(answerOf(r!), 'the last reply’s text was taken out of the answer').toBe('PARTIAL-Z4 text before a non-retryable error. ');
		expect(r!.droppedReplies, 'the last reply was recorded as dropped').toBeUndefined();
		expect(r!.gatheredFrom, 'the last reply’s stop is not given with the answer').toEqual([{ stopReason: 'error' }]);
	});

	it('⭑ CONTROL — a try in which Pi drops no reply: the answer byte for byte today’s, nothing dropped', async () => {
		const [r] = await turnsOf([{ text: 'Write the Source.', replies: [{ text: 'CONTROL-ANSWER6 one reply.' }] }]);
		expect([answerOf(r!), r!.rawOutput, r!.droppedReplies], 'a try with no dropped reply moved').toEqual(['CONTROL-ANSWER6 one reply.', 'CONTROL-ANSWER6 one reply.', undefined]);
	});

	// ── ⭐ L17-11, by D92's text (§7.4 (2)) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
	it('⛔ RED FIRST — (a) kept replies before and after a tool call stay in the answer, joined as today; nothing dropped; the stops of both given (D92: "Every other reply’s text stays in the answer, joined as today")', async () => {
		const [r] = await turnsOf([{ text: 'Write the Source.', replies: [{ text: 'KEPT-ONE ', toolCall: A_TOOL_CALL, stopReason: 'toolUse' }, { text: 'KEPT-TWO' }] }]);
		expect([answerOf(r!), r!.droppedReplies], 'a kept reply before a tool call left the answer, or was recorded as dropped').toEqual(['KEPT-ONE KEPT-TWO', undefined]);
		expect(r!.gatheredFrom, 'the stops of the messages the answer was gathered from are not given').toEqual([{ stopReason: 'toolUse' }, { stopReason: 'stop' }]);
	});

	it('⛔ RED FIRST — (b) a kept reply before a compaction is kept — the compaction folds it into its summary, and D85 counts it held — while the overflowed reply after it is dropped, its place the second', async () => {
		const [, r] = await turnsOf([
			EARLIER,
			{
				text: 'Produce it again.',
				replies: [
					{ text: 'KEPT-BEFORE ', toolCall: A_TOOL_CALL, stopReason: 'toolUse' },
					{ text: 'PARTIAL-B text before the overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded' },
					{ text: 'ANSWER-AFTER the compaction.' }
				]
			}
		]);
		expect(answerOf(r!), 'the kept reply before the compaction left the answer, or the overflowed one stayed').toBe('KEPT-BEFORE ANSWER-AFTER the compaction.');
		expect(r!.droppedReplies, 'the overflowed reply is not recorded, in its place').toEqual([
			{ text: 'PARTIAL-B text before the overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded', wentOnBy: 'COMPACTION', place: 2 }
		]);
	});

	it('⛔ RED FIRST — (c) retries exhausted: each errored reply followed by another is dropped, in order; the last errored reply is the prompt’s last, kept, its stop given', async () => {
		const [r] = await turnsOf([
			{
				text: 'Write the Source.',
				replies: [1, 2, 3].map((n) => ({ text: `PARTIAL-C${n} `, stopReason: 'error' as const, errorMessage: '503 Service Unavailable' })).concat([
					{ text: 'FINAL-C4 the last errored reply. ', stopReason: 'error' as const, errorMessage: '503 Service Unavailable' }
				])
			}
		]);
		expect(answerOf(r!), 'the last errored reply was taken out of the answer, or the dropped ones stayed').toBe('FINAL-C4 the last errored reply. ');
		expect(r!.droppedReplies, 'the three replies the retries dropped are not recorded, in order, each with its attempt and place').toEqual(
			[1, 2, 3].map((n) => ({ text: `PARTIAL-C${n} `, stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: n, place: n }))
		);
		expect(r!.gatheredFrom, 'the kept reply’s stop is not given').toEqual([{ stopReason: 'error' }]);
	});

	it('⛔ RED FIRST — (d) a recovery that cannot go on: an overflow after one compact-and-retry ends the prompt (Pi: "recovery failed after one compact-and-retry attempt") — the first overflowed reply dropped, the second the prompt’s last, kept, its stop given', async () => {
		const [, r] = await turnsOf([
			EARLIER,
			{
				text: 'Produce it again.',
				replies: [
					{ text: 'PARTIAL-D1 the first overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded' },
					{ text: 'FINAL-D2 the second overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded' }
				]
			}
		]);
		expect(answerOf(r!), 'the prompt’s last reply was taken out of the answer, or the first overflow stayed').toBe('FINAL-D2 the second overflow. ');
		expect(r!.droppedReplies, 'the first overflowed reply is not recorded as gone on by the compaction').toEqual([
			{ text: 'PARTIAL-D1 the first overflow. ', stopReason: 'error', errorMessage: 'context_length_exceeded', wentOnBy: 'COMPACTION', place: 1 }
		]);
		expect(r!.gatheredFrom, 'the kept reply’s stop is not given').toEqual([{ stopReason: 'error' }]);
	});

	// ⭐⭐ §7.4 (3) — A DROPPED REPLY'S PLACE IS EXPLICIT: its ordinal among the try's assistant replies, dropped and kept counted alike, in arrival order.
	it('⛔ RED FIRST — interleaved replies — a kept reply with a tool call, then a reply the retry dropped, then the retry’s: the dropped reply’s place is the second; the kept ones joined in the answer (§7.4 (3))', async () => {
		const [r] = await turnsOf([
			{
				text: 'Write the Source.',
				replies: [
					{ text: 'KEPT-I1 ', toolCall: A_TOOL_CALL, stopReason: 'toolUse' },
					{ text: 'PARTIAL-I2 text before the break. ', stopReason: 'error', errorMessage: '503 Service Unavailable' },
					{ text: 'ANSWER-I3 the retry answers.' }
				]
			}
		]);
		expect(answerOf(r!), 'the kept replies are not joined in the answer, or the dropped one stayed').toBe('KEPT-I1 ANSWER-I3 the retry answers.');
		expect(r!.droppedReplies, 'the dropped reply is not recorded in its place').toEqual([
			{ text: 'PARTIAL-I2 text before the break. ', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 2 }
		]);
		expect(r!.gatheredFrom, 'the stops of the kept replies are not given').toEqual([{ stopReason: 'toolUse' }, { stopReason: 'stop' }]);
	});
});

describe('⭐⭐ L17b3 (D91; the lead’s ruling 11) — the stops of the messages an answer was gathered from', () => {
	it('⛔ RED FIRST — the stops of the messages an answer was gathered from are given with it (D91)', async () => {
		const [plain] = await turnsOf([{ text: 'Write the Source.', replies: [{ text: 'The Source.' }] }]);
		const [retried] = await turnsOf([
			{ text: 'Write the Source.', replies: [{ text: 'PARTIAL ', stopReason: 'error', errorMessage: '503 Service Unavailable' }, { text: 'The Source.' }] }
		]);
		expect([plain!.gatheredFrom, retried!.gatheredFrom], 'the stops of the gathered messages are not given, or a dropped reply’s is among them').toEqual([
			[{ stopReason: 'stop' }],
			[{ stopReason: 'stop' }]
		]);
	});

	// ⭐ L17-15 — the stop read where D91 says it is read, at the message's END: a real provider's stream starts each message with stop `stop`.
	it('⛔ RED FIRST — a reply whose stream starts with stop `stop` and ends `error` is dropped by the retry and its stop is the end’s; one that ends `aborted` is the prompt’s last, its stop `aborted` (D91: "as it reads them at each message’s end")', async () => {
		const [errored] = await turnsOf([
			{ text: 'Write the Source.', replies: [{ text: 'PARTIAL-P15 ', provisional: 'error', errorMessage: '503 Service Unavailable' }, { text: 'ANSWER-15 the retry answers.' }] }
		]);
		const [aborted] = await turnsOf([{ text: 'Write the Source.', replies: [{ text: 'ABORTED-15 ', provisional: 'aborted' }] }]);
		expect(
			[answerOf(errored!), errored!.droppedReplies?.map((d) => [d.text, d.stopReason, d.wentOnBy, d.place]), errored!.gatheredFrom],
			'a reply whose end said error was read by its start: kept in the answer, or not recorded as dropped'
		).toEqual(['ANSWER-15 the retry answers.', [['PARTIAL-P15 ', 'error', 'RETRY', 1]], [{ stopReason: 'stop' }]]);
		expect([aborted!.droppedReplies, aborted!.gatheredFrom], 'a reply whose end said aborted was read by its start').toEqual([undefined, [{ stopReason: 'aborted' }]]);
	});
});

describe('⭐⭐ L17b3 (D89) — the session says which tools it minted', () => {
	it('⛔ RED FIRST — the session says which tools it minted: read_earlier_attempt with its grant and a record to read, neither alone (D89)', async () => {
		const port = {
			readerUnitId: 'pwu_src2',
			attemptKey: 'step_1#1',
			currentTry: () => 1,
			units: [{ unitId: 'pwu_src', title: 'Source Construction', state: 'REJECTED', hasRecord: true }],
			conversationOf: async () => ({ unitId: 'pwu_src', title: 'Source Construction', exchanges: [] }),
			record: async () => ({ recorded: true, storageKey: 'k' })
		};
		const mintedWith = async (over: Partial<ProducerSessionContext>): Promise<unknown> => {
			faux.setResponses([]);
			const session = await openPiExecutionSession({ ...context, ...over }, MODEL, IN_MEMORY_SESSION);
			try {
				return (session as { mintedToolNames?: unknown }).mintedToolNames;
			} finally {
				session.dispose();
			}
		};
		expect(
			[
				await mintedWith({ grantedCapabilities: ['earlier-attempt-record'], earlierAttempt: port } as never),
				await mintedWith({ grantedCapabilities: ['earlier-attempt-record'] }),
				await mintedWith({ grantedCapabilities: [], earlierAttempt: port } as never)
			],
			'the session does not say which tools it minted, or minted the record’s tool without its grant or without a record'
		).toEqual([['read_earlier_attempt'], [], []]);
	});
});
