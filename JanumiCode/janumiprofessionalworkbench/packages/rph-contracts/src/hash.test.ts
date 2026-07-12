import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHash, CanonicalJsonError, sha256Hex } from './hash.js';

describe('canonicalJson', () => {
	it('sorts object keys by code unit', () => {
		expect(canonicalJson({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
	});

	it('sorts nested object keys recursively', () => {
		expect(canonicalJson({ z: { y: 1, x: 2 }, a: [3, 2, 1] })).toBe(
			'{"a":[3,2,1],"z":{"x":2,"y":1}}'
		);
	});

	it('preserves array order (arrays are ordered)', () => {
		expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
	});

	it('omits undefined-valued keys but keeps null', () => {
		expect(canonicalJson({ a: undefined, b: null, c: 1 })).toBe('{"b":null,"c":1}');
	});

	it('is stable regardless of key insertion order', () => {
		expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
	});

	it('escapes strings as JSON', () => {
		expect(canonicalJson({ s: 'a"b\\c\n' })).toBe('{"s":"a\\"b\\\\c\\n"}');
	});

	it('handles unicode content', () => {
		expect(canonicalJson({ ключ: 'значение' })).toBe('{"ключ":"значение"}');
	});

	it('serializes bigint as its decimal string', () => {
		expect(canonicalJson({ n: 10n })).toBe('{"n":10}');
	});

	it('rejects non-integer numbers', () => {
		expect(() => canonicalJson({ n: 1.5 })).toThrow(CanonicalJsonError);
	});

	it('rejects non-finite numbers', () => {
		expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow(CanonicalJsonError);
	});

	it('rejects non-plain objects (Date/Map/class instances)', () => {
		expect(() => canonicalJson({ d: new Date(0) })).toThrow(CanonicalJsonError);
	});
});

describe('contentHash', () => {
	it('is prefixed with the algorithm', () => {
		expect(contentHash({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it('is deterministic across key order (identity binding stability)', () => {
		expect(contentHash({ a: 1, b: { c: 2, d: 3 } })).toBe(contentHash({ b: { d: 3, c: 2 }, a: 1 }));
	});

	it('changes when a value changes', () => {
		expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
	});

	it('distinguishes structurally different content', () => {
		expect(contentHash({ a: [1, 2] })).not.toBe(contentHash({ a: [2, 1] }));
	});

	it('matches a known SHA-256 vector', () => {
		// sha256("{}") canonical of {} is "{}"
		expect(sha256Hex('{}')).toBe(
			'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
		);
		expect(contentHash({})).toBe(
			'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
		);
	});
});
