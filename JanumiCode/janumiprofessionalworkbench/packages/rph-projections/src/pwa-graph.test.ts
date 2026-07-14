import { describe, expect, it } from 'vitest';
import { analyzePwaGraph, buildPwaGraphExport, type PwaGraphNode } from './pwa-graph.js';

const META = {
	id: 'pwa_1',
	name: 'Test',
	domain: 'software',
	version: '0.1.0',
	publicationStatus: 'DRAFT'
};

function node(
	id: string,
	isRoot: boolean,
	children: string[] = [],
	inputs: string[] = [],
	outputs: string[] = []
): PwaGraphNode {
	return {
		id,
		name: id,
		pwuKind: id.toUpperCase(),
		isRoot,
		permittedChildTypeIds: children,
		requiredInputs: inputs,
		requiredOutputs: outputs
	};
}

const analyze = (nodes: PwaGraphNode[]) => analyzePwaGraph(buildPwaGraphExport(META, nodes));
const inv = (r: ReturnType<typeof analyze>, name: string) =>
	r.invariants.find((i) => i.name === name)!;

describe('analyzePwaGraph — structural validity', () => {
	it('a clean single-root hierarchy is valid with no findings', () => {
		const r = analyze([
			node('root', true, ['a', 'b'], ['seed'], []),
			node('a', false, ['c'], [], ['x']),
			node('b', false, [], ['x'], ['y']),
			node('c', false, [], [], [])
		]);
		expect(r.valid).toBe(true);
		expect(r.findings).toEqual([]);
		expect(r.metrics.maxDepth).toBe(2);
	});

	it('fails single-root on 0 or 2 roots', () => {
		expect(inv(analyze([node('a', false)]), 'single-root').ok).toBe(false);
		expect(inv(analyze([node('a', true), node('b', true)]), 'single-root').ok).toBe(false);
	});

	it('fails acyclic-permits on a composition cycle', () => {
		const r = analyze([
			node('root', true, ['a']),
			node('a', false, ['b']),
			node('b', false, ['a'])
		]);
		expect(inv(r, 'acyclic-permits').ok).toBe(false);
		expect(r.valid).toBe(false);
		expect(r.metrics.cycleCount).toBeGreaterThan(0);
	});

	it('fails connected when a type is unreachable from the root', () => {
		const r = analyze([node('root', true, ['a']), node('a', false), node('orphan', false)]);
		expect(inv(r, 'connected').ok).toBe(false);
		expect(r.metrics.orphanCount).toBe(1);
	});

	it('builds data-flow edges from matching output→input artifacts', () => {
		const ex = buildPwaGraphExport(META, [
			node('root', true, ['a', 'b']),
			node('a', false, [], [], ['spec']),
			node('b', false, [], ['spec'], [])
		]);
		expect(ex.dataFlow).toContainEqual({ producer: 'a', consumer: 'b', artifact: 'spec' });
	});

	it('reports a dangling input (consumed by a non-root, produced by none) as an advisory finding', () => {
		const r = analyze([node('root', true, ['a']), node('a', false, [], ['ghost'], [])]);
		expect(r.valid).toBe(true); // structural invariants still hold
		expect(r.metrics.danglingInputs).toBe(1);
		expect(r.findings.some((f) => /dangling input/.test(f))).toBe(true);
	});

	it('reports an over-broad fan-out (star) as an advisory finding', () => {
		const kids = ['a', 'b', 'c', 'd', 'e'];
		const r = analyze([node('root', true, kids), ...kids.map((k) => node(k, false))]);
		expect(r.metrics.maxFanout).toBe(5);
		expect(r.findings.some((f) => /flat star/.test(f))).toBe(true);
	});
});
