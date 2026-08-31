// JAN-SLICE-SWP-03 — the SL-5 gate: every ratified scenario class is COVERED, or explicitly EXEMPT with a reason.
//
// ── WHY THIS FILE EXISTS, AND WHY ITS ABSENCE WAS THE DEFECT ─────────────────────────────────────────────────
// `SL-5` relays a ratified obligation from `RPH-DOC-003 §12`, whose own sentence carries the deontic force:
//
//   "Applicable scenario classes (normal path, alternate valid path, user-error path, system-failure path,
//    permission-denied path, interrupted or resumed path, data-unavailable path, cancellation path) are covered
//    or their inapplicability is explicit."
//
// Until this file, NOTHING CHECKED THAT. `verif/slice-ledger.ts` validates that each Slice's declared
// `scenarioClass` is one of the eight, and renders it in the table — a per-row check. Nothing asserted anything
// about the SET. So the obligation was prose, and a programme could ship seven Slices all declaring
// `normal path` and satisfy every gate it had.
//
// That is the failure mode this repository has recorded before under its own name: a rule that is stated in a
// design document, relayed into a type, rendered into a report, and enforced by nothing. `SL-5` was three of
// those four.
//
// ── WHY THE EXEMPTION LIST IS EMPTY, AND WHY THAT IS A FINDING RATHER THAN A DEFAULT ─────────────────────────
// `SL-5` permits a class to be recorded INAPPLICABLE instead of covered. No class is exempt here, and that is a
// measured result, not an omission:
//
//   1. ALL EIGHT CLASSES ARE ENGINE-REPRESENTABLE. Checked per class against the command surface — the
//      cancellation family (`CancelExecutionPlan`, `CancelExecutionStep`, `PruneExecutionStep`,
//      `SkipExecutionStep`, `AbandonPwu`), the failure family (`FailExecutionStep`, `FailExecutionPlan`,
//      `RetryExecutionStep`, each carrying a `failureClass`), the unavailability family (`BlockPwu`,
//      `EscalatePwu`), the refusal surface every handler returns through `STATUS_FOR_CODE`, and TWO distinct
//      permission-denied mechanisms (see the note on that class below).
//   2. ALL EIGHT HAVE AUTHORED MATERIAL. The Field Service reference undertaking names its own exceptional paths
//      — "Customer cancels", "Network unavailable during field update", "Technician unavailable", "Technician
//      cannot complete work", "Estimate rejected", "Customer requests revision", "Job rescheduled", "Work
//      requires follow-up visit", "Invoice disputed" — and `SL-S4` directs that these be drawn on rather than
//      new scenarios invented.
//
// ⚠ SO "NO RATIFIED `RPH-E2E` SCENARIO EXISTS FOR THIS CLASS" IS NOT A REASON, AND MUST NEVER BE ENTERED AS ONE.
// The roadmap says this in terms: *"The absence of a ratified scenario is NOT a reason to call a class
// inapplicable — the ratified rule requires inapplicability to be explicit, and 'no one wrote one' is not a
// reason."* Four classes have no `RPH-E2E` rule; all four are coverable.
//
// ⚠⚠ AND THIS LIST IS THE MOST DANGEROUS DATA IN THIS FILE. The precedent is `DEFERRABLE_PREFIXES` in
// `conformance-manifest.ts`, which says of itself: *"an entry here does not weaken a claim, it DELETES the
// claim"* — and which carried two wrong entries for months, one of them exempting a family whose rules already
// had passing checks. An entry here removes a whole class of journey from the question, and nothing downstream
// can see that it is gone. Adding one requires a REASON THAT IS ABOUT THE CLASS, not about the state of the work.
//
// ⚠ WHERE AN INAPPLICABILITY RECORD WOULD HAVE TO LIVE, IF ONE IS EVER NEEDED. `REG-D-046` Ruling 2 established
// that a deferral is a first-class engine fact, and the roadmap's §9 requires an inapplicability record to ride
// that plane — "not as prose in a document, and never in `outOfScope`". This gate deliberately does NOT build
// that path, because building it would settle by construction a question no live case has yet posed: a scenario
// class is a fact about this VERIFICATION PROGRAMME, and the deferral plane's subjects and carriers are objects
// in a professional undertaking. Which of those a class-exemption is remains open. The list is empty, so the
// question does not arise today; if a class ever needs exempting, THAT is the moment to answer it, and this
// comment is the marker.
import { SCENARIO_CLASSES } from '@janumipwb/rph-contracts/slice';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Classes deliberately not covered, each with a reason ABOUT THE CLASS.
 *
 * EMPTY, and see the header for why that is a measured finding rather than a default.
 */
const EXEMPT: Readonly<Record<string, string>> = {};

interface LedgerRow {
	readonly id: string;
	readonly scenarioClass: string;
	readonly path: string;
}

/**
 * ⚠ READ FROM THE COMMITTED LEDGER, NOT BY RE-SCANNING THE FILESYSTEM. The ledger is the generated product whose
 * own gate (`slice-ledger.test.ts`) already proves it equals what the declarations generate and is not stale. A
 * second, independent scan here would be a competing derivation of the same fact — and the one that disagreed
 * would be believed by whichever gate ran last. One source.
 */
function ledgerRows(): LedgerRow[] {
	const raw = readFileSync(`${ROOT}verif/slices/slice-ledger.baseline.json`, 'utf8');
	const parsed = JSON.parse(raw) as { rows?: LedgerRow[] };
	return parsed.rows ?? [];
}

describe('SL-5 — every ratified scenario class is covered or explicitly exempt', () => {
	it('the ledger really was read, and it has rows (CONTROL)', () => {
		// Without this, every assertion below is vacuous the moment the ledger becomes unreadable or empty: an
		// empty `rows` would make `covered` empty, and a gate that fails for the wrong reason is still a gate that
		// cannot be trusted when it passes. This is the control that separates "no class is covered" from "the
		// instrument is broken".
		const rows = ledgerRows();
		expect(rows.length, 'the committed Slice ledger must contain rows').toBeGreaterThan(0);
		expect(
			rows.every((r) => typeof r.scenarioClass === 'string' && r.scenarioClass.length > 0),
			'every ledger row must declare a scenarioClass'
		).toBe(true);
	});

	it('every one of the eight classes is covered by at least one Slice, or exempt with a stated reason', () => {
		const covered = new Set(ledgerRows().map((r) => r.scenarioClass));
		const unaccounted = SCENARIO_CLASSES.filter((c) => !covered.has(c) && EXEMPT[c] === undefined);
		expect(
			unaccounted,
			`these ratified scenario classes are neither covered by a Slice nor recorded exempt with a reason — SL-5 requires one or the other, and "no ratified scenario exists for it" is NOT a reason (roadmap §9): ${unaccounted.join(', ')}`
		).toEqual([]);
	});

	it('no exemption is recorded for a class that is in fact covered', () => {
		// The OPPOSITE direction, and the one that rots silently. An exemption whose class later gains a Slice
		// becomes a live claim that the class is inapplicable while the repository proves it applicable — the
		// precise shape of the RPH-FIX underclaim, where the manifest deferred a family that already had four
		// passing checks and nothing could see the contradiction because an exempt entry certifies nothing.
		const covered = new Set(ledgerRows().map((r) => r.scenarioClass));
		const contradicted = Object.keys(EXEMPT).filter((c) => covered.has(c));
		expect(
			contradicted,
			`these classes are recorded EXEMPT and are also covered by a Slice; the exemption is stale and must be removed: ${contradicted.join(', ')}`
		).toEqual([]);
	});

	it('no exemption names a class that is not one of the ratified eight', () => {
		const unknown = Object.keys(EXEMPT).filter((c) => !(SCENARIO_CLASSES as readonly string[]).includes(c));
		expect(
			unknown,
			`these exemptions name classes that are not in the ratified set, so they exempt nothing and hide the class they were meant to name: ${unknown.join(', ')}`
		).toEqual([]);
	});

	it('every exemption states a reason, and the reason is not the prohibited one', () => {
		// `SL-5` requires inapplicability to be EXPLICIT. A blank reason is not explicit, and the roadmap names
		// one reason as prohibited outright. Both are checked here rather than trusted to review.
		for (const [cls, reason] of Object.entries(EXEMPT)) {
			expect(reason.trim().length, `the exemption for '${cls}' states no reason`).toBeGreaterThan(30);
			expect(
				/no (ratified )?scenario|no one wrote|not yet written|unbuilt/i.test(reason),
				`the exemption for '${cls}' gives the one reason the roadmap prohibits: the absence of a ratified scenario is not a reason to call a class inapplicable`
			).toBe(false);
		}
	});
});
