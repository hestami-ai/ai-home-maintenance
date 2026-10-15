// ⭐⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (d); `REG-F-518`) — THE MINTED EXECUTION TOOLS AS PI TOOL DEFINITIONS, moved out of
// `pi-executor.ts` so the mapping can be driven through Pi's own agent loop in the gate WITHOUT loading the coding agent.
//
// ⭑ WHY IT MOVED. `pi-executor.ts` imports `@earendil-works/pi-coding-agent` at module scope (measured 2026-10-15 under
// node: about sixteen seconds to load cold, four warm), so nothing in the gate imports it, and whatever it decides is on
// no tested path. This mapping is where the executor's tool-execution ORDER is decided — `REG-F-518` — so it moved here,
// where nothing loads Pi's SDK:
// `ToolDefinition` is a type-only import, erased, and `defineTool` (which the adapter used to call) is the identity
// (`pi-coding-agent/dist/core/extensions/types.js`, `defineTool(tool) { return tool; }`), so the objects built here are
// what it returned. `pi-execution-tools.test.ts` drives them through `pi-agent-core`'s own loop.
//
// ⭑ THE SAME MAPPING THE AUTHORING AGENT USES, and deliberately so: one `ParamSpec` grammar, one TypeBox translation
// (`toTypeBox`), one result shape (`toPiToolResult`). ⚠ IT TAKES WHAT `mintExecutionTools` RETURNED AND FILTERS NOTHING —
// every decision about what the model may have was made at minting time, against the grant. A second filter here would
// be a second authority over the same question, and the weaker of two authorities is the one that eventually answers.
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { toPiToolResult } from '../agent/pi-tool-result.js';
import { toTypeBox } from '../agent/pi-typebox.js';
import type { ExecutionToolDescriptor } from './execution-tool-surface.js';

/**
 * ⭐⭐ `REG-D-112` (d) — HOW PI RUNS A TURN'S CALLS TO THESE TOOLS: ONE AT A TIME, in the order the model made them.
 *
 * ⛔ `REG-F-518`. Pi's loop runs one assistant message's tool calls CONCURRENTLY by default: `pi-agent-core`'s
 * `AgentLoopConfig.toolExecution` (`dist/types.d.ts`) describes its `"parallel"` mode as *"preflight tool calls
 * sequentially, then execute allowed tools concurrently"* and says `Default: "parallel"`, the `Agent` takes that default
 * when it is given none (`dist/agent.js`), and `createAgentSession` gives none. So a `run_command` could start before the
 * `write_file` the model made first had landed — the command then running over a workspace the model did not mean — and
 * two commands could complete out of the order they were called: the host minted each run's evidence as it COMPLETED,
 * so the command reviews followed completion order, which no replay running the recorded calls in order can reproduce
 * (P3's end-to-end phase, `REG-F-518`).
 * ⭑ PER TOOL, THE WAY THE INSTALLED PI EXPOSES IT: `ToolDefinition.executionMode` (`pi-coding-agent`
 * `dist/core/extensions/types.d.ts`), carried to the loop's tool by `wrapToolDefinition`; and `executeToolCalls`
 * (`pi-agent-core` `dist/agent-loop.js`) runs a whole message's calls sequentially when ANY tool it calls declares
 * `"sequential"` — every tool here does, so every turn that calls one of them does. `createAgentSession` takes no option
 * for the `Agent`'s own `toolExecution`; declared on each tool, the mode travels in the very definitions `customTools`
 * receives, which is what the test drives.
 * ⚠ IT CHANGES THE EXECUTOR'S BEHAVIOUR, and that is the point: slower where a model asked for two long commands at once,
 * and never a command raced against the write it reads (`pi-execution-tools.test.ts` drives it through Pi's own loop).
 */
export const EXECUTION_TOOL_MODE = 'sequential' as const;

/** Wrap the minted execution tools as Pi custom tools. */
export function toPiExecutionTools(
	descriptors: readonly ExecutionToolDescriptor[]
): ToolDefinition[] {
	return descriptors.map((d): ToolDefinition => ({
		name: d.name,
		label: d.name,
		description: d.description,
		parameters: toTypeBox(d.parameters),
		executionMode: EXECUTION_TOOL_MODE,
		execute: async (_toolCallId: string, params: Record<string, unknown>) =>
			toPiToolResult(await d.run(params ?? {}))
	}));
}
