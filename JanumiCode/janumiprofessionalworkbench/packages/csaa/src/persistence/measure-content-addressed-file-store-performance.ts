import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isProxy } from 'node:util/types';

import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import {
	ContentAddressedFileStore,
	type ContentAddressedArtifactComputationContext,
	type ContentAddressedArtifactDefinition,
	type ContentAddressedInvalidationInput,
	type ContentAddressedPublishResult
} from './content-addressed-file-store.js';

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-content-addressed-store-cold-warm-evidence/1.0.0' as const;
export const CONTENT_ADDRESSED_STORE_PERFORMANCE_OPERATION_VERSION =
	'jan-csaa-measure-content-addressed-store-cold-warm/1.0.0' as const;
export const CONTENT_ADDRESSED_STORE_PERFORMANCE_SOURCE_SET_VERSION =
	'jan-csaa-content-addressed-store-performance-source-set/1.0.0' as const;

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS = Object.freeze([
	'EMPIRICAL_OBSERVATION_IS_NOT_A_SERVICE_LEVEL_OBJECTIVE',
	'FIXED_SYNTHETIC_WORKLOAD_IS_NOT_WHOLE_REPOSITORY_ANALYSIS_THROUGHPUT',
	'ONE_ENVIRONMENT_IS_NOT_CROSS_PLATFORM_QUALIFICATION',
	'LOGICAL_COLD_STORE_IS_NOT_OPERATING_SYSTEM_COLD_CACHE',
	'WALL_CLOCK_ONLY_DOES_NOT_MEASURE_CPU_MEMORY_OR_IO',
	'CACHE_REUSE_IS_NOT_FRESHNESS_OR_CORRECTNESS_PROOF',
	'IMPLEMENTATION_SOURCE_SET_IS_NOT_TRANSITIVE_DEPENDENCY_CLOSURE',
	'DWP_007_COMPLETION_NOT_CLAIMED',
	'ANALYSIS_AUTHORITY_NONE',
	'GATE_EFFECT_NONE'
] as const);

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT = Object.freeze({
	budgetProfile: 'ABSENT' as const,
	classification: 'EMPIRICAL_OBSERVATION_ONLY' as const,
	verdict: 'INCONCLUSIVE_NO_OWNER_AUTHORIZED_THRESHOLD' as const
});

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_CONTROLS = Object.freeze({
	cancellation: 'NOT_EXERCISED' as const,
	concurrency: 1 as const,
	network: 'NOT_USED_BY_WORKLOAD' as const,
	timeout: 'NONE' as const
});

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_RESOURCES = Object.freeze({
	cpu: 'NOT_MEASURED' as const,
	diskIo: 'NOT_SEPARATELY_MEASURED' as const,
	memory: 'NOT_MEASURED' as const,
	outputBytes: 'MEASURED_AS_ARTIFACT_BYTES' as const,
	wallClock: 'MEASURED_PER_PUBLISH_CALL' as const
});

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_WORKLOAD = Object.freeze({
	capability: 'CONTENT_ADDRESSED_PUBLICATION_AND_IDENTITY_CHECKED_REUSE' as const,
	coldState: 'NEW_EMPTY_STORE_FIRST_CLEAN_PUBLICATION' as const,
	fixture: 'FIXED_SYNTHETIC_SHA256_ARTIFACT_POPULATION' as const,
	provider: 'IN_PROCESS_CONTENT_ADDRESSED_FILE_STORE' as const,
	setupInclusion: 'ONLY_STORE_PUBLISH_CALLS_ARE_TIMED' as const,
	warmState: 'SAME_STORE_IDENTICAL_INPUT_INCREMENTAL_PUBLICATION' as const
});

export interface ContentAddressedStorePerformanceConfiguration {
	readonly artifactCount: number;
	readonly computeRounds: number;
	readonly inputCount: number;
	readonly samples: number;
}

export const CONTENT_ADDRESSED_STORE_PERFORMANCE_DEFAULT_CONFIGURATION = Object.freeze({
	artifactCount: 256,
	computeRounds: 1_024,
	inputCount: 64,
	samples: 5
} satisfies ContentAddressedStorePerformanceConfiguration);

export interface ContentAddressedStorePerformanceEnvironment {
	readonly architecture: string;
	readonly cpuModel: string;
	readonly engine: 'bun' | 'node';
	readonly engineVersion: string;
	readonly platform: string;
}

export interface ContentAddressedStorePerformanceImplementationSource {
	readonly path: string;
	readonly sha256: string;
}

export interface ContentAddressedStorePerformanceSample {
	readonly artifactWitnessSha256: string;
	readonly cold: {
		readonly computedArtifacts: number;
		readonly computedBytes: number;
		readonly elapsedMs: number;
		readonly reusedArtifacts: number;
		readonly reusedBytes: number;
	};
	readonly generationId: string;
	readonly identicalArtifacts: true;
	readonly sample: number;
	readonly warm: {
		readonly computedArtifacts: number;
		readonly computedBytes: number;
		readonly elapsedMs: number;
		readonly reusedArtifacts: number;
		readonly reusedBytes: number;
	};
}

export interface ContentAddressedStorePerformanceEvidence {
	readonly analysisAuthority: 'NONE';
	readonly assessment: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT;
	readonly configuration: ContentAddressedStorePerformanceConfiguration;
	readonly controls: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_CONTROLS;
	readonly environment: ContentAddressedStorePerformanceEnvironment;
	readonly gateEffect: 'NONE';
	readonly implementationSourceDigest: string;
	readonly implementationSources: readonly ContentAddressedStorePerformanceImplementationSource[];
	readonly measurement: {
		readonly coldMedianMs: number;
		readonly observedWarmMedianLowerThanColdMedian: boolean;
		readonly warmMedianMs: number;
	};
	readonly nonclaims: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS;
	readonly operationVersion: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_OPERATION_VERSION;
	readonly recordedAt: string;
	readonly resources: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_RESOURCES;
	readonly samples: readonly ContentAddressedStorePerformanceSample[];
	readonly schemaVersion: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_EVIDENCE_SCHEMA_VERSION;
	readonly workload: typeof CONTENT_ADDRESSED_STORE_PERFORMANCE_WORKLOAD;
}

export interface MeasureContentAddressedStorePerformanceOptions {
	readonly configuration?: ContentAddressedStorePerformanceConfiguration;
	readonly environment: ContentAddressedStorePerformanceEnvironment;
	readonly implementationSources: readonly ContentAddressedStorePerformanceImplementationSource[];
	readonly now?: () => string;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_PATH = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[\x20-\x7e]+$/u;

function digest(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function boundedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
		throw new TypeError(
			`${label} must be a bounded safe integer from ${minimum} through ${maximum}.`
		);
	return value as number;
}

function finiteMilliseconds(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
		throw new TypeError(`${label} must be finite nonnegative milliseconds.`);
	return value;
}

function scalarText(value: unknown, label: string, maximum = 1_024): string {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum)
		throw new TypeError(`${label} must be bounded nonempty text.`);
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (next < 0xdc00 || next > 0xdfff) throw new TypeError(`${label} is not scalar text.`);
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff)
			throw new TypeError(`${label} is not scalar text.`);
	}
	return value;
}

function canonicalInstant(value: unknown, label: string): string {
	const text = scalarText(value, label);
	const milliseconds = Date.parse(text);
	if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== text)
		throw new TypeError(`${label} must be a canonical ISO instant.`);
	return text;
}

function plainRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${label} must be a plain object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${label} must be a plain object.`);
	return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
	value: Readonly<Record<string, unknown>>,
	keys: readonly string[],
	label: string
): void {
	const actual = Reflect.ownKeys(value);
	if (
		actual.length !== keys.length ||
		actual.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		throw new TypeError(`${label} has an open or incomplete shape.`);
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${label}.${key} must be an enumerable data property.`);
	}
}

function arrayValues(value: unknown, label: string, maximum: number): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value)) throw new TypeError(`${label} must be an array.`);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	const length =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > maximum)
		throw new TypeError(`${label} has an invalid or excessive length.`);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== (length as number) + 1)
		throw new TypeError(`${label} must be dense and have no expando properties.`);
	const admitted: unknown[] = [];
	for (let index = 0; index < (length as number); index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${label}[${index}] must be an enumerable data property.`);
		admitted.push(descriptor.value);
	}
	return admitted;
}

function configuration(
	value: ContentAddressedStorePerformanceConfiguration | undefined
): ContentAddressedStorePerformanceConfiguration {
	const candidate = value ?? CONTENT_ADDRESSED_STORE_PERFORMANCE_DEFAULT_CONFIGURATION;
	const record = plainRecord(candidate, 'configuration');
	exactKeys(record, ['artifactCount', 'computeRounds', 'inputCount', 'samples'], 'configuration');
	const admitted = Object.freeze({
		artifactCount: boundedInteger(record.artifactCount, 'configuration.artifactCount', 1, 1_024),
		computeRounds: boundedInteger(record.computeRounds, 'configuration.computeRounds', 1, 100_000),
		inputCount: boundedInteger(record.inputCount, 'configuration.inputCount', 1, 1_024),
		samples: boundedInteger(record.samples, 'configuration.samples', 3, 25)
	});
	if (admitted.inputCount > admitted.artifactCount)
		throw new TypeError('configuration.inputCount cannot exceed configuration.artifactCount.');
	return admitted;
}

function environment(
	value: ContentAddressedStorePerformanceEnvironment
): ContentAddressedStorePerformanceEnvironment {
	const record = plainRecord(value, 'environment');
	exactKeys(
		record,
		['architecture', 'cpuModel', 'engine', 'engineVersion', 'platform'],
		'environment'
	);
	if (record.engine !== 'bun' && record.engine !== 'node')
		throw new TypeError('environment.engine is unsupported.');
	return Object.freeze({
		architecture: scalarText(record.architecture, 'environment.architecture'),
		cpuModel: scalarText(record.cpuModel, 'environment.cpuModel', 4_096),
		engine: record.engine,
		engineVersion: scalarText(record.engineVersion, 'environment.engineVersion'),
		platform: scalarText(record.platform, 'environment.platform')
	});
}

function implementationSources(
	value: readonly ContentAddressedStorePerformanceImplementationSource[]
): readonly ContentAddressedStorePerformanceImplementationSource[] {
	const values = arrayValues(value, 'implementationSources', 16);
	if (values.length === 0) throw new TypeError('implementationSources must not be empty.');
	const admitted = values.map((candidate, index) => {
		const record = plainRecord(candidate, `implementationSources[${index}]`);
		exactKeys(record, ['path', 'sha256'], `implementationSources[${index}]`);
		const path = scalarText(record.path, `implementationSources[${index}].path`, 512);
		if (
			!SOURCE_PATH.test(path) ||
			path.split('/').some((segment) => segment === '' || segment === '.')
		)
			throw new TypeError(
				`implementationSources[${index}].path must be a canonical relative path.`
			);
		if (typeof record.sha256 !== 'string' || !SHA256.test(record.sha256))
			throw new TypeError(`implementationSources[${index}].sha256 is invalid.`);
		return Object.freeze({ path, sha256: record.sha256 });
	});
	for (let index = 1; index < admitted.length; index += 1) {
		if (admitted[index - 1]!.path >= admitted[index]!.path)
			throw new TypeError('implementationSources must be strictly ordered by unique path.');
	}
	return Object.freeze(admitted);
}

function implementationSourceDigest(
	sources: readonly ContentAddressedStorePerformanceImplementationSource[]
): string {
	return canonicalSemanticJsonWitness({
		sourceSetVersion: CONTENT_ADDRESSED_STORE_PERFORMANCE_SOURCE_SET_VERSION,
		sources
	}).sha256;
}

export function contentAddressedStorePerformanceImplementationSourceDigest(
	sources: readonly ContentAddressedStorePerformanceImplementationSource[]
): string {
	return implementationSourceDigest(implementationSources(sources));
}

function median(values: readonly number[]): number {
	const ordered = [...values].sort((left, right) => left - right);
	const middle = Math.floor(ordered.length / 2);
	const value =
		ordered.length % 2 === 1 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
	return Number(value.toFixed(3));
}

function roundedElapsed(startedAt: number): number {
	return Number(Math.max(0, performance.now() - startedAt).toFixed(3));
}

function inputs(count: number): readonly ContentAddressedInvalidationInput[] {
	return Object.freeze(
		Array.from({ length: count }, (_, index) => ({
			digest: digest(`content-addressed-performance-input:${index}`),
			key: `input:${String(index).padStart(4, '0')}`,
			kind: 'FILE_CONTENT' as const
		}))
	);
}

function computedPayload(seed: string, rounds: number): string {
	let current = Buffer.from(seed, 'utf8');
	for (let round = 0; round < rounds; round += 1)
		current = createHash('sha256').update(current).digest();
	return current.toString('hex');
}

function outputs(
	artifactCount: number,
	inputCount: number,
	computeRounds: number
): readonly ContentAddressedArtifactDefinition[] {
	return Object.freeze(
		Array.from({ length: artifactCount }, (_, index) => {
			const dependencyKey = `input:${String(index % inputCount).padStart(4, '0')}`;
			return {
				artifactKind: 'DWP_007_PERFORMANCE_FIXTURE',
				compute: ({ invalidationInputs, logicalKey }: ContentAddressedArtifactComputationContext) =>
					computedPayload(`${logicalKey}:${invalidationInputs[0]!.digest}`, computeRounds),
				dependencyKeys: [dependencyKey],
				logicalKey: `artifact:${String(index).padStart(4, '0')}`,
				transformVersion: `dwp-007-performance-transform/${computeRounds}`
			};
		})
	);
}

function artifactWitness(result: ContentAddressedPublishResult): string {
	return canonicalSemanticJsonWitness(result.artifacts).sha256;
}

function measurementSample(
	sample: number,
	config: ContentAddressedStorePerformanceConfiguration
): ContentAddressedStorePerformanceSample {
	const root = mkdtempSync(join(tmpdir(), 'csaa-content-store-performance-'));
	try {
		const store = new ContentAddressedFileStore(root);
		store.initialize();
		const invalidationInputs = inputs(config.inputCount);
		const definitions = outputs(config.artifactCount, config.inputCount, config.computeRounds);
		const coldStartedAt = performance.now();
		const cold = store.publish({
			expectedCurrentGenerationId: null,
			invalidationInputs,
			mode: 'CLEAN',
			outputs: definitions,
			subjectId: 'subject:dwp-007-performance-fixture',
			verifyCleanEquivalence: false
		});
		const coldElapsedMs = roundedElapsed(coldStartedAt);
		const warmStartedAt = performance.now();
		const warm = store.publish({
			expectedCurrentGenerationId: cold.generationId,
			invalidationInputs,
			mode: 'INCREMENTAL',
			outputs: definitions,
			subjectId: 'subject:dwp-007-performance-fixture',
			verifyCleanEquivalence: false
		});
		const warmElapsedMs = roundedElapsed(warmStartedAt);
		const coldWitness = artifactWitness(cold);
		const warmWitness = artifactWitness(warm);
		if (coldWitness !== warmWitness || cold.generationId !== warm.generationId)
			throw new Error('Cold and warm publications do not carry identical artifact identity.');
		if (
			cold.computedArtifacts !== config.artifactCount ||
			cold.reusedArtifacts !== 0 ||
			warm.computedArtifacts !== 0 ||
			warm.reusedArtifacts !== config.artifactCount ||
			cold.computedBytes <= 0 ||
			cold.computedBytes !== warm.reusedBytes ||
			cold.reusedBytes !== 0 ||
			warm.computedBytes !== 0
		)
			throw new Error('Cold and warm reuse accounting did not reconcile.');
		return Object.freeze({
			artifactWitnessSha256: coldWitness,
			cold: Object.freeze({
				computedArtifacts: cold.computedArtifacts,
				computedBytes: cold.computedBytes,
				elapsedMs: coldElapsedMs,
				reusedArtifacts: cold.reusedArtifacts,
				reusedBytes: cold.reusedBytes
			}),
			generationId: cold.generationId,
			identicalArtifacts: true,
			sample,
			warm: Object.freeze({
				computedArtifacts: warm.computedArtifacts,
				computedBytes: warm.computedBytes,
				elapsedMs: warmElapsedMs,
				reusedArtifacts: warm.reusedArtifacts,
				reusedBytes: warm.reusedBytes
			})
		});
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

export function measureContentAddressedStorePerformance(
	options: MeasureContentAddressedStorePerformanceOptions
): ContentAddressedStorePerformanceEvidence {
	const record = plainRecord(options, 'options');
	const allowed = new Set(['configuration', 'environment', 'implementationSources', 'now']);
	const optionKeys = Reflect.ownKeys(record);
	if (optionKeys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new TypeError('options has an unsupported property.');
	for (const key of optionKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`options.${String(key)} must be an enumerable data property.`);
	}
	if (!Object.hasOwn(record, 'environment') || !Object.hasOwn(record, 'implementationSources'))
		throw new TypeError('options is missing a mandatory property.');
	const config = configuration(
		record.configuration as ContentAddressedStorePerformanceConfiguration | undefined
	);
	const measuredEnvironment = environment(
		record.environment as ContentAddressedStorePerformanceEnvironment
	);
	const measuredImplementationSources = implementationSources(
		record.implementationSources as readonly ContentAddressedStorePerformanceImplementationSource[]
	);
	if (record.now !== undefined && typeof record.now !== 'function')
		throw new TypeError('now must be a function.');
	const recordedAt = canonicalInstant(
		((record.now as (() => string) | undefined) ?? (() => new Date().toISOString()))(),
		'recordedAt'
	);
	const samples = Object.freeze(
		Array.from({ length: config.samples }, (_, index) => measurementSample(index + 1, config))
	);
	const first = samples[0]!;
	if (
		samples.some(
			(sample) =>
				sample.artifactWitnessSha256 !== first.artifactWitnessSha256 ||
				sample.generationId !== first.generationId ||
				sample.cold.computedBytes !== first.cold.computedBytes
		)
	)
		throw new Error('Repeated samples did not carry one deterministic artifact population.');
	const coldMedianMs = median(samples.map(({ cold }) => cold.elapsedMs));
	const warmMedianMs = median(samples.map(({ warm }) => warm.elapsedMs));
	return Object.freeze({
		analysisAuthority: 'NONE',
		assessment: CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT,
		configuration: config,
		controls: CONTENT_ADDRESSED_STORE_PERFORMANCE_CONTROLS,
		environment: measuredEnvironment,
		gateEffect: 'NONE',
		implementationSourceDigest: implementationSourceDigest(measuredImplementationSources),
		implementationSources: measuredImplementationSources,
		measurement: Object.freeze({
			coldMedianMs,
			observedWarmMedianLowerThanColdMedian: warmMedianMs < coldMedianMs,
			warmMedianMs
		}),
		nonclaims: CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS,
		operationVersion: CONTENT_ADDRESSED_STORE_PERFORMANCE_OPERATION_VERSION,
		recordedAt,
		resources: CONTENT_ADDRESSED_STORE_PERFORMANCE_RESOURCES,
		samples,
		schemaVersion: CONTENT_ADDRESSED_STORE_PERFORMANCE_EVIDENCE_SCHEMA_VERSION,
		workload: CONTENT_ADDRESSED_STORE_PERFORMANCE_WORKLOAD
	});
}

function exactConstantObject(
	value: unknown,
	expected: Readonly<Record<string, unknown>>,
	label: string
): void {
	const record = plainRecord(value, label);
	const keys = Object.keys(expected);
	exactKeys(record, keys, label);
	if (keys.some((key) => record[key] !== expected[key]))
		throw new TypeError(`${label} is invalid.`);
}

function exactConstantArray(value: unknown, expected: readonly string[], label: string): void {
	const actual = arrayValues(value, label, expected.length);
	if (
		actual.length !== expected.length ||
		expected.some((expectedValue, index) => actual[index] !== expectedValue)
	)
		throw new TypeError(`${label} is invalid.`);
}

export function validateContentAddressedStorePerformanceEvidence(
	value: unknown,
	expectedImplementationSourceDigest?: string
): ContentAddressedStorePerformanceEvidence {
	const record = plainRecord(value, 'evidence');
	exactKeys(
		record,
		[
			'analysisAuthority',
			'assessment',
			'configuration',
			'controls',
			'environment',
			'gateEffect',
			'implementationSourceDigest',
			'implementationSources',
			'measurement',
			'nonclaims',
			'operationVersion',
			'recordedAt',
			'resources',
			'samples',
			'schemaVersion',
			'workload'
		],
		'evidence'
	);
	if (
		record.schemaVersion !== CONTENT_ADDRESSED_STORE_PERFORMANCE_EVIDENCE_SCHEMA_VERSION ||
		record.operationVersion !== CONTENT_ADDRESSED_STORE_PERFORMANCE_OPERATION_VERSION ||
		record.analysisAuthority !== 'NONE' ||
		record.gateEffect !== 'NONE'
	)
		throw new TypeError('Evidence identity or authority fields are invalid.');
	exactConstantObject(
		record.assessment,
		CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT,
		'evidence.assessment'
	);
	exactConstantObject(
		record.controls,
		CONTENT_ADDRESSED_STORE_PERFORMANCE_CONTROLS,
		'evidence.controls'
	);
	exactConstantObject(
		record.resources,
		CONTENT_ADDRESSED_STORE_PERFORMANCE_RESOURCES,
		'evidence.resources'
	);
	exactConstantObject(
		record.workload,
		CONTENT_ADDRESSED_STORE_PERFORMANCE_WORKLOAD,
		'evidence.workload'
	);
	exactConstantArray(
		record.nonclaims,
		CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS,
		'evidence.nonclaims'
	);
	const admittedImplementationSources = implementationSources(
		record.implementationSources as readonly ContentAddressedStorePerformanceImplementationSource[]
	);
	const admittedImplementationSourceDigest = implementationSourceDigest(
		admittedImplementationSources
	);
	if (
		typeof record.implementationSourceDigest !== 'string' ||
		!SHA256.test(record.implementationSourceDigest) ||
		record.implementationSourceDigest !== admittedImplementationSourceDigest
	)
		throw new TypeError('Evidence implementation source identity is invalid.');
	if (
		expectedImplementationSourceDigest !== undefined &&
		(!SHA256.test(expectedImplementationSourceDigest) ||
			record.implementationSourceDigest !== expectedImplementationSourceDigest)
	)
		throw new TypeError('Evidence implementation source identity is stale.');
	const config = configuration(
		record.configuration as ContentAddressedStorePerformanceConfiguration
	);
	const measuredEnvironment = environment(
		record.environment as ContentAddressedStorePerformanceEnvironment
	);
	const recordedAt = canonicalInstant(record.recordedAt, 'evidence.recordedAt');
	const sampleValues = arrayValues(record.samples, 'evidence.samples', 25);
	if (sampleValues.length !== config.samples)
		throw new TypeError('Evidence sample population is incomplete.');
	const samples = sampleValues.map((candidate, index): ContentAddressedStorePerformanceSample => {
		const sample = plainRecord(candidate, `samples[${index}]`);
		exactKeys(
			sample,
			['artifactWitnessSha256', 'cold', 'generationId', 'identicalArtifacts', 'sample', 'warm'],
			`samples[${index}]`
		);
		if (
			sample.sample !== index + 1 ||
			sample.identicalArtifacts !== true ||
			typeof sample.artifactWitnessSha256 !== 'string' ||
			!SHA256.test(sample.artifactWitnessSha256) ||
			typeof sample.generationId !== 'string' ||
			!SHA256.test(sample.generationId)
		)
			throw new TypeError(`samples[${index}] identity is invalid.`);
		const admitLeg = (legValue: unknown, label: string) => {
			const leg = plainRecord(legValue, label);
			exactKeys(
				leg,
				['computedArtifacts', 'computedBytes', 'elapsedMs', 'reusedArtifacts', 'reusedBytes'],
				label
			);
			return Object.freeze({
				computedArtifacts: boundedInteger(
					leg.computedArtifacts,
					`${label}.computedArtifacts`,
					0,
					1_024
				),
				computedBytes: boundedInteger(
					leg.computedBytes,
					`${label}.computedBytes`,
					0,
					64 * 1024 * 1024
				),
				elapsedMs: finiteMilliseconds(leg.elapsedMs, `${label}.elapsedMs`),
				reusedArtifacts: boundedInteger(leg.reusedArtifacts, `${label}.reusedArtifacts`, 0, 1_024),
				reusedBytes: boundedInteger(leg.reusedBytes, `${label}.reusedBytes`, 0, 64 * 1024 * 1024)
			});
		};
		const cold = admitLeg(sample.cold, `samples[${index}].cold`);
		const warm = admitLeg(sample.warm, `samples[${index}].warm`);
		if (
			cold.computedArtifacts !== config.artifactCount ||
			cold.reusedArtifacts !== 0 ||
			warm.computedArtifacts !== 0 ||
			warm.reusedArtifacts !== config.artifactCount ||
			cold.computedBytes <= 0 ||
			cold.computedBytes !== warm.reusedBytes ||
			cold.reusedBytes !== 0 ||
			warm.computedBytes !== 0
		)
			throw new TypeError(`samples[${index}] reuse accounting is invalid.`);
		return Object.freeze({
			artifactWitnessSha256: sample.artifactWitnessSha256,
			cold,
			generationId: sample.generationId,
			identicalArtifacts: true,
			sample: index + 1,
			warm
		});
	});
	const first = samples[0]!;
	if (
		samples.some(
			(sample) =>
				sample.artifactWitnessSha256 !== first.artifactWitnessSha256 ||
				sample.generationId !== first.generationId ||
				sample.cold.computedBytes !== first.cold.computedBytes
		)
	)
		throw new TypeError('Evidence samples do not identify one deterministic artifact population.');
	const measurement = plainRecord(record.measurement, 'measurement');
	exactKeys(
		measurement,
		['coldMedianMs', 'observedWarmMedianLowerThanColdMedian', 'warmMedianMs'],
		'measurement'
	);
	const coldMedianMs = finiteMilliseconds(measurement.coldMedianMs, 'measurement.coldMedianMs');
	const warmMedianMs = finiteMilliseconds(measurement.warmMedianMs, 'measurement.warmMedianMs');
	const observedWarmMedianLowerThanColdMedian = warmMedianMs < coldMedianMs;
	if (
		measurement.observedWarmMedianLowerThanColdMedian !== observedWarmMedianLowerThanColdMedian ||
		coldMedianMs !== median(samples.map(({ cold }) => cold.elapsedMs)) ||
		warmMedianMs !== median(samples.map(({ warm }) => warm.elapsedMs))
	)
		throw new TypeError('Evidence median measurement is invalid.');
	return Object.freeze({
		analysisAuthority: 'NONE',
		assessment: CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT,
		configuration: config,
		controls: CONTENT_ADDRESSED_STORE_PERFORMANCE_CONTROLS,
		environment: measuredEnvironment,
		gateEffect: 'NONE',
		implementationSourceDigest: admittedImplementationSourceDigest,
		implementationSources: admittedImplementationSources,
		measurement: Object.freeze({
			coldMedianMs,
			observedWarmMedianLowerThanColdMedian,
			warmMedianMs
		}),
		nonclaims: CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS,
		operationVersion: CONTENT_ADDRESSED_STORE_PERFORMANCE_OPERATION_VERSION,
		recordedAt,
		resources: CONTENT_ADDRESSED_STORE_PERFORMANCE_RESOURCES,
		samples: Object.freeze(samples),
		schemaVersion: CONTENT_ADDRESSED_STORE_PERFORMANCE_EVIDENCE_SCHEMA_VERSION,
		workload: CONTENT_ADDRESSED_STORE_PERFORMANCE_WORKLOAD
	});
}
