// ⭐ JAN-EXEC PHASE 5 — the host's record of what it ran, and the bound it puts on itself.
//
// ⚠ THIS IS A GUARD FOR A NEW PRODUCTION-CONSUMED EXPORT, AND IT EXISTS BECAUSE NO RATCHET WOULD DEMAND IT.
// `guards:export` walks `packages/` ONLY (`export-guard.ts:245`) and `apps/rph-demo` has ZERO entries in the
// per-file coverage-floor baseline — so `createProcessRunObserver` could have landed bare and the gate would
// have stayed green while nothing measured it. Roadmap rule 7 is satisfied HERE, by a named test and a declared
// mutant, rather than by a census that cannot see this directory.
import { describe, expect, it } from 'vitest';
import type { ProcessOutputRetention } from '@janumipwb/rph-ports';
import {
	createProcessRunObserver,
	OBSERVED_PROCESS_RUN_LIMIT,
	type ObservedProcessRun
} from './process-run-observer.js';

const RETAINED: ProcessOutputRetention = {
	retained: true,
	workspaceOwnerId: 'und_1',
	purgeability: 'PURGEABLE_AT_EXPIRY',
	stdoutPath: 'captures/a/stdout.txt',
	stderrPath: 'captures/a/stderr.txt',
	omittedRegions: [],
	omissionsPath: 'captures/a/omissions.json'
};

function aRun(argv: string[]): Omit<ObservedProcessRun, 'ordinal'> {
	return {
		argv,
		exitCode: 0,
		timedOut: false,
		durationMs: 1,
		outputComplete: true,
		omittedRegions: [],
		retention: RETAINED,
		stdout: '',
		stderr: ''
	};
}

describe('⭐ JAN-EXEC Phase 5 — the process-run observer', () => {
	it('⭑ records runs in START order, with 1-based ordinals', () => {
		// ⛔ ORDER IS LOAD-BEARING FOR THE SAME REASON IT IS ON `ObservedToolCall`: the ordinal is how a reader
		// joins a recorded tool call to the command it ran. A list that numbered by completion time would number
		// the same turn differently in the two instruments, permanently, as though that were what happened.
		const o = createProcessRunObserver();
		o.ran(aRun(['node', '--version']));
		o.ran(aRun(['npm', 'test']));
		const seen = o.observed();
		expect(seen.runs.map((r) => r.ordinal)).toEqual([1, 2]);
		expect(seen.runs.map((r) => r.argv[0])).toEqual(['node', 'npm']);
		expect(seen.observedCount).toBe(2);
	});

	it('⛔ the bound DROPS runs and SAYS SO — a silent drop is a command that left no trace', () => {
		// THE MUTANT: return `runs.length` as `observedCount`. The two numbers would then always agree, the
		// declaration could never fire, and a step that ran 40 commands would report 32 as the whole turn — the
		// fabricated-completeness defect `omittedRegions` exists one plane down to prevent.
		const o = createProcessRunObserver(2);
		o.ran(aRun(['a']));
		o.ran(aRun(['b']));
		o.ran(aRun(['c']));
		const seen = o.observed();
		expect(seen.runs).toHaveLength(2);
		expect(seen.observedCount, 'the count is of what RAN, not of what was kept').toBe(3);
		expect(seen.recordedLimit).toBe(2);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L's check, finding 3 — D8's PROMISE, HELD (`REG-D-135`; design D8): *"a run past the bound
	// still takes its number, so every later act keeps its true place in the sequence"*. ⛔ No test held it: a mutant numbering
	// only the runs it keeps survived every test under `tools/` and `execution/`, and a write after the bound took the place of a
	// dropped run — package N renders that number. Writes are unbounded and numbered, so they are where it shows.
	it('⭐ D8 — a run past the bound is dropped yet still takes its number: a later write keeps its true place in the step’s one sequence', () => {
		const o = createProcessRunObserver(2);
		o.ran(aRun(['a']));
		o.ran(aRun(['b']));
		o.ran(aRun(['c'])); // past the bound: dropped, numbered 3
		o.wrote({ path: 'src/after-the-bound.ts' });
		o.ran(aRun(['d'])); // dropped too, numbered 5
		const seen = o.observed();
		expect(seen.runs.map((r) => r.ordinal), 'the runs kept are the first two').toEqual([1, 2]);
		expect(seen.writes, 'the write took a dropped run’s place in the sequence').toEqual([{ ordinal: 4, path: 'src/after-the-bound.ts' }]);
		expect(seen.observedCount, 'the count is of what ran').toBe(4);
	});

	it('⭐ the FIRST runs are kept, not the LAST — so an ordinal means the same act in both instruments', () => {
		// ⛔ THE MUTANT IS THE PLAUSIBLE ONE: keep the most recent N, which is what a log would do. `R11`'s
		// record-plane call list keeps the FIRST N, so a turn whose ordinals were assigned by two different rules
		// would have a `MODEL_EXCHANGE` naming call #1 and a process record naming a different command #1.
		const o = createProcessRunObserver(2);
		o.ran(aRun(['first']));
		o.ran(aRun(['second']));
		o.ran(aRun(['third']));
		expect(o.observed().runs.map((r) => r.argv[0])).toEqual(['first', 'second']);
	});

	it('⚠ an observer nothing ran through reports ZERO, which is a MEASUREMENT and not a refusal', () => {
		// ⭑ THE DISTINCTION THIS SEAM MAKES ONCE, DELIBERATELY. For TOOL CALLS, an empty list can mean "nothing
		// could look", and `R11` minted `NOT_OBSERVABLE` so it never collapses into "none ran". A process run
		// goes through the HOST'S OWN port: if none was recorded, none happened. There is no blind case here,
		// and `producer-session.ts` says so at the member that returns this.
		const seen = createProcessRunObserver().observed();
		expect(seen.runs).toEqual([]);
		expect(seen.observedCount).toBe(0);
	});

	it('⭑ the default bound is the record plane\'s own call cap, so one cannot outrun the other', () => {
		// ⚠ AUTHORED, AND THE TEST SAYS WHICH FACT IT PINS: not that 32 is right, but that the two caps are the
		// SAME NUMBER BY CONSTRUCTION. A step must not be able to retain more process runs than the permanent
		// record can name tool calls, or the extra runs are evidence of calls no record mentions.
		expect(OBSERVED_PROCESS_RUN_LIMIT).toBe(32);
		expect(createProcessRunObserver().observed().recordedLimit).toBe(OBSERVED_PROCESS_RUN_LIMIT);
	});

	it('⭑ the snapshot is a COPY — a caller cannot edit the host\'s record of what it ran', () => {
		// THE MUTANT: return `runs` directly. A caller that sorted or spliced the array it was handed would be
		// editing the host's own observation of what happened, in place, with nothing recording that it had.
		const o = createProcessRunObserver();
		o.ran(aRun(['x']));
		const first = o.observed().runs;
		(first as ObservedProcessRun[]).length = 0;
		expect(o.observed().runs).toHaveLength(1);
	});
});
