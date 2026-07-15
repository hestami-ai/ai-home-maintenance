// The §9.7 boundary, at the two places it is actually decided. These are the regression locks: each one FAILS if
// the pre-amendment behaviour is reintroduced, which is the whole point — §14.3 warns that a scenario which cannot
// fail "passes this trivially". Asserted over data, not model prose (§14.1), so nothing here rots.
import { describe, expect, it } from 'vitest';
import {
	isRecordable,
	narrationOf,
	TRANSCRIPT_KIND,
	type TranscriptEntry
} from './transcript.js';

/** Reasoning-shaped text of the kind a local/open-weight model volunteers inline, or a hosted API summarizes. */
const REASONING = 'Let me think. The user probably wants X, but I am unsure, so I will guess and move on.';

const TURN: TranscriptEntry[] = [
	{ role: 'USER', kind: 'message', text: 'Author a product realization PWA.' },
	{ role: 'AGENT', kind: 'thinking', text: REASONING },
	{ role: 'AGENT', kind: 'message', text: 'I added a Realization root.' },
	{ role: 'AGENT', kind: 'tool_call', text: 'define_pwu_type(name=Realization)' },
	{ role: 'AGENT', kind: 'tool_result', text: 'define_pwu_type: ok', success: true },
	{ role: 'AGENT', kind: 'message', text: 'Then three child types beneath it.' },
	{ role: 'SYSTEM', kind: 'message', text: '⚖ Running the assurance floor…' }
];

describe('narrationOf — what the independent reviewer is allowed to see (§9.7 / §8.12)', () => {
	it('excludes the producer interior', () => {
		// THE LOCK. Before the amendment this filter also matched kind==='thinking', so the producer's own
		// reasoning was pasted into the reviewer's prompt — a hidden-context independence violation (§8.12) in
		// the one control §8.4 makes non-suppressible. Re-add that disjunct and this goes red.
		expect(narrationOf(TURN)).not.toContain(REASONING);
	});

	it('keeps the agent OBSERVABLE narration, in order', () => {
		expect(narrationOf(TURN)).toBe('I added a Realization root.\nThen three child types beneath it.');
	});

	it('excludes the user, the system, and tool traffic — the reviewer judges the producer, not the harness', () => {
		const n = narrationOf(TURN);
		expect(n).not.toContain('Author a product realization PWA.'); // the intent arrives via its own field
		expect(n).not.toContain('define_pwu_type');
		expect(n).not.toContain('assurance floor');
	});

	it('is empty, not undefined, when the producer narrated nothing — presence is never a signal (§9.7)', () => {
		expect(narrationOf([{ role: 'AGENT', kind: 'thinking', text: REASONING }])).toBe('');
	});
});

describe('isRecordable — what may enter the durable, permanent Event log (§9.7 / §9.4)', () => {
	it('refuses reasoning material', () => {
		// THE LOCK. Events are immutable and permanent (§9.4), so reasoning admitted here could never be purged —
		// which is why §9.7 requires the drop at the boundary rather than a cleanup afterwards.
		expect(isRecordable('thinking')).toBe(false);
		expect(isRecordable(TRANSCRIPT_KIND.thinking)).toBe(false);
	});

	it('admits the professional record of the turn', () => {
		for (const kind of ['message', 'tool_call', 'tool_result', 'error']) {
			expect(isRecordable(kind), kind).toBe(true);
		}
	});

	it('refuses anything it does not recognize — fail closed (§13.3)', () => {
		expect(isRecordable('')).toBe(false);
		expect(isRecordable('reasoning_summary')).toBe(false);
	});

	it('maps every streamed agent event kind, so nothing is dropped by accident', () => {
		// A new event kind with no mapping is silently unrecordable. That is the safe direction, but it must be a
		// decision: this asserts the mapping is complete for the kinds the agent seam actually emits.
		for (const kind of ['text', 'thinking', 'tool_start', 'tool_end', 'error']) {
			expect(TRANSCRIPT_KIND[kind], kind).toBeTruthy();
		}
	});
});
