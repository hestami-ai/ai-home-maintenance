// GENERATOR — emits src/objects.ts (the 17 Professional Work Object schemas + helper sub-types) from the
// grounded field extraction vocab/m1-object-fields.json (DOC-002 prose reconciled with DOC-007 serialized).
// Run via `bun run gen:objects`. Each object composes objectEnvelopeShape; enum fields reference the
// generated enum schemas; id-reference fields are strings (id validity is enforced when the referenced
// object is created, per docs §5). Helpers the specs REFERENCE-BUT-NEVER-DEFINE are emitted as permissive
// structured placeholders (z.record) and tightened in the milestone that defines them (M7/M9/M11).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Field {
	field: string;
	type?: string;
	required: boolean;
	enumRef?: string;
	note?: string;
}
interface ObjSpec {
	objectType: string;
	tsName: string;
	idPrefixEntity?: string;
	fields: Field[];
}
interface HelperSpec {
	name: string;
	fields: Field[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, '..', '..', 'vocab', 'm1-object-fields.json');
const ENUMS_PATH = join(HERE, '..', 'enums.ts');
const OUT_PATH = join(HERE, '..', 'objects.ts');

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as {
	objects: ObjSpec[];
	helperSubTypes: HelperSpec[];
};
const enumsSrc = readFileSync(ENUMS_PATH, 'utf8');
const ENUM_NAMES = new Set(
	[...enumsSrc.matchAll(/export const (\w+)Schema = z\.enum/g)].map((m) => m[1]!)
);

// Helpers defined elsewhere (envelopes.ts) — reference, do not re-emit.
const EXTERNAL_HELPERS: Record<string, string> = {
	ActorReference: 'ActorReferenceSchema',
	ProvenanceRecord: 'ProvenanceRecordSchema'
};
// Complex helpers whose faithful shape belongs to a later milestone — placeholder for M1 even if >=2 fields.
const FORCE_PLACEHOLDER = new Set(['ApplicabilityExpression', 'ValidatorResult']);
// Helpers a later milestone tightened to a real strictObject — emit as a full helper even with a single field
// (still requires every field to be typed). M9 defines the decomposition/recomposition sub-shapes.
const FORCE_FULL = new Set([
	'ObligationAllocation',
	'ConstraintPropagation',
	'AggregationRule',
	'ConflictResolutionRule',
	'IntentMapping',
	'AssumptionPropagation'
]);

const HELPER_NAMES = new Set(spec.helperSubTypes.map((h) => h.name));
for (const k of Object.keys(EXTERNAL_HELPERS)) HELPER_NAMES.add(k);

function isPlaceholder(h: HelperSpec): boolean {
	if (FORCE_PLACEHOLDER.has(h.name)) return true;
	if (h.fields.some((f) => !f.type || f.type === '—')) return true; // any untyped field => cannot emit a shape
	return !FORCE_FULL.has(h.name) && h.fields.length < 2;
}

const usedEnums = new Set<string>();
const usedExternal = new Set<string>();

/** Map a spec field type -> a Zod expression string. */
function zodExpr(type: string | undefined, enumRef?: string): string {
	if (enumRef) {
		usedEnums.add(enumRef.replace(/Schema$/, ''));
		return enumRef;
	}
	let t = (type ?? 'string').trim();
	let arr = false;
	if (t.endsWith('[]')) {
		arr = true;
		t = t.slice(0, -2).trim();
	}
	let expr: string;
	// Inline string-literal union, e.g. "'A' | 'B' | 'C'" -> z.enum(['A','B','C']). Lets a tightened helper
	// pin a small closed value set without minting a named enum in the canonical vocabulary.
	const literalUnion = /^'[^']*'(\s*\|\s*'[^']*')*$/.exec(t);
	if (literalUnion) {
		const values = [...t.matchAll(/'([^']*)'/g)].map((m) => JSON.stringify(m[1]));
		expr = `z.enum([${values.join(', ')}])`;
		return arr ? `z.array(${expr})` : expr;
	}
	if (t === 'string') expr = 'z.string()';
	else if (t === 'number') expr = 'z.number()';
	else if (t === 'boolean') expr = 'z.boolean()';
	else if (t === '(string | number)') expr = 'z.union([z.string(), z.number()])';
	else if (t === 'Record<string, number>') expr = 'z.record(z.string(), z.number())';
	else if (ENUM_NAMES.has(t)) {
		usedEnums.add(t);
		expr = `${t}Schema`;
	} else if (EXTERNAL_HELPERS[t]) {
		usedExternal.add(EXTERNAL_HELPERS[t]!);
		expr = EXTERNAL_HELPERS[t]!;
	} else if (HELPER_NAMES.has(t)) expr = `${t}Schema`;
	else expr = 'z.unknown()';
	return arr ? `z.array(${expr})` : expr;
}

function fieldLine(f: Field): string {
	const base = zodExpr(f.type, f.enumRef);
	return `\t${JSON.stringify(f.field)}: ${base}${f.required ? '' : '.optional()'}`;
}

const placeholders = spec.helperSubTypes
	.filter(isPlaceholder)
	.filter((h) => !EXTERNAL_HELPERS[h.name]);
const fullHelpers = spec.helperSubTypes
	.filter((h) => !isPlaceholder(h))
	.filter((h) => !EXTERNAL_HELPERS[h.name]);

const body: string[] = [];

body.push(
	'// ---- Helper sub-types the specs reference but never fully define. Permissive structured',
	'// placeholders (any object) — tightened in the milestone that defines them (M7/M9/M11). ----'
);
for (const h of placeholders.sort((a, b) => a.name.localeCompare(b.name))) {
	body.push(
		`export const ${h.name}Schema = z.record(z.string(), z.unknown());`,
		`export type ${h.name} = z.infer<typeof ${h.name}Schema>;`
	);
}
body.push('', '// ---- Well-specified helper sub-types. ----');
for (const h of fullHelpers.sort((a, b) => a.name.localeCompare(b.name))) {
	const lines = h.fields.map(fieldLine).join(',\n');
	body.push(
		`export const ${h.name}Schema = z.strictObject({\n${lines}\n});`,
		`export type ${h.name} = z.infer<typeof ${h.name}Schema>;`
	);
}
body.push(
	'',
	'// ---- The 17 Professional Work Object schemas (each composes objectEnvelopeShape). ----'
);
for (const o of spec.objects) {
	const fields = o.fields.map(fieldLine).join(',\n');
	const shape = o.fields.length
		? `z.strictObject({\n\t...objectEnvelopeShape,\n${fields}\n})`
		: 'z.strictObject({ ...objectEnvelopeShape })';
	body.push(
		`/** ${o.objectType} — id prefix: ${o.idPrefixEntity ?? '?'} */`,
		`export const ${o.tsName}Schema = ${shape};`,
		`export type ${o.tsName} = z.infer<typeof ${o.tsName}Schema>;`,
		''
	);
}
body.push(
	'/** Registry: objectType literal -> { schema, idPrefixEntity, tsName }. */',
	'export const OBJECT_SCHEMAS = {'
);
for (const o of spec.objects) {
	body.push(
		`\t${JSON.stringify(o.objectType)}: { schema: ${o.tsName}Schema, idPrefixEntity: ${JSON.stringify(o.idPrefixEntity ?? o.objectType)}, tsName: ${JSON.stringify(o.tsName)} },`
	);
}
body.push('} as const;');

const enumImport = [...usedEnums]
	.sort((a, b) => Number(a > b) - Number(a < b))
	.map((e) => `${e}Schema`)
	.join(', ');
const header = [
	'// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:objects`.',
	'// Source: vocab/m1-object-fields.json (grounded from DOC-002/007). See gen/gen-objects.ts.',
	"import { z } from 'zod';",
	`import { ${['objectEnvelopeShape', ...[...usedExternal].sort((a, b) => Number(a > b) - Number(a < b))].join(', ')} } from './envelopes.js';`,
	`import { ${enumImport} } from './enums.js';`,
	''
];

writeFileSync(OUT_PATH, [...header, ...body, ''].join('\n'));
console.log(
	`generated ${OUT_PATH}: ${spec.objects.length} objects, ${fullHelpers.length} full helpers, ${placeholders.length} placeholders`
);
