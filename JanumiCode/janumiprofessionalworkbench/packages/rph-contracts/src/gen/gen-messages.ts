// GENERATOR — emits src/messages.ts (command + event payload schemas + the command->event->transition
// BINDING table) from the grounded extraction vocab/m3-commands-events.json (DOC-007 §32/§33 + DOC-002 §26,
// reconciled). Run via `bun run gen:messages`. Payload complex types reuse the M1 object/helper schemas;
// enum fields reference the generated enums; id-reference fields are strings. Event-only "enums" not in the
// ratified enum set are modeled permissively (z.string()) — we never invent enum values.
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
interface Command {
	commandType: string;
	targetAggregateType?: string;
	emitsEvent?: string;
	payloadFields: Field[];
}
interface Event {
	eventType: string;
	aggregateType?: string;
	payloadFields: Field[];
}
interface Binding {
	commandType: string;
	eventType: string;
	machine?: string;
	from?: string;
	to?: string;
}
interface Spec {
	commands: Command[];
	events: Event[];
	bindings: Binding[];
	firstSliceCommands?: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, '..', '..', 'vocab', 'm3-commands-events.json');
const OUT_PATH = join(HERE, '..', 'messages.ts');

const enumsSrc = readFileSync(join(HERE, '..', 'enums.ts'), 'utf8');
const objSrc = readFileSync(join(HERE, '..', 'objects.ts'), 'utf8');
const envSrc = readFileSync(join(HERE, '..', 'envelopes.ts'), 'utf8');
const ENUM = new Set(
	[...enumsSrc.matchAll(/export const (\w+)Schema = z\.enum/g)].map((m) => m[1]!)
);
const OBJ = new Set([...objSrc.matchAll(/export const (\w+)Schema =/g)].map((m) => m[1]!));
const ENV = new Set([...envSrc.matchAll(/export const (\w+)Schema =/g)].map((m) => m[1]!));

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as Spec;

const used = { enums: new Set<string>(), obj: new Set<string>(), env: new Set<string>() };
const j = (v: unknown): string => JSON.stringify(v);

function zodEnumRefExpr(enumRef: string): string {
	const nm = enumRef.replace(/Schema$/, '');
	if (ENUM.has(nm)) {
		used.enums.add(nm);
		return `${nm}Schema`;
	}
	return 'z.string()'; // enumRef not in the ratified enum set -> permissive, never invent values
}

// String literal(s): 'X' -> z.literal('X'); 'A' | 'B' -> z.enum([...]). Returns undefined when `t`
// carries no string literal (caller falls through to base-type resolution) — same as the original fall-through.
function zodLiteralExpr(t: string): string | undefined {
	if (!t.includes("'")) return undefined;
	const lits = [...t.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
	if (lits.length === 1) return `z.literal(${j(lits[0])})`;
	if (lits.length > 1) return `z.enum([${lits.map((l) => j(l)).join(', ')}])`;
	return undefined;
}

function zodBaseExpr(t: string): string {
	if (t === 'string') return 'z.string()';
	if (t === 'number') return 'z.number()';
	if (t === 'boolean') return 'z.boolean()';
	if (t === 'true') return 'z.literal(true)';
	if (t === 'false') return 'z.literal(false)';
	if (t === 'unknown') return 'z.unknown()';
	if (t === 'enum') return 'z.string()';
	if (t === '(string | number)') return 'z.union([z.string(), z.number()])';
	if (t.startsWith('Record<string'))
		return t.includes('number')
			? 'z.record(z.string(), z.number())'
			: 'z.record(z.string(), z.unknown())';
	if (t.startsWith('Array<{'))
		return 'z.array(z.strictObject({ objectId: z.string(), semanticVersion: z.number(), contentHash: z.string().optional() }))';
	if (ENUM.has(t)) {
		used.enums.add(t);
		return `${t}Schema`;
	}
	// ENV/OBJ hold the BARE names — the regexes above capture `(\w+)` before the literal `Schema`, so the set
	// contains 'ActorReference', not 'ActorReferenceSchema'. These two lookups appended 'Schema' and therefore
	// could NEVER hit: both branches were dead, and every payload field typed as an object or envelope schema
	// fell silently through to `z.unknown()`. Proof it was never reachable: the generated messages.ts imported
	// only from './enums.js' — never once from './objects.js' or './envelopes.js', across 70 commands and 122
	// events. Fixed 2026-07-16.
	//
	// WHAT THE FIX ACTUALLY BUYS — corrected after adversarial review caught the first accounting overstating
	// it (it counted each schema's IMPORT line as a reference). The honest figures, recomputed from the vocab:
	//
	//   66 payload fields now resolve to a named schema. Of those:
	//     34 -> a REAL z.strictObject   (18 on COMMAND payloads, 16 on EVENT payloads)
	//     32 -> a placeholder z.record  (15 command, 17 event) — still permissive, but see the caveat below
	//
	//   Only 18 are ACTUALLY ENFORCED. The write path has exactly two validateAgainst call sites:
	//   command-bus.ts (the COMMAND payload) and kit.ts (the resulting OBJECT STATE). No event payload is ever
	//   validated, so the 16 real schemas on event payloads are inert — a separate, pre-existing defect
	//   (the events registry is generated and unchecked), not something this fix creates or cures.
	//
	// CAVEAT, also missed the first time: `z.unknown()` -> `z.record(z.string(), z.unknown())` is NOT a no-op.
	// z.unknown() accepts a string, a number, null — anything. z.record requires an OBJECT. So the 32
	// "placeholder" fields did get a real (if weak) tightening: they now reject non-object values.
	if (ENV.has(t)) {
		used.env.add(`${t}Schema`);
		return `${t}Schema`;
	}
	if (OBJ.has(t)) {
		used.obj.add(`${t}Schema`);
		return `${t}Schema`;
	}
	return 'z.unknown()';
}

/**
 * ARRAY DETECTION MUST COME FIRST — the same bug lived here as in gen-objects.ts, and was found only because
 * fixing that one left these payloads still scalar. `if (enumRef) return zodEnumRefExpr(enumRef)` sat above the
 * `t.endsWith('[]')` check, so any field with both an enumRef and an array type silently lost its array. The
 * two generators had independently made the identical mistake; a fix to one is not a fix to the other.
 */
function zodExpr(type: string | undefined, enumRef?: string): string {
	let t = (type ?? 'unknown').trim();
	if (enumRef) {
		const base = zodEnumRefExpr(enumRef);
		return t.endsWith('[]') ? `z.array(${base})` : base;
	}
	const lit = zodLiteralExpr(t);
	if (lit !== undefined) return lit;
	let arr = false;
	if (t.endsWith('[]')) {
		arr = true;
		t = t.slice(0, -2).trim();
	}
	const expr = zodBaseExpr(t);
	return arr ? `z.array(${expr})` : expr;
}

function payloadLit(fields: Field[]): string {
	if (fields.length === 0) return 'z.strictObject({})';
	const lines = fields
		.map((f) => `\t${j(f.field)}: ${zodExpr(f.type, f.enumRef)}${f.required ? '' : '.optional()'}`)
		.join(',\n');
	return `z.strictObject({\n${lines}\n})`;
}

const body: string[] = [];

body.push('// ---- Command payload schemas ----');
for (const c of spec.commands) {
	body.push(
		`export const ${c.commandType}PayloadSchema = ${payloadLit(c.payloadFields)};`,
		`export type ${c.commandType}Payload = z.infer<typeof ${c.commandType}PayloadSchema>;`
	);
}
body.push('', '// ---- Event payload schemas ----');
for (const e of spec.events) {
	body.push(
		`export const ${e.eventType}PayloadSchema = ${payloadLit(e.payloadFields)};`,
		`export type ${e.eventType}Payload = z.infer<typeof ${e.eventType}PayloadSchema>;`
	);
}
body.push('');
const firstSlice = spec.firstSliceCommands ?? [];
body.push(
	`export const FIRST_SLICE_COMMANDS = [${firstSlice.map(j).join(', ')}] as const;`,
	'',
	'/** Registry: commandType -> payload schema + target aggregate + emitted event + first-slice flag. */',
	'export const COMMANDS = {'
);
for (const c of spec.commands) {
	body.push(
		`\t${j(c.commandType)}: { payload: ${c.commandType}PayloadSchema, targetAggregateType: ${j(c.targetAggregateType ?? '')}, emitsEvent: ${j(c.emitsEvent ?? '')}, firstSlice: ${firstSlice.includes(c.commandType)} },`
	);
}
body.push(
	'} as const;',
	'',
	'/** Registry: eventType -> payload schema + aggregate type. */',
	'export const EVENTS = {'
);
for (const e of spec.events) {
	body.push(
		`\t${j(e.eventType)}: { payload: ${e.eventType}PayloadSchema, aggregateType: ${j(e.aggregateType ?? '')} },`
	);
}
body.push('} as const;', '');

// RATIFIED_EVENT_PAYLOADS — the events whose payload the CORPUS actually schematizes.
//
// DERIVED FROM PROVENANCE, never hand-kept. An event is in iff BOTH hold:
//   (1) its vocab `sourceSection` exists and is NOT marked UNRATIFIED-AUTHORED. 92 of the 122 carry that marker
//       verbatim — "DOC-007 schematizes NO interface for this, so these fields were AUTHORED, not derived ... Do
//       NOT treat this sourceSection as proof the shape is ratified" (§16 item 6: the first slice deliberately
//       leaves the granular vocabulary unschematized); and
//   (2) it has at least one `payloadFields` entry. A CITATION IS NOT AN INTERFACE: the five PWA-authoring events
//       cite "RPH-DOC-010 (PWA authoring)", but that section ("# 20. PWA publication flow") is a state diagram —
//       it names no field. Their `payloadFields: []` emits `z.strictObject({})`, which means "nobody specified
//       this", NOT "this payload is empty". Condition (1) alone would let them in and the gate would then reject
//       PublishPwa for the extra key `rootPwuTypeId` — forcing a handler to STRIP a real field, recorded in the
//       object state, to satisfy the absence of a spec. That is the inverse of the defect this gate exists for.
//
// A hand-kept list would rot into exactly that. This one cannot: annotating a vocab entry UNRATIFIED-AUTHORED,
// or an entry having no payloadFields, removes it from enforcement on the next `bun run gen`.
body.push(
	'/** Payload schemas for the events the corpus actually SCHEMATIZES (vocab sourceSection present and not',
	' *  UNRATIFIED-AUTHORED). Derived from provenance by gen-messages — the kit gate enforces exactly these, so',
	' *  that marking an entry UNRATIFIED-AUTHORED in the vocab removes it from enforcement on the next gen. */',
	'export const RATIFIED_EVENT_PAYLOADS: Record<string, z.ZodType | undefined> = {'
);
for (const e of spec.events) {
	const src = (e as { sourceSection?: string }).sourceSection ?? '';
	if (!src || src.includes('UNRATIFIED-AUTHORED')) continue;
	if ((e.payloadFields ?? []).length === 0) continue; // a citation is not an interface — see above
	body.push(`\t${j(e.eventType)}: ${e.eventType}PayloadSchema,`);
}
body.push(
	'};',
	'',
	'export interface CommandEventBinding {',
	'\treadonly commandType: string;',
	'\treadonly eventType: string;',
	'\treadonly machine?: string;',
	'\treadonly from?: string;',
	'\treadonly to?: string;',
	'}'
);
// A command is authoritative for WHICH event it emits (DOC-007). Align each binding's eventType to the
// command's emitsEvent so the two never drift.
//
// This alignment is right, but note what it does: it SILENTLY RESOLVES a disagreement rather than reporting one.
// Until 2026-07-17 the vocab's command entry said MarkPwuReady -> PwuStateChanged while its own transitions table
// said MarkPwuReady -> PwuMarkedReady; this line overwrote the table with the command entry, so the generated
// output was self-consistent and the contradiction never surfaced. The command entry was the wrong side (the
// Reference Undertaking §26 worked trace emits PwuMarkedReady; PwuStateChanged appears in no trace), and the
// comment here previously rationalized the overwrite by calling PwuMarkedReady "a display alias" — a theory
// invented to explain away the very drift this line was erasing. A resolver that cannot dissent is a resolver
// that launders whichever side it was pointed at.
const emitsByCommand = new Map(spec.commands.map((c) => [c.commandType, c.emitsEvent ?? '']));
body.push(
	'/** The command -> event -> state-transition binding table. */',
	'export const BINDINGS: readonly CommandEventBinding[] = ['
);
for (const b of spec.bindings) {
	const eventType = emitsByCommand.get(b.commandType) || b.eventType;
	body.push(
		`\t{ commandType: ${j(b.commandType)}, eventType: ${j(eventType)}, machine: ${j(b.machine ?? '')}, from: ${j(b.from ?? '')}, to: ${j(b.to ?? '')} },`
	);
}
body.push('];');

const importLine = (names: Set<string>, mod: string) =>
	names.size
		? `import { ${[...names].sort((a, b) => Number(a > b) - Number(a < b)).join(', ')} } from '${mod}';`
		: '';

const header = [
	'// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:messages`.',
	'// Source: vocab/m3-commands-events.json (grounded from DOC-007 + DOC-002, reconciled). See gen/gen-messages.ts.',
	"import { z } from 'zod';",
	importLine(new Set([...used.enums].map((n) => `${n}Schema`)), './enums.js'),
	importLine(used.env, './envelopes.js'),
	importLine(used.obj, './objects.js'),
	''
].filter((l) => l !== '');

writeFileSync(OUT_PATH, [...header, '', ...body, ''].join('\n'));
console.log(
	`generated ${OUT_PATH}: ${spec.commands.length} commands, ${spec.events.length} events, ${spec.bindings.length} bindings`
);
