import { describe, expect, it, vi } from 'vitest';

vi.mock('@statelyai/graph/layout/elk', () => ({
	getElkLayout: vi.fn().mockRejectedValue(new Error('forced ELK failure'))
}));

import { toPwaFlow } from './pwaFlow.js';

describe('toPwaFlow explicit layout fallback', () => {
	it('preserves semantic nodes and edges when ELK fails', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const flow = await toPwaFlow(
			[
				{
					id: 'root',
					name: 'Root',
					pwuKind: 'ROOT',
					isRoot: true,
					permittedChildTypeIds: ['child']
				},
				{
					id: 'child',
					name: 'Child',
					pwuKind: 'CHILD',
					isRoot: false,
					permittedChildTypeIds: []
				}
			],
			{
				collapsed: new Set(),
				showDataFlow: false,
				layoutDirection: 'RIGHT',
				onToggleCollapse: vi.fn()
			}
		);

		expect(flow.layoutEngine).toBe('DAGRE');
		expect(flow.nodes.map((node) => node.id)).toEqual(['root', 'child']);
		expect(flow.edges.map((edge) => [edge.id, edge.source, edge.target])).toEqual([
			['root->child', 'root', 'child']
		]);
		expect(flow.nodes.find((node) => node.id === 'root')!.position.x).toBeLessThan(
			flow.nodes.find((node) => node.id === 'child')!.position.x
		);
		expect(warning).toHaveBeenCalledWith(
			'ELK layout failed; falling back to Dagre for this PWA projection.',
			expect.any(Error)
		);
		warning.mockRestore();
	});
});
