// A-1 of ROADMAP-self-declaring-lifecycle-arrows — every ratified PWU arrow must be ACCOUNTED FOR.
//
// ── WHY THIS FILE EXISTS BEFORE THE TABLE IT CHECKS ───────────────────────────────────────────────────────────
// REG-F-114: `advancePwuLifecycle` takes `{ target }` and resolves the source state at runtime, so a PWU
// lifecycle command declares a DESTINATION, not an ARROW. The arrow census cannot read what was never declared,
// and — the part that matters more — neither can anything else: the command accepts whatever the machine happens
// to allow. `STEP_COMMAND_SPECS` already solved this for step commands with a declared `sourceStates`.
//
// ⚠ THIS GATE WAS WRITTEN BEFORE THE TABLE, DELIBERATELY. Written after, a gate is shaped to fit the table it
// audits — which is how a census comes to agree with the thing it is checking. Written first, against an empty
// table, its red output IS the worksheet: the full list of arrows the machine declares, derived rather than
// transcribed.
//
// ── THREE OUTCOMES, NOT TWO, AND THE MIDDLE ONE WAS NOT ANTICIPATED ───────────────────────────────────────────
// Deriving the machine (57 transitions, 19 targets) showed that 49 arrows land on the 11 semantic-command
// targets and **8 land on targets no semantic command owns** — PLANNED, EXECUTING, EVIDENCE_PENDING,
// UNDER_ASSURANCE, CONDITIONALLY_SATISFIED, SATISFIED, RECOMPOSING, RECOMPOSED. Those ARE performed: by
// `ChangePwuState`, the generic setter, whose own rule (REG-F-072) is that it may not perform an arrow a
// semantic command owns. Filing them as UNIMPLEMENTED would invent a coverage gap; folding them into CLAIMED
// would hide a real one. So every arrow resolves to exactly one of: **CLAIMED** by a spec, **GENERIC** (the
// setter's), or **UNIMPLEMENTED** (nothing performs it).
import {
	PWU_GENERIC_SETTER_SPECS,
	PWU_LIFECYCLE_COMMAND_SPECS,
	STATE_MACHINES
} from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';

const MACHINE = 'PWU.workLifecycleState';

interface Transition {
	readonly from: string;
	readonly to: string;
}

/** Every ratified arrow of the PWU work-lifecycle machine, as `FROM->TO`. */
export function ratifiedArrows(): string[] {
	const m = (STATE_MACHINES as unknown as Record<string, { transitions: readonly Transition[] }>)[
		MACHINE
	];
	if (!m) throw new Error(`${MACHINE} is not a declared machine — this gate is reading the wrong name`);
	return m.transitions.map((t) => `${t.from}->${t.to}`);
}

/**
 * Targets reached by the GENERIC SETTER (`ChangePwuState`) rather than by a semantic command.
 *
 * ⚠ THIS IS A DECLARATION ABOUT OWNERSHIP, NOT A WAIVER. REG-F-072 already forbids the setter performing an
 * arrow a semantic command owns; this records the converse — the arrows no semantic command claims, which the
 * setter therefore carries. It is listed by TARGET because ownership in this machine is per-target: every
 * in-edge of a target is performed by the same command.
 *
 * ⚠ RE-POINTED AT THE TABLE (REG-F-119), for the identical reason `COMMAND_TARGETS` was in A-2 — see its note
 * below. This was a hand-written list for exactly as long as the setter had no declaration; now that
 * `PWU_GENERIC_SETTER_SPECS` exists, restating the eight here would make the gate agree with a COPY of the thing
 * it audits instead of with the thing itself.
 *
 * ⚠⚠ AND THE TABLE IT READS IS TRANSCRIBED, NOT COMPUTED, WHICH IS WHAT KEEPS THE FIRST TEST BELOW FALSIFIABLE.
 * The setter's eight targets are the COMPLEMENT of the eleven owned ones, so it is tempting to define the table
 * that way. Had it been, `COMMAND_TARGETS ∪ GENERIC_TARGETS` would cover all twenty states BY CONSTRUCTION and
 * *"no arrow is unaccounted for"* could never fail — a control that cannot fail, authored inside the increment
 * meant to strengthen it. Two independently authored artifacts, compared. That is the whole design.
 */
const GENERIC_TARGETS: ReadonlySet<string> = new Set(
	Object.values(PWU_GENERIC_SETTER_SPECS).map((s) => s.target)
);

/**
 * Targets a semantic `advancePwuLifecycle` command owns — **read from the table, not restated here** (A-2).
 *
 * A-1 held this as a hand-written constant for exactly one commit, which was the point: the gate was written
 * before the table so its red output would be the worksheet. Now the table exists, restating the set here would
 * make the gate agree with a copy of the thing it audits instead of with the thing itself.
 */
const COMMAND_TARGETS: ReadonlySet<string> = new Set(
	Object.values(PWU_LIFECYCLE_COMMAND_SPECS).map((s) => s.target)
);

/**
 * Every arrow EITHER table claims, as `FROM->TO`.
 *
 * ⚠ THE SETTER'S EIGHT ARE IN HERE, AND THAT IS THE POINT OF TRANSCRIBING THEM (REG-F-119). Those rows were
 * hand-written from the machine's in-edges; the A-2 assertions below are what hold them EQUAL to it in both
 * directions. Without this, a drifted `sourceStates` in the new table would be checked by nothing — a
 * declaration the census reads and no gate audits, which is worse than no declaration because the census would
 * report its arrows as covered.
 */
function claimedArrows(): string[] {
	return [
		...Object.values(PWU_LIFECYCLE_COMMAND_SPECS),
		...Object.values(PWU_GENERIC_SETTER_SPECS)
	].flatMap((s) => s.sourceStates.map((from) => `${from}->${s.target}`));
}

describe('A-1 — every ratified PWU work-lifecycle arrow is accounted for', () => {
	const arrows = ratifiedArrows();

	it('no arrow is unaccounted for — each is CLAIMED by a command, GENERIC, or declared UNIMPLEMENTED', () => {
		const unaccounted = arrows.filter((a) => {
			const to = a.split('->')[1]!;
			return !COMMAND_TARGETS.has(to) && !GENERIC_TARGETS.has(to);
		});
		expect(
			unaccounted,
			'ratified arrow(s) that no semantic command claims, that the generic setter is not declared to ' +
				'carry, and that nothing records as unimplemented. A ratified arrow nothing performs is a coverage ' +
				'gap; a ratified arrow performed by something undeclared is REG-F-114 recurring. Decide which, and ' +
				'say so here.'
		).toEqual([]);
	});

	it('the two ownership sets are DISJOINT — REG-F-072 forbids the setter performing a command-owned arrow', () => {
		expect(
			[...COMMAND_TARGETS].filter((t) => GENERIC_TARGETS.has(t)),
			'target(s) claimed by BOTH a semantic command and the generic setter. REG-F-072 settled that the ' +
				'setter no longer performs an arrow a semantic command owns, so a target in both lists means one ' +
				'of the two declarations is false.'
		).toEqual([]);
	});

	// ── A-2: THE TABLE AND THE MACHINE MUST AGREE, IN BOTH DIRECTIONS ─────────────────────────────────────────
	// One direction alone is half a gate. A table that only had to be a SUBSET could claim nothing and pass; a
	// table that only had to be a SUPERSET could claim arrows the machine does not have — a command that can
	// never fire, which is the hollow arriving inside the fix for a hollow.
	it('no spec claims an arrow the machine does not declare', () => {
		const ratified = new Set(arrows);
		expect(
			claimedArrows().filter((a) => !ratified.has(a)),
			'spec(s) claiming a source state the machine has no in-edge for. That command can never fire from ' +
				'that state, so the declaration is fiction — check it against STATE_MACHINES rather than against ' +
				'what the handler looks like it does.'
		).toEqual([]);
	});

	// ⚠ EXTENDED TO THE SETTER'S TARGETS TOO (REG-F-119). Scoped to COMMAND_TARGETS alone, this asked its question
	// of 49 arrows and ignored the 8 the setter now declares — so a spine row could go missing and only the
	// accountability test above would notice, one layer coarser. Every ratified arrow whose target ANY table
	// claims must be claimed by that table.
	it('every owned arrow — command or generic setter — is claimed by its spec', () => {
		const claimed = new Set(claimedArrows());
		expect(
			arrows.filter(
				(a) =>
					(COMMAND_TARGETS.has(a.split('->')[1]!) || GENERIC_TARGETS.has(a.split('->')[1]!)) &&
					!claimed.has(a)
			),
			'ratified arrow(s) whose target a command owns, but which that command does not claim. Either the ' +
				'command should perform it — add the source state — or it should not, in which case the machine ' +
				'and the handler disagree and THAT is the finding.'
		).toEqual([]);
	});

	// CONTROL 3 — THE TABLES ARE THE MEASURED ONES. Both A-2 assertions are satisfied by EMPTY tables: nothing
	// claimed is trivially a subset, and the target sets would be empty so nothing is expected to be claimed.
	//
	// ⚠ 49 -> 57 UNDER REG-F-119, AND THE NEW NUMBER IS THE WHOLE POINT OF THE INCREMENT. Two tables now claim
	// **every ratified arrow on the machine** — 11 command specs claiming 49, 8 setter specs claiming 8, and 57 is
	// the machine's total (pinned independently by CONTROL 1 below, which reads `STATE_MACHINES` rather than the
	// tables). `PWU.workLifecycleState` is therefore the first PWU axis with COMPLETE arrow coverage, which under
	// REG-F-118 is the precondition for any sound unreachability claim about it.
	//
	// The three numbers are asserted SEPARATELY rather than as `11 + 8` or as one total: a single figure would go
	// green if a row moved between the tables, and which table owns an arrow is exactly what REG-F-072 is about.
	it('CONTROL — the two tables together claim all 57 arrows this slice is sized against', () => {
		expect(Object.keys(PWU_LIFECYCLE_COMMAND_SPECS).length, 'command specs').toBe(11);
		expect(Object.keys(PWU_GENERIC_SETTER_SPECS).length, 'generic setter specs').toBe(8);
		expect(claimedArrows().length, 'arrows claimed across both tables').toBe(57);
	});

	// CONTROL 1 — THE POPULATION IS REAL. Every assertion above is satisfied by a reader that returns nothing:
	// no arrows, no unaccounted arrows, green. That is the vacuity this repository has recorded seven times, and
	// the count is pinned rather than merely non-zero so that a machine that SHRINKS is also loud.
	it('CONTROL — the machine really has the arrows this gate claims to check', () => {
		expect(arrows.length, 'ratified arrows on PWU.workLifecycleState').toBe(57);
		expect(new Set(arrows.map((a) => a.split('->')[1])).size, 'distinct targets').toBe(19);
	});

	// CONTROL 2 — THE SPLIT IS THE MEASURED ONE. Without it, moving every target into GENERIC_TARGETS would make
	// test 1 pass while declaring that no command owns anything — a green gate asserting the opposite of the
	// finding it exists to close.
	it('CONTROL — 49 arrows belong to command-owned targets and 8 to the generic setter', () => {
		const owned = arrows.filter((a) => COMMAND_TARGETS.has(a.split('->')[1]!)).length;
		const generic = arrows.filter((a) => GENERIC_TARGETS.has(a.split('->')[1]!)).length;
		expect({ owned, generic }, 'the split this slice is sized against').toEqual({
			owned: 49,
			generic: 8
		});
	});
});
