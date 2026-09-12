import type {
	StateMachineGraphEdge,
	StateMachineGraphEdgeId,
	StateMachineGraphEndpoint,
	StateMachineGraphId,
	StateMachineGraphLayer,
	StateMachineGraphLayerId,
	StateMachineGraphNodeId,
	StateMachineTopologyArtifactBinding,
	StateMachineTopologyCrossAxisRuleId,
	StateMachineTopologyMachineId,
	StateMachineTopologyObservationId,
	StateMachineTopologyStateId,
	StateMachineTopologyTransitionId
} from '../contracts/state-machine-graph.js';
import type { SemanticSnapshotId } from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const STATE_MACHINE_ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${STATE_MACHINE_ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export interface StateMachineTopologyObservationIdentityInput {
	readonly artifact: StateMachineTopologyArtifactBinding;
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export const stateMachineTopologyObservationId = (
	input: StateMachineTopologyObservationIdentityInput
): StateMachineTopologyObservationId =>
	identity<StateMachineTopologyObservationId>(
		'observation:state-machine-topology',
		'JAN-CSAA-JPWB-STATE-MACHINE-TOPOLOGY-OBSERVATION',
		input
	);

export const stateMachineTopologyMachineId = (
	observationId: StateMachineTopologyObservationId,
	name: string
): StateMachineTopologyMachineId =>
	identity<StateMachineTopologyMachineId>('sm-machine', 'JAN-CSAA-JPWB-STATE-MACHINE', {
		name,
		observationId
	});

export const stateMachineTopologyStateId = (
	machineId: StateMachineTopologyMachineId,
	name: string
): StateMachineTopologyStateId =>
	identity<StateMachineTopologyStateId>('sm-state', 'JAN-CSAA-JPWB-STATE-MACHINE-STATE', {
		machineId,
		name
	});

interface TransitionIdentityInput {
	readonly from: string;
	readonly machineId: StateMachineTopologyMachineId;
	readonly ordinal: number;
	readonly to: string;
}

export const stateMachineTopologyLegalTransitionId = (
	input: TransitionIdentityInput
): StateMachineTopologyTransitionId =>
	identity<StateMachineTopologyTransitionId>(
		'sm-transition:legal',
		'JAN-CSAA-JPWB-STATE-MACHINE-LEGAL-TRANSITION',
		input
	);

export const stateMachineTopologyIllegalTransitionId = (
	input: TransitionIdentityInput
): StateMachineTopologyTransitionId =>
	identity<StateMachineTopologyTransitionId>(
		'sm-transition:illegal',
		'JAN-CSAA-JPWB-STATE-MACHINE-ILLEGAL-TRANSITION',
		input
	);

export const stateMachineTopologyGuardedTransitionId = (
	input: TransitionIdentityInput
): StateMachineTopologyTransitionId =>
	identity<StateMachineTopologyTransitionId>(
		'sm-transition:guarded',
		'JAN-CSAA-JPWB-STATE-MACHINE-GUARDED-TRANSITION',
		input
	);

export const stateMachineTopologyCrossAxisRuleId = (
	input: TransitionIdentityInput
): StateMachineTopologyCrossAxisRuleId =>
	identity<StateMachineTopologyCrossAxisRuleId>(
		'sm-cross-axis-rule',
		'JAN-CSAA-JPWB-STATE-MACHINE-CROSS-AXIS-RULE',
		input
	);

export interface StateMachineGraphIdentityInput {
	readonly canonicalProfile: string;
	readonly graphInputDigest: string;
	readonly graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY';
	readonly method: string;
	readonly observationId: StateMachineTopologyObservationId;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export const stateMachineGraphId = (input: StateMachineGraphIdentityInput): StateMachineGraphId =>
	identity<StateMachineGraphId>('graph:state-machine', 'JAN-CSAA-JPWB-STATE-MACHINE-GRAPH', input);

export const stateMachineGraphLayerId = (
	graph: StateMachineGraphId,
	kind: StateMachineGraphLayer['kind'],
	ordinal: StateMachineGraphLayer['ordinal']
): StateMachineGraphLayerId =>
	identity<StateMachineGraphLayerId>(
		'graph-layer:state-machine',
		'JAN-CSAA-JPWB-STATE-MACHINE-LAYER',
		{
			graph,
			kind,
			ordinal
		}
	);

export const stateMachineGraphMachineNodeId = (
	graph: StateMachineGraphId,
	machineId: StateMachineTopologyMachineId
): StateMachineGraphNodeId =>
	identity<StateMachineGraphNodeId>('graph-node:machine', 'JAN-CSAA-JPWB-STATE-MACHINE-NODE', {
		graph,
		machineId
	});

export const stateMachineGraphStateNodeId = (
	graph: StateMachineGraphId,
	stateId: StateMachineTopologyStateId
): StateMachineGraphNodeId =>
	identity<StateMachineGraphNodeId>('graph-node:state', 'JAN-CSAA-JPWB-STATE-NODE', {
		graph,
		stateId
	});

export const stateMachineGraphCrossAxisFrontierNodeId = (
	graph: StateMachineGraphId,
	ruleId: StateMachineTopologyCrossAxisRuleId
): StateMachineGraphNodeId =>
	identity<StateMachineGraphNodeId>(
		'graph-node:cross-axis-frontier',
		'JAN-CSAA-JPWB-CROSS-AXIS-FRONTIER-NODE',
		{ graph, ruleId }
	);

export interface StateMachineGraphEdgeIdentityInput {
	readonly graph: StateMachineGraphId;
	readonly observationRecordId: string;
	readonly relationKind: StateMachineGraphEdge['relationKind'];
	readonly source: StateMachineGraphEndpoint;
	readonly target: StateMachineGraphEndpoint;
}

export const stateMachineGraphEdgeId = (
	input: StateMachineGraphEdgeIdentityInput
): StateMachineGraphEdgeId =>
	identity<StateMachineGraphEdgeId>(
		'graph-edge:state-machine',
		'JAN-CSAA-JPWB-STATE-MACHINE-EDGE',
		input
	);
