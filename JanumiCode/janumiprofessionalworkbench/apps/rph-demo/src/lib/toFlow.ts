// Adapter: the engine's DemoGraph -> Svelte Flow nodes/edges. This is the whole integration surface — the UI reads
// ONLY the engine's pure graph-view read-model (produced live server-side) and adds a layered layout + state-driven
// styling. The engine never renders.
import type { DemoGraph, GraphNode } from '@janumipwb/rph-projections';
import type { Node, Edge } from '@xyflow/svelte';

/** A generic layered layout: depth (row) from the decomposition edges (BFS from the roots), index within a depth
 *  gives the column. Works for any Professional Work Graph, not just the Reference Undertaking. */
function layout(g: DemoGraph): Record<string, { x: number; y: number }> {
	const incoming = new Set(g.edges.map((e) => e.to));
	const children = new Map<string, string[]>();
	for (const e of g.edges) {
		const list = children.get(e.from) ?? [];
		list.push(e.to);
		children.set(e.from, list);
	}
	const depth = new Map<string, number>();
	const roots = g.nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
	const queue: Array<[string, number]> = roots.map((id) => [id, 0]);
	while (queue.length) {
		const [id, d] = queue.shift()!;
		if (!depth.has(id) || d > (depth.get(id) ?? 0)) depth.set(id, d);
		for (const c of children.get(id) ?? []) queue.push([c, d + 1]);
	}
	const byDepth = new Map<number, string[]>();
	for (const n of g.nodes) {
		const d = depth.get(n.id) ?? 0;
		const list = byDepth.get(d) ?? [];
		list.push(n.id);
		byDepth.set(d, list);
	}
	const pos: Record<string, { x: number; y: number }> = {};
	for (const [d, ids] of byDepth) {
		ids.forEach((id, i) => {
			pos[id] = { x: i * 220 + 40, y: d * 160 + 20 };
		});
	}
	return pos;
}

/** State-driven colour: green ONLY when qualified (execution SUCCEEDED + assurance SATISFIED); amber when
 *  execution succeeded but assurance is not yet satisfied (the visible exec≠assurance gap); grey when not yet
 *  executed/incomplete. A baselined node gets a heavy indigo border (frozen/authoritative). */
function styleFor(n: GraphNode): string {
	let bg: string;
	if (n.qualifiedSuccess) {
		bg = 'var(--work-node-success-background)';
	} else if (n.axes.executionState === 'SUCCEEDED') {
		bg = 'var(--work-node-warning-background)';
	} else {
		bg = 'var(--work-node-neutral-background)';
	}
	let fg: string;
	if (n.qualifiedSuccess) {
		fg = 'var(--work-node-success-text)';
	} else if (n.axes.executionState === 'SUCCEEDED') {
		fg = 'var(--work-node-warning-text)';
	} else {
		fg = 'var(--work-node-neutral-text)';
	}
	const border = n.baselined
		? '3px solid var(--work-node-authoritative)'
		: '1px solid var(--work-node-border)';
	return `background:${bg};color:${fg};border:${border};border-radius:10px;padding:8px 12px;width:180px;font:12px/1.35 system-ui,sans-serif;`;
}

function labelFor(n: GraphNode): string {
	const a = n.axes;
	const green = n.qualifiedSuccess ? ' ✓' : '';
	return `${n.label}${green}\nwork: ${a.workLifecycleState}\nexec: ${a.executionState} · assure: ${a.assuranceState}`;
}

export interface FlowData {
	readonly nodes: Node[];
	readonly edges: Edge[];
	readonly openResiduals: readonly string[];
}

export function toFlow(g: DemoGraph): FlowData {
	const pos = layout(g);
	const nodes: Node[] = g.nodes.map((n) => ({
		id: n.id,
		position: pos[n.id] ?? { x: 0, y: 0 },
		data: { label: labelFor(n) },
		style: styleFor(n)
	}));
	const edges: Edge[] = g.edges.map((e) => ({
		id: `${e.from}->${e.to}`,
		source: e.from,
		target: e.to,
		label: e.relation === 'DECOMPOSES_TO' ? 'decomposes' : e.relation,
		animated: false
	}));
	return { nodes, edges, openResiduals: g.openResiduals };
}
