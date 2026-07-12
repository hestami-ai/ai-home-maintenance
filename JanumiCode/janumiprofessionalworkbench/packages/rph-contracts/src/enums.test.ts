// Fidelity guard: the generated enums must exactly match the ratified canonical vocabulary. This makes
// vocab/canonical-vocabulary.json the oracle and enums.ts the implementation, and fails loudly on drift
// (e.g. if enums.ts is hand-edited or the generator regresses). Constitution: every requirement produces evidence.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CANONICAL_ENUM_SCHEMAS } from './enums.js';

const vocabPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'vocab',
	'canonical-vocabulary.json'
);
const vocab = JSON.parse(readFileSync(vocabPath, 'utf8')) as {
	canonicalEnums: { name: string; values: string[] }[];
};
const nonFinding = vocab.canonicalEnums.filter((e) => !e.name.startsWith('Finding.'));
const registry = CANONICAL_ENUM_SCHEMAS as unknown as Record<
	string,
	{ options: readonly string[] }
>;

describe('generated enums fidelity', () => {
	it('exports exactly the non-Finding canonical enums', () => {
		expect(Object.keys(registry).sort()).toEqual(nonFinding.map((e) => e.name).sort());
	});

	it.each(nonFinding.map((e) => [e.name, e.values] as const))(
		'%s matches the ratified value set (order-preserving)',
		(name, values) => {
			const schema = registry[name];
			expect(schema, `missing enum ${name}`).toBeDefined();
			expect([...schema!.options]).toEqual(values);
		}
	);
});
