import { describe, expect, it } from 'vitest';
import type { PwaGraphExport, PwaGraphNode } from './pwa-graph.js';
import { layerHandoff, handoffFindings, type HandoffOrder } from './handoff-order.js';

// JAN-PWADESIGNER-DR-001 DWP-01. The hand-off dependency layering is a STRICT 4-way partition
// { layers, cycles, blocked, unordered }. The load-bearing regression is that a node DOWNSTREAM of a hand-off cycle
// is `blocked`, NOT a cycle member (the §19 dim-2 BLOCKER a naïve "any un-emitted node is a cycle member" rule missed).

const node = (id: string, extra: Partial<PwaGraphNode> = {}): PwaGraphNode => ({
	id,
	name: id,
	pwuKind: 'K',
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	...extra
});

/** Build a minimal export: nodes by id + hand-off edges [producer, consumer, artifact]. */
const ex = (ids: string[], flows: Array<[string, string, string]>): PwaGraphExport => ({
	pwa: { id: 'p', name: 'p', domain: 'd', version: '1', publicationStatus: 'DRAFT' },
	nodes: ids.map((id) => node(id)),
	permits: [],
	dataFlow: flows.map(([producer, consumer, artifact]) => ({ producer, consumer, artifact })),
	artifacts: [],
	roots: []
});

/** Every node appears exactly once across the four buckets (strict partition). */
const partitionOf = (o: HandoffOrder): string[] =>
	[...o.layers.flat(), ...o.cycles.flat(), ...o.blocked, ...o.unordered].sort((a, b) => a.localeCompare(b));

const layerIndex = (o: HandoffOrder): Map<string, number> => {
	const m = new Map<string, number>();
	o.layers.forEach((layer, i) => layer.forEach((id) => m.set(id, i)));
	return m;
};

describe('layerHandoff — 4-way partition of the hand-off dependency graph', () => {
	it('a linear chain becomes N singleton layers, in order', () => {
		const o = layerHandoff(ex(['A', 'B', 'C'], [['A', 'B', 'x'], ['B', 'C', 'y']]));
		expect(o.layers).toEqual([['A'], ['B'], ['C']]);
		expect(o.cycles).toEqual([]);
		expect(o.blocked).toEqual([]);
		expect(o.unordered).toEqual([]);
	});

	it('a diamond shows concurrency: the two independent middle nodes share a layer', () => {
		const o = layerHandoff(
			ex(['A', 'B', 'C', 'D'], [['A', 'B', 'x'], ['A', 'C', 'y'], ['B', 'D', 'u'], ['C', 'D', 'v']])
		);
		expect(o.layers).toEqual([['A'], ['B', 'C'], ['D']]);
		expect(o.cycles).toEqual([]);
		expect(o.blocked).toEqual([]);
	});

	it('a node with no hand-off edge is `unordered`, never forced into a layer', () => {
		const o = layerHandoff(ex(['A', 'B', 'X'], [['A', 'B', 'x']]));
		expect(o.layers).toEqual([['A'], ['B']]);
		expect(o.unordered).toEqual(['X']);
	});

	it('an empty graph and a single isolated node are handled', () => {
		expect(layerHandoff(ex([], []))).toEqual({ layers: [], cycles: [], blocked: [], unordered: [] });
		expect(layerHandoff(ex(['only'], []))).toEqual({
			layers: [],
			cycles: [],
			blocked: [],
			unordered: ['only']
		});
	});

	it('a mutual hand-off (A↔B) is a cycle cluster, nothing fabricated into a layer', () => {
		const o = layerHandoff(ex(['A', 'B'], [['A', 'B', 'x'], ['B', 'A', 'y']]));
		expect(o.cycles).toEqual([['A', 'B']]);
		expect(o.layers).toEqual([]);
		expect(o.blocked).toEqual([]);
		expect(o.unordered).toEqual([]);
	});

	// The BLOCKER regression (DR-001 §19 dim-2): F and G are DOWNSTREAM of the A↔B cycle — never Kahn-emittable —
	// but they are NOT cycle members. They must land in `blocked`, not in `cycles` and not in `unordered`.
	it('nodes downstream of a cycle are `blocked`, NOT mislabeled as cycle members', () => {
		const o = layerHandoff(
			ex(['A', 'B', 'F', 'G'], [['A', 'B', 'x'], ['B', 'A', 'y'], ['B', 'F', 'z'], ['F', 'G', 'w']])
		);
		expect(o.cycles).toEqual([['A', 'B']]);
		expect(o.blocked).toEqual(['F', 'G']);
		expect(o.layers).toEqual([]);
		expect(o.unordered).toEqual([]);
	});

	it('a clean chain that merely FEEDS a separate cycle keeps its upstream layers; only the cycle+below is stuck', () => {
		// S → A, A↔B. S is emittable (nothing depends-back on it); A,B are the cycle.
		const o = layerHandoff(ex(['S', 'A', 'B'], [['S', 'A', 's'], ['A', 'B', 'x'], ['B', 'A', 'y']]));
		expect(o.layers).toEqual([['S']]);
		expect(o.cycles).toEqual([['A', 'B']]);
		expect(o.blocked).toEqual([]);
	});

	it('two disjoint cycles are two separate clusters', () => {
		const o = layerHandoff(
			ex(['A', 'B', 'C', 'D'], [['A', 'B', 'p'], ['B', 'A', 'q'], ['C', 'D', 'r'], ['D', 'C', 's']])
		);
		expect(o.cycles).toEqual([['A', 'B'], ['C', 'D']]);
		expect(o.blocked).toEqual([]);
		expect(o.layers).toEqual([]);
	});
});

describe('layerHandoff — partition + partial-order invariants (property-style)', () => {
	const fixtures: PwaGraphExport[] = [
		ex(['A', 'B', 'C'], [['A', 'B', 'x'], ['B', 'C', 'y']]),
		ex(['A', 'B', 'C', 'D'], [['A', 'B', 'x'], ['A', 'C', 'y'], ['B', 'D', 'u'], ['C', 'D', 'v']]),
		ex(['A', 'B', 'F', 'G'], [['A', 'B', 'x'], ['B', 'A', 'y'], ['B', 'F', 'z'], ['F', 'G', 'w']]),
		ex(['A', 'B', 'X'], [['A', 'B', 'x']]),
		ex(['only'], [])
	];

	it('every node appears EXACTLY once across the four buckets (strict partition)', () => {
		for (const fx of fixtures) {
			const o = layerHandoff(fx);
			const all = partitionOf(o);
			expect(all).toEqual(fx.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b)));
			expect(all.length).toBe(new Set(all).size); // no duplicates
		}
	});

	it('partial-order fidelity: for every hand-off edge whose endpoints are BOTH layered, producer precedes consumer', () => {
		for (const fx of fixtures) {
			const idx = layerIndex(layerHandoff(fx));
			for (const e of fx.dataFlow)
				if (idx.has(e.producer) && idx.has(e.consumer))
					expect(idx.get(e.producer)!).toBeLessThan(idx.get(e.consumer)!);
		}
	});
});

describe('handoffFindings — node-keyed facts (no name-substring resolution)', () => {
	it('keys leaf-kind + cycle/blocked membership by nodeId, and is duplicate-NAME safe', () => {
		// Two nodes share the NAME "dup" but have distinct ids — a name-substring approach would cross-attribute.
		const graph: PwaGraphExport = {
			...ex(['a1', 'a2', 'F'], [['a1', 'a2', 'x'], ['a2', 'a1', 'y'], ['a2', 'F', 'z']]),
			nodes: [
				node('a1', { name: 'dup' }),
				node('a2', { name: 'dup' }),
				node('F', { name: 'downstream' })
			]
		};
		const findings = handoffFindings(graph);
		const byNode = new Map(findings.map((f) => [f.nodeId, f]));
		expect(byNode.get('a1')!.inCycle).toBe(true);
		expect(byNode.get('a2')!.inCycle).toBe(true);
		expect(byNode.get('F')!.blocked).toBe(true);
		expect(byNode.get('F')!.inCycle).toBe(false);
	});

	it('reports the DELEGATED leaf kind (INV-2 substitute is the counterparty attestation)', () => {
		const graph: PwaGraphExport = {
			...ex(['root', 'lab'], [['root', 'lab', 'sample']]),
			nodes: [node('root'), node('lab', { executionBoundary: 'DELEGATED_EXTERNAL' })]
		};
		const lab = handoffFindings(graph).find((f) => f.nodeId === 'lab')!;
		expect(lab.leafKind).toBe('DELEGATED');
		expect(lab.delegated).toBe(true);
	});
});
