// The UI-ready graph View seam — the pure, browser-safe read-model a client surface (e.g. the M14 Svelte Flow
// demo) renders. It turns an RPH PWU decomposition into nodes (each carrying the FOUR independent state axes +
// the no-green-without-assurance flag) and typed edges, using the same isQualifiedSuccess rule the Work
// projection uses — DOC-004 §38: green ONLY when execution SUCCEEDED, assurance SATISFIED, and no blocking
// finding remains. That last limb was absent from this seam and from the rule itself until Increment 32.
// This is the REUSABLE seam; concrete Undertaking-instance graphs (e.g. the field-service Reference Undertaking)
// are built BY the surface via pwuGraphNode() — a specific undertaking's instance data does NOT live here (it is
// not reusable-package material). Lives in rph-projections (never the Node engine facade), so a browser client
// never pulls better-sqlite3 / node:crypto.
import { isQualifiedSuccess } from './work-projection.js';

/** The four independent PWU state axes (the heart of the model). */
export interface PwuAxesView {
	readonly workLifecycleState: string;
	readonly executionState: string;
	readonly assuranceState: string;
	readonly shapeIntegrityState: string;
}

export interface GraphNode {
	readonly id: string;
	readonly label: string;
	readonly pwuKind: string;
	readonly axes: PwuAxesView;
	/** DOC-004 §38: true ONLY when execution SUCCEEDED, assurance SATISFIED, **and no blocking finding remains**.
	 *  The third limb used to be missing entirely — an OPEN BLOCKING observation could not stop a green node. */
	readonly qualifiedSuccess: boolean;
	/** Open observations against this PWU by severity — what limb 2 of §38's green rule is computed from, and
	 *  what a surface shows the reviewer instead of a bare colour. */
	readonly openObservationCounts: Readonly<Record<string, number>>;
	/** whether this PWU has been frozen into an authoritative baseline. */
	readonly baselined: boolean;
}

export interface GraphEdge {
	readonly from: string;
	readonly to: string;
	readonly relation: string;
}

export interface DemoGraph {
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly GraphEdge[];
	/** open residual conditions the UI surfaces (must stay visible — RPH-FIX-006). */
	readonly openResiduals: readonly string[];
}

/**
 * Build a UI-ready graph node, computing the qualified-success (no-green-without-assurance / INV-5) flag from the
 * execution + assurance axes. This is the one place a surface turns PWU state into a renderable node — the pure
 * seam a UI consumes to assemble any Undertaking's graph.
 */
export function pwuGraphNode(
	id: string,
	label: string,
	pwuKind: string,
	axes: PwuAxesView,
	baselined = false,
	/** Open observations against this PWU, by severity. REQUIRED-in-spirit: DOC-004 §38 permits green only when
	 *  "no blocking finding remains", so a caller that does not supply findings cannot know whether green is
	 *  legal. It defaults to `{}` = "no blocking findings" only because that matches the pre-Increment-32
	 *  behaviour of every existing caller; supply the real counts. `professional-work-graph.ts` does. */
	openObservationCounts: Readonly<Record<string, number>> = {}
): GraphNode {
	return {
		id,
		label,
		pwuKind,
		axes,
		baselined,
		openObservationCounts,
		qualifiedSuccess: isQualifiedSuccess(
			axes.executionState,
			axes.assuranceState,
			openObservationCounts
		)
	};
}
