// THE THIRD ARM HAS NO GATE — and that is why a rule stayed closed for seven days on a ground the repository
// had deleted (REG-F-133).
//
// ── THE STRUCTURAL FINDING ────────────────────────────────────────────────────────────────────────────────────
//
// The enforcement register has THREE arms and, until this file, gates for TWO. Derived by loading it:
//
//     ENFORCED               ~~30~~ 31   every row probed — `enforcedRuleIds().filter(id => PROBES[id] === null)` is []
//     UNENFORCED_DISCLOSED       25   21 OBSERVED_ADMISSION probed, 4 DEAD_PREDICATE census-gated
//     NOT_A_COMMAND_REFUSAL  ~~57~~ 56   **no guard field in the type, no probe, and no selector that iterates them**
//
// So ~~57 rows — a MAJORITY of the register —~~ **56 rows — EXACTLY HALF of the 112 —** make claims nothing
// checks. ⚠ CORRECTED 2026-08-14 (REG-F-144), AND THE CORRECTION IS THE FOURTH INSTANCE OF ITS OWN CLASS BY
// THIS HAND. REG-F-140 corrected the OTHER stale count in THIS SAME COMMENT BLOCK ("4 of the 57" -> 3 of the
// 56, thirty lines below) and left these three standing — REG-F-137's defect, in the same file, two commits
// after I wrote the rule against it. And "a MAJORITY" was not decoration: REG-F-133's headline rested on it,
// it was true by ONE ROW when written, and RPH-EVD-002's move to ENFORCED made it false by one row. And the claims are not innocuous: arm 3
// means *"no dispatch could violate this rule"*, which is frequently justified by **an absence** — no such
// command, nothing drives that machine, the antecedent is unreachable. **An absence is exactly the kind of fact
// this repository keeps deleting**, by building the missing command.
//
// MEASURED CONSEQUENCE, not a worry: THREE arm-3 rows were already false when this file was written.
// `RPH-EVD-002` said *"No handler anywhere drives the `Claim.status` machine"* while `RecordClaimAssessment` had
// been registered for seven days — through seven register commits and one dedicated stale-prose sweep.
// `RPH-ASM-004` said no `FalsifyAssumption` command exists **and was refuted ten lines below by its own `why`
// string**, whose adjacent sentence a correcting pass had already fixed.
//
// ── WHAT THIS GATE CAN AND CANNOT SEE, STATED SO NOBODY TRUSTS IT FURTHER THAN IT GOES ────────────────────────
//
// It cannot read prose. What it CAN do is exploit a regularity: an arm-3 row that rests on unreachability
// almost always NAMES THE MACHINE it claims nothing drives, in backticks. So this pins, BY NAME, how many arrows
// of that machine are covered — and any command that starts driving it reddens the row that says nothing does.
//
// ⚠ IT DOES NOT VALIDATE THE ROWS. A non-zero count here is not automatically a defect: a row may name a machine
// for context rather than rest on its emptiness. The gate's job is to make the AUTHOR RE-READ the row when the
// world under it moves — which is precisely what did not happen for seven days.
//
// ⚠ AND IT IS PARTIAL BY CONSTRUCTION: only ~~4 of the 57~~ **3 of the 56** arm-3 rows name a machine at all
// (RPH-EVD-002 left the arm for ENFORCED on 2026-08-13). The other 53 rest on absences this gate cannot see (a
// missing command, an absent plane, a predicate with no caller). Recorded as a bound, not a claim of coverage —
// an instrument that overstates its own reach is the defect one level up. ⚠ THE 4/57 ABOVE WAS STALE FOR A DAY:
// the ASSERTION was re-pinned when the row moved and this SENTENCE was not, by the same hand, in the same file —
// the third time in one session that a prose count beside a live list rotted by its own author's edit. The
// numbers here are now derived in the assertions below; treat this paragraph as commentary, not as the record.
import { ENFORCEMENT_REGISTER, STATE_MACHINES } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import { declaredArrows } from './arrow-command-census.js';
import { guardedArrows } from './guard-enforcement-ledger.js';
import { GUARD_LEDGER } from './guard-enforcement-ledger.data.js';

type Row = { kind: string; why?: string };
type LedgerRow = { disposition: string };
const REGISTER = ENFORCEMENT_REGISTER as unknown as Record<string, Row>;
const MACHINES = STATE_MACHINES as unknown as Record<
	string,
	{ transitions: readonly { from: string; to: string }[] }
>;

/** How many of a machine's RATIFIED arrows some command declares — the census's own answer, not a re-derivation. */
function coverageByMachine(): Map<string, string> {
	const declared = new Set(
		([...declaredArrows()] as { machine: string; from: string; to: string }[]).map(
			(a) => `${a.machine}  ${a.from} -> ${a.to}`
		)
	);
	const out = new Map<string, string>();
	for (const [name, def] of Object.entries(MACHINES)) {
		const covered = def.transitions.filter((t) => declared.has(`${name}  ${t.from} -> ${t.to}`)).length;
		out.set(name, `${covered}/${def.transitions.length}`);
	}
	return out;
}

/**
 * Arm-3 rows contradicted by C-0b: the row says NO COMMAND could violate the rule, while the guard ledger
 * records an ENFORCED guard on an arrow of a machine that row NAMES.
 *
 * ── WHY THIS EXISTS: THE EVIDENCE WAS ALREADY IN THE REPOSITORY, IN A MACHINE-READABLE FILE ──────────────────
 * RPH-EVD-002 sat in arm 3 for seven days saying *"No handler anywhere drives the `Claim.status` machine"* while
 * `verif/guard-enforcement-ledger.data.ts` — same repository, same day — recorded the `Claim.status`
 * UNDER_ASSESSMENT -> SUPPORTED guard as **ENFORCED**, with a DRIVEN refusal and a resolving anchor, citing
 * RPH-EVD-002 by id. **Two instruments, flatly contradictory, and nothing compared them.** The fact needed to
 * catch it was not missing; it was unjoined.
 *
 * ⚠ THIS IS A STATE CHECK, NOT A CHANGE CHECK, which is what makes it worth adding beside the coverage pins
 * above. Those catch a world that MOVES under a row. This catches a row that is BORN contradicting what another
 * instrument already records — the case that produced the seven days, since nothing moved: the row was simply
 * wrong from the moment it was written.
 *
 * ⚠ AND IT IS NARROW, FOR A REASON WORTH STATING RATHER THAN HIDING. The register keys by RULE ID and the guard
 * ledger keys by GUARD TEXT; **they share no join key at all.** Machine name is the only bridge, and it exists
 * only because arm-3 rows happen to name machines in backticks — an incidental property of prose. A join on
 * rule ids was measured and rejected: only 2 of the 15 ENFORCED ledger rows name one, and one of those two names
 * a DOCUMENT id (`RPH-DOC-008`) rather than a register rule. The reach is pinned below so this narrowness cannot
 * be mistaken for coverage.
 */
function registerLedgerConflicts(
	register: Readonly<Record<string, Row>>,
	ledger: Readonly<Record<string, LedgerRow>>
): string[] {
	const enforcedMachines = new Set<string>();
	for (const a of guardedArrows())
		if (ledger[a.guard]?.disposition === 'ENFORCED') enforcedMachines.add(a.machine);
	if (enforcedMachines.size === 0)
		throw new Error('registerLedgerConflicts: C-0b records no ENFORCED guard at all — the reader is broken');

	const names = Object.keys(MACHINES);
	const out: string[] = [];
	for (const [id, row] of Object.entries(register)) {
		if (row.kind !== 'NOT_A_COMMAND_REFUSAL') continue;
		const why = String(row.why ?? '');
		for (const m of names)
			if (why.includes(`\`${m}\``) && enforcedMachines.has(m))
				out.push(`${id} rests on \`${m}\`, but C-0b records an ENFORCED guard on that machine`);
	}
	return out.sort((a, b) => a.localeCompare(b));
}

/** Arm-3 rows, keyed to every state machine their reason NAMES in backticks. */
function armThreeMachineClaims(): Record<string, string[]> {
	const coverage = coverageByMachine();
	const names = Object.keys(MACHINES);
	const out: Record<string, string[]> = {};
	for (const [id, row] of Object.entries(REGISTER)) {
		if (row.kind !== 'NOT_A_COMMAND_REFUSAL') continue;
		const why = String(row.why ?? '');
		const named = names
			.filter((m) => why.includes(`\`${m}\``))
			.map((m) => `${m}=${coverage.get(m) ?? '?'}`)
			.sort((a, b) => a.localeCompare(b));
		if (named.length > 0) out[id] = named;
	}
	return out;
}

describe('REG-F-133 — the register arm that nothing gates', () => {
	// ⚠ PINNED BY NAME WITH THE COUNT ATTACHED, so the failure says WHICH row's world moved and BY HOW MUCH. A
	// bare count would go green if a row were deleted, and would not tell a reader which claim to re-read.
	it('pins the machine-coverage every arm-3 row rests on', () => {
		expect(armThreeMachineClaims()).toEqual({
			// ⚠ `RPH-EVD-002` WAS PINNED HERE AND HAS LEFT THE ARM ENTIRELY (2026-08-13). This gate was written
			// with it already FALSE — pinned at its true `Claim.status=7/15` rather than a flattering zero — and
			// its departure to ENFORCED is what the pin was for: the row it flagged is gone because the flag was
			// acted on, which is the only disappearance from this list that is good news. The reduction from 4
			// watched rows to 3 is asserted below, so the shrinking reach cannot pass unnoticed.
			// ⚠ SUSPECT AND UNRESOLVED — surfaced BY this gate, not by the audit that prompted it. Nine of
			// seventeen `Assumption.status` arrows are covered. Whether this row RESTS on that machine's emptiness
			// or merely mentions it is an open question, recorded rather than guessed.
			'RPH-ASM-003': ['Assumption.status=9/17'],
			// Zero-covered: the ground these two rest on is intact today, and this is what an unexpired arm-3 row
			// looks like — which is the comparison that makes the two above legible.
			'RPH-GOV-004': ['AssuranceObservation.disposition=0/5'],
			'RPH-PER-013': ['PWU.executionState=0/20']
		});
	});

	// CONTROL — the pin above is equally satisfied by a function that returns that literal. This holds the two
	// halves that actually do the work: the register really is being read for arm 3, and the census really is
	// answering about coverage.
	it('CONTROL — the scan reads real arm-3 rows and real coverage', () => {
		const rows = Object.values(REGISTER).filter((r) => r.kind === 'NOT_A_COMMAND_REFUSAL');
		expect(rows.length, 'arm 3 is the register’s largest arm — if this collapses, the scan is blind').toBeGreaterThan(
			40
		);
		const coverage = coverageByMachine();
		expect(coverage.get('Claim.status'), 'the census must answer about a machine known to be covered').toBe(
			'7/15'
		);
		expect(
			coverage.get('Harness.status'),
			'and about one known to be covered by nothing — a scan returning the same answer for both is broken'
		).toBe('0/15');
	});

	// ⚠ THE BOUND, ASSERTED SO IT CANNOT DRIFT INTO AN IMPLIED CLAIM OF COVERAGE. This gate sees only the arm-3
	// rows that name a machine. If that fraction changes, the honest reach of this instrument changed with it.
	it('pins how little of arm 3 this gate can actually see', () => {
		const armThree = Object.values(REGISTER).filter((r) => r.kind === 'NOT_A_COMMAND_REFUSAL').length;
		const seen = Object.keys(armThreeMachineClaims()).length;
		expect(
			{ armThreeRows: armThree, rowsThisGateCanSee: seen },
			'this instrument watches a small minority of arm 3; the rest rest on absences it cannot read'
			// ⚠ 57/4 -> 56/3 on 2026-08-13, and the DIRECTION is why this assertion exists. Arm 3 shrank because
			// RPH-EVD-002 moved to ENFORCED — a row leaving because its ground was acted on. The same numbers
			// would appear if the row had simply been DELETED, which is why the by-name pin above is the primary
			// record and this is the bound on it.
		).toEqual({ armThreeRows: 56, rowsThisGateCanSee: 3 });
	});

	// ── THE TWO INSTRUMENTS ARE FINALLY COMPARED (REG-F-140) ────────────────────────────────────────────────
	// The register said nothing drives `Claim.status`; C-0b said a `Claim.status` guard was ENFORCED and had
	// DRIVEN the refusal. Both were in this repository, both machine-readable, for seven days.
	it('no arm-3 row rests on a machine C-0b records an ENFORCED guard on', () => {
		const conflicts = registerLedgerConflicts(REGISTER, GUARD_LEDGER);
		expect(
			conflicts,
			`arm-3 rows contradicted by the guard ledger:\n${conflicts.join('\n')}`
		).toEqual([]);
	});

	// CONTROL — `[]` is also what this returns when the join key silently stops matching, which is the failure it
	// is most exposed to: the bridge is a BACKTICKED MACHINE NAME inside prose, and prose gets reworded. A
	// synthetic arm-3 row resting on a machine known to carry an ENFORCED guard must surface; the same row
	// naming a machine with no ENFORCED guard must not.
	it('CONTROL — a synthetic arm-3 row contradicting C-0b is caught, and an innocent one is not', () => {
		const base = registerLedgerConflicts(REGISTER, GUARD_LEDGER).length;
		const guilty = registerLedgerConflicts(
			{ ...REGISTER, 'RPH-CONTROL-001': { kind: 'NOT_A_COMMAND_REFUSAL', why: 'nothing drives `Claim.status`' } },
			GUARD_LEDGER
		);
		expect(guilty.length, 'the synthetic contradiction must surface').toBe(base + 1);
		expect(guilty.join('\n')).toContain('RPH-CONTROL-001');

		// `Harness.status` is a real machine that no ENFORCED guard touches — so an arm-3 row resting on it is
		// exactly the case this check must NOT flag, and the difference proves the check discriminates.
		const innocent = registerLedgerConflicts(
			{ ...REGISTER, 'RPH-CONTROL-002': { kind: 'NOT_A_COMMAND_REFUSAL', why: 'nothing drives `Harness.status`' } },
			GUARD_LEDGER
		);
		expect(innocent.length, 'a row on a machine with no ENFORCED guard is not a conflict').toBe(base);
	});
});
