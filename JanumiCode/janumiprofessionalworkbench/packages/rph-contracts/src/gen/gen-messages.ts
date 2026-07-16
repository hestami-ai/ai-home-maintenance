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
	// events. Fixed 2026-07-16; this newly resolves 66 payload fields across 32 types, incl. ActorReference on
	// 9 payloads (the actor on a command was accepted unvalidated) and CapabilityGrant on 3.
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

function zodExpr(type: string | undefined, enumRef?: string): string {
	if (enumRef) return zodEnumRefExpr(enumRef);
	let t = (type ?? 'unknown').trim();
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
body.push(
	'} as const;',
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
// command's emitsEvent so the two never drift (e.g. MarkPwuReady -> PwuStateChanged, the event that carries
// a payload schema; the semantic name PwuMarkedReady is a display alias — see OPEN-QUESTIONS).
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
