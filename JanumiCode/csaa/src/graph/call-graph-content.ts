import type { CallGraphSnapshot } from '../contracts/call-graph.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';

export type CallGraphContent = Omit<CallGraphSnapshot, 'contentDigest'>;

export function callGraphContentDigest(graph: CallGraphSnapshot | CallGraphContent): string {
	const { contentDigest: _contentDigest, ...content } = graph as CallGraphSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
