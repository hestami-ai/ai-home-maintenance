import { isProxy } from 'node:util/types';
import { VERSION as svelteVersion, parse, type AST } from 'svelte/compiler';
import { svelte2tsx } from 'svelte2tsx';
import svelte2tsxPackage from 'svelte2tsx/package.json' with { type: 'json' };
import ts from 'typescript';

import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../../semantic/canonical.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';
import {
	decodeSourceMapV3,
	SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS,
	SourceMapV3DecodeError,
	STRICT_SOURCE_MAP_V3_DECODER_VERSION,
	type DecodedSourceMapV3
} from '../source-map/decode-source-map-v3.js';

export const SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION = 'jan-csaa-svelte-virtual-source/1.0.0' as const;
export const SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION = 'jan-csaa-svelte2tsx-adapter/1.0.0' as const;
export const SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE =
	'svelte-5-modern-ast-script-kind-svelte2tsx-ts-mode-no-template-recovery-strict-flat-source-map-v3/1.0.0' as const;
export const SVELTE_VIRTUAL_SOURCE_ID_PROFILE = 'jan-csaa-svelte-virtual-source-id/1.0.0' as const;
export const SVELTE_VIRTUAL_SOURCE_ROOT = '.csaa-virtual/svelte2tsx' as const;
export const SVELTE2TSX_SHIM_LOGICAL_PATH =
	'node_modules/svelte2tsx/svelte-shims-v4.d.ts' as const;

export const SVELTE_PROVIDER_VERSION = '5.56.4' as const;
export const SVELTE2TSX_PROVIDER_VERSION = '0.7.57' as const;
export const SVELTE_TYPESCRIPT_PROVIDER_VERSION = '5.9.3' as const;

/** Hard ceilings apply even when an operation requests a larger budget. */
export const SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS = Object.freeze({
	maxAuthoredBytes: 8 * 1024 * 1024,
	maxAuthoredCharacters: 8 * 1024 * 1024,
	maxGeneratedBytes: 32 * 1024 * 1024,
	maxGeneratedCharacters: 16 * 1024 * 1024,
	maxGeneratedLines: SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxGeneratedLines,
	maxMapCharacters: SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxMappingsCharacters,
	maxMapSegments: SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxSegments,
	maxPathCharacters: SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxPathCharacters
} as const);

export interface SvelteVirtualSourceLimits {
	readonly maxAuthoredBytes: number;
	readonly maxAuthoredCharacters: number;
	readonly maxGeneratedBytes: number;
	readonly maxGeneratedCharacters: number;
	readonly maxGeneratedLines: number;
	readonly maxMapCharacters: number;
	readonly maxMapSegments: number;
	readonly maxPathCharacters: number;
}

export interface SvelteVirtualSourceTransformInput {
	readonly authoredBytes: Readonly<Uint8Array>;
	readonly authoredLogicalPath: string;
	readonly limits: SvelteVirtualSourceLimits;
}

export interface SvelteVirtualSourceProviderIdentity {
	readonly adapter: 'svelte2tsx';
	readonly adapterVersion: typeof SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION;
	readonly svelteVersion: typeof SVELTE_PROVIDER_VERSION;
	readonly svelte2tsxVersion: typeof SVELTE2TSX_PROVIDER_VERSION;
	readonly typescriptVersion: typeof SVELTE_TYPESCRIPT_PROVIDER_VERSION;
}

export interface SvelteVirtualSourceDescriptor {
	readonly contentBytes: number;
	readonly contentCharacters: number;
	readonly contentSha256: string;
	readonly logicalPath: string;
}

export interface SvelteVirtualSourceMapEvidence {
	readonly canonicalJsonBytes: number;
	readonly canonicalJsonSha256: string;
	readonly decoderVersion: typeof STRICT_SOURCE_MAP_V3_DECODER_VERSION;
	readonly generatedLines: number;
	readonly mappingState: 'EXACT_SEGMENT_POINTS_ONLY';
	readonly segmentCount: number;
}

export interface SvelteVirtualSourceEvidence {
	readonly adapter: SvelteVirtualSourceProviderIdentity;
	readonly authored: SvelteVirtualSourceDescriptor & {
		readonly encoding: 'UTF8_WITHOUT_BOM';
		readonly origin: 'AUTHORED';
	};
	readonly id: string;
	readonly idProfile: typeof SVELTE_VIRTUAL_SOURCE_ID_PROFILE;
	readonly schemaVersion: typeof SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION;
	readonly sourceMap: SvelteVirtualSourceMapEvidence;
	readonly transformProfile: typeof SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE;
	readonly virtual: SvelteVirtualSourceDescriptor & {
		readonly origin: 'VIRTUAL';
		readonly scriptKind: 'JS' | 'TS';
	};
}

/**
 * In-memory derived output. Only `evidence` is intended for serialized identity; the text and map
 * are capability values consumed by the frozen compiler overlay and source-origin correlator.
 */
export interface SvelteVirtualSourceTransform {
	readonly evidence: SvelteVirtualSourceEvidence;
	readonly sourceMap: DecodedSourceMapV3;
	readonly sourceMapJson: string;
	readonly virtualSourceText: string;
}

export type SvelteVirtualSourceErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'INPUT_INVALID'
	| 'SOURCE_MAP_INVALID'
	| 'TRANSFORM_FAILED'
	| 'VERSION_MISMATCH';

export class SvelteVirtualSourceError extends Error {
	constructor(
		readonly code: SvelteVirtualSourceErrorCode,
		message: string,
		readonly logicalPath: string | null = null
	) {
		super(message);
		this.name = 'SvelteVirtualSourceError';
	}
}

const LIMIT_KEYS = Object.freeze([
	'maxAuthoredBytes',
	'maxAuthoredCharacters',
	'maxGeneratedBytes',
	'maxGeneratedCharacters',
	'maxGeneratedLines',
	'maxMapCharacters',
	'maxMapSegments',
	'maxPathCharacters'
] as const);

const PROVIDER_IDENTITY = Object.freeze({
	adapter: 'svelte2tsx' as const,
	adapterVersion: SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION,
	svelteVersion: SVELTE_PROVIDER_VERSION,
	svelte2tsxVersion: SVELTE2TSX_PROVIDER_VERSION,
	typescriptVersion: SVELTE_TYPESCRIPT_PROVIDER_VERSION
});

function fail(
	code: SvelteVirtualSourceErrorCode,
	message: string,
	logicalPath: string | null = null
): never {
	throw new SvelteVirtualSourceError(code, message, logicalPath);
}

function exactOwnStringKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key))
	);
}

function validateLimits(value: unknown): SvelteVirtualSourceLimits {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
		!exactOwnStringKeys(value, LIMIT_KEYS)
	)
		fail('INPUT_INVALID', 'Svelte virtual-source limits must be an inert exact-key plain object.');

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
				`Svelte virtual-source limit ${key} must be a nonnegative safe integer.`
			);
		if (
			typeof descriptor.value === 'number' &&
			descriptor.value > SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS[key]
		)
			fail(
				'INPUT_INVALID',
				`Svelte virtual-source limit ${key} exceeds its implementation ceiling.`
			);
	}
	return Object.freeze({ ...(limits as unknown as SvelteVirtualSourceLimits) });
}

function validateInput(value: unknown): {
	readonly authoredBytes: Uint8Array;
	readonly authoredLogicalPath: string;
	readonly limits: SvelteVirtualSourceLimits;
} {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
		!exactOwnStringKeys(value, ['authoredBytes', 'authoredLogicalPath', 'limits'])
	)
		fail('INPUT_INVALID', 'Svelte virtual-source input must be an inert exact-key plain object.');
	const record = value as Readonly<Record<string, unknown>>;
	const pathDescriptor = Object.getOwnPropertyDescriptor(record, 'authoredLogicalPath');
	const bytesDescriptor = Object.getOwnPropertyDescriptor(record, 'authoredBytes');
	const limitsDescriptor = Object.getOwnPropertyDescriptor(record, 'limits');
	if (
		pathDescriptor === undefined ||
		!pathDescriptor.enumerable ||
		!('value' in pathDescriptor) ||
		typeof pathDescriptor.value !== 'string' ||
		bytesDescriptor === undefined ||
		!bytesDescriptor.enumerable ||
		!('value' in bytesDescriptor) ||
		limitsDescriptor === undefined ||
		!limitsDescriptor.enumerable ||
		!('value' in limitsDescriptor)
	)
		fail('INPUT_INVALID', 'Svelte virtual-source input fields must be inert data properties.');
	const limits = validateLimits(limitsDescriptor.value);
	let authoredLogicalPath: string;
	try {
		authoredLogicalPath = assertCanonicalRelativePath(pathDescriptor.value);
	} catch {
		return fail('INPUT_INVALID', 'Authored Svelte path must be canonical and repository-relative.');
	}
	if (!authoredLogicalPath.toLowerCase().endsWith('.svelte'))
		fail('INPUT_INVALID', 'Authored Svelte path must use the .svelte extension.');
	if (
		authoredLogicalPath.length > limits.maxPathCharacters ||
		!isUnicodeScalarString(authoredLogicalPath)
	)
		fail('BUDGET_EXCEEDED', 'Authored Svelte path exceeds its supported scalar path budget.');

	const bytesValue = bytesDescriptor.value;
	if (
		!(bytesValue instanceof Uint8Array) ||
		isProxy(bytesValue) ||
		(Object.getPrototypeOf(bytesValue) !== Uint8Array.prototype && !Buffer.isBuffer(bytesValue)) ||
		!(bytesValue.buffer instanceof ArrayBuffer)
	)
		fail('INPUT_INVALID', 'Authored Svelte bytes must be one ordinary Uint8Array or Buffer.');
	if (bytesValue.byteLength > limits.maxAuthoredBytes)
		fail('BUDGET_EXCEEDED', 'Authored Svelte bytes exceed maxAuthoredBytes.', authoredLogicalPath);
	return {
		authoredBytes: Uint8Array.from(bytesValue),
		authoredLogicalPath,
		limits
	};
}

function decodeUtf8(
	bytes: Uint8Array,
	logicalPath: string,
	limits: SvelteVirtualSourceLimits
): string {
	if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
		fail(
			'INPUT_INVALID',
			'Svelte adapter selected profile requires UTF-8 without a byte-order mark.',
			logicalPath
		);
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return fail('INPUT_INVALID', 'Authored Svelte bytes are not valid UTF-8.', logicalPath);
	}
	if (text.length > limits.maxAuthoredCharacters)
		fail('BUDGET_EXCEEDED', 'Authored Svelte text exceeds maxAuthoredCharacters.', logicalPath);
	return text;
}

function assertProviderVersions(): void {
	if (
		svelteVersion !== SVELTE_PROVIDER_VERSION ||
		svelte2tsxPackage.version !== SVELTE2TSX_PROVIDER_VERSION ||
		ts.version !== SVELTE_TYPESCRIPT_PROVIDER_VERSION
	)
		fail(
			'VERSION_MISMATCH',
			`Svelte virtual-source adapter requires Svelte ${SVELTE_PROVIDER_VERSION}, svelte2tsx ${SVELTE2TSX_PROVIDER_VERSION}, and TypeScript ${SVELTE_TYPESCRIPT_PROVIDER_VERSION}.`
		);
}

function staticAttributeText(attribute: AST.Attribute): string | null {
	if (attribute.value === true || !Array.isArray(attribute.value) || attribute.value.length !== 1)
		return null;
	const value = attribute.value[0];
	return value?.type === 'Text' ? value.data : null;
}

function scriptKind(root: AST.Root): 'JS' | 'TS' {
	for (const script of [root.module, root.instance]) {
		if (
			script?.attributes.some((attribute) => {
				if (attribute.name.toLowerCase() !== 'lang') return false;
				const value = staticAttributeText(attribute)?.toLowerCase();
				return value === 'ts' || value === 'typescript';
			}) === true
		)
			return 'TS';
	}
	return 'JS';
}

export function svelteVirtualLogicalPath(
	authoredLogicalPathValue: unknown,
	scriptKindValue: unknown,
	maxPathCharacters: number = SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxPathCharacters
): string {
	if (
		typeof authoredLogicalPathValue !== 'string' ||
		(scriptKindValue !== 'JS' && scriptKindValue !== 'TS') ||
		!Number.isSafeInteger(maxPathCharacters) ||
		maxPathCharacters < 0 ||
		maxPathCharacters > SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxPathCharacters
	)
		fail('INPUT_INVALID', 'Virtual Svelte path request is invalid.');
	let authoredLogicalPath: string;
	try {
		authoredLogicalPath = assertCanonicalRelativePath(authoredLogicalPathValue);
	} catch {
		return fail('INPUT_INVALID', 'Authored Svelte path must be canonical and repository-relative.');
	}
	if (!authoredLogicalPath.toLowerCase().endsWith('.svelte'))
		fail('INPUT_INVALID', 'Authored Svelte path must use the .svelte extension.');
	const virtualPath = `${SVELTE_VIRTUAL_SOURCE_ROOT}/${authoredLogicalPath}.${scriptKindValue.toLowerCase()}`;
	if (virtualPath.length > maxPathCharacters)
		fail('BUDGET_EXCEEDED', 'Virtual Svelte path exceeds maxPathCharacters.', authoredLogicalPath);
	return assertCanonicalRelativePath(virtualPath);
}

interface RawSvelte2tsxMap {
	readonly mappings: string;
	readonly names: readonly unknown[];
	readonly sources: readonly unknown[];
	readonly sourcesContent?: readonly unknown[];
	readonly version: number;
}

function rawMapRecord(value: unknown, authoredLogicalPath: string): RawSvelte2tsxMap {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		fail('SOURCE_MAP_INVALID', 'svelte2tsx returned a malformed source map.', authoredLogicalPath);
	const record = value as Readonly<Record<string, unknown>>;
	if (
		record.version !== 3 ||
		typeof record.mappings !== 'string' ||
		!Array.isArray(record.names) ||
		record.names.length !== 0 ||
		!Array.isArray(record.sources) ||
		record.sources.length !== 1 ||
		record.sources[0] !== authoredLogicalPath ||
		(record.sourcesContent !== undefined &&
			(!Array.isArray(record.sourcesContent) || record.sourcesContent.length !== 1)) ||
		Object.hasOwn(record, 'sections')
	)
		fail(
			'SOURCE_MAP_INVALID',
			'svelte2tsx source map does not bind exactly one authored source.',
			authoredLogicalPath
		);
	return record as unknown as RawSvelte2tsxMap;
}

function canonicalSourceMap(
	mapValue: unknown,
	authoredLogicalPath: string,
	virtualLogicalPath: string,
	limits: SvelteVirtualSourceLimits
): { readonly decoded: DecodedSourceMapV3; readonly json: string } {
	let serialized: string;
	try {
		if (
			mapValue === null ||
			typeof mapValue !== 'object' ||
			typeof (mapValue as { readonly toString?: unknown }).toString !== 'function'
		)
			return fail(
				'SOURCE_MAP_INVALID',
				'svelte2tsx did not return a serializable source map.',
				authoredLogicalPath
			);
		serialized = (mapValue as { toString(): string }).toString();
	} catch (error) {
		if (error instanceof SvelteVirtualSourceError) throw error;
		return fail(
			'SOURCE_MAP_INVALID',
			'svelte2tsx source-map serialization failed.',
			authoredLogicalPath
		);
	}
	if (serialized.length > limits.maxMapCharacters)
		fail('BUDGET_EXCEEDED', 'svelte2tsx source map exceeds maxMapCharacters.', authoredLogicalPath);
	let parsed: unknown;
	try {
		parsed = JSON.parse(serialized);
	} catch {
		return fail(
			'SOURCE_MAP_INVALID',
			'svelte2tsx source map is not valid JSON.',
			authoredLogicalPath
		);
	}
	const raw = rawMapRecord(parsed, authoredLogicalPath);
	const canonicalJson = JSON.stringify({
		file: virtualLogicalPath,
		mappings: raw.mappings,
		names: [],
		sourceRoot: '',
		sources: [authoredLogicalPath],
		version: 3
	});
	if (canonicalJson.length > limits.maxMapCharacters)
		fail(
			'BUDGET_EXCEEDED',
			'Canonical Svelte source map exceeds maxMapCharacters.',
			authoredLogicalPath
		);
	try {
		return {
			decoded: decodeSourceMapV3(canonicalJson, {
				maxCoordinate: Math.max(limits.maxAuthoredCharacters, limits.maxGeneratedCharacters),
				maxGeneratedLines: limits.maxGeneratedLines,
				maxInputCharacters: limits.maxMapCharacters,
				maxMappingsCharacters: limits.maxMapCharacters,
				maxPathCharacters: limits.maxPathCharacters,
				maxSegments: limits.maxMapSegments,
				maxVlqDigits: 7
			}),
			json: canonicalJson
		};
	} catch (error) {
		if (error instanceof SourceMapV3DecodeError && error.code === 'BUDGET_EXCEEDED')
			return fail(
				'BUDGET_EXCEEDED',
				'svelte2tsx source map exceeds its strict decoder budget.',
				authoredLogicalPath
			);
		return fail(
			'SOURCE_MAP_INVALID',
			'svelte2tsx source map is outside the strict flat Source Map v3 profile.',
			authoredLogicalPath
		);
	}
}

function generatedBytes(
	text: string,
	authoredLogicalPath: string,
	limits: SvelteVirtualSourceLimits
): number {
	if (text.length > limits.maxGeneratedCharacters)
		fail(
			'BUDGET_EXCEEDED',
			'svelte2tsx output exceeds maxGeneratedCharacters.',
			authoredLogicalPath
		);
	const bytes = new TextEncoder().encode(text).byteLength;
	if (bytes > limits.maxGeneratedBytes)
		fail('BUDGET_EXCEEDED', 'svelte2tsx output exceeds maxGeneratedBytes.', authoredLogicalPath);
	return bytes;
}

function frozenDescriptor(
	logicalPath: string,
	contentBytes: number,
	contentCharacters: number,
	contentSha256: string
): SvelteVirtualSourceDescriptor {
	return Object.freeze({ contentBytes, contentCharacters, contentSha256, logicalPath });
}

/**
 * Deterministically transforms one already captured UTF-8 Svelte source without loading Svelte
 * configuration, running preprocessors, reading the filesystem, importing subject modules, or
 * using the network. The returned map proves mapped points only; no range interpolation is made.
 */
export function transformSvelteVirtualSource(
	inputValue: SvelteVirtualSourceTransformInput
): SvelteVirtualSourceTransform {
	assertProviderVersions();
	const input = validateInput(inputValue);
	const authoredSourceText = decodeUtf8(
		input.authoredBytes,
		input.authoredLogicalPath,
		input.limits
	);
	let root: AST.Root;
	try {
		root = parse(authoredSourceText, { filename: input.authoredLogicalPath, modern: true });
	} catch {
		return fail(
			'TRANSFORM_FAILED',
			'Svelte compiler could not parse the authored component.',
			input.authoredLogicalPath
		);
	}
	const selectedScriptKind = scriptKind(root);
	const virtualLogicalPath = svelteVirtualLogicalPath(
		input.authoredLogicalPath,
		selectedScriptKind,
		input.limits.maxPathCharacters
	);
	let transformed: ReturnType<typeof svelte2tsx>;
	try {
		transformed = svelte2tsx(authoredSourceText, {
			filename: input.authoredLogicalPath,
			isTsFile: selectedScriptKind === 'TS',
			mode: 'ts',
			parse,
			version: SVELTE_PROVIDER_VERSION,
			emitOnTemplateError: false
		});
	} catch {
		return fail(
			'TRANSFORM_FAILED',
			'svelte2tsx could not transform the authored component.',
			input.authoredLogicalPath
		);
	}
	if (typeof transformed.code !== 'string')
		fail(
			'TRANSFORM_FAILED',
			'svelte2tsx returned no virtual source text.',
			input.authoredLogicalPath
		);
	const virtualContentBytes = generatedBytes(
		transformed.code,
		input.authoredLogicalPath,
		input.limits
	);
	const sourceMap = canonicalSourceMap(
		transformed.map,
		input.authoredLogicalPath,
		virtualLogicalPath,
		input.limits
	);
	const authored = Object.freeze({
		...frozenDescriptor(
			input.authoredLogicalPath,
			input.authoredBytes.byteLength,
			authoredSourceText.length,
			sha256(input.authoredBytes)
		),
		encoding: 'UTF8_WITHOUT_BOM' as const,
		origin: 'AUTHORED' as const
	});
	const virtual = Object.freeze({
		...frozenDescriptor(
			virtualLogicalPath,
			virtualContentBytes,
			transformed.code.length,
			sha256(transformed.code)
		),
		origin: 'VIRTUAL' as const,
		scriptKind: selectedScriptKind
	});
	const mapEvidence = Object.freeze({
		canonicalJsonBytes: new TextEncoder().encode(sourceMap.json).byteLength,
		canonicalJsonSha256: sha256(sourceMap.json),
		decoderVersion: STRICT_SOURCE_MAP_V3_DECODER_VERSION,
		generatedLines: sourceMap.decoded.generatedLines,
		mappingState: 'EXACT_SEGMENT_POINTS_ONLY' as const,
		segmentCount: sourceMap.decoded.segmentCount
	});
	const id = sha256(
		canonicalSemanticJson({
			adapter: PROVIDER_IDENTITY,
			authored,
			idProfile: SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
			sourceMap: mapEvidence,
			transformProfile: SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
			virtual
		})
	);
	const evidence = Object.freeze({
		adapter: PROVIDER_IDENTITY,
		authored,
		id,
		idProfile: SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
		schemaVersion: SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION,
		sourceMap: mapEvidence,
		transformProfile: SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
		virtual
	});
	return Object.freeze({
		evidence,
		sourceMap: sourceMap.decoded,
		sourceMapJson: sourceMap.json,
		virtualSourceText: transformed.code
	});
}
