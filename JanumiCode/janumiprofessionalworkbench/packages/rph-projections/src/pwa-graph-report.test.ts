import { describe, expect, it } from 'vitest';
import { analyzePwaGraph, buildPwaGraphExport, type PwaGraphNode } from './pwa-graph.js';
import { formatPwaCoherenceReport } from './pwa-graph-report.js';

const META = {
	id: 'pwa_1',
	name: 'Lifecycle',
	domain: 'facilities',
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

describe('formatPwaCoherenceReport', () => {
	it('renders the coherent verdict, invariants, and node roster for a clean graph', () => {
		const ex = buildPwaGraphExport(META, [
			node('root', true, ['phase'], [], ['product']),
			node('phase', false, ['leaf'], [], ['product']),
			node('leaf', false, [], [], ['product'])
		]);
		const md = formatPwaCoherenceReport(ex, analyzePwaGraph(ex));
		expect(md).toContain('# PWA coherence report — Lifecycle');
		expect(md).toContain('**coherent:** ✓');
		expect(md).toContain('single-root');
		expect(md).toContain('no conservation violations');
	});

	it('surfaces the ungrounded branch and flags cross-subtree edges', () => {
		const ex = buildPwaGraphExport(META, [
			node('root', true, ['pa', 'pb'], [], []),
			node('pa', false, ['la'], [], ['owners-project-requirements']),
			node('la', false, [], [], ['unrelated']),
			node('pb', false, [], ['owners-project-requirements'], [])
		]);
		const md = formatPwaCoherenceReport(ex, analyzePwaGraph(ex));
		expect(md).toContain('**coherent:** ✗');
		expect(md).toContain('ungrounded branch: "pa"');
		expect(md).toContain('⚠ cross-subtree');
	});
});
