// THE THIRD ARM HAS NO GATE — and that is why a rule stayed closed for seven days on a ground the repository
// had deleted (REG-F-133).
//
// ── THE STRUCTURAL FINDING ────────────────────────────────────────────────────────────────────────────────────
//
// The enforcement register has THREE arms and, until this file, gates for TWO. Derived by loading it:
//
//     ENFORCED               30   every row probed — `enforcedRuleIds().filter(id => PROBES[id] === null)` is []
//     UNENFORCED_DISCLOSED   25   21 OBSERVED_ADMISSION probed, 4 DEAD_PREDICATE census-gated
//     NOT_A_COMMAND_REFUSAL  57   **no guard field in the type, no probe, and no selector that iterates them**
//
// So 57 rows — a MAJORITY of the register — make claims nothing checks. And the claims are not innocuous: arm 3
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
// ⚠ AND IT IS PARTIAL BY CONSTRUCTION: only 4 of the 57 arm-3 rows name a machine at all. The other 53 rest on
// absences this gate cannot see (a missing command, an absent plane, a predicate with no caller). Recorded as a
// bound, not a claim of coverage — an instrument that overstates its own reach is the defect one level up.
import { ENFORCEMENT_REGISTER, STATE_MACHINES } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import { declaredArrows } from './arrow-command-census.js';

type Row = { kind: string; why?: string };
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
			// ⚠ ALREADY FALSE WHEN THIS GATE WAS WRITTEN, and pinned at its TRUE value rather than a flattering one.
			// The row says nothing drives `Claim.status`; seven of its fifteen arrows are covered, by
			// `RecordClaimAssessment` (registry.ts:181) whose own guard comment cites RPH-EVD-002 by id. Corrected
			// in the same increment; the pin stays so the next movement is loud.
			'RPH-EVD-002': ['Claim.status=7/15'],
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
		).toEqual({ armThreeRows: 57, rowsThisGateCanSee: 4 });
	});
});
