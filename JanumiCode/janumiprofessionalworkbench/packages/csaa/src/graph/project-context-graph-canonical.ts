import {
	PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE,
	PROJECT_CONTEXT_GRAPH_METHOD,
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphId,
	type ProjectContextGraphSnapshot,
	type ProjectContextMembershipId,
	type ProjectContextProgramId,
	type ProjectContextProjectId,
	type ProjectContextReferenceId,
	type ProjectContextSourceId
} from '../contracts/project-context-graph.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

function canonicalId<Kind extends string>(domain: string, value: unknown): Kind {
	return `${domain}-${sha256(canonicalSemanticJson(value))}` as Kind;
}

export function projectContextGraphInputDigest(inputs: ProjectContextGraphBuildInputs): string {
	return canonicalSemanticJsonWitness([
		'project-context-graph-input',
		PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION,
		PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
		PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE,
		PROJECT_CONTEXT_GRAPH_METHOD,
		inputs.request,
		inputs.frozenSubject,
		inputs.semanticSnapshot
	]).sha256;
}

export function projectContextGraphId(inputDigest: string): ProjectContextGraphId {
	return canonicalId('project-context-graph', ['project-context-graph', inputDigest]);
}

export function projectContextProjectId(
	graphId: ProjectContextGraphId,
	semanticProjectId: string
): ProjectContextProjectId {
	return canonicalId('project-context-project', [graphId, semanticProjectId]);
}

export function projectContextProgramId(
	graphId: ProjectContextGraphId,
	semanticProgramId: string
): ProjectContextProgramId {
	return canonicalId('project-context-program', [graphId, semanticProgramId]);
}

export function projectContextSourceId(
	graphId: ProjectContextGraphId,
	semanticSourceId: string
): ProjectContextSourceId {
	return canonicalId('project-context-source', [graphId, semanticSourceId]);
}

export function projectContextMembershipId(
	graphId: ProjectContextGraphId,
	kind: 'PROGRAM_HAS_SOURCE' | 'PROJECT_HAS_PROGRAM',
	fromId: string,
	toId: string
): ProjectContextMembershipId {
	return canonicalId('project-context-membership', [graphId, kind, fromId, toId]);
}

export function projectContextReferenceId(
	graphId: ProjectContextGraphId,
	fromProjectId: ProjectContextProjectId,
	declaredTargetConfigPath: string
): ProjectContextReferenceId {
	return canonicalId('project-context-reference', [
		graphId,
		fromProjectId,
		declaredTargetConfigPath
	]);
}

export type ProjectContextGraphContent = Omit<ProjectContextGraphSnapshot, 'contentDigest'>;

export function projectContextGraphContentDigest(
	value: ProjectContextGraphContent | ProjectContextGraphSnapshot
): string {
	const { contentDigest: _contentDigest, ...content } = value as ProjectContextGraphSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
