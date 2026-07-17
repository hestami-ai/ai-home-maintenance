// The Work view — the PWO graph a surface renders. Each node keeps the FOUR PWU state axes DISTINCT
// (workLifecycle / execution / assurance / shapeIntegrity) and open-observation counts by severity, and
// exposes `qualifiedSuccess`: the no-green-without-assurance rule (property P1 at the projection level).
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { Projector } from './projector.js';
import { applyPwuAxisEvent } from './pwu-replay.js';

/** Severities that BLOCK a green node while an observation carrying them is still open. DOC-004 §9 severity
 *  vocabulary; CRITICAL is included because a severity above BLOCKING cannot be less disqualifying than it. */
const BLOCKING_SEVERITIES: ReadonlySet<string> = new Set(['BLOCKING', 'CRITICAL']);

/** Observation dispositions that mean the finding is STILL OPEN. §18.1: "Assurance observations must remain
 *  visible after remediation" — so REMEDIATED is visible but no longer open; only OPEN blocks. */
const OPEN_DISPOSITIONS: ReadonlySet<string> = new Set(['OPEN']);

/**
 * THE GREEN-NODE RULE, as DOC-004 §38 ratifies it:
 *
 *   "A green node may be displayed only when:
 *      * required assurance is satisfied;
 *      * no blocking finding remains;
 *      * required conditions are explicit."
 *
 * This function used to implement the FIRST LIMB ONLY — `executionState === 'SUCCEEDED' && assuranceState ===
 * 'SATISFIED'` — and nothing else. It never consulted findings at all, so a PWU carrying an OPEN BLOCKING
 * observation rendered green if its assurance axis said SATISFIED. And `WorkNode.openObservationCounts`, the
 * field whose entire purpose is this check, was ALWAYS `{}`: nothing folded AssuranceObservationRecorded. The
 * data structure anticipated the ratified rule; the fold and the rule both ignored it.
 *
 * A false green is the one thing this system must never produce. Both callers (this view and graph-view) get
 * the complete rule now.
 *
 * THE THIRD LIMB IS NOT IMPLEMENTED, deliberately. "Required conditions are explicit" governs the
 * CONDITIONALLY_SATISFIED case, and green already requires SATISFIED — so it cannot currently admit a false
 * green here. Implementing it would mean deciding what "explicit" means, which is a modelling judgement and not
 * mine to invent. Recorded in HARMONIZATION-LOG rather than guessed at.
 */
export function isQualifiedSuccess(
	executionState: string | undefined,
	assuranceState: string | undefined,
	openObservationCounts: Readonly<Record<string, number>> = {}
): boolean {
	if (executionState !== 'SUCCEEDED' || assuranceState !== 'SATISFIED') return false;
	// Limb 2 — "no blocking finding remains".
	for (const severity of BLOCKING_SEVERITIES) {
		if ((openObservationCounts[severity] ?? 0) > 0) return false;
	}
	return true;
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
		qualifiedSuccess: isQualifiedSuccess(
			partial.executionState,
			partial.assuranceState,
			partial.openObservationCounts
		)
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
			// THE FINDINGS. DOC-004 §38 permits a green node only when "no blocking finding remains", and
			// WorkNode.openObservationCounts exists for exactly that check — and was ALWAYS `{}`, because nothing
			// folded this event. The field anticipated the ratified rule; the fold never arrived. An observation
			// is counted against every subject it names, by severity, while its disposition is OPEN (§18.1:
			// observations "must remain visible after remediation", so REMEDIATED stays in the log but stops
			// blocking).
			case 'AssuranceObservationRecorded': {
				const p = event.payload as {
					subjectObjectIds?: string[];
					severity?: string;
					disposition?: string;
				};
				if (!OPEN_DISPOSITIONS.has(p.disposition ?? '')) break;
				const severity = p.severity;
				if (!severity) break;
				for (const subjectId of p.subjectObjectIds ?? []) {
					const subject = nodes[subjectId];
					if (!subject) continue;
					const counts = {
						...subject.openObservationCounts,
						[severity]: (subject.openObservationCounts[severity] ?? 0) + 1
					};
					nodes[subjectId] = node({ ...subject, openObservationCounts: counts });
				}
				break;
			}
			default: {
				const existing = nodes[event.aggregateId];
				if (existing?.objectType !== 'PROFESSIONAL_WORK_UNIT') break;
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
