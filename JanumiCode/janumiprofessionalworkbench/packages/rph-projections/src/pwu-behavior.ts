// Derived, non-authoritative behavioral topology for the canonical PWU work-lifecycle axis. This is a
// projection of the generated domain transition table: it is not a PwuBehavior contract, aggregate, command
// surface, execution plan, or source of transition authority.
import { WorkLifecycleStateSchema, type WorkLifecycleState } from '@janumipwb/rph-contracts';
import { getMachine } from '@janumipwb/rph-domain';

export const PWU_BEHAVIOR_SOURCE_MACHINE = 'PWU.workLifecycleState' as const;
export const PWU_BEHAVIOR_SIMULATION_EVENT_PREFIX = 'SIMULATE.PWU' as const;

export type PwuBehaviorTransitionId = `${WorkLifecycleState}__${WorkLifecycleState}`;
export type PwuBehaviorSimulationEventType =
	`${typeof PWU_BEHAVIOR_SIMULATION_EVENT_PREFIX}.${WorkLifecycleState}.${WorkLifecycleState}`;

export interface PwuBehaviorStateProjection {
	readonly id: WorkLifecycleState;
	readonly initial: boolean;
	readonly terminal: boolean;
}

export interface PwuBehaviorTransitionProjection {
	readonly id: PwuBehaviorTransitionId;
	readonly from: WorkLifecycleState;
	readonly to: WorkLifecycleState;
	/** Projection-local event used only by the browser simulator. It is never a domain Command or Event. */
	readonly simulationEventType: PwuBehaviorSimulationEventType;
	/** Source-table annotation for people; never interpreted as a command/event identifier. */
	readonly triggerDescription?: string;
	/** Source-table annotation for people; never compiled into an executable guard. */
	readonly guardDescription?: string;
	/** Every real transition must still pass through the authoritative command pipeline. */
	readonly requiresAuthoritativeCommand: true;
}

export interface PwuBehaviorProjection {
	readonly projectionType: 'PWU_BEHAVIOR';
	readonly projectionVersion: 1;
	readonly authority: 'DERIVED_NON_AUTHORITATIVE';
	readonly scope: 'WORK_LIFECYCLE_TOPOLOGY';
	readonly sourceMachine: typeof PWU_BEHAVIOR_SOURCE_MACHINE;
	readonly initialState: WorkLifecycleState;
	readonly states: readonly PwuBehaviorStateProjection[];
	readonly transitions: readonly PwuBehaviorTransitionProjection[];
}

function parseState(value: string, location: string): WorkLifecycleState {
	const parsed = WorkLifecycleStateSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`Cannot build PWU behavior projection: ${location} contains unknown work-lifecycle state '${value}'`
		);
	}
	return parsed.data;
}

/**
 * Project the generated PWU work-lifecycle machine into a small, JSON-safe behavioral topology.
 *
 * Trigger and guard prose is preserved only as explanatory metadata. The projection does not decide whether a
 * transition is currently eligible and cannot authorize or perform a canonical mutation.
 */
export function buildPwuBehaviorProjection(): PwuBehaviorProjection {
	const machine = getMachine(PWU_BEHAVIOR_SOURCE_MACHINE);
	if (machine.initialState === undefined) {
		throw new Error(
			`Cannot build PWU behavior projection: ${PWU_BEHAVIOR_SOURCE_MACHINE} has no initial state`
		);
	}

	const initialState = parseState(machine.initialState, 'initialState');
	const stateIds = machine.states.map((state, index) => parseState(state, `states[${index}]`));
	const declaredStates = new Set<WorkLifecycleState>(stateIds);
	if (!declaredStates.has(initialState)) {
		throw new Error(
			`Cannot build PWU behavior projection: initial state '${initialState}' is not declared by ${PWU_BEHAVIOR_SOURCE_MACHINE}`
		);
	}

	const terminalStates = new Set<WorkLifecycleState>(
		machine.terminalStates.map((state, index) => parseState(state, `terminalStates[${index}]`))
	);
	for (const terminal of terminalStates) {
		if (!declaredStates.has(terminal)) {
			throw new Error(
				`Cannot build PWU behavior projection: terminal state '${terminal}' is not declared by ${PWU_BEHAVIOR_SOURCE_MACHINE}`
			);
		}
	}

	const transitionIds = new Set<PwuBehaviorTransitionId>();
	const transitions = machine.transitions.map(
		(transition, index): PwuBehaviorTransitionProjection => {
			const from = parseState(transition.from, `transitions[${index}].from`);
			const to = parseState(transition.to, `transitions[${index}].to`);
			if (!declaredStates.has(from) || !declaredStates.has(to)) {
				throw new Error(
					`Cannot build PWU behavior projection: transition ${from} -> ${to} references an undeclared state`
				);
			}
			if (terminalStates.has(from)) {
				throw new Error(
					`Cannot build PWU behavior projection: terminal state '${from}' has an outgoing transition to '${to}'`
				);
			}

			const id: PwuBehaviorTransitionId = `${from}__${to}`;
			if (transitionIds.has(id)) {
				throw new Error(
					`Cannot build PWU behavior projection: duplicate transition identity '${id}'`
				);
			}
			transitionIds.add(id);

			return {
				id,
				from,
				to,
				simulationEventType: `${PWU_BEHAVIOR_SIMULATION_EVENT_PREFIX}.${from}.${to}`,
				...(transition.trigger === undefined ? {} : { triggerDescription: transition.trigger }),
				...(transition.guard === undefined ? {} : { guardDescription: transition.guard }),
				requiresAuthoritativeCommand: true
			};
		}
	);

	return {
		projectionType: 'PWU_BEHAVIOR',
		projectionVersion: 1,
		authority: 'DERIVED_NON_AUTHORITATIVE',
		scope: 'WORK_LIFECYCLE_TOPOLOGY',
		sourceMachine: PWU_BEHAVIOR_SOURCE_MACHINE,
		initialState,
		states: stateIds.map((id) => ({
			id,
			initial: id === initialState,
			terminal: terminalStates.has(id)
		})),
		transitions
	};
}
