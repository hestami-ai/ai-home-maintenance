// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D85 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.39; `REG-D-167` (4); `REG-D-169`) — THE
// EXECUTOR'S SESSION KEPT WITH THE RUN, AS PI ITSELF KEEPS AND READS IT: created in the unit's folder at its first step, its working-directory line
// the workspace; reopened after a restart, its history whole; ~~forked for a replacement~~ ⭐ a replacement's a new session of its own, and a file
// naming a parent refused at its reopening (package L17b3, design D89); a call its stopped step never answered given a recorded result; two files
// refused; and, with no durable store, held in memory as before.
//
// ⭑ WHAT IT DRIVES: `openPiExecutionSession` itself, with the place its opener is handed (reading 3: its third argument) — Pi's real session
// manager, settings, loader and session, and the recorder on its `onPayload` — and reads the request each turn recorded (its materialized input).
// ⭑ THE MODEL IS A FAUX ONE, as `pi-executor.test.ts`'s: a provider declared in a temporary agent folder whose API is `pi-ai`'s faux core; its
// scripted answer first hands `onPayload` the request a Responses provider builds from the same context, as a real provider does before it sends.
// ⛔ NO MODEL, NO NETWORK, NOTHING OF THE OPERATOR'S: the agent and home folders are temporary, `PI_OFFLINE` is set, and nothing runs a command.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
	createFauxCore,
	fauxAssistantMessage,
	registerApiProvider,
	unregisterApiProviders,
	type FauxResponseFactory
} from '@earendil-works/pi-ai/compat';
import { convertResponsesMessages, convertResponsesTools } from '@earendil-works/pi-ai/api/openai-responses-shared';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CUT_OFF_RESULT, parentedSessionFileRefusal, sessionFilesIn } from '../execution/executor-session.js';
import { IN_MEMORY_SESSION, type ExecutorSessionPlace, type ProducerSessionContext } from '../execution/producer-session.js';
import { isToolInvocationResult } from './backing-tool.js';
import { openPiExecutionSession } from './pi-executor.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-pi-executor-session-'));
const AGENT = join(ROOT, 'agent');
const WORKSPACE = join(ROOT, 'runs', 'workspace');
const SESSIONS = join(ROOT, 'runs', 'demo.sqlite.sessions');
const PROVIDER = 'jpwb-faux';
const API = 'jpwb-faux-session';
const SOURCE_ID = 'pi-executor-session.test';
const MODEL = `${PROVIDER}/faux-model`;

const faux = createFauxCore({ api: API, provider: PROVIDER, models: [{ id: 'faux-model' }] });

/** A scripted answer that first hands Pi's `onPayload` the request a Responses provider would build, and awaits it. */
const answering =
	(text: string): FauxResponseFactory =>
	async (context, options, _state, model) => {
		await options?.onPayload?.(
			{
				model: model.id,
				input: convertResponsesMessages(model, context, new Set([model.provider])),
				...(context.tools && context.tools.length > 0 ? { tools: convertResponsesTools(context.tools) } : {})
			},
			model
		);
		return fauxAssistantMessage(text);
	};

const context: ProducerSessionContext = {
	workspace: {
		ownerId: 'pi-executor-session-test',
		ownerKind: 'UNDERTAKING',
		materialization: 'FILESYSTEM',
		directoryPath: WORKSPACE,
		purgeability: 'PURGEABLE_AT_EXPIRY'
	} as unknown as Workspace,
	runner: { kind: 'REAL' } as unknown as ProcessRunner,
	grantedCapabilities: ['file-system', 'process-execution'],
	bindingAuthorizationStatus: 'AUTHORIZED'
};

/** The request one turn recorded, parsed: its instructions (Pi's system prompt) and its input items. */
interface Sent {
	readonly instructions: string;
	readonly input: readonly Record<string, unknown>[];
}

/** One turn on a session opened at `place`, answered `answer`: the request it recorded. The session is disposed after. */
async function turnAt(place: ExecutorSessionPlace, text: string, answer: string): Promise<Sent> {
	faux.setResponses([answering(answer)]);
	const session = await openPiExecutionSession(context, MODEL, place);
	try {
		const result = await session.turn(text);
		const composite = isToolInvocationResult(result) ? result.materializedInput : undefined;
		expect(composite, 'arrangement: the turn recorded its request').toBeDefined();
		const payload = JSON.parse(composite!) as { input: Record<string, unknown>[] };
		const system = payload.input.find((m) => m.role === 'system' || m.role === 'developer');
		return { instructions: String(system?.content ?? ''), input: payload.input.filter((m) => m !== system) };
	} finally {
		session.dispose();
	}
}

/** The text of each input item, in order: a user turn's, an assistant message's, and a tool result's output. */
const textsOf = (input: readonly Record<string, unknown>[]): string[] =>
	input.map((item) => {
		if (item.type === 'function_call_output') return `output: ${String(item.output)}`;
		if (item.type === 'function_call') return `call: ${String(item.name)}`;
		const parts = Array.isArray(item.content) ? (item.content as { text?: unknown }[]) : [];
		return parts.map((p) => String(p.text ?? '')).join('');
	});

/** Each message entry of a session file, by its role (`message/<role>`): Pi may write other entries — a model or thinking level — as a session opens. */
const messagesOf = (file: string): string[] =>
	readFileSync(file, 'utf8')
		.trim()
		.split('\n')
		.map((l) => JSON.parse(l) as { type: string; message?: { role?: string } })
		.filter((e) => e.type === 'message')
		.map((e) => `message/${e.message?.role}`);

/** Every session file under a folder, at any depth. */
const allSessionFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true, recursive: true })
		.filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
		.map((d) => join(d.parentPath, d.name));

/** Pi's working-directory line for a folder: its path with forward slashes (`system-prompt.js`). */
const workingDirectoryLine = (dir: string): string => `\nCurrent working directory: ${resolve(dir).replaceAll('\\', '/')}`;

/** ⭐ The review's defects 1 and 8 — what a reopened place says its file holds: Pi's opener reads none of it (the turn's words and declarations do). */
const HELD = { returnedAnswer: true, ownFindings: false, crossUnitFeedback: false } as const;

const durable = (unitId: string, opening: Extract<ExecutorSessionPlace, { kind: 'DURABLE' }>['opening']): ExecutorSessionPlace => ({
	kind: 'DURABLE',
	folder: join(SESSIONS, 'executor', unitId),
	opening
});

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
	mkdirSync(WORKSPACE, { recursive: true });
	vi.stubEnv('PI_CODING_AGENT_DIR', AGENT);
	vi.stubEnv('HOME', join(ROOT, 'home'));
	vi.stubEnv('USERPROFILE', join(ROOT, 'home'));
	vi.stubEnv('PI_OFFLINE', '1');
	registerApiProvider({ api: faux.api, stream: faux.stream, streamSimple: faux.streamSimple }, SOURCE_ID);
});

afterAll(() => {
	unregisterApiProviders(SOURCE_ID);
	vi.unstubAllEnvs();
	rmSync(ROOT, { recursive: true, force: true });
});

describe('⭐⭐ L17b1 (D85) — a unit’s session, kept with the run as Pi’s own file', () => {
	it('⛔ RED FIRST — a unit’s first step creates Pi’s session file in its folder, and the working-directory line names the workspace', async () => {
		const place = durable('pwu_new', { kind: 'NEW' });

		const sent = await turnAt(place, 'Write the Source.', 'The Source.');

		const files = sessionFilesIn(join(SESSIONS, 'executor', 'pwu_new'));
		expect(files.length, 'the unit’s folder does not hold one session file').toBe(1);
		expect(messagesOf(files[0]!), 'the file does not hold the turn and its answer').toEqual(['message/user', 'message/assistant']);
		expect(sent.instructions.endsWith(workingDirectoryLine(WORKSPACE)), 'the working-directory line does not name the workspace').toBe(true);
	});

	it('⛔ RED FIRST — after a restart, the unit’s next step reopens its one file: the request holds the earlier turns whole, and the turn is kept in the ONE file', async () => {
		await turnAt(durable('pwu_again', { kind: 'NEW' }), 'Write the Source.', 'The first Source.');
		const [file] = sessionFilesIn(join(SESSIONS, 'executor', 'pwu_again'));

		// ⭑ A new opener over the same folder, as a restarted server's next step opens it.
		const sent = await turnAt(durable('pwu_again', { kind: 'REOPEN', file: file!, held: HELD }), 'Produce the work product again.', 'The second Source.');

		expect(textsOf(sent.input), 'the request does not hold the earlier turn, its answer and the new turn, in order').toEqual([
			'Write the Source.',
			'The first Source.',
			'Produce the work product again.'
		]);
		expect(sessionFilesIn(join(SESSIONS, 'executor', 'pwu_again')), 'the folder does not still hold its one file').toEqual([file]);
		expect(messagesOf(file!), 'the file does not hold both steps').toEqual([
			'message/user',
			'message/assistant',
			'message/user',
			'message/assistant'
		]);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173`): ~~'⛔ RED FIRST — a replacement’s first request holds its
	// predecessor’s conversation as Pi builds it from the forked file, then its own instruction and the feedback'~~, its place ~~`{ kind: 'FORK', from:
	// from!, predecessorId: 'pwu_old', heldFindings: false, returnedAnswer: true }`~~, its request ~~`['Write the Source.', 'The superseded Source.',
	// first]`~~ and its header ~~`[resolve(from!), resolve(WORKSPACE)]`~~ (~~'the forked file does not name its parent and the workspace'~~) — nothing
	// forks since D89: a replacement's first step opens a NEW file in its own folder, and its first request is its own first turn alone. The promise
	// kept: the successor's folder holds one file of its own, its working folder the workspace, and the predecessor's file is left byte for byte.
	it('⭐ a replacement’s first request is its own first turn alone, from a new file in its own folder that names no parent; its predecessor’s file is left byte for byte (D89)', async () => {
		await turnAt(durable('pwu_old', { kind: 'NEW' }), 'Write the Source.', 'The superseded Source.');
		const [from] = sessionFilesIn(join(SESSIONS, 'executor', 'pwu_old'));
		const before = readFileSync(from!, 'utf8');
		const first = 'Write the Source.\n\nHolistic feedback — what the assurance of this Undertaking’s work has recorded since this work was last done:';

		const sent = await turnAt(durable('pwu_new2', { kind: 'NEW' }), first, 'The new Source.');

		expect(textsOf(sent.input), 'the request holds more than the successor’s own first turn').toEqual([first]);
		const own = sessionFilesIn(join(SESSIONS, 'executor', 'pwu_new2'));
		expect(own.length, 'the successor’s folder does not hold one file').toBe(1);
		const header = JSON.parse(readFileSync(own[0]!, 'utf8').split('\n')[0]!) as { parentSession?: string; cwd?: string };
		expect([header.parentSession, header.cwd], 'the successor’s file names a parent, or not the workspace').toEqual([undefined, resolve(WORKSPACE)]);
		expect(readFileSync(from!, 'utf8'), 'the predecessor’s file was changed').toBe(before);
	});

	it('⛔ RED FIRST — a session file whose header names a parent — a fork, which no step makes since D89 — is refused at its reopening, naming it and its parent, never read as the unit’s own (D89)', async () => {
		await turnAt(durable('pwu_par_old', { kind: 'NEW' }), 'Write the Source.', 'The superseded Source.');
		const [parent] = sessionFilesIn(join(SESSIONS, 'executor', 'pwu_par_old'));
		// ⭑ A fork as package L17b1's made one: Pi's own `forkFrom`, the file in the successor's folder, its header naming the parent.
		const folder = join(SESSIONS, 'executor', 'pwu_par_new');
		SessionManager.forkFrom(parent!, WORKSPACE, folder);
		const [file] = sessionFilesIn(folder);
		const before = readFileSync(file!, 'utf8');

		const settled = await openPiExecutionSession(context, MODEL, durable('pwu_par_new', { kind: 'REOPEN', file: file!, held: HELD })).then(
			(s) => {
				s.dispose();
				return 'opened';
			},
			(e: unknown) => (e instanceof Error ? e.message : String(e))
		);

		expect(settled, 'a file naming a parent was reopened as the unit’s own').toContain('names a parent session');
		expect(settled, 'the refusal does not name the file and its parent').toBe(parentedSessionFileRefusal(file!, resolve(parent!)));
		expect(readFileSync(file!, 'utf8'), 'the refused file was changed').toBe(before);
	});

	it('⛔ RED FIRST — a session file cut in the middle of a tool call is reopened with a recorded result for the call, which the request carries in Pi’s place', async () => {
		const folder = join(SESSIONS, 'executor', 'pwu_cut');
		const made = SessionManager.create(WORKSPACE, folder);
		made.appendMessage({ role: 'user', content: [{ type: 'text', text: 'Write the Source.' }], timestamp: 1 } as never);
		made.appendMessage({
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'call_1|fc_1', name: 'run_command', arguments: { argv: ['node', '--test'] } }],
			api: API,
			provider: PROVIDER,
			model: 'faux-model',
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: 'toolUse',
			timestamp: 2
		} as never);
		const [file] = sessionFilesIn(folder);
		expect(messagesOf(file!), 'arrangement: the file ends on the call, its result never written').toEqual(['message/user', 'message/assistant']);

		const sent = await turnAt(durable('pwu_cut', { kind: 'REOPEN', file: file!, held: HELD }), 'Produce the work product again.', 'Done.');

		expect(textsOf(sent.input), 'the request does not carry the recorded cut-off result for the call').toEqual([
			'Write the Source.',
			'call: run_command',
			`output: ${CUT_OFF_RESULT}`,
			'Produce the work product again.'
		]);
		const kept = readFileSync(file!, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l) as { type: string; message?: { role?: string; isError?: boolean; toolCallId?: string } })
			.filter((e) => e.message?.role === 'toolResult');
		expect(kept.map((e) => [e.message?.toolCallId, e.message?.isError]), 'the file does not keep the cut-off result, isError').toEqual([['call_1|fc_1', true]]);
	});

	it('⛔ RED FIRST — two session files in the unit’s folder refuse the session, naming the folder', async () => {
		const folder = join(SESSIONS, 'executor', 'pwu_two');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'a.jsonl'), '');
		writeFileSync(join(folder, 'b.jsonl'), '');
		await expect(openPiExecutionSession(context, MODEL, durable('pwu_two', { kind: 'NEW' })), 'two files were not refused, naming the folder').rejects.toThrow(
			`the session folder ${folder} holds 2 session files`
		);
	});

	it('⛔ RED FIRST — a place its folder no longer matches is refused: the file it was to reopen gone, or a file where a new one was to open', async () => {
		const folder = join(SESSIONS, 'executor', 'pwu_moved');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'other.jsonl'), '');
		/** The opening's outcome, settled: its refusal's words, or that it opened (the session then disposed). */
		const settled = (place: ExecutorSessionPlace): Promise<string> =>
			openPiExecutionSession(context, MODEL, place).then(
				(s) => {
					s.dispose();
					return 'opened';
				},
				(e: unknown) => (e instanceof Error ? e.message : String(e))
			);

		expect(await settled(durable('pwu_moved', { kind: 'REOPEN', file: join(folder, 'gone.jsonl'), held: HELD })), 'a step reopened a file its folder no longer holds').toContain(
			'no longer holds the file this step was to reopen'
		);
		expect(await settled(durable('pwu_moved', { kind: 'NEW' })), 'a new session was opened beside the unit’s own').toContain(
			'already holds a session file, so a new one cannot be opened beside it'
		);
	});

	it('⭑ CONTROL — with no durable store, the session is held in memory: no file is written, and the working-directory line is the server’s own folder, as before', async () => {
		const before = allSessionFiles(ROOT);
		const sent = await turnAt(IN_MEMORY_SESSION, 'Write the Source.', 'The Source.');
		expect(sent.instructions.endsWith(workingDirectoryLine(process.cwd())), 'the in-memory session’s working-directory line moved').toBe(true);
		expect(allSessionFiles(ROOT), 'an in-memory session wrote a session file').toEqual(before);
	});
});
