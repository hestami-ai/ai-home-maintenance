import { describe, expect, it, vi } from 'vitest';
import {
	toPwaFlow,
	type PwaFlowOptions,
	type PwaLayoutDirection,
	type PwuTypeNode
} from './pwaFlow';

function type(
	id: string,
	children: readonly string[] = [],
	fields: Partial<PwuTypeNode> = {}
): PwuTypeNode {
	return {
		id,
		name: id,
		pwuKind: id.toUpperCase(),
		isRoot: id === 'root',
		permittedChildTypeIds: children,
		...fields
	};
}

function options(fields: Partial<PwaFlowOptions> = {}): PwaFlowOptions {
	return {
		collapsed: new Set(),
		showDataFlow: false,
		onToggleCollapse: vi.fn(),
		...fields
	};
}

function positions(flow: Awaited<ReturnType<typeof toPwaFlow>>) {
	return Object.fromEntries(flow.nodes.map((node) => [node.id, node.position]));
}

describe('toPwaFlow layout projection', () => {
	it.each([
		{ direction: 'DOWN' as const, primary: 'y' as const, cross: 'x' as const },
		{ direction: 'RIGHT' as const, primary: 'x' as const, cross: 'y' as const }
	])(
		'lays children after their root and siblings in authored order for $direction',
		async ({ direction, primary, cross }) => {
			const flow = await toPwaFlow(
				[type('root', ['first', 'second']), type('first'), type('second')],
				options({ layoutDirection: direction satisfies PwaLayoutDirection })
			);
			const pos = positions(flow);

			expect(pos.root![primary]).toBeLessThan(pos.first![primary]);
			expect(pos.root![primary]).toBeLessThan(pos.second![primary]);
			expect(pos.first![cross]).toBeLessThan(pos.second![cross]);
			expect(flow.edges.map((edge) => edge.id)).toEqual(['root->first', 'root->second']);
			expect(flow.nodes[0]!.data).toHaveProperty('__statelyai');
			expect(flow.edges[0]!.data).toHaveProperty('__statelyai');
		}
	);

	it('hides descendants of a collapsed type and retains the collapse callback on visible cards', async () => {
		const onToggleCollapse = vi.fn<(id: string) => void>();
		const opts = options({ collapsed: new Set(['branch']), onToggleCollapse });
		const flow = await toPwaFlow(
			[type('root', ['branch']), type('branch', ['leaf']), type('leaf')],
			opts
		);

		expect(flow.nodes.map((node) => node.id)).toEqual(['root', 'branch']);
		expect(flow.edges.map((edge) => edge.id)).toEqual(['root->branch']);
		const branch = flow.nodes.find((node) => node.id === 'branch')!;
		(branch.data.onToggleCollapse as () => void)();
		expect(onToggleCollapse).toHaveBeenCalledWith('branch');
	});

	it('keeps collapsed descendants hidden while exposing a disconnected closed cycle', async () => {
		const flow = await toPwaFlow(
			[
				type('root', ['hidden']),
				type('hidden'),
				type('cycle-a', ['cycle-b']),
				type('cycle-b', ['cycle-a'])
			],
			options({ collapsed: new Set(['root']) })
		);

		expect(flow.nodes.map((node) => node.id)).toEqual(['root', 'cycle-a', 'cycle-b']);
		expect(flow.edges.map((edge) => edge.id)).toEqual(['cycle-a->cycle-b', 'cycle-b->cycle-a']);
	});

	it('keeps card dimensions and connection-handle direction aligned with layout geometry', async () => {
		const flow = await toPwaFlow(
			[
				type('root', [], {
					requiredAssurancePolicyIds: Array.from({ length: 20 }, (_, i) => `policy-${i}`)
				})
			],
			options({ layoutDirection: 'RIGHT' })
		);

		expect(flow.nodes[0]).toMatchObject({
			width: 240,
			height: 160,
			data: { layoutDirection: 'RIGHT' }
		});
	});

	it('adds the data-flow overlay after layout without changing node positions', async () => {
		const types = [
			type('root', ['consumer'], { requiredOutputs: ['approved-design'] }),
			type('consumer', [], { requiredInputs: ['approved-design'] })
		];
		const base = await toPwaFlow(types, options());
		const overlay = await toPwaFlow(types, options({ showDataFlow: true }));

		expect(positions(overlay)).toEqual(positions(base));
		expect(positions(base).root!.y).toBeLessThan(positions(base).consumer!.y);
		expect(base.edges.map((edge) => edge.id)).toEqual(['root->consumer']);
		expect(overlay.edges.map((edge) => edge.id)).toEqual(['root->consumer', 'flow:root->consumer']);
	});
});

describe('toPwaFlow — delegated-leaf assurance rail (JAN-PRPWA-DS-001 INV-2, DWP-06)', () => {
	const REASONING_REVIEW = 'Reasoning Review';
	const railOf = (flow: Awaited<ReturnType<typeof toPwaFlow>>, id: string) =>
		flow.nodes.find((n) => n.id === id)!.data as {
			floorLabels: string[];
			attestationSubstitute?: string;
		};

	it('conditions a DELEGATED_EXTERNAL leaf: two deterministic floor limbs + attestation substitute, NO Reasoning Review floor', async () => {
		const flow = await toPwaFlow(
			[type('root', ['lab']), type('lab', [], { executionBoundary: 'DELEGATED_EXTERNAL' })],
			options()
		);
		const lab = railOf(flow, 'lab');
		expect(lab.floorLabels).not.toContain(REASONING_REVIEW);
		expect(lab.floorLabels).toHaveLength(2);
		expect(lab.attestationSubstitute).toMatch(/substituted by counterparty attestation/);
		// The substitute NAMES Reasoning Review, but it is never shown as a satisfied/applicable floor limb.
		expect(lab.attestationSubstitute).toContain(REASONING_REVIEW);
	});

	it('an INTERNAL leaf keeps all three floor limbs and no substitute (back-compat)', async () => {
		const flow = await toPwaFlow([type('root', ['a']), type('a')], options());
		const a = railOf(flow, 'a');
		expect(a.floorLabels).toContain(REASONING_REVIEW);
		expect(a.floorLabels).toHaveLength(3);
		expect(a.attestationSubstitute).toBeUndefined();
	});
});
