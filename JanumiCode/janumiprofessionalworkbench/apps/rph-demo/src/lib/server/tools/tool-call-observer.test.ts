// ⭐⭐ JAN-EXEC PHASE 3 — the victim for the ADAPTER'S OWN INSTRUMENT.
//
// ⛔ §22.1 MAKES MODEL OUTPUT UNTRUSTED EXTERNAL INPUT, so *"the model said it ran the tests"* is not evidence
// that tests ran. Everything asserted below is a fact taken from the SESSION'S event stream — what the host
// watched happen — and the whole value of the field it feeds is that it is a different witness from the answer.
import { describe, expect, it } from 'vitest';
import { createToolCallObserver, observedToolOutcome } from './tool-call-observer.js';

/** What Pi hands back from a custom tool: `details.ok` is the DOMAIN outcome, distinct from a transport error. */
const piResult = (ok: boolean) => ({
	content: [{ type: 'text', text: 'x' }],
	details: { ok, summary: 'x' }
});

describe('observedToolOutcome — three outcomes that must stay distinguishable', () => {
	it('⭑ a transport error is FAILED — the host could not carry the call out', () => {
		expect(observedToolOutcome(piResult(true), true)).toBe('FAILED');
	});

	it('⭐⭐ a DOMAIN refusal is REFUSED, not FAILED — this is the governed seam WORKING', () => {
		// ⛔ THE DISTINCTION THAT CARRIES THE PHASE. `write_file` refusing `../escape` and a host that fell over
		// are opposite facts with opposite consequences for a reader, and they arrive through the same event.
		// THE MUTANT: return `isError ? 'FAILED' : 'COMPLETED'` — every containment refusal this seam performs is
		// then recorded as a clean completion, and the record says the escape succeeded.
		expect(observedToolOutcome(piResult(false), false)).toBe('REFUSED');
	});

	it('⭑ a plain completion is COMPLETED', () => {
		expect(observedToolOutcome(piResult(true), false)).toBe('COMPLETED');
	});

	it('⚠ a result with no structured details keeps Pi’s transport semantics', () => {
		// `piToolExecutionSucceeded` records that rule; this asserts it is not re-derived more harshly here,
		// which would grade every built-in-shaped result as a refusal.
		expect(observedToolOutcome('a bare string', false)).toBe('COMPLETED');
		expect(observedToolOutcome(undefined, false)).toBe('COMPLETED');
	});
});

describe('the observer records what the session did, in the order it did it', () => {
	it('⭑⭑ calls are recorded in START order, not in the order they finished', () => {
		// ⛔ `ObservedToolCall.ordinal` is assigned from this position and the record is PERMANENT. Two concurrent
		// calls resolved by END time are numbered in a sequence that did not happen — recorded forever as though
		// it had. THE MUTANT: append on `ended` instead of `started`.
		const o = createToolCallObserver();
		o.started('c1', 'write_file');
		o.started('c2', 'run_command');
		o.ended('c2', piResult(true), false);
		o.ended('c1', piResult(true), false);
		expect(o.since(0).map((c) => c.name)).toEqual(['write_file', 'run_command']);
	});

	it('⭐ a call that STARTED and never ENDED is UNKNOWN — never COMPLETED and never dropped', () => {
		// ⛔ THE TURN ENDED FIRST, OR THE SESSION WAS DISPOSED. Grading it COMPLETED is a fabricated measurement;
		// dropping it is worse, because the attempt happened and an attempted call is the security-relevant
		// fact. THE MUTANT: default the outcome to COMPLETED, or skip un-ended calls in `since`.
		const o = createToolCallObserver();
		o.started('c1', 'run_command');
		expect(o.since(0)).toEqual([{ name: 'run_command', outcome: 'UNKNOWN' }]);
	});

	it('⛔ an END with no matching START is DROPPED, never appended', () => {
		// ⚠ APPENDING WOULD MINT A CALL THIS ADAPTER NEVER SAW BEGIN — a record of the observer's own bookkeeping
		// error, numbered as though the model had made it. A gap in an observation is honestly an absence.
		// THE MUTANT: `calls.push(...)` in the not-found branch.
		const o = createToolCallObserver();
		o.ended('ghost', piResult(true), false);
		expect(o.since(0)).toEqual([]);
	});

	it('⭐⭐ `since` is PER TURN — a repair turn does not re-report its predecessor’s calls', () => {
		// ⛔ THE SESSION IS HELD ACROSS TRIES (`JAN-EXECSESS`) and each try gets its OWN exchange record. A turn
		// that reported the whole session would record try 1's command on try 2's record as well — the same call
		// asserted twice, permanently, on two records that each claim to describe one bounded try (`PER-9`).
		// THE MUTANT: return the whole list from `since`.
		const o = createToolCallObserver();
		o.started('c1', 'write_file');
		o.ended('c1', piResult(true), false);
		const afterTurnOne = o.count();
		o.started('c2', 'run_command');
		o.ended('c2', piResult(false), false);
		expect(o.since(0)).toHaveLength(2);
		expect(o.since(afterTurnOne)).toEqual([{ name: 'run_command', outcome: 'REFUSED' }]);
	});

	it('⚠ the LAST matching start wins, so a re-used call id cannot re-grade an earlier call', () => {
		const o = createToolCallObserver();
		o.started('dup', 'write_file');
		o.ended('dup', piResult(true), false);
		o.started('dup', 'write_file');
		o.ended('dup', piResult(false), false);
		expect(o.since(0).map((c) => c.outcome)).toEqual(['COMPLETED', 'REFUSED']);
	});
});
