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
import {
	census,
	deadCovered,
	declaredArrows,
	declaredArrowsInFile,
	initialStateFictions,
	birthStates
} from './arrow-command-census.js';

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
	// Occupancy is seeded from BIRTHS DECLARED AT THE CREATION SITES, not from `initialState`, which lies for a
	// set this file now DERIVES and pins by name (REG-F-125 below; this line said "at least six" while fourteen
	// others said "four") — and not from the arrow graph, which cannot see a birth at all.
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

// ── REG-F-125: THE NUMBER FOURTEEN COMMENTS ASSERTED AND NOTHING CHECKED ─────────────────────────────────────
//
// REG-F-071 measured that some machines declare an `initialState` no creation ever writes. The measurement was
// right when taken and was then COPIED, as the clause `a fiction on four machines`, to fourteen sites across
// nine files — handlers, `verif/binding-row-truth.ts`, and this census's own docstring. **Nothing gated it.** By
// the time anyone re-derived it the answer was FIVE: `AssuranceAssessment.state` joined when its request path
// moved to land in EVIDENCE_PENDING|READY instead of REQUESTED, and fourteen comments went on saying four.
//
// ⚠ PINNED BY NAME, NOT BY COUNT, and the distinction is REG-F-121's: `toBe(5)` goes green if a machine is
// DELETED, so the number improves by destroying the evidence. The pin below names each machine WITH the
// contradiction it carries, so the failure output tells a reader which machine changed and how.
describe('REG-F-125 — which machines declare an initialState the engine never writes, DERIVED not remembered', () => {
	it('pins the fictions BY NAME, with the state actually written', () => {
		expect(initialStateFictions()).toEqual([
			{ machine: 'AssuranceAssessment.state', declared: 'REQUESTED', actuallyBornIn: ['EVIDENCE_PENDING', 'READY'] },
			{ machine: 'Baseline.status', declared: 'DRAFT', actuallyBornIn: ['CANDIDATE'] },
			{ machine: 'DecompositionContract.status', declared: 'DRAFT', actuallyBornIn: ['UNDER_REVIEW'] },
			{ machine: 'ExecutionPlan.status', declared: 'PROPOSED', actuallyBornIn: ['UNDER_REVIEW'] },
			{ machine: 'RecompositionContract.status', declared: 'DRAFT', actuallyBornIn: ['READY'] }
		]);
	});

	// CONTROL — the pin above is satisfied by a function that returns those five hard-coded, and equally by one
	// that calls EVERY machine a liar and happens to be filtered elsewhere. This holds the discriminating half:
	// a machine born exactly where it says it is must be ABSENT. `Intent.intentStatus` declares RAW and
	// `intent.ts` declares `births: [… values: ['RAW']]`, so it agrees — and it must never appear here.
	it('CONTROL — a machine born where it declares is NOT a fiction', () => {
		const named = new Set(initialStateFictions().map((f) => f.machine));
		expect(named.has('Intent.intentStatus'), 'Intent is born in RAW, exactly as declared').toBe(false);
		expect(named.has('PWU.workLifecycleState'), 'PWU is born in PROPOSED, exactly as declared').toBe(false);
	});

	// CONTROL — scope. A machine with NO `births` declaration is UNANALYSABLE, not a liar; counting it here would
	// read absence of evidence as evidence of absence and would silently inflate a governance-facing number.
	it('CONTROL — machines with no declared birth are excluded, not counted as fictions', () => {
		const analysable = birthStates();
		for (const f of initialStateFictions())
			expect(analysable.has(f.machine), `${f.machine} was reported without a birth declaration`).toBe(true);
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

	// ── REG-F-124: THE PAIRING, AND THE RECTANGLE IT REPLACED ────────────────────────────────────────────────
	//
	// A factory whose target AND source list both come from its parameters declares a (target, sources) TUPLE at
	// each call. The census used to resolve the two parameters independently, flatten each into a set, and cross
	// them — so two calls declaring 2 arrows were read as 4, and the extra two were claimed by nothing.
	//
	// ⚠ THE FIXTURE IS TWO CALLS, NOT ONE, AND NOT FOUR. One call cannot tell pairing from crossing (the
	// cross product of a single tuple IS that tuple). Four would mirror the live site so closely that the test
	// would pass by coincidence if the walk special-cased it. Two calls with DISJOINT targets and DISJOINT
	// sources is the smallest arrangement where the two readings differ, and they differ loudly: paired = 2,
	// crossed = 4.
	it('pairs a factory’s (target, sources) PER CALL instead of crossing the flattened sets', () => {
		const sf = parse(
			'fixture-factory.ts',
			[
				'const statusChange = (target: string, from: [string, ...string[]]) => (ctx, command) =>',
				"\tadvanceStatus(ctx, command, { machine: 'Decision.status', target, precondition: fromStates(...from) });",
				"export const a = statusChange('EFFECTIVE', ['PROPOSED']);",
				"export const b = statusChange('REVOKED', ['EFFECTIVE']);"
			].join('\n')
		);
		const { arrows } = declaredArrowsInFile(sf);
		expect(
			arrows.map((a) => `${a.from} -> ${a.to}`).sort(),
			'crossing would add PROPOSED -> REVOKED and EFFECTIVE -> EFFECTIVE, which no call declares'
		).toEqual(['EFFECTIVE -> REVOKED', 'PROPOSED -> EFFECTIVE']);
	});

	// ⚠ THE ARM WITH NO LIVE POSITIVE CASE (hazard H2 of the REG-F-124 audit). Under the old UNION a call passing
	// a computed target was RESCUED by its literal-passing siblings — their values were in the same flattened
	// set. Under pairing that call contributes NOTHING, so a real declaration would vanish silently and the
	// census would read the loss as coverage. All four live `statusChange` calls pass literals, so nothing in the
	// repository can enter this arm; this fixture is its entire population.
	it('REFUSES a factory call whose target or sources are not literal, rather than dropping its arrows', () => {
		const sf = parse(
			'fixture-computed-call.ts',
			[
				'const statusChange = (target: string, from: [string, ...string[]]) => (ctx, command) =>',
				"\tadvanceStatus(ctx, command, { machine: 'Decision.status', target, precondition: fromStates(...from) });",
				"export const a = statusChange('EFFECTIVE', ['PROPOSED']);",
				'export const b = statusChange(computeTarget(), [someState]);'
			].join('\n')
		);
		expect(() => declaredArrowsInFile(sf)).toThrowError(/fixture-computed-call\.ts/);
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
// ── REG-F-159: THE FOUR AXES A PWU IS BORN INTO, AND WHY THREE OF THEM WERE MISSING ──────────────────────────
//
// `proposePwu` commits all FOUR axes from one `seededAxes` literal and, until this pin, declared ONE. That is the
// same one-of-four shape REG-F-157 found in the DRIVE path, sitting in the BIRTH path of the same command — and
// its consequence was that every occupancy layer skipped the three sub-axes by an explicit guard:
// `deadCovered` (`if (!set) continue`), `provablyUnoccupiable` (`if (!born) continue`), `initialStateFictions`
// (`if (born === undefined) continue`), `occupancyAnalysable` (`born.has(m)`).
//
// ⚠ SO THE CHECK THAT WOULD HAVE CONTRADICTED THE LARGEST COVERAGE CLAIM IN THE PROGRAMME COULD NOT FIRE ON IT.
// REG-F-157 measured a 42-arrow declaration worth 162/304 -> 204/304 on exactly these three machines. Had it
// been taken, `deadCovered` would have reported nothing about any of the 42 — not because they are live, but
// because it skips machines with no declared birth. **A control that cannot fail, arriving precisely where the
// number is largest.** The 42 is refused for other reasons (REG-F-159); this pin removes the blind spot either way.
//
// ⚠ PINNED BY NAME AND VALUE, NOT BY COUNT. `expect(births.size).toBe(22)` goes green when a declaration is
// deleted and another added, which is REG-F-121's lesson. The mutant this pin exists to kill is the DELETION of
// one entry from the array: nothing else in the suite reddens for it — `refuseOnBirthDrift` simply stops checking
// that axis, silently — so this is the only assertion standing between that deletion and a green run.
describe('REG-F-159 — the four axes a PWU is born into are DECLARED, not merely written', () => {
	it('pins each birth BY MACHINE AND VALUE, read off the state `proposePwu` commits', () => {
		const births = birthStates();
		expect(births.get('PWU.workLifecycleState'), 'seededAxes.workLifecycleState').toEqual(new Set(['PROPOSED']));
		expect(births.get('PWU.executionState'), 'seededAxes.executionState').toEqual(new Set(['NOT_PLANNED']));
		expect(births.get('PWU.assuranceState'), 'seededAxes.assuranceState').toEqual(new Set(['UNASSESSED']));
		expect(births.get('PWU.shapeIntegrityState'), 'seededAxes.shapeIntegrityState').toEqual(new Set(['UNKNOWN']));
	});

	// CONTROL — the pin above passes for a census that reads the declaration and equally for one that has
	// hard-coded these four. This holds the discriminating half: the census must read a PLURAL array, which no
	// site in the repository used before this increment. If `computeBirthStates` ever regressed to reading only
	// `births[0]`, the pin above would fail on three machines and this would name the cause.
	it('CONTROL — a births array with FOUR entries is read in full, not just its first', () => {
		const births = birthStates();
		const pwuAxes = [...births.keys()].filter((m) => m.startsWith('PWU.')).sort((a, b) => a.localeCompare(b));
		expect(pwuAxes, 'all four PWU axes come from ONE births array at one commit site').toEqual([
			'PWU.assuranceState',
			'PWU.executionState',
			'PWU.shapeIntegrityState',
			'PWU.workLifecycleState'
		]);
	});

	// CONTROL — scope. Declaring a birth must not smuggle in an arrow claim: these three machines have ZERO
	// declared arrows and the C-0 baseline must not move. `dead` and `unanalysed` are both derived from
	// `declaredArrows()`, so a machine with no arrows appears in neither — and a future change that made a birth
	// declaration also count as coverage would break exactly here.
	it('CONTROL — a birth is not a coverage claim: the three sub-axes stay out of dead AND unanalysed', () => {
		const { dead, unanalysed } = deadCovered();
		for (const m of ['PWU.executionState', 'PWU.assuranceState', 'PWU.shapeIntegrityState']) {
			expect(unanalysed, `${m} has no declared arrows, so it cannot be unanalysed`).not.toContain(m);
			expect(dead.some((d) => d.startsWith(`${m}  `)), `${m} declares no arrow to be dead`).toBe(false);
		}
	});
});
