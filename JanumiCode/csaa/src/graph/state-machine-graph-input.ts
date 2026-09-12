import type {
	BuildStateMachineGraphRequest,
	StateMachineGraphSourceSelector,
	StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import type {
	SemanticFactProvenanceRecord,
	SemanticSourceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';

export interface StateMachineGraphInputSource {
	readonly analysisDisposition: SemanticSourceRecord['analysisDisposition'];
	readonly artifactClass: SemanticSourceRecord['artifactClass'];
	readonly artifactRoles: SemanticSourceRecord['artifactRoles'];
	readonly bytes: SemanticSourceRecord['bytes'];
	readonly contentSha256: SemanticSourceRecord['contentSha256'];
	readonly id: SemanticSourceRecord['id'];
	readonly logicalPath: SemanticSourceRecord['logicalPath'];
	readonly origin: SemanticSourceRecord['origin'];
	readonly programId: SemanticSourceRecord['programId'];
	readonly projectId: SemanticSourceRecord['projectId'];
	readonly provenanceId: SemanticSourceRecord['provenanceId'];
	readonly syntaxProvenanceId: SemanticSourceRecord['syntaxProvenanceId'];
}

export interface StateMachineGraphInputProvenanceIdentity {
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

export interface StateMachineGraphInputProjection {
	readonly budgets: BuildStateMachineGraphRequest['budgets'];
	readonly observation: {
		readonly artifact: StateMachineTopologyObservation['artifact'];
		readonly contentDigest: string;
		readonly id: StateMachineTopologyObservation['id'];
		readonly method: StateMachineTopologyObservation['method'];
		readonly operationVersion: StateMachineTopologyObservation['operationVersion'];
		readonly schemaVersion: StateMachineTopologyObservation['schemaVersion'];
	};
	readonly provenances: readonly StateMachineGraphInputProvenanceIdentity[];
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly source: StateMachineGraphInputSource;
	readonly sourceSelector: StateMachineGraphSourceSelector;
	readonly subjectId: string;
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return Number(left.id > right.id) - Number(left.id < right.id);
}

export function stateMachineGraphInputProjection(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): StateMachineGraphInputProjection {
	const source = snapshot.sources.find((record) => record.id === request.source.semanticSourceId);
	if (source === undefined)
		throw new TypeError('Selected state-machine semantic source is absent from the snapshot.');
	const provenanceIds = new Set(
		[source.provenanceId, source.syntaxProvenanceId].filter(
			(id): id is NonNullable<typeof id> => id !== null
		)
	);
	return {
		budgets: request.budgets,
		observation: {
			artifact: observation.artifact,
			contentDigest: observation.contentDigest,
			id: observation.id,
			method: observation.method,
			operationVersion: observation.operationVersion,
			schemaVersion: observation.schemaVersion
		},
		provenances: snapshot.provenances
			.filter((record) => provenanceIds.has(record.id))
			.map((record) => ({
				capability: record.capability,
				extractionVersion: record.extractionVersion,
				id: record.id,
				parentProvenanceId: record.parentProvenanceId,
				projectId: record.projectId,
				provider: record.provider,
				snapshotId: record.snapshotId,
				sourceId: record.sourceId,
				subjectId: record.subjectId
			}))
			.sort(compareId),
		semanticExtractionVersion: snapshot.extractionVersion,
		semanticSchemaVersion: snapshot.schemaVersion,
		semanticSnapshotId: snapshot.id,
		source: {
			analysisDisposition: source.analysisDisposition,
			artifactClass: source.artifactClass,
			artifactRoles: source.artifactRoles,
			bytes: source.bytes,
			contentSha256: source.contentSha256,
			id: source.id,
			logicalPath: source.logicalPath,
			origin: source.origin,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: source.provenanceId,
			syntaxProvenanceId: source.syntaxProvenanceId
		},
		sourceSelector: request.source,
		subjectId: snapshot.subjectId
	};
}

export function stateMachineGraphInputDigest(
	request: BuildStateMachineGraphRequest,
	snapshot: StaticSemanticSnapshot,
	observation: StateMachineTopologyObservation
): string {
	return canonicalSemanticJsonWitness(
		stateMachineGraphInputProjection(request, snapshot, observation)
	).sha256;
}
