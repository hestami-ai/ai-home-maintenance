// The ONE enumeration of every emitted JSON Schema artifact — JAN-BINDEXCL (N-14).
//
// WHY THIS IS SPLIT OUT OF `emit.ts`. The drift test claimed in its own header that "the committed schemas/
// artifacts must not have drifted from the source", and read EXACTLY ONE of them — `ObjectEnvelope.json`, out of
// 107. A missed regeneration of any other artifact was invisible to the test written to catch exactly that.
//
// The obvious repair — re-list the schemas inside the test — would be a SECOND copy of the emitter's list, and a
// list that must be edited twice is one that will be edited once. That is the `CLOSED_PWU_STATES` shape this
// programme keeps paying for. So the enumeration moves here, `emit.ts` writes what it returns, and the test
// compares against what it returns; neither owns the list.
//
// `emit.ts` CANNOT be imported by a test: it deletes and rewrites `schemas/` at module scope, so importing it to
// read its list would regenerate the artifacts the test is trying to check — and the comparison would pass by
// construction. That is the other half of why this file exists.
import type { z } from 'zod';
import { ExtensionPayloadSchema } from '../common.js';
import { CANONICAL_ENUM_SCHEMAS } from '../enums.js';
import {
	ActorReferenceSchema,
	CommandResultSchema,
	DomainCommandSchema,
	DomainEventSchema,
	ObjectEnvelopeSchema,
	ProvenanceRecordSchema
} from '../envelopes.js';
import { RphErrorSchema } from '../errors.js';
import { OBJECT_SCHEMAS } from '../objects.js';
import { jsonSchemaFor, schemaId } from '../validate.js';

/** The hand-listed envelope/command/event/result/error schemas — the ones not covered by a generated registry. */
const ENVELOPES: Array<[category: string, name: string, schema: z.ZodTypeAny]> = [
	['object', 'ObjectEnvelope', ObjectEnvelopeSchema],
	['object', 'ActorReference', ActorReferenceSchema],
	['object', 'ProvenanceRecord', ProvenanceRecordSchema],
	['object', 'ExtensionPayload', ExtensionPayloadSchema],
	['command', 'DomainCommand', DomainCommandSchema],
	['event', 'DomainEvent', DomainEventSchema],
	['result', 'CommandResult', CommandResultSchema],
	['error', 'RphError', RphErrorSchema]
];

/** Enum file names are sanitised because a canonical enum name may contain dots (`Pwu.workLifecycleState`). */
export function safeName(name: string): string {
	return name.replace(/[^A-Za-z0-9]/g, '');
}

export interface EmittedSchema {
	/** Subdirectory under `schemas/`. */
	readonly dir: 'objects' | 'enums';
	/** File name WITHOUT the `.json` suffix. */
	readonly name: string;
	/** The JSON Schema derived from the Zod source — what the committed file must equal. */
	readonly json: unknown;
}

/**
 * Every artifact `bun run gen` writes under `schemas/`, derived fresh from the Zod source.
 *
 * Pure: it builds values and touches no filesystem, so a test may call it as often as it likes.
 */
export function emittedSchemas(): EmittedSchema[] {
	const out: EmittedSchema[] = [];
	for (const [category, name, schema] of ENVELOPES)
		out.push({ dir: 'objects', name, json: jsonSchemaFor(schema, schemaId(category, name)) });
	for (const [name, schema] of Object.entries(CANONICAL_ENUM_SCHEMAS)) {
		const file = safeName(name);
		out.push({ dir: 'enums', name: file, json: jsonSchemaFor(schema, schemaId('enum', file)) });
	}
	for (const entry of Object.values(OBJECT_SCHEMAS))
		out.push({
			dir: 'objects',
			name: entry.tsName,
			json: jsonSchemaFor(entry.schema, schemaId('object', entry.tsName))
		});
	return out;
}
