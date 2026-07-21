import { describe, expect, it } from 'vitest';
import { isLeaf, leafKind, leafKindLabel } from './leaf.js';

// JAN-PRPWA-DS-001 STD-1 (DWP-05/06): the single leaf-KIND classifier every surface shares (F-13 no-divergence).
describe('leafKind', () => {
	it('classifies a DELEGATED_EXTERNAL node as a delegated leaf, whatever its (absent) children', () => {
		expect(leafKind({ executionBoundary: 'DELEGATED_EXTERNAL', permittedChildTypeIds: [] })).toBe(
			'DELEGATED'
		);
		// DELEGATED wins even if a (contract-violating) child list were somehow present — belt-and-suspenders.
		expect(leafKind({ executionBoundary: 'DELEGATED_EXTERNAL', permittedChildTypeIds: ['x'] })).toBe(
			'DELEGATED'
		);
	});

	it('classifies an INTERNAL node with no children as an irreducible leaf', () => {
		expect(leafKind({ executionBoundary: 'INTERNAL', permittedChildTypeIds: [] })).toBe(
			'IRREDUCIBLE'
		);
		// Absent executionBoundary resolves to INTERNAL (STD-2 default).
		expect(leafKind({ permittedChildTypeIds: [] })).toBe('IRREDUCIBLE');
		expect(leafKind({})).toBe('IRREDUCIBLE');
	});

	it('classifies a node with children as a decomposition node (non-leaf)', () => {
		expect(leafKind({ executionBoundary: 'INTERNAL', permittedChildTypeIds: ['a', 'b'] })).toBe(
			'NON_LEAF'
		);
	});

	it('isLeaf is true for both leaf kinds, false for a decomposition node', () => {
		expect(isLeaf({ executionBoundary: 'DELEGATED_EXTERNAL' })).toBe(true);
		expect(isLeaf({ permittedChildTypeIds: [] })).toBe(true);
		expect(isLeaf({ permittedChildTypeIds: ['a'] })).toBe(false);
	});

	it('leafKindLabel gives a distinct human label per kind', () => {
		expect(leafKindLabel('DELEGATED')).toMatch(/Delegated/);
		expect(leafKindLabel('IRREDUCIBLE')).toMatch(/Irreducible/);
		expect(leafKindLabel('NON_LEAF')).toMatch(/Decomposition/);
	});
});
