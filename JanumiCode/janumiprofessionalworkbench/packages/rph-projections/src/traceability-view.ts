// W2-INC-3 (WP-2-006 + the W1-deferred DEF-W1-002 typed trace-link plane). The Traceability read-model: a typed
// link graph FOLDED FROM EVENTS, so it is rebuildable (RPH-PER-007) rather than an ad-hoc in-memory graph. This
// is the right home for the typed-link plane — master invariant 9 ("UI and canvas state SHALL remain derived
// presentation") + WP-2-006 ("Traceability views SHALL be derived, idempotent, and rebuildable from canonical
// state and events"). It carries NO authority; commands never validate against it.
//
// Links are extracted from the CREATE event of each object (the event that first declares the reference), so a
// rebuild folds each link exactly once. Nodes accrue as objects first appear in the stream.
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { Projector } from './projector.js';

export type TraceLinkType =
	| 'DECOMPOSES' // parent PWU -> child PWU (decomposition contract)
	| 'TRACES_TO_INTENT' // PWU -> the intent it realizes
	| 'CHILD_OF' // PWU -> its parent PWU
	| 'ASSESSES' // assurance assessment -> subject object
	| 'ABOUT' // claim -> the subject it asserts about
	| 'SUPPORTS' // evidence -> the claim it supports
	| 'OBLIGATION_OF' // obligation -> the object it derives from
	| 'AFFECTS' // assumption -> an affected object
	| 'BASELINES'; // baseline -> a frozen item object

export interface TraceLink {
	readonly from: string;
	readonly to: string;
	readonly type: TraceLinkType;
}
export interface TraceNode {
	readonly id: string;
	readonly objectType: string;
}
export interface TraceView {
	readonly nodes: Record<string, TraceNode>;
	readonly links: readonly TraceLink[];
}

/** Extract the typed links a single event's payload declares (from its create/decisive event only). */
function linksFor(event: DomainEvent): TraceLink[] {
	const p = event.payload as Record<string, unknown>;
	const links: TraceLink[] = [];
	const push = (from: string | undefined, to: string | undefined, type: TraceLinkType) => {
		if (from && to) links.push({ from, to, type });
	};
	const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
	switch (event.eventType) {
		case 'PwuProposed':
			push(p.pwuId as string, p.intentId as string, 'TRACES_TO_INTENT');
			push(p.pwuId as string, p.parentWorkUnitId as string, 'CHILD_OF');
			break;
		case 'DecompositionProposed':
			for (const child of arr(p.childWorkUnitIds))
				push(p.parentWorkUnitId as string, child, 'DECOMPOSES');
			break;
		case 'ClaimAsserted':
			for (const subject of arr(p.subjectObjectIds)) push(p.claimId as string, subject, 'ABOUT');
			break;
		case 'EvidenceProposed':
			for (const claim of arr(p.supportsClaimIds))
				push(event.aggregateId, claim, 'SUPPORTS');
			break;
		case 'AssuranceAssessmentRequested':
			for (const subject of arr(p.subjectObjectIds))
				push(p.assessmentId as string, subject, 'ASSESSES');
			break;
		case 'ObligationAsserted':
			push(p.obligationId as string, p.sourceObjectId as string, 'OBLIGATION_OF');
			break;
		case 'AssumptionDetected':
			for (const affected of arr(p.affectedObjectIds))
				push(p.assumptionId as string, affected, 'AFFECTS');
			break;
		case 'BaselinePromoted':
			for (const item of arr((p.itemObjectVersions as { objectId?: string }[] | undefined)?.map((i) => i.objectId)))
				push(p.baselineId as string, item, 'BASELINES');
			break;
		default:
			break;
	}
	return links;
}

export const traceabilityProjector: Projector<TraceView> = {
	name: 'traceability',
	handlerVersion: 1,
	initial: () => ({ nodes: {}, links: [] }),
	apply: (view, event) => {
		const nodes: Record<string, TraceNode> = { ...view.nodes };
		// Register the acting aggregate as a node the first time it appears.
		if (!nodes[event.aggregateId])
			nodes[event.aggregateId] = { id: event.aggregateId, objectType: event.aggregateType };
		const newLinks = linksFor(event);
		return { nodes, links: newLinks.length ? [...view.links, ...newLinks] : view.links };
	}
};

/** All links out of a node, by type (a small query helper for surfaces). */
export function outboundLinks(view: TraceView, from: string, type?: TraceLinkType): TraceLink[] {
	return view.links.filter((l) => l.from === from && (type === undefined || l.type === type));
}
