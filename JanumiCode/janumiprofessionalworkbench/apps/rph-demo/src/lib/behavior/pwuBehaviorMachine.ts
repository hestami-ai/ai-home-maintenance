// Browser-safe XState adapter for the derived PWU lifecycle topology. The resulting actor is a local simulator:
// it does not evaluate authoritative guards, dispatch Commands, persist snapshots, or mutate professional state.
import { createMachine } from 'xstate';
import type {
	PwuBehaviorProjection,
	PwuBehaviorSimulationEventType
} from '@janumipwb/rph-projections';

export interface PwuBehaviorSimulationEvent {
	readonly type: PwuBehaviorSimulationEventType;
}

type SimulationStateConfig = {
	type?: 'final';
	on?: Record<string, { target: string }>;
};

function validateProjection(behavior: PwuBehaviorProjection): void {
	const stateIds = new Set(behavior.states.map((state) => state.id));
	if (stateIds.size !== behavior.states.length) {
		throw new Error('Cannot compile PWU behavior simulation: duplicate state id');
	}
	if (!stateIds.has(behavior.initialState)) {
		throw new Error(
			`Cannot compile PWU behavior simulation: initial state '${behavior.initialState}' is not declared`
		);
	}

	const transitionIds = new Set<string>();
	const eventTypes = new Set<string>();
	const terminalStates = new Set(
		behavior.states.filter((state) => state.terminal).map((state) => state.id)
	);
	for (const transition of behavior.transitions) {
		if (!stateIds.has(transition.from) || !stateIds.has(transition.to)) {
			throw new Error(
				`Cannot compile PWU behavior simulation: transition '${transition.id}' references an undeclared state`
			);
		}
		if (terminalStates.has(transition.from)) {
			throw new Error(
				`Cannot compile PWU behavior simulation: terminal state '${transition.from}' has an outgoing transition`
			);
		}
		if (transitionIds.has(transition.id)) {
			throw new Error(
				`Cannot compile PWU behavior simulation: duplicate transition id '${transition.id}'`
			);
		}
		if (eventTypes.has(transition.simulationEventType)) {
			throw new Error(
				`Cannot compile PWU behavior simulation: duplicate event type '${transition.simulationEventType}'`
			);
		}
		transitionIds.add(transition.id);
		eventTypes.add(transition.simulationEventType);
	}
}

/** Compile a bounded, topology-only XState v5 machine for local inspection and simulation. */
export function compilePwuBehaviorMachine(behavior: PwuBehaviorProjection) {
	validateProjection(behavior);

	const states: Record<string, SimulationStateConfig> = {};
	for (const state of behavior.states) {
		if (state.terminal) {
			states[state.id] = { type: 'final' };
			continue;
		}

		const outgoing = behavior.transitions.filter((transition) => transition.from === state.id);
		states[state.id] = {
			on: Object.fromEntries(
				outgoing.map((transition) => [transition.simulationEventType, { target: transition.to }])
			)
		};
	}

	return createMachine({
		types: {} as { events: PwuBehaviorSimulationEvent },
		id: 'janumi.pwu.work-lifecycle.simulation',
		initial: behavior.initialState,
		states
	});
}
