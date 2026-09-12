import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import ts from 'typescript';

import type { FrozenSubject, FrozenSubjectFreshness } from '../contracts/subject.js';
import { canonicalSemanticJsonWitness, isUnicodeScalarString } from '../semantic/canonical.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import type { HarmonizationCapabilityCode } from './harmonization-benchmark-baseline.js';
import {
	HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION,
	HARMONIZATION_FIRST_INCREMENT_MAX_POPULATION_MEMBERS,
	HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
	HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES,
	evaluateHarmonizationFirstIncrementRule,
	type HarmonizationFirstIncrementEvaluationOutcome,
	type HarmonizationFirstIncrementEvaluationStatus,
	type HarmonizationFirstIncrementRuleProfile,
	type HarmonizationRuleFactValue,
	type HarmonizationRuleObservationFact,
	type HarmonizationRuleProjectionProvenance,
	type HarmonizationRuleProjectionSurface
} from './harmonization-first-increment-rules.js';

export const JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-jpwb-harmonization-native-projection-request/1.0.0' as const;
export const JPWB_HARMONIZATION_NATIVE_PROJECTION_RESULT_SCHEMA_VERSION =
	'jan-csaa-jpwb-harmonization-native-projection-result/1.0.0' as const;
export const JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION =
	'jan-csaa-jpwb-harmonization-native-projection-outcome/1.0.0' as const;
export const JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION =
	'jan-csaa-project-jpwb-harmonization-first-increment/1.0.0' as const;
export const JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVIDER = Object.freeze({
	adapter: 'jan-csaa-jpwb-harmonization-native-projection',
	id: 'typescript-public-ast-plus-bounded-rule-specific-semantic-projection',
	version: '1.0.0'
} as const);

export const JPWB_HARMONIZATION_NATIVE_PROJECTION_NONCLAIMS = Object.freeze([
	'GATE_EFFECT_OR_AUTHORITY',
	'HUMAN_NORMATIVE_ADJUDICATION',
	'BEHAVIORAL_CORRECTNESS_OR_SECURITY_ABSENCE',
	'ABSENCE_OUTSIDE_EACH_DECLARED_CLOSED_RULE_POPULATION',
	'GENERAL_PURPOSE_COMPILER_SEMANTIC_GRAPH_OR_TEST_RUNNER',
	'GENERAL_PURPOSE_TAINT_OR_WHOLE_PROGRAM_DYNAMIC_REACHABILITY',
	'HISTORICAL_FINDING_STATUS_AS_CURRENT_WITHOUT_FROZEN_SUBJECT_REPROJECTION',
	'BENCHMARK_FIXTURE_DISCRIMINATION_OR_ALL_75_BENCHMARK_ACCOUNTING',
	'CALLER_DECLARED_FRESHNESS_AS_INDEPENDENTLY_RECHECKED_CURRENTNESS',
	'HARD_PREEMPTION_OF_A_SINGLE_IN_PROCESS_TYPESCRIPT_PARSE'
] as const);

export interface JpwbHarmonizationNativeProjectionBudgets {
	readonly maxArtifacts: number;
	readonly maxAstNodes: number;
	readonly maxDurationMs: number;
	readonly maxResultBytes: number;
	readonly maxSourceBytes: number;
}

export const JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS = Object.freeze({
	maxArtifacts: 20_000,
	maxAstNodes: 64_000_000,
	maxDurationMs: 120_000,
	maxResultBytes: 16 * 1024 * 1024,
	maxSourceBytes: 128 * 1024 * 1024
} satisfies JpwbHarmonizationNativeProjectionBudgets);

export interface JpwbHarmonizationNativeProjectionRequest {
	readonly budgets: JpwbHarmonizationNativeProjectionBudgets;
	readonly executionDisposition: 'NOT_RUN' | 'RUN';
	readonly executionId: string;
	readonly freshness: FrozenSubjectFreshness;
	readonly operationVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION;
	readonly schemaVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION;
	readonly subject: FrozenSubject;
}

export interface JpwbHarmonizationNativeRuleProjection {
	readonly availableCapabilities: readonly HarmonizationCapabilityCode[];
	readonly evaluation: HarmonizationFirstIncrementEvaluationOutcome;
	readonly factProjection: readonly HarmonizationRuleObservationFact[];
	readonly findingId: number;
	readonly population: {
		readonly closure: 'CLOSED' | 'OPEN';
		readonly count: number;
		readonly members: readonly string[];
		readonly populationId: string;
		readonly sha256: string;
	};
	readonly provenance: readonly HarmonizationRuleProjectionProvenance[];
	readonly projectionState: 'CURRENT_CLOSED' | 'NOT_RUN' | 'STALE' | 'UNAVAILABLE';
	readonly ruleId: string;
	readonly support: {
		readonly actualCapabilities: readonly HarmonizationCapabilityCode[];
		readonly actualProjectionSurfaces: readonly HarmonizationRuleProjectionSurface[];
		readonly exactPhysicalPopulation: boolean;
		readonly physicalPopulationBasis:
			'EXACT_RULE_ELIGIBLE_PATH_POPULATION' | 'EXACT_WHOLE_SUBJECT' | 'OPEN';
		readonly mandatoryInputIds: readonly string[];
		readonly missingMandatoryInputIds: readonly string[];
		readonly uncertainties: readonly string[];
	};
}

export interface JpwbHarmonizationNativeProjectionResult {
	readonly analysisAuthority: 'NONE';
	readonly authorityTransfer: 'NONE';
	readonly capability: {
		readonly detectorExecution: 'NOT_RUN' | 'PERFORMED_OVER_EXACT_FROZEN_SUBJECT_BYTES';
		readonly gateEffect: 'NONE';
		readonly nativeProjection: 'IMPLEMENTATION_LOCAL_UNREGISTERED_PROVIDER';
		readonly provider: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVIDER;
	};
	readonly currentness: {
		readonly basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED';
		readonly changedPaths: readonly string[];
		readonly frozenSubjectId: string;
		readonly sourceSha256: string;
		readonly state: FrozenSubjectFreshness['state'];
	};
	readonly currentRepositoryStatusTotals: Readonly<
		Record<HarmonizationFirstIncrementEvaluationStatus, number>
	>;
	readonly executionId: string;
	readonly facadeNonclaims: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_NONCLAIMS;
	readonly projections: readonly JpwbHarmonizationNativeRuleProjection[];
	readonly resultWitness: { readonly bytes: number; readonly sha256: string };
	readonly schemaVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_RESULT_SCHEMA_VERSION;
}

export type JpwbHarmonizationNativeProjectionOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly outcome: 'projected';
			readonly result: JpwbHarmonizationNativeProjectionResult;
			readonly schemaVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION;
			readonly state: 'projected';
	  }
	| {
			readonly diagnostics: readonly [{ readonly code: string; readonly message: string }];
			readonly outcome: 'unavailable';
			readonly result: null;
			readonly schemaVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION;
			readonly state: 'failed' | 'incompatible' | 'resource-refused';
	  };

interface SourceEntry {
	readonly artifactSha256: string;
	readonly path: string;
	readonly text: string;
}

interface Corpus {
	readonly byPath: ReadonlyMap<string, SourceEntry>;
	readonly checkpoint: () => void;
	readonly consumeAstVisit: () => void;
	readonly entries: readonly SourceEntry[];
	readonly parseSource: (entry: SourceEntry) => ts.SourceFile | null;
	readonly sourceWitness: { readonly bytes: number; readonly sha256: string };
}

interface RuleProjectionSeed {
	readonly facts: Readonly<Record<string, HarmonizationRuleFactValue>>;
	readonly members: readonly string[];
	readonly sourceReferences: readonly string[];
	readonly uncertainties: readonly string[];
}

interface MandatoryInput {
	readonly id: string;
	readonly minimum: number;
	readonly pattern: RegExp;
}

interface NativeDetectorDefinition {
	readonly actualCapabilities: readonly HarmonizationCapabilityCode[];
	readonly mandatoryInputs: readonly MandatoryInput[];
	readonly project: (corpus: Corpus) => RuleProjectionSeed;
}

interface EligiblePhysicalScope {
	readonly kind: 'FILE' | 'TREE';
	readonly path: string;
}

interface AdmittedArtifact {
	readonly bytes: number;
	readonly disposition: 'ANALYZED' | 'INVENTORY_ONLY';
	readonly path: string;
	readonly sha256: string;
}

interface AdmittedSubject {
	readonly artifacts: readonly AdmittedArtifact[];
	readonly capability: FrozenSubject;
	readonly configurationDigest: string;
	readonly exactWholePhysicalPopulation: boolean;
	readonly excludedArtifacts: readonly {
		readonly path: string;
		readonly physicalFileCount: number | 'UNKNOWN';
	}[];
	readonly fileManifestDigest: string;
	readonly subjectId: string;
}

interface AdmittedRequest extends Omit<JpwbHarmonizationNativeProjectionRequest, 'subject'> {
	readonly subject: AdmittedSubject;
}

class NativeProjectionRefusal extends Error {
	constructor(
		readonly code: string,
		readonly state: 'failed' | 'incompatible' | 'resource-refused',
		message: string
	) {
		super(message);
		this.name = 'NativeProjectionRefusal';
	}
}

const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const SOURCE_PATH = /^(?:apps|packages|verif)\/.+\.(?:[cm]?[jt]sx?|json)$/u;
const TEST_PATH = /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:spec|test)\.[cm]?[jt]sx?)$/u;
const PRODUCTION_PATH = /^(?:apps|packages)\//u;
const GOVERNED_PREFIX_REGISTRY_PATH =
	'docs/Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event, Schema Contract Package.md';
const GOVERNED_IMPLEMENTATION_GUIDE_PATH =
	'docs/Janumi Canonical Implementation Context - Coding Agent Guide.md';
const GOVERNED_TEXT_PATHS = new Set([
	GOVERNED_IMPLEMENTATION_GUIDE_PATH,
	GOVERNED_PREFIX_REGISTRY_PATH
]);
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_TEXT = 16_384;
const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	value !== null &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	!isProxy(value) &&
	(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function fail(code: string, state: NativeProjectionRefusal['state'], message: string): never {
	throw new NativeProjectionRefusal(code, state, message);
}

function boundedNonnegativeInteger(value: unknown, key: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
		fail('REQUEST_INVALID', 'incompatible', `${key} must be a nonnegative safe integer.`);
	return value;
}

function admitBudgets(value: unknown): JpwbHarmonizationNativeProjectionBudgets {
	if (!isPlainRecord(value))
		fail('REQUEST_INVALID', 'incompatible', 'budgets must be an inert plain object.');
	const keys = [
		'maxArtifacts',
		'maxAstNodes',
		'maxDurationMs',
		'maxResultBytes',
		'maxSourceBytes'
	].sort();
	exactKeys(value, keys, 'budgets');
	const result = {
		maxArtifacts: boundedNonnegativeInteger(ownData(value, 'maxArtifacts'), 'budgets.maxArtifacts'),
		maxAstNodes: boundedNonnegativeInteger(ownData(value, 'maxAstNodes'), 'budgets.maxAstNodes'),
		maxDurationMs: boundedNonnegativeInteger(
			ownData(value, 'maxDurationMs'),
			'budgets.maxDurationMs'
		),
		maxResultBytes: boundedNonnegativeInteger(
			ownData(value, 'maxResultBytes'),
			'budgets.maxResultBytes'
		),
		maxSourceBytes: boundedNonnegativeInteger(
			ownData(value, 'maxSourceBytes'),
			'budgets.maxSourceBytes'
		)
	};
	if (result.maxDurationMs === 0 || result.maxResultBytes === 0)
		fail('REQUEST_INVALID', 'incompatible', 'duration and result budgets must be positive.');
	return Object.freeze(result);
}

function ownData(record: Readonly<Record<string, unknown>>, key: string): unknown {
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		fail('REQUEST_INVALID', 'incompatible', `request.${key} must be an enumerable data property.`);
	return descriptor.value;
}

function exactKeys(
	record: Readonly<Record<string, unknown>>,
	keys: readonly string[],
	label: string
): void {
	if (Object.keys(record).sort().join('\0') !== [...keys].sort().join('\0'))
		fail('REQUEST_INVALID', 'incompatible', `${label} has an invalid exact key set.`);
}

function boundedText(value: unknown, label: string): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_TEXT ||
		!isUnicodeScalarString(value)
	)
		fail('REQUEST_INVALID', 'incompatible', `${label} must be bounded Unicode scalar text.`);
	return value;
}

function canonicalRelativePath(value: unknown, label: string): string {
	const path = boundedText(value, label);
	const segments = path.split('/');
	if (
		path.includes('\\') ||
		path.includes('\0') ||
		path.startsWith('/') ||
		segments.some((segment) => segment === '' || segment === '.' || segment === '..')
	)
		fail('REQUEST_INVALID', 'incompatible', `${label} must be a canonical relative path.`);
	return path;
}

function sha256Text(value: unknown, label: string): string {
	if (typeof value !== 'string' || !SHA256.test(value))
		fail('REQUEST_INVALID', 'incompatible', `${label} must be a lowercase SHA-256 digest.`);
	return value;
}

function denseDataArray(value: unknown, maximum: number, label: string): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value))
		fail('REQUEST_INVALID', 'incompatible', `${label} must be an inert dense array.`);
	if (value.length > maximum)
		fail('REQUEST_BUDGET_EXCEEDED', 'resource-refused', `${label} exceeds its item budget.`);
	const result: unknown[] = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('REQUEST_INVALID', 'incompatible', `${label} must contain only dense data elements.`);
		result.push(descriptor.value);
	}
	if (Object.keys(value).length !== value.length)
		fail(
			'REQUEST_INVALID',
			'incompatible',
			`${label} must not contain named enumerable properties.`
		);
	return Object.freeze(result);
}

function admitSubject(
	value: unknown,
	budgets: JpwbHarmonizationNativeProjectionBudgets
): AdmittedSubject {
	if (!isPlainRecord(value) || !isFrozenSubjectCapability(value))
		fail(
			'FROZEN_SUBJECT_CAPABILITY_REQUIRED',
			'incompatible',
			'Native projection requires an inert exact nonserialized FrozenSubject byte capability.'
		);
	const rawArtifacts = denseDataArray(
		ownData(value, 'artifacts'),
		budgets.maxArtifacts,
		'subject.artifacts'
	);
	const artifacts = rawArtifacts.map((raw, index): AdmittedArtifact => {
		if (!isPlainRecord(raw))
			fail('REQUEST_INVALID', 'incompatible', `subject.artifacts[${index}] must be inert.`);
		const disposition = ownData(raw, 'disposition');
		if (disposition !== 'ANALYZED' && disposition !== 'INVENTORY_ONLY')
			fail(
				'RECONCILIATION_INVALID',
				'incompatible',
				`subject.artifacts[${index}].disposition is invalid.`
			);
		return Object.freeze({
			bytes: boundedNonnegativeInteger(ownData(raw, 'bytes'), `subject.artifacts[${index}].bytes`),
			disposition,
			path: canonicalRelativePath(ownData(raw, 'path'), `subject.artifacts[${index}].path`),
			sha256: sha256Text(ownData(raw, 'sha256'), `subject.artifacts[${index}].sha256`)
		});
	});
	if (new Set(artifacts.map((artifact) => artifact.path)).size !== artifacts.length)
		fail('REQUEST_INVALID', 'incompatible', 'subject.artifacts contains duplicate paths.');
	const descriptor = ownData(value, 'descriptor');
	if (!isPlainRecord(descriptor))
		fail('REQUEST_INVALID', 'incompatible', 'subject.descriptor must be inert.');
	const population = ownData(value, 'population');
	if (!isPlainRecord(population))
		fail('REQUEST_INVALID', 'incompatible', 'subject.population must be inert.');
	const rawExcludedArtifacts = denseDataArray(
		ownData(value, 'excludedArtifacts'),
		budgets.maxArtifacts,
		'subject.excludedArtifacts'
	);
	if (artifacts.length + rawExcludedArtifacts.length > budgets.maxArtifacts)
		fail(
			'REQUEST_BUDGET_EXCEEDED',
			'resource-refused',
			'Combined included and excluded artifact records exceed budget.'
		);
	let excludedPhysicalLowerBound = 0;
	let excludedPhysicalExact = true;
	const excludedArtifacts: { path: string; physicalFileCount: number | 'UNKNOWN' }[] = [];
	for (const [index, raw] of rawExcludedArtifacts.entries()) {
		if (!isPlainRecord(raw))
			fail(
				'RECONCILIATION_INVALID',
				'incompatible',
				`subject.excludedArtifacts[${index}] must be inert.`
			);
		const physicalFileCount = ownData(raw, 'physicalFileCount');
		const path = canonicalRelativePath(
			ownData(raw, 'path'),
			`subject.excludedArtifacts[${index}].path`
		);
		if (physicalFileCount === 'UNKNOWN') excludedPhysicalExact = false;
		else
			excludedPhysicalLowerBound += boundedNonnegativeInteger(
				physicalFileCount,
				`subject.excludedArtifacts[${index}].physicalFileCount`
			);
		excludedArtifacts.push({
			path,
			physicalFileCount: physicalFileCount === 'UNKNOWN' ? 'UNKNOWN' : (physicalFileCount as number)
		});
	}
	const analyzed = boundedNonnegativeInteger(
		ownData(population, 'analyzed'),
		'population.analyzed'
	);
	const capturedRecords = boundedNonnegativeInteger(
		ownData(population, 'capturedRecords'),
		'population.capturedRecords'
	);
	const discovered = boundedNonnegativeInteger(
		ownData(population, 'discovered'),
		'population.discovered'
	);
	const excluded = boundedNonnegativeInteger(
		ownData(population, 'excluded'),
		'population.excluded'
	);
	const excludedRecords = boundedNonnegativeInteger(
		ownData(population, 'excludedRecords'),
		'population.excludedRecords'
	);
	const failed = boundedNonnegativeInteger(ownData(population, 'failed'), 'population.failed');
	const included = boundedNonnegativeInteger(
		ownData(population, 'included'),
		'population.included'
	);
	const inventoryOnly = boundedNonnegativeInteger(
		ownData(population, 'inventoryOnly'),
		'population.inventoryOnly'
	);
	if (
		ownData(population, 'capturedRecordsReconcile') !== true ||
		ownData(population, 'includedDispositionReconciles') !== true ||
		ownData(population, 'knownPhysicalLowerBoundReconciles') !== true ||
		ownData(population, 'reconciles') !== true ||
		capturedRecords !== artifacts.length + rawExcludedArtifacts.length ||
		included !== artifacts.length ||
		excludedRecords !== rawExcludedArtifacts.length ||
		analyzed !== artifacts.filter(({ disposition }) => disposition === 'ANALYZED').length ||
		inventoryOnly !==
			artifacts.filter(({ disposition }) => disposition === 'INVENTORY_ONLY').length ||
		included !== analyzed + inventoryOnly ||
		excluded !== excludedPhysicalLowerBound ||
		discovered !== included + excluded
	)
		fail(
			'RECONCILIATION_INVALID',
			'incompatible',
			'FrozenSubject serialized population arithmetic does not reconcile.'
		);
	const reconciliationScope = ownData(population, 'reconciliationScope');
	const physicalPopulationReconciles = ownData(population, 'physicalPopulationReconciles');
	const discoveredPhysicalFiles = ownData(population, 'discoveredPhysicalFiles');
	const excludedPhysicalFiles = ownData(population, 'excludedPhysicalFiles');
	if (discoveredPhysicalFiles !== 'UNKNOWN')
		boundedNonnegativeInteger(discoveredPhysicalFiles, 'population.discoveredPhysicalFiles');
	if (excludedPhysicalFiles !== 'UNKNOWN')
		boundedNonnegativeInteger(excludedPhysicalFiles, 'population.excludedPhysicalFiles');
	if (
		(reconciliationScope !== 'EXACT_PHYSICAL_POPULATION' &&
			reconciliationScope !== 'CAPTURED_RECORDS_ONLY') ||
		(physicalPopulationReconciles !== true && physicalPopulationReconciles !== 'UNKNOWN') ||
		(discoveredPhysicalFiles !== 'UNKNOWN' && typeof discoveredPhysicalFiles !== 'number') ||
		(excludedPhysicalFiles !== 'UNKNOWN' && typeof excludedPhysicalFiles !== 'number')
	)
		fail('RECONCILIATION_INVALID', 'incompatible', 'FrozenSubject physical population is invalid.');
	const exactPhysicalPopulation =
		reconciliationScope === 'EXACT_PHYSICAL_POPULATION' &&
		physicalPopulationReconciles === true &&
		excludedPhysicalExact &&
		discoveredPhysicalFiles === discovered &&
		excludedPhysicalFiles === excluded &&
		failed === 0;
	return Object.freeze({
		artifacts: Object.freeze(artifacts),
		capability: value,
		configurationDigest: sha256Text(
			ownData(descriptor, 'configurationDigest'),
			'subject.descriptor.configurationDigest'
		),
		exactWholePhysicalPopulation: exactPhysicalPopulation,
		excludedArtifacts: Object.freeze(excludedArtifacts.map((artifact) => Object.freeze(artifact))),
		fileManifestDigest: sha256Text(
			ownData(descriptor, 'fileManifestDigest'),
			'subject.descriptor.fileManifestDigest'
		),
		subjectId: boundedText(ownData(descriptor, 'subjectId'), 'subject.descriptor.subjectId')
	});
}

function admitFreshness(value: unknown, maximumPaths: number): FrozenSubjectFreshness {
	if (!isPlainRecord(value))
		fail('REQUEST_INVALID', 'incompatible', 'freshness must be an inert object.');
	exactKeys(value, ['changedPaths', 'diagnostics', 'state'], 'freshness');
	const state = ownData(value, 'state');
	if (state !== 'CURRENT' && state !== 'STALE' && state !== 'UNAVAILABLE')
		fail('REQUEST_INVALID', 'incompatible', 'freshness.state is invalid.');
	const changedPaths = denseDataArray(
		ownData(value, 'changedPaths'),
		maximumPaths,
		'freshness.changedPaths'
	).map((path, index) => boundedText(path, `freshness.changedPaths[${index}]`));
	if (new Set(changedPaths).size !== changedPaths.length)
		fail('REQUEST_INVALID', 'incompatible', 'freshness.changedPaths contains duplicates.');
	denseDataArray(ownData(value, 'diagnostics'), maximumPaths, 'freshness.diagnostics');
	return Object.freeze({ changedPaths: Object.freeze(changedPaths), diagnostics: [], state });
}

function admitRequest(value: unknown): AdmittedRequest {
	if (!isPlainRecord(value))
		fail('REQUEST_INVALID', 'incompatible', 'Native projection request must be inert.');
	const keys = [
		'budgets',
		'executionDisposition',
		'executionId',
		'freshness',
		'operationVersion',
		'schemaVersion',
		'subject'
	].sort();
	exactKeys(value, keys, 'Native projection request');
	const budgets = admitBudgets(ownData(value, 'budgets'));
	const subject = admitSubject(ownData(value, 'subject'), budgets);
	const schemaVersion = ownData(value, 'schemaVersion');
	const operationVersion = ownData(value, 'operationVersion');
	if (schemaVersion !== JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION)
		fail(
			'REQUEST_VERSION_UNSUPPORTED',
			'incompatible',
			'Native projection schema version is unsupported.'
		);
	if (operationVersion !== JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION)
		fail(
			'OPERATION_VERSION_UNSUPPORTED',
			'incompatible',
			'Native projection operation version is unsupported.'
		);
	const executionDisposition = ownData(value, 'executionDisposition');
	if (executionDisposition !== 'RUN' && executionDisposition !== 'NOT_RUN')
		fail('REQUEST_INVALID', 'incompatible', 'executionDisposition must be RUN or NOT_RUN.');
	const executionId = ownData(value, 'executionId');
	if (
		typeof executionId !== 'string' ||
		executionId.length === 0 ||
		executionId.length > 2_048 ||
		!isUnicodeScalarString(executionId)
	)
		fail('REQUEST_INVALID', 'incompatible', 'executionId must be bounded Unicode scalar text.');
	const freshness = admitFreshness(ownData(value, 'freshness'), budgets.maxArtifacts * 2 + 1);
	return Object.freeze({
		budgets,
		executionDisposition,
		executionId,
		freshness,
		operationVersion,
		schemaVersion,
		subject
	});
}

function scriptKind(path: string): ts.ScriptKind {
	if (/\.tsx$/u.test(path)) return ts.ScriptKind.TSX;
	if (/\.[cm]?jsx$/u.test(path)) return ts.ScriptKind.JSX;
	if (/\.[cm]?js$/u.test(path)) return ts.ScriptKind.JS;
	if (/\.json$/u.test(path)) return ts.ScriptKind.JSON;
	return ts.ScriptKind.TS;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function buildCorpus(
	request: AdmittedRequest,
	assertWithinBudget: () => void,
	parseSources: boolean
): Corpus {
	const selected = request.subject.artifacts.filter(
		(artifact) => SOURCE_PATH.test(artifact.path) || GOVERNED_TEXT_PATHS.has(artifact.path)
	);
	if (selected.length > request.budgets.maxArtifacts)
		fail('ARTIFACT_BUDGET_EXCEEDED', 'resource-refused', 'Selected artifact count exceeds budget.');
	const totalBytes = selected.reduce((total, artifact) => total + artifact.bytes, 0);
	if (!Number.isSafeInteger(totalBytes) || totalBytes > request.budgets.maxSourceBytes)
		fail('SOURCE_BYTE_BUDGET_EXCEEDED', 'resource-refused', 'Selected source bytes exceed budget.');
	let astNodes = 0;
	const consumeAstVisit = (): void => {
		astNodes += 1;
		if ((astNodes & 1_023) === 0) assertWithinBudget();
		if (astNodes > request.budgets.maxAstNodes)
			fail(
				'AST_NODE_BUDGET_EXCEEDED',
				'resource-refused',
				'Parsed and visited AST node count exceeds budget.'
			);
	};
	const entries: SourceEntry[] = [];
	for (const artifact of selected) {
		assertWithinBudget();
		const bytes = readFrozenSubjectArtifact(request.subject.capability, artifact.path);
		if (bytes === undefined)
			fail(
				'FROZEN_BYTES_UNAVAILABLE',
				'failed',
				'A selected frozen artifact lacks retained bytes.'
			);
		if (bytes.byteLength !== artifact.bytes || sha256(bytes) !== artifact.sha256)
			fail('FROZEN_BYTES_MISMATCH', 'failed', 'Selected frozen bytes do not match their manifest.');
		let text: string;
		try {
			text = UTF8.decode(bytes);
		} catch {
			fail('SOURCE_ENCODING_UNSUPPORTED', 'incompatible', 'Selected source is not valid UTF-8.');
		}
		entries.push(Object.freeze({ artifactSha256: artifact.sha256, path: artifact.path, text }));
	}
	entries.sort((left, right) => left.path.localeCompare(right.path, 'en'));
	const sourceWitness = canonicalSemanticJsonWitness(
		entries.map(({ artifactSha256, path }) => ({ path, sha256: artifactSha256 }))
	);
	const parsedSources = new Map<string, ts.SourceFile | null>();
	const parseSource = (entry: SourceEntry): ts.SourceFile | null => {
		if (parsedSources.has(entry.path)) return parsedSources.get(entry.path) ?? null;
		if (!parseSources || entry.path.endsWith('.json') || GOVERNED_TEXT_PATHS.has(entry.path)) {
			parsedSources.set(entry.path, null);
			return null;
		}
		const sourceFile = ts.createSourceFile(
			entry.path,
			entry.text,
			ts.ScriptTarget.Latest,
			true,
			scriptKind(entry.path)
		);
		assertWithinBudget();
		if (
			((sourceFile as ts.SourceFile & { readonly parseDiagnostics?: readonly ts.Diagnostic[] })
				.parseDiagnostics?.length ?? 0) > 0
		)
			fail(
				'SOURCE_PARSE_FAILED',
				'incompatible',
				`Selected source ${entry.path} has TypeScript parse diagnostics.`
			);
		const count = (node: ts.Node): void => {
			consumeAstVisit();
			ts.forEachChild(node, count);
		};
		count(sourceFile);
		parsedSources.set(entry.path, sourceFile);
		return sourceFile;
	};
	return Object.freeze({
		byPath: new Map(entries.map((entry) => [entry.path, entry])),
		checkpoint: assertWithinBudget,
		consumeAstVisit,
		entries: Object.freeze(entries),
		parseSource,
		sourceWitness
	});
}

function entries(corpus: Corpus, pattern: RegExp): readonly SourceEntry[] {
	return corpus.entries.filter((entry) => pattern.test(entry.path));
}

function production(corpus: Corpus, pattern: RegExp): readonly SourceEntry[] {
	return entries(corpus, pattern).filter(
		(entry) => PRODUCTION_PATH.test(entry.path) && !TEST_PATH.test(entry.path)
	);
}

function visit(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	consume: (node: ts.Node, entry: SourceEntry) => void
): void {
	for (const entry of sources) {
		corpus.checkpoint();
		const sourceFile = corpus.parseSource(entry);
		if (sourceFile === null) continue;
		const walk = (node: ts.Node): void => {
			corpus.consumeAstVisit();
			consume(node, entry);
			ts.forEachChild(node, walk);
		};
		walk(sourceFile);
	}
}

function nodeText(node: ts.Node, entry: SourceEntry): string {
	return entry.text.slice(node.getStart(), node.end);
}

function semanticMember(label: string, entry: SourceEntry, node: ts.Node): string {
	return `${entry.path}#${label}@${node.getStart()}`;
}

function propertyName(node: ts.PropertyName | ts.BindingName | undefined): string | null {
	if (node === undefined) return null;
	if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
	if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
	return null;
}

function declarationName(node: ts.NamedDeclaration): string | null {
	const name = node.name;
	if (
		name === undefined ||
		(!ts.isIdentifier(name) &&
			!ts.isPrivateIdentifier(name) &&
			!ts.isStringLiteralLike(name) &&
			!ts.isNumericLiteral(name))
	)
		return null;
	return propertyName(name);
}

function callName(expression: ts.LeftHandSideExpression): string | null {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	if (
		ts.isElementAccessExpression(expression) &&
		expression.argumentExpression !== undefined &&
		ts.isStringLiteralLike(expression.argumentExpression)
	)
		return expression.argumentExpression.text;
	return null;
}

function unwrapObjectLiteral(
	expression: ts.Expression | undefined
): ts.ObjectLiteralExpression | null {
	let candidate = expression;
	while (
		candidate !== undefined &&
		(ts.isAsExpression(candidate) ||
			ts.isSatisfiesExpression(candidate) ||
			ts.isParenthesizedExpression(candidate))
	)
		candidate = candidate.expression;
	return candidate !== undefined && ts.isObjectLiteralExpression(candidate) ? candidate : null;
}

function directObjectProperty(
	object: ts.ObjectLiteralExpression,
	name: string
): ts.PropertyAssignment | null {
	const matches = object.properties.filter(
		(property): property is ts.PropertyAssignment =>
			ts.isPropertyAssignment(property) && propertyName(property.name) === name
	);
	return matches.length === 1 ? matches[0]! : null;
}

function isAuthorityEnforcementCallName(name: string): boolean {
	return /^(?:authorize(?:[A-Z_].*)?|assertAuthorized|checkAuthority(?:[A-Z_].*)?|enforceAuthority(?:[A-Z_].*)?|requireAuthority(?:[A-Z_].*)?|resolve[A-Z_].*Authorization|validateAuthority(?:[A-Z_].*)?|authorityHeld)$/u.test(
		name
	);
}

function callResultControlsBranch(
	call: ts.CallExpression,
	root: ts.FunctionLikeDeclaration | ts.SourceFile
): boolean {
	let current: ts.Node = call;
	while (current.parent !== undefined && current !== root) {
		const parent = current.parent;
		if (ts.isIfStatement(parent) && parent.expression === current) return true;
		if (ts.isConditionalExpression(parent) && parent.condition === current) return true;
		if (
			ts.isBinaryExpression(parent) &&
			parent.left === current &&
			(parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
				parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)
		)
			return true;
		current = parent;
	}
	return false;
}

function calls(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	matcher: string | RegExp
): readonly { readonly entry: SourceEntry; readonly node: ts.CallExpression }[] {
	const result: { entry: SourceEntry; node: ts.CallExpression }[] = [];
	visit(corpus, sources, (node, entry) => {
		if (!ts.isCallExpression(node)) return;
		const name = callName(node.expression);
		if (name !== null && (typeof matcher === 'string' ? name === matcher : matcher.test(name)))
			result.push({ entry, node });
	});
	return result;
}

function countNamedDeclarations(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	matcher: string | RegExp
): number {
	let count = 0;
	visit(corpus, sources, (node) => {
		let name: string | null = null;
		if (
			ts.isVariableDeclaration(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isPropertyDeclaration(node) ||
			ts.isPropertySignature(node) ||
			ts.isParameter(node) ||
			ts.isInterfaceDeclaration(node) ||
			ts.isTypeAliasDeclaration(node) ||
			ts.isClassDeclaration(node)
		)
			name = propertyName(node.name);
		if (name !== null && (typeof matcher === 'string' ? name === matcher : matcher.test(name)))
			count += 1;
	});
	return count;
}

function hasExportModifier(node: ts.Node): boolean {
	return (
		ts.canHaveModifiers(node) &&
		(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
			false)
	);
}

function isDirectlyExportedDeclaration(node: ts.NamedDeclaration): boolean {
	if (hasExportModifier(node)) return true;
	if (ts.isVariableDeclaration(node)) {
		const declarationList = node.parent;
		return (
			ts.isVariableDeclarationList(declarationList) && hasExportModifier(declarationList.parent)
		);
	}
	return false;
}

function countExportedNamedDeclarations(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	matcher: string | RegExp
): number {
	let count = 0;
	visit(corpus, sources, (node) => {
		if (
			(ts.isInterfaceDeclaration(node) ||
				ts.isTypeAliasDeclaration(node) ||
				ts.isClassDeclaration(node) ||
				ts.isFunctionDeclaration(node) ||
				ts.isVariableDeclaration(node)) &&
			isDirectlyExportedDeclaration(node)
		) {
			const name = declarationName(node);
			if (name !== null && (typeof matcher === 'string' ? name === matcher : matcher.test(name)))
				count += 1;
			return;
		}
	});
	return count;
}

function namedDeclarationSites(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	matcher: string | RegExp
): readonly { readonly entry: SourceEntry; readonly node: ts.NamedDeclaration }[] {
	const result: { entry: SourceEntry; node: ts.NamedDeclaration }[] = [];
	visit(corpus, sources, (node, entry) => {
		if (!('name' in node)) return;
		const named = node as ts.NamedDeclaration;
		const name = declarationName(named);
		if (name !== null && (typeof matcher === 'string' ? name === matcher : matcher.test(name)))
			result.push({ entry, node: named });
	});
	return result;
}

interface NamedFunctionSite {
	readonly declaration: ts.NamedDeclaration;
	readonly entry: SourceEntry;
	readonly root: ts.FunctionLikeDeclaration;
}

function functionRoot(node: ts.NamedDeclaration): ts.FunctionLikeDeclaration | null {
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	)
		return node;
	if (
		ts.isVariableDeclaration(node) &&
		node.initializer !== undefined &&
		(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
	)
		return node.initializer;
	return null;
}

function namedFunctionSites(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	matcher: string | RegExp
): { readonly sites: readonly NamedFunctionSite[]; readonly uncertainties: readonly string[] } {
	const sites: NamedFunctionSite[] = [];
	const uncertainties: string[] = [];
	for (const site of namedDeclarationSites(corpus, sources, matcher)) {
		const root = functionRoot(site.node);
		if (root === null) {
			uncertainties.push(
				`FUNCTION_DECLARATION_LAYOUT_UNSUPPORTED:${site.entry.path}#${declarationName(site.node) ?? 'anonymous'}@${site.node.getStart()}`
			);
			continue;
		}
		sites.push({ declaration: site.node, entry: site.entry, root });
	}
	return { sites, uncertainties };
}

function visitFunction(
	corpus: Corpus,
	site: NamedFunctionSite,
	consume: (node: ts.Node, entry: SourceEntry) => void
): void {
	const body = site.root.body;
	if (body === undefined) return;
	const walk = (node: ts.Node): void => {
		corpus.consumeAstVisit();
		if (node !== body && ts.isFunctionLike(node)) return;
		consume(node, site.entry);
		ts.forEachChild(node, walk);
	};
	walk(body);
}

function callsInFunctions(
	corpus: Corpus,
	sites: readonly NamedFunctionSite[],
	matcher: string | RegExp
): readonly { readonly entry: SourceEntry; readonly node: ts.CallExpression }[] {
	const result: { entry: SourceEntry; node: ts.CallExpression }[] = [];
	for (const site of sites)
		visitFunction(corpus, site, (node, entry) => {
			if (!ts.isCallExpression(node)) return;
			const name = callName(node.expression);
			if (name !== null && (typeof matcher === 'string' ? name === matcher : matcher.test(name)))
				result.push({ entry, node });
		});
	return result;
}

function countPropertyAccessesInFunctions(
	corpus: Corpus,
	sites: readonly NamedFunctionSite[],
	name: string
): number {
	let count = 0;
	for (const site of sites)
		visitFunction(corpus, site, (node) => {
			if (ts.isPropertyAccessExpression(node) && node.name.text === name) count += 1;
			else if (
				ts.isElementAccessExpression(node) &&
				node.argumentExpression !== undefined &&
				ts.isStringLiteralLike(node.argumentExpression) &&
				node.argumentExpression.text === name
			)
				count += 1;
		});
	return count;
}

function countObjectPropertyValueInFunctions(
	corpus: Corpus,
	sites: readonly NamedFunctionSite[],
	name: string,
	valuePattern: RegExp
): number {
	let count = 0;
	for (const site of sites)
		visitFunction(corpus, site, (node, entry) => {
			if (
				ts.isPropertyAssignment(node) &&
				propertyName(node.name) === name &&
				valuePattern.test(nodeText(node.initializer, entry))
			)
				count += 1;
		});
	return count;
}

function countPropertyAccesses(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string
): number {
	let count = 0;
	visit(corpus, sources, (node) => {
		if (ts.isPropertyAccessExpression(node) && node.name.text === name) count += 1;
		else if (
			ts.isElementAccessExpression(node) &&
			node.argumentExpression !== undefined &&
			ts.isStringLiteralLike(node.argumentExpression) &&
			node.argumentExpression.text === name
		)
			count += 1;
	});
	return count;
}

function variableObject(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string
): { readonly entry: SourceEntry; readonly object: ts.ObjectLiteralExpression } | null {
	let found: { entry: SourceEntry; object: ts.ObjectLiteralExpression } | null = null;
	visit(corpus, sources, (node, entry) => {
		if (found !== null || !ts.isVariableDeclaration(node) || propertyName(node.name) !== name)
			return;
		let initializer = node.initializer;
		while (
			initializer !== undefined &&
			(ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))
		)
			initializer = initializer.expression;
		if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
			found = { entry, object: initializer };
			return;
		}
		if (initializer !== undefined && ts.isCallExpression(initializer)) {
			const object = initializer.arguments.find(ts.isObjectLiteralExpression);
			if (object !== undefined) found = { entry, object };
		}
	});
	return found;
}

function objectStringValues(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string
): {
	readonly complete: boolean;
	readonly members: readonly string[];
	readonly values: readonly string[];
} {
	const found = variableObject(corpus, sources, name);
	const declarations = namedDeclarationSites(corpus, sources, name);
	if (found === null || declarations.length !== 1)
		return { complete: false, members: [], values: [] };
	const values: string[] = [];
	const names = new Set<string>();
	for (const property of found.object.properties) {
		if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer))
			return { complete: false, members: [], values: [] };
		const name = propertyName(property.name);
		if (name === null || names.has(name)) return { complete: false, members: [], values: [] };
		names.add(name);
		values.push(property.initializer.text);
	}
	if (new Set(values).size !== values.length) return { complete: false, members: [], values: [] };
	return {
		complete: true,
		members: declarations.map(({ entry, node }) => semanticMember(name, entry, node)),
		values: [...values].sort()
	};
}

function objectPropertyCount(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string
): number {
	return (
		variableObject(corpus, sources, name)?.object.properties.filter(ts.isPropertyAssignment)
			.length ?? 0
	);
}

function countObjectPropertyValue(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string,
	valuePattern: RegExp
): number {
	let count = 0;
	visit(corpus, sources, (node, entry) => {
		if (
			ts.isPropertyAssignment(node) &&
			propertyName(node.name) === name &&
			valuePattern.test(nodeText(node.initializer, entry))
		)
			count += 1;
	});
	return count;
}

function stringLiterals(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	pattern: RegExp
): readonly string[] {
	const values = new Set<string>();
	visit(corpus, sources, (node) => {
		if (ts.isStringLiteralLike(node) && pattern.test(node.text)) values.add(node.text);
	});
	return [...values].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
}

function targetMembers(corpus: Corpus, patterns: readonly RegExp[]): readonly string[] {
	return corpus.entries
		.filter((entry) => patterns.some((pattern) => pattern.test(entry.path)))
		.map((entry) => entry.path)
		.sort();
}

function projected(
	corpus: Corpus,
	patterns: readonly RegExp[],
	facts: Readonly<Record<string, HarmonizationRuleFactValue>>,
	options: {
		readonly members?: readonly string[];
		readonly uncertainties?: readonly string[];
	} = {}
): RuleProjectionSeed {
	const sourceReferences = targetMembers(corpus, patterns);
	return {
		facts,
		members: options.members ?? sourceReferences,
		sourceReferences,
		uncertainties: options.uncertainties ?? []
	};
}

function projectFinding1(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/execution\.ts$/u;
	const source = production(corpus, pattern);
	const floorCalls = calls(corpus, source, 'floorGateBlock');
	const uncertainties: string[] = [];
	let falseCallsites = 0;
	for (const { entry, node } of floorCalls) {
		const argumentObjects = node.arguments
			.map((argument) => unwrapObjectLiteral(argument))
			.filter((argument): argument is ts.ObjectLiteralExpression => argument !== null);
		const candidates = argumentObjects.flatMap((object) =>
			object.properties.filter(
				(property): property is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
					(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
					propertyName(property.name) === 'aiProduced'
			)
		);
		if (candidates.length !== 1) {
			uncertainties.push(
				'FLOOR_GATE_AI_PRODUCED_ARGUMENT_UNRESOLVED:' + semanticMember('call', entry, node)
			);
			continue;
		}
		const candidate = candidates[0]!;
		if (ts.isShorthandPropertyAssignment(candidate)) {
			uncertainties.push(
				'FLOOR_GATE_AI_PRODUCED_VALUE_UNRESOLVED:' + semanticMember('call', entry, node)
			);
			continue;
		}
		let value = candidate.initializer;
		while (
			ts.isAsExpression(value) ||
			ts.isSatisfiesExpression(value) ||
			ts.isParenthesizedExpression(value)
		)
			value = value.expression;
		if (value.kind === ts.SyntaxKind.FalseKeyword) falseCallsites += 1;
		else if (value.kind !== ts.SyntaxKind.TrueKeyword)
			uncertainties.push(
				'FLOOR_GATE_AI_PRODUCED_VALUE_UNRESOLVED:' + semanticMember('call', entry, node)
			);
	}
	const writerCalls = calls(corpus, source, /^(?:record|write|persist).*Floor$/u);
	return projected(
		corpus,
		[pattern],
		{
			aiProducedFalseCallsites: falseCallsites,
			executionFloorWriterSites: writerCalls.length,
			floorGateCallsites: floorCalls.length
		},
		{
			members: [...floorCalls, ...writerCalls].map(({ entry, node }) =>
				semanticMember('call', entry, node)
			),
			uncertainties
		}
	);
}

function projectFinding3(corpus: Corpus): RuleProjectionSeed {
	const declarationPattern = /^packages\/rph-contracts\/src\/messages\.ts$/u;
	const applicationPattern = /^packages\/rph-application\/src\/.+\.ts$/u;
	const productionApplication = production(corpus, applicationPattern);
	const declarations = namedDeclarationSites(
		corpus,
		production(corpus, declarationPattern),
		'expectedRevision'
	);
	const reads: { entry: SourceEntry; node: ts.Node }[] = [];
	const uncertainties: string[] = [];
	const acceptedReceiver = /(?:^|\.)(?:cmd|command|commandEnvelope|envelope|request)$/iu;
	visit(corpus, productionApplication, (node, entry) => {
		let receiver: ts.Expression | null = null;
		if (ts.isPropertyAccessExpression(node) && node.name.text === 'expectedRevision')
			receiver = node.expression;
		else if (
			ts.isElementAccessExpression(node) &&
			node.argumentExpression !== undefined &&
			ts.isStringLiteralLike(node.argumentExpression) &&
			node.argumentExpression.text === 'expectedRevision'
		)
			receiver = node.expression;
		if (receiver === null) return;
		if (acceptedReceiver.test(nodeText(receiver, entry))) reads.push({ entry, node });
		else
			uncertainties.push(
				'EXPECTED_REVISION_RECEIVER_UNRESOLVED:' + semanticMember('expectedRevision', entry, node)
			);
	});
	const updateCalls = calls(corpus, productionApplication, 'commitState');
	return projected(
		corpus,
		[declarationPattern, applicationPattern],
		{
			expectedRevisionDeclarations: declarations.length,
			expectedRevisionProductionReads: reads.length,
			stateUpdateHandlers: updateCalls.length
		},
		{
			members: [
				...declarations.map(({ entry, node }) =>
					semanticMember('expectedRevision-declaration', entry, node)
				),
				...reads.map(({ entry, node }) => semanticMember('expectedRevision-read', entry, node)),
				...updateCalls.map(({ entry, node }) => semanticMember('state-update', entry, node))
			],
			uncertainties
		}
	);
}

function projectFinding5(corpus: Corpus): RuleProjectionSeed {
	const registryPattern = /^packages\/rph-contracts\/src\/messages\.ts$/u;
	const applicationPattern = /^packages\/rph-application\/src\/.+\.ts$/u;
	const consumerPattern = /^packages\/rph-(?:application|contracts)\/src\/.+\.ts$/u;
	const consumers = production(corpus, consumerPattern);
	const aliases = new Set(['EVENTS']);
	const aliasInitializers: { readonly alias: string; readonly initializer: ts.Expression }[] = [];
	visit(corpus, consumers, (node) => {
		if (ts.isImportSpecifier(node)) {
			const imported = node.propertyName?.text ?? node.name.text;
			if (imported === 'EVENTS') aliases.add(node.name.text);
			return;
		}
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer !== undefined
		)
			aliasInitializers.push({ alias: node.name.text, initializer: node.initializer });
	});
	const containsAlias = (root: ts.Node): boolean => {
		let found = false;
		const walk = (node: ts.Node): void => {
			if (found) return;
			if (ts.isIdentifier(node) && aliases.has(node.text)) {
				found = true;
				return;
			}
			ts.forEachChild(node, walk);
		};
		walk(root);
		return found;
	};
	let changed = true;
	while (changed) {
		changed = false;
		for (const { alias, initializer } of aliasInitializers)
			if (!aliases.has(alias) && containsAlias(initializer)) {
				aliases.add(alias);
				changed = true;
			}
	}
	const uncertainties: string[] = [];
	const validationCalls = calls(corpus, consumers, 'safeParse').filter(({ entry, node }) => {
		let receiver: ts.Expression | null = null;
		if (ts.isPropertyAccessExpression(node.expression)) receiver = node.expression.expression;
		else if (ts.isElementAccessExpression(node.expression)) receiver = node.expression.expression;
		if (receiver !== null && containsAlias(receiver)) return true;
		if (/(?:event|ratifiedEventPayload)/iu.test(nodeText(node.parent, entry)))
			uncertainties.push(
				'EVENT_REGISTRY_VALIDATION_ORIGIN_UNRESOLVED:' + semanticMember('safeParse', entry, node)
			);
		return false;
	});
	const emissionCalls = calls(corpus, production(corpus, applicationPattern), 'makeEvent');
	const registryDeclarations = namedDeclarationSites(
		corpus,
		entries(corpus, registryPattern),
		'EVENTS'
	);
	return projected(
		corpus,
		[registryPattern, applicationPattern, consumerPattern],
		{
			eventRegistryEntries: objectPropertyCount(corpus, entries(corpus, registryPattern), 'EVENTS'),
			eventRegistryValidationConsumers: validationCalls.length,
			productionEventEmissionSites: emissionCalls.length
		},
		{
			members: [
				...registryDeclarations.map(({ entry, node }) =>
					semanticMember('EVENTS-registry', entry, node)
				),
				...validationCalls.map(({ entry, node }) =>
					semanticMember('EVENTS-validation', entry, node)
				),
				...emissionCalls.map(({ entry, node }) => semanticMember('event-emission', entry, node))
			],
			uncertainties
		}
	);
}

function projectFinding6(corpus: Corpus): RuleProjectionSeed {
	const domainPattern = /^packages\/rph-domain\/src\/.+\.ts$/u;
	const applicationPattern = /^packages\/rph-application\/src\/.+\.ts$/u;
	const floorPattern = /^packages\/rph-assurance\/src\/floor\.ts$/u;
	return projected(corpus, [domainPattern, applicationPattern, floorPattern], {
		kernelProductionCallers: calls(
			corpus,
			production(corpus, applicationPattern),
			'classifyEvidenceInvalidation'
		).length,
		liveFloorHardcodedValidEvidenceInputs:
			countObjectPropertyValue(corpus, entries(corpus, floorPattern), 'evidenceExists', /^true$/u) +
			countObjectPropertyValue(
				corpus,
				entries(corpus, floorPattern),
				'evidenceInvalidated',
				/^false$/u
			),
		propertyP4Tests: stringLiterals(
			corpus,
			entries(corpus, domainPattern).filter((entry) => TEST_PATH.test(entry.path)),
			/^P4$/u
		).length
	});
}

function projectFinding8(corpus: Corpus): RuleProjectionSeed {
	const portPattern = /^packages\/rph-ports\/src\/.+\.ts$/u;
	const guidePattern = new RegExp(`^${escapeRegExp(GOVERNED_IMPLEMENTATION_GUIDE_PATH)}$`, 'u');
	const guide = corpus.byPath.get(GOVERNED_IMPLEMENTATION_GUIDE_PATH);
	const requirements =
		guide?.text.match(/^[ \t]*-[ \t]+Authorize at action time\b/gimu)?.length ?? 0;
	const ports = production(corpus, portPattern);
	const uncertainties: string[] = [];
	visit(corpus, ports, (node, entry) => {
		if (ts.isExportSpecifier(node) && /(?:Capability)?Authorizer(?:Port)?/u.test(node.name.text))
			uncertainties.push(
				'AUTHORIZER_REEXPORT_REQUIRES_SYMBOL_RESOLUTION:' +
					semanticMember(node.name.text, entry, node)
			);
	});
	return projected(
		corpus,
		[portPattern, guidePattern],
		{
			documentedAuthorizerPortRequirements: requirements,
			exportedAuthorizerPortDeclarations: countExportedNamedDeclarations(
				corpus,
				ports,
				/(?:Capability)?Authorizer(?:Port)?/u
			)
		},
		{ uncertainties }
	);
}

function projectFinding11(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-contracts\/src\/objects\.ts$/u;
	const envelopePattern = /^packages\/rph-contracts\/src\/envelopes\.ts$/u;
	const source = entries(corpus, pattern);
	const envelopeSource = entries(corpus, envelopePattern);
	const schema = variableObject(corpus, source, 'AssurancePolicyDefinitionSchema');
	const envelope = variableObject(corpus, envelopeSource, 'objectEnvelopeShape');
	const schemaDeclarations = namedDeclarationSites(
		corpus,
		source,
		'AssurancePolicyDefinitionSchema'
	);
	const envelopeDeclarations = namedDeclarationSites(corpus, envelopeSource, 'objectEnvelopeShape');
	const uncertainties: string[] = [];
	if (schemaDeclarations.length > 1) uncertainties.push('TARGET_SCHEMA_DECLARATION_AMBIGUOUS');
	if (schemaDeclarations.length === 1 && schema === null)
		uncertainties.push('TARGET_SCHEMA_OBJECT_LAYOUT_UNSUPPORTED');
	if (schema !== null && envelopeDeclarations.length !== 1)
		uncertainties.push('OBJECT_ENVELOPE_SHAPE_DECLARATION_AMBIGUOUS');
	if (schema !== null && envelope === null)
		uncertainties.push('OBJECT_ENVELOPE_SHAPE_LAYOUT_UNSUPPORTED');
	let postSpreadWeakerRedeclarations = 0;
	let constrainedEnvelopeFieldsOverridden = 0;
	if (schema !== null && envelope !== null) {
		if (
			schema.object.properties.some(
				(property) =>
					ts.isSpreadAssignment(property) &&
					nodeText(property.expression, schema.entry) !== 'objectEnvelopeShape'
			)
		)
			uncertainties.push('TARGET_SCHEMA_ADDITIONAL_SPREAD_UNSUPPORTED');
		if (envelope.object.properties.some(ts.isSpreadAssignment))
			uncertainties.push('OBJECT_ENVELOPE_SHAPE_SPREAD_UNSUPPORTED');
		const spreadIndexes = schema.object.properties
			.map((property, index) => ({ index, property }))
			.filter(
				(item) =>
					ts.isSpreadAssignment(item.property) &&
					nodeText(item.property.expression, schema.entry) === 'objectEnvelopeShape'
			)
			.map(({ index }) => index);
		if (spreadIndexes.length !== 1) uncertainties.push('OBJECT_ENVELOPE_SPREAD_LAYOUT_UNSUPPORTED');
		const spreadIndex = spreadIndexes[0] ?? Number.POSITIVE_INFINITY;
		const envelopeFields = new Map<string, string>();
		for (const property of envelope.object.properties) {
			if (!ts.isPropertyAssignment(property)) continue;
			const name = propertyName(property.name);
			if (name === null) {
				uncertainties.push('OBJECT_ENVELOPE_COMPUTED_FIELD_UNSUPPORTED');
				continue;
			}
			if (envelopeFields.has(name)) uncertainties.push('OBJECT_ENVELOPE_FIELD_DUPLICATED');
			envelopeFields.set(name, nodeText(property.initializer, envelope.entry));
		}
		if (!/\bRphIdSchema\b/u.test(envelopeFields.get('id') ?? ''))
			uncertainties.push('OBJECT_ENVELOPE_ID_CONSTRAINT_UNRECOGNIZED');
		if (!/\bSemanticVersionSchema\b/u.test(envelopeFields.get('semanticVersion') ?? ''))
			uncertainties.push('OBJECT_ENVELOPE_SEMANTIC_VERSION_CONSTRAINT_UNRECOGNIZED');
		const finalOverrides = new Map<string, ts.PropertyAssignment>();
		for (const [index, property] of schema.object.properties.entries()) {
			if (index <= spreadIndex) continue;
			if (!ts.isPropertyAssignment(property)) {
				if (!ts.isSpreadAssignment(property))
					uncertainties.push('TARGET_SCHEMA_POST_SPREAD_FIELD_LAYOUT_UNSUPPORTED');
				continue;
			}
			const name = propertyName(property.name);
			if (name === null) {
				uncertainties.push('TARGET_SCHEMA_POST_SPREAD_COMPUTED_FIELD_UNSUPPORTED');
				continue;
			}
			if (name === 'id' || name === 'semanticVersion') finalOverrides.set(name, property);
		}
		constrainedEnvelopeFieldsOverridden = finalOverrides.size;
		for (const [name, property] of finalOverrides) {
			const text = nodeText(property.initializer, schema.entry);
			if (
				(name === 'id' && /z\.string\s*\(\s*\)/u.test(text)) ||
				(name === 'semanticVersion' && /z\.number\s*\(\s*\)\.int\s*\(\s*\)/u.test(text))
			)
				postSpreadWeakerRedeclarations += 1;
		}
	}
	return projected(
		corpus,
		[pattern, envelopePattern],
		{
			constrainedEnvelopeFieldsOverridden,
			postSpreadWeakerRedeclarations,
			targetSchemaDeclarations: schemaDeclarations.length
		},
		{
			members: schemaDeclarations.map(({ entry, node }) =>
				semanticMember('AssurancePolicyDefinitionSchema', entry, node)
			),
			uncertainties
		}
	);
}

function projectFinding12(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^(?:apps\/rph-demo|packages\/rph-assurance)\/src\/.+\.[cm]?[jt]sx?$/u;
	const sources = production(corpus, pattern);
	const identityCalls = calls(corpus, sources, 'identityProvenanceValidator');
	const keys = new Set([
		'hasStableId',
		'hasSemanticVersion',
		'hasProvenance',
		'hasProducer',
		'traceComplete'
	]);
	let argumentsCount = 0;
	let literalTrue = 0;
	const uncertainties: string[] = [];
	if (identityCalls.length > 1)
		uncertainties.push('IDENTITY_PROVENANCE_CALLSITE_POPULATION_NOT_UNIQUE');
	for (const { entry, node } of identityCalls) {
		const factsArgument = node.arguments[1];
		if (factsArgument === undefined) {
			uncertainties.push(
				`IDENTITY_PROVENANCE_FACT_ARGUMENT_MISSING:${semanticMember('call', entry, node)}`
			);
			continue;
		}
		const object = unwrapObjectLiteral(factsArgument);
		if (object === null) {
			uncertainties.push(
				`IDENTITY_PROVENANCE_FACT_ARGUMENT_LAYOUT_UNSUPPORTED:${semanticMember('call', entry, node)}`
			);
			continue;
		}
		if (object.properties.some(ts.isSpreadAssignment))
			uncertainties.push(
				`IDENTITY_PROVENANCE_FACT_SPREAD_UNSUPPORTED:${semanticMember('call', entry, node)}`
			);
		const observedKeys = new Set<string>();
		for (const property of object.properties) {
			if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
				if (!ts.isSpreadAssignment(property))
					uncertainties.push(
						`IDENTITY_PROVENANCE_FACT_PROPERTY_LAYOUT_UNSUPPORTED:${semanticMember('call', entry, node)}`
					);
				continue;
			}
			const name = propertyName(property.name);
			if (name === null) {
				uncertainties.push(
					`IDENTITY_PROVENANCE_FACT_COMPUTED_KEY_UNSUPPORTED:${semanticMember('call', entry, node)}`
				);
				continue;
			}
			if (!keys.has(name)) continue;
			if (observedKeys.has(name))
				uncertainties.push(
					`IDENTITY_PROVENANCE_FACT_DUPLICATE:${name}:${semanticMember('call', entry, node)}`
				);
			observedKeys.add(name);
			argumentsCount += 1;
			if (ts.isPropertyAssignment(property)) {
				let initializer = property.initializer;
				while (
					ts.isAsExpression(initializer) ||
					ts.isSatisfiesExpression(initializer) ||
					ts.isParenthesizedExpression(initializer)
				)
					initializer = initializer.expression;
				if (initializer.kind === ts.SyntaxKind.TrueKeyword) literalTrue += 1;
			}
		}
	}
	return projected(
		corpus,
		[pattern],
		{
			identityProvenanceCriterionArguments: argumentsCount,
			identityProvenanceFloorCallsites: identityCalls.length,
			literalTrueCriterionArguments: literalTrue
		},
		{
			members: identityCalls.map(({ entry, node }) => semanticMember('call', entry, node)),
			uncertainties
		}
	);
}

function projectFinding17(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/pwa-authoring\.ts$/u;
	const source = production(corpus, pattern);
	const functions = namedFunctionSites(corpus, source, 'validatePwa');
	return projected(
		corpus,
		[pattern],
		{
			validatePwaHandlers: functions.sites.length,
			validatedStatusWrites: countObjectPropertyValueInFunctions(
				corpus,
				functions.sites,
				'target',
				/^['"]VALIDATED['"]$/u
			),
			validationEvaluatorCalls: callsInFunctions(
				corpus,
				functions.sites,
				/^(?:analyzePwaGraph|pwaCompositionGate)$/u
			).length
		},
		{
			members: functions.sites.map(({ declaration, entry }) =>
				semanticMember('validatePwa', entry, declaration)
			),
			uncertainties: functions.uncertainties
		}
	);
}

function projectFinding18(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/pwa-authoring\.ts$/u;
	const source = production(corpus, pattern);
	const functions = namedFunctionSites(
		corpus,
		source,
		/^(?:definePwuType|editPwuType|removePwuType)$/u
	);
	return projected(
		corpus,
		[pattern],
		{
			pwaAuthoringMutationHandlers: functions.sites.length,
			semanticVersionProductionWrites:
				callsInFunctions(corpus, functions.sites, 'withPwaVersionBump').length +
				countObjectPropertyValueInFunctions(
					corpus,
					functions.sites,
					'newSemanticVersion',
					/semanticVersion\s*\+\s*1/u
				)
		},
		{
			members: functions.sites.map(({ declaration, entry }) =>
				semanticMember(declarationName(declaration) ?? 'pwa-mutation', entry, declaration)
			),
			uncertainties: functions.uncertainties
		}
	);
}

function projectFinding22(corpus: Corpus): RuleProjectionSeed {
	const testPattern = /^packages\/rph-domain\/src\/conformance\.test\.ts$/u;
	const manifestPattern = /^packages\/rph-domain\/src\/conformance-manifest\.ts$/u;
	const guidePattern = new RegExp(`^${escapeRegExp(GOVERNED_IMPLEMENTATION_GUIDE_PATH)}$`, 'u');
	const guide = corpus.byPath.get(GOVERNED_IMPLEMENTATION_GUIDE_PATH);
	const requiredPropertyIds = new Set<string>();
	const requiredMembers: string[] = [];
	const uncertainties: string[] = [];
	if (guide !== undefined) {
		const heading = /^### 14\.2 Mandatory generative properties\s*$/gmu.exec(guide.text);
		if (heading === null) uncertainties.push('MANDATORY_PROPERTY_REGISTRY_SECTION_MISSING');
		else {
			const sectionStart = heading.index + heading[0].length;
			const nextHeading = /^###\s+/gmu;
			nextHeading.lastIndex = sectionStart;
			const sectionEnd = nextHeading.exec(guide.text)?.index ?? guide.text.length;
			const section = guide.text.slice(sectionStart, sectionEnd);
			const rows = /^\|\s*\*\*(P\d+)\*\*\s*\|/gmu;
			for (const row of section.matchAll(rows)) {
				const id = row[1]!;
				if (requiredPropertyIds.has(id))
					uncertainties.push(`MANDATORY_PROPERTY_REGISTRY_DUPLICATE:${id}`);
				requiredPropertyIds.add(id);
				requiredMembers.push(
					`${GOVERNED_IMPLEMENTATION_GUIDE_PATH}#${id}@${sectionStart + row.index!}`
				);
			}
			if (requiredPropertyIds.size === 0)
				uncertainties.push('MANDATORY_PROPERTY_REGISTRY_EMPTY_OR_UNRECOGNIZED');
		}
	}
	return projected(
		corpus,
		[testPattern, manifestPattern, guidePattern],
		{
			gatePropertyIds: stringLiterals(corpus, entries(corpus, testPattern), /^P\d+$/u),
			propertyTestIds: objectStringKeySet(
				corpus,
				entries(corpus, manifestPattern),
				'PROPERTY_COVERAGE'
			),
			requiredPropertyIds: [...requiredPropertyIds].sort((left, right) =>
				left.localeCompare(right, 'en', { numeric: true })
			)
		},
		{ members: requiredMembers, uncertainties }
	);
}

function objectStringKeySet(
	corpus: Corpus,
	sources: readonly SourceEntry[],
	name: string
): readonly string[] {
	const found = variableObject(corpus, sources, name);
	if (found === null) return [];
	return [
		...new Set(
			found.object.properties
				.map((property) => propertyName(property.name))
				.filter((value): value is string => value !== null)
		)
	].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
}

function projectFinding23(corpus: Corpus): RuleProjectionSeed {
	const testPattern = /^packages\/rph-domain\/src\/conformance\.test\.ts$/u;
	const catalogPattern = /^packages\/rph-domain\/vocab\/m12-conformance\.json$/u;
	const mutationTestPattern = /^packages\/rph-domain\/src\/.*mutation.*\.test\.ts$/u;
	const uncertainties: string[] = [];
	const mutationIds = new Set<string>();
	const catalog = corpus.byPath.get('packages/rph-domain/vocab/m12-conformance.json');
	if (catalog !== undefined) {
		try {
			const parsed = JSON.parse(catalog.text) as { mutationCatalog?: unknown };
			if (!Array.isArray(parsed.mutationCatalog))
				uncertainties.push('MUTATION_CATALOG_LAYOUT_UNSUPPORTED');
			else
				for (const [index, entry] of parsed.mutationCatalog.entries()) {
					if (
						entry === null ||
						typeof entry !== 'object' ||
						Array.isArray(entry) ||
						typeof (entry as { readonly id?: unknown }).id !== 'string' ||
						(entry as { readonly id: string }).id.length === 0
					) {
						uncertainties.push('MUTATION_CATALOG_ENTRY_LAYOUT_UNSUPPORTED:' + index);
						continue;
					}
					const id = (entry as { readonly id: string }).id;
					if (mutationIds.has(id)) uncertainties.push('MUTATION_CATALOG_ID_DUPLICATED:' + id);
					mutationIds.add(id);
				}
		} catch {
			uncertainties.push('MUTATION_CATALOG_JSON_INVALID');
		}
	}
	const censusSources = [
		...entries(corpus, testPattern),
		...entries(corpus, mutationTestPattern)
	].filter((entry, index, all) => all.findIndex(({ path }) => path === entry.path) === index);
	const runnableIds = new Set<string>();
	for (const entry of censusSources) {
		const executionCalls = calls(corpus, [entry], /^(?:execute|run).*Mutation/u);
		if (executionCalls.length === 0) continue;
		const referencedIds = stringLiterals(corpus, [entry], /.+/u).filter((value) =>
			mutationIds.has(value)
		);
		if (referencedIds.length === 0)
			uncertainties.push('MUTATION_EXECUTION_CATALOG_LINK_UNRESOLVED:' + entry.path);
		for (const id of referencedIds) runnableIds.add(id);
	}
	const assertionCalls = calls(corpus, entries(corpus, testPattern), 'toBeGreaterThan').filter(
		({ entry, node }) => /mutationCatalog/u.test(nodeText(node.parent, entry))
	);
	return projected(
		corpus,
		[testPattern, catalogPattern, mutationTestPattern],
		{
			catalogNonemptyAssertions: assertionCalls.length,
			mutationCatalogEntries: mutationIds.size,
			runnableMutationGateEntries: runnableIds.size
		},
		{
			members: [...mutationIds]
				.sort()
				.map((id) => 'packages/rph-domain/vocab/m12-conformance.json#mutation:' + id),
			uncertainties
		}
	);
}

function projectFinding28(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/assurance\.ts$/u;
	const source = production(corpus, pattern);
	const aliases = new Map([
		['evidenceConsideredIds', 'evidenceConsidered'],
		['evidenceConsidered', 'evidenceConsidered'],
		['evidenceRejected', 'rejectedEvidence'],
		['rejectedEvidence', 'rejectedEvidence'],
		['residualUncertainty', 'residualUncertainty']
	]);
	const creationSites = namedDeclarationSites(corpus, source, 'requestAssuranceAssessment');
	const initialized = new Set<string>();
	const writers = new Set<string>();
	const uncertainties = new Set<string>();
	if (creationSites.length !== 1) uncertainties.add('ASSESSMENT_CREATION_SITE_NOT_UNIQUE');
	const creation = creationSites[0];
	const birthObjects: { entry: SourceEntry; object: ts.ObjectLiteralExpression }[] = [];
	if (creation !== undefined) {
		visit(corpus, [creation.entry], (node, entry) => {
			if (
				!ts.isVariableDeclaration(node) ||
				propertyName(node.name) !== 'state' ||
				node.pos < creation.node.pos ||
				node.end > creation.node.end
			)
				return;
			const object = unwrapObjectLiteral(node.initializer);
			if (object === null) uncertainties.add('ASSESSMENT_BIRTH_STATE_LAYOUT_UNSUPPORTED');
			else birthObjects.push({ entry, object });
		});
	}
	if (creation !== undefined && birthObjects.length !== 1)
		uncertainties.add('ASSESSMENT_BIRTH_STATE_LAYOUT_UNSUPPORTED');
	const birth = birthObjects[0];
	if (birth !== undefined) {
		if (birth.object.properties.some(ts.isSpreadAssignment))
			uncertainties.add('ASSESSMENT_BIRTH_STATE_SPREAD_UNSUPPORTED');
		const seen = new Set<string>();
		for (const property of birth.object.properties) {
			if (!ts.isPropertyAssignment(property)) continue;
			const canonical = aliases.get(propertyName(property.name) ?? '');
			if (canonical === undefined) continue;
			if (seen.has(canonical)) uncertainties.add('ASSESSMENT_BIRTH_FIELD_DUPLICATED');
			seen.add(canonical);
			if (/^\[\s*\]$/u.test(nodeText(property.initializer, birth.entry)))
				initialized.add(canonical);
		}
	}
	for (const { entry, node } of calls(corpus, source, 'commitState')) {
		for (const argument of node.arguments) {
			const options = unwrapObjectLiteral(argument);
			if (options === null) continue;
			if (options.properties.some(ts.isSpreadAssignment))
				uncertainties.add('ASSESSMENT_COMMIT_LAYOUT_UNSUPPORTED');
			const objectType = directObjectProperty(options, 'objectType');
			if (objectType === null) continue;
			const objectTypeText = nodeText(objectType.initializer, entry);
			if (
				!/^(?:ASSESSMENT|ObjectType\.ASSESSMENT|['"]ASSURANCE_ASSESSMENT['"])$/u.test(
					objectTypeText
				)
			)
				continue;
			const nextStateProperty = directObjectProperty(options, 'nextState');
			const nextState = unwrapObjectLiteral(nextStateProperty?.initializer);
			if (nextState === null) {
				uncertainties.add('ASSESSMENT_NEXT_STATE_LAYOUT_UNSUPPORTED');
				continue;
			}
			if (nextState.properties.some(ts.isSpreadAssignment))
				uncertainties.add('ASSESSMENT_NEXT_STATE_SPREAD_UNSUPPORTED');
			const seen = new Set<string>();
			for (const property of nextState.properties) {
				if (!ts.isPropertyAssignment(property)) continue;
				const canonical = aliases.get(propertyName(property.name) ?? '');
				if (canonical === undefined) continue;
				if (seen.has(canonical)) uncertainties.add('ASSESSMENT_WRITER_FIELD_DUPLICATED');
				seen.add(canonical);
				const text = nodeText(property.initializer, entry);
				if (!/^(?:undefined|null)$/u.test(text) && !/\?\?\s*\[\s*\]$/u.test(text))
					writers.add(canonical);
			}
		}
	}
	return projected(
		corpus,
		[pattern],
		{
			assessmentCreationSites: creationSites.length,
			fieldsInitializedEmpty: [...initialized].sort(),
			fieldsWithNonemptyProductionWriters: [...writers].sort()
		},
		{
			members: creationSites.map(({ entry, node }) =>
				semanticMember('requestAssuranceAssessment', entry, node)
			),
			uncertainties: [...uncertainties].sort()
		}
	);
}

function projectFinding30(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-contracts\/src\/ids\.ts$/u;
	const source = production(corpus, pattern);
	const declarations = namedDeclarationSites(corpus, source, /^(?:RphIdSchema|isRphId)$/u);
	const schemaDeclarations = declarations.filter(
		({ node }) => declarationName(node) === 'RphIdSchema'
	);
	const validatorDeclarations = declarations.filter(
		({ node }) => declarationName(node) === 'isRphId'
	);
	const observe = (sites: typeof declarations) => {
		let enforces = false;
		let prefixRegistryIdentifierObserved = false;
		let rphShapeIdentifierObserved = false;
		for (const site of sites) {
			const walk = (node: ts.Node): void => {
				corpus.consumeAstVisit();
				if (ts.isIdentifier(node)) {
					if (node.text === 'RPH_ID_REGEX') rphShapeIdentifierObserved = true;
					if (node.text === 'KNOWN_ID_PREFIXES') prefixRegistryIdentifierObserved = true;
				}
				if (ts.isCallExpression(node) && callName(node.expression) === 'has') {
					let receiver: ts.Expression | undefined;
					if (ts.isPropertyAccessExpression(node.expression)) receiver = node.expression.expression;
					else if (ts.isElementAccessExpression(node.expression))
						receiver = node.expression.expression;
					if (receiver !== undefined && nodeText(receiver, site.entry) === 'KNOWN_ID_PREFIXES')
						enforces = true;
				}
				ts.forEachChild(node, walk);
			};
			walk(site.node);
		}
		return { enforces, prefixRegistryIdentifierObserved, rphShapeIdentifierObserved };
	};
	const schemaObservation = observe(schemaDeclarations);
	const validatorObservation = observe(validatorDeclarations);
	const enforces = schemaObservation.enforces || validatorObservation.enforces;
	const rphShapeIdentifierObserved =
		schemaObservation.rphShapeIdentifierObserved || validatorObservation.rphShapeIdentifierObserved;
	const uncertainties: string[] = [];
	if (schemaDeclarations.length > 1) uncertainties.push('RPH_ID_SCHEMA_DECLARATION_AMBIGUOUS');
	if (validatorDeclarations.length > 1)
		uncertainties.push('RPH_ID_VALIDATOR_DECLARATION_AMBIGUOUS');
	if (
		schemaDeclarations.length === 1 &&
		!schemaObservation.rphShapeIdentifierObserved &&
		!schemaObservation.prefixRegistryIdentifierObserved
	)
		uncertainties.push('RPH_ID_SCHEMA_SEMANTICS_UNRECOGNIZED');
	if (
		validatorDeclarations.length === 1 &&
		!validatorObservation.rphShapeIdentifierObserved &&
		!validatorObservation.prefixRegistryIdentifierObserved
	)
		uncertainties.push('RPH_ID_VALIDATOR_SEMANTICS_UNRECOGNIZED');
	if (
		(schemaObservation.prefixRegistryIdentifierObserved ||
			validatorObservation.prefixRegistryIdentifierObserved) &&
		!enforces
	)
		uncertainties.push('PREFIX_MEMBERSHIP_OPERATION_UNRECOGNIZED');
	return projected(
		corpus,
		[pattern],
		{
			registeredPrefixMembershipEnforced: enforces,
			rphIdValidatorDeclarations: declarations.length,
			shapeOnlyValidators: rphShapeIdentifierObserved && !enforces ? 1 : 0
		},
		{
			members: declarations.map(({ entry, node }) =>
				semanticMember(declarationName(node) ?? 'RphId', entry, node)
			),
			uncertainties
		}
	);
}

function projectFinding31(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-contracts\/src\/messages\.ts$/u;
	const source = production(corpus, pattern);
	let idBearingPayloadFields = 0;
	let bareStringIdPayloadFields = 0;
	let prefixedIdPayloadFields = 0;
	const members: string[] = [];
	const uncertainties: string[] = [];
	const declarations = namedDeclarationSites(corpus, source, /PayloadSchema$/u);
	const payloadDeclarations = declarations.filter(
		(site): site is { readonly entry: SourceEntry; readonly node: ts.VariableDeclaration } =>
			ts.isVariableDeclaration(site.node)
	);
	if (declarations.length !== payloadDeclarations.length)
		uncertainties.push('PAYLOAD_SCHEMA_DECLARATION_LAYOUT_UNSUPPORTED');
	if (payloadDeclarations.length === 0) uncertainties.push('PAYLOAD_SCHEMA_POPULATION_UNRESOLVED');
	if (
		new Set(payloadDeclarations.map(({ node }) => propertyName(node.name))).size !==
		payloadDeclarations.length
	)
		uncertainties.push('PAYLOAD_SCHEMA_DECLARATION_DUPLICATED');
	const suffix = '(?:\\.(?:optional|nullable|nullish)\\(\\))*';
	for (const { entry, node } of payloadDeclarations) {
		let initializer = node.initializer;
		while (
			initializer !== undefined &&
			(ts.isAsExpression(initializer) ||
				ts.isSatisfiesExpression(initializer) ||
				ts.isParenthesizedExpression(initializer))
		)
			initializer = initializer.expression;
		const isZodObjectCall = (candidate: ts.Node): candidate is ts.CallExpression =>
			ts.isCallExpression(candidate) &&
			ts.isPropertyAccessExpression(candidate.expression) &&
			ts.isIdentifier(candidate.expression.expression) &&
			candidate.expression.expression.text === 'z' &&
			(candidate.expression.name.text === 'strictObject' ||
				candidate.expression.name.text === 'object');
		if (initializer === undefined || !isZodObjectCall(initializer)) {
			uncertainties.push(
				`PAYLOAD_SCHEMA_ROOT_LAYOUT_UNSUPPORTED:${semanticMember(propertyName(node.name) ?? 'payload', entry, node)}`
			);
			continue;
		}
		let objectCalls = 0;
		const walk = (candidate: ts.Node): void => {
			corpus.consumeAstVisit();
			if (isZodObjectCall(candidate)) {
				objectCalls += 1;
				const object = unwrapObjectLiteral(candidate.arguments[0]);
				if (object === null) {
					uncertainties.push(
						`PAYLOAD_SCHEMA_OBJECT_LAYOUT_UNSUPPORTED:${semanticMember(propertyName(node.name) ?? 'payload', entry, candidate)}`
					);
				} else {
					if (object.properties.some(ts.isSpreadAssignment))
						uncertainties.push(
							`PAYLOAD_SCHEMA_SPREAD_UNSUPPORTED:${semanticMember(propertyName(node.name) ?? 'payload', entry, object)}`
						);
					const observedNames = new Set<string>();
					for (const property of object.properties) {
						if (ts.isSpreadAssignment(property)) continue;
						const name = propertyName(property.name);
						if (name === null) {
							uncertainties.push(
								`PAYLOAD_SCHEMA_COMPUTED_FIELD_UNSUPPORTED:${semanticMember('field', entry, property)}`
							);
							continue;
						}
						if (observedNames.has(name))
							uncertainties.push(
								`PAYLOAD_SCHEMA_FIELD_DUPLICATED:${semanticMember(name, entry, property)}`
							);
						observedNames.add(name);
						const idBearing = /(?:Id|Ids)$/u.test(name);
						if (!ts.isPropertyAssignment(property)) {
							if (idBearing) {
								idBearingPayloadFields += 1;
								members.push(semanticMember(name, entry, property));
							}
							uncertainties.push(
								`PAYLOAD_SCHEMA_FIELD_LAYOUT_UNSUPPORTED:${semanticMember(name, entry, property)}`
							);
							continue;
						}
						if (!idBearing) continue;
						idBearingPayloadFields += 1;
						members.push(semanticMember(name, entry, property));
						const text = nodeText(property.initializer, entry).replace(/\s+/gu, '');
						const bare =
							new RegExp(`^z\\.string\\(\\)${suffix}$`, 'u').test(text) ||
							new RegExp(`^z\\.array\\(z\\.string\\(\\)\\)${suffix}$`, 'u').test(text);
						const prefixed =
							new RegExp(`^RphIdSchema${suffix}$`, 'u').test(text) ||
							new RegExp(`^z\\.array\\(RphIdSchema\\)${suffix}$`, 'u').test(text);
						if (bare) bareStringIdPayloadFields += 1;
						else if (prefixed) prefixedIdPayloadFields += 1;
						else
							uncertainties.push(
								`ID_FIELD_SCHEMA_UNRECOGNIZED:${semanticMember(name, entry, property)}`
							);
					}
				}
			}
			ts.forEachChild(candidate, walk);
		};
		walk(initializer);
		if (objectCalls === 0)
			uncertainties.push(
				`PAYLOAD_SCHEMA_OBJECT_POPULATION_UNRESOLVED:${semanticMember(propertyName(node.name) ?? 'payload', entry, node)}`
			);
	}
	return projected(
		corpus,
		[pattern],
		{ bareStringIdPayloadFields, idBearingPayloadFields, prefixedIdPayloadFields },
		{ members, uncertainties }
	);
}

function governedPrefixes(text: string): {
	readonly complete: boolean;
	readonly values: readonly string[];
} {
	const start = text.indexOf('## 5.2 Prefix registry');
	if (start < 0) return { complete: false, values: [] };
	if (text.indexOf('## 5.2 Prefix registry', start + 1) >= 0)
		return { complete: false, values: [] };
	const end = text.indexOf('IDs are opaque and immutable.', start);
	if (end < 0) return { complete: false, values: [] };
	if (text.indexOf('IDs are opaque and immutable.', end + 1) >= 0)
		return { complete: false, values: [] };
	const lines = text.slice(start, end).split(/\r?\n/u);
	const header = lines.findIndex((line) => /^\|\s*Object\s*\|\s*Prefix\s*\|\s*$/u.test(line));
	if (header < 0 || !/^\|(?:\s*:?-+:?\s*\|){2}\s*$/u.test(lines[header + 1] ?? ''))
		return { complete: false, values: [] };
	if (
		lines.slice(header + 1).filter((line) => /^\|\s*Object\s*\|\s*Prefix\s*\|\s*$/u.test(line))
			.length > 0
	)
		return { complete: false, values: [] };
	const values = new Set<string>();
	let observedRows = 0;
	let rowEnd = lines.length;
	for (const [offset, line] of lines.slice(header + 2).entries()) {
		if (line.trim() === '') {
			rowEnd = header + 2 + offset;
			break;
		}
		if (!line.trimStart().startsWith('|')) return { complete: false, values: [] };
		const match = /^\|[^|]+\|\s*`([a-z]+)`\s*\|\s*$/u.exec(line);
		if (match?.[1] === undefined || values.has(match[1])) return { complete: false, values: [] };
		values.add(match[1]);
		observedRows += 1;
	}
	if (lines.slice(rowEnd + 1).some((line) => line.trimStart().startsWith('|')))
		return { complete: false, values: [] };
	return observedRows === 0
		? { complete: false, values: [] }
		: { complete: true, values: [...values].sort() };
}

function projectFinding32(corpus: Corpus): RuleProjectionSeed {
	const codePattern = /^packages\/rph-contracts\/src\/ids\.ts$/u;
	const registry = corpus.byPath.get(GOVERNED_PREFIX_REGISTRY_PATH);
	const code = objectStringValues(corpus, production(corpus, codePattern), 'ID_PREFIXES');
	const governed =
		registry === undefined ? { complete: false, values: [] } : governedPrefixes(registry.text);
	const uncertainties: string[] = [];
	if (!code.complete) uncertainties.push('CODE_PREFIX_REGISTRY_LAYOUT_UNSUPPORTED');
	if (!governed.complete) uncertainties.push('GOVERNED_PREFIX_REGISTRY_LAYOUT_UNSUPPORTED');
	return projected(
		corpus,
		[codePattern, new RegExp(`^${escapeRegExp(GOVERNED_PREFIX_REGISTRY_PATH)}$`, 'u')],
		{
			codePrefixSet: code.values,
			governedPrefixSet: governed.values,
			independentRegistrySources: Number(code.complete) + Number(governed.complete)
		},
		{
			members: [
				...code.members,
				...(governed.complete ? [`${GOVERNED_PREFIX_REGISTRY_PATH}#prefix-registry`] : [])
			],
			uncertainties
		}
	);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function projectFinding34(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/pwu\.ts$/u;
	const source = production(corpus, pattern);
	const functions = namedFunctionSites(corpus, source, 'markPwuReady');
	const readinessCalls = callsInFunctions(corpus, functions.sites, 'checkPwuShapeReadiness').length;
	return projected(
		corpus,
		[pattern],
		{
			intentStatusGuardCalls:
				readinessCalls > 0 &&
				countPropertyAccessesInFunctions(corpus, functions.sites, 'intentStatus') > 0
					? readinessCalls
					: 0,
			markPwuReadyTransitions: functions.sites.length,
			readinessGuardCalls: readinessCalls
		},
		{
			members: functions.sites.map(({ declaration, entry }) =>
				semanticMember('markPwuReady', entry, declaration)
			),
			uncertainties: functions.uncertainties
		}
	);
}

function projectFinding35(corpus: Corpus): RuleProjectionSeed {
	const applicationPattern = /^packages\/rph-application\/src\/handlers\/pwu\.ts$/u;
	const domainPattern = /^packages\/rph-domain\/src\/pwuGuards\.ts$/u;
	const app = production(corpus, applicationPattern);
	const domain = production(corpus, domainPattern);
	const functions = namedFunctionSites(corpus, app, 'markPwuReady');
	const guardCalls = callsInFunctions(corpus, functions.sites, 'checkPwuShapeReadiness').length;
	const guardDeclarations = countNamedDeclarations(corpus, domain, 'checkPwuShapeReadiness');
	const intentSetDeclarations = countNamedDeclarations(
		corpus,
		domain,
		'INTENT_AT_LEAST_PROVISIONAL'
	);
	const uncertainties = [...functions.uncertainties];
	if (guardCalls > 0 && guardDeclarations !== 1)
		uncertainties.push('READINESS_GUARD_SYMBOL_UNRESOLVED_OR_AMBIGUOUS');
	return projected(
		corpus,
		[applicationPattern, domainPattern],
		{
			rootReadinessIntentGuardCalls:
				guardCalls > 0 && guardDeclarations === 1 && intentSetDeclarations === 1 ? guardCalls : 0,
			rootReadinessTransitionSites: functions.sites.length
		},
		{
			members: functions.sites.map(({ declaration, entry }) =>
				semanticMember('markPwuReady', entry, declaration)
			),
			uncertainties
		}
	);
}

function projectFinding36(corpus: Corpus): RuleProjectionSeed {
	const executionPattern = /^packages\/rph-application\/src\/handlers\/execution\.ts$/u;
	const contractPattern = /^packages\/rph-contracts\/src\/.+\.ts$/u;
	const execution = production(corpus, executionPattern);
	const functions = namedFunctionSites(
		corpus,
		execution,
		/^(?:startExecutionStep|completeExecutionStep)$/u
	);
	return projected(
		corpus,
		[executionPattern, contractPattern],
		{
			authorizedBindingCompositeGateCalls: callsInFunctions(
				corpus,
				functions.sites,
				/^(?:bindingAuthorityRefusal|bindingAuthorityVerdict)$/u
			).length,
			executionCommandHandlers: functions.sites.length,
			runtimeBindingIdPayloadFields: countNamedDeclarations(
				corpus,
				production(corpus, contractPattern),
				'runtimeBindingId'
			),
			runtimeBindingIdProductionReads: countPropertyAccessesInFunctions(
				corpus,
				functions.sites,
				'runtimeBindingId'
			)
		},
		{
			members: functions.sites.map(({ declaration, entry }) =>
				semanticMember(declarationName(declaration) ?? 'execution-command', entry, declaration)
			),
			uncertainties: functions.uncertainties
		}
	);
}

function projectFinding39(corpus: Corpus): RuleProjectionSeed {
	const assurancePattern = /^packages\/rph-assurance\/src\/.+\.ts$/u;
	const applicationPattern = /^packages\/rph-application\/src\/.+\.ts$/u;
	const floorPattern = /^packages\/rph-assurance\/src\/floor\.ts$/u;
	return projected(corpus, [assurancePattern, applicationPattern], {
		admissibilityFunctionDeclarations: countNamedDeclarations(
			corpus,
			production(corpus, assurancePattern),
			'evidenceAdmissibility'
		),
		literalTrueEvidenceExistsAssignments: countObjectPropertyValue(
			corpus,
			production(corpus, floorPattern),
			'evidenceExists',
			/^true$/u
		),
		liveFloorResultSites:
			calls(corpus, production(corpus, floorPattern), 'evaluateFloor').length ||
			countNamedDeclarations(corpus, production(corpus, floorPattern), 'composeAssuranceOutcome'),
		productionAdmissibilityCalls: calls(
			corpus,
			production(corpus, applicationPattern),
			'evidenceAdmissibility'
		).length
	});
}

function projectFinding40(corpus: Corpus): RuleProjectionSeed {
	const floorPattern = /^packages\/rph-assurance\/src\/floor\.ts$/u;
	const source = production(corpus, floorPattern);
	const sites = namedDeclarationSites(corpus, source, 'composeAssuranceOutcome');
	const uncertainties: string[] = [];
	if (sites.length > 1) uncertainties.push('VALIDATOR_BOUNDARY_DECLARATION_AMBIGUOUS');
	let literalTrueValidatorSchemaChecks = 0;
	let validatorSchemaValidationCalls = 0;
	let validatorBoundarySites = 0;
	const site = sites[0];
	if (site !== undefined) {
		let root: ts.FunctionLikeDeclaration | undefined;
		if (ts.isFunctionDeclaration(site.node)) root = site.node;
		else if (
			ts.isVariableDeclaration(site.node) &&
			site.node.initializer !== undefined &&
			(ts.isArrowFunction(site.node.initializer) || ts.isFunctionExpression(site.node.initializer))
		)
			root = site.node.initializer;
		else uncertainties.push('VALIDATOR_BOUNDARY_LAYOUT_UNSUPPORTED');
		if (root !== undefined && root.body !== undefined) {
			const boundaryCalls: ts.CallExpression[] = [];
			const walk = (node: ts.Node): void => {
				corpus.consumeAstVisit();
				if (node !== root && ts.isFunctionLike(node)) return;
				if (ts.isCallExpression(node)) {
					if (callName(node.expression) === 'classifyValidatorResult') boundaryCalls.push(node);
					const name = callName(node.expression);
					if (name === 'parse' || name === 'safeParse') {
						let receiver: ts.Expression | undefined;
						if (ts.isPropertyAccessExpression(node.expression))
							receiver = node.expression.expression;
						else if (ts.isElementAccessExpression(node.expression))
							receiver = node.expression.expression;
						if (receiver !== undefined && nodeText(receiver, site.entry) === 'ValidatorResult')
							validatorSchemaValidationCalls += 1;
					}
				}
				ts.forEachChild(node, walk);
			};
			walk(root.body);
			validatorBoundarySites = boundaryCalls.length;
			if (boundaryCalls.length === 0)
				uncertainties.push('VALIDATOR_BOUNDARY_CALL_POPULATION_UNRESOLVED');
			if (boundaryCalls.length > 1)
				uncertainties.push('VALIDATOR_BOUNDARY_CALL_POPULATION_NOT_UNIQUE');
			for (const call of boundaryCalls) {
				const facts = unwrapObjectLiteral(call.arguments[0]);
				if (facts === null) {
					uncertainties.push('VALIDATOR_BOUNDARY_FACT_LAYOUT_UNSUPPORTED');
					continue;
				}
				if (facts.properties.some(ts.isSpreadAssignment))
					uncertainties.push('VALIDATOR_BOUNDARY_FACT_SPREAD_UNSUPPORTED');
				const schemaChecks = facts.properties.filter(
					(property): property is ts.PropertyAssignment =>
						ts.isPropertyAssignment(property) && propertyName(property.name) === 'schemaValid'
				);
				if (schemaChecks.length !== 1) {
					uncertainties.push('VALIDATOR_BOUNDARY_SCHEMA_FIELD_NOT_UNIQUE');
					continue;
				}
				let initializer = schemaChecks[0]!.initializer;
				while (
					ts.isAsExpression(initializer) ||
					ts.isSatisfiesExpression(initializer) ||
					ts.isParenthesizedExpression(initializer)
				)
					initializer = initializer.expression;
				if (initializer.kind === ts.SyntaxKind.TrueKeyword) literalTrueValidatorSchemaChecks += 1;
			}
		} else if (root !== undefined) uncertainties.push('VALIDATOR_BOUNDARY_BODY_MISSING');
	}
	return projected(
		corpus,
		[floorPattern],
		{
			literalTrueValidatorSchemaChecks,
			validatorBoundarySites,
			validatorSchemaValidationCalls
		},
		{
			members: sites.map(({ entry, node }) =>
				semanticMember('composeAssuranceOutcome', entry, node)
			),
			uncertainties
		}
	);
}

function projectFinding49(corpus: Corpus): RuleProjectionSeed {
	const busPattern = /^packages\/rph-application\/src\/command-bus\.ts$/u;
	const handlerPattern = /^packages\/rph-application\/src\/handlers\/.+\.ts$/u;
	const handlers = production(corpus, handlerPattern);
	const registrySources = entries(
		corpus,
		/^packages\/rph-application\/src\/handlers\/registry\.ts$/u
	);
	const registry = variableObject(corpus, registrySources, 'HANDLERS');
	const uncertainties = new Set<string>();
	const registeredHandlers: { commandName: string; handlerName: string; member: string }[] = [];
	if (registry === null || namedDeclarationSites(corpus, registrySources, 'HANDLERS').length !== 1)
		uncertainties.add('COMMAND_HANDLER_REGISTRY_LAYOUT_UNSUPPORTED');
	else {
		for (const property of registry.object.properties) {
			if (
				!ts.isPropertyAssignment(property) ||
				!ts.isIdentifier(property.initializer) ||
				propertyName(property.name) === null
			) {
				uncertainties.add('COMMAND_HANDLER_REGISTRY_ENTRY_LAYOUT_UNSUPPORTED');
				continue;
			}
			registeredHandlers.push({
				commandName: propertyName(property.name)!,
				handlerName: property.initializer.text,
				member: semanticMember(propertyName(property.name)!, registry.entry, property)
			});
		}
		if (
			new Set(registeredHandlers.map(({ commandName }) => commandName)).size !==
			registeredHandlers.length
		)
			uncertainties.add('COMMAND_HANDLER_REGISTRY_COMMAND_DUPLICATED');
	}
	let handlersWithoutAuthorityChecks = 0;
	for (const registered of registeredHandlers) {
		const declarations = namedDeclarationSites(corpus, handlers, registered.handlerName).filter(
			({ entry }) => !entry.path.endsWith('/registry.ts')
		);
		if (declarations.length !== 1) {
			uncertainties.add(`REGISTERED_HANDLER_DECLARATION_UNRESOLVED:${registered.commandName}`);
			continue;
		}
		let authorityCalls = 0;
		const declaration = declarations[0]!.node;
		const root = functionRoot(declaration);
		if (root === null) {
			uncertainties.add('REGISTERED_HANDLER_LAYOUT_UNSUPPORTED:' + registered.commandName);
			continue;
		}
		const walk = (node: ts.Node): void => {
			corpus.consumeAstVisit();
			if (node !== root && ts.isFunctionLike(node)) return;
			if (ts.isCallExpression(node)) {
				const name = callName(node.expression);
				if (name !== null && isAuthorityEnforcementCallName(name)) {
					if (callResultControlsBranch(node, root)) authorityCalls += 1;
					else
						uncertainties.add(
							'AUTHORITY_HANDLER_RESULT_NOT_CONTROL_BOUND:' + registered.commandName
						);
				} else if (name !== null && /(?:authoriz|authority)/iu.test(name))
					uncertainties.add(`AUTHORITY_LIKE_HANDLER_CALL_UNRESOLVED:${registered.commandName}`);
			}
			ts.forEachChild(node, walk);
		};
		walk(root);
		if (authorityCalls === 0) handlersWithoutAuthorityChecks += 1;
	}
	const bus = production(corpus, busPattern);
	const busFunctions = namedFunctionSites(
		corpus,
		bus,
		/^(?:dispatch|dispatchBatch|dispatchBatchGuarded)$/u
	);
	for (const uncertainty of busFunctions.uncertainties) uncertainties.add(uncertainty);
	let pipelineAuthorityStages = 0;
	for (const site of busFunctions.sites)
		visitFunction(corpus, site, (node) => {
			if (!ts.isCallExpression(node)) return;
			const name = callName(node.expression);
			if (name !== null && isAuthorityEnforcementCallName(name)) {
				if (callResultControlsBranch(node, site.root)) pipelineAuthorityStages += 1;
				else uncertainties.add('AUTHORITY_PIPELINE_RESULT_NOT_CONTROL_BOUND');
			} else if (name !== null && /(?:authoriz|authority)/iu.test(name))
				uncertainties.add('AUTHORITY_LIKE_PIPELINE_CALL_UNRESOLVED');
		});
	return projected(
		corpus,
		[busPattern, handlerPattern],
		{
			governedTransitionHandlers: registeredHandlers.length,
			handlersWithoutAuthorityChecks,
			pipelineAuthorityStages
		},
		{
			members: registeredHandlers.map(({ member }) => member),
			uncertainties: [...uncertainties].sort()
		}
	);
}

function projectFinding70(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/execution\.ts$/u;
	const source = production(corpus, pattern);
	return projected(corpus, [pattern], {
		activePlanGuardReads: countPropertyAccesses(corpus, source, 'activeExecutionPlanId'),
		activePlanProductionWriters: countObjectPropertyValue(
			corpus,
			source,
			'activeExecutionPlanId',
			/^(?!undefined|null).+/u
		)
	});
}

function projectFinding73(corpus: Corpus): RuleProjectionSeed {
	const pattern = /^packages\/rph-application\/src\/handlers\/governance\.ts$/u;
	const source = production(corpus, pattern);
	let aliased = 0;
	let independent = 0;
	let comparisons = 0;
	visit(corpus, source, (node, entry) => {
		if (!ts.isObjectLiteralExpression(node)) return;
		const properties = new Map<string, string>();
		for (const property of node.properties) {
			if (ts.isShorthandPropertyAssignment(property)) {
				const name = property.name.text;
				if (name === 'candidateItems' || name === 'reviewedItems') properties.set(name, name);
				continue;
			}
			if (ts.isPropertyAssignment(property)) {
				const name = propertyName(property.name);
				if (name === 'candidateItems' || name === 'reviewedItems')
					properties.set(name, nodeText(property.initializer, entry));
			}
		}
		if (!properties.has('candidateItems') || !properties.has('reviewedItems')) return;
		comparisons += 1;
		if (properties.get('candidateItems') === properties.get('reviewedItems')) aliased += 1;
		else independent += 1;
	});
	return projected(corpus, [pattern], {
		aliasedReviewedCandidateArgumentPairs: aliased,
		independentReviewedCandidateArgumentPairs: independent,
		versionDriftComparisonCalls: comparisons
	});
}

const mandatory = (id: string, pattern: RegExp, minimum = 1): MandatoryInput =>
	Object.freeze({ id, minimum, pattern });
const ast = Object.freeze(['AST'] as const);
const semanticSymbols = Object.freeze(['SYM'] as const);
const semanticSymbolsAndSchema = Object.freeze(['SYM', 'SCHEMA'] as const);
const semanticSymbolsAndCalls = Object.freeze(['SYM', 'CALL'] as const);
const semanticSymbolsAndDataFlow = Object.freeze(['SYM', 'DFG'] as const);
const astAndCalls = Object.freeze(['AST', 'CALL'] as const);
const astAndDataFlow = Object.freeze(['AST', 'DFG'] as const);
const astAndTests = Object.freeze(['AST', 'TEST'] as const);
const callsAndDataFlow = Object.freeze(['CALL', 'DFG'] as const);
const callsAndTests = Object.freeze(['CALL', 'TEST'] as const);
const callsAndTaint = Object.freeze(['CALL', 'TAINT'] as const);
const astSchema = Object.freeze(['AST', 'SCHEMA'] as const);
const schema = Object.freeze(['SCHEMA'] as const);
const schemaNorm = Object.freeze(['SCHEMA', 'NORM'] as const);
const detector = (
	project: NativeDetectorDefinition['project'],
	actualCapabilities: readonly HarmonizationCapabilityCode[],
	mandatoryInputs: readonly MandatoryInput[]
): NativeDetectorDefinition =>
	Object.freeze({
		actualCapabilities: Object.freeze([...actualCapabilities]),
		mandatoryInputs: Object.freeze([...mandatoryInputs]),
		project
	});

const DETECTORS: Readonly<Record<number, NativeDetectorDefinition>> = Object.freeze({
	1: detector(projectFinding1, callsAndDataFlow, [
		mandatory('execution-handler', /^packages\/rph-application\/src\/handlers\/execution\.ts$/u)
	]),
	3: detector(projectFinding3, semanticSymbols, [
		mandatory('command-contracts', /^packages\/rph-contracts\/src\/messages\.ts$/u),
		mandatory('application-sources', /^packages\/rph-application\/src\/.+\.ts$/u)
	]),
	5: detector(projectFinding5, semanticSymbolsAndCalls, [
		mandatory('event-registry', /^packages\/rph-contracts\/src\/messages\.ts$/u),
		mandatory('event-emitters', /^packages\/rph-application\/src\/handlers\/.+\.ts$/u)
	]),
	6: detector(projectFinding6, callsAndTests, [
		mandatory('floor', /^packages\/rph-assurance\/src\/floor\.ts$/u),
		mandatory('domain', /^packages\/rph-domain\/src\/.+\.ts$/u),
		mandatory('application', /^packages\/rph-application\/src\/.+\.ts$/u)
	]),
	8: detector(projectFinding8, semanticSymbolsAndSchema, [
		mandatory('ports', /^packages\/rph-ports\/src\/.+\.ts$/u),
		mandatory(
			'governed-implementation-guide',
			new RegExp(`^${escapeRegExp(GOVERNED_IMPLEMENTATION_GUIDE_PATH)}$`, 'u')
		)
	]),
	11: detector(projectFinding11, astSchema, [
		mandatory('object-schemas', /^packages\/rph-contracts\/src\/objects\.ts$/u),
		mandatory('object-envelope', /^packages\/rph-contracts\/src\/envelopes\.ts$/u)
	]),
	12: detector(projectFinding12, ast, [
		mandatory('identity-validator-adapter', /^packages\/rph-assurance\/src\/validators\.ts$/u)
	]),
	17: detector(projectFinding17, astAndCalls, [
		mandatory(
			'pwa-authoring-handler',
			/^packages\/rph-application\/src\/handlers\/pwa-authoring\.ts$/u
		)
	]),
	18: detector(projectFinding18, semanticSymbols, [
		mandatory(
			'pwa-authoring-handler',
			/^packages\/rph-application\/src\/handlers\/pwa-authoring\.ts$/u
		)
	]),
	22: detector(projectFinding22, astAndTests, [
		mandatory('conformance-test', /^packages\/rph-domain\/src\/conformance\.test\.ts$/u),
		mandatory('conformance-manifest', /^packages\/rph-domain\/src\/conformance-manifest\.ts$/u),
		mandatory(
			'governed-implementation-guide',
			new RegExp(`^${escapeRegExp(GOVERNED_IMPLEMENTATION_GUIDE_PATH)}$`, 'u')
		)
	]),
	23: detector(projectFinding23, callsAndTests, [
		mandatory('conformance-test', /^packages\/rph-domain\/src\/conformance\.test\.ts$/u),
		mandatory('mutation-catalog', /^packages\/rph-domain\/vocab\/m12-conformance\.json$/u)
	]),
	28: detector(projectFinding28, semanticSymbolsAndDataFlow, [
		mandatory('assurance-handler', /^packages\/rph-application\/src\/handlers\/assurance\.ts$/u)
	]),
	30: detector(projectFinding30, schema, [
		mandatory('identifier-schema', /^packages\/rph-contracts\/src\/ids\.ts$/u)
	]),
	31: detector(projectFinding31, astSchema, [
		mandatory('message-schemas', /^packages\/rph-contracts\/src\/messages\.ts$/u)
	]),
	32: detector(projectFinding32, schemaNorm, [
		mandatory('identifier-prefix-code-registry', /^packages\/rph-contracts\/src\/ids\.ts$/u),
		mandatory(
			'governed-prefix-registry',
			new RegExp(`^${escapeRegExp(GOVERNED_PREFIX_REGISTRY_PATH)}$`, 'u')
		)
	]),
	34: detector(projectFinding34, astAndCalls, [
		mandatory('pwu-handler', /^packages\/rph-application\/src\/handlers\/pwu\.ts$/u)
	]),
	35: detector(projectFinding35, semanticSymbolsAndCalls, [
		mandatory('pwu-handler', /^packages\/rph-application\/src\/handlers\/pwu\.ts$/u),
		mandatory('pwu-guards', /^packages\/rph-domain\/src\/pwuGuards\.ts$/u)
	]),
	36: detector(projectFinding36, callsAndDataFlow, [
		mandatory('execution-handler', /^packages\/rph-application\/src\/handlers\/execution\.ts$/u),
		mandatory('message-contracts', /^packages\/rph-contracts\/src\/messages\.ts$/u)
	]),
	39: detector(projectFinding39, astAndCalls, [
		mandatory('floor', /^packages\/rph-assurance\/src\/floor\.ts$/u),
		mandatory('assurance-rules', /^packages\/rph-assurance\/src\/assurance-rules\.ts$/u),
		mandatory('application', /^packages\/rph-application\/src\/.+\.ts$/u)
	]),
	40: detector(projectFinding40, ast, [
		mandatory('floor', /^packages\/rph-assurance\/src\/floor\.ts$/u)
	]),
	49: detector(projectFinding49, callsAndTaint, [
		mandatory('command-bus', /^packages\/rph-application\/src\/command-bus\.ts$/u),
		mandatory('handler-registry', /^packages\/rph-application\/src\/handlers\/registry\.ts$/u),
		mandatory(
			'handler-implementations',
			/^packages\/rph-application\/src\/handlers\/(?!registry\.ts$|kit\.ts$).+\.ts$/u
		)
	]),
	70: detector(projectFinding70, Object.freeze(['AST', 'SYM'] as const), [
		mandatory('execution-handler', /^packages\/rph-application\/src\/handlers\/execution\.ts$/u)
	]),
	73: detector(projectFinding73, astAndDataFlow, [
		mandatory('governance-handler', /^packages\/rph-application\/src\/handlers\/governance\.ts$/u)
	])
});

const exactFile = (path: string): EligiblePhysicalScope => Object.freeze({ kind: 'FILE', path });
const exactTree = (path: string): EligiblePhysicalScope => Object.freeze({ kind: 'TREE', path });

const CONCLUSIVE_ELIGIBLE_PHYSICAL_POPULATIONS: Readonly<
	Record<number, readonly EligiblePhysicalScope[]>
> = Object.freeze({
	1: Object.freeze([exactFile('packages/rph-application/src/handlers/execution.ts')]),
	3: Object.freeze([
		exactTree('packages/rph-application/src'),
		exactTree('packages/rph-contracts/src')
	]),
	5: Object.freeze([
		exactTree('packages/rph-application/src'),
		exactTree('packages/rph-contracts/src')
	]),
	6: Object.freeze([
		exactTree('packages/rph-application/src'),
		exactTree('packages/rph-domain/src'),
		exactFile('packages/rph-assurance/src/floor.ts')
	]),
	8: Object.freeze([
		exactFile(GOVERNED_IMPLEMENTATION_GUIDE_PATH),
		exactTree('packages/rph-ports/src')
	]),
	11: Object.freeze([
		exactFile('packages/rph-contracts/src/objects.ts'),
		exactFile('packages/rph-contracts/src/envelopes.ts')
	]),
	12: Object.freeze([exactTree('apps/rph-demo/src'), exactTree('packages/rph-assurance/src')]),
	17: Object.freeze([exactFile('packages/rph-application/src/handlers/pwa-authoring.ts')]),
	18: Object.freeze([exactFile('packages/rph-application/src/handlers/pwa-authoring.ts')]),
	22: Object.freeze([
		exactFile(GOVERNED_IMPLEMENTATION_GUIDE_PATH),
		exactFile('packages/rph-domain/src/conformance-manifest.ts'),
		exactFile('packages/rph-domain/src/conformance.test.ts')
	]),
	23: Object.freeze([
		exactTree('packages/rph-domain/src'),
		exactFile('packages/rph-domain/vocab/m12-conformance.json')
	]),
	28: Object.freeze([exactFile('packages/rph-application/src/handlers/assurance.ts')]),
	30: Object.freeze([exactFile('packages/rph-contracts/src/ids.ts')]),
	31: Object.freeze([exactFile('packages/rph-contracts/src/messages.ts')]),
	32: Object.freeze([
		exactFile('packages/rph-contracts/src/ids.ts'),
		exactFile(GOVERNED_PREFIX_REGISTRY_PATH)
	]),
	34: Object.freeze([exactFile('packages/rph-application/src/handlers/pwu.ts')]),
	35: Object.freeze([
		exactFile('packages/rph-application/src/handlers/pwu.ts'),
		exactFile('packages/rph-domain/src/pwuGuards.ts')
	]),
	36: Object.freeze([
		exactFile('packages/rph-application/src/handlers/execution.ts'),
		exactTree('packages/rph-contracts/src')
	]),
	39: Object.freeze([
		exactTree('packages/rph-application/src'),
		exactTree('packages/rph-assurance/src')
	]),
	40: Object.freeze([exactFile('packages/rph-assurance/src/floor.ts')]),
	49: Object.freeze([
		exactFile('packages/rph-application/src/command-bus.ts'),
		exactTree('packages/rph-application/src/handlers')
	]),
	70: Object.freeze([exactFile('packages/rph-application/src/handlers/execution.ts')]),
	73: Object.freeze([exactFile('packages/rph-application/src/handlers/governance.ts')])
});

const NATIVE_PROJECTION_SURFACE_BY_CAPABILITY: Readonly<
	Partial<Record<HarmonizationCapabilityCode, HarmonizationRuleProjectionSurface>>
> = Object.freeze({
	AST: 'SEMANTIC_AST',
	CALL: 'CALL_GRAPH',
	DFG: 'READ_WRITE_ACCESS_GRAPH',
	NORM: 'NORMATIVE_REGISTRY',
	SCHEMA: 'SCHEMA_PROJECTION',
	SYM: 'SEMANTIC_SYMBOLS',
	TAINT: 'TAINT_PROJECTION',
	TEST: 'TEST_CENSUS',
	TRACE: 'CALL_GRAPH'
});

function nativeProjectionSurfaces(
	capabilities: readonly HarmonizationCapabilityCode[]
): readonly HarmonizationRuleProjectionSurface[] {
	return [
		...new Set(
			capabilities
				.map((capability) => NATIVE_PROJECTION_SURFACE_BY_CAPABILITY[capability])
				.filter((surface): surface is HarmonizationRuleProjectionSurface => surface !== undefined)
		)
	].sort();
}

function detectorCanSatisfyProfile(
	profile: HarmonizationFirstIncrementRuleProfile,
	definition: NativeDetectorDefinition
): boolean {
	const surfaces = nativeProjectionSurfaces(definition.actualCapabilities);
	return (
		profile.requiredCapabilities.every((capability) =>
			definition.actualCapabilities.includes(capability)
		) && profile.requiredProjectionSurfaces.every((surface) => surfaces.includes(surface))
	);
}

function physicalPopulationBasis(
	subject: AdmittedSubject,
	findingId: number
): JpwbHarmonizationNativeRuleProjection['support']['physicalPopulationBasis'] {
	if (subject.exactWholePhysicalPopulation) return 'EXACT_WHOLE_SUBJECT';
	const scopes = CONCLUSIVE_ELIGIBLE_PHYSICAL_POPULATIONS[findingId];
	if (scopes === undefined || scopes.length === 0) return 'OPEN';
	const intersects = subject.excludedArtifacts.some((excluded) => {
		if (excluded.physicalFileCount === 0) return false;
		return scopes.some((scope) => {
			if (scope.kind === 'FILE')
				return scope.path === excluded.path || scope.path.startsWith(`${excluded.path}/`);
			return (
				scope.path === excluded.path ||
				scope.path.startsWith(`${excluded.path}/`) ||
				excluded.path.startsWith(`${scope.path}/`)
			);
		});
	});
	return intersects ? 'OPEN' : 'EXACT_RULE_ELIGIBLE_PATH_POPULATION';
}

/** Test seam for detector discrimination; production callers use the FrozenSubject-bound operation below. */
export function projectJpwbHarmonizationRuleFactsFromCapturedSources(
	findingId: number,
	sources: Readonly<Record<string, string>>
): RuleProjectionSeed {
	const detector = DETECTORS[findingId];
	if (detector === undefined) throw new TypeError('Unknown first-increment finding id.');
	const corpusEntries = Object.entries(sources)
		.map(([path, text]): SourceEntry => ({
			artifactSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
			path,
			text
		}))
		.sort((left, right) => left.path.localeCompare(right.path, 'en'));
	const parsedSources = new Map(
		corpusEntries.map(
			(entry) =>
				[
					entry.path,
					entry.path.endsWith('.json') || GOVERNED_TEXT_PATHS.has(entry.path)
						? null
						: ts.createSourceFile(
								entry.path,
								entry.text,
								ts.ScriptTarget.Latest,
								true,
								scriptKind(entry.path)
							)
				] as const
		)
	);
	const corpus: Corpus = {
		byPath: new Map(corpusEntries.map((entry) => [entry.path, entry])),
		checkpoint: () => undefined,
		consumeAstVisit: () => undefined,
		entries: corpusEntries,
		parseSource: (entry) => parsedSources.get(entry.path) ?? null,
		sourceWitness: canonicalSemanticJsonWitness(
			corpusEntries.map(({ artifactSha256, path }) => ({ path, sha256: artifactSha256 }))
		)
	};
	return detector.project(corpus);
}

function createEvaluation(
	request: AdmittedRequest,
	corpus: Corpus,
	profile: HarmonizationFirstIncrementRuleProfile,
	definition: NativeDetectorDefinition,
	seed: RuleProjectionSeed | null
): JpwbHarmonizationNativeRuleProjection {
	const runnable = request.executionDisposition === 'RUN';
	const current = request.freshness.state === 'CURRENT';
	const missingMandatoryInputIds = definition.mandatoryInputs
		.filter(
			(input) =>
				corpus.entries.filter((entry) => input.pattern.test(entry.path)).length < input.minimum
		)
		.map(({ id }) => id);
	const uncertainties = seed?.uncertainties ?? [];
	const extractionComplete =
		seed !== null && missingMandatoryInputIds.length === 0 && uncertainties.length === 0;
	const executedCapabilities =
		runnable && seed !== null
			? definition.actualCapabilities
			: ([] as readonly HarmonizationCapabilityCode[]);
	const availableCapabilities = extractionComplete
		? executedCapabilities
		: ([] as readonly HarmonizationCapabilityCode[]);
	const executedSurfaces = nativeProjectionSurfaces(executedCapabilities);
	const availableSurfaces = nativeProjectionSurfaces(availableCapabilities);
	const requiredCapabilitiesPresent = profile.requiredCapabilities.every((capability) =>
		availableCapabilities.includes(capability)
	);
	const requiredSurfacesPresent = profile.requiredProjectionSurfaces.every((surface) =>
		availableSurfaces.includes(surface)
	);
	const populationBasis = physicalPopulationBasis(request.subject, profile.findingId);
	const exactPhysicalPopulation = populationBasis !== 'OPEN';
	const closedPopulation =
		extractionComplete &&
		exactPhysicalPopulation &&
		requiredCapabilitiesPresent &&
		requiredSurfacesPresent;
	const conclusive = closedPopulation;
	const projectionState = !runnable
		? 'NOT_RUN'
		: !current
			? request.freshness.state === 'STALE'
				? 'STALE'
				: 'UNAVAILABLE'
			: conclusive
				? 'CURRENT_CLOSED'
				: 'UNAVAILABLE';
	let facts: readonly HarmonizationRuleObservationFact[] = [];
	if (seed !== null) {
		const expectedFactKeys = profile.factSpecs.map(({ key }) => key).sort();
		const actualFactKeys = Object.keys(seed.facts).sort();
		if (
			expectedFactKeys.length !== actualFactKeys.length ||
			!expectedFactKeys.every((key, index) => key === actualFactKeys[index])
		)
			fail(
				'DETECTOR_FACT_SET_INCOMPLETE',
				'failed',
				`Detector ${profile.ruleId} did not produce its exact declared fact set.`
			);
		facts = profile.factSpecs.map((spec) => ({ key: spec.key, value: seed.facts[spec.key]! }));
	}
	const rawMembers = seed?.members ?? [];
	if (rawMembers.length > HARMONIZATION_FIRST_INCREMENT_MAX_POPULATION_MEMBERS)
		fail(
			'POPULATION_MEMBER_BUDGET_EXCEEDED',
			'resource-refused',
			`Detector ${profile.ruleId} analyzed ${rawMembers.length} exact population members; the evaluator ceiling is ${HARMONIZATION_FIRST_INCREMENT_MAX_POPULATION_MEMBERS}.`
		);
	const members = Object.freeze([...rawMembers].sort());
	const populationWitness = canonicalSemanticJsonWitness({
		findingId: profile.findingId,
		members,
		sourceSha256: corpus.sourceWitness.sha256,
		subjectId: request.subject.subjectId
	});
	const population = {
		closure: closedPopulation ? ('CLOSED' as const) : ('OPEN' as const),
		count: members.length,
		members,
		populationId: `jpwb-harmonization-population:${profile.findingId}:${populationWitness.sha256}`,
		sha256: populationWitness.sha256
	};
	const provenance: readonly HarmonizationRuleProjectionProvenance[] = extractionComplete
		? availableSurfaces.map((surface) => {
				const sourceReferenceWitness = canonicalSemanticJsonWitness(seed.sourceReferences);
				const witness = canonicalSemanticJsonWitness({
					facts,
					populationSha256: population.sha256,
					provider: JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVIDER,
					surface
				});
				return {
					provenanceId: `jpwb-harmonization:${profile.findingId}:${surface}:${witness.sha256}`,
					sha256: witness.sha256,
					sourceReference: `jpwb-source-census:${seed.sourceReferences.length}:${sourceReferenceWitness.sha256}`,
					surface,
					version: JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVIDER.version
				};
			})
		: [];
	const evaluation = evaluateHarmonizationFirstIncrementRule({
		availableCapabilities,
		currentness: {
			frozenSubjectId: request.subject.subjectId,
			invalidationDependencyIds: [
				request.subject.configurationDigest,
				request.subject.fileManifestDigest,
				corpus.sourceWitness.sha256
			],
			sourceSha256: corpus.sourceWitness.sha256,
			state: current ? 'CALLER_DECLARED_CURRENT' : 'CALLER_DECLARED_STALE'
		},
		evaluationId: `${request.executionId}:${profile.ruleId}`,
		executionDisposition: runnable ? 'RUN' : 'NOT_RUN',
		facts,
		operationVersion: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
		population,
		provenance,
		ruleId: profile.ruleId,
		schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION
	});
	return Object.freeze({
		availableCapabilities,
		evaluation,
		factProjection: facts,
		findingId: profile.findingId,
		population,
		provenance,
		projectionState,
		ruleId: profile.ruleId,
		support: {
			actualCapabilities: executedCapabilities,
			actualProjectionSurfaces: executedSurfaces,
			exactPhysicalPopulation,
			mandatoryInputIds: definition.mandatoryInputs.map(({ id }) => id),
			missingMandatoryInputIds,
			physicalPopulationBasis: populationBasis,
			uncertainties
		}
	});
}

function currentRepositoryStatusTotals(
	projections: readonly JpwbHarmonizationNativeRuleProjection[]
): Readonly<Record<HarmonizationFirstIncrementEvaluationStatus, number>> {
	const totals: Record<HarmonizationFirstIncrementEvaluationStatus, number> = {
		DETECTED: 0,
		NOT_APPLICABLE: 0,
		NOT_DETECTED: 0,
		NOT_RUN: 0,
		UNSUPPORTED: 0
	};
	for (const projection of projections) {
		if (projection.evaluation.outcome !== 'evaluated') {
			const diagnostic = projection.evaluation.diagnostics[0];
			fail(
				'RULE_EVALUATION_FAILED',
				'failed',
				`Native projection rule ${projection.ruleId} failed during evaluation${diagnostic === undefined ? '.' : `: ${diagnostic.code}: ${diagnostic.message}`}`
			);
		}
		totals[projection.evaluation.result.status] += 1;
	}
	return Object.freeze(totals);
}

export function runJpwbHarmonizationNativeProjection(
	value: unknown
): JpwbHarmonizationNativeProjectionOutcome {
	const started = performance.now();
	try {
		const request = admitRequest(value);
		const assertWithinBudget = (): void => {
			if (performance.now() - started > request.budgets.maxDurationMs)
				fail(
					'DURATION_BUDGET_EXCEEDED',
					'resource-refused',
					'Native projection exceeded duration budget.'
				);
		};
		const corpus = buildCorpus(request, assertWithinBudget, request.executionDisposition === 'RUN');
		const projections = HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES.map((profile) => {
			assertWithinBudget();
			const detector = DETECTORS[profile.findingId];
			if (detector === undefined)
				fail(
					'DETECTOR_REGISTRATION_MISSING',
					'failed',
					`No detector is registered for ${profile.ruleId}.`
				);
			return createEvaluation(
				request,
				corpus,
				profile,
				detector,
				request.executionDisposition === 'RUN' && detectorCanSatisfyProfile(profile, detector)
					? detector.project(corpus)
					: null
			);
		});
		const resultWithoutWitness = {
			analysisAuthority: 'NONE' as const,
			authorityTransfer: 'NONE' as const,
			capability: {
				detectorExecution:
					request.executionDisposition === 'RUN'
						? ('PERFORMED_OVER_EXACT_FROZEN_SUBJECT_BYTES' as const)
						: ('NOT_RUN' as const),
				gateEffect: 'NONE' as const,
				nativeProjection: 'IMPLEMENTATION_LOCAL_UNREGISTERED_PROVIDER' as const,
				provider: JPWB_HARMONIZATION_NATIVE_PROJECTION_PROVIDER
			},
			currentness: {
				basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED' as const,
				changedPaths: [...request.freshness.changedPaths].sort(),
				frozenSubjectId: request.subject.subjectId,
				sourceSha256: corpus.sourceWitness.sha256,
				state: request.freshness.state
			},
			currentRepositoryStatusTotals: currentRepositoryStatusTotals(projections),
			executionId: request.executionId,
			facadeNonclaims: JPWB_HARMONIZATION_NATIVE_PROJECTION_NONCLAIMS,
			projections,
			schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_RESULT_SCHEMA_VERSION
		};
		assertWithinBudget();
		const resultWitness = canonicalSemanticJsonWitness(resultWithoutWitness);
		assertWithinBudget();
		const result = Object.freeze({ ...resultWithoutWitness, resultWitness });
		const outcome = Object.freeze({
			diagnostics: [] as const,
			outcome: 'projected' as const,
			result,
			schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION,
			state: 'projected' as const
		});
		const publicOutcomeWitness = canonicalSemanticJsonWitness(outcome);
		assertWithinBudget();
		if (publicOutcomeWitness.bytes > request.budgets.maxResultBytes)
			fail(
				'RESULT_BUDGET_EXCEEDED',
				'resource-refused',
				'Native projection public outcome exceeds budget.'
			);
		return outcome;
	} catch (error) {
		const refusal =
			error instanceof NativeProjectionRefusal
				? error
				: new NativeProjectionRefusal(
						'INTERNAL_PROJECTION_FAILED',
						'failed',
						'Native projection failed without a supported diagnostic.'
					);
		return Object.freeze({
			diagnostics: [{ code: refusal.code, message: refusal.message }] as const,
			outcome: 'unavailable',
			result: null,
			schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION,
			state: refusal.state
		});
	}
}
