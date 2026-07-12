// The common envelopes shared by every Professional Work Object (ObjectEnvelope) and the command/event
// transport envelopes. Concrete object schemas (M1) spread `objectEnvelopeShape` into a z.strictObject
// so unknown properties are rejected (RPH-CON-002); extensibility flows ONLY through `extensions[]`.
import { z } from 'zod';
import {
	ExtensionPayloadSchema,
	NonNegativeIntSchema,
	RevisionSchema,
	RfcTimestampSchema,
	SchemaVersionSchema,
	SemanticVersionSchema
} from './common.js';
import {
	ActorTypeSchema,
	CommandResultStatusSchema,
	OriginTypeSchema,
	ProfessionalWorkObjectTypeSchema
} from './enums.js';
import { RphErrorSchema } from './errors.js';
import { RphIdSchema } from './ids.js';

/** Who/what acted. DOC-007 §6 adds `providerId` (for validator independence resolution). */
export const ActorReferenceSchema = z.strictObject({
	actorId: z.string().min(1),
	actorType: ActorTypeSchema,
	displayName: z.string().min(1),
	roleId: z.string().optional(),
	modelId: z.string().optional(),
	providerId: z.string().optional(),
	executionInstanceId: z.string().optional()
});
export type ActorReference = z.infer<typeof ActorReferenceSchema>;

/** Where an object came from — its lineage into the event/object graph. DOC-007 §7.1. */
export const ProvenanceRecordSchema = z.strictObject({
	originType: OriginTypeSchema,
	sourceObjectIds: z.array(z.string()),
	sourceEventIds: z.array(z.string()),
	producingExecutionAttemptId: z.string().optional(),
	producingValidatorId: z.string().optional(),
	contentHash: z.string().optional()
});
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

/**
 * The common object envelope shape (DOC-007 §7). `authorityId` (DOC-002 §4) is DROPPED per docs §5.
 * Exported as a raw shape so concrete object types compose it: `z.strictObject({ ...objectEnvelopeShape, ... })`.
 */
export const objectEnvelopeShape = {
	id: RphIdSchema,
	objectType: ProfessionalWorkObjectTypeSchema,
	schemaVersion: SchemaVersionSchema,
	semanticVersion: SemanticVersionSchema,
	revision: RevisionSchema,
	lifecycleStatus: z.string(),
	createdAt: RfcTimestampSchema,
	createdBy: ActorReferenceSchema,
	updatedAt: RfcTimestampSchema,
	updatedBy: ActorReferenceSchema,
	provenance: ProvenanceRecordSchema,
	ontologyId: z.string().optional(),
	ontologyVersion: z.string().optional(),
	tags: z.array(z.string()),
	extensions: z.array(ExtensionPayloadSchema)
} as const;

export const ObjectEnvelopeSchema = z.strictObject(objectEnvelopeShape);
export type ObjectEnvelope = z.infer<typeof ObjectEnvelopeSchema>;

/** DomainCommand envelope factory (DOC-007 §8). `expectedRevision` is optional in the schema; the
 * command handler enforces its presence for updates to existing aggregates (RPH-CON-003, M4). */
export function domainCommandSchema<T extends z.ZodTypeAny>(payload: T) {
	return z.strictObject({
		commandId: z.string().min(1),
		commandType: z.string().min(1),
		commandSchemaVersion: SchemaVersionSchema,
		targetAggregateType: z.string().min(1),
		targetAggregateId: z.string().min(1),
		expectedRevision: RevisionSchema.optional(),
		issuedAt: RfcTimestampSchema,
		issuedBy: ActorReferenceSchema,
		correlationId: z.string().min(1),
		causationId: z.string().optional(),
		idempotencyKey: z.string().min(1),
		payload
	});
}
export const DomainCommandSchema = domainCommandSchema(z.unknown());
export type DomainCommand = z.infer<typeof DomainCommandSchema>;

/** DomainEvent envelope factory (DOC-007 §9). Events assert accepted facts; `aggregateRevision` is
 * monotonic and must equal prior + 1 (§35.6, enforced in persistence M4). */
export function domainEventSchema<T extends z.ZodTypeAny>(payload: T) {
	return z.strictObject({
		eventId: z.string().min(1),
		eventType: z.string().min(1),
		eventSchemaVersion: SchemaVersionSchema,
		aggregateType: z.string().min(1),
		aggregateId: z.string().min(1),
		aggregateRevision: NonNegativeIntSchema,
		occurredAt: RfcTimestampSchema,
		recordedAt: RfcTimestampSchema,
		actor: ActorReferenceSchema,
		correlationId: z.string().min(1),
		causationId: z.string().optional(),
		commandId: z.string().optional(),
		payload
	});
}
export const DomainEventSchema = domainEventSchema(z.unknown());
export type DomainEvent = z.infer<typeof DomainEventSchema>;

/** The outcome of dispatching a command (DOC-007 §8.2). */
export const CommandResultSchema = z.strictObject({
	commandId: z.string().min(1),
	status: CommandResultStatusSchema,
	producedEventIds: z.array(z.string()),
	error: RphErrorSchema.optional()
});
export type CommandResult = z.infer<typeof CommandResultSchema>;
