// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`REG-D-166` (1), (2), (5); `REG-F-643`; `REG-F-212`) — THE ONE RESOLVER OF THE
// SUPERSESSION LINKS, THE CURRENT COMPOSITION, THE CANDIDATES AND THE REACH, as pure functions over a lookup.
//
// ⭑ THE NINTH RUN'S TREE, AS `l17a-facts.md` §1 COPIES IT FROM `p6again9-facts.md` §17 (the lead's): the root over the Specification, the
// Technical Design, Build and Verification and Baseline Acceptance; Build and Verification over Implementation with Unit Tests and End-to-End
// Verification; Implementation with Unit Tests over Source Construction and the Unit Test Suite; End-to-End Verification over the E2E Test
// Suite and E2E Execution and Evidence — each unit's recorded dependencies as §1 lists them; the root, Build and Verification and Baseline
// Acceptance never started, every other unit started. With Source Construction chosen, §1 reads: replaced — Source Construction, the Unit Test
// Suite, Implementation with Unit Tests, the E2E Test Suite, E2E Execution and Evidence, End-to-End Verification; kept — the Specification and
// the Technical Design; following through the links — Build and Verification, Baseline Acceptance and the root.
// ⭑ Imported through the package's barrel, so at a HEAD without the module each name reads undefined and each test reddens at its first call.
import { describe, expect, it } from 'vitest';
import {
	effectiveDependencyIds,
	effectiveParentId,
	isCurrentUnit,
	liveEndOf,
	replacementCandidates,
	replacementReach,
	successorLinkOf,
	type ReachUnit
} from './index.js';

/** A lookup of successor links: `links[id]` is the unit that superseded `id`. */
const successors =
	(links: Readonly<Record<string, string>>) =>
	(id: string): string | undefined =>
		links[id];

/** The ninth run's units, in the Undertaking's order (`planComposition`'s, the root first), each its parent, recorded dependencies and start. */
const NINTH: readonly ReachUnit[] = [
	{ id: 'root', parentId: undefined, dependencyIds: ['spec', 'design', 'bv', 'ba'], started: false },
	{ id: 'spec', parentId: 'root', dependencyIds: [], started: true },
	{ id: 'design', parentId: 'root', dependencyIds: ['spec'], started: true },
	{ id: 'bv', parentId: 'root', dependencyIds: ['iut', 'e2ev'], started: false },
	{ id: 'iut', parentId: 'bv', dependencyIds: ['design', 'source', 'uts'], started: true },
	{ id: 'source', parentId: 'iut', dependencyIds: ['design'], started: true },
	{ id: 'uts', parentId: 'iut', dependencyIds: ['spec', 'design', 'source'], started: true },
	{ id: 'e2ev', parentId: 'bv', dependencyIds: ['iut', 'e2ets', 'e2ex'], started: true },
	{ id: 'e2ets', parentId: 'e2ev', dependencyIds: ['spec', 'design', 'iut'], started: true },
	{ id: 'e2ex', parentId: 'e2ev', dependencyIds: ['iut', 'e2ets'], started: true },
	{ id: 'ba', parentId: 'root', dependencyIds: ['bv', 'e2ev'], started: false }
];

describe('⭐⭐ L17a (D72) — the resolver: a recorded id read through the supersession links to the live end of its chain', () => {
	it('⛔ RED FIRST — a unit with no successor is its own live end; a chain is followed to its end; a cycle is refused, the cycle named', () => {
		expect(liveEndOf('a', successors({})), 'a unit no replacement superseded is the live end of its own chain').toEqual({ ok: true, id: 'a' });
		expect(liveEndOf('a', successors({ a: 'b', b: 'c' })), 'a twice-replaced unit resolves to its last successor').toEqual({ ok: true, id: 'c' });
		expect(liveEndOf('b', successors({ a: 'b', b: 'c' })), 'a successor that was replaced in turn resolves onward').toEqual({ ok: true, id: 'c' });
		expect(liveEndOf('a', successors({ a: 'b', b: 'c', c: 'b' })), 'links that run in a cycle reach no live unit').toEqual({
			ok: false,
			cycle: ['b', 'c', 'b']
		});
		expect(liveEndOf('a', successors({ a: 'a' })), 'nor does a unit linked to itself').toEqual({ ok: false, cycle: ['a', 'a'] });
	});

	it('⛔ RED FIRST — the link is read from a unit’s stored state: its supersedingWorkUnitId where a non-empty string, else none', () => {
		expect(successorLinkOf({ supersedingWorkUnitId: 'pwu_next' })).toBe('pwu_next');
		expect(successorLinkOf({ supersedingWorkUnitId: '' }), 'an empty link links nothing').toBeUndefined();
		expect(successorLinkOf({ supersedingWorkUnitId: 7 }), 'a link that is not a string links nothing').toBeUndefined();
		expect(successorLinkOf({}), 'a unit with no link').toBeUndefined();
		expect(successorLinkOf(undefined), 'a unit not recorded').toBeUndefined();
	});

	it('⛔ RED FIRST — a unit’s effective dependencies and parent are its recorded ones resolved through the links, once each, in order', () => {
		const links = successors({ source: 'source2', uts: 'uts2', iut: 'iut2' });
		expect(effectiveDependencyIds(['spec', 'design', 'source'], links), 'the Unit Test Suite’s, its producer replaced').toEqual([
			'spec',
			'design',
			'source2'
		]);
		expect(
			effectiveDependencyIds(['source', 'source2', 'uts'], links),
			'two recorded ids that resolve to one live unit are one dependency'
		).toEqual(['source2', 'uts2']);
		expect(
			effectiveDependencyIds(['x', 'spec'], successors({ x: 'y', y: 'x' })),
			'a dependency whose links run in a cycle is kept as recorded — a superseded unit, never accepted — so a reader waiting on it fails closed'
		).toEqual(['x', 'spec']);
		expect(effectiveParentId('iut', links), 'a child of a replaced composite follows its successor').toBe('iut2');
		expect(effectiveParentId('bv', links), 'a child of a kept unit keeps it').toBe('bv');
		expect(effectiveParentId(undefined, links), 'the root has none').toBeUndefined();
		expect(effectiveParentId('', links), 'nor has a unit recording an empty parent').toBeUndefined();
		expect(effectiveParentId('x', successors({ x: 'y', y: 'x' })), 'a parent whose links run in a cycle names no live unit').toBeUndefined();
	});

	it('⭑ CONTROL — with no link anywhere, every relation reads exactly as recorded: byte for byte today’s', () => {
		for (const u of NINTH) {
			expect(effectiveDependencyIds(u.dependencyIds, successors({})), u.id).toEqual(u.dependencyIds);
			expect(effectiveParentId(u.parentId, successors({})), u.id).toBe(u.parentId);
		}
	});

	it('⛔ RED FIRST — the current composition is every unit not SUPERSEDED', () => {
		expect(
			['PROPOSED', 'EXECUTING', 'UNDER_ASSURANCE', 'SATISFIED', 'ABANDONED', 'SUPERSEDED'].map((s) => [s, isCurrentUnit(s)]),
			'only a superseded unit leaves the current composition'
		).toEqual([
			['PROPOSED', true],
			['EXECUTING', true],
			['UNDER_ASSURANCE', true],
			['SATISFIED', true],
			['ABANDONED', true],
			['SUPERSEDED', false]
		]);
	});
});

describe('⭐⭐ L17a (D72) — the candidates and the reach, on the ninth run’s tree', () => {
	it('⛔ RED FIRST — the candidates of End-to-End Verification are the units whose work its work used: its dependencies and theirs, and each composite’s children — never itself, never a unit it did not use', () => {
		expect(replacementCandidates(NINTH, 'e2ev')).toEqual(['spec', 'design', 'iut', 'source', 'uts', 'e2ets', 'e2ex']);
	});

	it('⛔ RED FIRST — a composite’s children are candidates, though its dependencies do not name them', () => {
		const units: readonly ReachUnit[] = [
			{ id: 'root', parentId: undefined, dependencyIds: ['c', 'v'], started: false },
			{ id: 'c', parentId: 'root', dependencyIds: [], started: true },
			{ id: 'c1', parentId: 'c', dependencyIds: [], started: true },
			{ id: 'v', parentId: 'root', dependencyIds: ['c'], started: true }
		];
		expect(replacementCandidates(units, 'v'), 'the composite’s child, which its dependencies do not name, is not a candidate').toEqual(['c', 'c1']);
	});

	it('⛔ RED FIRST — the reach of sending the work back to Source Construction is §1’s: its six replaced, the Specification and the Technical Design kept, the three never started following', () => {
		const reach = replacementReach(NINTH, 'source');
		expect(reach, 'replaced, in the Undertaking’s order').toEqual(['iut', 'source', 'uts', 'e2ev', 'e2ets', 'e2ex']);
		expect(
			NINTH.map((u) => u.id).filter((id) => !reach.includes(id)),
			'kept, and following through the links'
		).toEqual(['root', 'spec', 'design', 'bv', 'ba']);
	});

	it('⛔ RED FIRST — the reach ends at the rejected unit: every unit that depends on End-to-End Verification, and its parent, has not started (it was never accepted), so none is in it', () => {
		const reach = replacementReach(NINTH, 'source');
		expect(reach, 'the rejected unit is in the reach').toContain('e2ev');
		const beyond = NINTH.filter((u) => u.dependencyIds.includes('e2ev') || u.id === NINTH.find((x) => x.id === 'e2ev')!.parentId);
		expect(
			beyond.map((u) => [u.id, u.started, reach.includes(u.id)]),
			'its dependents and its parent: Build and Verification and Baseline Acceptance, never started, never reached'
		).toEqual([
			['bv', false, false],
			['ba', false, false]
		]);
	});

	it('⛔ RED FIRST — a unit not started is never in the reach, though it depends on a reached unit: it follows the successors', () => {
		const started = NINTH.map((u) => (u.id === 'bv' ? { ...u, started: true } : u));
		expect(replacementReach(started, 'source'), 'started, Build and Verification would be reached through its dependencies').toContain('bv');
		expect(replacementReach(NINTH, 'source'), 'not started, it is not').not.toContain('bv');
	});

	it('⛔ RED FIRST — a started composite with a child in the reach is reached, though its dependencies do not name that child', () => {
		const units: readonly ReachUnit[] = [
			{ id: 'root', parentId: undefined, dependencyIds: ['a', 'b'], started: false },
			{ id: 'a', parentId: 'root', dependencyIds: [], started: true },
			{ id: 'a1', parentId: 'a', dependencyIds: [], started: true },
			{ id: 'b', parentId: 'root', dependencyIds: [], started: true }
		];
		expect(replacementReach(units, 'a1'), 'the composite over the chosen unit, reached as its parent alone').toEqual(['a', 'a1']);
	});

	it('⛔ RED FIRST — a parallel branch the fault did not reach is kept whole, though started and accepted', () => {
		const units: readonly ReachUnit[] = [
			{ id: 'root', parentId: undefined, dependencyIds: ['a', 'b'], started: true },
			{ id: 'a', parentId: 'root', dependencyIds: ['a1', 'a2'], started: true },
			{ id: 'a1', parentId: 'a', dependencyIds: [], started: true },
			{ id: 'a2', parentId: 'a', dependencyIds: ['a1'], started: true },
			{ id: 'b', parentId: 'root', dependencyIds: ['b1', 'b2'], started: true },
			{ id: 'b1', parentId: 'b', dependencyIds: [], started: true },
			{ id: 'b2', parentId: 'b', dependencyIds: ['b1'], started: true }
		];
		expect(replacementReach(units, 'a1'), 'the fault’s branch and the root over it').toEqual(['root', 'a', 'a1', 'a2']);
		expect(replacementCandidates(units, 'a'), 'the branch’s own composite used its children alone').toEqual(['a1', 'a2']);
		expect(replacementReach(units, 'b2'), 'sending work back to the other branch reaches none of the first').toEqual(['root', 'b', 'b2']);
	});
});
