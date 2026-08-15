import { isProxy } from 'node:util/types';

export const STRICT_SOURCE_MAP_V3_DECODER_VERSION =
	'jan-csaa-strict-source-map-v3-decoder/1.0.0' as const;

/** Hard implementation ceilings apply even when a caller requests a larger budget. */
export const SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS = Object.freeze({
	maxGeneratedLines: 1_000_000,
	maxInputCharacters: 8 * 1024 * 1024,
	maxMappingsCharacters: 4 * 1024 * 1024,
	maxPathCharacters: 16_384,
	maxSegments: 500_000
} as const);

export interface SourceMapV3DecodeLimits {
	readonly maxCoordinate: number;
	readonly maxGeneratedLines: number;
	readonly maxInputCharacters: number;
	readonly maxMappingsCharacters: number;
	readonly maxPathCharacters: number;
	readonly maxSegments: number;
	readonly maxVlqDigits: number;
}

export interface SourceMapV3DecodeOptions {
	/** Called at bounded checkpoints. Exceptions intentionally abort decoding. */
	readonly onProgress?: () => void;
}

export interface DecodedSourceMapV3Segment {
	readonly generatedColumn: number;
	readonly generatedLine: number;
	readonly ordinal: number;
	readonly originalColumn: number;
	readonly originalLine: number;
	readonly sourceIndex: 0;
}

/** The exact regular-map subset accepted by this provider. */
export interface DecodedSourceMapV3 {
	readonly decoderVersion: typeof STRICT_SOURCE_MAP_V3_DECODER_VERSION;
	readonly file: string;
	readonly generatedLines: number;
	readonly mappings: string;
	readonly names: readonly [];
	readonly segmentCount: number;
	readonly segments: readonly DecodedSourceMapV3Segment[];
	readonly source: string;
	readonly sourceRoot: '';
	readonly sources: readonly [string];
	readonly version: 3;
}

export type SourceMapV3DecodeErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'INPUT_INVALID'
	| 'JSON_INVALID'
	| 'MAPPINGS_INVALID'
	| 'SHAPE_INVALID'
	| 'VLQ_INVALID';

export class SourceMapV3DecodeError extends Error {
	constructor(
		readonly code: SourceMapV3DecodeErrorCode,
		message: string,
		readonly offset: number | null = null
	) {
		super(message);
		this.name = 'SourceMapV3DecodeError';
	}
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PROFILE_KEYS = Object.freeze([
	'file',
	'mappings',
	'names',
	'sourceRoot',
	'sources',
	'version'
] as const);
const LIMIT_KEYS = Object.freeze([
	'maxCoordinate',
	'maxGeneratedLines',
	'maxInputCharacters',
	'maxMappingsCharacters',
	'maxPathCharacters',
	'maxSegments',
	'maxVlqDigits'
] as const);
const MAX_SOURCE_MAP_VLQ_DIGITS = 7;
const MAX_SOURCE_MAP_VLQ_UNSIGNED = 0x1_0000_0000;
const PROGRESS_CADENCE = 256;

interface Progress {
	readonly check: () => void;
	readonly finish: () => void;
	readonly step: () => void;
}

function fail(
	code: SourceMapV3DecodeErrorCode,
	message: string,
	offset: number | null = null
): never {
	throw new SourceMapV3DecodeError(code, message, offset);
}

function progress(onProgress: (() => void) | undefined): Progress {
	let pending = 0;
	onProgress?.();
	return {
		check(): void {
			onProgress?.();
		},
		finish(): void {
			onProgress?.();
		},
		step(): void {
			pending += 1;
			if (pending < PROGRESS_CADENCE) return;
			pending = 0;
			onProgress?.();
		}
	};
}

function exactOwnStringKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key))
	);
}

function validateLimits(value: unknown): SourceMapV3DecodeLimits {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
		!exactOwnStringKeys(value, LIMIT_KEYS)
	)
		fail('INPUT_INVALID', 'Source Map v3 decoder limits must be an inert exact-key plain object.');

	const limits = value as Readonly<Record<(typeof LIMIT_KEYS)[number], unknown>>;
	for (const key of LIMIT_KEYS) {
		const descriptor = Object.getOwnPropertyDescriptor(limits, key);
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'number' ||
			!Number.isSafeInteger(descriptor.value) ||
			descriptor.value < 0
		)
			fail(
				'INPUT_INVALID',
				`Source Map v3 decoder limit ${key} must be a nonnegative safe integer.`
			);
	}
	const checkedLimits = limits as Readonly<Record<(typeof LIMIT_KEYS)[number], number>>;
	if (checkedLimits.maxVlqDigits < 1 || checkedLimits.maxVlqDigits > MAX_SOURCE_MAP_VLQ_DIGITS)
		fail(
			'INPUT_INVALID',
			`Source Map v3 decoder maxVlqDigits must be between 1 and ${MAX_SOURCE_MAP_VLQ_DIGITS}.`
		);
	for (const key of [
		'maxGeneratedLines',
		'maxInputCharacters',
		'maxMappingsCharacters',
		'maxPathCharacters',
		'maxSegments'
	] as const) {
		if (checkedLimits[key] > SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS[key])
			fail(
				'INPUT_INVALID',
				`Source Map v3 decoder limit ${key} exceeds its implementation ceiling.`
			);
	}
	return Object.freeze({
		maxCoordinate: checkedLimits.maxCoordinate,
		maxGeneratedLines: checkedLimits.maxGeneratedLines,
		maxInputCharacters: checkedLimits.maxInputCharacters,
		maxMappingsCharacters: checkedLimits.maxMappingsCharacters,
		maxPathCharacters: checkedLimits.maxPathCharacters,
		maxSegments: checkedLimits.maxSegments,
		maxVlqDigits: checkedLimits.maxVlqDigits
	});
}

function scalarPathText(
	value: unknown,
	label: string,
	limits: SourceMapV3DecodeLimits,
	work: Progress
): string {
	if (typeof value !== 'string' || value.length === 0)
		fail('SHAPE_INVALID', `${label} must be one nonempty string.`);
	if (value.length > limits.maxPathCharacters)
		fail('BUDGET_EXCEEDED', `${label} exceeds maxPathCharacters.`);
	for (let index = 0; index < value.length; index += 1) {
		work.step();
		const code = value.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f)
			fail('SHAPE_INVALID', `${label} contains an unsupported control character.`);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff))
				fail('SHAPE_INVALID', `${label} must contain only Unicode scalar values.`);
			index += 1;
			work.step();
		} else if (code >= 0xdc00 && code <= 0xdfff)
			fail('SHAPE_INVALID', `${label} must contain only Unicode scalar values.`);
	}
	return value;
}

function relativeSourcePath(
	value: unknown,
	limits: SourceMapV3DecodeLimits,
	work: Progress
): string {
	const source = scalarPathText(value, 'Source Map sources[0]', limits, work);
	if (
		source.startsWith('/') ||
		source.startsWith('\\') ||
		source.includes('\\') ||
		source.includes('?') ||
		source.includes('#') ||
		/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(source)
	)
		fail(
			'SHAPE_INVALID',
			'Source Map sources[0] must be one relative, forward-slash, non-URL path.'
		);
	return source;
}

/**
 * JSON.parse retains only the last occurrence of a duplicate key. Scan the already-bounded JSON
 * text as well so the strict six-key profile cannot silently accept a duplicated top-level key.
 */
function topLevelKeys(text: string, work: Progress): readonly string[] {
	const keys: string[] = [];
	let braceDepth = 0;
	let bracketDepth = 0;
	let escaped = false;
	let inString = false;
	let stringStart = -1;

	for (let index = 0; index < text.length; index += 1) {
		work.step();
		const character = text[index]!;
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === '\\') {
				escaped = true;
				continue;
			}
			if (character !== '"') continue;
			inString = false;
			if (braceDepth !== 1 || bracketDepth !== 0) continue;
			let cursor = index + 1;
			while (cursor < text.length && /[\t\n\r ]/u.test(text[cursor]!)) {
				work.step();
				cursor += 1;
			}
			if (text[cursor] !== ':') continue;
			let key: string;
			work.check();
			try {
				key = JSON.parse(text.slice(stringStart, index + 1)) as string;
			} catch {
				work.check();
				fail('JSON_INVALID', 'Source Map JSON contains an invalid top-level key.', stringStart);
			}
			work.check();
			keys.push(key);
			if (keys.length > PROFILE_KEYS.length)
				fail('SHAPE_INVALID', 'Source Map JSON contains more than six top-level keys.');
			continue;
		}
		switch (character) {
			case '"':
				inString = true;
				stringStart = index;
				break;
			case '{':
				braceDepth += 1;
				break;
			case '}':
				braceDepth -= 1;
				break;
			case '[':
				bracketDepth += 1;
				break;
			case ']':
				bracketDepth -= 1;
				break;
		}
	}
	return keys;
}

function parseProfileShape(
	text: string,
	limits: SourceMapV3DecodeLimits,
	work: Progress
): {
	readonly file: string;
	readonly mappings: string;
	readonly source: string;
} {
	let parsed: unknown;
	work.check();
	try {
		parsed = JSON.parse(text);
	} catch {
		work.check();
		fail('JSON_INVALID', 'Source Map input is not valid JSON.');
	}
	work.check();
	if (
		parsed === null ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed) ||
		Object.getPrototypeOf(parsed) !== Object.prototype
	)
		fail('SHAPE_INVALID', 'Source Map JSON must be one object.');
	const object = parsed as Record<string, unknown>;
	const rawKeys = topLevelKeys(text, work);
	if (
		rawKeys.length !== PROFILE_KEYS.length ||
		!exactOwnStringKeys(object, PROFILE_KEYS) ||
		new Set(rawKeys).size !== rawKeys.length ||
		rawKeys.some((key) => !PROFILE_KEYS.includes(key as (typeof PROFILE_KEYS)[number]))
	)
		fail(
			'SHAPE_INVALID',
			'Source Map must have exactly version, file, sourceRoot, sources, names, and mappings once each.'
		);
	if (object.version !== 3) fail('SHAPE_INVALID', 'Source Map version must be the integer 3.');
	if (object.sourceRoot !== '')
		fail('SHAPE_INVALID', 'Source Map sourceRoot must be the empty string.');
	if (!Array.isArray(object.names) || object.names.length !== 0)
		fail('SHAPE_INVALID', 'Source Map names must be an empty array.');
	if (!Array.isArray(object.sources) || object.sources.length !== 1)
		fail('SHAPE_INVALID', 'Source Map sources must contain exactly one entry.');
	const file = scalarPathText(object.file, 'Source Map file', limits, work);
	const source = relativeSourcePath(object.sources[0], limits, work);
	if (typeof object.mappings !== 'string')
		fail('SHAPE_INVALID', 'Source Map mappings must be a string.');
	if (object.mappings.length > limits.maxMappingsCharacters)
		fail('BUDGET_EXCEEDED', 'Source Map mappings exceeds maxMappingsCharacters.');
	return { file, mappings: object.mappings, source };
}

function base64Digit(character: string, offset: number): number {
	const digit = BASE64_ALPHABET.indexOf(character);
	if (digit < 0)
		fail('VLQ_INVALID', 'Source Map mappings contains a non-base64 VLQ digit.', offset);
	return digit;
}

function encodeSignedVlq(value: number): string {
	let unsigned = value < 0 ? -value * 2 + 1 : value * 2;
	let encoded = '';
	do {
		let digit = unsigned % 32;
		unsigned = Math.floor(unsigned / 32);
		if (unsigned > 0) digit += 32;
		encoded += BASE64_ALPHABET[digit]!;
	} while (unsigned > 0);
	return encoded;
}

function decodeVlq(
	mappings: string,
	start: number,
	limits: SourceMapV3DecodeLimits,
	work: Progress
): { readonly next: number; readonly value: number } {
	let factor = 1;
	let index = start;
	let unsigned = 0;
	let digits = 0;
	for (;;) {
		if (index >= mappings.length || mappings[index] === ',' || mappings[index] === ';')
			fail('VLQ_INVALID', 'Source Map mappings contains an unterminated VLQ.', start);
		work.step();
		const digit = base64Digit(mappings[index]!, index);
		digits += 1;
		if (digits > limits.maxVlqDigits)
			fail('BUDGET_EXCEEDED', 'Source Map VLQ exceeds maxVlqDigits.', start);
		const payload = digit & 31;
		const contribution = payload * factor;
		if (!Number.isSafeInteger(contribution) || !Number.isSafeInteger(unsigned + contribution))
			fail('VLQ_INVALID', 'Source Map VLQ exceeds safe-integer representation.', start);
		unsigned += contribution;
		index += 1;
		if ((digit & 32) === 0) break;
		factor *= 32;
		if (!Number.isSafeInteger(factor))
			fail('VLQ_INVALID', 'Source Map VLQ exceeds safe-integer representation.', start);
	}
	if (unsigned >= MAX_SOURCE_MAP_VLQ_UNSIGNED)
		fail('VLQ_INVALID', 'Source Map VLQ exceeds the Source Map v3 32-bit domain.', start);
	if (unsigned === 1)
		fail('VLQ_INVALID', 'Source Map selected profile rejects the negative-zero VLQ.', start);
	const negative = unsigned % 2 === 1;
	const magnitude = Math.floor(unsigned / 2);
	const value = negative ? -magnitude : magnitude;
	if (mappings.slice(start, index) !== encodeSignedVlq(value))
		fail('VLQ_INVALID', 'Source Map VLQ is not in canonical shortest form.', start);
	return { next: index, value };
}

function boundedCoordinate(
	prior: number,
	delta: number,
	label: string,
	limits: SourceMapV3DecodeLimits,
	offset: number
): number {
	const value = prior + delta;
	if (!Number.isSafeInteger(value))
		fail('MAPPINGS_INVALID', `${label} exceeds safe-integer representation.`, offset);
	if (value < 0) fail('MAPPINGS_INVALID', `${label} must remain nonnegative.`, offset);
	if (value > limits.maxCoordinate)
		fail('BUDGET_EXCEEDED', `${label} exceeds maxCoordinate.`, offset);
	return value;
}

function decodeMappings(
	mappings: string,
	limits: SourceMapV3DecodeLimits,
	work: Progress
): {
	readonly generatedLines: number;
	readonly segments: readonly DecodedSourceMapV3Segment[];
} {
	const segments: DecodedSourceMapV3Segment[] = [];
	let generatedColumn = 0;
	let generatedLine = 0;
	let index = 0;
	let originalColumn = 0;
	let originalLine = 0;
	let segmentsOnLine = 0;
	let sourceIndex = 0;
	if (limits.maxGeneratedLines < 1)
		fail('BUDGET_EXCEEDED', 'Source Map mappings exceeds maxGeneratedLines.');

	while (index < mappings.length) {
		work.step();
		if (mappings[index] === ';') {
			generatedLine += 1;
			if (generatedLine + 1 > limits.maxGeneratedLines)
				fail('BUDGET_EXCEEDED', 'Source Map mappings exceeds maxGeneratedLines.', index);
			generatedColumn = 0;
			segmentsOnLine = 0;
			index += 1;
			continue;
		}
		if (mappings[index] === ',')
			fail('MAPPINGS_INVALID', 'Source Map mappings contains an empty segment.', index);
		if (segments.length >= limits.maxSegments)
			fail('BUDGET_EXCEEDED', 'Source Map mappings exceeds maxSegments.', index);

		const segmentOffset = index;
		const fields: number[] = [];
		while (index < mappings.length && mappings[index] !== ',' && mappings[index] !== ';') {
			if (fields.length >= 4)
				fail(
					'MAPPINGS_INVALID',
					'Source Map selected profile accepts only four-field mapped segments.',
					segmentOffset
				);
			const decoded = decodeVlq(mappings, index, limits, work);
			fields.push(decoded.value);
			index = decoded.next;
		}
		if (fields.length !== 4)
			fail(
				'MAPPINGS_INVALID',
				'Source Map selected profile accepts only four-field mapped segments.',
				segmentOffset
			);

		const nextGeneratedColumn = boundedCoordinate(
			generatedColumn,
			fields[0]!,
			'Source Map generated column',
			limits,
			segmentOffset
		);
		if (segmentsOnLine > 0 && nextGeneratedColumn <= generatedColumn)
			fail(
				'MAPPINGS_INVALID',
				'Source Map generated columns must be strictly increasing within each line.',
				segmentOffset
			);
		generatedColumn = nextGeneratedColumn;
		sourceIndex = boundedCoordinate(
			sourceIndex,
			fields[1]!,
			'Source Map source index',
			limits,
			segmentOffset
		);
		if (sourceIndex !== 0)
			fail(
				'MAPPINGS_INVALID',
				'Source Map segment source index must identify sources[0].',
				segmentOffset
			);
		originalLine = boundedCoordinate(
			originalLine,
			fields[2]!,
			'Source Map original line',
			limits,
			segmentOffset
		);
		originalColumn = boundedCoordinate(
			originalColumn,
			fields[3]!,
			'Source Map original column',
			limits,
			segmentOffset
		);
		segments.push(
			Object.freeze({
				generatedColumn,
				generatedLine,
				ordinal: segments.length,
				originalColumn,
				originalLine,
				sourceIndex: 0 as const
			})
		);
		segmentsOnLine += 1;

		if (index >= mappings.length) break;
		if (mappings[index] === ',') {
			index += 1;
			if (index >= mappings.length || mappings[index] === ',' || mappings[index] === ';')
				fail('MAPPINGS_INVALID', 'Source Map mappings contains an empty segment.', index);
		}
	}
	if (segments.length === 0)
		fail('MAPPINGS_INVALID', 'Source Map selected profile requires at least one mapped segment.');
	work.check();
	const frozenSegments = Object.freeze(segments);
	work.check();
	return { generatedLines: generatedLine + 1, segments: frozenSegments };
}

/**
 * Decodes a deliberately narrow Source Map v3 regular-map profile without filesystem or URL
 * interpretation. The caller remains responsible for resolving and content-binding the returned
 * relative source path to an exact captured artifact.
 */
export function decodeSourceMapV3(
	textValue: unknown,
	limitsValue: unknown,
	options: SourceMapV3DecodeOptions = {}
): DecodedSourceMapV3 {
	if (typeof textValue !== 'string')
		fail('INPUT_INVALID', 'Source Map v3 decoder input must be a string.');
	const limits = validateLimits(limitsValue);
	if (textValue.length > limits.maxInputCharacters)
		fail('BUDGET_EXCEEDED', 'Source Map input exceeds maxInputCharacters.');
	const work = progress(options.onProgress);
	const profile = parseProfileShape(textValue, limits, work);
	const decoded = decodeMappings(profile.mappings, limits, work);
	work.check();
	const sources = Object.freeze([profile.source] as const);
	work.check();
	const names = Object.freeze([]) as readonly [];
	work.check();
	const result = Object.freeze({
		decoderVersion: STRICT_SOURCE_MAP_V3_DECODER_VERSION,
		file: profile.file,
		generatedLines: decoded.generatedLines,
		mappings: profile.mappings,
		names,
		segmentCount: decoded.segments.length,
		segments: decoded.segments,
		source: profile.source,
		sourceRoot: '' as const,
		sources,
		version: 3 as const
	});
	work.check();
	work.finish();
	return result;
}
