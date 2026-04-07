/**
 * Request-scoped trace context using Node.js AsyncLocalStorage.
 *
 * Propagates traceId + dialogueId across all async calls within a single
 * user action (MMP submit, gate decision, text input, etc.) without
 * explicit parameter threading.
 *
 * Usage at entry points:
 *   await runWithTrace(dialogueId, 'mmpSubmit', async () => { ... });
 *
 * Usage in any downstream code:
 *   const trace = getTraceContext();  // returns { traceId, dialogueId, action } or undefined
 *
 * The structured logger auto-reads this context so every log line gets
 * traceId and dialogueId without callers passing them.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface TraceContext {
	/** Short unique ID for this request (8 hex chars) */
	traceId: string;
	/** The dialogue this action belongs to */
	dialogueId: string;
	/** Human-readable action name (e.g. 'mmpSubmit', 'gateDecision', 'submitInput') */
	action: string;
}

const store = new AsyncLocalStorage<TraceContext>();

/**
 * Run a function within a new trace context.
 * All async calls inside `fn` will inherit the trace context automatically.
 */
export function runWithTrace<T>(
	dialogueId: string,
	action: string,
	fn: () => T | Promise<T>,
): T | Promise<T> {
	return store.run(
		{ traceId: randomUUID().slice(0, 8), dialogueId, action },
		fn,
	);
}

/**
 * Get the current trace context (if any).
 * Returns undefined when called outside a runWithTrace scope.
 */
export function getTraceContext(): TraceContext | undefined {
	return store.getStore();
}
