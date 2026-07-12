// The Work view — the PWO graph a surface renders. Each node keeps the FOUR PWU state axes DISTINCT
// (workLifecycle / execution / assurance / shapeIntegrity) and open-observation counts by severity, and
// exposes `qualifiedSuccess`: the no-green-without-assurance rule (property P1 at the projection level).
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { Projector } from './projector.js';

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
				nodes[p.pwuId] = node({
					id: p.pwuId,
					objectType: 'PROFESSIONAL_WORK_UNIT',
					title: p.title,
					workLifecycleState: 'PROPOSED',
					executionState: 'NOT_PLANNED',
					assuranceState: 'UNASSESSED',
					shapeIntegrityState: 'UNKNOWN',
					openObservationCounts: {}
				});
				break;
			}
			// Further events (state changes, observations) update the axes / counts here as later milestones
			// add their commands — the fold stays pure and extensible.
			default:
				break;
		}
		return { nodes };
	}
};
