import { describe, expect, it } from 'vitest';

import {
	decodeSourceMapV3,
	SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS,
	SourceMapV3DecodeError,
	STRICT_SOURCE_MAP_V3_DECODER_VERSION,
	type SourceMapV3DecodeLimits
} from './decode-source-map-v3.js';

const REAL_TYPESCRIPT_DECLARATION_MAP =
	'{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../src/index.ts"],"names":[],"mappings":"AAAA,MAAM,WAAW,CAAC;IAAG,CAAC,EAAE,MAAM,CAAA;CAAE"}';

function limits(overrides: Partial<SourceMapV3DecodeLimits> = {}): SourceMapV3DecodeLimits {
	return {
		maxCoordinate: 1_000_000,
		maxGeneratedLines: 10_000,
		maxInputCharacters: 1_000_000,
		maxMappingsCharacters: 1_000_000,
		maxPathCharacters: 4_096,
		maxSegments: 100_000,
		maxVlqDigits: 7,
		...overrides
	};
}

function map(mappings: string, overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		file: 'index.d.ts',
		mappings,
		names: [],
		sourceRoot: '',
		sources: ['../src/index.ts'],
		version: 3,
		...overrides
	});
}

function failure(
	operation: () => unknown,
	code: SourceMapV3DecodeError['code']
): SourceMapV3DecodeError {
	try {
		operation();
	} catch (error) {
		expect(error).toBeInstanceOf(SourceMapV3DecodeError);
		const typed = error as SourceMapV3DecodeError;
		expect(typed.code).toBe(code);
		return typed;
	}
	throw new Error('Expected SourceMapV3DecodeError.');
}

describe('strict Source Map v3 decoder', () => {
	it('decodes and freezes a real TypeScript declaration map without inferring ranges', () => {
		const decoded = decodeSourceMapV3(REAL_TYPESCRIPT_DECLARATION_MAP, limits());

		expect(decoded.decoderVersion).toBe(STRICT_SOURCE_MAP_V3_DECODER_VERSION);
		expect(decoded).toMatchObject({
			file: 'index.d.ts',
			generatedLines: 3,
			names: [],
			source: '../src/index.ts',
			sourceRoot: '',
			sources: ['../src/index.ts'],
			version: 3
		});
		expect(decoded.segmentCount).toBe(10);
		expect(decoded.segments[0]).toEqual({
			generatedColumn: 0,
			generatedLine: 0,
			ordinal: 0,
			originalColumn: 0,
			originalLine: 0,
			sourceIndex: 0
		});
		expect(decoded.segments.at(-1)).toEqual({
			generatedColumn: 1,
			generatedLine: 2,
			ordinal: 9,
			originalColumn: 32,
			originalLine: 0,
			sourceIndex: 0
		});
		expect(Object.isFrozen(decoded)).toBe(true);
		expect(Object.isFrozen(decoded.sources)).toBe(true);
		expect(Object.isFrozen(decoded.segments)).toBe(true);
		expect(decoded.segments.every(Object.isFrozen)).toBe(true);
	});

	it('accepts canonical multi-digit and signed deltas while retaining full point coordinates', () => {
		const decoded = decodeSourceMapV3(map('iBAAA,CACA'), limits());
		expect(decoded.segments).toEqual([
			{
				generatedColumn: 17,
				generatedLine: 0,
				ordinal: 0,
				originalColumn: 0,
				originalLine: 0,
				sourceIndex: 0
			},
			{
				generatedColumn: 18,
				generatedLine: 0,
				ordinal: 1,
				originalColumn: 0,
				originalLine: 1,
				sourceIndex: 0
			}
		]);
	});

	it.each([
		['overlong zero', 'gAAAA', 'VLQ_INVALID'],
		['unterminated continuation', 'g', 'VLQ_INVALID'],
		['invalid alphabet', '!AAA', 'VLQ_INVALID'],
		['32-bit overflow', 'ggggggEAAA', 'VLQ_INVALID'],
		['negative zero', 'BAAA', 'VLQ_INVALID']
	] as const)('rejects %s VLQ tokens', (_label, mappings, code) => {
		failure(() => decodeSourceMapV3(map(mappings), limits()), code);
	});

	it.each([
		['one field', 'A'],
		['two fields', 'AA'],
		['three fields', 'AAA'],
		['five fields', 'AAAAA'],
		['leading empty segment', ',AAAA'],
		['trailing empty segment', 'AAAA,'],
		['interior empty segment', 'AAAA,,CAAA'],
		['comma before line break', 'AAAA,;CAAA'],
		['empty mapping population', ''],
		['empty generated lines only', ';;']
	] as const)('rejects %s', (_label, mappings) => {
		failure(() => decodeSourceMapV3(map(mappings), limits()), 'MAPPINGS_INVALID');
	});

	it('requires strictly increasing generated columns while allowing empty generated lines', () => {
		failure(() => decodeSourceMapV3(map('AAAA,AAAA'), limits()), 'MAPPINGS_INVALID');
		const decoded = decodeSourceMapV3(map(';AAAA;;CAAA'), limits());
		expect(decoded.generatedLines).toBe(4);
		expect(
			decoded.segments.map(({ generatedLine, generatedColumn }) => [generatedLine, generatedColumn])
		).toEqual([
			[1, 0],
			[3, 1]
		]);
	});

	it('requires the source-index accumulator to identify the single declared source', () => {
		failure(() => decodeSourceMapV3(map('ACAA'), limits()), 'MAPPINGS_INVALID');
	});

	it.each([
		['not JSON', '{', 'JSON_INVALID'],
		['not an object', '[]', 'SHAPE_INVALID'],
		['wrong version', map('AAAA', { version: 2 }), 'SHAPE_INVALID'],
		['nonempty sourceRoot', map('AAAA', { sourceRoot: '../src/' }), 'SHAPE_INVALID'],
		['missing source', map('AAAA', { sources: [] }), 'SHAPE_INVALID'],
		['multiple sources', map('AAAA', { sources: ['a.ts', 'b.ts'] }), 'SHAPE_INVALID'],
		['nonempty names', map('AAAA', { names: ['name'] }), 'SHAPE_INVALID'],
		['absolute source', map('AAAA', { sources: ['/src/index.ts'] }), 'SHAPE_INVALID'],
		['URL source', map('AAAA', { sources: ['file:///src/index.ts'] }), 'SHAPE_INVALID'],
		['backslash source', map('AAAA', { sources: ['..\\src\\index.ts'] }), 'SHAPE_INVALID'],
		['query source', map('AAAA', { sources: ['index.ts?v=1'] }), 'SHAPE_INVALID'],
		['non-string mappings', map('AAAA', { mappings: 1 }), 'SHAPE_INVALID'],
		['additional sourcesContent', map('AAAA', { sourcesContent: ['source'] }), 'SHAPE_INVALID'],
		['index-map sections', map('AAAA', { sections: [] }), 'SHAPE_INVALID']
	] as const)('rejects malformed or out-of-profile shape: %s', (_label, input, code) => {
		failure(() => decodeSourceMapV3(input, limits()), code);
	});

	it('rejects duplicate top-level keys before JSON overwrite semantics can hide them', () => {
		const duplicate =
			'{"version":3,"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../src/index.ts"],"names":[],"mappings":"AAAA"}';
		failure(() => decodeSourceMapV3(duplicate, limits()), 'SHAPE_INVALID');
	});

	it('rejects non-scalar and control-bearing path fields', () => {
		failure(() => decodeSourceMapV3(map('AAAA', { file: '\ud800' }), limits()), 'SHAPE_INVALID');
		failure(
			() => decodeSourceMapV3(map('AAAA', { sources: ['../src/line\nfeed.ts'] }), limits()),
			'SHAPE_INVALID'
		);
	});

	it.each([
		['input characters', limits({ maxInputCharacters: 1 })],
		['mappings characters', limits({ maxMappingsCharacters: 3 })],
		['path characters', limits({ maxPathCharacters: 3 })],
		['segments', limits({ maxSegments: 0 })],
		['generated lines', limits({ maxGeneratedLines: 1 })],
		['coordinate', limits({ maxCoordinate: 16 })],
		['VLQ digits', limits({ maxVlqDigits: 1 })]
	] as const)('fails closed on the %s budget', (label, constrained) => {
		const input =
			label === 'generated lines'
				? map('AAAA;AAAA')
				: label === 'coordinate' || label === 'VLQ digits'
					? map('iBAAA')
					: map('AAAA');
		failure(() => decodeSourceMapV3(input, constrained), 'BUDGET_EXCEEDED');
	});

	it('rejects unsafe accumulators before emitting a segment', () => {
		// +2^31-1, then another +2^31-1 exceeds the selected coordinate ceiling.
		failure(() => decodeSourceMapV3(map('+/////DAAA,+/////DAAA'), limits()), 'BUDGET_EXCEEDED');
	});

	it('validates the exact inert limits shape', () => {
		failure(() => decodeSourceMapV3(map('AAAA'), { ...limits(), extra: 1 }), 'INPUT_INVALID');
		failure(
			() => decodeSourceMapV3(map('AAAA'), { ...limits(), maxVlqDigits: 8 }),
			'INPUT_INVALID'
		);
		failure(() => decodeSourceMapV3(new Uint8Array(), limits()), 'INPUT_INVALID');
	});

	it.each([
		['maxGeneratedLines', SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxGeneratedLines + 1],
		['maxInputCharacters', SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxInputCharacters + 1],
		[
			'maxMappingsCharacters',
			SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxMappingsCharacters + 1
		],
		['maxPathCharacters', SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxPathCharacters + 1],
		['maxSegments', SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxSegments + 1]
	] as const)('refuses a caller %s limit above the implementation ceiling', (key, value) => {
		failure(() => decodeSourceMapV3(map('AAAA'), { ...limits(), [key]: value }), 'INPUT_INVALID');
	});

	it('fails immediately after a seventh top-level key', () => {
		let checkpoints = 0;
		const tooManyKeys =
			'{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../src/index.ts"],"names":[],"mappings":"AAAA","seventh":1,"attackerTail":"' +
			'x'.repeat(4_096) +
			'"}';
		failure(
			() =>
				decodeSourceMapV3(tooManyKeys, limits(), {
					onProgress() {
						checkpoints += 1;
					}
				}),
			'SHAPE_INVALID'
		);
		// Atomic JSON parses are immediately bracketed; the key scanner still avoids the tail.
		expect(checkpoints).toBeGreaterThan(1);
		expect(checkpoints).toBeLessThan(100);
	});

	it('reports bounded progress and propagates caller cancellation', () => {
		let checkpoints = 0;
		decodeSourceMapV3(REAL_TYPESCRIPT_DECLARATION_MAP, limits(), {
			onProgress() {
				checkpoints += 1;
			}
		});
		expect(checkpoints).toBeGreaterThanOrEqual(2);

		const cancellation = new Error('cancelled');
		expect(() =>
			decodeSourceMapV3(REAL_TYPESCRIPT_DECLARATION_MAP, limits(), {
				onProgress() {
					throw cancellation;
				}
			})
		).toThrow(cancellation);

		let lateCheckpoints = 0;
		const finalMaterializationCancellation = new Error('cancelled after final materialization');
		expect(() =>
			decodeSourceMapV3(REAL_TYPESCRIPT_DECLARATION_MAP, limits(), {
				onProgress() {
					lateCheckpoints += 1;
					if (lateCheckpoints === checkpoints - 1) throw finalMaterializationCancellation;
				}
			})
		).toThrow(finalMaterializationCancellation);
		expect(lateCheckpoints).toBe(checkpoints - 1);
	});

	it('covers strict scalar and zero-line boundary refusals', () => {
		failure(
			() => decodeSourceMapV3(REAL_TYPESCRIPT_DECLARATION_MAP, limits({ maxSegments: -1 })),
			'INPUT_INVALID'
		);
		failure(() => decodeSourceMapV3(map('AAAA', { file: '' }), limits()), 'SHAPE_INVALID');
		const scalar = decodeSourceMapV3(map('AAAA', { file: '😀.d.ts' }), limits());
		expect(scalar.file).toBe('😀.d.ts');
		failure(() => decodeSourceMapV3(map('AAAA', { file: '\udc00' }), limits()), 'SHAPE_INVALID');
		failure(() => decodeSourceMapV3('{"version":3}', limits()), 'SHAPE_INVALID');
		failure(() => decodeSourceMapV3(map('DAAA'), limits()), 'MAPPINGS_INVALID');
		failure(
			() => decodeSourceMapV3(map('AAAA'), limits({ maxGeneratedLines: 0 })),
			'BUDGET_EXCEEDED'
		);
	});
});
