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
import { PWU_LIFECYCLE_COMMAND_SPECS, STATE_MACHINES } from '@janumipwb/rph-domain';
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
 */
const GENERIC_TARGETS: ReadonlySet<string> = new Set([
	'PLANNED',
	'EXECUTING',
	'EVIDENCE_PENDING',
	'UNDER_ASSURANCE',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED',
	'RECOMPOSING',
	'RECOMPOSED'
]);

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

/** Every arrow the TABLE claims, as `FROM->TO`. */
function claimedArrows(): string[] {
	return Object.values(PWU_LIFECYCLE_COMMAND_SPECS).flatMap((s) =>
		s.sourceStates.map((from) => `${from}->${s.target}`)
	);
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

	it('every command-owned arrow is claimed by its spec', () => {
		const claimed = new Set(claimedArrows());
		expect(
			arrows.filter((a) => COMMAND_TARGETS.has(a.split('->')[1]!) && !claimed.has(a)),
			'ratified arrow(s) whose target a command owns, but which that command does not claim. Either the ' +
				'command should perform it — add the source state — or it should not, in which case the machine ' +
				'and the handler disagree and THAT is the finding.'
		).toEqual([]);
	});

	// CONTROL 3 — THE TABLE IS THE MEASURED ONE. Both A-2 assertions are satisfied by an EMPTY table: nothing
	// claimed is trivially a subset, and `COMMAND_TARGETS` would be empty so nothing is expected to be claimed.
	it('CONTROL — the table claims the 49 arrows this slice is sized against', () => {
		expect(Object.keys(PWU_LIFECYCLE_COMMAND_SPECS).length, 'command specs').toBe(11);
		expect(claimedArrows().length, 'arrows claimed by the table').toBe(49);
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
