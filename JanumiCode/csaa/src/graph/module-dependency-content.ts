import type { ModuleDependencyGraphSnapshot } from '../contracts/graph.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

export type ModuleDependencyGraphContent = Omit<ModuleDependencyGraphSnapshot, 'contentDigest'>;

export function moduleDependencyGraphContentDigest(
	graph: ModuleDependencyGraphSnapshot | ModuleDependencyGraphContent
): string {
	const { contentDigest: _contentDigest, ...content } = graph as ModuleDependencyGraphSnapshot;
	return sha256(canonicalSemanticJson(content));
}
