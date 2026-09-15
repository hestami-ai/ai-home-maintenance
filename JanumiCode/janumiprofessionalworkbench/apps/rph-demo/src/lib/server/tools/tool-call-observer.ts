// ⭐⭐ JAN-EXEC PHASE 3 — THE ADAPTER'S OWN INSTRUMENT. What a session was OBSERVED to do with the tools it was
// given, as distinct from what the model SAID it did.
//
// ⛔ §22.1 MAKES MODEL OUTPUT UNTRUSTED EXTERNAL INPUT, so *"the model said it ran the tests"* is not evidence
// that tests ran. The only party in a position to answer is the one that DROVE the session. This module is that
// answer's shape, kept OUT of `pi-executor.ts` so it can be driven without loading Pi's SDK — the same boundary
// `pi-tool-result.ts` already draws, and for the same reason: *"the correctness boundary can be regression-tested
// without importing the Pi SDK."*
//
// ── ⚠ WHAT THIS OBSERVES, AND WHAT IT DOES NOT ──────────────────────────────────────────────────────────────
// It observes the SESSION'S EVENT STREAM — a call started, a call ended, and whether the end was an error.
// ⛔ It deliberately does NOT observe by instrumenting the tool HANDLERS, though that was the easier design: a
// handler-side counter can only ever see calls the host was willing to execute, so a call that Pi rejected
// before dispatch — a malformed argument, a tool the model invented — would be invisible, and an invisible
// attempted call is the single fact `nameProvenance: NOT_MINTED` exists to record. Watching the stream sees both.
//
// ⚠ AND `UNKNOWN` IS A REAL MEMBER, NOT A FALLBACK. A call that STARTED and whose end never arrived (the turn
// ended first, the session was disposed) is a call the adapter watched begin and did not watch finish. Grading
// it COMPLETED would be a fabricated measurement; dropping it would be worse, because the attempt happened.
import { piToolExecutionSucceeded } from '../agent/pi-tool-result.js';
import type { AdapterToolCall } from './backing-tool.js';

/**
 * What the ADAPTER saw happen to a call, from the session's own end event.
 *
 * ⛔ THE THREE OUTCOMES ARE NOT A SEVERITY SCALE, AND CONFLATING THEM LOSES THE ONE DISTINCTION THAT MATTERS:
 *   FAILED     Pi reported a transport-level error — the host could not carry the call out at all.
 *   REFUSED    the call WAS carried out and the tool DECLINED it (`details.ok === false`) — a path that escaped
 *              the workspace, an argv that was not an argv, a runner that would not run. **This is the governed
 *              seam working**, and it must stay distinguishable from a host that fell over.
 *   COMPLETED  the tool did its job. ⚠ NOT "the command passed": `run_command` returns `ok: true` for a non-zero
 *              exit, because the CALL completed and the exit code is the datum it returned. A reader wanting the
 *              command's verdict reads the exit code, which is content-plane, not this field.
 */
export function observedToolOutcome(result: unknown, isError: boolean): AdapterToolCall['outcome'] {
	if (isError) return 'FAILED';
	// ⭑ REUSED, NOT RE-DERIVED. `piToolExecutionSucceeded` already encodes the rule that a DOMAIN refusal
	// outranks the absence of a transport error — *"A Pi execution can succeed at the transport layer while the
	// authoring domain rejects the proposed Command"* — and the execution domain refuses in exactly the same
	// shape, through the same `details.ok`.
	return piToolExecutionSucceeded(result, false) ? 'COMPLETED' : 'REFUSED';
}

/**
 * Records tool calls in the order the session started them.
 *
 * ⭑ ORDER IS LOAD-BEARING: `ObservedToolCall.ordinal` is assigned by `governedToolCallReport` from the position
 * in this list, so a list that resolved by END time would number the calls in the order they finished — which
 * for concurrent calls is a different sequence, recorded permanently as though it were the one that happened.
 */
export interface ToolCallObserver {
	/** A call the session has begun dispatching. Returns nothing: the id is how the end finds it again. */
	started(toolCallId: string, toolName: string): void;
	/** The same call, finished. ⚠ An end with no matching start is IGNORED — see `ended`. */
	ended(toolCallId: string, result: unknown, isError: boolean): void;
	/** How many calls have been recorded so far — the marker a turn slices from. */
	count(): number;
	/** The calls recorded since a marker, in start order. */
	since(marker: number): readonly AdapterToolCall[];
}

export function createToolCallObserver(): ToolCallObserver {
	const calls: { readonly id: string; readonly name: string; outcome: AdapterToolCall['outcome'] }[] =
		[];
	return {
		started(toolCallId, toolName) {
			calls.push({ id: toolCallId, name: toolName, outcome: 'UNKNOWN' });
		},
		ended(toolCallId, result, isError) {
			// ⛔ THE LAST MATCHING START, AND AN UNMATCHED END IS DROPPED RATHER THAN APPENDED. Appending would
			// mint a call this adapter never saw begin — a record of an event from its own bookkeeping error —
			// and `governedToolCallReport` would number it as though the model had made it. A start this adapter
			// missed is a gap in the observation, and `UNKNOWN`/absence is the honest form of a gap.
			for (let i = calls.length - 1; i >= 0; i--) {
				const call = calls[i]!;
				if (call.id !== toolCallId) continue;
				call.outcome = observedToolOutcome(result, isError);
				return;
			}
		},
		count: () => calls.length,
		since: (marker) => calls.slice(marker).map(({ name, outcome }) => ({ name, outcome }))
	};
}
