import { createActor } from 'xstate';
import { getShortestPaths } from 'xstate/graph';
import { describe, expect, it } from 'vitest';
import {
	authoringTurnLifecycleIssues,
	authoringTurnMachine,
	authoringTurnPath,
	type AuthoringTurnState
} from './authoring-turn-machine.js';

describe('authoring-turn lifecycle', () => {
	it('commits only through validate, assure and guarded commit', () => {
		const actor = createActor(authoringTurnMachine).start();
		for (const type of ['VALIDATE', 'VALID', 'ASSURANCE_OK', 'COMMIT', 'COMMIT_OK']) {
			actor.send({ type });
		}
		expect(actor.getSnapshot().value).toBe('COMMITTED');
	});

	it('routes external assurance failure without pretending it is a candidate defect', () => {
		const actor = createActor(authoringTurnMachine).start();
		for (const type of ['VALIDATE', 'VALID', 'EXTERNAL_BLOCK']) actor.send({ type });
		expect(actor.getSnapshot().value).toBe('BLOCKED_EXTERNAL');
		actor.send({ type: 'RETRY_ASSURANCE' });
		expect(actor.getSnapshot().value).toBe('ASSURING');
	});

	it('@statelyai/graph validates the serializable lifecycle and reaches every terminal/error state', () => {
		expect(authoringTurnLifecycleIssues()).toEqual([]);
		for (const state of [
			'COMMITTED',
			'DISCARDED',
			'REVISION_REQUIRED',
			'BLOCKED_EXTERNAL',
			'CONFLICTED',
			'COMMIT_FAILED'
		] satisfies AuthoringTurnState[]) {
			expect(authoringTurnPath(state).at(0)).toBe('COLLECTING');
			expect(authoringTurnPath(state).at(-1)).toBe(state);
		}
	});

	it('xstate/graph generates executable coverage for every reachable machine state', () => {
		const paths = getShortestPaths(authoringTurnMachine);
		const states = new Set(paths.map((path) => String(path.state.value)));
		for (const state of [
			'COLLECTING',
			'VALIDATING',
			'ASSURING',
			'READY_TO_COMMIT',
			'REVISION_REQUIRED',
			'BLOCKED_EXTERNAL',
			'COMMITTING',
			'COMMITTED',
			'CONFLICTED',
			'COMMIT_FAILED',
			'DISCARDED'
		] satisfies AuthoringTurnState[]) {
			expect(states.has(state), `${state} should be reachable`).toBe(true);
		}
	});
});
