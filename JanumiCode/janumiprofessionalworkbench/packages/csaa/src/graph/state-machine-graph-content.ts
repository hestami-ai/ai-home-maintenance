import type {
	StateMachineGraphSnapshot,
	StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';

export type StateMachineTopologyObservationContent = Omit<
	StateMachineTopologyObservation,
	'contentDigest'
>;
export type StateMachineGraphContent = Omit<StateMachineGraphSnapshot, 'contentDigest'>;

export function stateMachineTopologyObservationContentDigest(
	observation: StateMachineTopologyObservation | StateMachineTopologyObservationContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		observation as StateMachineTopologyObservation;
	return canonicalSemanticJsonWitness(content).sha256;
}

export function stateMachineGraphContentDigest(
	graph: StateMachineGraphSnapshot | StateMachineGraphContent
): string {
	const { contentDigest: _contentDigest, ...content } = graph as StateMachineGraphSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
