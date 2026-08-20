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

/** Collect a PwuProposed event's PWU id (de-duplicated) and any parent link into the shared accumulators.
 * Mutates `seen`, `pwuIds` and `edges` in place — behaviour-identical to the inline branch it replaces. */
function collectPwuProposed(
	payload: unknown,
	seen: Set<string>,
	pwuIds: string[],
	edges: GraphEdge[]
): void {
	const p = payload as { pwuId?: string; parentWorkUnitId?: string };
	if (p.pwuId && !seen.has(p.pwuId)) {
		seen.add(p.pwuId);
		pwuIds.push(p.pwuId);
	}
	if (p.pwuId && p.parentWorkUnitId) {
		edges.push({ from: p.parentWorkUnitId, to: p.pwuId, relation: 'DECOMPOSES_TO' });
	}
}

/**
 * The event whose presence WITHDRAWS a decomposition's proposed edges — REG-F-199 residue (3).
 *
 * `DecompositionProposed` records a PROPOSAL. `ValidateDecomposition { disposition: 'INVALID' }`
 * refuses it and emits `DecompositionRejected`, so those parent→child links were never part of the
 * hierarchy. Reading the proposal alone made this query return every link ever PROPOSED — a
 * SUPERSET, not the hierarchy.
 *
 * ⚠ WHY THIS KEYS ON THE EVENT AND NOT ON THE CONTRACT'S STATUS, which was the obvious fix and is
 * DEFEATED BY ONE COMMAND. `DecompositionContract.status` admits INVALID as an in-arrow to
 * SUPERSEDED (handlers/decomposition.ts:491), a revise cannot change the child set, and the
 * contract can never be re-validated (`validateDecomposition` requires UNDER_REVIEW, written only
 * at birth). So a single accepted `ReviseDecomposition` moves the contract off INVALID forever
 * while the refusal it recorded still stands — and a status-keyed guard would resurrect the
 * withdrawn edge. The event log cannot be walked back, which is exactly the property this needs;
 * `decomposition-edge-withdrawal.test.ts` drives that escape as its own test.
 */
const WITHDRAWING_DECOMPOSITION_EVENT = 'DecompositionRejected';

/** Collect a DecompositionProposed event's parent→children edges into the shared accumulator, unless
 * the proposal was subsequently REFUSED. Mutates `edges` in place. */
function collectDecompositionProposed(
	payload: unknown,
	withdrawn: boolean,
	edges: GraphEdge[]
): void {
	if (withdrawn) return;
	const p = payload as { parentWorkUnitId?: string; childWorkUnitIds?: string[] };
	for (const child of p.childWorkUnitIds ?? []) {
		if (p.parentWorkUnitId) {
			edges.push({ from: p.parentWorkUnitId, to: child, relation: 'DECOMPOSES_TO' });
		}
	}
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
	// One pass to learn which contracts were refused, because the refusal is emitted AFTER the
	// proposal it withdraws and the edge loop below reads the log in order.
	const withdrawnContracts = new Set(
		events.filter((e) => e.eventType === WITHDRAWING_DECOMPOSITION_EVENT).map((e) => e.aggregateId)
	);

	for (const e of events) {
		if (e.eventType === 'PwuProposed') {
			collectPwuProposed(e.payload, seen, pwuIds, edges);
		} else if (e.eventType === 'DecompositionProposed') {
			collectDecompositionProposed(e.payload, withdrawnContracts.has(e.aggregateId), edges);
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

	// DOC-004 §38 permits a green node only when "no blocking finding remains", so the graph has to KNOW the
	// findings. It never did: pwuGraphNode was called without them and the rule never consulted them, so an OPEN
	// BLOCKING observation could not stop a node rendering green. The events were here all along — this function
	// already reads the whole log for its edges.
	const openBySubject = new Map<string, Record<string, number>>();
	for (const event of events) {
		if (event.eventType !== 'AssuranceObservationRecorded') continue;
		const p = event.payload as {
			subjectObjectIds?: string[];
			severity?: string;
			disposition?: string;
		};
		if (p.disposition !== 'OPEN' || !p.severity) continue;
		for (const subjectId of p.subjectObjectIds ?? []) {
			const counts = openBySubject.get(subjectId) ?? {};
			counts[p.severity] = (counts[p.severity] ?? 0) + 1;
			openBySubject.set(subjectId, counts);
		}
	}

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
			s.workLifecycleState === 'BASELINED',
			openBySubject.get(id) ?? {}
		);
	});

	return { nodes, edges: scopedEdges, openResiduals: opts.openResiduals ?? [] };
}
