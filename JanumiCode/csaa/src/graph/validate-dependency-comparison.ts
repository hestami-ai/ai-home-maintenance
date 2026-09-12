import type {
	CompareDependencyProvidersRequest,
	DependencyProviderComparisonAssessment,
	DependencyProviderComparisonDiagnostic,
	DependencyProviderComparisonLimitationKind,
	DependencyProviderComparisonSnapshot
} from '../contracts/dependency-comparison.js';
import type { DependencyCruiserObservation } from '../contracts/dependency-cruiser.js';
import type { ModuleDependencyGraphSnapshot } from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { compareDependencyProviders } from './compare-dependency-providers.js';

export type DependencyProviderComparisonValidationIssueCode =
	| 'CONTENT_MISMATCH'
	| 'DUPLICATE_ID'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_INPUTS'
	| 'INVALID_SHAPE'
	| 'NONCANONICAL_ORDER'
	| 'POPULATION_BUDGET_EXCEEDED'
	| 'POPULATION_MISMATCH'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface DependencyProviderComparisonValidationIssue {
	readonly code: DependencyProviderComparisonValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface DependencyProviderComparisonValidationOptions {
	readonly maxIssues?: number;
}

export type DependencyProviderComparisonValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly DependencyProviderComparisonValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

type JsonRecord = Record<string, unknown>;

const SHA256 = /^[a-f0-9]{64}$/u;
const ROOT_FIELDS = [
	'canonicalProfile',
	'comparisonContextDigest',
	'contentDigest',
	'coverage',
	'dependencyCruiserObservationId',
	'fullJanCsaa007Conformance',
	'graphId',
	'health',
	'id',
	'limitations',
	'method',
	'negativeCoverage',
	'operationVersion',
	'records',
	'resolutionContext',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const RECORD_FIELDS = [
	'assessment',
	'compiler',
	'dependencyCruiser',
	'disposition',
	'id',
	'key',
	'rationale'
] as const;
const COMPILER_EVIDENCE_FIELDS = [
	'edgeIds',
	'occurrenceCount',
	'relationKinds',
	'resolutionStates',
	'targetLogicalPaths',
	'targetNodeIds'
] as const;
const PROVIDER_EVIDENCE_FIELDS = [
	'dependencyIds',
	'dependencyTypes',
	'rowCount',
	'targetKinds',
	'targetLogicalPaths'
] as const;
const KEY_FIELDS = [
	'importerBinding',
	'importerSemanticSourceId',
	'moduleSystem',
	'normalizedSpecifier',
	'sourcePath',
	'typeOnlyPartition'
] as const;
const COVERAGE_FIELDS = [
	'agreementRecords',
	'compilerEdgesRepresented',
	'compilerEdgesTotal',
	'corroborationRecords',
	'dependencyCruiserDependenciesRepresented',
	'dependencyCruiserDependenciesTotal',
	'incomparableRecords',
	'observedDifferenceRecords',
	'reconciles',
	'recordCount'
] as const;
const LIMITATION_FIELDS = ['affectedRecordCount', 'kind', 'rationale'] as const;
const ASSESSMENTS = new Set<DependencyProviderComparisonAssessment>([
	'AGREEMENT',
	'CORROBORATION',
	'INCOMPARABLE',
	'OBSERVED_DIFFERENCE'
]);

class ValidationIssues {
	readonly issues: DependencyProviderComparisonValidationIssue[] = [];
	exhausted = false;

	constructor(readonly maxIssues: number) {}

	add(code: DependencyProviderComparisonValidationIssueCode, path: string, message: string): void {
		if (this.exhausted) return;
		if (this.issues.length >= this.maxIssues) {
			this.exhausted = true;
			return;
		}
		this.issues.push({ code, message, path });
	}

	result(): DependencyProviderComparisonValidationResult {
		if (this.issues.length === 0 && !this.exhausted) return { issues: [], state: 'VALID' };
		return {
			issues: this.issues,
			state: this.exhausted ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
}

interface RecordView {
	readonly assessment: DependencyProviderComparisonAssessment | null;
	readonly compilerEdgeIds: readonly string[];
	readonly dependencyIds: readonly string[];
	readonly disposition: string | null;
	readonly keyText: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
	const actual = Object.keys(value).sort(compareText);
	const wanted = [...expected].sort(compareText);
	if (actual.length !== wanted.length) return false;
	return actual.every((key, index) => key === wanted[index]);
}

function safeNonnegativeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function invalidResult(
	code: DependencyProviderComparisonValidationIssueCode,
	path: string,
	message: string
): DependencyProviderComparisonValidationResult {
	return { issues: [{ code, message, path }], state: 'INVALID' };
}

function canonicalStrings(
	value: unknown,
	path: string,
	issues: ValidationIssues,
	maximumLength: number,
	duplicateCode: DependencyProviderComparisonValidationIssueCode = 'POPULATION_MISMATCH'
): readonly string[] | null {
	if (!Array.isArray(value)) {
		issues.add('INVALID_SHAPE', path, 'Expected a string array.');
		return null;
	}
	if (value.length > maximumLength) {
		issues.add(
			'POPULATION_MISMATCH',
			path,
			'Array population exceeds the maximum derivable from the bound provider inputs.'
		);
		return null;
	}
	if (!value.every((entry) => typeof entry === 'string')) {
		issues.add('INVALID_SHAPE', path, 'Expected every array member to be a string.');
		return null;
	}
	const strings = value as string[];
	for (let index = 1; index < strings.length; index += 1) {
		const order = compareText(strings[index - 1]!, strings[index]!);
		if (order === 0) issues.add(duplicateCode, path, 'Array values must be unique.');
		else if (order > 0)
			issues.add('NONCANONICAL_ORDER', path, 'Array values are not canonically ordered.');
	}
	return strings;
}

function inputIds(
	population: unknown,
	path: string,
	issues: ValidationIssues
): readonly string[] | null {
	if (!Array.isArray(population)) {
		issues.add('INVALID_INPUTS', path, 'Bound input population must be an array.');
		return null;
	}
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const [index, entry] of population.entries()) {
		if (!isRecord(entry) || typeof entry.id !== 'string') {
			issues.add('INVALID_INPUTS', `${path}[${index}].id`, 'Bound input identity is invalid.');
			continue;
		}
		if (seen.has(entry.id))
			issues.add(
				'INVALID_INPUTS',
				`${path}[${index}].id`,
				'Bound input identities are not unique.'
			);
		seen.add(entry.id);
		ids.push(entry.id);
	}
	return ids;
}

function partitionReconciles(
	actualIds: readonly string[],
	expectedIds: readonly string[],
	path: string,
	populationName: string,
	issues: ValidationIssues
): boolean {
	const expected = new Set(expectedIds);
	const counts = new Map<string, number>();
	let reconciles = expected.size === expectedIds.length;
	for (const id of actualIds) {
		if (!expected.has(id)) reconciles = false;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	for (const id of expected) if (counts.get(id) !== 1) reconciles = false;
	if (counts.size !== expected.size) reconciles = false;
	if (!reconciles)
		issues.add(
			'POPULATION_MISMATCH',
			path,
			`${populationName} evidence must partition the complete bound population exactly once.`
		);
	return reconciles;
}

function expectedRecordId(contextDigest: string, key: JsonRecord): string {
	return `dependency-comparison-record:${sha256(canonicalSemanticJson({ contextDigest, key }))}`;
}

interface RecordPopulationContext {
	readonly contextDigest: string;
	readonly graphEdgeMaximum: number;
	readonly maxRationaleCharacters: number;
	readonly providerDependencyMaximum: number;
	readonly providerDependencyTypeMaximum: number;
}

interface RecordDescriptors {
	readonly assessment: DependencyProviderComparisonAssessment | null;
	readonly disposition: string | null;
}

function subRecord(value: unknown): JsonRecord | null {
	return isRecord(value) ? value : null;
}

function reportRecordSectionShapes(
	path: string,
	compiler: JsonRecord | null,
	provider: JsonRecord | null,
	key: JsonRecord | null,
	issues: ValidationIssues
): void {
	if (compiler === null || !hasExactKeys(compiler, COMPILER_EVIDENCE_FIELDS))
		issues.add('INVALID_SHAPE', `${path}.compiler`, 'Compiler evidence fields are invalid.');
	if (provider === null || !hasExactKeys(provider, PROVIDER_EVIDENCE_FIELDS))
		issues.add(
			'INVALID_SHAPE',
			`${path}.dependencyCruiser`,
			'Dependency-cruiser evidence fields are invalid.'
		);
	if (key === null || !hasExactKeys(key, KEY_FIELDS))
		issues.add('INVALID_SHAPE', `${path}.key`, 'Comparison key fields are invalid.');
}

function canonicalEvidenceIds(
	evidence: JsonRecord | null,
	member: string,
	path: string,
	maximum: number,
	issues: ValidationIssues
): readonly string[] | null {
	if (evidence === null) return null;
	return canonicalStrings(evidence[member], path, issues, maximum, 'DUPLICATE_ID');
}

function validateCompilerEvidence(
	compiler: JsonRecord,
	path: string,
	edgeIds: readonly string[] | null,
	context: RecordPopulationContext,
	issues: ValidationIssues
): void {
	const memberMaximum = edgeIds?.length ?? context.graphEdgeMaximum;
	canonicalStrings(compiler.relationKinds, `${path}.compiler.relationKinds`, issues, memberMaximum);
	canonicalStrings(
		compiler.resolutionStates,
		`${path}.compiler.resolutionStates`,
		issues,
		memberMaximum
	);
	canonicalStrings(
		compiler.targetLogicalPaths,
		`${path}.compiler.targetLogicalPaths`,
		issues,
		memberMaximum
	);
	canonicalStrings(compiler.targetNodeIds, `${path}.compiler.targetNodeIds`, issues, memberMaximum);
	if (!safeNonnegativeInteger(compiler.occurrenceCount))
		issues.add(
			'INVALID_SHAPE',
			`${path}.compiler.occurrenceCount`,
			'Compiler occurrence count must be a nonnegative safe integer.'
		);
	else if (edgeIds !== null && compiler.occurrenceCount !== edgeIds.length)
		issues.add(
			'POPULATION_MISMATCH',
			`${path}.compiler.occurrenceCount`,
			'Compiler occurrence count does not match its edge identities.'
		);
}

function validateProviderEvidence(
	provider: JsonRecord,
	path: string,
	dependencyIds: readonly string[] | null,
	context: RecordPopulationContext,
	issues: ValidationIssues
): void {
	const memberMaximum = dependencyIds?.length ?? context.providerDependencyMaximum;
	canonicalStrings(
		provider.dependencyTypes,
		`${path}.dependencyCruiser.dependencyTypes`,
		issues,
		context.providerDependencyTypeMaximum
	);
	canonicalStrings(
		provider.targetKinds,
		`${path}.dependencyCruiser.targetKinds`,
		issues,
		memberMaximum
	);
	canonicalStrings(
		provider.targetLogicalPaths,
		`${path}.dependencyCruiser.targetLogicalPaths`,
		issues,
		memberMaximum
	);
	if (!safeNonnegativeInteger(provider.rowCount))
		issues.add(
			'INVALID_SHAPE',
			`${path}.dependencyCruiser.rowCount`,
			'Provider row count must be a nonnegative safe integer.'
		);
	else if (dependencyIds !== null && provider.rowCount !== dependencyIds.length)
		issues.add(
			'POPULATION_MISMATCH',
			`${path}.dependencyCruiser.rowCount`,
			'Provider row count does not match its dependency identities.'
		);
}

function validateRecordDescriptors(
	value: JsonRecord,
	path: string,
	maxRationaleCharacters: number,
	issues: ValidationIssues
): RecordDescriptors {
	const assessment =
		typeof value.assessment === 'string' && ASSESSMENTS.has(value.assessment as never)
			? (value.assessment as DependencyProviderComparisonAssessment)
			: null;
	if (assessment === null)
		issues.add('INVALID_SHAPE', `${path}.assessment`, 'Comparison assessment is invalid.');
	const disposition = typeof value.disposition === 'string' ? value.disposition : null;
	if (disposition === null)
		issues.add('INVALID_SHAPE', `${path}.disposition`, 'Comparison disposition is invalid.');
	if (
		typeof value.rationale !== 'string' ||
		value.rationale.length === 0 ||
		value.rationale.length > maxRationaleCharacters
	)
		issues.add(
			'INVALID_SHAPE',
			`${path}.rationale`,
			'Record rationale must be non-empty and within the request budget.'
		);
	return { assessment, disposition };
}

function serializeRecordKey(
	key: JsonRecord | null,
	path: string,
	issues: ValidationIssues
): string | null {
	if (key === null) return null;
	try {
		return canonicalSemanticJson(key);
	} catch {
		issues.add('INVALID_SHAPE', `${path}.key`, 'Comparison key is not canonically serializable.');
		return null;
	}
}

function reportKeyOrder(
	previousKeyText: string | null,
	serializedKey: string | null,
	path: string,
	issues: ValidationIssues
): void {
	if (serializedKey === null || previousKeyText === null) return;
	const order = compareText(previousKeyText, serializedKey);
	if (order === 0)
		issues.add('POPULATION_MISMATCH', `${path}.key`, 'Comparison keys must be unique.');
	else if (order > 0)
		issues.add(
			'NONCANONICAL_ORDER',
			'$.records',
			'Comparison records are not in canonical key order.'
		);
}

function validateRecordIdentity(
	value: JsonRecord,
	key: JsonRecord | null,
	path: string,
	context: RecordPopulationContext,
	recordIds: Set<string>,
	issues: ValidationIssues
): void {
	if (typeof value.id !== 'string') {
		issues.add('INVALID_SHAPE', `${path}.id`, 'Comparison record identity must be a string.');
		return;
	}
	if (recordIds.has(value.id))
		issues.add('DUPLICATE_ID', `${path}.id`, 'Comparison record identities must be unique.');
	recordIds.add(value.id);
	if (key !== null && value.id !== expectedRecordId(context.contextDigest, key))
		issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Comparison record identity mismatch.');
}

function validateRecordEntry(
	value: unknown,
	path: string,
	previousKeyText: string | null,
	context: RecordPopulationContext,
	recordIds: Set<string>,
	issues: ValidationIssues
): RecordView {
	if (!isRecord(value) || !hasExactKeys(value, RECORD_FIELDS)) {
		issues.add('INVALID_SHAPE', path, 'Comparison record fields do not match the contract.');
		return {
			assessment: null,
			compilerEdgeIds: [],
			dependencyIds: [],
			disposition: null,
			keyText: null
		};
	}

	const compiler = subRecord(value.compiler);
	const provider = subRecord(value.dependencyCruiser);
	const key = subRecord(value.key);
	reportRecordSectionShapes(path, compiler, provider, key, issues);

	const edgeIds = canonicalEvidenceIds(
		compiler,
		'edgeIds',
		`${path}.compiler.edgeIds`,
		context.graphEdgeMaximum,
		issues
	);
	const dependencyIds = canonicalEvidenceIds(
		provider,
		'dependencyIds',
		`${path}.dependencyCruiser.dependencyIds`,
		context.providerDependencyMaximum,
		issues
	);

	if (compiler !== null) validateCompilerEvidence(compiler, path, edgeIds, context, issues);
	if (provider !== null) validateProviderEvidence(provider, path, dependencyIds, context, issues);

	const { assessment, disposition } = validateRecordDescriptors(
		value,
		path,
		context.maxRationaleCharacters,
		issues
	);
	const serializedKey = serializeRecordKey(key, path, issues);
	reportKeyOrder(previousKeyText, serializedKey, path, issues);
	validateRecordIdentity(value, key, path, context, recordIds, issues);

	return {
		assessment,
		compilerEdgeIds: edgeIds ?? [],
		dependencyIds: dependencyIds ?? [],
		disposition,
		keyText: serializedKey
	};
}

function validateRecordPopulation(
	records: readonly unknown[],
	contextDigest: string,
	graphEdgeMaximum: number,
	providerDependencyMaximum: number,
	providerDependencyTypeMaximum: number,
	maxRationaleCharacters: number,
	issues: ValidationIssues
): readonly RecordView[] {
	const context: RecordPopulationContext = {
		contextDigest,
		graphEdgeMaximum,
		maxRationaleCharacters,
		providerDependencyMaximum,
		providerDependencyTypeMaximum
	};
	const views: RecordView[] = [];
	const recordIds = new Set<string>();
	let previousKeyText: string | null = null;

	for (const [index, value] of records.entries()) {
		const view = validateRecordEntry(
			value,
			`$.records[${index}]`,
			previousKeyText,
			context,
			recordIds,
			issues
		);
		previousKeyText = view.keyText ?? previousKeyText;
		views.push(view);
	}
	return views;
}

interface CoverageExpectations {
	readonly compilerPartition: boolean;
	readonly graphEdgeTotal: number;
	readonly providerDependencyTotal: number;
	readonly providerPartition: boolean;
}

function validateCoverage(
	value: unknown,
	records: readonly unknown[],
	views: readonly RecordView[],
	totals: CoverageExpectations,
	issues: ValidationIssues
): void {
	if (!isRecord(value) || !hasExactKeys(value, COVERAGE_FIELDS)) {
		issues.add('INVALID_SHAPE', '$.coverage', 'Coverage fields do not match the contract.');
		return;
	}
	const count = (assessment: DependencyProviderComparisonAssessment): number =>
		views.filter((record) => record.assessment === assessment).length;
	const compilerEdgesRepresented = views.reduce(
		(total, record) => total + record.compilerEdgeIds.length,
		0
	);
	const dependencyCruiserDependenciesRepresented = views.reduce(
		(total, record) => total + record.dependencyIds.length,
		0
	);
	const expected: JsonRecord = {
		agreementRecords: count('AGREEMENT'),
		compilerEdgesRepresented,
		compilerEdgesTotal: totals.graphEdgeTotal,
		corroborationRecords: count('CORROBORATION'),
		dependencyCruiserDependenciesRepresented,
		dependencyCruiserDependenciesTotal: totals.providerDependencyTotal,
		incomparableRecords: count('INCOMPARABLE'),
		observedDifferenceRecords: count('OBSERVED_DIFFERENCE'),
		reconciles: totals.compilerPartition && totals.providerPartition,
		recordCount: records.length
	};
	for (const field of COVERAGE_FIELDS)
		if (value[field] !== expected[field])
			issues.add(
				'POPULATION_MISMATCH',
				`$.coverage.${field}`,
				'Coverage value does not reconcile with the record and input populations.'
			);
}

function expectedLimitationCounts(
	views: readonly RecordView[]
): ReadonlyMap<DependencyProviderComparisonLimitationKind, number> {
	const countDisposition = (disposition: string): number =>
		views.filter((record) => record.disposition === disposition).length;
	const expected = new Map<DependencyProviderComparisonLimitationKind, number>([
		[
			'CONFLICT_QUALIFICATION_UNAVAILABLE',
			views.filter((record) => record.assessment === 'OBSERVED_DIFFERENCE').length
		],
		[
			'NEGATIVE_COVERAGE_NOT_CLOSED',
			views.filter(
				(record) => record.compilerEdgeIds.length === 0 || record.dependencyIds.length === 0
			).length
		],
		[
			'PROVIDER_AGGREGATES_OCCURRENCES',
			views.filter((record) => record.compilerEdgeIds.length > 0 && record.dependencyIds.length > 0)
				.length
		],
		[
			'RESOLUTION_CONTEXT_NOT_PROVEN_EQUIVALENT',
			countDisposition('INCOMPARABLE_RESOLUTION_CONTEXT')
		],
		['TYPE_ONLY_PARTITION_NOT_REPRODUCED', views.length]
	]);
	const providerDomain = countDisposition('INCOMPARABLE_PROVIDER_DOMAIN');
	if (providerDomain > 0) expected.set('PROVIDER_DOMAIN_OUTSIDE_COMPILER_GRAPH', providerDomain);
	const targetModel = countDisposition('PRESENCE_ONLY_TARGET_MODEL_DIFFERENT');
	if (targetModel > 0) expected.set('TARGET_MODEL_DIFFERENCE', targetModel);
	return expected;
}

function validateLimitationEntry(
	entry: unknown,
	path: string,
	previousKind: string | null,
	maxRationaleCharacters: number,
	actual: Map<string, number>,
	issues: ValidationIssues
): string | null {
	if (!isRecord(entry) || !hasExactKeys(entry, LIMITATION_FIELDS)) {
		issues.add('INVALID_SHAPE', path, 'Limitation fields do not match the contract.');
		return previousKind;
	}
	if (typeof entry.kind !== 'string') {
		issues.add('INVALID_SHAPE', `${path}.kind`, 'Limitation kind must be a string.');
		return previousKind;
	}
	if (actual.has(entry.kind))
		issues.add('DUPLICATE_ID', `${path}.kind`, 'Limitation kinds must be unique.');
	if (previousKind !== null && compareText(previousKind, entry.kind) >= 0)
		issues.add(
			'NONCANONICAL_ORDER',
			'$.limitations',
			'Limitations are not in unique canonical kind order.'
		);
	if (!safeNonnegativeInteger(entry.affectedRecordCount))
		issues.add(
			'INVALID_SHAPE',
			`${path}.affectedRecordCount`,
			'Limitation count must be a nonnegative safe integer.'
		);
	else actual.set(entry.kind, entry.affectedRecordCount);
	if (
		typeof entry.rationale !== 'string' ||
		entry.rationale.length === 0 ||
		entry.rationale.length > maxRationaleCharacters
	)
		issues.add(
			'INVALID_SHAPE',
			`${path}.rationale`,
			'Limitation rationale must be non-empty and within the request budget.'
		);
	return entry.kind;
}

function reportLimitationReconciliation(
	expected: ReadonlyMap<DependencyProviderComparisonLimitationKind, number>,
	actual: ReadonlyMap<string, number>,
	issues: ValidationIssues
): void {
	for (const [kind, count] of expected)
		if (actual.get(kind) !== count)
			issues.add(
				'POPULATION_MISMATCH',
				'$.limitations',
				`Limitation ${kind} does not carry its derived affected-record count.`
			);
	for (const kind of actual.keys())
		if (!expected.has(kind as DependencyProviderComparisonLimitationKind))
			issues.add('POPULATION_MISMATCH', '$.limitations', `Unexpected limitation kind ${kind}.`);
}

function validateLimitations(
	value: unknown,
	views: readonly RecordView[],
	maxRationaleCharacters: number,
	issues: ValidationIssues
): void {
	if (!Array.isArray(value)) {
		issues.add('INVALID_SHAPE', '$.limitations', 'Expected a limitation array.');
		return;
	}
	const expected = expectedLimitationCounts(views);
	const actual = new Map<string, number>();
	let previousKind: string | null = null;
	for (const [index, entry] of value.entries())
		previousKind = validateLimitationEntry(
			entry,
			`$.limitations[${index}]`,
			previousKind,
			maxRationaleCharacters,
			actual,
			issues
		);

	reportLimitationReconciliation(expected, actual, issues);
}

function resolveMaxIssues(
	options: DependencyProviderComparisonValidationOptions
): DependencyProviderComparisonValidationResult | number {
	if (!isRecord(options))
		return invalidResult(
			'INVALID_INPUTS',
			'$validationOptions',
			'Validation options must be an object.'
		);
	const requestedMaxIssues = options.maxIssues;
	const maxIssues = requestedMaxIssues ?? 100;
	if (
		typeof maxIssues !== 'number' ||
		!Number.isSafeInteger(maxIssues) ||
		maxIssues < 1 ||
		maxIssues > 100_000
	)
		return invalidResult(
			'INVALID_INPUTS',
			'$validationOptions.maxIssues',
			'maxIssues must be a positive safe integer no greater than 100000.'
		);
	return maxIssues;
}

function unavailableResult(
	diagnostics: readonly DependencyProviderComparisonDiagnostic[],
	maxIssues: number
): DependencyProviderComparisonValidationResult {
	return {
		issues: diagnostics.slice(0, maxIssues).map((diagnostic) => ({
			code: 'INVALID_INPUTS' as const,
			message: diagnostic.message,
			path: diagnostic.path ?? '$'
		})),
		state: diagnostics.length > maxIssues ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function reportRootShape(
	value: unknown,
	issues: ValidationIssues
): value is JsonRecord & { readonly records: readonly unknown[] } {
	if (!isRecord(value) || !hasExactKeys(value, ROOT_FIELDS)) {
		issues.add('INVALID_SHAPE', '$', 'Comparison root fields do not match the contract.');
		return false;
	}
	if (!Array.isArray(value.records)) {
		issues.add('INVALID_SHAPE', '$.records', 'Comparison records must be an array.');
		return false;
	}
	return true;
}

function providerTypeCeiling(observationRecord: JsonRecord | null): number {
	if (!Array.isArray(observationRecord?.dependencies)) return 0;
	return observationRecord.dependencies.reduce<number>(
		(total, dependency) =>
			total +
			(isRecord(dependency) && Array.isArray(dependency.dependencyTypes)
				? dependency.dependencyTypes.length
				: 0),
		0
	);
}

function reportContentMatch(
	value: JsonRecord,
	rebuiltComparison: DependencyProviderComparisonSnapshot,
	issues: ValidationIssues
): DependencyProviderComparisonValidationResult {
	let contentIssue: DependencyProviderComparisonValidationIssue | null = null;
	try {
		if (
			canonicalSemanticJson(value as unknown as DependencyProviderComparisonSnapshot) !==
			canonicalSemanticJson(rebuiltComparison)
		)
			contentIssue = {
				code: 'CONTENT_MISMATCH',
				message:
					'Comparison bytes do not match the deterministic result rebuilt from the bound inputs.',
				path: '$'
			};
	} catch {
		contentIssue = {
			code: 'INVALID_SHAPE',
			message: 'Comparison canonicalization failed closed.',
			path: '$'
		};
	}
	if (contentIssue !== null) return { issues: [contentIssue], state: 'INVALID' };
	return issues.result();
}

function validateComparisonBody(
	value: JsonRecord & { readonly records: readonly unknown[] },
	request: CompareDependencyProvidersRequest,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	rebuiltComparison: DependencyProviderComparisonSnapshot,
	issues: ValidationIssues
): DependencyProviderComparisonValidationResult {
	const graphRecord = isRecord(graph) ? graph : null;
	const observationRecord = isRecord(observation) ? observation : null;
	const edgeIds = inputIds(graphRecord?.edges, '$graph.edges', issues);
	const dependencyIds = inputIds(
		observationRecord?.dependencies,
		'$observation.dependencies',
		issues
	);
	if (edgeIds === null || dependencyIds === null) return issues.result();
	const providerTypeMaximum = providerTypeCeiling(observationRecord);
	if (
		typeof value.comparisonContextDigest !== 'string' ||
		!SHA256.test(value.comparisonContextDigest)
	) {
		issues.add(
			'INVALID_SHAPE',
			'$.comparisonContextDigest',
			'Comparison context digest must be lowercase SHA-256.'
		);
		return issues.result();
	}

	const views = validateRecordPopulation(
		value.records,
		value.comparisonContextDigest,
		edgeIds.length,
		dependencyIds.length,
		providerTypeMaximum,
		request.budgets.maxRationaleCharacters,
		issues
	);
	const actualEdgeIds = views.flatMap((record) => record.compilerEdgeIds);
	const actualDependencyIds = views.flatMap((record) => record.dependencyIds);
	const compilerPartition = partitionReconciles(
		actualEdgeIds,
		edgeIds,
		'$.records[*].compiler.edgeIds',
		'Compiler edge',
		issues
	);
	const providerPartition = partitionReconciles(
		actualDependencyIds,
		dependencyIds,
		'$.records[*].dependencyCruiser.dependencyIds',
		'Dependency-cruiser dependency',
		issues
	);
	const totals: CoverageExpectations = {
		compilerPartition,
		graphEdgeTotal: edgeIds.length,
		providerDependencyTotal: dependencyIds.length,
		providerPartition
	};
	validateCoverage(value.coverage, value.records, views, totals, issues);
	validateLimitations(value.limitations, views, request.budgets.maxRationaleCharacters, issues);

	return reportContentMatch(value, rebuiltComparison, issues);
}

function validateInternal(
	value: unknown,
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	options: DependencyProviderComparisonValidationOptions
): DependencyProviderComparisonValidationResult {
	const resolvedMaxIssues = resolveMaxIssues(options);
	if (typeof resolvedMaxIssues !== 'number') return resolvedMaxIssues;

	const rebuilt = compareDependencyProviders(request, semanticSnapshot, graph, observation);
	if (rebuilt.outcome === 'unavailable')
		return unavailableResult(rebuilt.diagnostics, resolvedMaxIssues);

	const issues = new ValidationIssues(resolvedMaxIssues);
	if (!reportRootShape(value, issues)) return issues.result();
	if (
		!isRecord(request) ||
		!isRecord(request.budgets) ||
		!Number.isSafeInteger(request.budgets.maxComparisonRecords) ||
		!Number.isSafeInteger(request.budgets.maxRationaleCharacters)
	)
		return invalidResult('INVALID_INPUTS', '$request.budgets', 'Comparison budgets are invalid.');
	if (value.records.length > request.budgets.maxComparisonRecords)
		return invalidResult(
			'POPULATION_BUDGET_EXCEEDED',
			'$.records',
			`Comparison contains ${value.records.length} records, exceeding maxComparisonRecords ${request.budgets.maxComparisonRecords}.`
		);

	return validateComparisonBody(value, request, graph, observation, rebuilt.comparison, issues);
}

/**
 * Validates independent population, identity, coverage, and canonical-order invariants before
 * checking deterministic reproduction. Disposition selection remains owned by the comparison
 * builder so this validator does not become a second category engine.
 */
export function validateDependencyProviderComparison(
	value: unknown,
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	options: DependencyProviderComparisonValidationOptions = {}
): DependencyProviderComparisonValidationResult {
	try {
		return validateInternal(value, request, semanticSnapshot, graph, observation, options);
	} catch {
		return invalidResult(
			'INVALID_SHAPE',
			'$',
			'Dependency-provider comparison validation failed closed.'
		);
	}
}
