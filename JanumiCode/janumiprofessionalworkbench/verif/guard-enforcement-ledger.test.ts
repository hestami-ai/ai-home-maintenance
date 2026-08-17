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
import { STATE_MACHINES } from '@janumipwb/rph-domain';

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
	// ⚠ "Replacement intent identified" MOVED TWICE IN TWO COMMITS, and both directions are recorded because the
	// ORDER is the evidence. REG-F-134 first moved it ARROW_UNREACHABLE -> UNENFORCED (22->21, 44->45): a
	// DISMISSAL that REG-F-131 had falsified four commits earlier, corrected in the direction that makes the
	// ledger read WORSE, which is what separates it from the reclassification the docblock below forbids. The
	// next increment then ENFORCED the guard and re-drove the row (45->44, 14->15) — *"the way to move it is to
	// enforce a guard and re-drive its row, never to reclassify one"*, done in that order rather than claimed.
	ARROW_UNREACHABLE: 21,
	ENFORCED: 15,
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
			arrows.filter((a) => a.guard === 'Authorized decision (Decision.decisionType=ABANDON)')
		).toHaveLength(17);
		// Not PWU-only — the ledger covers the assurance, governance and execution machines too.
		expect(new Set(arrows.map((a) => a.machine))).toContain('Baseline.status');
		expect(guardTexts()).toHaveLength(new Set(guardTexts()).size);
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

	// ── THE CHECK ABOVE IS VACUOUS FOR NINE OF ITS OWN ROWS, AND SAYS SO ────────────────────────────────────
	//
	// `unreachabilityFaults` asks the CENSUS whether an arrow is performed. For a machine the census cannot see
	// at all, the answer is `covered = 0` **whatever the truth is** — so the row passes by construction, not by
	// evidence. Three of the eight machines named by ARROW_UNREACHABLE rows are census-blind
	// (`AssuranceObservation.disposition`, `Constraint.status`, `Obligation.status`), and the nine rows resting
	// wholly on them are checked by nothing.
	//
	// ⚠ THIS IS REG-F-133's OWN RULE TURNED ON REG-F-134's GATE. That gate was described on landing as "total and
	// derived" against REG-F-133's hand-listed 4-of-57 — it is total over the ROWS and vacuous for nine of them,
	// which is a different claim. An instrument that overstates its reach is the defect one level up, so the
	// fraction is pinned here rather than left to be inferred from a green run.
	it('pins how many ARROW_UNREACHABLE rows the census can actually speak about', () => {
		const seen = new Set(declaredArrows().map((a) => a.machine));
		const machinesOf = new Map<string, Set<string>>();
		for (const a of guardedArrows()) {
			if (!machinesOf.has(a.guard)) machinesOf.set(a.guard, new Set());
			machinesOf.get(a.guard)!.add(a.machine);
		}
		let rows = 0;
		let vacuous = 0;
		for (const [text, row] of Object.entries(GUARD_LEDGER)) {
			if (row.disposition !== 'ARROW_UNREACHABLE') continue;
			rows += 1;
			const ms = [...(machinesOf.get(text) ?? [])];
			if (ms.length > 0 && ms.every((m) => !seen.has(m))) vacuous += 1;
		}
		expect(
			{ arrowUnreachableRows: rows, vacuousBecauseCensusBlind: vacuous },
			'the unreachability check can only speak about rows whose machines the census SEES; the rest pass by ' +
				'construction. If this moves, the gate’s honest reach moved with it — re-derive before re-pinning.'
		).toEqual({ arrowUnreachableRows: 21, vacuousBecauseCensusBlind: 9 });
	});

	// ── THE OTHER DISMISSIVE DISPOSITION IS CHECKED TOO, AND UNLIKE THE LAST ONE IT IS WORTH IT ─────────────
	//
	// REG-F-134 left `REDUNDANT_WITH_MACHINE` ungated on the ground that its claim — *the guard's negative case
	// is already illegal* — "needs a reading of the guard text and cannot be joined mechanically". That is true
	// of a GENERIC join and false of these two rows: each states a fact about machine SHAPE, and shape is data.
	//
	// ⚠ WHY THIS ONE IS BUILT WHEN REG-F-151 DECLINED THE OTHER. That entry refused a `declaredMutations` gate
	// because it would have watched 1 row of 107 — a reach indistinguishable from vacuity. Here the reach is
	// 2 OF 2. The checks are bespoke per row, which is the honest shape when there are two of them, and the count
	// is pinned below so a THIRD row cannot join the disposition without someone writing its check.
	//
	// The risk is real rather than theoretical: these rows say NOTHING IS OWED because the machine already
	// forbids the case. Give `BASELINED` one out-arrow and that stops being true — the guard becomes genuinely
	// unenforced, and without this nothing would notice.
	it('the REDUNDANT_WITH_MACHINE rows still restate the machine they defer to', () => {
		const machine = (name: string) =>
			(STATE_MACHINES as unknown as Record<string, { transitions: readonly { from: string; to: string }[] }>)[
				name
			]!.transitions;

		// ROW 1 — "Not already BASELINED", on the 17 `-> SUPERSEDED` arrows of PWU.workLifecycleState. The guard
		// restates the table only while BASELINED is genuinely terminal.
		expect(
			machine('PWU.workLifecycleState').filter((t) => t.from === 'BASELINED'),
			'BASELINED gained an out-arrow, so "Not already BASELINED" is no longer a restatement of the machine — ' +
				're-disposition the row, it is now a real and unenforced guard'
		).toEqual([]);

		// ROW 2 — "the assessment is ACTIVE", on the 4 `-> CANCELLED` arrows. The precondition is redundant only
		// while the machine admits CANCELLED from exactly those four sources and no others.
		expect(
			machine('AssuranceAssessment.state')
				.filter((t) => t.to === 'CANCELLED')
				.map((t) => t.from)
				.sort((a, b) => a.localeCompare(b)),
			'the CANCELLED in-arrows moved; the handler precondition is no longer the machine’s own shape'
		).toEqual(['ASSESSING', 'EVIDENCE_PENDING', 'READY', 'REQUESTED']);

		// ⚠ THE REACH, pinned — these two checks are hand-written per row, so a third row would be unchecked and
		// would LOOK checked (REG-F-150's lesson, one increment earlier).
		expect(
			Object.values(GUARD_LEDGER).filter((r) => r.disposition === 'REDUNDANT_WITH_MACHINE').length,
			'a REDUNDANT_WITH_MACHINE row was added or removed; each needs its own shape check written by hand'
		).toBe(2);
	});

	// CONTROL — both assertions above are `toEqual` against an EMPTY-ish expectation, which a broken reader also
	// satisfies. This shows the same query returns real data for states known to have the thing being denied.
	it('CONTROL — the shape reader finds out-arrows and in-arrows where they exist', () => {
		const pwu = (STATE_MACHINES as unknown as Record<string, { transitions: readonly { from: string; to: string }[] }>)[
			'PWU.workLifecycleState'
		]!.transitions;
		expect(pwu.filter((t) => t.to === 'SUPERSEDED').length, 'the 17 guarded arrows must be findable').toBe(17);
		expect(
			pwu.filter((t) => t.from === 'SATISFIED').length,
			'a NON-terminal state must show out-arrows, or the BASELINED assertion is vacuous'
		).toBeGreaterThan(0);
	});

	// ── CONTROL 6: AN EMPTY COVERED SET IS REFUSED, NOT PASSED ──────────────────────────────────────────────
	// The whole check degrades to green if the census hands it nothing. It must throw instead of reporting [].
	it('CONTROL — an empty covered set throws rather than passing every row', () => {
		expect(() => unreachabilityFaults(GUARD_LEDGER, new Set())).toThrow(/census reader is broken/);
	});
});
