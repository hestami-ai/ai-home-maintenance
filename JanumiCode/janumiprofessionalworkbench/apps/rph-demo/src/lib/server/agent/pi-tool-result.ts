// Pure interpretation of a Pi custom-tool result. Kept outside pi-agent.ts so the correctness boundary can be
// regression-tested without importing the Pi SDK (the mock/test path deliberately never loads that dependency).
import type { ToolRunResult } from './types.js';

export interface PiCompatibleToolResult {
	readonly content: Array<{ readonly type: 'text'; readonly text: string }>;
	readonly details: { readonly ok: boolean; readonly summary: string; readonly data?: unknown };
}

/**
 * Pi returns `content` to the model; `details` is host/UI metadata. Keep the human summary first, but include the
 * descriptor's JSON-safe structured result so read tools actually give the model the state their contracts promise.
 * `details.summary` carries the terse human line ALONE — the chat log and durable transcript render that, never the
 * `content` blob, so a read tool's raw JSON dump can no longer leak into the visible conversation.
 */
export function toPiToolResult(result: ToolRunResult): PiCompatibleToolResult {
	const structured = result.data === undefined ? '' : `\n\nStructured result:\n${JSON.stringify(result.data)}`;
	return {
		content: [{ type: 'text', text: `${result.summary}${structured}` }],
		details: {
			ok: result.ok,
			summary: result.summary,
			...(result.data === undefined ? {} : { data: result.data })
		}
	};
}

/** A tool result as the model is sent it: its content's parts, text or otherwise. */
export interface SentToolResult {
	readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 8 (the lead's delegated decision of 2026-10-15, to be registered; the replay's tool-result key) —
 * WHAT A TOOL'S RESULT REACHES THE MODEL AS: the text an OpenAI Responses payload carries for it, its
 * `function_call_output`'s `output` — the result's text parts joined by newlines, `(no tool output)` when there are
 * none, and every unpaired surrogate removed (`@earendil-works/pi-ai` 0.80.6, `dist/api/openai-responses-shared.js`,
 * `convertResponsesMessages`). It is the payload shape the replay's recorder reads (`scripts/phase7/record-replay-core.ts`).
 * ⚠ FOR A RESULT OF TEXT ALONE, as every result this host's tools give is: an image part is sent another way, and is not
 * rendered here. Held to pi-ai's own converter by `tools/pi-execution-tools.test.ts`.
 */
export function toolResultAsSent(result: SentToolResult): string {
	const text = result.content
		.filter((part) => part.type === 'text')
		.map((part) => part.text ?? '')
		.join('\n');
	return (text.length > 0 ? text : '(no tool output)').replace(
		/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
		''
	);
}

/**
 * ⭐ PI'S OWN RESULT FOR A CALL TO A TOOL ITS SESSION DOES NOT HAVE — `Tool <name> not found`, as an error result
 * (`@earendil-works/pi-agent-core` 0.80.6, `dist/agent-loop.js`, `prepareToolCall`). The model reads it as it reads any
 * result, so a replay renders it for such a call. Held to pi-agent-core's own loop by `tools/pi-execution-tools.test.ts`.
 */
export function unknownToolResult(name: string): SentToolResult {
	return { content: [{ type: 'text', text: `Tool ${name} not found` }] };
}

/**
 * A Pi execution can succeed at the transport layer while the authoring domain rejects the proposed Command.
 * Our custom-tool adapter records that domain outcome as `result.details.ok`; it must therefore take precedence
 * over the absence of a Pi transport error. Results without structured details retain Pi's transport semantics.
 */
export function piToolExecutionSucceeded(result: unknown, transportError: boolean): boolean {
	if (transportError) return false;
	if (!result || typeof result !== 'object') return true;

	const details = (result as { readonly details?: unknown }).details;
	if (!details || typeof details !== 'object') return true;

	const domainOk = (details as { readonly ok?: unknown }).ok;
	return typeof domainOk === 'boolean' ? domainOk : true;
}
