import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ID_PREFIXES, isRphId, mintId, parseRphId } from './ids.js';

const vocab = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'canonical-vocabulary.json'),
		'utf8'
	)
) as { idPrefixRegistry: { objectType: string; prefix: string }[] };

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('ids', () => {
	it('mints a prefixed ULID id', () => {
		expect(mintId('INTENT', () => ULID)).toBe(`int_${ULID}`);
		expect(isRphId(`pwu_${ULID}`)).toBe(true);
	});

	it('parses prefix + ulid, or null on malformed', () => {
		expect(parseRphId(`pwu_${ULID}`)).toEqual({ prefix: 'pwu', ulid: ULID });
		expect(parseRphId('nope')).toBeNull();
	});

	it('rejects malformed ids', () => {
		expect(isRphId('int_short')).toBe(false);
		expect(isRphId(`INT_${ULID}`)).toBe(false); // uppercase prefix
		expect(isRphId(`int_${ULID}I`)).toBe(false); // ULID contains disallowed I / wrong length
		expect(isRphId(123)).toBe(false);
	});

	it('prefix registry matches the ratified vocabulary', () => {
		const fromVocab = Object.fromEntries(
			vocab.idPrefixRegistry.map((p) => [p.objectType, p.prefix])
		);
		expect({ ...ID_PREFIXES }).toEqual(fromVocab);
	});
});
