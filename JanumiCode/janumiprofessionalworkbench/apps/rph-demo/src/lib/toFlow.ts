// Adapter: the rph-projections DemoGraph -> Svelte Flow nodes/edges. This is the whole integration surface — the UI
// reads ONLY the engine's public graph-view seam and adds layout + state-driven styling. The engine never renders.
import { buildReferenceUndertakingGraph } from './referenceUndertakingGraph.js';
import type { GraphNode } from '@janumipwb/rph-projections';
import type { Node, Edge } from '@xyflow/svelte';

// A simple hand-laid layered layout for the 9 Reference-Undertaking PWUs (root -> intent/behavior/arch -> concerns).
const POSITIONS: Record<string, { x: number; y: number }> = {
	pwu_fsm_root: { x: 460, y: 20 },
	pwu_fsm_intent: { x: 120, y: 160 },
	pwu_fsm_behavior: { x: 420, y: 160 },
	pwu_fsm_arch: { x: 760, y: 160 },
	pwu_fsm_arch_context: { x: 340, y: 320 },
	pwu_fsm_arch_multitenancy: { x: 540, y: 320 },
	pwu_fsm_arch_data: { x: 740, y: 320 },
	pwu_fsm_arch_integrations: { x: 940, y: 320 },
	pwu_fsm_arch_mobile: { x: 1140, y: 320 }
};

/** State-driven colour: green ONLY when qualified (execution SUCCEEDED + assurance SATISFIED); amber when
 *  execution succeeded but assurance is not yet satisfied (the visible exec≠assurance gap); grey when not yet
 *  executed/incomplete. A baselined node gets a heavy indigo border (frozen/authoritative). */
function styleFor(n: GraphNode): string {
	const bg = n.qualifiedSuccess
		? '#e6f4ea'
		: n.axes.executionState === 'SUCCEEDED'
			? '#fdf2e3'
			: '#eef0f2';
	const fg = n.qualifiedSuccess
		? '#137333'
		: n.axes.executionState === 'SUCCEEDED'
			? '#8a5a00'
			: '#5f6368';
	const border = n.baselined ? '3px solid #3730a3' : '1px solid #c7ccd1';
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

export function toFlow(): FlowData {
	const g = buildReferenceUndertakingGraph();
	const nodes: Node[] = g.nodes.map((n) => ({
		id: n.id,
		position: POSITIONS[n.id] ?? { x: 0, y: 0 },
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
