// The validation seam: turn Zod parse failures into typed RphErrors at every write boundary
// (Constitution: validate strictly at boundaries; treat model/host input as untrusted), and a registry
// mapping stable schema $ids to Zod schemas so the command pipeline and JSON-Schema emitter share one source.
import { z } from 'zod';
import { makeRphError, RphErrorSchema, type RphError } from './errors.js';
import {
	ActorReferenceSchema,
	CommandResultSchema,
	DomainCommandSchema,
	DomainEventSchema,
	ObjectEnvelopeSchema,
	ProvenanceRecordSchema
} from './envelopes.js';
import { ExtensionPayloadSchema } from './common.js';
import { CANONICAL_ENUM_SCHEMAS } from './enums.js';
import { OBJECT_SCHEMAS } from './objects.js';
import { COMMANDS, EVENTS } from './messages.js';

export const SCHEMA_URI_PREFIX = 'urn:janumi:rph:schema';

/** Build a stable schema id: `urn:janumi:rph:schema:<category>:<name>:<version>`. */
export function schemaId(category: string, name: string, version = 1): string {
	return `${SCHEMA_URI_PREFIX}:${category}:${name}:${version}`;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: RphError };

/** Parse `value` against `schema`; on failure yield an RPH_VALIDATION_SCHEMA_FAILED with structured issues. */
export function validateAgainst<T>(
	schema: z.ZodType<T>,
	value: unknown,
	opts: { correlationId: string; targetObjectIds?: string[] }
): ValidationResult<T> {
	const parsed = schema.safeParse(value);
	if (parsed.success) return { ok: true, value: parsed.data };
	return {
		ok: false,
		error: makeRphError('RPH_VALIDATION_SCHEMA_FAILED', {
			message: 'Schema validation failed',
			correlationId: opts.correlationId,
			targetObjectIds: opts.targetObjectIds ?? [],
			details: {
				issues: parsed.error.issues.map((i) => ({
					path: i.path.join('.'),
					code: i.code,
					message: i.message
				}))
			}
		})
	};
}

/** Draft 2020-12 JSON Schema for a Zod schema (single-source generation per docs D4). */
export function jsonSchemaFor(schema: z.ZodTypeAny, id?: string): Record<string, unknown> {
	const js = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
	if (id) js.$id = id;
	return js;
}

/** A registry mapping schema ids to Zod schemas, with boundary validation by id. */
export class SchemaRegistry {
	private readonly schemas = new Map<string, z.ZodTypeAny>();

	register(id: string, schema: z.ZodTypeAny): this {
		if (this.schemas.has(id)) throw new Error(`Schema already registered: ${id}`);
		this.schemas.set(id, schema);
		return this;
	}

	has(id: string): boolean {
		return this.schemas.has(id);
	}
	get(id: string): z.ZodTypeAny | undefined {
		return this.schemas.get(id);
	}
	ids(): string[] {
		return [...this.schemas.keys()];
	}

	validate(
		id: string,
		value: unknown,
		opts: { correlationId: string; targetObjectIds?: string[] }
	): ValidationResult<unknown> {
		const schema = this.schemas.get(id);
		if (!schema) {
			return {
				ok: false,
				error: makeRphError('RPH_VALIDATION_SCHEMA_FAILED', {
					message: `Unknown schema id: ${id}`,
					correlationId: opts.correlationId,
					targetObjectIds: opts.targetObjectIds ?? []
				})
			};
		}
		return validateAgainst(schema, value, opts);
	}
}

/** The default registry of all contract schemas known at M0 (envelopes + primitives + enums). */
export function buildContractRegistry(): SchemaRegistry {
	const r = new SchemaRegistry();
	r.register(schemaId('object', 'ObjectEnvelope'), ObjectEnvelopeSchema);
	r.register(schemaId('object', 'ActorReference'), ActorReferenceSchema);
	r.register(schemaId('object', 'ProvenanceRecord'), ProvenanceRecordSchema);
	r.register(schemaId('object', 'ExtensionPayload'), ExtensionPayloadSchema);
	r.register(schemaId('command', 'DomainCommand'), DomainCommandSchema);
	r.register(schemaId('event', 'DomainEvent'), DomainEventSchema);
	r.register(schemaId('result', 'CommandResult'), CommandResultSchema);
	r.register(schemaId('error', 'RphError'), RphErrorSchema);
	for (const [name, schema] of Object.entries(CANONICAL_ENUM_SCHEMAS)) {
		r.register(schemaId('enum', name), schema);
	}
	for (const entry of Object.values(OBJECT_SCHEMAS)) {
		r.register(schemaId('object', entry.tsName), entry.schema);
	}
	for (const [commandType, entry] of Object.entries(COMMANDS)) {
		r.register(schemaId('command', commandType), entry.payload);
	}
	for (const [eventType, entry] of Object.entries(EVENTS)) {
		r.register(schemaId('event', eventType), entry.payload);
	}
	return r;
}
