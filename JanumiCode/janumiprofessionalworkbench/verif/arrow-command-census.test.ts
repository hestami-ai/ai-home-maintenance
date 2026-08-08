// THE ARROW × COMMAND CENSUS (C-0) — every declared transition can be performed by some command.
//
// ── WHY THIS EXISTS, AND WHY THE CONTROL THAT ALREADY EXISTED CANNOT DO IT (REG-F-063) ───────────────────────
//
// `packages/rph-domain/src/state-reachability.test.ts` asks: *is this state reachable from `initialState`,
// following the machine's own declared arrows?* It walks `m.transitions`. That is a question about the DIAGRAM.
//
// `Harness.status` declares nine states and fifteen arrows — a durable wait, a restart-recovery resume, an
// escalation exit: a saga. It is fully connected, so that control reports ZERO stranded, correctly. And
// `handlers/harness.ts` is 49 lines with ONE handler, which writes `FRAMING`. **No command can traverse a single
// arrow.** A machine can be perfect on paper and immovable at runtime, and a control that reads the same
// artifact the defect is written in will always agree with it.
//
// So this instrument asks the other question: **for every declared arrow, is there a registered command whose
// handler can perform it?** It reads THREE artifacts that must agree — `transitions.data.ts` (the arrows), the
// handler sources (which arrows each command declares), and `STEP_COMMAND_SPECS` (the second idiom) — so a
// defect in any one shows up as a disagreement between the others.
//
// ── DIRECTION OF ERROR, STATED SO NOBODY "FIXES" IT BACKWARDS ────────────────────────────────────────────────
//
// A transition performed WITHOUT `advanceStatus` (a direct state write in a bespoke handler) is invisible to the
// extractor, so its arrow is reported as having no command. That is a FALSE POSITIVE: noisy, and safe.
//
// The dangerous direction — reporting an arrow traversable when nothing can perform it — is unreachable by
// construction: traversability is only ever asserted from an EXPLICIT declaration at a call site, and any shape
// the extractor cannot read THROWS rather than contributing nothing. If you find this census listing an arrow
// you believe is covered, make the coverage declarative; do not loosen the census.
//
// ── AND THE COUNT IS NOT THE POINT ───────────────────────────────────────────────────────────────────────────
//
// `expect(uncovered.length).toBeLessThan(N)` would go GREEN when someone DELETES an arrow from
// `transitions.data.ts`: the number improves by destroying the evidence. So the arrow TOTAL is pinned too, and
// the failure output is the LIST — a reader must see WHICH capability is missing, not how many.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { census, declaredArrows } from './arrow-command-census.js';

/**
 * The baseline is DATA, in a committed JSON file, not a literal in this test.
 *
 * ⚠ AND THE REASON IS A MISTAKE THIS FILE MADE. The first version generated its baseline by scraping vitest's
 * own failure output — which TRUNCATES long diffs, so the "baseline" silently lost an entry and the census
 * disagreed with itself. A baseline captured from a REPORT of the thing rather than from the thing is exactly
 * the second-hand evidence this repository keeps finding. `PIN_ARROW_BASELINE=1` rewrites it from `census()`.
 */
const BASELINE_PATH = new URL('./arrow-command-census.baseline.json', import.meta.url).pathname.replace(
	/^\/([A-Za-z]:)/,
	'$1'
);

if (process.env.PIN_ARROW_BASELINE === '1') {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(census(), null, '\t')}\n`, 'utf8');
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
	uncovered: string[];
	orphans: string[];
	total: number;
};

describe('C-0 — every declared arrow can be performed by some command', () => {
	it('pins the ARROW TOTAL, so an uncovered arrow cannot be resolved by deleting it', () => {
		// THE ANTI-REGRESSION THAT MAKES THE LIST BELOW HONEST. Without it, the uncovered set shrinks when someone
		// removes an arrow from transitions.data.ts — the census improves and the machine loses a ratified
		// transition. Deleting an arrow is legitimate; doing it silently is not.
		expect(census().total, 'the declared arrow total moved — update the pin DELIBERATELY').toBe(
			BASELINE.total
		);
	});

	it('lists every arrow no registered command can perform', () => {
		const { uncovered } = census();
		expect(uncovered, `arrows no command can perform:\n${uncovered.join('\n')}`).toEqual(
			BASELINE.uncovered
		);
	});

	it('lists every machine no handler declares at all', () => {
		const { orphans } = census();
		expect(orphans, `machines with no advanceStatus site:\n${orphans.join('\n')}`).toEqual(
			BASELINE.orphans
		);
	});

	// ── THE CONTROL, AND IT HAS ITS OWN FAILURE MODE ─────────────────────────────────────────────────────────
	// The three assertions above all pass if the extractor reads NOTHING and the baseline says so. This one
	// fails in exactly that world: it asserts the extractor actually resolved arrows across several machines,
	// including the two whose ranges come from a factory rather than a literal — the shapes that silently
	// contributed zero arrows in the regex version.
	it('CONTROL — the extractor resolves real arrows, including the factory-declared ones', () => {
		const arrows = declaredArrows();
		expect(arrows.length).toBeGreaterThan(50);
		const machines = new Set(arrows.map((a) => a.machine));
		// `statusChange('DEGRADED', …, ['ACTIVE'])` — target from a call-site argument, sources from a SPREAD.
		expect(
			machines.has('ValidatorRegistryEntry.status'),
			'the factory-declared ValidatorRegistryEntry arrows vanished — the spread is being dropped again'
		).toBe(true);
		// `makeDecisionEffective(target: 'EFFECTIVE', …)` — range from the parameter's literal TYPE.
		expect(machines.has('Decision.status')).toBe(true);
		// The second idiom, read from exported data rather than source.
		expect(machines.has('ExecutionStep.stepState')).toBe(true);
	});
});
