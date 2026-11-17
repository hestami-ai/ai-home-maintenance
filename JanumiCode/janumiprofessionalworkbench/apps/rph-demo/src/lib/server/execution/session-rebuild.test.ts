// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D85, "The ninth run's units" (`REG-D-167` (4)) — A SESSION FILE REBUILT FROM A RECORDED CONVERSATION, so a
// replacement can fork a predecessor whose session was held in memory: written as Pi itself stores each item, marked rebuilt, and held by a round
// trip — Pi's own conversion of the rebuilt session's messages gives back the recorded `input`, item for item, any item it does not named with why.
//
// ⭑ THE FIXTURES ARE SYNTHETIC, IN THE RECORDED SHAPE (the lead's measurement of the ninth run's record): a provider request's `input` as Pi's own
// Responses conversion builds it — a user turn, reasoning items carrying encrypted content, function calls and their outputs, and, for a unit with
// two turns in one session, the first turn's answer as an assistant message — made here by that conversion from messages this test writes, so no
// recorded text is copied. The raw output is the final answer, the execution contract's envelope.
// ⛔ NO MODEL: nothing is sent; Pi's session manager and its conversion run in process.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convertResponsesMessages } from '@earendil-works/pi-ai/api/openai-responses-shared';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { afterAll, describe, expect, it } from 'vitest';
import { REBUILT_MARK, rebuildExecutorSession, type RecordedConversation } from './session-rebuild.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-session-rebuild-'));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
const WORKSPACE = join(ROOT, 'workspace');
mkdirSync(WORKSPACE, { recursive: true });
let n = 0;
const folder = (): string => join(ROOT, 'demo.sqlite.sessions', 'executor', `pwu_${++n}`);

const MODEL = { id: 'gpt-fixture', api: 'openai-responses', provider: 'openai-codex' } as const;
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const assistant = (content: readonly Record<string, unknown>[]) => ({
	role: 'assistant',
	content,
	api: MODEL.api,
	provider: MODEL.provider,
	model: MODEL.id,
	usage,
	stopReason: content.some((b) => b.type === 'toolCall') ? 'toolUse' : 'stop',
	timestamp: 1
});
const reasoning = (id: string) => ({
	type: 'thinking',
	thinking: '',
	thinkingSignature: JSON.stringify({ type: 'reasoning', id, summary: [], encrypted_content: `gAAAAB-fixture-${id}` })
});
const call = (callId: string, itemId: string, argv: readonly string[]) => ({
	type: 'toolCall',
	id: `${callId}|${itemId}`,
	name: 'run_command',
	arguments: { argv }
});
const result = (callId: string, itemId: string, text: string) => ({
	role: 'toolResult',
	toolCallId: `${callId}|${itemId}`,
	toolName: 'run_command',
	content: [{ type: 'text', text }],
	isError: false,
	timestamp: 1
});

/**
 * A provider request's `input` as Pi's own Responses conversion builds it from `messages`, then as the record holds it: JSON, read back — so a key
 * the conversion leaves `undefined` (an assistant message's absent `phase`) is no key, as in a recorded request.
 */
const recordedInput = (messages: readonly unknown[]): Record<string, unknown>[] =>
	JSON.parse(
		JSON.stringify(
			convertResponsesMessages(
				{ ...MODEL, input: ['text'], reasoning: true } as never,
				{ systemPrompt: 'The execution contract.', messages } as never,
				new Set([MODEL.provider])
			)
		)
	) as Record<string, unknown>[];

const ENVELOPE = JSON.stringify({ workProduct: { document: 'The Source.' }, rationale: { rationale: 'An account.' } });

/** One turn's conversation: an instruction, reasoning, two commands and their outputs — then the final answer, the raw output. */
const ONE_TURN = recordedInput([
	{ role: 'user', content: [{ type: 'text', text: 'Write the Source.' }], timestamp: 1 },
	assistant([reasoning('rs_1'), call('call_1', 'fc_1', ['node', '--version'])]),
	result('call_1', 'fc_1', 'v24.22.3'),
	assistant([reasoning('rs_2'), call('call_2', 'fc_2', ['node', '--test'])]),
	result('call_2', 'fc_2', 'pass 3')
]);
/** Two turns in one session: the first turn's answer an assistant message, then a second user turn. */
const TWO_TURNS = recordedInput([
	{ role: 'user', content: [{ type: 'text', text: 'Write the Unit Test Suite.' }], timestamp: 1 },
	assistant([reasoning('rs_1'), call('call_1', 'fc_1', ['node', '--test'])]),
	result('call_1', 'fc_1', 'fail 1'),
	assistant([{ type: 'text', text: ENVELOPE, textSignature: JSON.stringify({ v: 1, id: 'msg_1' }) }]),
	{ role: 'user', content: [{ type: 'text', text: 'Produce the work product again, addressing these findings.' }], timestamp: 2 },
	assistant([reasoning('rs_2'), call('call_2', 'fc_2', ['node', '--test'])]),
	result('call_2', 'fc_2', 'pass 3')
]);

const conversationOf = (input: readonly unknown[]): RecordedConversation => ({
	exchangeId: 'mex_fixture',
	request: { input },
	rawOutput: ENVELOPE,
	model: MODEL
});
/** The entries of a session file, each parsed. */
const entries = (file: string) =>
	readFileSync(file, 'utf8')
		.trim()
		.split('\n')
		.map((l) => JSON.parse(l) as { type: string; customType?: string; data?: unknown; message?: { role?: string } });

describe('⭐⭐ L17b1 (D85) — a session file rebuilt from the record, held by Pi’s own round trip', () => {
	it('⛔ RED FIRST — one turn’s conversation: every recorded item given back by Pi’s conversion, item for item; the system prompt left out, named; the final answer last', () => {
		const at = folder();
		const rebuilt = rebuildExecutorSession(conversationOf(ONE_TURN), at, WORKSPACE, () => 5);

		expect(rebuilt.notGivenBack, 'an item Pi does not give back as recorded').toEqual([]);
		expect(rebuilt.leftOut, 'the system prompt is not the one item left out').toEqual([
			{ index: 0, why: 'the system prompt: Pi builds it from its loader when the session opens, never from the session' }
		]);
		const context = SessionManager.open(rebuilt.file, undefined, WORKSPACE).buildSessionContext();
		expect(
			context.messages.map((m) => (m as { role: string }).role),
			'the rebuilt messages are not the recorded turn, its two calls and results, and the final answer'
		).toEqual(['user', 'assistant', 'toolResult', 'assistant', 'toolResult', 'assistant']);
		const last = context.messages.at(-1) as { content: { type: string; text?: string }[] };
		expect(last.content, 'the final answer is not the raw output').toEqual([{ type: 'text', text: ENVELOPE }]);
	});

	it('⛔ RED FIRST — two turns in one session: the first answer an assistant message, the second user turn after it, each given back as recorded', () => {
		const rebuilt = rebuildExecutorSession(conversationOf(TWO_TURNS), folder(), WORKSPACE, () => 5);

		expect(rebuilt.notGivenBack, 'an item Pi does not give back as recorded').toEqual([]);
		const context = SessionManager.open(rebuilt.file, undefined, WORKSPACE).buildSessionContext();
		expect(context.messages.map((m) => (m as { role: string }).role), 'the rebuilt turns are not in their order').toEqual([
			'user',
			'assistant',
			'toolResult',
			'assistant',
			'user',
			'assistant',
			'toolResult',
			'assistant'
		]);
	});

	it('⛔ RED FIRST — the file is marked rebuilt, first, by an entry that never reaches a model', () => {
		const rebuilt = rebuildExecutorSession(conversationOf(ONE_TURN), folder(), WORKSPACE, () => 5);

		const [header, mark] = entries(rebuilt.file);
		expect([header?.type, mark?.type, mark?.customType, mark?.data], 'the file is not marked rebuilt, first').toEqual([
			'session',
			'custom',
			REBUILT_MARK,
			{ exchangeId: 'mex_fixture', items: ONE_TURN.length }
		]);
		const context = SessionManager.open(rebuilt.file, undefined, WORKSPACE).buildSessionContext();
		expect(JSON.stringify(context.messages), 'the mark reached the model’s context').not.toContain(REBUILT_MARK);
	});

	it('⛔ RED FIRST — an item Pi gives back otherwise is named with why, never silently repaired: arguments not in Pi’s compact form, an empty output', () => {
		const input = ONE_TURN.map((item) => {
			if (item.type === 'function_call' && item.call_id === 'call_1') return { ...item, arguments: '{ "argv": ["node", "--version"] }' };
			if (item.type === 'function_call_output' && item.call_id === 'call_2') return { ...item, output: '' };
			return item;
		});
		const rebuilt = rebuildExecutorSession(conversationOf(input), folder(), WORKSPACE, () => 5);

		expect(rebuilt.notGivenBack, 'the two items Pi does not give back as recorded are not named, each with why').toEqual([
			{
				index: input.findIndex((i) => i.type === 'function_call' && i.call_id === 'call_1'),
				why: 'its arguments come back re-serialised by Pi (JSON.stringify of the parsed object), and the recorded string was not in that form'
			},
			{
				index: input.findIndex((i) => i.type === 'function_call_output' && i.call_id === 'call_2'),
				why: 'an empty output comes back as Pi\'s "(no tool output)"'
			}
		]);
	});

	it('⭑ CONTROL — a folder that already holds a session file is refused: a rebuild never writes beside the unit’s own session', () => {
		const at = folder();
		mkdirSync(at, { recursive: true });
		writeFileSync(join(at, 'own.jsonl'), '');
		expect(() => rebuildExecutorSession(conversationOf(ONE_TURN), at, WORKSPACE), 'the rebuild wrote beside a session').toThrow(
			'already holds a session file'
		);
	});
});
