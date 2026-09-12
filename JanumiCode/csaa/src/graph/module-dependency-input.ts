import type {
	SemanticAstNodeRecord,
	SemanticCapabilityRecord,
	SemanticModuleResolutionRecord,
	SemanticSourceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

export interface ModuleDependencyGraphInputSource {
	readonly analysisDisposition: SemanticSourceRecord['analysisDisposition'];
	readonly id: SemanticSourceRecord['id'];
	readonly logicalPath: string;
	readonly programId: SemanticSourceRecord['programId'];
	readonly projectId: SemanticSourceRecord['projectId'];
	readonly provenanceId: SemanticSourceRecord['provenanceId'];
	readonly textLength: number;
}

export interface ModuleDependencyGraphInputOccurrenceNode {
	readonly end: number;
	readonly id: SemanticAstNodeRecord['id'];
	readonly kind: number;
	readonly sourceId: SemanticAstNodeRecord['sourceId'];
	readonly start: number;
}

export interface ModuleDependencyGraphInputProjection {
	readonly capabilities: readonly SemanticCapabilityRecord[];
	readonly expectedEmpty: boolean;
	readonly extractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly health: StaticSemanticSnapshot['health'];
	readonly moduleResolutions: readonly SemanticModuleResolutionRecord[];
	readonly occurrenceNodes: readonly ModuleDependencyGraphInputOccurrenceNode[];
	readonly provider: StaticSemanticSnapshot['provider'];
	readonly schemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly sources: readonly ModuleDependencyGraphInputSource[];
	readonly subjectId: string;
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return Number(left.id > right.id) - Number(left.id < right.id);
}

export function moduleDependencyGraphInputProjection(
	snapshot: StaticSemanticSnapshot
): ModuleDependencyGraphInputProjection {
	const occurrenceNodeIds = new Set(snapshot.moduleResolutions.map((record) => record.nodeId));
	return {
		capabilities: snapshot.capabilities
			.filter(
				(record) =>
					record.capability === 'TS_PROJECT' ||
					record.capability === 'TS_SYMBOL' ||
					record.capability === 'TS_SYNTAX'
			)
			.map((record) => ({ ...record }))
			.sort(
				(left, right) =>
					Number(left.capability > right.capability) - Number(left.capability < right.capability)
			),
		expectedEmpty: snapshot.expectedEmpty,
		extractionVersion: snapshot.extractionVersion,
		health: snapshot.health,
		moduleResolutions: snapshot.moduleResolutions.map((record) => ({ ...record })).sort(compareId),
		occurrenceNodes: snapshot.astNodes
			.filter((node) => occurrenceNodeIds.has(node.id))
			.map((node) => ({
				end: node.end,
				id: node.id,
				kind: node.kind,
				sourceId: node.sourceId,
				start: node.start
			}))
			.sort(compareId),
		provider: { ...snapshot.provider },
		schemaVersion: snapshot.schemaVersion,
		semanticSnapshotId: snapshot.id,
		sources: snapshot.sources
			.map((source) => ({
				analysisDisposition: source.analysisDisposition,
				id: source.id,
				logicalPath: source.logicalPath,
				programId: source.programId,
				projectId: source.projectId,
				provenanceId: source.provenanceId,
				textLength: source.textLength
			}))
			.sort(compareId),
		subjectId: snapshot.subjectId
	};
}

export function moduleDependencyGraphInputDigest(snapshot: StaticSemanticSnapshot): string {
	return sha256(canonicalSemanticJson(moduleDependencyGraphInputProjection(snapshot)));
}
