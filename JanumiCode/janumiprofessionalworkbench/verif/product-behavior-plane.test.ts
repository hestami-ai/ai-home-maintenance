// JAN-SLICE-SWP-05 — the W7 product-behavior plane is promoted, whole, and not a second representation.
//
// ── WHAT THIS DISCHARGES, IN THE CORPUS'S OWN WORDS ──────────────────────────────────────────────────────────
// `FSM §30.2`, verbatim: *"Initially represent these through typed fields or extensions… Promote them to
// universal first-class tables only after the Product Realization PWA implementation proves the need."*
//
// ⚠ THIS IS THE DISCHARGE OF A RATIFIED DEFERRAL, NOT THE CLOSING OF A DEFECT. The condition is PROOF OF NEED,
// and a verification substrate keyed to capabilities and journeys is that proof — it cannot trace to objects
// that do not exist. `SL-W7-2` states the same thing from the other side: *"The promotion is an enabler, not a
// prerequisite."* Recording it as remediation would misdescribe a design maturing exactly as designed.
//
// ⚠⚠ AND THE DISCHARGE IS PARTIAL, WHICH THE ROADMAP DID NOT STATE AND WHICH THIS FILE GATES. `§30.2` defers
// SEVEN — *"stakeholder; actor; capability; journey; requirement; risk; architecture element"* — and SWP-05
// promotes FOUR of them. `SCENARIO`, the fifth promoted, IS NOT ON §30.2'S LIST AT ALL; its warrant is
// separate and also ratified (ontology `§5.9`, `§12`). Recorded as `REG-F-302`, and the residue is a
// RATCHET below rather than a sentence, because a prose caveat is exactly what goes stale.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COMMANDS, EVENTS, OBJECT_SCHEMAS } from '@janumipwb/rph-contracts';
import { SCENARIO_CLASSES } from '@janumipwb/rph-contracts/slice';
import { ScenarioClassSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The five types this work package promoted. */
const PROMOTED = ['ACTOR', 'CAPABILITY', 'USER_JOURNEY', 'SCENARIO', 'REQUIREMENT'] as const;

/**
 * The three `§30.2` defers that SWP-05 did NOT promote.
 *
 * ⚠ THESE ARE READ OUT OF THE CORPUS SENTENCE, NOT TYPED FROM MEMORY — see the derivation test below, which
 * parses §30.2's own list and asserts this set is exactly what remains after the promoted four are removed.
 * A hand-written residue would be a second claim about the corpus that nothing checks, which is the defect
 * shape this repository keeps finding (a hand-listed set said 2 where the derivation said 8).
 */
const STILL_DEFERRED = ['stakeholder', 'risk', 'architecture element'] as const;

const FSM = `${ROOT}docs/Recursive Professional Harness/Janumi Professional Workbench Field Service Management SaaS Reference Undertaking.md`;

/** §30.2's deferral list, parsed from the ratified sentence rather than restated. */
function deferredByFsm302(): string[] {
	const text = readFileSync(FSM, 'utf8');
	const start = text.indexOf('## 30.2 Defer as separate first-class objects');
	if (start < 0) throw new Error('FSM §30.2 was not found — the anchor is the heading, not a line number');
	const end = text.indexOf('Promote them to universal first-class tables', start);
	if (end < 0) throw new Error('FSM §30.2 promotion sentence was not found');
	return text
		.slice(start, end)
		.split('\n')
		.filter((l) => l.trimStart().startsWith('* '))
		// ⚠ THE TERMINATOR IS NOT UNIFORM AND THAT IS THE CORPUS'S BUSINESS, NOT A REASON TO HAND-LIST. §30.2's
		// list is semicolon-separated except its LAST item, which ends in a full stop — so a parser stripping
		// only `;` yields "architecture element." and silently fails to match. It was caught here rather than
		// by reading, which is the point of parsing the sentence instead of restating it.
		.map((l) => l.trim().replace(/^\*\s*/, '').replace(/[;.]$/, ''));
}

/** The pwuKinds the ontology defines — the plane this promotion must not duplicate. */
function pwuKinds(): string[] {
	const raw = readFileSync(`${ROOT}packages/rph-product-realization-pwa/vocab/m8-ontology.json`, 'utf8');
	const parsed = JSON.parse(raw) as { pwuTemplates?: { pwuKind: string }[] };
	return (parsed.pwuTemplates ?? []).map((t) => t.pwuKind);
}

describe('the W7 product-behavior plane', () => {
	it('CONTROL — the corpus sentence is really being read, and it names seven', () => {
		// Without this every §30.2 assertion below is vacuously satisfiable by a parser that returns nothing.
		// The count is pinned because §30.2's list length is the whole basis for "four of seven".
		const deferred = deferredByFsm302();
		expect(deferred, 'FSM §30.2 defers seven object kinds').toHaveLength(7);
		expect(deferred, 'and they are the real ones, not empty strings').toContain('architecture element');
	});

	it('all five promoted types are registered object types', () => {
		const missing = PROMOTED.filter((t) => !(t in OBJECT_SCHEMAS));
		expect(
			missing,
			`these types were promoted by SWP-05 but are not in OBJECT_SCHEMAS: ${missing.join(', ')}`
		).toEqual([]);
	});

	// ⚠ THE HOLLOW-LAYER GATE, AND IT IS DERIVED FROM THE WHOLE POPULATION RATHER THAN THE FIVE. Before SWP-05,
	// 24 of 24 object types were reachable by a command — measured, not assumed. So a shape-only promotion
	// would have made these the repository's first five exceptions, which is precisely the hollow governed
	// layer it has already recorded against itself. Asserting over EVERY object type rather than the promoted
	// five means a future type cannot be added shape-only either.
	it('EVERY object type is reachable by a command that emits an event — no shape-only types', () => {
		const byAggregate = new Map<string, string[]>();
		for (const [name, spec] of Object.entries(COMMANDS)) {
			const agg = (spec as { targetAggregateType?: string }).targetAggregateType;
			if (agg) byAggregate.set(agg, [...(byAggregate.get(agg) ?? []), name]);
		}
		const unreachable = Object.keys(OBJECT_SCHEMAS).filter((t) => !byAggregate.has(t));
		expect(
			unreachable,
			`these object types are declared but no command mints them — shape without an act is the hollow governed layer: ${unreachable.join(', ')}`
		).toEqual([]);

		const unemitted = PROMOTED.map((t) => byAggregate.get(t) ?? [])
			.flat()
			.filter((cmd) => {
				const emits = (COMMANDS[cmd as keyof typeof COMMANDS] as { emitsEvent?: string }).emitsEvent;
				return !emits || !(emits in EVENTS);
			});
		expect(
			unemitted,
			`these promoted commands declare an event that does not exist: ${unemitted.join(', ')}`
		).toEqual([]);
	});

	// ⚠⚠ THE INVARIANT SWP-05 WAS GIVEN, GATED RATHER THAN ASSERTED IN PROSE: *"No parallel representation is
	// introduced alongside the existing pwuKind."* The corpus settles it — `USER_JOURNEY_DEFINITION` is a
	// pwuKind, the WORK of defining a journey; `USER_JOURNEY` is the journey that work PRODUCES, and the
	// Reference already lists it among that PWU's `outputArtifactTypes`. Work and product are different
	// things. What would BE a parallel representation is an object type whose name IS a pwuKind, so that is
	// what this refuses.
	it('no promoted object type collides with a pwuKind — work and product stay distinct (SL-W7-1)', () => {
		const kinds = new Set(pwuKinds());
		expect(kinds.size, 'CONTROL — the ontology really yields pwuKinds').toBeGreaterThan(0);
		const collisions = Object.keys(OBJECT_SCHEMAS).filter((t) => kinds.has(t));
		expect(
			collisions,
			`these object types share a name with a pwuKind, which is the parallel representation SL-W7-1 forbids: ${collisions.join(', ')}`
		).toEqual([]);
		// CONTROL — the collision check can actually fire. Without this it passes for a `kinds` set that never
		// matches anything, which is the vacuity that would make the invariant unenforced.
		expect(kinds.has('USER_JOURNEY_DEFINITION'), 'the near-miss the invariant is about').toBe(true);
	});

	// ── TRACEABLE FROM SLICES (the work package's stated outcome) ────────────────────────────────────────────
	// ⚠ THE LINK IS A SHARED RATIFIED VOCABULARY, NOT A NEW FIELD. A Slice declares a `scenarioClass`; a
	// SCENARIO object now carries the same eight classes. That makes the Slice programme and the promoted
	// plane answerable to ONE ratified sentence — ontology §12's "Minimum scenario classes" — so a ninth
	// ratified class reddens here AND in `slice-scenario-classes.test.ts` instead of one drifting past the
	// other. Inventing a `tracesObjectTypes` field on the declaration would have been a second representation
	// with no consumer, which is the hollow layer one level up.
	it('the SCENARIO enum is the same ratified eight the Slice contract carries', () => {
		// The mapping is DERIVED, never restated: the repository's enum convention is UPPER_SNAKE (zero of its
		// canonical enums carry non-UPPER values), so the transform is mechanical and a hand-written pairing
		// would be the claim nothing checks.
		const expected = SCENARIO_CLASSES.map((c) => c.toUpperCase().replace(/[ -]/g, '_'));
		expect(
			[...ScenarioClassSchema.options].sort(),
			'the promoted ScenarioClass enum has diverged from the Slice contract SCENARIO_CLASSES. Both answer to ontology §12; change neither by hand'
		).toEqual([...expected].sort());
		expect(expected, 'CONTROL — the derivation produced the real eight').toHaveLength(8);
		expect(expected, 'and the transform really transformed').toContain('USER_ERROR_PATH');
	});

	// ── THE RESIDUE, AS A RATCHET ───────────────────────────────────────────────────────────────────────────
	// ⚠ THIS IS NOT A PROHIBITION ON PROMOTING THE OTHER THREE. It is a refusal to let them be promoted
	// SILENTLY, because the moment they are, "§30.2's condition is met" stops meaning "for four of seven" and
	// nobody would notice the sentence had changed underneath. Promoting one is a deliberate act that edits
	// this list and says why — the same shape as the working-roadmap ratchet in `slice-subsumption.test.ts`.
	it('the three §30.2 kinds SWP-05 did not promote are still unpromoted, and the residue is derived', () => {
		const deferred = deferredByFsm302();
		// The promoted four, matched against §30.2's own wording rather than against my list of them.
		const promotedWords = ['actor', 'capability', 'journey', 'requirement'];
		const residue = deferred.filter((d) => !promotedWords.some((w) => d.includes(w)));
		expect(
			residue.sort(),
			'§30.2 minus the four SWP-05 promoted must be exactly the recorded residue — if this moved, either the corpus changed or the promotion did'
		).toEqual([...STILL_DEFERRED].sort());

		const objectTypes = new Set(Object.keys(OBJECT_SCHEMAS));
		const promotedResidue = STILL_DEFERRED.filter((d) =>
			objectTypes.has(d.toUpperCase().replace(/ /g, '_'))
		);
		expect(
			promotedResidue,
			`these were promoted without §30.2's residue being re-stated. That is legitimate — but it must be DELIBERATE: update STILL_DEFERRED and REG-F-302 so "the deferral condition is met" keeps naming how many of seven: ${promotedResidue.join(', ')}`
		).toEqual([]);
	});

	// ⚠ SCENARIO'S WARRANT IS THE ONE CLAIM MOST LIKELY TO BE QUIETLY WRONG, so it is checked in the direction
	// that would embarrass it: SCENARIO must NOT appear in §30.2's list. If a future reader "corrects" the
	// register to say §30.2 carried all five, this reddens.
	it('SCENARIO is NOT one of §30.2’s defers — its warrant is ontology §5.9, not this deferral', () => {
		const deferred = deferredByFsm302().map((d) => d.toLowerCase());
		expect(
			deferred.filter((d) => d.includes('scenario')),
			'§30.2 does not defer scenario, so SWP-05 must not be recorded as discharging a deferral for it (REG-F-302)'
		).toEqual([]);
		// CONTROL — the same probe finds the four that ARE there, so an empty result above means absence
		// rather than a broken reader.
		expect(deferred.filter((d) => d.includes('journey')), 'CONTROL — journey IS deferred').toHaveLength(1);
	});
});
