// Emit JSON Schema (Draft 2020-12) for every contract schema into schemas/ (committed interop artifact).
// Derived from the Zod source — the single source of truth (docs D4). Run via `bun run gen`.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'schemas');

const OBJECTS: Array<[category: string, name: string, schema: z.ZodTypeAny]> = [
	['object', 'ObjectEnvelope', ObjectEnvelopeSchema],
	['object', 'ActorReference', ActorReferenceSchema],
	['object', 'ProvenanceRecord', ProvenanceRecordSchema],
	['object', 'ExtensionPayload', ExtensionPayloadSchema],
	['command', 'DomainCommand', DomainCommandSchema],
	['event', 'DomainEvent', DomainEventSchema],
	['result', 'CommandResult', CommandResultSchema],
	['error', 'RphError', RphErrorSchema]
];

function safeName(name: string): string {
	return name.replace(/[^A-Za-z0-9]/g, '');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'objects'), { recursive: true });
mkdirSync(join(OUT, 'enums'), { recursive: true });

let count = 0;
for (const [category, name, schema] of OBJECTS) {
	const js = jsonSchemaFor(schema, schemaId(category, name));
	writeFileSync(join(OUT, 'objects', `${name}.json`), `${JSON.stringify(js, null, 2)}\n`);
	count++;
}
for (const [name, schema] of Object.entries(CANONICAL_ENUM_SCHEMAS)) {
	const file = safeName(name);
	const js = jsonSchemaFor(schema, schemaId('enum', file));
	writeFileSync(join(OUT, 'enums', `${file}.json`), `${JSON.stringify(js, null, 2)}\n`);
	count++;
}
for (const entry of Object.values(OBJECT_SCHEMAS)) {
	const js = jsonSchemaFor(entry.schema, schemaId('object', entry.tsName));
	writeFileSync(join(OUT, 'objects', `${entry.tsName}.json`), `${JSON.stringify(js, null, 2)}\n`);
	count++;
}
console.log(`emitted ${count} JSON schemas to ${OUT}`);
