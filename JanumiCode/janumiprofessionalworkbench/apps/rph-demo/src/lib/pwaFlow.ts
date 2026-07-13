// Adapter: a PWA's PWU Types -> Svelte Flow nodes/edges for the node-graph PWA Designer. Nodes are the reusable
// PWU Types; edges are the allowed COMPOSITION (a type's permittedChildTypeIds — "this type may be decomposed into
// that one"). PWU Types carry no execution/assurance state (they are definitions), so styling is by role
// (root / selected / plain), not by the four axes. The agent generates these nodes + edges by proposing
// DefinePwuType / EditPwuType commands; a human can also click a node to edit it in the inspector.
import type { Edge, Node } from '@xyflow/svelte';

export interface PwuTypeNode {
	readonly id: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly isRoot: boolean;
	readonly permittedChildTypeIds: readonly string[];
}

/** Layered layout: roots (no incoming composition edge) at the top; children one row down (BFS depth). */
function layout(
	types: readonly PwuTypeNode[],
	edges: ReadonlyArray<{ from: string; to: string }>
): Record<string, { x: number; y: number }> {
	const incoming = new Set(edges.map((e) => e.to));
	const children = new Map<string, string[]>();
	for (const e of edges) children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
	const depth = new Map<string, number>();
	const queue: Array<[string, number]> = types
		.filter((t) => !incoming.has(t.id))
		.map((t) => [t.id, 0]);
	// Unreferenced-and-non-root standalone types still get depth 0 (they appear in the top row).
	if (queue.length === 0 && types.length) queue.push([types[0]!.id, 0]);
	const seen = new Set<string>();
	while (queue.length) {
		const [id, d] = queue.shift()!;
		if (seen.has(id) && d <= (depth.get(id) ?? 0)) continue;
		seen.add(id);
		depth.set(id, Math.max(d, depth.get(id) ?? 0));
		for (const c of children.get(id) ?? []) queue.push([c, d + 1]);
	}
	const byDepth = new Map<number, string[]>();
	for (const t of types) {
		const d = depth.get(t.id) ?? 0;
		byDepth.set(d, [...(byDepth.get(d) ?? []), t.id]);
	}
	const pos: Record<string, { x: number; y: number }> = {};
	for (const [d, ids] of byDepth) {
		ids.forEach((id, i) => {
			pos[id] = { x: i * 230 + 30, y: d * 150 + 20 };
		});
	}
	return pos;
}

function nodeStyle(t: PwuTypeNode, selected: boolean): string {
	const border = selected
		? '2px solid #9fcaff'
		: t.isRoot
			? '2px solid #007acc'
			: '1px solid #404751';
	return `background:#1b1b1c;color:#e5e2e1;border:${border};border-radius:10px;padding:10px 12px;width:200px;font:12px/1.4 'Inter',system-ui,sans-serif;white-space:pre-line;text-align:left;`;
}

export interface PwaFlow {
	readonly nodes: Node[];
	readonly edges: Edge[];
}

export function toPwaFlow(types: readonly PwuTypeNode[], selectedId: string): PwaFlow {
	const ids = new Set(types.map((t) => t.id));
	const pairs = types.flatMap((t) =>
		t.permittedChildTypeIds.filter((c) => ids.has(c)).map((c) => ({ from: t.id, to: c }))
	);
	const pos = layout(types, pairs);
	const nodes: Node[] = types.map((t) => ({
		id: t.id,
		position: pos[t.id] ?? { x: 0, y: 0 },
		data: { label: `${t.name}${t.isRoot ? '  • ROOT' : ''}\n${t.pwuKind}` },
		style: nodeStyle(t, selectedId === t.id)
	}));
	const edges: Edge[] = pairs.map((e) => ({
		id: `${e.from}->${e.to}`,
		source: e.from,
		target: e.to,
		label: 'permits',
		animated: false
	}));
	return { nodes, edges };
}
