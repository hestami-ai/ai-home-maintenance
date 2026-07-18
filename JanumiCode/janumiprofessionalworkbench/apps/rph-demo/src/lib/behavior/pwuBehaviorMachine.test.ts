import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { getShortestPaths, toDirectedGraph } from 'xstate/graph';
import { buildPwuBehaviorProjection } from '@janumipwb/rph-projections';
import { compilePwuBehaviorMachine } from './pwuBehaviorMachine.js';

const behavior = buildPwuBehaviorProjection();

function graphEdges(machine: ReturnType<typeof compilePwuBehaviorMachine>) {
	return toDirectedGraph(machine).children.flatMap((node) =>
		node.edges.map((edge) => ({
			from: edge.source.key,
			to: edge.target.key,
			eventType: edge.transition.eventType,
			guard: edge.transition.guard,
			actions: edge.transition.actions
		}))
	);
}

describe('PWU behavior XState simulation compiler', () => {
	it('starts at the projected initial state and follows a simulation event', () => {
		const machine = compilePwuBehaviorMachine(behavior);
		const actor = createActor(machine).start();
		const transition = behavior.transitions.find(
			(candidate) => candidate.from === 'PROPOSED' && candidate.to === 'SHAPING'
		);
		expect(transition).toBeDefined();
		expect(actor.getSnapshot().value).toBe('PROPOSED');

		actor.send({ type: transition!.simulationEventType });

		expect(actor.getSnapshot().value).toBe('SHAPING');
		actor.stop();
	});

	it('compiles every projected edge without executable guards or actions', () => {
		const edges = graphEdges(compilePwuBehaviorMachine(behavior));
		const actual = edges
			.map(({ from, to, eventType }) => ({ from, to, eventType }))
			.sort((a, b) => a.eventType.localeCompare(b.eventType));
		const expected = behavior.transitions
			.map((transition) => ({
				from: transition.from,
				to: transition.to,
				eventType: transition.simulationEventType
			}))
			.sort((a, b) => a.eventType.localeCompare(b.eventType));

		expect(actual).toEqual(expected);
		expect(edges.every((edge) => edge.guard === undefined)).toBe(true);
		expect(edges.every((edge) => edge.actions.length === 0)).toBe(true);
	});

	it('uses xstate/graph to reach every projected state', () => {
		const machine = compilePwuBehaviorMachine(behavior);
		const reachable = new Set(getShortestPaths(machine).map((path) => String(path.state.value)));

		expect([...reachable].sort()).toEqual(behavior.states.map((state) => state.id).sort());
	});

	it('treats projected terminal states as completed XState runs', () => {
		const machine = compilePwuBehaviorMachine(behavior);
		const terminal = behavior.states.find((state) => state.id === 'BASELINED');
		const path = getShortestPaths(machine).find(
			(candidate) => candidate.state.value === terminal?.id
		);
		expect(path).toBeDefined();

		const actor = createActor(machine).start();
		// The runtime path includes its synthetic initialization step first; replay only modeled events.
		for (const step of path!.steps.slice(1)) actor.send(step.event);

		expect(actor.getSnapshot().value).toBe('BASELINED');
		expect(actor.getSnapshot().status).toBe('done');
		actor.stop();
	});
});
