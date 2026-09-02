// ICP-03 (the half that needs no ruling) — turn the SILENT omission into a DISCLOSED one.
//
// PER-9: "Log-plane redaction of sensitive prompt content is legal; record-plane omission is not."
// Today `transcript.ts` drops volunteered reasoning at the write boundary and NOTHING records that it did.
// The drop itself is defensible — events are immutable and permanent (§9.4), so anything admitted could never
// be purged, and PER-12 requires retained reasoning to be purgeable at expiry. What is NOT defensible is that
// the drop leaves no trace.
//
// ⭑ AND THE DISCLOSURE NEEDS NO CONTENT STORE, WHICH IS WHY IT IS NOT BLOCKED ON REG-Q-B.
// Recording THAT content was omitted, and why, is METADATA. Only the omitted bytes are content. So the
// disclosed half of ICP-03 is buildable today and the retention half waits on ICP-03's ruling.
import { describe, expect, it } from 'vitest';
import { omissionFor, TRANSCRIPT_KIND } from './transcript.js';

describe('ICP-03 · omission disclosure — PER-9: record-plane omission is not legal', () => {
	it('dropping volunteered reasoning YIELDS an omission region', () => {
		const region = omissionFor('thinking');

		// THE MUTANT: return undefined for every kind. That is today's behaviour — the drop happens and nothing
		// says so — and it is the exact thing PER-9 forbids.
		expect(region).toBeDefined();
		expect(region?.role).toBe('VOLUNTEERED_REASONING');
	});

	it('the region states WHY, in terms naming the invariants that force it', () => {
		const reason = omissionFor('thinking')?.reason ?? '';

		// THE MUTANT: a bare reason like "dropped". A disclosure that does not say what forced it is a label,
		// not a record — a later reader cannot tell a deliberate boundary from an oversight, which is the
		// distinction this whole entry exists to preserve.
		expect(reason).toMatch(/PER-12/);
		expect(reason).toMatch(/purge|purgeable/i);
	});

	it('UI chrome is NOT an omission — only governed content is', () => {
		// THE MUTANT: treat every non-recordable kind as an omission. `status` lines are display chrome the
		// corpus never asks anyone to retain; recording them as governed-content omissions would inflate the
		// disclosure with noise and make the real one unfindable. An over-broad disclosure is its own defect.
		expect(omissionFor('status')).toBeUndefined();
		expect(omissionFor('message')).toBeUndefined();
	});

	it('every RECORDABLE kind yields no omission — derived from the map, not hand-listed', () => {
		// Derived so a new recordable kind cannot silently start reporting itself as omitted. Hand-listing the
		// kinds here would be the defect one level up: a list that rots the first time the map changes.
		const recordable = Object.values(TRANSCRIPT_KIND).filter((k) => k !== 'thinking');
		for (const kind of recordable) expect(omissionFor(kind), kind).toBeUndefined();
		expect(recordable.length).toBeGreaterThan(0); // the loop must actually run
	});
});
