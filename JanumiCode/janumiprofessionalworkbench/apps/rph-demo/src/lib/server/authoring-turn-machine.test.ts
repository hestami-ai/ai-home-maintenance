import { createActor } from 'xstate';
import { getShortestPaths } from 'xstate/graph';
import { describe, expect, it } from 'vitest';
import {
	authoringTurnLifecycleIssues,
	authoringTurnMachine,
	buildAuthoringTurnLifecycleGraph,
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

	it('a store that could not take its write lock returns the draft to READY_TO_COMMIT, and only that', () => {
		const actor = createActor(authoringTurnMachine).start();
		for (const type of ['VALIDATE', 'VALID', 'ASSURANCE_OK', 'COMMIT', 'STORE_BUSY']) {
			actor.send({ type });
		}
		expect(actor.getSnapshot().value).toBe('READY_TO_COMMIT');
		actor.send({ type: 'COMMIT' });
		actor.send({ type: 'COMMIT_OK' });
		expect(actor.getSnapshot().value, 'accepting again goes through the whole commit').toBe(
			'COMMITTED'
		);
	});

	// ⭐ THE SERIALIZABLE GRAPH IS A SECOND COPY OF THE MACHINE, KEPT BY HAND — so it is checked against the machine,
	// arrow for arrow. An arrow added to one and not the other would leave the graph checks below validating a
	// lifecycle the turn does not have.
	it('the serializable lifecycle graph and the machine agree, arrow for arrow', () => {
		const states = authoringTurnMachine.config.states as Record<
			string,
			{ readonly on?: Record<string, string> }
		>;
		const fromMachine = Object.entries(states)
			.flatMap(([source, node]) =>
				Object.entries(node.on ?? {}).map(([event, target]) => `${source} --${event}--> ${target}`)
			)
			.sort();
		const fromGraph = buildAuthoringTurnLifecycleGraph()
			.edges.map((edge) => `${edge.sourceId} --${String(edge.label)}--> ${edge.targetId}`)
			.sort();
		expect(fromGraph).toEqual(fromMachine);
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
