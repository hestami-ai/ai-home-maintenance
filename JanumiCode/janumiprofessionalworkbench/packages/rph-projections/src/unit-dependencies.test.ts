import { describe, expect, it } from 'vitest';
import {
	dependencyLayers,
	readinessUnitOf,
	startReadiness,
	startRefusal,
	START_REFUSAL_MARKER,
	unitDependencies,
	UNPRODUCED_INPUT,
	type DependencyType,
	type DependencyUnit,
	type ReadinessUnit
} from './unit-dependencies.js';

// ⭐ `JAN-EXEC` Phase 7, package M — design D1 and D2 (`REG-D-135` (2); `REG-F-578`). The units each unit waits for, from
// the bound PWA's types and the Undertaking's units, and whether a unit may start. THE FIXTURE IS RUN-12'S SHAPE
// (`fixes-facts.md` §3, the lead's reading of run-12's stored types): twelve types, four of them composites that require
// what their own children produce, every input but `originating-intent` some other type's output, and no loop. The
// leaves' inputs are not in §3 and are supplied here, each the output of a phase the data-flow order puts before it.

const type = (id: string, requiredInputs: string[], requiredOutputs: string[]): DependencyType => ({
	id,
	requiredInputs,
	requiredOutputs
});

/** Run-12's twelve types, by short name. */
const RUN12_TYPES: readonly DependencyType[] = [
	type('t-root', ['originating-intent', 'verification-evidence'], ['realization-summary']),
	type('t-req', ['originating-intent'], ['requirements-specification']),
	type('t-design', ['cli-design-contribution', 'processing-design-contribution'], ['architecture-baseline']),
	type('t-cli', ['requirements-specification'], ['cli-design-contribution']),
	type('t-words', ['requirements-specification'], ['processing-design-contribution']),
	type(
		't-impl',
		['cli-runtime-code', 'processing-module-code', 'unit-test-evidence', 'architecture-baseline'],
		['implemented-wordfreq-candidate']
	),
	type('t-entry', ['architecture-baseline'], ['cli-runtime-code']),
	type('t-core', ['architecture-baseline'], ['processing-module-code']),
	type('t-unit', ['cli-runtime-code', 'processing-module-code'], ['unit-test-evidence']),
	type('t-e2e', ['e2e-test-suite', 'e2e-results', 'implemented-wordfreq-candidate'], ['verification-evidence']),
	type('t-suite', ['implemented-wordfreq-candidate'], ['e2e-test-suite']),
	type('t-exec', ['e2e-test-suite', 'implemented-wordfreq-candidate'], ['e2e-results'])
];

const unit = (id: string, typeId: string, parentId?: string): DependencyUnit =>
	parentId === undefined ? { id, typeId } : { id, typeId, parentId };

/** Run-12's twelve units, in the order instantiation made them (the lane's tree order, `run12-costs.md`). */
const RUN12_UNITS: readonly DependencyUnit[] = [
	unit('root', 't-root'),
	unit('req', 't-req', 'root'),
	unit('design', 't-design', 'root'),
	unit('cli', 't-cli', 'design'),
	unit('words', 't-words', 'design'),
	unit('impl', 't-impl', 'root'),
	unit('entry', 't-entry', 'impl'),
	unit('core', 't-core', 'impl'),
	unit('unit', 't-unit', 'impl'),
	unit('e2e', 't-e2e', 'root'),
	unit('suite', 't-suite', 'e2e'),
	unit('exec', 't-exec', 'e2e')
];

const recordOf = (deps: ReturnType<typeof unitDependencies>, id: string) =>
	deps.units.find((u) => u.unitId === id)!;

describe('⭐ D1 — the units each unit waits for: every producer of each required input, and a parent’s children', () => {
	it('⭐ THE PREDICTED RED — run-12’s shape gives the design’s data-flow order, the root LAST: requirements; CLI contract and word processing; technical design; CLI entry and core; unit tests; implementation; e2e suite; e2e execution; end-to-end verification; the root', () => {
		const deps = unitDependencies(RUN12_TYPES, RUN12_UNITS);
		expect(deps.loops, 'run-12’s data flow has no loop').toEqual([]);
		expect(deps.units.flatMap((u) => u.unproduced), 'every input of run-12 is produced').toEqual([]);
		const order = dependencyLayers(deps.units);
		expect(order.layers, 'the design’s data-flow order (§3)').toEqual([
			['req'],
			['cli', 'words'],
			['design'],
			['entry', 'core'],
			['unit'],
			['impl'],
			['suite'],
			['exec'],
			['e2e'],
			['root']
		]);
		expect([order.loops, order.blocked]).toEqual([[], []]);
	});

	it('the root waits for its four children and its verification evidence’s producer; its originating intent is the Undertaking’s Intent’s', () => {
		const root = recordOf(unitDependencies(RUN12_TYPES, RUN12_UNITS), 'root');
		expect(root.inputs).toEqual([{ input: 'verification-evidence', producerIds: ['e2e'] }]);
		expect(root.suppliedByIntent).toEqual(['originating-intent']);
		expect(root.childIds).toEqual(['req', 'design', 'impl', 'e2e']);
		expect(root.dependencyIds, 'each dependency once, in the units’ order').toEqual(['req', 'design', 'impl', 'e2e']);
	});

	it('a composite waits for what its children produce AND what a sibling produces: implementation, for its three children and technical design', () => {
		const impl = recordOf(unitDependencies(RUN12_TYPES, RUN12_UNITS), 'impl');
		expect(impl.inputs).toEqual([
			{ input: 'cli-runtime-code', producerIds: ['entry'] },
			{ input: 'processing-module-code', producerIds: ['core'] },
			{ input: 'unit-test-evidence', producerIds: ['unit'] },
			{ input: 'architecture-baseline', producerIds: ['design'] }
		]);
		expect(impl.dependencyIds).toEqual(['design', 'entry', 'core', 'unit']);
	});

	it('DEC-2 — each decomposition’s sibling dependencies: the children another child of the same parent waits for', () => {
		const deps = unitDependencies(RUN12_TYPES, RUN12_UNITS);
		expect(deps.siblingDependencies).toEqual([
			{ parentId: 'root', siblingDependencyIds: ['design', 'impl'] },
			{ parentId: 'design', siblingDependencyIds: [] },
			{ parentId: 'impl', siblingDependencyIds: ['entry', 'core'] },
			{ parentId: 'e2e', siblingDependencyIds: ['suite'] }
		]);
	});

	it('⭐ a type instantiated TWICE gives BOTH its units as producers: a consumer waits for each, never for one of two', () => {
		const types = [type('t-p', [], ['parts']), type('t-c', ['parts'], ['assembly']), type('t-top', [], [])];
		const units = [unit('top', 't-top'), unit('p1', 't-p', 'top'), unit('c', 't-c', 'top'), unit('p2', 't-p', 'top')];
		const c = recordOf(unitDependencies(types, units), 'c');
		expect(c.inputs).toEqual([{ input: 'parts', producerIds: ['p1', 'p2'] }]);
		expect(c.dependencyIds).toEqual(['p1', 'p2']);
		expect(dependencyLayers(unitDependencies(types, units).units).layers).toEqual([['p1', 'p2'], ['c'], ['top']]);
	});

	it('⭐ D5 — a LOOP is named: two units each requiring the other’s output, and a child requiring its parent’s output while the parent waits for its children', () => {
		const flow = unitDependencies(
			[type('t-a', ['b-out'], ['a-out']), type('t-b', ['a-out'], ['b-out']), type('t-top', [], []), type('t-free', [], [])],
			[unit('top', 't-top'), unit('a', 't-a', 'top'), unit('b', 't-b', 'top'), unit('free', 't-free', 'top')]
		);
		expect(flow.loops, 'the data-flow loop').toEqual([['a', 'b']]);
		const flowOrder = dependencyLayers(flow.units);
		expect(flowOrder.loops).toEqual([['a', 'b']]);
		expect(flowOrder.layers, 'a unit outside the loop still has its place').toEqual([['free']]);
		expect(flowOrder.blocked, 'the parent waits for the loop’s units, so it is blocked behind it').toEqual(['top']);

		const parental = unitDependencies(
			[type('t-parent', [], ['brief']), type('t-child', ['brief'], [])],
			[unit('parent', 't-parent'), unit('child', 't-child', 'parent')]
		);
		expect(parental.loops, 'the child requires its parent’s output; the parent waits for its child').toEqual([
			['parent', 'child']
		]);
	});

	it('⭐ an input NO UNIT produces is named — originating-intent is the Intent’s, never unproduced; a unit is never its own producer', () => {
		const deps = unitDependencies(
			[type('t-top', ['originating-intent'], []), type('t-leaf', ['market-study', 'notes'], ['notes'])],
			[unit('top', 't-top'), unit('leaf', 't-leaf', 'top')]
		);
		expect(recordOf(deps, 'top').unproduced).toEqual([]);
		expect(recordOf(deps, 'top').suppliedByIntent).toEqual(['originating-intent']);
		expect(recordOf(deps, 'leaf').unproduced, 'nothing produces it; and only the leaf itself produces its notes').toEqual([
			'market-study',
			'notes'
		]);
		expect(recordOf(deps, 'leaf').dependencyIds).toEqual([]);
	});

	it('CONTROL — an independent unit has no dependency and starts in the first layer', () => {
		const deps = unitDependencies([type('t', [], [])], [unit('only', 't')]);
		expect(recordOf(deps, 'only').dependencyIds).toEqual([]);
		expect(dependencyLayers(deps.units).layers).toEqual([['only']]);
	});
});

// ── D2 — WHETHER A UNIT MAY START, read from what the store recorded ────────────────────────────────────────────────

const pwuState = (
	title: string,
	state: string,
	dependencyIds: string[] = [],
	inputRequirements: Record<string, unknown>[] = [],
	undertakingId = 'und_1'
): Record<string, unknown> => ({
	objectType: 'PROFESSIONAL_WORK_UNIT',
	title,
	workLifecycleState: state,
	undertakingId,
	dependencyIds,
	inputRequirements
});

const lookupOf =
	(states: Readonly<Record<string, Record<string, unknown>>>) =>
	(id: string): ReadinessUnit | undefined =>
		readinessUnitOf(id, states[id]);

describe('⭐ D2 — a unit may start only when every unit it depends on is ACCEPTED: SATISFIED, RECOMPOSED or BASELINED', () => {
	it('⭐ THE PREDICTED RED — a consumer whose producer is PROPOSED waits for it, named', () => {
		const r = startReadiness(
			'consumer',
			lookupOf({
				producer: pwuState('Requirements', 'PROPOSED'),
				consumer: pwuState('Design', 'PROPOSED', ['producer'])
			})
		);
		expect([r.startable, r.kinds, r.waitingFor]).toEqual([
			false,
			['waiting'],
			[{ id: 'producer', title: 'Requirements', state: 'PROPOSED' }]
		]);
		expect(r.reason).toBe('it waits for "Requirements" (PROPOSED) to be accepted');
		expect(startRefusal('consumer', r)).toContain(START_REFUSAL_MARKER);
		expect(startRefusal('consumer', r)).toContain('"Requirements" (PROPOSED)');
	});

	it.each(['SATISFIED', 'RECOMPOSED', 'BASELINED'])('CONTROL — a producer %s is accepted, and the consumer may start', (state) => {
		const r = startReadiness(
			'consumer',
			lookupOf({ producer: pwuState('P', state), consumer: pwuState('C', 'PROPOSED', ['producer']) })
		);
		expect([r.startable, r.kinds, r.reason]).toEqual([true, [], null]);
	});

	it('⛔ CONDITIONALLY_SATISFIED does NOT count: its conditions are open (DOC-003 DEC-6)', () => {
		const r = startReadiness(
			'consumer',
			lookupOf({
				producer: pwuState('P', 'CONDITIONALLY_SATISFIED'),
				consumer: pwuState('C', 'PROPOSED', ['producer'])
			})
		);
		expect([r.startable, r.waitingFor.map((w) => w.state)]).toEqual([false, ['CONDITIONALLY_SATISFIED']]);
	});

	it('⛔ ONE PRODUCER OF TWO IS NOT ENOUGH: a consumer waits for every unit it depends on', () => {
		const r = startReadiness(
			'c',
			lookupOf({
				p1: pwuState('Parts 1', 'SATISFIED'),
				p2: pwuState('Parts 2', 'EXECUTING'),
				c: pwuState('Assembly', 'PROPOSED', ['p1', 'p2'])
			})
		);
		expect([r.startable, r.waitingFor.map((w) => w.id)]).toEqual([false, ['p2']]);
	});

	it('⭐ D4 — an ABANDONED producer is named as abandoned, and its consumer stays unstarted', () => {
		const r = startReadiness(
			'c',
			lookupOf({ p: pwuState('Design', 'ABANDONED'), c: pwuState('Build', 'PROPOSED', ['p']) })
		);
		expect([r.startable, r.kinds, r.abandoned]).toEqual([false, ['abandoned'], [{ id: 'p', title: 'Design' }]]);
		expect(r.reason).toBe('its producer "Design" was ABANDONED');
	});

	it('⭐ D5 — a unit in a LOOP is named in it, and never starts, even were the other unit accepted elsewhere', () => {
		const r = startReadiness(
			'a',
			lookupOf({ a: pwuState('A', 'PROPOSED', ['b']), b: pwuState('B', 'PROPOSED', ['a']) })
		);
		expect([r.startable, r.kinds]).toEqual([false, ['waiting', 'loop']]);
		expect(r.loop).toEqual([
			{ id: 'a', title: 'A' },
			{ id: 'b', title: 'B' }
		]);
		expect(r.reason).toBe('it waits for "B" (PROPOSED) to be accepted; it sits in a loop: "A" → "B" → "A"');
	});

	it('⭐ an input nothing produces, and a dependency naming no unit of this Undertaking, each refuse the start, named', () => {
		const r = startReadiness(
			'c',
			lookupOf({
				other: pwuState('Elsewhere', 'SATISFIED', [], [], 'und_2'),
				c: pwuState('C', 'PROPOSED', ['other', 'pwu_gone'], [{ name: 'market-study', status: UNPRODUCED_INPUT }])
			})
		);
		expect([r.startable, r.kinds, r.unknown, r.unproduced]).toEqual([
			false,
			['unknown', 'unproduced'],
			['other', 'pwu_gone'],
			['market-study']
		]);
		expect(r.reason).toBe(
			'other and pwu_gone name no unit of this Undertaking; nothing in this Undertaking produces its input "market-study"'
		);
	});

	it('the reason in the page’s words, each count as it falls: two ABANDONED producers, one unknown id, two inputs nothing produces', () => {
		const r = startReadiness(
			'c',
			lookupOf({
				p1: pwuState('Design', 'ABANDONED'),
				p2: pwuState('Plan', 'ABANDONED'),
				c: pwuState('Build', 'PROPOSED', ['p1', 'p2', 'pwu_gone'], [
					{ name: 'market-study', status: UNPRODUCED_INPUT },
					{ name: 'budget', status: UNPRODUCED_INPUT }
				])
			})
		);
		expect(r.reason).toBe(
			'its producers "Design" and "Plan" were ABANDONED; pwu_gone names no unit of this Undertaking; ' +
				'nothing in this Undertaking produces its inputs "market-study" and "budget"'
		);
	});

	it('⭐ D5 — two loops are each named, in the units’ order', () => {
		const deps = unitDependencies(
			[type('t-a', ['b-out'], ['a-out']), type('t-b', ['a-out'], ['b-out']), type('t-c', ['d-out'], ['c-out']), type('t-d', ['c-out'], ['d-out'])],
			[unit('c', 't-c'), unit('d', 't-d'), unit('a', 't-a'), unit('b', 't-b')]
		);
		expect(deps.loops).toEqual([
			['c', 'd'],
			['a', 'b']
		]);
	});

	it('CONTROL — a unit with no dependency and no unproduced input may start', () => {
		const r = startReadiness('only', lookupOf({ only: pwuState('Only', 'PROPOSED') }));
		expect([r.startable, r.reason]).toEqual([true, null]);
	});

	it('a stored object that is not a work unit is read as none', () => {
		expect(readinessUnitOf('x', { objectType: 'INTENT', title: 'x' })).toBeUndefined();
		expect(readinessUnitOf('x', undefined)).toBeUndefined();
	});
});
