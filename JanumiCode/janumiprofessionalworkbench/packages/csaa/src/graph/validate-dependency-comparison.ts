import type {
	CompareDependencyProvidersRequest,
	DependencyProviderComparisonAssessment,
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

function validateRecordPopulation(
	records: readonly unknown[],
	contextDigest: string,
	graphEdgeMaximum: number,
	providerDependencyMaximum: number,
	providerDependencyTypeMaximum: number,
	maxRationaleCharacters: number,
	issues: ValidationIssues
): readonly RecordView[] {
	const views: RecordView[] = [];
	const recordIds = new Set<string>();
	let previousKeyText: string | null = null;

	for (const [index, value] of records.entries()) {
		const path = `$.records[${index}]`;
		if (!isRecord(value) || !hasExactKeys(value, RECORD_FIELDS)) {
			issues.add('INVALID_SHAPE', path, 'Comparison record fields do not match the contract.');
			views.push({
				assessment: null,
				compilerEdgeIds: [],
				dependencyIds: [],
				disposition: null,
				keyText: null
			});
			continue;
		}

		const compiler = isRecord(value.compiler) ? value.compiler : null;
		const provider = isRecord(value.dependencyCruiser) ? value.dependencyCruiser : null;
		const key = isRecord(value.key) ? value.key : null;
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

		const edgeIds =
			compiler === null
				? null
				: canonicalStrings(
						compiler.edgeIds,
						`${path}.compiler.edgeIds`,
						issues,
						graphEdgeMaximum,
						'DUPLICATE_ID'
					);
		const dependencyIds =
			provider === null
				? null
				: canonicalStrings(
						provider.dependencyIds,
						`${path}.dependencyCruiser.dependencyIds`,
						issues,
						providerDependencyMaximum,
						'DUPLICATE_ID'
					);

		if (compiler !== null) {
			canonicalStrings(
				compiler.relationKinds,
				`${path}.compiler.relationKinds`,
				issues,
				edgeIds?.length ?? graphEdgeMaximum
			);
			canonicalStrings(
				compiler.resolutionStates,
				`${path}.compiler.resolutionStates`,
				issues,
				edgeIds?.length ?? graphEdgeMaximum
			);
			canonicalStrings(
				compiler.targetLogicalPaths,
				`${path}.compiler.targetLogicalPaths`,
				issues,
				edgeIds?.length ?? graphEdgeMaximum
			);
			canonicalStrings(
				compiler.targetNodeIds,
				`${path}.compiler.targetNodeIds`,
				issues,
				edgeIds?.length ?? graphEdgeMaximum
			);
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

		if (provider !== null) {
			canonicalStrings(
				provider.dependencyTypes,
				`${path}.dependencyCruiser.dependencyTypes`,
				issues,
				providerDependencyTypeMaximum
			);
			canonicalStrings(
				provider.targetKinds,
				`${path}.dependencyCruiser.targetKinds`,
				issues,
				dependencyIds?.length ?? providerDependencyMaximum
			);
			canonicalStrings(
				provider.targetLogicalPaths,
				`${path}.dependencyCruiser.targetLogicalPaths`,
				issues,
				dependencyIds?.length ?? providerDependencyMaximum
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

		let serializedKey: string | null = null;
		if (key !== null)
			try {
				serializedKey = canonicalSemanticJson(key);
			} catch {
				issues.add(
					'INVALID_SHAPE',
					`${path}.key`,
					'Comparison key is not canonically serializable.'
				);
			}
		if (serializedKey !== null) {
			if (previousKeyText !== null) {
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
			previousKeyText = serializedKey;
		}

		if (typeof value.id !== 'string')
			issues.add('INVALID_SHAPE', `${path}.id`, 'Comparison record identity must be a string.');
		else {
			if (recordIds.has(value.id))
				issues.add('DUPLICATE_ID', `${path}.id`, 'Comparison record identities must be unique.');
			recordIds.add(value.id);
			if (key !== null && value.id !== expectedRecordId(contextDigest, key))
				issues.add('IDENTITY_MISMATCH', `${path}.id`, 'Comparison record identity mismatch.');
		}

		views.push({
			assessment,
			compilerEdgeIds: edgeIds ?? [],
			dependencyIds: dependencyIds ?? [],
			disposition,
			keyText: serializedKey
		});
	}
	return views;
}

function validateCoverage(
	value: unknown,
	records: readonly unknown[],
	views: readonly RecordView[],
	graphEdgeTotal: number,
	providerDependencyTotal: number,
	compilerPartition: boolean,
	providerPartition: boolean,
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
		compilerEdgesTotal: graphEdgeTotal,
		corroborationRecords: count('CORROBORATION'),
		dependencyCruiserDependenciesRepresented,
		dependencyCruiserDependenciesTotal: providerDependencyTotal,
		incomparableRecords: count('INCOMPARABLE'),
		observedDifferenceRecords: count('OBSERVED_DIFFERENCE'),
		reconciles: compilerPartition && providerPartition,
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
	for (const [index, entry] of value.entries()) {
		const path = `$.limitations[${index}]`;
		if (!isRecord(entry) || !hasExactKeys(entry, LIMITATION_FIELDS)) {
			issues.add('INVALID_SHAPE', path, 'Limitation fields do not match the contract.');
			continue;
		}
		if (typeof entry.kind !== 'string') {
			issues.add('INVALID_SHAPE', `${path}.kind`, 'Limitation kind must be a string.');
			continue;
		}
		if (actual.has(entry.kind))
			issues.add('DUPLICATE_ID', `${path}.kind`, 'Limitation kinds must be unique.');
		if (previousKind !== null && compareText(previousKind, entry.kind) >= 0)
			issues.add(
				'NONCANONICAL_ORDER',
				'$.limitations',
				'Limitations are not in unique canonical kind order.'
			);
		previousKind = entry.kind;
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
	}

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

function validateInternal(
	value: unknown,
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	options: DependencyProviderComparisonValidationOptions
): DependencyProviderComparisonValidationResult {
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

	const rebuilt = compareDependencyProviders(request, semanticSnapshot, graph, observation);
	if (rebuilt.outcome === 'unavailable')
		return {
			issues: rebuilt.diagnostics.slice(0, maxIssues).map((diagnostic) => ({
				code: 'INVALID_INPUTS' as const,
				message: diagnostic.message,
				path: diagnostic.path ?? '$'
			})),
			state: rebuilt.diagnostics.length > maxIssues ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};

	const issues = new ValidationIssues(maxIssues);
	if (!isRecord(value) || !hasExactKeys(value, ROOT_FIELDS)) {
		issues.add('INVALID_SHAPE', '$', 'Comparison root fields do not match the contract.');
		return issues.result();
	}
	if (!Array.isArray(value.records)) {
		issues.add('INVALID_SHAPE', '$.records', 'Comparison records must be an array.');
		return issues.result();
	}
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

	const graphRecord = isRecord(graph) ? graph : null;
	const observationRecord = isRecord(observation) ? observation : null;
	const edgeIds = inputIds(graphRecord?.edges, '$graph.edges', issues);
	const dependencyIds = inputIds(
		observationRecord?.dependencies,
		'$observation.dependencies',
		issues
	);
	if (edgeIds === null || dependencyIds === null) return issues.result();
	const providerTypeMaximum = Array.isArray(observationRecord?.dependencies)
		? observationRecord.dependencies.reduce(
				(total, dependency) =>
					total +
					(isRecord(dependency) && Array.isArray(dependency.dependencyTypes)
						? dependency.dependencyTypes.length
						: 0),
				0
			)
		: 0;
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
	validateCoverage(
		value.coverage,
		value.records,
		views,
		edgeIds.length,
		dependencyIds.length,
		compilerPartition,
		providerPartition,
		issues
	);
	validateLimitations(value.limitations, views, request.budgets.maxRationaleCharacters, issues);

	let contentIssue: DependencyProviderComparisonValidationIssue | null = null;
	try {
		if (
			canonicalSemanticJson(value as unknown as DependencyProviderComparisonSnapshot) !==
			canonicalSemanticJson(rebuilt.comparison)
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
