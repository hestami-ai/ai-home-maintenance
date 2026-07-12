import { describe, expect, it } from 'vitest';
import {
	classifyEvidenceInvalidation,
	impactedObjects,
	TraceGraph,
	validateLinkDirectionality,
	type TraceLink,
	type TraceNode
} from './traceability.js';

function graph(nodes: TraceNode[], links: TraceLink[]): TraceGraph {
	const g = new TraceGraph();
	for (const n of nodes) g.addNode(n);
	for (const l of links) g.addLink(l);
	return g;
}

describe('trace-link directionality (DOC-002 §25.1)', () => {
	it('accepts SUPPORTS from Evidence/Assessment to Claim', () => {
		expect(validateLinkDirectionality('SUPPORTS', 'EVIDENCE', 'CLAIM').ok).toBe(true);
		expect(validateLinkDirectionality('SUPPORTS', 'ASSURANCE_ASSESSMENT', 'CLAIM').ok).toBe(true);
	});
	it('rejects SUPPORTS from a non-Evidence source', () => {
		expect(validateLinkDirectionality('SUPPORTS', 'PROFESSIONAL_WORK_UNIT', 'CLAIM').ok).toBe(
			false
		);
	});
	it('enforces PROMOTES Decision -> Baseline and DECOMPOSES parent PWU -> child PWU', () => {
		expect(validateLinkDirectionality('PROMOTES', 'DECISION', 'BASELINE').ok).toBe(true);
		expect(validateLinkDirectionality('PROMOTES', 'PROFESSIONAL_WORK_UNIT', 'BASELINE').ok).toBe(
			false
		);
		expect(
			validateLinkDirectionality('DECOMPOSES', 'PROFESSIONAL_WORK_UNIT', 'PROFESSIONAL_WORK_UNIT')
				.ok
		).toBe(true);
	});
	it('addLink throws on an invalid direction', () => {
		const g = new TraceGraph();
		g.addNode({ id: 'pwu_x', objectType: 'PROFESSIONAL_WORK_UNIT' });
		g.addNode({ id: 'clm_x', objectType: 'CLAIM' });
		expect(() =>
			g.addLink({ id: 'tr_x', relation: 'SUPPORTS', from: 'pwu_x', to: 'clm_x' })
		).toThrow();
	});
});

const NODES: TraceNode[] = [
	{ id: 'int_1', objectType: 'INTENT' },
	{ id: 'pwu_1', objectType: 'PROFESSIONAL_WORK_UNIT' },
	{ id: 'evd_1', objectType: 'EVIDENCE' },
	{ id: 'clm_1', objectType: 'CLAIM' },
	{ id: 'dec_1', objectType: 'DECISION' },
	{ id: 'base_1', objectType: 'BASELINE' }
];
const LINKS: TraceLink[] = [
	{ id: 't1', relation: 'REFINES', from: 'int_1', to: 'pwu_1' },
	{ id: 't2', relation: 'PRODUCES', from: 'pwu_1', to: 'evd_1' },
	{ id: 't3', relation: 'SUPPORTS', from: 'evd_1', to: 'clm_1' },
	{ id: 't4', relation: 'PROMOTES', from: 'dec_1', to: 'base_1' }
];

describe('TraceGraph queries (RPH-TRC)', () => {
	it('finds a directed traceability path along the relation chain', () => {
		const g = graph(NODES, LINKS);
		const path = g.findPath('int_1', 'clm_1');
		expect(path?.map((l) => l.relation)).toEqual(['REFINES', 'PRODUCES', 'SUPPORTS']);
	});
	it('returns null when no directed path exists', () => {
		expect(graph(NODES, LINKS).findPath('int_1', 'base_1')).toBeNull();
	});
	it('excludes superseded links from traversal (links are immutable; corrections supersede)', () => {
		const g = graph(NODES, [
			...LINKS,
			{ id: 't3b', relation: 'SUPPORTS', from: 'evd_1', to: 'clm_1', superseded: true }
		]);
		expect(g.outgoing('evd_1')).toHaveLength(1); // only the active SUPPORTS
	});
});

describe('invalidation cascade (CT-10 / property P4)', () => {
	it('evidence invalidation forces its supported claims to REVALIDATION (never silently supported)', () => {
		const g = graph(NODES, LINKS);
		const impacts = classifyEvidenceInvalidation(g, 'evd_1');
		expect(impacts).toEqual([
			{
				objectId: 'clm_1',
				classification: 'REVALIDATION',
				reason: expect.stringContaining('evd_1')
			}
		]);
	});
	it('conservative downstream impact marks everything reachable at least NEEDS_REVIEW', () => {
		const g = graph(NODES, LINKS);
		const impacts = impactedObjects(g, 'int_1');
		expect(impacts.map((i) => i.objectId).sort()).toEqual(['clm_1', 'evd_1', 'pwu_1']);
		expect(impacts.every((i) => i.classification === 'NEEDS_REVIEW')).toBe(true);
	});
});
