// JAN-EXECSESS ES-01 — the producer's session, held for as long as the work unit is being worked on.
//
// ⭑ SPONSOR (2026-09-06): *"In JanumiCode v2 … the CLI session wasn't closed or released until the phase or
// sub-phase completed. Here the phase or sub-phase would or could be nearest thought of as a PWU. This approach
// allowed the assurance policies feedback to be fed back to the implementing agent before that phase or
// sub-phase was determined complete."*
//
// ⛔ THE SEAM HAD TO CHANGE SHAPE, NOT JUST BEHAVIOUR. `print: (prompt) => Promise<…>` is ONE-SHOT BY
// CONSTRUCTION: there is nowhere for a second turn to land, so `JAN-EXECLOOP` delivered the loop's state as a
// PROMPT SPLICE — re-rendering the template and appending the findings, which asks the model to produce the
// work again as though for the first time. A session can be told *"the reviewer said this about what you just
// produced"*, because the producer's own history holds what it produced.
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import type { ExecutionToolDescriptor } from '../sandbox/execution-tools.js';

/**
 * SPIKE (spike/tool-execution) — one tool call a producer made during this work unit.
 *
 * ⭑ THE SESSION HAS TO CARRY THIS, AND THAT IS A FINDING RATHER THAN A CONVENIENCE. A step's evidence is
 * "a file was written, a command ran, it exited 0" — facts that exist only INSIDE the producer's turn. The
 * answer text is the model's REPORT of them, which is exactly the untrusted external input §22.1 says model
 * output is. So the seam that observed them must hand them back, or the record rests on the model's word.
 */
export interface ProducerToolCall {
	readonly tool: string;
	readonly args: Record<string, unknown>;
	readonly ok: boolean;
	readonly summary: string;
	readonly data?: unknown;
}

export interface ProducerSession {
	/** One turn. Turn 1 carries the rendered instruction; later turns carry review findings. */
	turn(text: string): Promise<string | ToolInvocationResult>;
	/** Released when the work unit stops being worked on — satisfied, escalated, or out of tries. */
	dispose(): void;
	/**
	 * ⚠ DOES THIS PRODUCER ACTUALLY REMEMBER? Declared, because two of the three adapters DO NOT, and a caller
	 * that assumed otherwise would send a bare findings turn to a model with no idea what it is about.
	 *
	 * ⛔ Retrofitting memory onto `agy` or the fixture would be the fabricated-capability defect: they have
	 * none. They implement this interface with INDEPENDENT turns and say so here.
	 */
	readonly retainsHistory: boolean;
	/**
	 * SPIKE — the tool calls this producer actually made, OBSERVED by the adapter that executed them.
	 *
	 * ⚠ OPTIONAL, because a producer with no tools genuinely made none and `[]` from an adapter that cannot
	 * observe tool calls would assert an absence it did not measure.
	 */
	toolCalls?(): readonly ProducerToolCall[];
}

/**
 * SPIKE (spike/tool-execution) — opening a session now takes the tools the step's binding AUTHORIZED.
 *
 * ⭑ OPTIONAL, AND THAT IS NOT LAXITY. Two of the three adapters (the fixture and `agy --print`) have no tool
 * surface at all, so a required parameter would force every caller to pretend otherwise. An adapter that
 * cannot offer tools ignores the argument, and `toolCalls()` then reports `[]` as an OBSERVATION.
 */
export type OpenProducerSession = (
	tools?: readonly ExecutionToolDescriptor[]
) => Promise<ProducerSession>;

/**
 * Wrap a one-shot call as a session whose turns are independent.
 *
 * ⭑ THIS IS AN HONEST ADAPTER, NOT A SHIM. `agy --print` and the deterministic fixture genuinely have no
 * memory: every invocation is a fresh process with a fresh context. Presenting them through the session
 * interface lets one caller drive every backing tool, while `retainsHistory: false` keeps the difference
 * VISIBLE rather than papering over it.
 */
export function oneShotSession(
	call: (prompt: string) => Promise<string | ToolInvocationResult>
): ProducerSession {
	return {
		turn: (text) => call(text),
		dispose: () => undefined,
		retainsHistory: false,
		// A one-shot text call has no tools at all, so the empty list is an observation, not a default.
		toolCalls: () => []
	};
}
