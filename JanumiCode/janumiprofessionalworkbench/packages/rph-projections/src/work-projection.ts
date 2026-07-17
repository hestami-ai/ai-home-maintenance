// The Work view — the PWO graph a surface renders. Each node keeps the FOUR PWU state axes DISTINCT
// (workLifecycle / execution / assurance / shapeIntegrity) and open-observation counts by severity, and
// exposes `qualifiedSuccess`: the no-green-without-assurance rule (property P1 at the projection level).
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { Projector } from './projector.js';
import { applyPwuAxisEvent } from './pwu-replay.js';

/**
 * The load-bearing green-node rule: a node may show an UNQUALIFIED success indicator ONLY when execution
 * SUCCEEDED **and** assurance SATISFIED. A SUCCEEDED execution alone is never "green" (property P1 / INV-5).
 */
export function isQualifiedSuccess(
	executionState: string | undefined,
	assuranceState: string | undefined
): boolean {
	return executionState === 'SUCCEEDED' && assuranceState === 'SATISFIED';
}

export interface WorkNode {
	readonly id: string;
	readonly objectType: string;
	readonly title?: string;
	readonly workLifecycleState?: string;
	readonly executionState?: string;
	readonly assuranceState?: string;
	readonly shapeIntegrityState?: string;
	readonly intentStatus?: string;
	readonly openObservationCounts: Readonly<Record<string, number>>;
	readonly qualifiedSuccess: boolean;
}

export interface WorkView {
	readonly nodes: Readonly<Record<string, WorkNode>>;
}

function node(partial: Omit<WorkNode, 'qualifiedSuccess'>): WorkNode {
	return {
		...partial,
		qualifiedSuccess: isQualifiedSuccess(partial.executionState, partial.assuranceState)
	};
}

export const workProjector: Projector<WorkView> = {
	name: 'work',
	handlerVersion: 1,
	initial: () => ({ nodes: {} }),
	apply: (view, event: DomainEvent): WorkView => {
		const nodes: Record<string, WorkNode> = { ...view.nodes };
		switch (event.eventType) {
			case 'IntentCaptured': {
				const p = event.payload as { intentId: string; originatingExpression?: string };
				nodes[p.intentId] = node({
					id: p.intentId,
					objectType: 'INTENT',
					title: p.originatingExpression,
					intentStatus: 'RAW',
					openObservationCounts: {}
				});
				break;
			}
			case 'PwuProposed': {
				const p = event.payload as { pwuId: string; title?: string };
				// The axes are READ FROM THE EVENT by applyPwuAxisEvent, not assumed here. They used to be
				// hardcoded PROPOSED/NOT_PLANNED/UNASSESSED/UNKNOWN — right for a freshly proposed PWU, and a
				// lie the moment §11.3's payload says anything else.
				const axes = applyPwuAxisEvent(undefined, event);
				if (!axes) break;
				nodes[p.pwuId] = node({
					id: p.pwuId,
					objectType: 'PROFESSIONAL_WORK_UNIT',
					title: p.title,
					...axes,
					openObservationCounts: {}
				});
				break;
			}
			// EVERY OTHER PWU EVENT. This used to be `default: break` with a comment promising that "further
			// events (state changes, observations) update the axes / counts here as later milestones add their
			// commands". The milestones came; the fold never followed. Rebuilt over the reference undertaking's
			// 251 events this view reported every PWU as PROPOSED/NOT_PLANNED/UNASSESSED while the objects were
			// BASELINED/SUCCEEDED/SATISFIED — a read model that surfaces render, wrong for every PWU that had
			// ever done anything. Its RPH-PER-007 test was green throughout, because it compared the fold to
			// ITSELF: a broken fold equals a broken fold.
			default: {
				const existing = nodes[event.aggregateId];
				if (!existing || existing.objectType !== 'PROFESSIONAL_WORK_UNIT') break;
				const next = applyPwuAxisEvent(
					{
						workLifecycleState: existing.workLifecycleState ?? '',
						executionState: existing.executionState ?? '',
						assuranceState: existing.assuranceState ?? '',
						shapeIntegrityState: existing.shapeIntegrityState ?? ''
					},
					event
				);
				if (!next) break;
				nodes[event.aggregateId] = node({
					id: existing.id,
					objectType: existing.objectType,
					...(existing.title === undefined ? {} : { title: existing.title }),
					...next,
					openObservationCounts: existing.openObservationCounts
				});
				break;
			}
		}
		return { nodes };
	}
};
