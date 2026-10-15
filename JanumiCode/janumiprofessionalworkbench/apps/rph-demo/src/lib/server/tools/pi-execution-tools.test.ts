// ⭐⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (d); `REG-F-518`) — PI RUNS A TURN'S TOOL CALLS ONE AT A TIME.
//
// ⛔ THE DEFECT (`REG-F-518`). Pi's agent loop executes one assistant message's tool calls CONCURRENTLY unless told
// otherwise: `pi-agent-core`'s `AgentLoopConfig.toolExecution` says `Default: "parallel"` (`dist/types.d.ts`),
// `createAgentSession` builds its `Agent` with no `toolExecution` (`pi-coding-agent/dist/core/sdk.js`), and
// `executeToolCalls` (`pi-agent-core/dist/agent-loop.js`) runs a message's calls in parallel unless the loop is
// sequential OR one of the called tools declares `executionMode: "sequential"`. So a `run_command` could start before the
// `write_file` beside it had landed, and two commands could complete out of the order they were called: the host minted
// each run's evidence as it COMPLETED, so the command reviews followed completion order — P3's end-to-end phase, which a
// sequential replay could not reproduce.
// ⭐ `REG-D-112` (d) — FIXED BEFORE THE RECORDED RUN: every minted execution tool declares `executionMode: "sequential"`
// (`pi-execution-tools.ts`), and `pi-coding-agent` carries the field to the loop's tool (`dist/core/tools/
// tool-definition-wrapper.js`, `wrapToolDefinition`; `agent-session.js`, `_refreshToolRegistry`, which wraps every
// `customTools` definition so). ⚠ THIS CHANGES THE EXECUTOR'S BEHAVIOUR: a turn's tool calls now run in the order the model
// made them, each finished before the next starts — slower where a model asked for two long commands at once, and never
// racing a command against the write it reads.
//
// ⭑ DRIVEN THROUGH PI'S OWN LOOP, NOT ASSERTED AS A FIELD. `pi-agent-core`'s `Agent`, its stream a scripted `pi-ai` faux
// provider: the first reply holds TWO tool calls, and each tool logs when it starts and ends, the first one slow. The
// definitions handed to the loop are `toPiExecutionTools`' own, the objects `customTools` receives.
// ⛔ PREDICTED RED, observed 2026-10-15 with the declaration removed: under the default the log interleaves — *"a call
// started before the one before it ended"*, the log `start write_file`, `start run_command`, `end run_command`,
// `end write_file`.
// ⭐ AND (the lead's delegated decision of 2026-10-15, to be registered; the replay's tool-result key) WHAT A RESULT REACHES
// THE MODEL AS: the replay renders each recorded call's result as Pi would send it (`toolResultAsSent`) and Pi's own
// answer to a call of a tool the session lacks (`unknownToolResult`) — restated from Pi, so each is held here to Pi
// itself: a turn through `pi-agent-core`'s loop, its messages converted by `pi-ai`'s own Responses converter
// (`convertResponsesMessages`), the payload shape the recorder reads.
// ⚠ IT LOADS PI'S CORE LOOP (`pi-agent-core`, `pi-ai`) — about a second and a half under node, measured 2026-10-15 — and
// never the coding agent, which is what `pi-executor.ts` imports. No model is called: the faux provider answers from its
// script, in process.
import { Agent, type AgentTool } from '@earendil-works/pi-agent-core';
import { createFauxCore, fauxAssistantMessage, fauxToolCall, type Message } from '@earendil-works/pi-ai';
import { convertResponsesMessages } from '@earendil-works/pi-ai/api/openai-responses-shared';
import { describe, expect, it } from 'vitest';
import { toolResultAsSent, toPiToolResult, unknownToolResult } from '../agent/pi-tool-result.js';
import type { ToolRunResult } from '../agent/types.js';
import {
	mintExecutionTools,
	type ExecutionToolDescriptor,
	type ExecutionToolPorts
} from './execution-tool-surface.js';
import { toPiExecutionTools } from './pi-execution-tools.js';

/** A tool that logs its start and end, holding the loop `holdMs` between them. */
function logged(name: string, log: string[], holdMs: number): ExecutionToolDescriptor {
	return {
		name,
		description: `${name}, for the order test`,
		parameters: { label: { type: 'string', description: 'which call this is', required: true } },
		capability: 'file-system',
		async run(args) {
			log.push(`start ${name} ${String(args.label)}`);
			await new Promise((resolve) => setTimeout(resolve, holdMs));
			log.push(`end ${name} ${String(args.label)}`);
			return { ok: true, summary: `${name} done` };
		}
	};
}

describe('⭐ REG-D-112 (d) — a turn with two tool calls runs them one at a time, in the order the model made them', () => {
	it('through pi-agent-core’s own loop: the second call starts only after the first has ended', async () => {
		const log: string[] = [];
		const faux = createFauxCore({ provider: 'faux-order-test' });
		faux.setResponses([
			fauxAssistantMessage(
				[
					fauxToolCall('write_file', { label: 'first' }, { id: 'call-1' }),
					fauxToolCall('run_command', { label: 'second' }, { id: 'call-2' })
				],
				{ stopReason: 'toolUse' }
			),
			fauxAssistantMessage('both calls are done')
		]);
		const agent = new Agent({
			initialState: {
				model: faux.getModel(),
				systemPrompt: 'the order test',
				tools: toPiExecutionTools([
					logged('write_file', log, 40),
					logged('run_command', log, 1)
				]) as unknown as AgentTool[]
			},
			streamFn: faux.streamSimple
		});

		await agent.prompt('Write, then run.');

		expect(log, 'a call started before the one before it ended').toEqual([
			'start write_file first',
			'end write_file first',
			'start run_command second',
			'end run_command second'
		]);
		// ⭑ And the loop really took both calls and finished its turn: the faux script was served whole.
		expect(faux.getPendingResponseCount()).toBe(0);
	});

	it('every minted tool declares it, so a turn calling any of them runs sequentially', () => {
		// ⭑ THE CATALOG'S OWN TOOLS, minted for the whole grant — ports that are never run, since a definition is only read.
		const minted = mintExecutionTools({
			ports: {} as unknown as ExecutionToolPorts,
			grantedCapabilities: ['file-system', 'process-execution'],
			bindingAuthorizationStatus: 'AUTHORIZED'
		});
		expect(minted.map((t) => t.name)).toEqual(['write_file', 'run_command']);
		expect(toPiExecutionTools(minted).map((t) => [t.name, t.executionMode])).toEqual([
			['write_file', 'sequential'],
			['run_command', 'sequential']
		]);
	});
});

describe('⭐ the replay’s tool-result key renders a result exactly as Pi sends it to the model (the lead’s delegated decision of 2026-10-15, to be registered)', () => {
	/**
	 * One turn through `pi-agent-core`'s own loop — the faux model calls `calls`, each answered by its tool or by Pi
	 * itself, then ends — and each call's output in the payload `pi-ai`'s Responses converter makes of the turn's messages.
	 */
	async function sentThroughPi(
		tools: readonly ExecutionToolDescriptor[],
		calls: readonly string[]
	): Promise<unknown[]> {
		const faux = createFauxCore({ provider: 'faux-result-test' });
		faux.setResponses([
			fauxAssistantMessage(
				calls.map((name, k) => fauxToolCall(name, {}, { id: `call-${k + 1}` })),
				{ stopReason: 'toolUse' }
			),
			fauxAssistantMessage('every call answered')
		]);
		const model = faux.getModel();
		const agent = new Agent({
			initialState: {
				model,
				systemPrompt: 'the result test',
				tools: toPiExecutionTools(tools) as unknown as AgentTool[]
			},
			streamFn: faux.streamSimple
		});
		await agent.prompt('Call the tools.');
		expect(faux.getPendingResponseCount(), 'arrangement: the loop took every call').toBe(0);
		// ⭑ The turn's messages a provider is sent: the loop's own user, assistant and tool-result messages.
		const sent = agent.state.messages.filter(
			(m): m is Message => m.role === 'user' || m.role === 'assistant' || m.role === 'toolResult'
		);
		return convertResponsesMessages(model, { messages: sent }, new Set([model.provider]), {
			includeSystemPrompt: false
		})
			.filter((item) => (item as { type?: unknown }).type === 'function_call_output')
			.map((item) => (item as { output?: unknown }).output);
	}

	it('a minted tool’s result — a summary with its structured result, an empty one, one holding an unpaired surrogate — is sent as toolResultAsSent renders it', async () => {
		const results: readonly ToolRunResult[] = [
			{ ok: true, summary: 'Wrote 3 UTF-8 bytes to a.md.', data: { path: 'a.md', byteSize: 3 } },
			{ ok: true, summary: '' },
			{ ok: false, summary: `Refused: a lone ${String.fromCodePoint(0xd800)} surrogate` }
		];
		const tools = results.map(
			(result, k): ExecutionToolDescriptor => ({
				name: `tool_${k}`,
				description: `tool ${k}, for the result test`,
				parameters: {},
				capability: 'file-system',
				run: async () => result
			})
		);
		expect(await sentThroughPi(tools, tools.map((t) => t.name))).toEqual(
			results.map((result) => toolResultAsSent(toPiToolResult(result)))
		);
	});

	it('Pi’s own answer to a call of a tool the session lacks is sent as unknownToolResult renders it', async () => {
		expect(await sentThroughPi([], ['read_file'])).toEqual([toolResultAsSent(unknownToolResult('read_file'))]);
	});
});
