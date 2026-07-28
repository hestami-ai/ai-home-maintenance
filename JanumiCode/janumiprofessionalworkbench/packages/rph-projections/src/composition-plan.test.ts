// JPWB-SPEC-001-DR-002 W-3 — the instantiation rule, proved without an engine, a store, or a browser.
//
// The e2e that drives this end to end can only observe the SEEDED architecture, which is one root with seven M1
// children and one C+ grandchild. That fixture cannot distinguish "handles M+" from "handles M1", cannot exercise
// depth, and cannot exercise a cycle. These do.
import { describe, expect, it } from 'vitest';
import { planComposition, type CompositionNode } from './composition-plan.js';

/** A node whose permitted set and rules are stated together, so a fixture cannot declare one without the other. */
function node(
	id: string,
	children: readonly (readonly [string, 'M1' | 'M+' | 'C1' | 'C+'])[] = [],
	isRoot = false
): CompositionNode {
	return {
		id,
		isRoot,
		permittedChildTypeIds: children.map(([typeId]) => typeId),
		permittedChildren: children.map(([typeId, cardinality]) => ({ typeId, cardinality }))
	};
}

const typesOf = (plan: ReturnType<typeof planComposition>): string[] =>
	plan.instances.map((i) => i.typeId);

describe('planComposition — the mandatory minimum decides what is created', () => {
	it('creates exactly one instance per MANDATORY permitted child, and none per CONDITIONAL one', () => {
		const plan = planComposition(
			[
				node('root', [['m1', 'M1'], ['mplus', 'M+'], ['c1', 'C1'], ['cplus', 'C+']], true),
				node('m1'),
				node('mplus'),
				node('c1'),
				node('cplus')
			],
			'root'
		);
		// M1 and M+ both have a mandatory minimum of ONE. M+ means one-or-MORE, not many: creating two would be
		// the surface inventing work nobody asked for, which is the same defect class as instantiating a C+.
		expect(typesOf(plan).sort()).toEqual(['m1', 'mplus', 'root']);
		expect(plan.offered.map((o) => o.typeId).sort()).toEqual(['c1', 'cplus']);
	});

	it('a permitted child with NO rule defaults to MANDATORY, not conditional', () => {
		// `permittedChildren` is OPTIONAL on a PWU Type, so a PWA authored before the field existed carries only
		// the flat list. Defaulting those to conditional would instantiate NOTHING for such a PWA — and an empty
		// result is indistinguishable from a correctly-instantiated architecture whose children are all optional.
		const plan = planComposition(
			[
				{ id: 'root', isRoot: true, permittedChildTypeIds: ['child'] },
				{ id: 'child', isRoot: false, permittedChildTypeIds: [] }
			],
			'root'
		);
		expect(typesOf(plan)).toEqual(['root', 'child']);
		expect(plan.offered).toHaveLength(0);
	});

	it('recurses: a mandatory child of a mandatory child is instantiated, and parented correctly', () => {
		const plan = planComposition(
			[node('root', [['mid', 'M1']], true), node('mid', [['leaf', 'M+']]), node('leaf')],
			'root'
		);
		expect(typesOf(plan)).toEqual(['root', 'mid', 'leaf']);
		const byType = new Map(plan.instances.map((i) => [i.typeId, i]));
		expect(byType.get('root')!.parentKey).toBeUndefined();
		expect(byType.get('mid')!.parentKey).toBe(byType.get('root')!.key);
		expect(byType.get('leaf')!.parentKey).toBe(byType.get('mid')!.key);
		// A contract per parent that GAINED children — two here, not three: the leaf gained none.
		expect(plan.decompositions).toHaveLength(2);
	});

	it('offers are attributed to the parent that permits them, not to the root', () => {
		const plan = planComposition(
			[node('root', [['mid', 'M1']], true), node('mid', [['opt', 'C+']]), node('opt')],
			'root'
		);
		const mid = plan.instances.find((i) => i.typeId === 'mid')!;
		expect(plan.offered).toEqual([{ parentKey: mid.key, typeId: 'opt', cardinality: 'C+' }]);
	});

	it('carries the applicability note onto the offer, because that note is the only guidance there is', () => {
		// The vocabulary defers the structured applicability predicate — "free-text note for now". Dropping the
		// note would leave a professional an offer with no statement of when it applies.
		const plan = planComposition(
			[
				{
					id: 'root',
					isRoot: true,
					permittedChildTypeIds: ['opt'],
					permittedChildren: [
						{ typeId: 'opt', cardinality: 'C+', applicabilityNote: 'One per material concern' }
					]
				},
				node('opt')
			],
			'root'
		);
		expect(plan.offered[0]!.applicabilityNote).toBe('One per material concern');
	});

	it('reports an unresolvable permitted child instead of silently planning a smaller tree', () => {
		// A PWA PUBLISHES in this state today: `definePwuType` never checks that permittedChildTypeIds resolve.
		const plan = planComposition([node('root', [['ghost', 'M1']], true)], 'root');
		expect(typesOf(plan)).toEqual(['root']);
		expect(plan.unresolved).toEqual([{ parentTypeId: 'root', typeId: 'ghost' }]);
	});

	it('TERMINATES on a recursive architecture, and reports the cycle rather than truncating quietly', () => {
		// A PWA may legitimately declare a recursive structure. The planner must terminate on one by construction,
		// not because no author has written one yet.
		const plan = planComposition(
			[node('a', [['b', 'M1']], true), node('b', [['a', 'M1']])],
			'a'
		);
		expect(typesOf(plan)).toEqual(['a', 'b']);
		expect(plan.unresolved).toEqual([{ parentTypeId: 'b', typeId: 'a' }]);
	});

	it('plans nothing at all when the named root is not in the node set', () => {
		expect(planComposition([node('other')], 'missing').instances).toHaveLength(0);
	});
});
