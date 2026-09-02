// ICP-03b — EVERY streamed event kind must have an explicit write-boundary disposition.
//
// ── WHY THIS GATE EXISTS: IT CAUGHT A DEFECT ITS OWN AUTHOR SHIPPED ─────────────────────────────────────────
// `OMISSION_ROLE` was authored as a hand-written one-entry map `{thinking: …}` and never checked against the
// event union. The union has EIGHT kinds; `TRANSCRIPT_KIND` maps FIVE. So `status`, `producer` and `done` fell
// through to `''` and were dropped with NOTHING declared — and `producer` carries the resolved model/provider,
// which is PER-9's E-3 and the surviving half of finding #10.
//
// The defect is the shape this repository has recorded most often: a hand-listed set standing in for a derived
// one. The remedy is not a longer hand-list — it is TOTALITY, enforced, so the next added event kind cannot be
// dropped in silence.
import { describe, expect, it } from 'vitest';
import { AUTHORING_EVENT_KINDS } from './types.js';
import { dispositionOf, omissionFor, TRANSCRIPT_KIND } from './transcript.js';

describe('ICP-03b · write-boundary disposition is TOTAL over the event union', () => {
	it('every event kind has a disposition — derived from the union, never hand-listed', () => {
		for (const kind of AUTHORING_EVENT_KINDS) {
			expect(dispositionOf(kind), kind).toBeDefined();
		}
		// The loop must actually run over a plural population, or totality is vacuous.
		expect(AUTHORING_EVENT_KINDS.length).toBeGreaterThan(5);
	});

	it('`producer` is declared as a GOVERNED omission — it carries PER-9 E-3', () => {
		// THE MUTANT that reproduces the shipped defect: leave `producer` out of the disposition map. It then
		// falls through and is dropped in silence, which is what PER-9 forbids and what was committed.
		expect(dispositionOf('producer')).toBe('DROPPED_GOVERNED');
		const region = omissionFor('producer');
		expect(region?.role).toBe('RESOLVED_MODEL_IDENTITY');
		expect(region?.reason).toMatch(/E-3|resolved provider/i);
	});

	it('chrome is declared as chrome, not as a governed loss', () => {
		// `status` and `done` are display/stream control. Declaring them as governed omissions would bury the
		// real ones — an over-broad disclosure is its own defect.
		expect(dispositionOf('status')).toBe('DROPPED_CHROME');
		expect(dispositionOf('done')).toBe('DROPPED_CHROME');
		expect(omissionFor('status')).toBeUndefined();
		expect(omissionFor('done')).toBeUndefined();
	});

	it('every kind TRANSCRIPT_KIND maps to a recordable entry is disposed RECORDED', () => {
		const recorded = Object.entries(TRANSCRIPT_KIND)
			.filter(([, mapped]) => mapped !== 'thinking')
			.map(([evKind]) => evKind);
		for (const kind of recorded) expect(dispositionOf(kind), kind).toBe('RECORDED');
		expect(recorded.length).toBeGreaterThan(0);
	});

	it('`thinking` remains a governed omission', () => {
		expect(dispositionOf('thinking')).toBe('DROPPED_GOVERNED');
		expect(omissionFor('thinking')?.role).toBe('VOLUNTEERED_REASONING');
	});
});
