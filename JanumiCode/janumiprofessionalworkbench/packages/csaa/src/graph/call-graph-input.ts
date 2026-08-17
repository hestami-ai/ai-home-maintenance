import type {
	SemanticAssignmentRecord,
	SemanticAstNodeRecord,
	SemanticCapabilityRecord,
	SemanticDeclarationRecord,
	SemanticFactProvenanceRecord,
	SemanticInvocationSiteRecord,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';

export interface CallGraphInputAstNode {
	readonly end: SemanticAstNodeRecord['end'];
	readonly hasAssignmentInitializer: SemanticAstNodeRecord['hasAssignmentInitializer'];
	readonly id: SemanticAstNodeRecord['id'];
	readonly kind: SemanticAstNodeRecord['kind'];
	readonly kindName: SemanticAstNodeRecord['kindName'];
	readonly operatorKind: SemanticAstNodeRecord['operatorKind'];
	readonly operatorName: SemanticAstNodeRecord['operatorName'];
	readonly parentId: SemanticAstNodeRecord['parentId'];
	readonly siblingOrdinal: SemanticAstNodeRecord['siblingOrdinal'];
	readonly sourceId: SemanticAstNodeRecord['sourceId'];
	readonly start: SemanticAstNodeRecord['start'];
	readonly structuralRoles: SemanticAstNodeRecord['structuralRoles'];
	readonly syntacticIdentifierText: SemanticAstNodeRecord['syntacticIdentifierText'];
}

export interface CallGraphInputSource {
	readonly analysisDisposition: SemanticSourceRecord['analysisDisposition'];
	readonly artifactClass: SemanticSourceRecord['artifactClass'];
	readonly declarationFile: SemanticSourceRecord['declarationFile'];
	readonly id: SemanticSourceRecord['id'];
	readonly logicalPath: SemanticSourceRecord['logicalPath'];
	readonly origin: SemanticSourceRecord['origin'];
	readonly programId: SemanticSourceRecord['programId'];
	readonly projectId: SemanticSourceRecord['projectId'];
	readonly provenanceId: SemanticSourceRecord['provenanceId'];
	readonly rootNodeId: SemanticSourceRecord['rootNodeId'];
	readonly syntaxProvenanceId: SemanticSourceRecord['syntaxProvenanceId'];
	readonly textLength: SemanticSourceRecord['textLength'];
}

export interface CallGraphInputProvenanceIdentity {
	readonly capability: SemanticFactProvenanceRecord['capability'];
	readonly extractionVersion: SemanticFactProvenanceRecord['extractionVersion'];
	readonly id: SemanticFactProvenanceRecord['id'];
	readonly parentProvenanceId: SemanticFactProvenanceRecord['parentProvenanceId'];
	readonly projectId: SemanticFactProvenanceRecord['projectId'];
	readonly provider: SemanticFactProvenanceRecord['provider'];
	readonly snapshotId: SemanticFactProvenanceRecord['snapshotId'];
	readonly sourceId: SemanticFactProvenanceRecord['sourceId'];
	readonly subjectId: SemanticFactProvenanceRecord['subjectId'];
}

export interface CallGraphInputProjection {
	readonly assignments: readonly SemanticAssignmentRecord[];
	readonly astNodes: readonly CallGraphInputAstNode[];
	readonly astTraversalProfile: StaticSemanticSnapshot['astTraversalProfile'];
	readonly canonicalProfile: StaticSemanticSnapshot['canonicalProfile'];
	readonly capabilities: readonly SemanticCapabilityRecord[];
	readonly declarations: readonly SemanticDeclarationRecord[];
	readonly expectedEmpty: StaticSemanticSnapshot['expectedEmpty'];
	readonly extractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly health: StaticSemanticSnapshot['health'];
	readonly invocations: readonly SemanticInvocationSiteRecord[];
	readonly operationVersion: StaticSemanticSnapshot['operationVersion'];
	readonly provenances: readonly CallGraphInputProvenanceIdentity[];
	readonly provider: StaticSemanticSnapshot['provider'];
	readonly references: readonly SemanticReferenceRecord[];
	readonly schemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly sources: readonly CallGraphInputSource[];
	readonly subjectId: StaticSemanticSnapshot['subjectId'];
	readonly symbols: readonly SemanticSymbolRecord[];
}

function compareText(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return compareText(left.id, right.id);
}

function compareAssignment(
	left: SemanticAssignmentRecord,
	right: SemanticAssignmentRecord
): number {
	return (
		compareText(left.sourceId, right.sourceId) ||
		compareText(left.nodeId, right.nodeId) ||
		compareText(left.targetNodeId, right.targetNodeId) ||
		compareText(left.assignmentKind, right.assignmentKind)
	);
}

export function callGraphInputProjection(
	snapshot: StaticSemanticSnapshot
): CallGraphInputProjection {
	return {
		assignments: [...snapshot.assignments].sort(compareAssignment),
		astNodes: snapshot.astNodes.map((node) => ({
			end: node.end,
			hasAssignmentInitializer: node.hasAssignmentInitializer,
			id: node.id,
			kind: node.kind,
			kindName: node.kindName,
			operatorKind: node.operatorKind,
			operatorName: node.operatorName,
			parentId: node.parentId,
			siblingOrdinal: node.siblingOrdinal,
			sourceId: node.sourceId,
			start: node.start,
			structuralRoles: node.structuralRoles,
			syntacticIdentifierText: node.syntacticIdentifierText
		})),
		astTraversalProfile: snapshot.astTraversalProfile,
		canonicalProfile: snapshot.canonicalProfile,
		capabilities: snapshot.capabilities
			.map((record) => ({ ...record }))
			.sort((left, right) => compareText(left.capability, right.capability)),
		declarations: snapshot.declarations,
		expectedEmpty: snapshot.expectedEmpty,
		extractionVersion: snapshot.extractionVersion,
		health: snapshot.health,
		invocations: snapshot.invocations,
		operationVersion: snapshot.operationVersion,
		provenances: snapshot.provenances
			.map((record) => ({
				capability: record.capability,
				extractionVersion: record.extractionVersion,
				id: record.id,
				parentProvenanceId: record.parentProvenanceId,
				projectId: record.projectId,
				provider: { ...record.provider },
				snapshotId: record.snapshotId,
				sourceId: record.sourceId,
				subjectId: record.subjectId
			}))
			.sort(compareId),
		provider: snapshot.provider,
		references: snapshot.references,
		schemaVersion: snapshot.schemaVersion,
		semanticSnapshotId: snapshot.id,
		sources: snapshot.sources.map((source) => ({
			analysisDisposition: source.analysisDisposition,
			artifactClass: source.artifactClass,
			declarationFile: source.declarationFile,
			id: source.id,
			logicalPath: source.logicalPath,
			origin: source.origin,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: source.provenanceId,
			rootNodeId: source.rootNodeId,
			syntaxProvenanceId: source.syntaxProvenanceId,
			textLength: source.textLength
		})),
		subjectId: snapshot.subjectId,
		symbols: snapshot.symbols
	};
}

export function callGraphInputDigest(snapshot: StaticSemanticSnapshot): string {
	return canonicalSemanticJsonWitness(callGraphInputProjection(snapshot)).sha256;
}
