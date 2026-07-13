// professionalWorkGraph — the read-model query that turns the LIVE engine state into the UI-ready Professional
// Work Graph (the pure DemoGraph the Svelte Flow surface renders). It is a QUERY over current authoritative
// state: it collects the PWU set + decomposition edges from the append-only event log (PwuProposed carries the
// parent link; DecompositionProposed carries parent→children), then reads each PWU's CURRENT four-axis state via
// loadObject and builds each node through the pure pwuGraphNode() seam (which computes the no-green-without-
// assurance / INV-5 flag). Nothing here mutates state; projections are never authoritative.
import {
	pwuGraphNode,
	type DemoGraph,
	type GraphEdge,
	type GraphNode
} from '@janumipwb/rph-projections';
import type { EngineHandle } from './engine.js';

interface PwuState {
	readonly title?: string;
	readonly pwuKind?: string;
	readonly parentWorkUnitId?: string;
	readonly workLifecycleState?: string;
	readonly executionState?: string;
	readonly assuranceState?: string;
	readonly shapeIntegrityState?: string;
}

/** Build the Professional Work Graph View for an Undertaking's current state from the live engine. Pass
 * `undertakingId` to scope the graph to one Undertaking's PWUs (CON-009 ownership). */
export function professionalWorkGraph(
	handle: EngineHandle,
	opts: { readonly openResiduals?: readonly string[]; readonly undertakingId?: string } = {}
): DemoGraph {
	const events = handle.readAllEvents();
	const pwuIds: string[] = [];
	const edges: GraphEdge[] = [];
	const seen = new Set<string>();

	for (const e of events) {
		if (e.eventType === 'PwuProposed') {
			const p = e.payload as { pwuId?: string; parentWorkUnitId?: string };
			if (p.pwuId && !seen.has(p.pwuId)) {
				seen.add(p.pwuId);
				pwuIds.push(p.pwuId);
			}
			if (p.pwuId && p.parentWorkUnitId) {
				edges.push({ from: p.parentWorkUnitId, to: p.pwuId, relation: 'DECOMPOSES_TO' });
			}
		} else if (e.eventType === 'DecompositionProposed') {
			const p = e.payload as { parentWorkUnitId?: string; childWorkUnitIds?: string[] };
			for (const child of p.childWorkUnitIds ?? []) {
				if (p.parentWorkUnitId) {
					edges.push({ from: p.parentWorkUnitId, to: child, relation: 'DECOMPOSES_TO' });
				}
			}
		}
	}

	// De-duplicate edges (a parent link can be recorded both on PwuProposed and DecompositionProposed).
	const edgeKey = (x: GraphEdge) => `${x.from}->${x.to}:${x.relation}`;
	const uniqueEdges = [...new Map(edges.map((x) => [edgeKey(x), x])).values()];

	const scopedPwuIds = opts.undertakingId
		? pwuIds.filter((id) => {
				const s = handle.loadObject(id)?.state as { undertakingId?: string } | undefined;
				return s?.undertakingId === opts.undertakingId;
			})
		: pwuIds;
	const keep = new Set(scopedPwuIds);
	const scopedEdges = opts.undertakingId
		? uniqueEdges.filter((e) => keep.has(e.from) && keep.has(e.to))
		: uniqueEdges;

	const nodes: GraphNode[] = scopedPwuIds.map((id) => {
		const s = (handle.loadObject(id)?.state ?? {}) as PwuState;
		return pwuGraphNode(
			id,
			s.title ?? id,
			s.pwuKind ?? 'PWU',
			{
				workLifecycleState: s.workLifecycleState ?? 'PROPOSED',
				executionState: s.executionState ?? 'NOT_PLANNED',
				assuranceState: s.assuranceState ?? 'UNASSESSED',
				shapeIntegrityState: s.shapeIntegrityState ?? 'UNKNOWN'
			},
			s.workLifecycleState === 'BASELINED'
		);
	});

	return { nodes, edges: scopedEdges, openResiduals: opts.openResiduals ?? [] };
}
