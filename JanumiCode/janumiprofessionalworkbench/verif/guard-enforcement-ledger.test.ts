// C-0b — THE DECLARED ARROW GUARDS ARE ALL CLASSIFIED, AND THE CLASSIFICATION CANNOT ROT SILENTLY.
//
// REG-F-072: *"`transitions.data.ts` declares `guard:` on 152 arrows — 86 distinct texts — and no control in this
// repository has ever checked one."* That finding shipped with a census whose per-text result **was never
// persisted**, so the repository carried a headline it could not reproduce. This file is the ledger's control.
//
// ── WHAT IT DOES AND DOES NOT PROVE ──────────────────────────────────────────────────────────────────────────
// It does NOT prove the guards are enforced — 44 of 82 are recorded UNENFORCED, which is the finding, not a
// failure of this file. What it proves is that **every declared guard has been looked at, that the looking is
// written down, that a new guard cannot appear unclassified, and that the ledger cannot be improved by deleting
// guards from the machine table.** A census that leaves no ledger is an anecdote; a ledger with no control is a
// document that drifts.
import { describe, expect, it } from 'vitest';
import { auditLedger, guardTexts, guardedArrows } from './guard-enforcement-ledger.js';
import { GUARD_LEDGER } from './guard-enforcement-ledger.data.js';

const AUDIT = auditLedger(GUARD_LEDGER);

/**
 * The population, pinned.
 *
 * ⚠ BOTH NUMBERS, and the arrow count is the load-bearing one. Pinning only the TEXT count would let someone
 * delete fifteen of the seventeen `-> ABANDONED` arrows without moving it, because they share one text.
 */
const ARROWS = 146;
const TEXTS = 82;

/**
 * The disposition census, pinned so any movement is deliberate.
 *
 * ⚠ THESE ARE NOT A SCORE TO IMPROVE. `UNENFORCED: 44` is the honest state of a system whose declared guards
 * were never checked; the way to move it is to enforce a guard and re-drive its row, never to reclassify one.
 * ENFORCED is the only disposition that asserts something about the code, which is why it is the only one the
 * adversarial pass attacked — and it attacked sixteen claims and overturned two.
 */
const COUNTS = {
	ARROW_UNREACHABLE: 22,
	ENFORCED: 14,
	REDUNDANT_WITH_MACHINE: 2,
	UNENFORCED: 44
};

describe('C-0b — every declared arrow guard is classified, and the ledger is pinned', () => {
	it('pins the guarded-ARROW total, so a guard cannot be resolved by deleting its arrow', () => {
		expect(
			AUDIT.arrowCount,
			'the number of guarded arrows moved — update the pin DELIBERATELY'
		).toBe(ARROWS);
	});

	it('pins the distinct guard-TEXT total', () => {
		expect(AUDIT.textCount, 'the number of distinct guard texts moved — update the pin DELIBERATELY').toBe(
			TEXTS
		);
	});

	// THE ANTI-ROT ASSERTION, and the reason this file is worth more than the census that preceded it: a guard
	// added to `transitions.data.ts` tomorrow arrives here unclassified and reddens, so the declaration cannot
	// outrun the reading of it.
	it('leaves no declared guard unclassified', () => {
		expect(
			AUDIT.unclassified,
			`declared guard texts with no ledger row:\n${AUDIT.unclassified.join('\n')}`
		).toEqual([]);
	});

	// The other direction: a row whose text no arrow declares any more. Left alone it would keep asserting
	// something about a guard that no longer exists, which is how a ledger starts describing a former repository.
	it('carries no stale row naming a guard the machines no longer declare', () => {
		expect(AUDIT.stale, `ledger rows matching no declared guard:\n${AUDIT.stale.join('\n')}`).toEqual([]);
	});

	// ENFORCED is the only disposition that CLAIMS something, so it is the only one required to cite. "Enforced"
	// without a line is the claim, not the evidence.
	it('requires every ENFORCED row to name the line that refuses', () => {
		expect(
			AUDIT.enforcedWithoutSite,
			`ENFORCED rows with no enforcingSite:\n${AUDIT.enforcedWithoutSite.join('\n')}`
		).toEqual([]);
	});

	it('pins the disposition census', () => {
		expect(AUDIT.counts, JSON.stringify(AUDIT.counts)).toEqual(COUNTS);
	});

	// ── CONTROL 1: THE READER IS REAL ────────────────────────────────────────────────────────────────────────
	// Every assertion above is satisfied by a reader that returns nothing against a ledger that says nothing.
	// This fails in exactly that world, and it names the specific shapes a broken reader loses: the 17-arrow
	// text that one edit could collapse to one, and a guard on a machine other than the PWU.
	it('CONTROL — the reader resolves real guards across several machines', () => {
		const arrows = guardedArrows();
		expect(arrows.length).toBeGreaterThan(100);
		expect(new Set(arrows.map((a) => a.machine)).size).toBeGreaterThan(10);
		// The most-repeated text: 17 arrows, one disposition. A reader that de-duplicated arrows would drop 16.
		expect(
			arrows.filter((a) => a.guard === 'Authorized decision (Decision.decisionType=ABANDON)').length
		).toBe(17);
		// Not PWU-only — the ledger covers the assurance, governance and execution machines too.
		expect(new Set(arrows.map((a) => a.machine))).toContain('Baseline.status');
		expect(guardTexts().length).toBe(new Set(guardTexts()).size);
	});

	// ── CONTROL 2: THE UNCLASSIFIED CHECK CAN ACTUALLY FAIL ─────────────────────────────────────────────────
	// `unclassified: []` is also what a broken audit that never looks produces. Feeding the audit a ledger with
	// one row REMOVED must surface exactly that text. Predicted red for any mutant that makes `unclassified`
	// unconditionally empty — and green for every real-population change, so it cannot redden with the herd.
	it('CONTROL — removing one row makes exactly that guard unclassified', () => {
		const victim = guardTexts()[0]!;
		const { [victim]: _removed, ...withoutOne } = GUARD_LEDGER;
		const audit = auditLedger(withoutOne);
		expect(audit.unclassified).toEqual([victim]);
		expect(audit.stale, 'removing a row must not also invent a stale one').toEqual([]);
	});

	// ── CONTROL 3: THE ENFORCED-CITATION CHECK CAN ACTUALLY FAIL ────────────────────────────────────────────
	// Same argument one level down: `enforcedWithoutSite: []` is what a check that never looks also returns.
	it('CONTROL — an ENFORCED row without a site is caught', () => {
		const enforced = guardTexts().find((t) => GUARD_LEDGER[t]?.disposition === 'ENFORCED');
		expect(enforced, 'the ledger must contain at least one ENFORCED row for this control to mean anything').
			toBeDefined();
		const audit = auditLedger({
			...GUARD_LEDGER,
			[enforced!]: { disposition: 'ENFORCED', evidence: 'stripped for the control' }
		});
		expect(audit.enforcedWithoutSite).toEqual([enforced]);
	});
});
