// GENERATOR — emits src/objects.ts (the 17 Professional Work Object schemas + helper sub-types) from the
// grounded field extraction vocab/m1-object-fields.json (DOC-002 prose reconciled with DOC-007 serialized).
// Run via `bun run gen:objects`. Each object composes objectEnvelopeShape; enum fields reference the
// generated enum schemas; id-reference fields are strings (id validity is enforced when the referenced
// object is created, per docs §5). Helpers with an untyped field are emitted as permissive structured
// placeholders (z.record) — "any object".
//
// ⚠️ THE OLD VERSION OF THIS COMMENT WAS FALSE, and it is worth knowing why. It read: "Helpers the specs
// REFERENCE-BUT-NEVER-DEFINE are emitted as permissive structured placeholders (z.record) and tightened in
// the milestone that defines them (M7/M9/M11)." Both halves are wrong. The 2026-07-16 audit
// (docs/_working/AUDIT-placeholder-helpers.md) checked all 34 placeholders against the full 14-file ratified
// corpus: NINE are defined, field-complete, right now. DOC-004 defines seven (AssessmentCriterion §7,
// FindingDefinition §9.1, DispositionRule §10.2, WaiverRule §12.1, EscalationRule §13, EvidenceRequirement
// §6.1, ApplicabilityRule §5.1); DOC-007 defines two (§18, §20). And the milestones that were going to
// tighten them (M7/M9/M11) have all passed — this repo is beyond M14.
//
// This is not cosmetic. AssurancePolicy composes these helpers, so `criteria`, `findingDefinitions`,
// `waiverRules`, `dispositionRules`, `escalationRules`, `requiredEvidence` and `applicability` are every one
// of them `any object` — which is the MECHANISM behind the governed layer being a projection of the code
// rather than its source: nothing can read a policy, because its types say nothing. Proof: floor-policies.ts
// writes `{id, statement, mandatory}` and DOC-004 §7 ratifies neither `statement` nor `mandatory`.
// Tightening them breaks live literals and needs an explicit migration, so the audit sequences it rather
// than sweeping it.
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
//
// `ValidatorResult` LEFT THIS SET on 2026-07-16. The note that kept it here read: "BEFORE REMOVING
// ValidatorResult FROM THIS SET, resolve a RATIFIED CONFLICT (§17 — surface, never silently choose): DOC-007
// §20 defines 16 fields INCLUDING `subjectSemanticVersions`; DOC-004 §4.2 defines 15 and OMITS it."
//
// THERE IS NO CONFLICT. Read side by side, DOC-004 §4.2 is DOC-007 §20 **minus one field** — same fields, same
// order, same types, with DOC-007 adding `subjectSemanticVersions`. A strict subset is SILENCE, not
// contradiction, and §17 asks me to surface conflicts, not to invent them. The same misreading had just been
// corrected one layer up for the policy catalog (docs/_working/RULING-doc003-doc004-compose.md): DOC-004 §4.2
// is titled "Validator implementation output" and DOC-007 §20 is titled "Validator Result **Contract**" — the
// spec/contract pair again, composing rather than competing.
//
// The old note even reached the right answer — "DOC-007 is the wire authority and its shape is also the safer
// one — it binds the verdict to the subject version, which Increment 10b showed the floor cannot do without" —
// and blocked anyway, because calling it a *conflict* made it someone else's decision. Three ratified documents
// converge on that field: DOC-007 §20 states it, DOC-004 invariant 2 requires it ("Every assessment identifies
// its subject semantic version"), and DOC-009 §11.7 persists it (`subject_semantic_version integer not null`).
// Only DOC-004 §4.2 is silent. 16 fields.
//
// What this cost while it stood: `ValidatorResult` is the assurance VERDICT shape, and forcing it to `any
// object` is why completeAssuranceAssessment accepted an unvalidated `{ validatorResult: {
// dispositionRecommendation } }` — the verdict that decides whether professional work passes was the least
// checked payload in the system.
//
// `ApplicabilityExpression` remains: it is field-defined in the vocab and ratified at DOC-007 §18, so the
// generator could emit it today and simply declines to — the same stale M1 deferral, still live at M14+, but a
// separate change with its own blast radius. It is not blocked on anything; it is just not done.
const FORCE_PLACEHOLDER = new Set(['ApplicabilityExpression']);
// Helpers a later milestone tightened to a real strictObject — emit as a full helper even with a single field
// (still requires every field to be typed). M9 defines the decomposition/recomposition sub-shapes.
const FORCE_FULL = new Set([
	'ObligationAllocation',
	'ConstraintPropagation',
	'AggregationRule',
	'ConflictResolutionRule',
	'IntentMapping',
	'AssumptionPropagation',
	// JAN-CAPBIND (N-5). Both are DELIBERATELY single-field — a capability is an IDENTITY, and its runtime BOUND
	// lives in the platform's policy plane rather than on the entry (DS-001 §6). Without these two names here the
	// third limb below would classify them as placeholders and keep emitting `z.record(z.string(), z.unknown())`:
	// the authoring would appear to land and enforce NOTHING, which is this lineage's signature defect wearing a
	// contract change. The subset rule that closes N-4 compares these identities, so a permissive record would make
	// every comparison vacuous.
	'CapabilityRequest',
	'CapabilityGrant'
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

/**
 * Map a spec field type -> a Zod expression string.
 *
 * ARRAY DETECTION MUST COME FIRST. The `enumRef` branch used to sit at the top and `return enumRef` outright,
 * BEFORE the `t.endsWith('[]')` check below — so any field carrying both an enumRef and an array type silently
 * lost its array. Three ratified arrays on AssurancePolicyDefinition emitted as SCALARS:
 * `applicableObjectTypes`, `evaluatedClaimTypes`, `permittedControlActions`. DOC-004 §3.1, DOC-007 and DOC-002
 * §17.1 ALL declare them `[]` — there is no §17 conflict to excuse it — and the vocab was right too
 * (`{"type": "ControlAction[]", "enumRef": "ControlActionSchema"}`); the generator threw the `[]` away.
 *
 * The harm was concrete, not cosmetic: a policy permitting {CLARIFY, REJECT} was UNREPRESENTABLE. The bug was
 * self-evident from a contrast inside the same schema — every object-array field kept its array
 * (`defaultClaimTemplates: z.array(ClaimTemplateSchema)`) because those carry no enumRef.
 * Found by adversarial review of Increment 11, 2026-07-16.
 */
function zodExpr(type: string | undefined, enumRef?: string): string {
	let t = (type ?? 'string').trim();
	let arr = false;
	if (t.endsWith('[]')) {
		arr = true;
		t = t.slice(0, -2).trim();
	}
	if (enumRef) {
		usedEnums.add(enumRef.replace(/Schema$/, ''));
		return arr ? `z.array(${enumRef})` : enumRef;
	}
	// Inline string-literal union, e.g. "'A' | 'B' | 'C'" -> z.enum(['A','B','C']). Lets a tightened helper
	// pin a small closed value set without minting a named enum in the canonical vocabulary.
	const literalUnion = /^'[^']*'(\s*\|\s*'[^']*')*$/.exec(t);
	if (literalUnion) {
		const values = [...t.matchAll(/'([^']*)'/g)].map((m) => JSON.stringify(m[1]));
		const unionExpr = `z.enum([${values.join(', ')}])`;
		return arr ? `z.array(${unionExpr})` : unionExpr;
	}
	const expr = scalarZodExpr(t);
	return arr ? `z.array(${expr})` : expr;
}

// Map a non-array, non-enumRef, non-literal-union scalar type string -> a Zod expression, performing the same
// enum/external usage side effects (usedEnums.add / usedExternal.add) in the same order as the inline ladder it
// replaces. Extracted from zodExpr to reduce cognitive complexity; behavior and emitted strings are identical.
// REG-F-018 — integer-constrained, for the reason spelled out in `gen-messages.ts`: `contentHash` hashes every
// persisted object state and admits only finite integers, so a bare `z.number()` here is a contract promising to
// accept a value the store cannot write. This file is the OBJECT side, which is where that bites hardest —
// `ArtifactSchema.byteSize` is the field that actually crashed `dispatch`.
const INT = 'z.number().int()';

function scalarZodExpr(t: string): string {
	if (t === 'string') return 'z.string()';
	if (t === 'number') return INT;
	if (t === 'boolean') return 'z.boolean()';
	if (t === '(string | number)') return `z.union([z.string(), ${INT}])`;
	if (t === 'Record<string, number>') return `z.record(z.string(), ${INT})`;
	if (ENUM_NAMES.has(t)) {
		usedEnums.add(t);
		return `${t}Schema`;
	}
	if (EXTERNAL_HELPERS[t]) {
		usedExternal.add(EXTERNAL_HELPERS[t]!);
		return EXTERNAL_HELPERS[t]!;
	}
	if (HELPER_NAMES.has(t)) return `${t}Schema`;
	return 'z.unknown()';
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
placeholders.sort((a, b) => a.name.localeCompare(b.name));
for (const h of placeholders) {
	body.push(
		`export const ${h.name}Schema = z.record(z.string(), z.unknown());`,
		`export type ${h.name} = z.infer<typeof ${h.name}Schema>;`
	);
}
body.push('', '// ---- Well-specified helper sub-types. ----');

/**
 * Emit full helpers in DEPENDENCY order, alphabetical within a tier.
 *
 * THIS WAS A PLAIN `localeCompare` AND IT WAS A LATENT BUG (JAN-CAPBIND WP-0). A full helper that references
 * another full helper must be emitted AFTER it, because `z.strictObject({...})` evaluates its argument eagerly:
 * a forward reference is a TDZ `ReferenceError: Cannot access 'XSchema' before initialization` at import time,
 * not a type error, so it fails the whole package rather than one schema.
 *
 * It stayed invisible because every referent happened to be a PLACEHOLDER, and placeholders are emitted first as
 * a block — so the ordering never mattered. The moment N-5's authoring turned `InputBinding` into a real helper,
 * `ExecutionStep` (which carries `inputBindings`) sorted before it alphabetically and the generated module
 * stopped loading. Any future authoring of a placeholder would have hit the same wall.
 *
 * Alphabetical is kept as the tiebreak WITHIN a dependency tier so the emitted file stays byte-stable across
 * runs — a generator whose output reorders on every invocation makes every diff unreviewable.
 */
const helperDeps = (h: HelperSpec): string[] =>
	h.fields
		.map((f) => (f.type ?? '').replace(/\[\]$/, ''))
		.filter((t) => fullHelpers.some((x) => x.name === t));

const ordered: HelperSpec[] = [];
const emitted = new Set<string>();
const visiting = new Set<string>();
const visit = (h: HelperSpec): void => {
	if (emitted.has(h.name)) return;
	if (visiting.has(h.name))
		// A cycle needs `z.lazy` to express at all, so emitting anything here would produce a module that throws at
		// import. Fail the GENERATOR instead: a loud build failure beats a schema file that cannot be loaded.
		throw new Error(
			`gen-objects: helper dependency cycle involving ${h.name}. Zod needs z.lazy() for recursive helpers; the emitter does not support it.`
		);
	visiting.add(h.name);
	for (const depName of helperDeps(h).sort((a, b) => a.localeCompare(b))) {
		const dep = fullHelpers.find((x) => x.name === depName);
		if (dep) visit(dep);
	}
	visiting.delete(h.name);
	emitted.add(h.name);
	ordered.push(h);
};
for (const h of [...fullHelpers].sort((a, b) => a.name.localeCompare(b.name))) visit(h);
fullHelpers.length = 0;
fullHelpers.push(...ordered);
for (const h of fullHelpers) {
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
