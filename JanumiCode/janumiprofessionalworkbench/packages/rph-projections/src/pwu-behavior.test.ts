import { describe, expect, it } from 'vitest';
import { getMachine } from '@janumipwb/rph-domain';
import {
	buildPwuBehaviorProjection,
	PWU_BEHAVIOR_SIMULATION_EVENT_PREFIX,
	PWU_BEHAVIOR_SOURCE_MACHINE
} from './pwu-behavior.js';

describe('PWU behavior projection', () => {
	it('is a lossless structural projection of the generated work-lifecycle machine', () => {
		const source = getMachine(PWU_BEHAVIOR_SOURCE_MACHINE);
		const projection = buildPwuBehaviorProjection();

		expect(projection).toMatchObject({
			projectionType: 'PWU_BEHAVIOR',
			projectionVersion: 1,
			authority: 'DERIVED_NON_AUTHORITATIVE',
			scope: 'WORK_LIFECYCLE_TOPOLOGY',
			sourceMachine: PWU_BEHAVIOR_SOURCE_MACHINE,
			initialState: source.initialState
		});
		expect(projection.states.map((state) => state.id)).toEqual(source.states);
		expect(projection.states.filter((state) => state.initial).map((state) => state.id)).toEqual([
			source.initialState
		]);
		expect(projection.states.filter((state) => state.terminal).map((state) => state.id)).toEqual(
			source.terminalStates
		);
		expect(projection.transitions.map(({ from, to }) => ({ from, to }))).toEqual(
			source.transitions.map(({ from, to }) => ({ from, to }))
		);
	});

	it('gives every transition a unique simulation-only identity', () => {
		const projection = buildPwuBehaviorProjection();
		const ids = projection.transitions.map((transition) => transition.id);
		const eventTypes = projection.transitions.map((transition) => transition.simulationEventType);

		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(eventTypes).size).toBe(eventTypes.length);
		expect(
			projection.transitions.every((transition) =>
				transition.simulationEventType.startsWith(`${PWU_BEHAVIOR_SIMULATION_EVENT_PREFIX}.`)
			)
		).toBe(true);
		expect(
			projection.transitions.every((transition) => transition.requiresAuthoritativeCommand)
		).toBe(true);
	});

	it('preserves trigger and guard prose only as explanatory annotations', () => {
		const source = getMachine(PWU_BEHAVIOR_SOURCE_MACHINE);
		const projection = buildPwuBehaviorProjection();

		expect(
			projection.transitions.map(({ triggerDescription, guardDescription }) => ({
				trigger: triggerDescription,
				guard: guardDescription
			}))
		).toEqual(
			source.transitions.map(({ trigger, guard }) => ({
				trigger,
				guard
			}))
		);
	});
});
