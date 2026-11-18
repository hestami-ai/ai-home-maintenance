// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.43; the lead's ruling 2) — THE TWO
// MAPPERS FROM THIS REPOSITORY'S `ParamSpec` ONTO PI'S TYPEBOX GIVE EVERY PARAMETER TYPE THE SAME KIND: the execution surface's (`pi-typebox.ts`) and
// the authoring agent's own copy (`pi-agent.ts`), whose last `else` maps a type it does not know to a string — so a type added to one and not the
// other would reach the model as a string there, and nothing would fail: the model would send a string the host then refuses. `read_earlier_attempt`'s
// `part` is the first integer parameter; `'integer'` is added to the vocabulary and to both.
// ⭑ A KIND IS READ AS TYPEBOX ITSELF RECORDS IT: its hidden `~kind`, an array's with its items', an object's with its properties', and `?` where it
// is optional (`~optional`). Pi takes the schema whole; no model is called.
import type { TSchema } from 'typebox';
import { describe, expect, it } from 'vitest';
import { toTypeBox as authoringToTypeBox } from './pi-agent.js';
import { toTypeBox as executionToTypeBox } from './pi-typebox.js';
import { PARAM_TYPES, type ParamSpec, type ParamType } from './types.js';

/** A schema's TypeBox kind, as TypeBox records it: `Integer`, `Array<String>`, `Array<Object{f:String}>`, with `?` where it is optional. */
const kindOf = (schema: TSchema): string => {
	const own = schema as unknown as Record<string, unknown>;
	const items = own.items as TSchema | undefined;
	const properties = own.properties as Record<string, TSchema> | undefined;
	const inner = items
		? `<${kindOf(items)}>`
		: properties
			? `{${Object.entries(properties)
					.map(([k, v]) => `${k}:${kindOf(v)}`)
					.join(',')}}`
			: '';
	return `${String(own['~kind'])}${inner}${own['~optional'] === true ? '?' : ''}`;
};

/** A spec of one parameter `p` of `type`, required or not; an `object[]`'s items one required string field `f`. */
const specOf = (type: ParamType, required: boolean): ParamSpec => ({
	p: { type, description: 'A parameter.', required, ...(type === 'object[]' ? { items: { f: { type: 'string', description: 'A field.', required: true } } } : {}) }
});

/** The kind a mapper gives `p`, for every parameter type in the vocabulary, required then optional. */
const kindsUnder = (map: (spec: ParamSpec) => TSchema): string[] => {
	const kinds: string[] = [];
	for (const type of PARAM_TYPES)
		for (const required of [true, false]) {
			const object = map(specOf(type, required)) as unknown as { properties: Record<string, TSchema> };
			kinds.push(`${type}${required ? '' : ' (optional)'}: ${kindOf(object.properties.p!)}`);
		}
	return kinds;
};

describe('⭐⭐ L17b3 (D89; the lead’s ruling 2) — the authoring agent’s mapper and the execution surface’s give every parameter type the same TypeBox kind', () => {
	it('⛔ RED FIRST — for every ParamType value, required and optional, the two mappers give the same kind, and each the kind its type names', () => {
		const execution = kindsUnder(executionToTypeBox);
		expect(kindsUnder(authoringToTypeBox), 'the authoring agent’s mapper and the execution surface’s give a parameter type different kinds').toEqual(execution);
		expect(execution, 'a parameter type is mapped to a kind it does not name').toEqual([
			'string: String',
			'string (optional): String?',
			'boolean: Boolean',
			'boolean (optional): Boolean?',
			'string[]: Array<String>',
			'string[] (optional): Array<String>?',
			'object[]: Array<Object{f:String}>',
			'object[] (optional): Array<Object{f:String}>?',
			'integer: Integer',
			'integer (optional): Integer?'
		]);
	});

	it('⛔ RED FIRST — `integer` is an integer to the model in both mappers, never the string their last else gives a type it does not know', () => {
		const part: ParamSpec = { part: { type: 'integer', description: 'The part to read.', required: false } };
		const authoring = authoringToTypeBox(part) as unknown as { properties: Record<string, TSchema> };
		const execution = executionToTypeBox(part) as unknown as { properties: Record<string, TSchema> };
		expect([kindOf(authoring.properties.part!), kindOf(execution.properties.part!)], 'an integer parameter does not reach the model as an integer from both mappers').toEqual([
			'Integer?',
			'Integer?'
		]);
	});
});
