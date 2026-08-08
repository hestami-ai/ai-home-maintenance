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

/**
 * DomainCommand envelope factory (DOC-007 §8 — HISTORICAL MATERIAL; the shape is authoritative, the prose is
 * evidence of intent).
 *
 * ⚠ A CLAIM THAT WAS HERE IS REMOVED BECAUSE IT WAS FALSE, AND IT WAS FALSE IN A SHAPE-AUTHORITY ARTIFACT.
 * This comment read: *"`expectedRevision` is optional in the schema; the command handler **enforces its
 * presence** for updates to existing aggregates (RPH-CON-003, M4)."* **No handler enforces any such thing.**
 * `kit.ts` gates on `command.expectedRevision !== undefined`, so an update that declares nothing is simply not
 * checked — which is precisely the last-write-wins default JPWB-DOC-003 §9 PER-4 forbids, and the whole reason
 * the surface-wiring programme exists (`docs/_working/ROADMAP-fork22-surface-wiring.md`).
 *
 * That matters more than an ordinary stale comment: CON-000 B1 makes this file **shape authority**, so a
 * sentence here asserting an enforcement nobody performs is the *"asserted status must be performed status"*
 * failure (B7) inside the artifact other readers are told to trust over prose.
 *
 * WHAT IS ACTUALLY TRUE: `expectedRevision` is optional here, the engine honours it **when present**, and
 * supplying it is a SURFACE obligation the routes discharge one at a time.
 *
 * ── ~~`issuedBy` IS REQUIRED HERE AND THAT IS SCHEDULED TO CHANGE (REG-D-027)~~ IT IS NOW OPTIONAL ───────────
 * ~~It becomes `.optional()` in the same increment that gives the engine an authenticated principal to stamp
 * from — not before.~~ That increment landed; the field is `.optional()` below and the reasoning moved onto it.
 * Struck rather than deleted: the sequencing constraint it records (stamp first, then widen — never the
 * reverse) is the part a future reader needs, and it stopped being a plan the moment the stamp existed.
 *
 * ⚠ THIS HEADING WAS LEFT ASSERTING THE OPPOSITE OF THE SCHEMA BELOW FOR THE LENGTH OF ONE INCREMENT. In a
 * file CON-000 B1 designates SHAPE AUTHORITY, that is the same defect the `expectedRevision` paragraph above
 * records, committed in the act of fixing it — a caller reading the prose here would have concluded it must
 * author an issuer, which is precisely the laundering shape REG-D-027 removed.
 */
export function domainCommandSchema<T extends z.ZodTypeAny>(payload: T) {
	return z.strictObject({
		commandId: z.string().min(1),
		commandType: z.string().min(1),
		commandSchemaVersion: SchemaVersionSchema,
		targetAggregateType: z.string().min(1),
		targetAggregateId: z.string().min(1),
		expectedRevision: RevisionSchema.optional(),
		issuedAt: RfcTimestampSchema,
		/**
		 * OPTIONAL SINCE REG-D-027(b), and the optionality is the point.
		 *
		 * ABSENT  -> the engine stamps the authenticated principal. This is the shape new callers should use:
		 *            there is nothing to launder because nothing is declared.
		 * PRESENT -> a CHECKED CLAIM. The engine compares it to the resolved principal and REFUSES on
		 *            disagreement rather than correcting it, so an attempt to declare an issuer one is not
		 *            becomes a recorded refusal instead of an invisible overwrite.
		 *
		 * It was REQUIRED, which made every caller author an issuer and made the laundering shape mandatory.
		 * Handlers still see it as present — see `StampedCommand`, which is what the engine hands inward after
		 * the trust boundary has run.
		 */
		issuedBy: ActorReferenceSchema.optional(),
		correlationId: z.string().min(1),
		causationId: z.string().optional(),
		idempotencyKey: z.string().min(1),
		payload
	});
}
export const DomainCommandSchema = domainCommandSchema(z.unknown());
export type DomainCommand = z.infer<typeof DomainCommandSchema>;

/**
 * A command that has crossed the trust boundary: `issuedBy` is the AUTHENTICATED principal, never a caller's
 * claim, and is therefore always present. Handlers receive this, not `DomainCommand` — which is how the
 * engine's guarantee is carried in the type system rather than in a comment.
 */
export type StampedCommand = DomainCommand & { readonly issuedBy: ActorReference };

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
