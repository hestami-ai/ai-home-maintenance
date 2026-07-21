import { describe, expect, it } from 'vitest';
import { floorRailFor, type PwuTypeNode } from './pwaFlow';
import { handoffNeighbors, stepNumbersByNode } from './walkthrough';
import { ASSURANCE_FLOOR } from '$lib/authoring/pwuType';
import type { HandoffOrder } from '@janumipwb/rph-projections';

// JAN-PWADESIGNER-DR-001 DWP-02. The per-node panel's two load-bearing pure pieces: the INV-2 floor conditioning
// (floorRailFor — shared with the card, NOT the inspector rail which renders the full floor unconditionally) and the
// producer/consumer resolution (handoffNeighbors — by node id, duplicate-NAME safe).

const t = (id: string, extra: Partial<PwuTypeNode> = {}): PwuTypeNode => ({
	id,
	name: id,
	pwuKind: 'K',
	isRoot: false,
	permittedChildTypeIds: [],
	...extra
});

describe('floorRailFor — INV-2 conditioning (card-adapter logic, shared by card + walkthrough panel)', () => {
	it('an INTERNAL node shows the FULL floor and no attestation substitute', () => {
		const rail = floorRailFor(t('n'));
		expect(rail.labels).toHaveLength(ASSURANCE_FLOOR.length);
		expect(rail.attestationSubstitute).toBeUndefined();
	});

	it('a DELEGATED leaf shows the two deterministic limbs + an attestation SUBSTITUTE, never Reasoning-Review satisfied', () => {
		const rail = floorRailFor(t('lab', { executionBoundary: 'DELEGATED_EXTERNAL' }));
		expect(rail.labels).toHaveLength(ASSURANCE_FLOOR.length - 1);
		expect(rail.attestationSubstitute).toMatch(/substituted by counterparty attestation/);
		const rrLabel = ASSURANCE_FLOOR.find((p) => p.id === 'floor.reasoning-review')?.label;
		expect(rail.labels).not.toContain(rrLabel);
	});
});

describe('handoffNeighbors — producer/consumer resolution by artifact', () => {
	it('resolves inputs to their producers and outputs to their consumers, excluding self', () => {
		const A = t('A', { requiredOutputs: ['x'] });
		const B = t('B', { requiredInputs: ['x'], requiredOutputs: ['y'] });
		const C = t('C', { requiredInputs: ['y'] });
		const b = handoffNeighbors(B, [A, B, C]);
		expect(b.inputs).toEqual([{ artifact: 'x', counterparts: ['A'] }]);
		expect(b.outputs).toEqual([{ artifact: 'y', counterparts: ['C'] }]);
	});

	it('is duplicate-NAME safe (resolves by id) and excludes a self-produced/consumed artifact', () => {
		// a1 and a2 share the NAME "dup"; a1 both produces and lists x as input.
		const a1 = t('a1', { name: 'dup', requiredOutputs: ['x'], requiredInputs: ['x'] });
		const a2 = t('a2', { name: 'dup', requiredInputs: ['x'] });
		const view = handoffNeighbors(a1, [a1, a2]);
		// No OTHER node produces x → a1's input has no producer counterpart (self excluded).
		expect(view.inputs).toEqual([{ artifact: 'x', counterparts: [] }]);
		// a2 (name "dup") consumes x.
		expect(view.outputs).toEqual([{ artifact: 'x', counterparts: ['dup'] }]);
	});
});

describe('stepNumbersByNode — 1-based dependency step per layer', () => {
	it('shares a step number within a layer; cycle/blocked/unordered nodes have no step', () => {
		const order: HandoffOrder = {
			layers: [['A'], ['B', 'C']],
			cycles: [['X', 'Y']],
			blocked: ['Z'],
			unordered: ['W']
		};
		const m = stepNumbersByNode(order);
		expect(m.get('A')).toBe(1);
		expect(m.get('B')).toBe(2);
		expect(m.get('C')).toBe(2);
		expect(m.has('X')).toBe(false);
		expect(m.has('Z')).toBe(false);
		expect(m.has('W')).toBe(false);
	});
});
