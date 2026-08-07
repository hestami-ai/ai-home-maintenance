// THE EMPTY-STRING BRANCH, PINNED DIRECTLY — the one PER-4 assertion no end-to-end test can make.
//
// While `readRenderedRevision` lived inside `routes/decisions/+page.server.ts` it was reachable only through a
// rendered page, and every rendered page supplies the hidden field. So the branch that carries the whole defence
// — "the form declared NOTHING, which is not the same as declaring 0" — could not be exercised by the e2e that
// nominally covered it. Removing the hidden field DOES redden that e2e, but it reddens it for the compound
// reason (no field AND the guard), never isolating the guard itself. That gap was recorded as an open caveat
// when /decisions landed (commit 0b21d752); this file closes it.
//
// THE RULE: JPWB-DOC-003 §9 PER-4 + SPEC-001 §11.4.22 item 2.
//
// WHY 0 IS THE WHOLE PROBLEM: `createObject` commits `newRevision: alsoEvents.length`
// (packages/rph-application/src/handlers/kit.ts:563), so a freshly created aggregate with no follow-on events
// sits at revision 0 — and `Number('')` is 0. A missing field and a legitimately-brand-new subject are one
// keystroke apart, and only one of them may be honoured.

import { describe, expect, it } from 'vitest';
import { EXPECTED_REVISION_FIELD, readRenderedRevision } from './optimistic-concurrency';

/** A form carrying exactly the given raw field value; `undefined` means the field was never rendered. */
function form(raw?: string): FormData {
	const f = new FormData();
	f.set('id', 'base_01ARZ3NDEKTSV4RRFFQ69M1001');
	if (raw !== undefined) f.set(EXPECTED_REVISION_FIELD, raw);
	return f;
}

describe('readRenderedRevision — a form that declared nothing is not a form that declared 0', () => {
	// ── THE DEFENCE ────────────────────────────────────────────────────────────────────────────────────────
	it('returns null when the field was never rendered', () => {
		expect(readRenderedRevision(form())).toBeNull();
	});

	it('returns null for the EMPTY STRING a browser posts when the input is missing its value', () => {
		// This is the literal wire shape of the defect: `<input value={undefined}>` posts ''.
		expect(readRenderedRevision(form(''))).toBeNull();
		expect(readRenderedRevision(form('   '))).toBeNull();
	});

	// ── THE CONTROL, without which every assertion above is satisfied by `return null` ──────────────────────
	it('returns 0 for a genuinely declared revision 0', () => {
		// A parser that refused everything would pass all three assertions above and protect nothing. It would
		// also fail-close every first action on every freshly created aggregate, which is the OPPOSITE defect
		// and just as invisible: the surface would look strict and be unusable.
		expect(readRenderedRevision(form('0'))).toBe(0);
	});

	it('DISCRIMINATES the two — this single assertion is what the guard is for', () => {
		// Stated as its own assertion because it is the property, not a consequence of the ones above: a
		// regression that collapsed them would have to make this line lie outright.
		expect(readRenderedRevision(form(''))).not.toBe(readRenderedRevision(form('0')));
	});

	// ── ORDINARY PARSING ───────────────────────────────────────────────────────────────────────────────────
	it('accepts a declared revision, trimming transport whitespace', () => {
		expect(readRenderedRevision(form('3'))).toBe(3);
		expect(readRenderedRevision(form(' 12 '))).toBe(12);
	});

	it('refuses anything that is not a plain decimal non-negative integer', () => {
		// A revision is a count of committed events, and the template emits it as `value={d.revision}` — a
		// decimal integer, always. Every string below is something that render CANNOT produce.
		//
		// `0x2` and `1e3` ARE THE CASES THAT MATTER, and they are why this test exists rather than a
		// `Number.isInteger` check: `Number('0x2')` is 2 and `Number('1e3')` is 1000, so both are integers and
		// both are >= 0. The first version of this parser accepted them; this assertion is what found it.
		for (const bad of ['abc', '-1', '1.5', 'NaN', 'Infinity', '0x2', '1e3', '+1', '2n', '١٢']) {
			expect(readRenderedRevision(form(bad)), `"${bad}" must not parse`).toBeNull();
		}
	});

	it('refuses a revision beyond safe-integer range rather than comparing rounded values', () => {
		// `Number('9007199254740993')` rounds to 9007199254740992. Two distinct revisions could then compare
		// equal, which would turn the compare-and-swap into a coin flip precisely where it is meant to refuse.
		expect(readRenderedRevision(form('9007199254740993'))).toBeNull();
		expect(readRenderedRevision(form(String(Number.MAX_SAFE_INTEGER)))).toBe(Number.MAX_SAFE_INTEGER);
	});

	it('refuses a non-string field (a multi-part file upload named expectedRevision)', () => {
		const f = form();
		f.set(EXPECTED_REVISION_FIELD, new Blob(['7']), 'rev.txt');
		expect(readRenderedRevision(f)).toBeNull();
	});
});
