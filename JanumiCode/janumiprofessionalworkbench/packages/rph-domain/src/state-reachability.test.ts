// STATE REACHABILITY — declared states no arrow can reach, across every ratified machine.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-021 was "three ratified states occupied by nothing", found by reading one machine. Closing it raised the
// obvious next question — how many OTHER declared states can nothing reach — and the answer was not available
// anywhere: no gate walks the machines and asks.
//
// A state with no in-arrow is not a style problem. It is a governance vocabulary that reads as available and is
// not: a reviewer choosing between dispositions, or a designer relying on a state existing, is reading a promise
// the machine cannot keep. That is exactly the "declared surface the code does not perform" REG-F-001 named at
// founding.
//
// ── READ FROM `getMachine`, NOT FROM THE SOURCE TEXT ─────────────────────────────────────────────────────────
// The first version of this measurement scraped `transitions.data.ts` with a regex and reported ZERO transitions
// for a machine that has fifteen — the pattern had run past the end of one block into the next. Deriving from the
// runtime data is the authoritative reading and cannot make that mistake, which is the same lesson as the census's
// blind reader: an instrument that can silently see nothing must be able to prove it sees something.
import { describe, expect, it } from 'vitest';
import { getMachine, machineNames } from './stateMachine.js';

interface Unreachable {
	readonly machine: string;
	readonly state: string;
}

/** Every declared state that is neither the initial state nor the target of any declared transition. */
function unreachableStates(): Unreachable[] {
	const out: Unreachable[] = [];
	for (const name of machineNames()) {
		const m = getMachine(name);
		const reachable = new Set<string>(m.transitions.map((t) => t.to));
		if (m.initialState) reachable.add(m.initialState);
		for (const s of m.states) if (!reachable.has(s)) out.push({ machine: name, state: s });
	}
	return out.sort((a, b) =>
		a.machine === b.machine ? a.state.localeCompare(b.state) : a.machine.localeCompare(b.machine)
	);
}

const key = (u: Unreachable) => `${u.machine}.${u.state}`;

describe('declared states no arrow can reach', () => {
	it('CONTROL: the machines are loaded and carry arrows — a zero here would make every list below empty', () => {
		// The regex version of this measurement reported 0 transitions for AssuranceAssessment.state, which has 15.
		// This is the assertion that would have caught it.
		expect(machineNames().length).toBeGreaterThan(10);
		const totalArrows = machineNames().reduce((n, m) => n + getMachine(m).transitions.length, 0);
		expect(totalArrows).toBeGreaterThan(100);
		expect(getMachine('AssuranceAssessment.state').transitions.length).toBeGreaterThan(10);
	});

	it('CONTROL: the detector CAN report a state as unreachable', () => {
		// Otherwise "the list is exactly these five" is a statement about a detector that finds nothing.
		expect(unreachableStates().length).toBeGreaterThan(0);
	});

	// THE PIN. Each entry is a declared state the machine cannot enter, with what it means. This list may SHRINK —
	// wiring an arrow, or removing a state the corpus does not want — and may not GROW without an argument.
	//
	// ELEVEN, NOT FIVE. A first pass at this measurement scraped the source with a regex and found five. Deriving
	// from `getMachine` found eleven, because the regex silently skipped whole blocks whose formatting it did not
	// match. Recorded because the under-count was the COMFORTABLE direction, and an instrument that fails toward
	// "less wrong than you thought" is the hardest kind to notice.
	it('the unreachable set is exactly these, each for a stated reason', () => {
		expect(unreachableStates().map(key)).toEqual([
			// ── AggregateAssuranceDisposition: SIX states, NO arrows — the whole machine (see the empty-machine
			// test below). This is the axis that would roll assurance up across an aggregate, so what is declared
			// and unrunnable is the answer to "is this body of work assured overall".
			'AggregateAssuranceDisposition.CONDITIONALLY_SATISFIED',
			'AggregateAssuranceDisposition.EVIDENCE_REQUIRED',
			'AggregateAssuranceDisposition.INCONCLUSIVE',
			'AggregateAssuranceDisposition.REJECTED',
			'AggregateAssuranceDisposition.SATISFIED',
			'AggregateAssuranceDisposition.UNASSESSED',
			// The ratified §30 machine declares CANCELLED **terminal** and gives it NO in-arrow. So an assessment can
			// never be cancelled — REG-F-021's residual R-1 in its sharpest form: an assessment stalled in
			// EVIDENCE_PENDING (its required evidence never arriving) has no exit at all, and the state that would
			// close it is unreachable BY RATIFICATION, not by omission in this engine. Wiring it needs an arrow the
			// corpus does not declare — an elicitation item, not an implementation task.
			'AssuranceAssessment.state.CANCELLED',
			// The PWU assurance axis starts at NOT_REQUIRED. UNASSESSED — the state meaning "assurance applies and
			// has not happened yet" — is entered by no declared arrow, so a PWU that NEEDS assurance can never be
			// marked as awaiting it. Adjacent to REG-F-021's family and not part of it.
			'PWU.assuranceState.UNASSESSED',
			// ValidatorRegistryEntry.status: three states, no arrows. Validator health (§22's DEGRADED / DISABLED) is
			// declared and unrunnable — the assurance system cannot record that one of its own validators is failing.
			'ValidatorRegistryEntry.status.ACTIVE',
			'ValidatorRegistryEntry.status.DEGRADED',
			'ValidatorRegistryEntry.status.DISABLED'
		]);
	});

	// The sharper half: a machine with no arrows at all is not a partially-wired machine, it is a name.
	it('machines that declare states and NO transitions', () => {
		const empty = machineNames().filter((m) => getMachine(m).transitions.length === 0);
		expect(
			empty,
			'a declared machine with zero transitions promises a lifecycle that cannot be run at all — worse than ' +
				'an unreachable state, because every one of its states is unreachable. BOTH of these are assurance ' +
				'axes: whether a body of work is assured OVERALL, and whether a validator is healthy'
		).toEqual(['AggregateAssuranceDisposition', 'ValidatorRegistryEntry.status']);
	});

	// A terminal state with no in-arrow is the worst shape: declared as an ENDING that nothing can end at.
	it('terminal states nothing can reach', () => {
		const orphanTerminals = machineNames().flatMap((name) => {
			const m = getMachine(name);
			const into = new Set(m.transitions.map((t) => t.to));
			// The INITIAL state is excluded even when it has no in-arrow: "terminal and initial" means an object
			// starts there and can never return, which is an unusual but coherent modelling choice — not an ending
			// nothing can reach. PWU.assuranceState.NOT_REQUIRED is exactly that and is correctly not a finding.
			return m.terminalStates
				.filter((st) => !into.has(st) && st !== m.initialState)
				.map((st) => `${name}.${st}`);
		});
		expect(
			orphanTerminals.sort((a, b) => a.localeCompare(b)),
			'a state declared TERMINAL with no arrow into it is an ending nothing can reach — the object it governs ' +
				'can never finish that way, however the vocabulary reads'
		).toEqual(['AssuranceAssessment.state.CANCELLED']);
	});
});
