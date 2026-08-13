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
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { census, deadCovered, declaredArrows, declaredArrowsInFile } from './arrow-command-census.js';

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
	writeFileSync(
		BASELINE_PATH,
		`${JSON.stringify({ ...census(), ...deadCovered() }, null, '\t')}\n`,
		'utf8'
	);
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
	uncovered: string[];
	orphans: string[];
	total: number;
	dead: string[];
	unanalysed: string[];
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

	// ── C-0a: OCCUPANCY. "Covered" is not the same as "can fire" ─────────────────────────────────────────────
	//
	// An arrow whose SOURCE STATE is never occupied is dead however many commands declare it — and the three
	// assertions above would all score it COVERED. REG-F-067 found the first instance; REG-F-069 then walked
	// straight into it, registering a FalsifyAssumption whose four source states nothing could produce.
	//
	// Occupancy is seeded from BIRTHS DECLARED AT THE CREATION SITES, not from `initialState`, which lies for at
	// least six machines (REG-F-071) — and not from the arrow graph, which cannot see a birth at all.
	it('lists every COVERED arrow whose source state can never be occupied', () => {
		const { dead } = deadCovered();
		expect(dead, `covered arrows that can never fire:\n${dead.join('\n')}`).toEqual(BASELINE.dead);
	});

	// A machine with no `births` declaration cannot be analysed: every state would look unoccupiable and every
	// covered arrow dead — a 100% false-positive rate dressed as a finding. Skipping them silently would be the
	// census narrowing its own population, so the unanalysed set is PINNED and shrinks deliberately.
	it('pins which machines are NOT yet occupancy-analysed, so the scope cannot quietly widen or narrow', () => {
		const { unanalysed } = deadCovered();
		expect(unanalysed, `machines with no declared birth:\n${unanalysed.join('\n')}`).toEqual(
			BASELINE.unanalysed
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

// ── REG-F-122: THE RATCHET'S POSITIVE CASES, WHICH ONLY A SYNTHETIC SOURCE CAN HOLD ──────────────────────────
//
// The refusals under test had exactly ONE live instance — `governance.ts:293`, a shorthand `precondition` bound
// to a factory parameter — and it left the repository in the same commit that made these shapes refusals. So no
// test over the real handler tree can ever enter the failing arms again, and a guard whose positive case is
// extinct in its population is exactly the mutant-survives-and-is-right-to hole REG-F-120 recorded. The fixtures
// below ARE the population; `declaredArrowsInFile` is exported as a seam for precisely this reason.
describe('REG-F-122 — a from-half the walk cannot read is REFUSED, never inferred', () => {
	const parse = (name: string, src: string) =>
		ts.createSourceFile(name, src, ts.ScriptTarget.ES2022, true);

	it('refuses a shorthand `precondition` — the exact shape governance.ts:293 had', () => {
		const sf = parse(
			'fixture-shorthand.ts',
			"advanceStatus(ctx, command, { machine: 'Decision.status', target: 'EFFECTIVE', precondition });\n"
		);
		expect(() => declaredArrowsInFile(sf)).toThrowError(/fixture-shorthand\.ts:1/);
	});

	it('refuses a `precondition` bound to a bare name — the same hole spelled as an assignment', () => {
		const sf = parse(
			'fixture-named.ts',
			"advanceStatus(ctx, command, { machine: 'Decision.status', target: 'EFFECTIVE', precondition: pre });\n"
		);
		expect(() => declaredArrowsInFile(sf)).toThrowError(/fixture-named\.ts:1/);
	});

	it("refuses a precondition with no readable fromStates, instead of substituting the machine's in-edges", () => {
		// THE ARM THE F122 MUTANT MEASURES. Under the deleted fallback this site was read as un-narrowed and
		// handed PROPOSED -> EFFECTIVE from the machine table — one arrow, fabricated, indistinguishable in the
		// census output from a declared one. The repo-wide pins cannot catch that resurrection (every real site
		// declares a readable fromStates, so the fallback is dead code against the live tree); this fixture can.
		const sf = parse(
			'fixture-predicate-only.ts',
			"advanceStatus(ctx, command, { machine: 'Decision.status', target: 'EFFECTIVE', precondition: predicate('x', () => null) });\n"
		);
		expect(() => declaredArrowsInFile(sf)).toThrowError(/fixture-predicate-only\.ts:1/);
	});

	// CONTROL — the three refusals above are all satisfied by a walk that throws on EVERYTHING, and such a walk
	// would take the whole census down with it. This is the case that holds the READING half.
	it('CONTROL — a fromStates declared at the literal is read exactly, not refused', () => {
		// Two sources, deliberately: a single one would also pass under a walk that keeps only the first literal.
		const sf = parse(
			'fixture-declared.ts',
			"advanceStatus(ctx, command, { machine: 'Decision.status', target: 'REVOKED', precondition: allOf(kind, fromStates('EFFECTIVE', 'PROPOSED')) });\n"
		);
		const { arrows, sites } = declaredArrowsInFile(sf);
		expect(sites).toBe(1);
		expect(arrows).toEqual([
			{ machine: 'Decision.status', from: 'EFFECTIVE', to: 'REVOKED', site: 'fixture-declared.ts:1' },
			{ machine: 'Decision.status', from: 'PROPOSED', to: 'REVOKED', site: 'fixture-declared.ts:1' }
		]);
	});
});
