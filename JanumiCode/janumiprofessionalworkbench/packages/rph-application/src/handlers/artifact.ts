// Artifact lifecycle. An Artifact is the recorded, content-addressed OUTPUT of professional work — the thing a
// step produces, evidence references, and the assurance floor is recorded over.
//
// WHY THIS FILE EXISTS (2026-07-16). It closes a dangling reference that spanned three ratified documents:
// DOC-007 §16.1/§16.2 give CompleteExecutionStep and ExecutionStepSucceeded an `outputArtifactIds: string[]`,
// and DOC-009 §18.1 persists artifacts as first-class Professional Work Objects — but NO ratified command or
// event could bring one into existence (DOC-002 §34.3 / §26.4 and DOC-007 §32 / §33 all omit it). So
// `outputArtifactIds` pointed at objects the system had no way to create, and ARTIFACT — a member of DOC-002
// §4's ratified ProfessionalWorkObjectType union — was a bare envelope with zero fields.
//
// The fields are NOT designed. They are DOC-009 §18.1's `create table artifacts`, column-for-column. The vocab
// previously carried "UNSPECIFIED in BOTH DOC-002 and DOC-007 ... do not fabricate. OPEN ITEM." — every clause
// true, the conclusion wrong: it searched the meaning doc and the wire doc and never opened the STORAGE doc.
//
// WHAT IS AUTHORED, AND DISCLOSED AS SUCH: the command/event names and the 'art' id prefix (DOC-007 §5.2's
// registry has no artifact entry). What is NOT authored: any value domain. DOC-009 types artifactType, status,
// securityClassification and retentionClass as bare `text not null` with no CHECK constraint, and no enum for
// them exists anywhere in the corpus — so they are `string` here. Inventing members would be exactly the
// fabrication the original note rightly forbade.
import type { RecordArtifactPayload } from '@janumipwb/rph-contracts';
import { createObject, newEnvelope, type CommandHandler } from './kit.js';

const ARTIFACT = 'ARTIFACT';

/**
 * RecordArtifact — register a produced Artifact as a Professional Work Object.
 *
 * NO state machine is declared, deliberately. DOC-002 defines no Artifact interface, no invariant section, and
 * no state machine; DOC-009 §18.1 types `status` as open text. So `status` is RECORDED as supplied, never
 * driven — and Evidence.status is NOT borrowed, because a lifecycle lifted from another object would be a
 * machine nobody ratified wearing a citation that does not cover it.
 *
 * The envelope supplies semanticVersion 1. That is what makes an Artifact a legal assurance subject: DOC-004
 * invariant 2 requires "Every assessment identifies its subject semantic version", and DOC-009 §11.7's
 * assurance_assessment_subjects requires `subject_object_id references professional_work_objects(id)` with a
 * NOT NULL `subject_semantic_version`. An Execution Step satisfies neither — it has no envelope and no
 * registry row. The Artifact satisfies both.
 *
 * `sourceObjectIds` binds the producers DOC-009 §18.1 names — producing PWU and producing Execution Attempt.
 * The corpus attributes an artifact to those two and never to the Execution Step.
 *
 * DOC-009 §18.3 ("corrections create: new artifact; new semantic version; supersession link") is NOT
 * implemented here: it needs a supersession edge and a correction command, and nothing this increment enables
 * requires inventing that shape. Disclosed, not silently skipped.
 */
export const recordArtifact: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordArtifactPayload;
	const producerIds = [p.producingPwuId, p.producingExecutionAttemptId].filter(
		(id): id is string => typeof id === 'string' && id !== ''
	);
	const state: Record<string, unknown> = {
		...newEnvelope(command, ARTIFACT, p.artifactId, {
			lifecycleStatus: p.status,
			sourceObjectIds: producerIds
		}),
		artifactType: p.artifactType,
		mediaType: p.mediaType,
		storageProvider: p.storageProvider,
		storageKey: p.storageKey,
		contentHash: p.contentHash,
		...(p.byteSize !== undefined ? { byteSize: p.byteSize } : {}),
		...(p.producingPwuId ? { producingPwuId: p.producingPwuId } : {}),
		...(p.producingExecutionAttemptId
			? { producingExecutionAttemptId: p.producingExecutionAttemptId }
			: {}),
		securityClassification: p.securityClassification,
		retentionClass: p.retentionClass,
		status: p.status
	};
	return createObject(ctx, command, {
		objectType: ARTIFACT,
		aggregateId: p.artifactId,
		state,
		eventType: 'ArtifactRecorded'
	});
};
