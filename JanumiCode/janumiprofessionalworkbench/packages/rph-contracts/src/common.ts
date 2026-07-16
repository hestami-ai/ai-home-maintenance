// Shared primitive field schemas used across every envelope and object type.
import { z } from 'zod';

/**
 * A deep-readonly view of a ratified contract type — DERIVED from it, never restated.
 *
 * Lives here because two packages need it and neither may import the other: the Product Realization PWA declares
 * its `as const` ontology dataset in these terms, and the engine's ontology port declares what it will accept.
 * Restating the field list in either place is how the ratified DOC-004 §7 criterion shape drifted into an invented
 * `{id, statement, mandatory}` in five separate copies; a derivation cannot drift from what it derives from.
 */
export type Frozen<T> = {
	readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? readonly E[] : T[K];
};

/** RFC-3339 UTC timestamp (e.g. 2026-07-10T22:00:00Z). Rejects offsets/local per DOC-007 §4. */
export const RfcTimestampSchema = z.iso.datetime();
export type RfcTimestamp = z.infer<typeof RfcTimestampSchema>;

export const NonNegativeIntSchema = z.number().int().nonnegative();
export const PositiveIntSchema = z.number().int().positive();

// The version quartet (docs §5 ratify sheet): four distinct fields with distinct meanings.
/** Contract PACKAGE version (semver-ish string), e.g. the rph-contracts release. */
export const ContractVersionSchema = z.string().min(1);
/** PAYLOAD schema version — bumps when the serialized shape changes (drives upcasters). */
export const SchemaVersionSchema = NonNegativeIntSchema;
/** MEANING version — bumps only on obligation/assurance/authority/semantic change. */
export const SemanticVersionSchema = NonNegativeIntSchema;
/** CONCURRENCY revision — bumps on ANY persisted change; drives optimistic concurrency. */
export const RevisionSchema = NonNegativeIntSchema;

/**
 * The ONLY forward-compatible extensibility channel. Everything else is `additionalProperties:false`
 * (unknown properties rejected). Namespaced + schema-versioned so extensions evolve independently.
 */
export const ExtensionPayloadSchema = z.strictObject({
	namespace: z.string().min(1),
	schemaVersion: SchemaVersionSchema,
	data: z.record(z.string(), z.unknown())
});
export type ExtensionPayload = z.infer<typeof ExtensionPayloadSchema>;
