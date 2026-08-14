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
import {
	auditLedger,
	guardTexts,
	guardedArrows,
	unreachabilityFaults
} from './guard-enforcement-ledger.js';
import { GUARD_LEDGER } from './guard-enforcement-ledger.data.js';
import { arrowKey, declaredArrows } from './arrow-command-census.js';

const AUDIT = auditLedger(GUARD_LEDGER);

/**
 * What C-0 scores COVERED, keyed by C-0's own function.
 *
 * Built here rather than inside the ledger module so CONTROL 5 can inject a different set.
 */
const COVERED: ReadonlySet<string> = new Set(
	declaredArrows().map((a) => arrowKey(a.machine, a.from, a.to))
);

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
	// ⚠ MOVED 2026-08-13, ARROW_UNREACHABLE 22 -> 21 and UNENFORCED 44 -> 45, and the DIRECTION is the point.
	// "Replacement intent identified" was a DISMISSAL that REG-F-131 falsified four commits earlier; correcting
	// it makes the ledger read WORSE, which is what distinguishes this from the reclassification the docblock
	// below forbids. The guard is enforced in a later increment, and only then does this move back.
	ARROW_UNREACHABLE: 21,
	ENFORCED: 14,
	REDUNDANT_WITH_MACHINE: 2,
	UNENFORCED: 45
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

	// ⚠ THE CHECK THE FIRST VERSION OF THIS FILE WAS MISSING, and its absence was a control that could not fail.
	// `enforcedWithoutSite` asks only that the string is non-empty. Six of the fourteen sites went stale within
	// two days — `pwu.ts:746` pointing at `({`, three rows at `/**`, one at a doc comment — and nothing reddened,
	// because a line number that has drifted is still a non-empty string. The anchor is TEXT and must appear
	// EXACTLY ONCE in the cited file, so a moved guard either still exists or reddens here.
	it('requires every ENFORCED row to carry an anchor that still resolves, uniquely', () => {
		expect(
			AUDIT.enforcedAnchorBroken,
			AUDIT.enforcedAnchorBroken.join(' | ')
		).toEqual([]);
	});

	it('pins the disposition census', () => {
		expect(AUDIT.counts, JSON.stringify(AUDIT.counts)).toEqual(COUNTS);
	});

	// ── THE DISMISSAL IS CHECKED TOO ────────────────────────────────────────────────────────────────────────
	// An `ARROW_UNREACHABLE` row says NO COMMAND PERFORMS THIS ARROW — a claim about the code, exactly as an
	// ENFORCED row is. The docblock above COUNTS said the opposite ("ENFORCED is the only disposition that
	// asserts something about the code"), and that belief is why this went unchecked while a row sat false for
	// four commits. `UNENFORCED` needs no such check: it understates, and over-admission is not a defect.
	it('carries no ARROW_UNREACHABLE row that a command actually performs', () => {
		const faults = unreachabilityFaults(GUARD_LEDGER, COVERED);
		expect(
			faults,
			`ARROW_UNREACHABLE rows the census contradicts:\n${faults
				.map((f) => `  "${f.guard}"\n${f.coveredArrows.map((a) => `        ${a}`).join('\n')}`)
				.join('\n')}`
		).toEqual([]);
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

	// ── CONTROL 4: THE ANCHOR CHECK CAN ACTUALLY FAIL ───────────────────────────────────────────────────────
	// `enforcedAnchorBroken: []` is also what a check that never opens a file returns. These synthetic rows
	// redden it in exactly the three ways a real row can break, and in no other world.
	it('CONTROL — a missing, absent, or ambiguous anchor is each caught', () => {
		const victim = guardTexts().find((t) => GUARD_LEDGER[t]?.disposition === 'ENFORCED')!;
		const base = GUARD_LEDGER[victim]!;
		const audit = (over: Partial<typeof base>) =>
			auditLedger({ ...GUARD_LEDGER, [victim]: { ...base, ...over } }).enforcedAnchorBroken;
		expect(audit({ enforcingAnchor: undefined })[0], 'a row with no anchor').toContain('no enforcingAnchor');
		expect(
			audit({ enforcingAnchor: 'this text appears in no source file anywhere' })[0],
			'an anchor that no longer exists — the stale-line case, now caught'
		).toContain('anchor absent');
		// `import` appears many times in any handler: the ambiguity arm, which is what stops a lazy anchor.
		expect(audit({ enforcingAnchor: 'import' })[0], 'an anchor matching more than once').toContain(
			'ambiguous'
		);
	});

	// ── CONTROL 5: THE UNREACHABILITY CHECK CAN ACTUALLY FAIL ───────────────────────────────────────────────
	// `[]` is also what this join returns when the two censuses key arrows differently — the failure this check
	// is most exposed to, and one that reads as "no faults" while comparing nothing. So a row marked
	// ARROW_UNREACHABLE on a demonstrably COVERED arrow must surface...
	it('CONTROL — ARROW_UNREACHABLE on a covered arrow is caught, and UNENFORCED on it is not', () => {
		const baseline = unreachabilityFaults(GUARD_LEDGER, COVERED).map((f) => f.guard);
		const victim = guardedArrows().find((a) => COVERED.has(arrowKey(a.machine, a.from, a.to)));
		expect(
			victim,
			'at least one GUARDED arrow must be covered for this control to mean anything'
		).toBeDefined();

		const dismissed = unreachabilityFaults(
			{ ...GUARD_LEDGER, [victim!.guard]: { disposition: 'ARROW_UNREACHABLE', evidence: '<control>' } },
			COVERED
		).map((f) => f.guard);
		expect(dismissed, 'the synthetic dismissal must surface').toContain(victim!.guard);
		expect(dismissed.length, 'and surface exactly one NEW fault').toBe(baseline.length + 1);

		// ...and the SAME arrow ADMITTED rather than dismissed must not, which pins the one-directionality.
		// A gate that also pushed UNENFORCED rows toward ARROW_UNREACHABLE would manufacture the dismissals
		// this whole check exists to catch.
		const admitted = unreachabilityFaults(
			{ ...GUARD_LEDGER, [victim!.guard]: { disposition: 'UNENFORCED', evidence: '<control>' } },
			COVERED
		).map((f) => f.guard);
		expect(admitted, 'UNENFORCED is an admission, never a fault').toEqual(baseline);
	});

	// ── CONTROL 6: AN EMPTY COVERED SET IS REFUSED, NOT PASSED ──────────────────────────────────────────────
	// The whole check degrades to green if the census hands it nothing. It must throw instead of reporting [].
	it('CONTROL — an empty covered set throws rather than passing every row', () => {
		expect(() => unreachabilityFaults(GUARD_LEDGER, new Set())).toThrow(/census reader is broken/);
	});
});
