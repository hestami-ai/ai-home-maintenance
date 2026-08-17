import type {
	CompareDependencyProvidersRequest,
	CompilerDependencyComparisonEvidence,
	DependencyCruiserDependencyComparisonEvidence,
	DependencyProviderComparisonAssessment,
	DependencyProviderComparisonDiagnostic,
	DependencyProviderComparisonDisposition,
	DependencyProviderComparisonId,
	DependencyProviderComparisonKey,
	DependencyProviderComparisonLimitation,
	DependencyProviderComparisonOutcome,
	DependencyProviderComparisonRecord,
	DependencyProviderComparisonRecordId,
	DependencyProviderComparisonSnapshot,
	DependencyProviderModuleSystem
} from '../contracts/dependency-comparison.js';
import {
	DEPENDENCY_PROVIDER_COMPARISON_CANONICAL_PROFILE,
	DEPENDENCY_PROVIDER_COMPARISON_METHOD,
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_SCHEMA_VERSION
} from '../contracts/dependency-comparison.js';
import type {
	DependencyCruiserDependencyObservation,
	DependencyCruiserObservation
} from '../contracts/dependency-cruiser.js';
import type {
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphSnapshot,
	ModuleDependencyGraphSourceNode
} from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { FULL_JAN_CSAA_007_CONFORMANCE } from '../contracts/semantic.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateDependencyCruiserObservation } from '../providers/dependency-cruiser/normalize-output.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const PROVIDER_SUPPORTED_RELATION_TYPES = new Set([
	'dynamic-import',
	'export',
	'import',
	'import-equals',
	'type-import'
]);

interface MutableComparisonGroup {
	compilerEdges: ModuleDependencyGraphEdge[];
	key: DependencyProviderComparisonKey;
	providerDependencies: DependencyCruiserDependencyObservation[];
}

interface TargetSummary {
	compilerKinds: string[];
	compilerPaths: string[];
	providerKinds: string[];
	providerPaths: string[];
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
	return [...new Set(values)].sort(compareText);
}

function keyText(key: DependencyProviderComparisonKey): string {
	return canonicalSemanticJson({
		importerBinding: key.importerBinding,
		importerSemanticSourceId: key.importerSemanticSourceId,
		moduleSystem: key.moduleSystem,
		normalizedSpecifier: key.normalizedSpecifier,
		sourcePath: key.sourcePath,
		typeOnlyPartition: key.typeOnlyPartition
	});
}

function normalizeSpecifier(specifier: string): string {
	return specifier.startsWith('node:') ? specifier.slice('node:'.length) : specifier;
}

function compilerModuleSystem(edge: ModuleDependencyGraphEdge): DependencyProviderModuleSystem {
	return edge.occurrenceKind === 'IMPORT_EQUALS' ? 'cjs' : 'es6';
}

function providerModuleSystem(
	dependency: DependencyCruiserDependencyObservation
): DependencyProviderModuleSystem {
	return dependency.moduleSystem;
}

function assessmentFor(
	disposition: DependencyProviderComparisonDisposition
): DependencyProviderComparisonAssessment {
	if (disposition.startsWith('AGREE_')) return 'AGREEMENT';
	if (
		disposition === 'CORROBORATED_COLLAPSED_RELATION' ||
		disposition === 'PRESENCE_ONLY_TARGET_MODEL_DIFFERENT'
	)
		return 'CORROBORATION';
	if (disposition.startsWith('OBSERVED_')) return 'OBSERVED_DIFFERENCE';
	return 'INCOMPARABLE';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	return (
		canonicalSemanticJson(Object.keys(value).sort(compareText)) ===
		canonicalSemanticJson([...expected].sort(compareText))
	);
}

function isUnicodeScalarString(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

type RequestDiagnosticSink = (message: string, path: string) => void;

function requestSubRecord(
	request: Record<string, unknown> | null,
	field: string
): Record<string, unknown> | null {
	if (request === null) return null;
	const nested = request[field];
	return isRecord(nested) ? nested : null;
}

function resolveDiagnosticBudget(budgets: Record<string, unknown> | null): number {
	return budgets !== null && Number.isSafeInteger(budgets.maxDiagnostics)
		? Math.max(1, Math.min(100_000, budgets.maxDiagnostics as number))
		: 1;
}

function addContractShapeDiagnostics(
	request: Record<string, unknown>,
	budgets: Record<string, unknown> | null,
	resolutionContext: Record<string, unknown> | null,
	negativeCoverage: Record<string, unknown> | null,
	add: RequestDiagnosticSink
): void {
	if (
		!hasExactKeys(request, [
			'budgets',
			'dependencyCruiserObservationId',
			'graphId',
			'negativeCoverage',
			'operationVersion',
			'resolutionContext',
			'schemaVersion',
			'semanticSnapshotId',
			'subjectId'
		])
	)
		add('Comparison request must contain exactly the versioned contract fields.', '$request');
	if (
		budgets === null ||
		!hasExactKeys(budgets, ['maxComparisonRecords', 'maxDiagnostics', 'maxRationaleCharacters'])
	)
		add(
			'Comparison budgets must contain exactly the versioned contract fields.',
			'$request.budgets'
		);
	if (
		resolutionContext === null ||
		!hasExactKeys(resolutionContext, [
			'compilerContextDigest',
			'providerContextDigest',
			'rationale',
			'state'
		])
	)
		add(
			'Resolution context must contain exactly the versioned contract fields.',
			'$request.resolutionContext'
		);
	if (negativeCoverage === null || !hasExactKeys(negativeCoverage, ['rationale', 'state']))
		add(
			'Negative coverage must contain exactly the versioned contract fields.',
			'$request.negativeCoverage'
		);
}

function addContractIdentityDiagnostics(
	request: Record<string, unknown>,
	add: RequestDiagnosticSink
): void {
	if (request.schemaVersion !== DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION)
		add('Unsupported comparison request schema version.', '$request.schemaVersion');
	if (request.operationVersion !== DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION)
		add('Unsupported comparison operation version.', '$request.operationVersion');
	if (!isUnicodeScalarString(request.subjectId) || request.subjectId.length === 0)
		add('subjectId must be a non-empty string.', '$request.subjectId');
	if (
		!isUnicodeScalarString(request.dependencyCruiserObservationId) ||
		request.dependencyCruiserObservationId.length === 0
	)
		add(
			'dependencyCruiserObservationId must be a non-empty string.',
			'$request.dependencyCruiserObservationId'
		);
}

function addBudgetRangeDiagnostics(
	budgets: Record<string, unknown> | null,
	add: RequestDiagnosticSink
): void {
	for (const [name, value, maximum] of [
		['maxComparisonRecords', budgets?.maxComparisonRecords, 10_000_000],
		['maxDiagnostics', budgets?.maxDiagnostics, 100_000],
		['maxRationaleCharacters', budgets?.maxRationaleCharacters, 1_000_000]
	] as const) {
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum)
			add(
				`${name} must be a positive safe integer no greater than ${maximum}.`,
				`$request.budgets.${name}`
			);
	}
}

function addResolutionContextDiagnostics(
	budgets: Record<string, unknown> | null,
	resolutionContext: Record<string, unknown> | null,
	negativeCoverage: Record<string, unknown> | null,
	add: RequestDiagnosticSink
): void {
	for (const [name, digest] of [
		['compilerContextDigest', resolutionContext?.compilerContextDigest],
		['providerContextDigest', resolutionContext?.providerContextDigest]
	] as const) {
		if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest))
			add(`${name} must be a lowercase SHA-256 digest.`, `$request.resolutionContext.${name}`);
	}
	if (!['NOT_EQUIVALENT', 'UNKNOWN'].includes(resolutionContext?.state as string))
		add('Invalid resolution-context state.', '$request.resolutionContext.state');
	if (!['OPEN', 'UNKNOWN'].includes(negativeCoverage?.state as string))
		add('Invalid negative-coverage state.', '$request.negativeCoverage.state');
	for (const [path, rationale] of [
		['$request.resolutionContext.rationale', resolutionContext?.rationale],
		['$request.negativeCoverage.rationale', negativeCoverage?.rationale]
	] as const) {
		if (
			!isUnicodeScalarString(rationale) ||
			rationale.length === 0 ||
			rationale.length > (Number(budgets?.maxRationaleCharacters) || 0)
		)
			add('Rationale must be non-empty and within maxRationaleCharacters.', path);
	}
}

function validateRequest(value: unknown): DependencyProviderComparisonDiagnostic[] {
	const diagnostics: DependencyProviderComparisonDiagnostic[] = [];
	const request = isRecord(value) ? value : null;
	const budgets = requestSubRecord(request, 'budgets');
	const resolutionContext = requestSubRecord(request, 'resolutionContext');
	const negativeCoverage = requestSubRecord(request, 'negativeCoverage');
	const diagnosticBudget = resolveDiagnosticBudget(budgets);
	const add = (message: string, path: string): void => {
		if (diagnostics.length < diagnosticBudget)
			diagnostics.push({ code: 'REQUEST_INVALID', message, path });
	};
	if (request === null) {
		add('Comparison request must be an object.', '$request');
		return diagnostics;
	}
	addContractShapeDiagnostics(request, budgets, resolutionContext, negativeCoverage, add);
	addContractIdentityDiagnostics(request, add);
	addBudgetRangeDiagnostics(budgets, add);
	addResolutionContextDiagnostics(budgets, resolutionContext, negativeCoverage, add);
	return diagnostics;
}

function compilerTargetSummary(
	edges: readonly ModuleDependencyGraphEdge[],
	nodeById: ReadonlyMap<string, ModuleDependencyGraphSnapshot['nodes'][number]>
): Pick<TargetSummary, 'compilerKinds' | 'compilerPaths'> {
	const kinds: string[] = [];
	const paths: string[] = [];
	for (const edge of edges) {
		const target = nodeById.get(edge.target.nodeId);
		if (target?.kind === 'SOURCE') paths.push(target.logicalPath);
		if (edge.resolutionState === 'RESOLVED_SOURCE')
			kinds.push(target?.kind === 'SOURCE' ? 'LOCAL' : 'AMBIGUOUS');
		else if (edge.resolutionState === 'UNRESOLVED') kinds.push('UNRESOLVED');
		else if (edge.resolutionState === 'UNSUPPORTED') kinds.push('UNSUPPORTED');
		else if (edge.resolutionState === 'RESOLVED_AMBIENT') kinds.push('AMBIENT');
		else kinds.push('EXTERNAL');
	}
	return { compilerKinds: uniqueSorted(kinds), compilerPaths: uniqueSorted(paths) };
}

function providerTargetSummary(
	dependencies: readonly DependencyCruiserDependencyObservation[]
): Pick<TargetSummary, 'providerKinds' | 'providerPaths'> {
	const kinds: string[] = [];
	const paths: string[] = [];
	for (const dependency of dependencies) {
		kinds.push(dependency.target.kind);
		if (dependency.target.kind === 'RESOLVED_LOCAL_PATH') paths.push(dependency.target.path);
	}
	return { providerKinds: uniqueSorted(kinds), providerPaths: uniqueSorted(paths) };
}

function providerRelationIsInCompilerDomain(
	dependencies: readonly DependencyCruiserDependencyObservation[]
): boolean {
	return dependencies.some((dependency) =>
		dependency.dependencyTypes.some((kind) => PROVIDER_SUPPORTED_RELATION_TYPES.has(kind))
	);
}

interface DispositionDecision {
	disposition: DependencyProviderComparisonDisposition;
	rationale: string;
}

function decideUnmatchedProviderRelation(
	group: MutableComparisonGroup,
	providerHealthy: boolean
): DispositionDecision {
	if (group.key.importerBinding === 'AMBIGUOUS_GRAPH_SOURCES')
		return {
			disposition: 'AMBIGUOUS_AGGREGATE',
			rationale:
				'The provider importer path matches multiple compiler source identities; no Program was selected.'
		};
	if (group.key.importerSemanticSourceId === null)
		return {
			disposition: 'INCOMPARABLE_EXCLUDED_OR_OUTSIDE_PERIMETER',
			rationale: 'The dependency-cruiser importer has no source identity in this compiler graph.'
		};
	if (!providerRelationIsInCompilerDomain(group.providerDependencies))
		return {
			disposition: 'INCOMPARABLE_PROVIDER_DOMAIN',
			rationale:
				'The provider relation kind is outside the current compiler module-occurrence graph domain.'
		};
	if (!providerHealthy)
		return {
			disposition: 'UNKNOWN_PROVIDER_PARTIAL',
			rationale:
				'The provider observation is partial, so an unmatched provider relation remains unknown.'
		};
	return {
		disposition: 'OBSERVED_MISSING_RELATION',
		rationale:
			'The provider relation has no compiler counterpart; this is an observed difference, not a qualified conflict.'
	};
}

function decideUnmatchedCompilerRelation(
	group: MutableComparisonGroup,
	sourceWasCruised: boolean,
	sourceBindingAmbiguous: boolean,
	providerHealthy: boolean
): DispositionDecision {
	if (group.key.normalizedSpecifier === null)
		return {
			disposition: 'INCOMPARABLE_PROVIDER_DOMAIN',
			rationale: 'Non-literal compiler module syntax has no dependency-cruiser aggregate join key.'
		};
	if (sourceBindingAmbiguous)
		return {
			disposition: 'AMBIGUOUS_AGGREGATE',
			rationale:
				'The importer path has multiple compiler source identities, so provider absence cannot be attributed to this Program.'
		};
	if (!sourceWasCruised)
		return {
			disposition: 'INCOMPARABLE_EXCLUDED_OR_OUTSIDE_PERIMETER',
			rationale: 'The compiler importer was not present in the provider module population.'
		};
	if (!providerHealthy)
		return {
			disposition: 'UNKNOWN_PROVIDER_PARTIAL',
			rationale: 'The provider observation is partial, so provider absence is unknown.'
		};
	return {
		disposition: 'OBSERVED_MISSING_RELATION',
		rationale:
			'The compiler relation has no provider counterpart; this is an observed difference, not a qualified conflict.'
	};
}

function aggregateTargetsAreAmbiguous(summary: TargetSummary): boolean {
	return (
		summary.compilerKinds.length !== 1 ||
		summary.providerKinds.length !== 1 ||
		(summary.compilerKinds[0] === 'LOCAL' && summary.compilerPaths.length !== 1) ||
		(summary.providerKinds[0] === 'RESOLVED_LOCAL_PATH' && summary.providerPaths.length !== 1)
	);
}

function decideLocalTargetRelation(
	group: MutableComparisonGroup,
	summary: TargetSummary,
	providerBaseMappingQualified: boolean
): DispositionDecision {
	if (summary.compilerPaths[0] === summary.providerPaths[0]) {
		if (!providerBaseMappingQualified)
			return {
				disposition: 'INCOMPARABLE_RESOLUTION_CONTEXT',
				rationale:
					'The local target strings match, but the provider base-directory mapping to the subject is unqualified.'
			};
		const collapsed =
			group.compilerEdges.length > 1 ||
			group.providerDependencies.length > 1 ||
			uniqueSorted(group.compilerEdges.map((edge) => edge.relationKind)).length > 1;
		return collapsed
			? {
					disposition: 'CORROBORATED_COLLAPSED_RELATION',
					rationale:
						'Both providers identify the same local target; dependency-cruiser collapses one or more compiler occurrence distinctions.'
				}
			: {
					disposition: 'AGREE_EXACT_TARGET',
					rationale: 'Both providers identify the same canonical local source target.'
				};
	}
	return providerBaseMappingQualified
		? {
				disposition: 'OBSERVED_TARGET_DIFFERENCE',
				rationale:
					'Both providers resolved the specifier to different canonical local targets; no conflict authority is claimed.'
			}
		: {
				disposition: 'INCOMPARABLE_RESOLUTION_CONTEXT',
				rationale:
					'Local target strings differ while the provider base-directory mapping is unqualified.'
			};
}

function decideTargetClassRelation(
	compilerKind: string,
	providerKind: string
): DispositionDecision {
	if (compilerKind === 'UNRESOLVED' && providerKind === 'UNRESOLVED')
		return {
			disposition: 'AGREE_UNRESOLVED',
			rationale: 'Both providers explicitly report the same literal module specifier as unresolved.'
		};
	const compilerResolved = ['LOCAL', 'AMBIENT', 'EXTERNAL'].includes(compilerKind);
	const providerResolved = providerKind !== 'UNRESOLVED';
	if (compilerResolved !== providerResolved)
		return {
			disposition: 'OBSERVED_RESOLUTION_STATE_DIFFERENCE',
			rationale:
				'One provider resolved the specifier and the other did not; the difference is retained without conflict authority.'
		};
	if (compilerKind === 'EXTERNAL' && providerKind === 'EXTERNAL_MODULE')
		return {
			disposition: 'AGREE_TARGET_CLASS',
			rationale:
				'Both providers classify the relation as external; no shared external artifact identity is claimed.'
		};
	if (
		['AMBIENT', 'EXTERNAL'].includes(compilerKind) &&
		['CORE_MODULE', 'EXTERNAL_MODULE', 'RESOLVED_LOCAL_PATH'].includes(providerKind)
	)
		return {
			disposition: 'PRESENCE_ONLY_TARGET_MODEL_DIFFERENT',
			rationale:
				'Both providers observe the relation, but their ambient/runtime target models are not identity-equivalent.'
		};
	return {
		disposition: 'INCOMPARABLE_RESOLUTION_CONTEXT',
		rationale:
			'Target-class differences are retained, but the provider ontologies lack a qualified identity mapping.'
	};
}

function decideDisposition(
	group: MutableComparisonGroup,
	summary: TargetSummary,
	sourceWasCruised: boolean,
	sourceBindingAmbiguous: boolean,
	providerHealthy: boolean,
	providerBaseMappingQualified: boolean
): DispositionDecision {
	if (group.compilerEdges.length === 0)
		return decideUnmatchedProviderRelation(group, providerHealthy);
	if (group.providerDependencies.length === 0)
		return decideUnmatchedCompilerRelation(
			group,
			sourceWasCruised,
			sourceBindingAmbiguous,
			providerHealthy
		);

	if (aggregateTargetsAreAmbiguous(summary))
		return {
			disposition: 'AMBIGUOUS_AGGREGATE',
			rationale:
				'At least one aggregate contains multiple target states or identities; no target was selected.'
		};

	const compilerKind = summary.compilerKinds[0]!;
	const providerKind = summary.providerKinds[0]!;
	if (compilerKind === 'UNSUPPORTED')
		return {
			disposition: 'INCOMPARABLE_PROVIDER_DOMAIN',
			rationale: 'The compiler explicitly marked this module occurrence unsupported.'
		};
	if (compilerKind === 'LOCAL' && providerKind === 'RESOLVED_LOCAL_PATH')
		return decideLocalTargetRelation(group, summary, providerBaseMappingQualified);
	return decideTargetClassRelation(compilerKind, providerKind);
}

function comparisonRecordId(
	contextDigest: string,
	key: DependencyProviderComparisonKey
): DependencyProviderComparisonRecordId {
	return `dependency-comparison-record:${sha256(
		canonicalSemanticJson({ contextDigest, key })
	)}` as DependencyProviderComparisonRecordId;
}

function buildCompilerEvidence(
	edges: readonly ModuleDependencyGraphEdge[],
	nodeById: ReadonlyMap<string, ModuleDependencyGraphSnapshot['nodes'][number]>
): CompilerDependencyComparisonEvidence {
	return {
		edgeIds: uniqueSorted(edges.map((edge) => edge.id)),
		occurrenceCount: edges.length,
		relationKinds: uniqueSorted(
			edges.map((edge) => edge.relationKind)
		) as CompilerDependencyComparisonEvidence['relationKinds'],
		resolutionStates: uniqueSorted(
			edges.map((edge) => edge.resolutionState)
		) as CompilerDependencyComparisonEvidence['resolutionStates'],
		targetLogicalPaths: uniqueSorted(
			edges.flatMap((edge) => {
				const target = nodeById.get(edge.target.nodeId);
				return target?.kind === 'SOURCE' ? [target.logicalPath] : [];
			})
		),
		targetNodeIds: uniqueSorted(edges.map((edge) => edge.target.nodeId))
	};
}

function buildProviderEvidence(
	dependencies: readonly DependencyCruiserDependencyObservation[]
): DependencyCruiserDependencyComparisonEvidence {
	return {
		dependencyIds: uniqueSorted(dependencies.map((dependency) => dependency.id)),
		dependencyTypes: uniqueSorted(dependencies.flatMap((dependency) => dependency.dependencyTypes)),
		rowCount: dependencies.length,
		targetKinds: uniqueSorted(
			dependencies.map((dependency) => dependency.target.kind)
		) as DependencyCruiserDependencyComparisonEvidence['targetKinds'],
		targetLogicalPaths: uniqueSorted(
			dependencies.flatMap((dependency) =>
				dependency.target.kind === 'RESOLVED_LOCAL_PATH' ? [dependency.target.path] : []
			)
		)
	};
}

function comparisonContentDigest(
	comparison: Omit<DependencyProviderComparisonSnapshot, 'contentDigest'>
): string {
	return sha256(canonicalSemanticJson(comparison));
}

function inputShapeOutcome(
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyProviderComparisonOutcome | null {
	const requestDiagnostics = validateRequest(request);
	if (requestDiagnostics.length > 0)
		return { diagnostics: requestDiagnostics, outcome: 'unavailable' };
	if (!isRecord(semanticSnapshot) || !isRecord(graph))
		return {
			diagnostics: [
				{
					code: 'GRAPH_INVALID',
					message: 'Semantic snapshot and graph must be objects.',
					path: '$inputs'
				}
			],
			outcome: 'unavailable'
		};
	if (!isRecord(observation))
		return {
			diagnostics: [
				{
					code: 'OBSERVATION_INVALID',
					message: 'Dependency-cruiser observation must be an object.',
					path: '$observation'
				}
			],
			outcome: 'unavailable'
		};
	return null;
}

function identityMismatchOutcome(
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyProviderComparisonOutcome | null {
	const identityDiagnostics: DependencyProviderComparisonDiagnostic[] = [];
	const mismatch = (message: string, path: string): void => {
		if (identityDiagnostics.length < request.budgets.maxDiagnostics)
			identityDiagnostics.push({ code: 'IDENTITY_MISMATCH', message, path });
	};
	if (request.subjectId !== graph.subjectId || request.subjectId !== observation.subjectId)
		mismatch(
			'Request, graph, and provider observation subject identities must match.',
			'$request.subjectId'
		);
	if (request.graphId !== graph.id)
		mismatch('Request graphId does not match the graph.', '$request.graphId');
	if (
		request.semanticSnapshotId !== graph.semanticSnapshotId ||
		request.semanticSnapshotId !== semanticSnapshot.id
	)
		mismatch(
			'Request, graph, and semantic snapshot identities must match.',
			'$request.semanticSnapshotId'
		);
	if (request.dependencyCruiserObservationId !== observation.id)
		mismatch(
			'Request observation identity does not match the provider observation.',
			'$request.dependencyCruiserObservationId'
		);
	if (identityDiagnostics.length > 0)
		return { diagnostics: identityDiagnostics, outcome: 'unavailable' };
	return null;
}

function snapshotValidationOutcome(
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyProviderComparisonOutcome | null {
	const graphValidation = validateModuleDependencyGraph(graph, semanticSnapshot, {
		maxIssues: request.budgets.maxDiagnostics
	});
	if (graphValidation.state !== 'VALID')
		return {
			diagnostics: graphValidation.issues.slice(0, request.budgets.maxDiagnostics).map((issue) => ({
				code: 'GRAPH_INVALID' as const,
				message: issue.message,
				path: issue.path
			})),
			outcome: 'unavailable'
		};
	const observationValidation = validateDependencyCruiserObservation(observation, {
		maxIssues: request.budgets.maxDiagnostics
	});
	if (observationValidation.state !== 'VALID')
		return {
			diagnostics: observationValidation.issues
				.slice(0, request.budgets.maxDiagnostics)
				.map((issue) => ({
					code: 'OBSERVATION_INVALID' as const,
					message: issue.message,
					path: issue.path
				})),
			outcome: 'unavailable'
		};
	return null;
}

function buildSourcesByPath(
	graph: ModuleDependencyGraphSnapshot
): Map<string, ModuleDependencyGraphSourceNode[]> {
	const sourcesByPath = new Map<string, ModuleDependencyGraphSourceNode[]>();
	for (const node of graph.nodes) {
		if (node.kind !== 'SOURCE') continue;
		const sources = sourcesByPath.get(node.logicalPath) ?? [];
		sources.push(node);
		sourcesByPath.set(node.logicalPath, sources);
	}
	return sourcesByPath;
}

function compilerGroupKey(
	edge: ModuleDependencyGraphEdge,
	source: ModuleDependencyGraphSourceNode
): DependencyProviderComparisonKey {
	return {
		importerBinding: 'EXACT_GRAPH_SOURCE',
		importerSemanticSourceId: source.semanticSourceId,
		moduleSystem: compilerModuleSystem(edge),
		normalizedSpecifier: edge.specifier === null ? null : normalizeSpecifier(edge.specifier),
		sourcePath: source.logicalPath,
		typeOnlyPartition: 'COARSENED_NOT_COMPARED'
	};
}

function importerBindingFor(
	sources: readonly ModuleDependencyGraphSourceNode[]
): DependencyProviderComparisonKey['importerBinding'] {
	if (sources.length === 0) return 'NO_GRAPH_SOURCE';
	if (sources.length === 1) return 'EXACT_GRAPH_SOURCE';
	return 'AMBIGUOUS_GRAPH_SOURCES';
}

function providerGroupKey(
	dependency: DependencyCruiserDependencyObservation,
	sources: readonly ModuleDependencyGraphSourceNode[]
): DependencyProviderComparisonKey {
	return {
		importerBinding: importerBindingFor(sources),
		importerSemanticSourceId: sources.length === 1 ? sources[0]!.semanticSourceId : null,
		moduleSystem: providerModuleSystem(dependency),
		normalizedSpecifier: normalizeSpecifier(dependency.moduleSpecifier),
		sourcePath: dependency.sourcePath,
		typeOnlyPartition: 'COARSENED_NOT_COMPARED'
	};
}

function collectCompilerGroups(
	edges: readonly ModuleDependencyGraphEdge[],
	nodeById: ReadonlyMap<string, ModuleDependencyGraphSnapshot['nodes'][number]>,
	groupFor: (key: DependencyProviderComparisonKey) => MutableComparisonGroup | undefined
): void {
	for (const edge of edges) {
		const source = nodeById.get(edge.source.nodeId);
		if (source?.kind !== 'SOURCE') continue;
		const group = groupFor(compilerGroupKey(edge, source));
		if (!group) break;
		group.compilerEdges.push(edge);
	}
}

function collectProviderGroups(
	dependencies: readonly DependencyCruiserDependencyObservation[],
	sourcesByPath: ReadonlyMap<string, ModuleDependencyGraphSourceNode[]>,
	groupFor: (key: DependencyProviderComparisonKey) => MutableComparisonGroup | undefined
): void {
	for (const dependency of dependencies) {
		const sources = sourcesByPath.get(dependency.sourcePath) ?? [];
		const group = groupFor(providerGroupKey(dependency, sources));
		if (!group) break;
		group.providerDependencies.push(dependency);
	}
}

function buildComparisonGroups(
	request: CompareDependencyProvidersRequest,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	nodeById: ReadonlyMap<string, ModuleDependencyGraphSnapshot['nodes'][number]>,
	sourcesByPath: ReadonlyMap<string, ModuleDependencyGraphSourceNode[]>
): { budgetExceeded: boolean; groups: Map<string, MutableComparisonGroup> } {
	const groups = new Map<string, MutableComparisonGroup>();
	let comparisonBudgetExceeded = false;
	const groupFor = (key: DependencyProviderComparisonKey): MutableComparisonGroup | undefined => {
		const text = keyText(key);
		const existing = groups.get(text);
		if (existing) return existing;
		if (groups.size >= request.budgets.maxComparisonRecords) {
			comparisonBudgetExceeded = true;
			return undefined;
		}
		const created = { compilerEdges: [], key, providerDependencies: [] };
		groups.set(text, created);
		return created;
	};
	collectCompilerGroups(graph.edges, nodeById, groupFor);
	if (!comparisonBudgetExceeded)
		collectProviderGroups(observation.dependencies, sourcesByPath, groupFor);
	return { budgetExceeded: comparisonBudgetExceeded, groups };
}

function buildLimitations(
	records: readonly DependencyProviderComparisonRecord[],
	request: CompareDependencyProvidersRequest
): DependencyProviderComparisonLimitation[] {
	const limitations: DependencyProviderComparisonLimitation[] = [
		{
			affectedRecordCount: records.filter((record) => record.assessment === 'OBSERVED_DIFFERENCE')
				.length,
			kind: 'CONFLICT_QUALIFICATION_UNAVAILABLE',
			rationale:
				'This contract has no validated context-equivalence or closed-perimeter attestation, so observed differences cannot become conflicts.'
		},
		{
			affectedRecordCount: records.filter(
				(record) => record.compiler.occurrenceCount > 0 && record.dependencyCruiser.rowCount > 0
			).length,
			kind: 'PROVIDER_AGGREGATES_OCCURRENCES',
			rationale:
				'dependency-cruiser dependency rows aggregate syntax occurrences and never replace compiler occurrence edges.'
		},
		{
			affectedRecordCount: records.length,
			kind: 'TYPE_ONLY_PARTITION_NOT_REPRODUCED',
			rationale:
				"The current compiler graph does not reproduce dependency-cruiser's element-level type-only partition, so comparison uses a coarser key."
		}
	];
	limitations.push({
		affectedRecordCount: records.filter(
			(record) => record.disposition === 'INCOMPARABLE_RESOLUTION_CONTEXT'
		).length,
		kind: 'RESOLUTION_CONTEXT_NOT_PROVEN_EQUIVALENT',
		rationale: request.resolutionContext.rationale
	});
	limitations.push({
		affectedRecordCount: records.filter(
			(record) => record.compiler.occurrenceCount === 0 || record.dependencyCruiser.rowCount === 0
		).length,
		kind: 'NEGATIVE_COVERAGE_NOT_CLOSED',
		rationale: request.negativeCoverage.rationale
	});
	const providerDomainCount = records.filter(
		(record) => record.disposition === 'INCOMPARABLE_PROVIDER_DOMAIN'
	).length;
	if (providerDomainCount > 0)
		limitations.push({
			affectedRecordCount: providerDomainCount,
			kind: 'PROVIDER_DOMAIN_OUTSIDE_COMPILER_GRAPH',
			rationale:
				'Some dependency-cruiser dependency kinds or compiler non-literal occurrences are outside the current graph overlap.'
		});
	const targetModelCount = records.filter(
		(record) => record.disposition === 'PRESENCE_ONLY_TARGET_MODEL_DIFFERENT'
	).length;
	if (targetModelCount > 0)
		limitations.push({
			affectedRecordCount: targetModelCount,
			kind: 'TARGET_MODEL_DIFFERENCE',
			rationale:
				'Compiler ambient/external targets and dependency-cruiser runtime/core targets do not share an exact artifact identity.'
		});
	limitations.sort((left, right) => compareText(left.kind, right.kind));
	return limitations;
}

function rationaleBudgetExceeded(
	records: readonly DependencyProviderComparisonRecord[],
	limitations: readonly DependencyProviderComparisonLimitation[],
	maxRationaleCharacters: number
): boolean {
	return (
		records.some((record) => record.rationale.length > maxRationaleCharacters) ||
		limitations.some((limitation) => limitation.rationale.length > maxRationaleCharacters)
	);
}

export function compareDependencyProviders(
	request: CompareDependencyProvidersRequest,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyProviderComparisonOutcome {
	const inputFailure = inputShapeOutcome(request, semanticSnapshot, graph, observation);
	if (inputFailure !== null) return inputFailure;

	const identityFailure = identityMismatchOutcome(request, semanticSnapshot, graph, observation);
	if (identityFailure !== null) return identityFailure;

	const snapshotFailure = snapshotValidationOutcome(request, semanticSnapshot, graph, observation);
	if (snapshotFailure !== null) return snapshotFailure;

	const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
	const sourcesByPath = buildSourcesByPath(graph);
	const { budgetExceeded, groups } = buildComparisonGroups(
		request,
		graph,
		observation,
		nodeById,
		sourcesByPath
	);

	if (budgetExceeded)
		return {
			diagnostics: [
				{
					code: 'BUDGET_EXCEEDED',
					message: `Comparison requires more than maxComparisonRecords ${request.budgets.maxComparisonRecords}; construction stopped at the first excess group.`,
					path: '$request.budgets.maxComparisonRecords'
				}
			],
			outcome: 'unavailable'
		};

	const comparisonContextDigest = sha256(
		canonicalSemanticJson({
			graphContentDigest: graph.contentDigest,
			graphId: graph.id,
			method: DEPENDENCY_PROVIDER_COMPARISON_METHOD,
			negativeCoverage: request.negativeCoverage,
			observationContentDigest: observation.contentDigest,
			observationId: observation.id,
			resolutionContext: request.resolutionContext,
			semanticSnapshotId: semanticSnapshot.id,
			subjectId: request.subjectId
		})
	);
	const cruisedSources = new Set(observation.modules.map((module) => module.sourcePath));
	const providerBaseMappingQualified = !observation.limitations.some(
		(limitation) => String(limitation.code) === 'PROVIDER_BASE_DIR_MAPPING_UNVERIFIED'
	);
	const records: DependencyProviderComparisonRecord[] = [...groups.values()]
		.sort((left, right) => compareText(keyText(left.key), keyText(right.key)))
		.map((group) => {
			const compilerSummary = compilerTargetSummary(group.compilerEdges, nodeById);
			const providerSummary = providerTargetSummary(group.providerDependencies);
			const decision = decideDisposition(
				group,
				{ ...compilerSummary, ...providerSummary },
				cruisedSources.has(group.key.sourcePath),
				(sourcesByPath.get(group.key.sourcePath)?.length ?? 0) > 1,
				observation.health === 'COMPLETE',
				providerBaseMappingQualified
			);
			return {
				assessment: assessmentFor(decision.disposition),
				compiler: buildCompilerEvidence(group.compilerEdges, nodeById),
				dependencyCruiser: buildProviderEvidence(group.providerDependencies),
				disposition: decision.disposition,
				id: comparisonRecordId(comparisonContextDigest, group.key),
				key: group.key,
				rationale: decision.rationale
			};
		});

	const count = (assessment: DependencyProviderComparisonAssessment): number =>
		records.filter((record) => record.assessment === assessment).length;
	const compilerEdgesRepresented = records.reduce(
		(total, record) => total + record.compiler.occurrenceCount,
		0
	);
	const dependencyCruiserDependenciesRepresented = records.reduce(
		(total, record) => total + record.dependencyCruiser.rowCount,
		0
	);
	const limitations = buildLimitations(records, request);
	if (rationaleBudgetExceeded(records, limitations, request.budgets.maxRationaleCharacters))
		return {
			diagnostics: [
				{
					code: 'BUDGET_EXCEEDED',
					message: 'A derived rationale exceeds maxRationaleCharacters.',
					path: '$request.budgets.maxRationaleCharacters'
				}
			],
			outcome: 'unavailable'
		};

	const id = `dependency-provider-comparison:${sha256(
		canonicalSemanticJson({
			canonicalProfile: DEPENDENCY_PROVIDER_COMPARISON_CANONICAL_PROFILE,
			comparisonContextDigest,
			operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
			schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_SCHEMA_VERSION
		})
	)}` as DependencyProviderComparisonId;
	const content: Omit<DependencyProviderComparisonSnapshot, 'contentDigest'> = {
		canonicalProfile: DEPENDENCY_PROVIDER_COMPARISON_CANONICAL_PROFILE,
		comparisonContextDigest,
		coverage: {
			agreementRecords: count('AGREEMENT'),
			compilerEdgesRepresented,
			compilerEdgesTotal: graph.edges.length,
			corroborationRecords: count('CORROBORATION'),
			dependencyCruiserDependenciesRepresented,
			dependencyCruiserDependenciesTotal: observation.dependencies.length,
			incomparableRecords: count('INCOMPARABLE'),
			observedDifferenceRecords: count('OBSERVED_DIFFERENCE'),
			reconciles:
				compilerEdgesRepresented === graph.edges.length &&
				dependencyCruiserDependenciesRepresented === observation.dependencies.length,
			recordCount: records.length
		},
		dependencyCruiserObservationId: observation.id,
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		graphId: graph.id,
		health: 'PARTIAL',
		id,
		limitations,
		method: DEPENDENCY_PROVIDER_COMPARISON_METHOD,
		negativeCoverage: request.negativeCoverage,
		operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
		records,
		resolutionContext: request.resolutionContext,
		schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: request.subjectId
	};
	const comparison: DependencyProviderComparisonSnapshot = {
		...content,
		contentDigest: comparisonContentDigest(content)
	};
	return {
		comparison,
		diagnostics: [],
		outcome: 'partial'
	};
}
