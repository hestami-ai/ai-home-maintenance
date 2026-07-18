import { createGraph, getGraphIssues, getShortestPath } from '@statelyai/graph';
import { createMachine } from 'xstate';

export type AuthoringTurnState =
	| 'COLLECTING'
	| 'VALIDATING'
	| 'ASSURING'
	| 'READY_TO_COMMIT'
	| 'REVISION_REQUIRED'
	| 'BLOCKED_EXTERNAL'
	| 'COMMITTING'
	| 'COMMITTED'
	| 'CONFLICTED'
	| 'COMMIT_FAILED'
	| 'DISCARDED';

/**
 * Application-level lifecycle for one natural-language authoring turn. It governs an isolated candidate only;
 * the canonical PWA changes exclusively on COMMIT_OK after the guarded batch succeeds.
 */
export const authoringTurnMachine = createMachine({
	id: 'pwa-authoring-turn',
	initial: 'COLLECTING',
	states: {
		COLLECTING: { on: { VALIDATE: 'VALIDATING', DISCARD: 'DISCARDED' } },
		VALIDATING: {
			on: { VALID: 'ASSURING', INVALID: 'REVISION_REQUIRED', DISCARD: 'DISCARDED' }
		},
		ASSURING: {
			on: {
				ASSURANCE_OK: 'READY_TO_COMMIT',
				CANDIDATE_FINDINGS: 'REVISION_REQUIRED',
				EXTERNAL_BLOCK: 'BLOCKED_EXTERNAL',
				DISCARD: 'DISCARDED'
			}
		},
		READY_TO_COMMIT: { on: { COMMIT: 'COMMITTING', DISCARD: 'DISCARDED' } },
		REVISION_REQUIRED: { on: { REVISE: 'COLLECTING', DISCARD: 'DISCARDED' } },
		BLOCKED_EXTERNAL: { on: { RETRY_ASSURANCE: 'ASSURING', DISCARD: 'DISCARDED' } },
		COMMITTING: {
			on: { COMMIT_OK: 'COMMITTED', CONFLICT: 'CONFLICTED', COMMIT_ERROR: 'COMMIT_FAILED' }
		},
		CONFLICTED: { on: { DISCARD: 'DISCARDED' } },
		// A transport/process failure cannot distinguish "definitely not committed" from unknown success without a
		// durable change-set receipt. Do not expose blind retry; inspect/reconcile or discard this in-process candidate.
		COMMIT_FAILED: { on: { DISCARD: 'DISCARDED' } },
		COMMITTED: { type: 'final' },
		DISCARDED: { type: 'final' }
	}
});

const TRANSITIONS = [
	['COLLECTING', 'VALIDATING', 'VALIDATE'],
	['COLLECTING', 'DISCARDED', 'DISCARD'],
	['VALIDATING', 'ASSURING', 'VALID'],
	['VALIDATING', 'REVISION_REQUIRED', 'INVALID'],
	['VALIDATING', 'DISCARDED', 'DISCARD'],
	['ASSURING', 'READY_TO_COMMIT', 'ASSURANCE_OK'],
	['ASSURING', 'REVISION_REQUIRED', 'CANDIDATE_FINDINGS'],
	['ASSURING', 'BLOCKED_EXTERNAL', 'EXTERNAL_BLOCK'],
	['ASSURING', 'DISCARDED', 'DISCARD'],
	['READY_TO_COMMIT', 'COMMITTING', 'COMMIT'],
	['READY_TO_COMMIT', 'DISCARDED', 'DISCARD'],
	['REVISION_REQUIRED', 'COLLECTING', 'REVISE'],
	['REVISION_REQUIRED', 'DISCARDED', 'DISCARD'],
	['BLOCKED_EXTERNAL', 'ASSURING', 'RETRY_ASSURANCE'],
	['BLOCKED_EXTERNAL', 'DISCARDED', 'DISCARD'],
	['COMMITTING', 'COMMITTED', 'COMMIT_OK'],
	['COMMITTING', 'CONFLICTED', 'CONFLICT'],
	['COMMITTING', 'COMMIT_FAILED', 'COMMIT_ERROR'],
	['CONFLICTED', 'DISCARDED', 'DISCARD'],
	['COMMIT_FAILED', 'DISCARDED', 'DISCARD']
] as const satisfies readonly (readonly [AuthoringTurnState, AuthoringTurnState, string])[];

/** Serializable lifecycle graph for inspection, visualization and graph-algorithm coverage. */
export function buildAuthoringTurnLifecycleGraph() {
	const states = [...new Set(TRANSITIONS.flatMap(([source, target]) => [source, target]))];
	return createGraph({
		nodes: states.map((id) => ({ id, label: id.replaceAll('_', ' ') })),
		edges: TRANSITIONS.map(([sourceId, targetId, event], index) => ({
			id: `turn-transition-${index + 1}`,
			sourceId,
			targetId,
			label: event
		}))
	});
}

/** Fail-loud structural check used by tests and diagnostics. */
export function authoringTurnLifecycleIssues(): string[] {
	return getGraphIssues(buildAuthoringTurnLifecycleGraph()).map((issue) => issue.message);
}

/** Shortest lifecycle path, provided by @statelyai/graph over the same serializable state graph. */
export function authoringTurnPath(to: AuthoringTurnState): string[] {
	const path = getShortestPath(buildAuthoringTurnLifecycleGraph(), { from: 'COLLECTING', to });
	return path ? [path.source.id, ...path.steps.map((step) => step.node.id)] : [];
}
