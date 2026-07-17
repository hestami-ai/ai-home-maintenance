// M13 Reference Undertaking replay conformance. Replaying the fixture's §26 expected event trace (72 steps) must
// exhibit the full professional loop: approved Intent Baseline, satisfied-but-unbaselined Behavior PWU,
// AUTHORITATIVE Architecture Baseline, visible open offline residual, with execution success NEVER implying
// assurance (RPH-FIX-001..006, P1, P5, P6).
//
// SCOPE (corrected 2026-07-17 — this file called itself "the headline end-to-end proof"). The subject here is
// fixtures/expected-events.jsonl, a HAND-AUTHORED transcription of §26. The engine is not involved in any
// assertion below. These tests are worth keeping — they prove the ORACLE ARTIFACT is internally coherent and
// well-formed against the event catalog, which is a precondition for it being usable as an oracle — but they
// prove nothing about the system. Calling that end-to-end let a real drift hide in a green suite for the file's
// entire existence (the fixture said PwuMarkedReady at seq 20/33; the engine said PwuStateChanged; nothing
// compared them). The engine-facing counterpart is replay-conformance.test.ts.
import { describe, expect, it } from 'vitest';
import { foldTerminalStates, loadExpectedEvents, runConformance, runReplay } from './index.js';

describe('M13 Reference Undertaking replay', () => {
	const events = loadExpectedEvents();

	it('loads the authored 72-step §26 expected-events trace', () => {
		expect(events).toHaveLength(72);
		expect(events[0]!.event).toBe('IntentCaptured');
		expect(events.at(-1)!.event).toBe('PwuBaselined');
	});

	it('conformance mode: every RPH-FIX / P1 / P5 / P6 check passes (the whole loop replays coherently)', () => {
		const report = runConformance(events);
		const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
		expect(failed, failed.join(' | ')).toEqual([]);
		expect(report.ok).toBe(true);
		expect(report.eventCount).toBe(72);
	});

	it('RPH-FIX-002: every one of the 72 trace events resolves to a registered event contract', () => {
		const check = runConformance(events).checks.find((c) => c.id === 'RPH-FIX-002')!;
		expect(check.ok, check.detail).toBe(true);
	});

	it('RPH-FIX-003: the trace ends with an AUTHORITATIVE Architecture Baseline + a BASELINED Architecture PWU, with the Behavior PWU satisfied-not-baselined', () => {
		const checks = runConformance(events).checks;
		for (const id of ['RPH-FIX-003a', 'RPH-FIX-003b', 'RPH-FIX-003c'])
			expect(checks.find((c) => c.id === id)!.ok, id).toBe(true);
	});

	it('P1: the trace proves execution success did not imply assurance (conditionally-satisfied before baseline)', () => {
		expect(runConformance(events).checks.find((c) => c.id === 'P1-exec!=assurance')!.ok).toBe(true);
	});

	it('replay mode rebuilds every named aggregate instance from the event history', () => {
		const report = runReplay('replay', events);
		expect(report.ok).toBe(true);
		expect(report.eventCount).toBe(72);
		const terminal = foldTerminalStates(events);
		// the Architecture Baseline instance's terminal event is BaselinePromoted (AUTHORITATIVE)
		expect(terminal.get('Baseline:Architecture Baseline')?.event).toBe('BaselinePromoted');
	});
});
