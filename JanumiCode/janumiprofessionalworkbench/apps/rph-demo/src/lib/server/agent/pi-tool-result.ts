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
