// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D85, "The ninth run's units" (`REG-D-167` (4)) — A PI SESSION FILE REBUILT FROM THE CONVERSATION THE
// GOVERNED STREAM RECORDED, so a replacement can fork a predecessor whose session was held in memory and is gone.
//
// ⭑ WHAT IS REBUILT (the lead's measurement of the ninth run's record, design D85). A unit's conversation is its LAST executor exchange's
// request `input` — the provider request of the turn's last call, the conversation up to the final answer
// (`pi-executor.ts`, *"const composite = turnInputs.at(-1)?.payload;"*) — then its raw output, the final answer. Each recorded item is written as Pi
// itself stores it (`pi-ai`, `openai-responses-shared.js`): a reasoning item whole, as an assistant message's thinking block's `thinkingSignature`
// (`:113`, `:407`); a function call as a tool call, `<call_id>|<id>`, its arguments parsed; an assistant message as a text block with Pi's text
// signature; a function call's output as a tool result. Consecutive items of one answer make one assistant message, as Pi stored them.
// ⭑ MARKED REBUILT: a `custom` entry first (`REBUILT_MARK`), which never reaches a model (`session-manager.js`, `sessionEntryToContextMessages`).
// ⭑ HELD BY A ROUND TRIP: Pi's own conversion of the rebuilt session's messages gives back the recorded `input`, item for item; an item it does not
// give back as recorded is named, with why — never silently repaired.
// ⚠ IT LOADS PI'S CODING AGENT AT MODULE SCOPE: nothing on the server's request path imports it (the lead runs it on a scanned extract of a run's
// record; its test runs it on synthetic fixtures of that recorded shape).
import { isDeepStrictEqual } from 'node:util';
import { convertResponsesMessages } from '@earendil-works/pi-ai/api/openai-responses-shared';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { sessionFilesIn } from './executor-session.js';

/** The `customType` of the entry that marks a session file rebuilt from the record (D85). */
export const REBUILT_MARK = 'jpwb.rebuilt-from-record';

/** One recorded executor conversation: its exchange, its request (the materialized input, parsed), its raw output, and the model it ran on. */
export interface RecordedConversation {
	readonly exchangeId: string;
	readonly request: { readonly input?: unknown };
	readonly rawOutput: string;
	readonly model: { readonly api: string; readonly provider: string; readonly id: string };
}

/** The file written, its messages, and each recorded item left out or not given back as recorded, with why. */
export interface RebuiltSession {
	readonly file: string;
	readonly messages: number;
	readonly leftOut: readonly { readonly index: number; readonly why: string }[];
	readonly notGivenBack: readonly { readonly index: number; readonly why: string }[];
}

const ZERO_USAGE = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
};

type Block = Record<string, unknown>;

/** The recorded `function_call`'s arguments, parsed: Pi stores them as an object and re-serialises them when it sends them. */
function parsedArguments(raw: unknown): Record<string, unknown> {
	if (typeof raw !== 'string') return {};
	try {
		const v = JSON.parse(raw) as unknown;
		return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** A recorded output's content as a tool result holds it: its text, or each text part of a list. */
function outputContent(output: unknown): Block[] {
	if (typeof output === 'string') return [{ type: 'text', text: output }];
	if (!Array.isArray(output)) return [];
	return output.flatMap((p) => {
		const part = p as Block;
		return part.type === 'input_text' && typeof part.text === 'string' ? [{ type: 'text', text: part.text }] : [];
	});
}

/** A recorded user item's content as a Pi user message holds it. */
function userContent(content: unknown): Block[] | string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return [];
	return content.flatMap((p) => {
		const part = p as Block;
		return part.type === 'input_text' && typeof part.text === 'string' ? [{ type: 'text', text: part.text }] : [];
	});
}

/** Why Pi gives a recorded item back otherwise, as far as this rebuild can say. */
function whyNotGivenBack(recorded: Block, back: unknown): string {
	if (recorded.type === 'function_call' && typeof recorded.arguments === 'string')
		return 'its arguments come back re-serialised by Pi (JSON.stringify of the parsed object), and the recorded string was not in that form';
	if (recorded.type === 'function_call_output' && (recorded.output === '' || recorded.output === undefined))
		return 'an empty output comes back as Pi\'s "(no tool output)"';
	return `Pi gives it back as ${JSON.stringify(back)?.slice(0, 300) ?? 'nothing'}`;
}

/**
 * ⭐⭐ D85 — WRITE A SESSION FILE, MARKED REBUILT, FROM A RECORDED CONVERSATION, into `folder` (a unit's `executor/<unit id>/`, its working folder `cwd`),
 * and hold it by the round trip. ⛔ Refused when the folder already holds a session file: a rebuild never writes beside the unit's own session.
 */
export function rebuildExecutorSession(
	conversation: RecordedConversation,
	folder: string,
	cwd: string,
	now: () => number = Date.now
): RebuiltSession {
	if (sessionFilesIn(folder).length > 0)
		throw new Error(`the session folder ${folder} already holds a session file, so no rebuilt session is written beside it (design D85).`);
	const { api, provider, id } = conversation.model;
	const items = Array.isArray(conversation.request.input) ? (conversation.request.input as unknown[]) : [];
	const messages: Block[] = [];
	const leftOut: { index: number; why: string }[] = [];
	const compared: { index: number; item: Block }[] = [];
	const fullIdOf = new Map<string, { id: string; name: string }>();
	let answer: Block[] | undefined;
	const assistant = (content: Block[]): Block => ({
		role: 'assistant',
		content,
		api,
		provider,
		model: id,
		usage: ZERO_USAGE,
		stopReason: content.some((b) => b.type === 'toolCall') ? 'toolUse' : 'stop',
		timestamp: now()
	});
	const flush = (): void => {
		if (answer !== undefined) messages.push(assistant(answer));
		answer = undefined;
	};
	items.forEach((raw, index) => {
		const item = (typeof raw === 'object' && raw !== null ? raw : {}) as Block;
		if ((item.role === 'system' || item.role === 'developer') && item.type === undefined) {
			leftOut.push({ index, why: 'the system prompt: Pi builds it from its loader when the session opens, never from the session' });
			return;
		}
		if (item.role === 'user' && (item.type === undefined || item.type === 'message')) {
			flush();
			messages.push({ role: 'user', content: userContent(item.content), timestamp: now() });
			compared.push({ index, item });
			return;
		}
		if (item.type === 'reasoning') {
			(answer ??= []).push({ type: 'thinking', thinking: '', thinkingSignature: JSON.stringify(item) });
			compared.push({ index, item });
			return;
		}
		if (item.type === 'function_call') {
			const callId = String(item.call_id ?? '');
			const full = typeof item.id === 'string' && item.id !== '' ? `${callId}|${item.id}` : callId;
			fullIdOf.set(callId, { id: full, name: String(item.name ?? '') });
			(answer ??= []).push({ type: 'toolCall', id: full, name: String(item.name ?? ''), arguments: parsedArguments(item.arguments) });
			compared.push({ index, item });
			return;
		}
		if (item.type === 'message' && item.role === 'assistant') {
			const signature = JSON.stringify({ v: 1, id: item.id, ...(item.phase === undefined ? {} : { phase: item.phase }) });
			const parts = Array.isArray(item.content) ? (item.content as Block[]) : [];
			for (const p of parts)
				if (p.type === 'output_text' && typeof p.text === 'string')
					(answer ??= []).push({ type: 'text', text: p.text, textSignature: signature });
			compared.push({ index, item });
			return;
		}
		if (item.type === 'function_call_output') {
			flush();
			const callId = String(item.call_id ?? '');
			const call = fullIdOf.get(callId);
			messages.push({
				role: 'toolResult',
				toolCallId: call?.id ?? callId,
				toolName: call?.name ?? '',
				content: outputContent(item.output),
				isError: false,
				timestamp: now()
			});
			compared.push({ index, item });
			return;
		}
		leftOut.push({ index, why: `an item of a kind this rebuild does not write (${String(item.type ?? item.role ?? 'none')})` });
	});
	flush();
	messages.push(assistant([{ type: 'text', text: conversation.rawOutput }]));

	const session = SessionManager.create(cwd, folder);
	session.appendCustomEntry(REBUILT_MARK, { exchangeId: conversation.exchangeId, items: items.length });
	for (const m of messages) session.appendMessage(m as never);
	const file = session.getSessionFile();
	if (file === undefined) throw new Error('Pi kept the rebuilt session in memory, so no file was written (design D85).');

	// ── THE ROUND TRIP: Pi's own conversion of the file as Pi reopens it, against the recorded items it was written from.
	const context = SessionManager.open(file, undefined, cwd).buildSessionContext();
	const back = convertResponsesMessages(
		{ id, api, provider, input: ['text'], reasoning: false } as never,
		{ messages: context.messages } as never,
		new Set([provider]),
		{ includeSystemPrompt: false }
	) as unknown[];
	const notGivenBack: { index: number; why: string }[] = [];
	// ⚠ As JSON: the recorded items were read from JSON, and Pi's conversion leaves keys whose value is `undefined` (an absent `phase`), which JSON drops.
	const asJson = (v: unknown): unknown => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
	compared.forEach(({ index, item }, k) => {
		if (!isDeepStrictEqual(asJson(back[k]), item)) notGivenBack.push({ index, why: whyNotGivenBack(item, back[k]) });
	});
	if (back.length !== compared.length + 1)
		notGivenBack.push({
			index: -1,
			why: `Pi's conversion gives back ${back.length} item(s) for ${compared.length} recorded and the final answer`
		});
	return { file, messages: messages.length, leftOut, notGivenBack };
}
