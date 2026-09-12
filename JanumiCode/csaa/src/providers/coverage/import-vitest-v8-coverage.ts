import { dirname, resolve } from 'node:path';

import { canonicalJson, compareText } from '../../inventory/canonical.js';
import {
	decodeSourceMapV3,
	type SourceMapV3DecodeLimits
} from '../source-map/decode-source-map-v3.js';
import {
	denseArray,
	exactRecord,
	importProviderJson,
	isSha256,
	providerArtifactPath,
	safeInteger,
	scalarString,
	type ProviderEvidenceResult,
	type ProviderImportContext,
	type ProviderNormalization
} from '../runtime/provider-evidence.js';

export const VITEST_V8_COVERAGE_PROVIDER_ID = 'vitest-v8-coverage' as const;
export const VITEST_V8_COVERAGE_PROVIDER_VERSION = '4.1.10' as const;
export const VITEST_V8_COVERAGE_ADAPTER_ID = 'jan-csaa-vitest-v8-coverage-import' as const;
export const VITEST_V8_COVERAGE_ADAPTER_VERSION = '1.0.0' as const;
export const VITEST_V8_COVERAGE_INPUT_SCHEMA_VERSION =
	'jan-csaa-vitest-v8-coverage-input/1.0.0' as const;

const SOURCE_MAP_LIMITS: SourceMapV3DecodeLimits = Object.freeze({
	maxCoordinate: 100_000_000,
	maxGeneratedLines: 1_000_000,
	maxInputCharacters: 8 * 1024 * 1024,
	maxMappingsCharacters: 4 * 1024 * 1024,
	maxPathCharacters: 16_384,
	maxSegments: 500_000,
	maxVlqDigits: 7
});

export interface V8FunctionCoverageObservation {
	readonly coveredRanges: number;
	readonly functionName: string;
	readonly rangeCount: number;
	readonly rootCount: number;
}

export interface V8SourceCoverageObservation {
	readonly functionCount: number;
	readonly functions: readonly V8FunctionCoverageObservation[];
	readonly generatedPath: string | null;
	readonly mappedSegmentCount: number;
	readonly sourcePath: string;
	readonly sourceSha256: string;
	readonly state: 'COVERED' | 'UNCOVERED';
}

const ROOT_KEYS = [
	'includedSources',
	'missingSources',
	'schemaVersion',
	'scripts',
	'uncoveredSources'
] as const;
const SCRIPT_KEYS = [
	'functions',
	'generatedPath',
	'sourceMap',
	'sourcePath',
	'sourceSha256'
] as const;
const FUNCTION_KEYS = ['functionName', 'isBlockCoverage', 'ranges'] as const;
const RANGE_KEYS = ['count', 'endOffset', 'startOffset'] as const;

function canonicalPathList(
	value: unknown,
	label: string,
	context: ProviderImportContext
): readonly string[] {
	const paths = denseArray(value, label, 100_000).map((path) =>
		providerArtifactPath(path, context.repositoryRoot)
	);
	if (new Set(paths).size !== paths.length) throw new TypeError(`${label} contains duplicates.`);
	const sorted = [...paths].sort(compareText);
	if (canonicalJson(paths) !== canonicalJson(sorted))
		throw new TypeError(`${label} must use canonical path order.`);
	return paths;
}

function resolveMappedSource(
	generatedPath: string,
	source: string,
	context: ProviderImportContext
): string {
	const generatedAbsolute = resolve(context.repositoryRoot, ...generatedPath.split('/'));
	return providerArtifactPath(resolve(dirname(generatedAbsolute), source), context.repositoryRoot);
}

function normalizeFunction(value: unknown, index: number): V8FunctionCoverageObservation {
	const record = exactRecord(value, FUNCTION_KEYS, `V8 function ${index}`);
	if (typeof record.isBlockCoverage !== 'boolean')
		throw new TypeError('V8 isBlockCoverage must be boolean.');
	const ranges = denseArray(record.ranges, `V8 function ${index} ranges`, 100_000).map(
		(rawRange, rangeIndex) => {
			const range = exactRecord(rawRange, RANGE_KEYS, `V8 range ${rangeIndex}`);
			const startOffset = safeInteger(range.startOffset, 'V8 range startOffset');
			const endOffset = safeInteger(range.endOffset, 'V8 range endOffset', 1);
			const count = safeInteger(range.count, 'V8 range count');
			if (endOffset <= startOffset) throw new TypeError('V8 coverage range is empty or reversed.');
			return { count, endOffset, startOffset };
		}
	);
	if (ranges.length === 0) throw new TypeError('V8 function coverage requires a root range.');
	const rangeIdentities = ranges.map(
		(range) => `${range.startOffset}:${range.endOffset}:${range.count}`
	);
	if (new Set(rangeIdentities).size !== rangeIdentities.length)
		throw new TypeError('V8 function coverage contains a duplicate range.');
	const root = ranges[0]!;
	for (const range of ranges.slice(1))
		if (range.startOffset < root.startOffset || range.endOffset > root.endOffset)
			throw new TypeError('V8 child range escapes its function root range.');
	return Object.freeze({
		coveredRanges: ranges.filter((range) => range.count > 0).length,
		functionName: scalarString(record.functionName, `V8 function ${index} name`, 16_384),
		rangeCount: ranges.length,
		rootCount: root.count
	});
}

function normalizeCoverage(
	value: unknown,
	context: ProviderImportContext
): ProviderNormalization<V8SourceCoverageObservation> {
	const root = exactRecord(value, ROOT_KEYS, 'Vitest V8 coverage root');
	if (root.schemaVersion !== VITEST_V8_COVERAGE_INPUT_SCHEMA_VERSION)
		throw new TypeError('Vitest V8 coverage schemaVersion is unsupported.');
	const included = canonicalPathList(root.includedSources, 'Coverage includedSources', context);
	if (included.length === 0) throw new TypeError('Coverage denominator must be nonempty.');
	const missing = canonicalPathList(root.missingSources, 'Coverage missingSources', context);
	const uncovered = canonicalPathList(root.uncoveredSources, 'Coverage uncoveredSources', context);
	const includedSet = new Set(included);
	const subjectArtifacts = new Map(
		context.subject.artifacts.map((artifact) => [artifact.path, artifact] as const)
	);
	for (const path of [...included, ...missing, ...uncovered])
		if (!subjectArtifacts.has(path))
			throw new TypeError('Coverage denominator identifies a file outside the FrozenSubject.');
	for (const path of [...missing, ...uncovered])
		if (!includedSet.has(path))
			throw new TypeError('Coverage classification identifies a file outside its denominator.');
	const classified = new Set([...missing, ...uncovered]);
	if (classified.size !== missing.length + uncovered.length)
		throw new TypeError('Coverage missing and uncovered populations overlap.');
	const observations: V8SourceCoverageObservation[] = [];
	for (const [scriptIndex, rawScript] of denseArray(root.scripts, 'Coverage scripts').entries()) {
		const script = exactRecord(rawScript, SCRIPT_KEYS, `Coverage script ${scriptIndex}`);
		const sourcePath = providerArtifactPath(script.sourcePath, context.repositoryRoot);
		if (!includedSet.has(sourcePath))
			throw new TypeError('Coverage script source is outside the declared denominator.');
		if (classified.has(sourcePath))
			throw new TypeError('Coverage source is classified more than once.');
		classified.add(sourcePath);
		if (!isSha256(script.sourceSha256)) throw new TypeError('Coverage source digest is invalid.');
		const artifact = subjectArtifacts.get(sourcePath)!;
		if (artifact.sha256 !== script.sourceSha256)
			throw new TypeError('Coverage source digest does not match the current FrozenSubject.');
		const generatedPath = providerArtifactPath(script.generatedPath, context.repositoryRoot);
		const sourceMapRecord = exactRecord(
			script.sourceMap,
			['file', 'mappings', 'names', 'sourceRoot', 'sources', 'version'],
			`Coverage script ${scriptIndex} sourceMap`
		);
		const decoded = decodeSourceMapV3(canonicalJson(sourceMapRecord), SOURCE_MAP_LIMITS);
		if (providerArtifactPath(decoded.file, context.repositoryRoot) !== generatedPath)
			throw new TypeError('Coverage source-map generated file does not match the script.');
		if (resolveMappedSource(generatedPath, decoded.source, context) !== sourcePath)
			throw new TypeError('Coverage source map does not resolve to the bound current source.');
		const functions = denseArray(script.functions, `Coverage script ${scriptIndex} functions`).map(
			(rawFunction, functionIndex) => normalizeFunction(rawFunction, functionIndex)
		);
		if (functions.length === 0 || !functions.some((entry) => entry.coveredRanges > 0))
			throw new TypeError(
				'Coverage script must contain a nonvacuous positively counted V8 function range.'
			);
		observations.push(
			Object.freeze({
				functionCount: functions.length,
				functions: Object.freeze(functions),
				generatedPath,
				mappedSegmentCount: decoded.segmentCount,
				sourcePath,
				sourceSha256: script.sourceSha256,
				state: 'COVERED'
			})
		);
	}
	for (const sourcePath of uncovered) {
		if (!includedSet.has(sourcePath))
			throw new TypeError('Uncovered coverage source is outside the declared denominator.');
		observations.push(
			Object.freeze({
				functionCount: 0,
				functions: Object.freeze([]),
				generatedPath: null,
				mappedSegmentCount: 0,
				sourcePath,
				sourceSha256: subjectArtifacts.get(sourcePath)!.sha256,
				state: 'UNCOVERED'
			})
		);
	}
	if (classified.size !== included.length)
		throw new TypeError(
			'Coverage denominator is not fully classified as covered, uncovered, or missing.'
		);
	observations.sort((left, right) => compareText(left.sourcePath, right.sourcePath));
	return {
		completedRegions: observations.map((observation) => observation.sourcePath),
		missingRegions: missing,
		observations,
		redactions: ['SOURCE_MAP_SOURCE_CONTENT_NOT_RETAINED']
	};
}

export function importVitestV8Coverage(
	raw: string | Uint8Array | null,
	context: ProviderImportContext
): ProviderEvidenceResult<V8SourceCoverageObservation> {
	return importProviderJson({
		adapterId: VITEST_V8_COVERAGE_ADAPTER_ID,
		adapterVersion: VITEST_V8_COVERAGE_ADAPTER_VERSION,
		context,
		expectedProviderId: VITEST_V8_COVERAGE_PROVIDER_ID,
		normalize: normalizeCoverage,
		raw,
		supportedProviderVersions: [VITEST_V8_COVERAGE_PROVIDER_VERSION]
	});
}
