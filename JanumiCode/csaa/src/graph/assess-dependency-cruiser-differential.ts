import {
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	type CompareDependencyProvidersRequest,
	type DependencyProviderComparisonBudgets,
	type DependencyProviderComparisonSnapshot
} from '../contracts/dependency-comparison.js';
import type { DependencyCruiserObservation } from '../contracts/dependency-cruiser.js';
import type { ModuleDependencyGraphSnapshot } from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateDependencyCruiserObservation } from '../providers/dependency-cruiser/normalize-output.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { compareDependencyProviders } from './compare-dependency-providers.js';
import { validateDependencyProviderComparison } from './validate-dependency-comparison.js';

export const DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION =
	'jan-csaa-dependency-cruiser-differential-acceptance-request/0.1.0' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_SCHEMA_VERSION =
	'jan-csaa-dependency-cruiser-differential-acceptance/0.1.0' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION =
	'jan-csaa-assess-dependency-cruiser-differential/0.1.0' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_STATUS = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY =
	'REVIEWED_DIFFERENTIAL_EVIDENCE_ONLY' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT = 'NONE' as const;
export const DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS = Object.freeze([
	'ARCHITECTURE_RULE_COMPLIANCE',
	'CONTEXT_EQUIVALENCE',
	'FULL_DWP_004_COMPLETION',
	'G4_PASS',
	'NEGATIVE_COVERAGE_CLOSED',
	'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION',
	'PROVIDER_AUTHORITY',
	'PROVIDER_QUALIFICATION',
	'REPOSITORY_CURRENTNESS'
] as const);

const SUPPORTED_LIMITATIONS = new Set([
	'DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED',
	'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED',
	'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY',
	'SUMMARY_VIOLATIONS_DIGEST_ONLY'
]);

export interface DependencyCruiserDifferentialAcceptanceBudgets {
	readonly comparison: DependencyProviderComparisonBudgets;
	readonly maxResultBytes: number;
}

export interface DependencyCruiserDifferentialAcceptanceRequest {
	readonly budgets: DependencyCruiserDifferentialAcceptanceBudgets;
	readonly configPath: string;
	/** Null is a fail-closed discovery request that returns a reviewable digest but never accepts. */
	readonly expectedDifferentialDigest: string | null;
	readonly expectedInputPaths: readonly string[];
	readonly operationVersion: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION;
	readonly schemaVersion: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION;
}

export interface DependencyCruiserDifferentialEvidence {
	readonly acceptanceState:
		'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL' | 'BASELINE_REQUIRED' | 'DIFFERENTIAL_DRIFT';
	readonly authority: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY;
	readonly capabilityStatus: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_STATUS;
	readonly comparison: DependencyProviderComparisonSnapshot;
	readonly configWitness: {
		readonly capturedArtifactSha256: string;
		readonly observationSha256: string;
		readonly path: string;
		readonly state: 'EXACT_CAPTURED_MATCH';
	};
	readonly contentDigest: string;
	readonly coverage: {
		readonly compilerEdges: number;
		readonly comparisonRecords: number;
		readonly dependencyCruiserDependencies: number;
		readonly expectedInputPaths: number;
		readonly observedDifferenceRecords: number;
		readonly providerModules: number;
		readonly reconciles: true;
	};
	readonly currentness: {
		readonly basis: 'FROZEN_SUBJECT_CAPTURE_AND_BOUND_PROVIDER_INVOCATION';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT_ONLY';
	};
	readonly differentialDigest: string;
	readonly expectedDifferentialDigest: string | null;
	readonly gateEffect: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT;
	readonly graph: {
		readonly contentDigest: string;
		readonly graphId: string;
		readonly semanticSnapshotId: string;
	};
	readonly nonclaims: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS;
	readonly observation: {
		readonly contentDigest: string;
		readonly id: string;
		readonly invocationDigest: string;
		readonly limitations: readonly string[];
		readonly providerSemanticDigest: string;
	};
	readonly perimeterWitness: {
		readonly expectedInputPaths: readonly string[];
		readonly state: 'EXACT_INVOCATION_MATCH';
	};
	readonly schemaVersion: typeof DEPENDENCY_CRUISER_DIFFERENTIAL_SCHEMA_VERSION;
	readonly subjectId: string;
	readonly wireShape: 'CLOSED_EXACT';
}

export type DependencyCruiserDifferentialDiagnosticCode =
	| 'BASELINE_REQUIRED'
	| 'CONFIG_DRIFT'
	| 'DIFFERENTIAL_DRIFT'
	| 'EMPTY_REQUIRED_POPULATION'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_PERIMETER_DRIFT'
	| 'REQUEST_INVALID'
	| 'SOURCE_INVALID'
	| 'UNSUPPORTED_OBSERVATION_SURFACE';

export interface DependencyCruiserDifferentialDiagnostic {
	readonly code: DependencyCruiserDifferentialDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'ACCEPT' | 'COMPARE' | 'REQUEST' | 'VALIDATE';
}

export type DependencyCruiserDifferentialOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly evidence: DependencyCruiserDifferentialEvidence & {
				readonly acceptanceState: 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL';
			};
			readonly outcome: 'accepted';
	  }
	| {
			readonly diagnostics: readonly [DependencyCruiserDifferentialDiagnostic];
			readonly evidence: DependencyCruiserDifferentialEvidence & {
				readonly acceptanceState: 'BASELINE_REQUIRED' | 'DIFFERENTIAL_DRIFT';
			};
			readonly outcome: 'rejected';
	  }
	| {
			readonly diagnostics: readonly [DependencyCruiserDifferentialDiagnostic];
			readonly evidence?: never;
			readonly outcome: 'unavailable';
	  };

const REQUEST_KEYS = [
	'budgets',
	'configPath',
	'expectedDifferentialDigest',
	'expectedInputPaths',
	'operationVersion',
	'schemaVersion'
] as const;
const BUDGET_KEYS = ['comparison', 'maxResultBytes'] as const;
const COMPARISON_BUDGET_KEYS = [
	'maxComparisonRecords',
	'maxDiagnostics',
	'maxRationaleCharacters'
] as const;
const SHA256 = /^[0-9a-f]{64}$/u;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Reflect.ownKeys(value).every((key) => typeof key === 'string') &&
		Reflect.ownKeys(value).length === keys.length &&
		keys.every((key) => Object.prototype.propertyIsEnumerable.call(value, key)) &&
		Object.keys(value).every((key) => keys.includes(key))
	);
}

function validPath(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		!value.startsWith('/') &&
		!value.endsWith('/') &&
		!value.includes('\\') &&
		!value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
	);
}

function positiveInteger(value: unknown, maximum: number): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value > 0 &&
		value <= maximum &&
		!Object.is(value, -0)
	);
}

function canonicalPaths(value: unknown): readonly string[] | null {
	if (!Array.isArray(value) || value.length === 0 || value.some((path) => !validPath(path)))
		return null;
	const sorted = [...value].sort(compareText);
	if (sorted.some((path, index) => index > 0 && path === sorted[index - 1])) return null;
	return canonicalSemanticJson(value) === canonicalSemanticJson(sorted) ? sorted : null;
}

function parseRequest(value: unknown): DependencyCruiserDifferentialAcceptanceRequest | null {
	if (!exactRecord(value, REQUEST_KEYS) || !exactRecord(value.budgets, BUDGET_KEYS)) return null;
	if (!exactRecord(value.budgets.comparison, COMPARISON_BUDGET_KEYS)) return null;
	const comparison = value.budgets.comparison;
	const paths = canonicalPaths(value.expectedInputPaths);
	if (
		value.schemaVersion !== DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION ||
		value.operationVersion !== DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION ||
		!validPath(value.configPath) ||
		paths === null ||
		(value.expectedDifferentialDigest !== null &&
			(typeof value.expectedDifferentialDigest !== 'string' ||
				!SHA256.test(value.expectedDifferentialDigest))) ||
		!positiveInteger(comparison.maxComparisonRecords, 10_000_000) ||
		!positiveInteger(comparison.maxDiagnostics, 100_000) ||
		!positiveInteger(comparison.maxRationaleCharacters, 1_000_000) ||
		!positiveInteger(value.budgets.maxResultBytes, 1_000_000_000)
	)
		return null;
	return value as unknown as DependencyCruiserDifferentialAcceptanceRequest;
}

function diagnostic(
	code: DependencyCruiserDifferentialDiagnosticCode,
	message: string,
	phase: DependencyCruiserDifferentialDiagnostic['phase'],
	path: string | null = null
): DependencyCruiserDifferentialDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: DependencyCruiserDifferentialDiagnosticCode,
	message: string,
	phase: DependencyCruiserDifferentialDiagnostic['phase'],
	path: string | null = null
): DependencyCruiserDifferentialOutcome {
	return deepFreeze({
		diagnostics: [diagnostic(code, message, phase, path)],
		outcome: 'unavailable'
	});
}

function under(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

function providerBaseMappingIsBound(observation: DependencyCruiserObservation): boolean {
	const reported = observation.invocation.providerReportedBaseDir;
	if (reported.state !== 'PRESENT') return false;
	if (reported.representation === 'ABSOLUTE')
		return (
			reported.sha256 === observation.invocation.subjectRoot.sha256 &&
			reported.bytes === observation.invocation.subjectRoot.bytes
		);
	return reported.sha256 === sha256(observation.invocation.baseDir);
}

function comparisonRequest(
	budgets: DependencyProviderComparisonBudgets,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): CompareDependencyProvidersRequest {
	return {
		budgets,
		dependencyCruiserObservationId: observation.id,
		graphId: graph.id,
		negativeCoverage: {
			rationale:
				'This implementation-local harness does not carry a separately validated closed-perimeter attestation.',
			state: 'OPEN'
		},
		operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
		resolutionContext: {
			compilerContextDigest: sha256(
				canonicalSemanticJson({
					graph: graph.contentDigest,
					semanticContext: semanticSnapshot.contextDigest,
					semanticSnapshotId: semanticSnapshot.id
				})
			),
			providerContextDigest: sha256(
				canonicalSemanticJson({
					config: observation.invocation.config,
					inputPaths: observation.invocation.inputPaths,
					optionsDigest: observation.summary.optionsDigest,
					provider: observation.invocation.provider
				})
			),
			rationale:
				'Compiler and dependency-cruiser contexts are digest-bound but not proven equivalent by this harness.',
			state: 'UNKNOWN'
		},
		schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: graph.subjectId
	};
}

function providerSemanticProjection(observation: DependencyCruiserObservation): unknown {
	return {
		dependencies: observation.dependencies.map(
			({ id: _id, sourceModuleId: _sourceModuleId, ...dependency }) => dependency
		),
		invocation: {
			baseDir: observation.invocation.baseDir,
			command: {
				args: observation.invocation.command.args,
				exitStatus: observation.invocation.command.exitStatus
			},
			config: observation.invocation.config,
			inputPaths: observation.invocation.inputPaths,
			provider: observation.invocation.provider,
			providerReportedBaseDir: observation.invocation.providerReportedBaseDir,
			subjectRoot: observation.invocation.subjectRoot
		},
		limitations: observation.limitations,
		modules: observation.modules.map(
			({ dependencyIds: _dependencyIds, id: _id, ...module }) => module
		),
		nonLocalModules: observation.nonLocalModules.map(({ id: _id, ...module }) => module),
		reverseLinks: observation.reverseLinks.map(
			({ dependencyIds: _dependencyIds, ...link }) => link
		),
		summary: observation.summary
	};
}

function comparisonSemanticProjection(comparison: DependencyProviderComparisonSnapshot): unknown {
	return {
		coverage: comparison.coverage,
		limitations: comparison.limitations,
		negativeCoverage: comparison.negativeCoverage,
		records: comparison.records.map((record) => ({
			assessment: record.assessment,
			compiler: record.compiler,
			dependencyCruiser: {
				dependencyTypes: record.dependencyCruiser.dependencyTypes,
				rowCount: record.dependencyCruiser.rowCount,
				targetKinds: record.dependencyCruiser.targetKinds,
				targetLogicalPaths: record.dependencyCruiser.targetLogicalPaths
			},
			disposition: record.disposition,
			key: record.key,
			rationale: record.rationale
		})),
		resolutionContext: {
			rationale: comparison.resolutionContext.rationale,
			state: comparison.resolutionContext.state
		}
	};
}

export function dependencyCruiserDifferentialSemanticDigest(
	comparison: DependencyProviderComparisonSnapshot,
	observation: DependencyCruiserObservation,
	graph: ModuleDependencyGraphSnapshot
): { readonly differentialDigest: string; readonly providerSemanticDigest: string } {
	const providerSemanticDigest = sha256(
		canonicalSemanticJson(providerSemanticProjection(observation))
	);
	return {
		differentialDigest: dependencyCruiserDifferentialDigestFromComponents(
			comparison,
			graph.contentDigest,
			providerSemanticDigest
		),
		providerSemanticDigest
	};
}

/** Recomputes the reviewed semantic identity from the complete persisted comparison projection. */
export function dependencyCruiserDifferentialDigestFromComponents(
	comparison: DependencyProviderComparisonSnapshot,
	graphContentDigest: string,
	providerSemanticDigest: string
): string {
	return sha256(
		canonicalSemanticJson({
			comparison: comparisonSemanticProjection(comparison),
			graphContentDigest,
			providerSemanticDigest
		})
	);
}

function evidenceContentDigest(
	value: Omit<DependencyCruiserDifferentialEvidence, 'contentDigest'>
): string {
	return sha256(canonicalSemanticJson(value));
}

function buildEvidence(
	state: DependencyCruiserDifferentialEvidence['acceptanceState'],
	request: DependencyCruiserDifferentialAcceptanceRequest,
	frozenSubject: FrozenSubject,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	comparison: DependencyProviderComparisonSnapshot,
	configSha256: string
): DependencyCruiserDifferentialEvidence {
	const digests = dependencyCruiserDifferentialSemanticDigest(comparison, observation, graph);
	const content: Omit<DependencyCruiserDifferentialEvidence, 'contentDigest'> = {
		acceptanceState: state,
		authority: DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY,
		capabilityStatus: DEPENDENCY_CRUISER_DIFFERENTIAL_STATUS,
		comparison,
		configWitness: {
			capturedArtifactSha256: configSha256,
			observationSha256: observation.invocation.config.sha256,
			path: request.configPath,
			state: 'EXACT_CAPTURED_MATCH'
		},
		coverage: {
			compilerEdges: graph.edges.length,
			comparisonRecords: comparison.records.length,
			dependencyCruiserDependencies: observation.dependencies.length,
			expectedInputPaths: request.expectedInputPaths.length,
			observedDifferenceRecords: comparison.coverage.observedDifferenceRecords,
			providerModules: observation.modules.length,
			reconciles: true
		},
		currentness: {
			basis: 'FROZEN_SUBJECT_CAPTURE_AND_BOUND_PROVIDER_INVOCATION',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT_ONLY'
		},
		differentialDigest: digests.differentialDigest,
		expectedDifferentialDigest: request.expectedDifferentialDigest,
		gateEffect: DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT,
		graph: {
			contentDigest: graph.contentDigest,
			graphId: graph.id,
			semanticSnapshotId: graph.semanticSnapshotId
		},
		nonclaims: DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS,
		observation: {
			contentDigest: observation.contentDigest,
			id: observation.id,
			invocationDigest: observation.invocationDigest,
			limitations: observation.limitations.map((limitation) => limitation.code).sort(compareText),
			providerSemanticDigest: digests.providerSemanticDigest
		},
		perimeterWitness: {
			expectedInputPaths: request.expectedInputPaths,
			state: 'EXACT_INVOCATION_MATCH'
		},
		schemaVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_SCHEMA_VERSION,
		subjectId: frozenSubject.descriptor.subjectId,
		wireShape: 'CLOSED_EXACT'
	};
	return { ...content, contentDigest: evidenceContentDigest(content) };
}

function inputAcceptanceFailure(
	request: DependencyCruiserDifferentialAcceptanceRequest,
	frozenSubject: FrozenSubject,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyCruiserDifferentialOutcome | { readonly configSha256: string } {
	if (
		frozenSubject?.descriptor?.subjectId !== semanticSnapshot?.subjectId ||
		semanticSnapshot?.subjectId !== graph?.subjectId ||
		graph?.subjectId !== observation?.subjectId ||
		semanticSnapshot?.id !== graph?.semanticSnapshotId
	)
		return unavailable(
			'IDENTITY_MISMATCH',
			'Frozen subject, semantic snapshot, module graph, and provider observation identities must match.',
			'VALIDATE',
			'$inputs'
		);
	const observationValidation = validateDependencyCruiserObservation(observation, {
		maxIssues: request.budgets.comparison.maxDiagnostics
	});
	if (observationValidation.state !== 'VALID')
		return unavailable(
			'SOURCE_INVALID',
			observationValidation.issues[0]?.message ?? 'Provider observation validation failed.',
			'VALIDATE',
			observationValidation.issues[0]?.path ?? '$inputs.observation'
		);
	const configArtifacts = frozenSubject.artifacts.filter(
		(artifact) => artifact.path === request.configPath
	);
	if (
		configArtifacts.length !== 1 ||
		observation.invocation.config.path !== request.configPath ||
		observation.invocation.config.sha256 !== configArtifacts[0]!.sha256
	)
		return unavailable(
			'CONFIG_DRIFT',
			'The provider configuration does not exactly match the selected frozen artifact.',
			'ACCEPT',
			'$inputs.observation.invocation.config'
		);
	if (
		canonicalSemanticJson(observation.invocation.inputPaths) !==
			canonicalSemanticJson(request.expectedInputPaths) ||
		observation.invocation.baseDir !== '.' ||
		!providerBaseMappingIsBound(observation) ||
		request.expectedInputPaths.some(
			(inputPath) =>
				!frozenSubject.workspaces.some(
					(workspace) => under(workspace.path, inputPath) || under(inputPath, workspace.path)
				)
		) ||
		observation.modules.some(
			(module) => !request.expectedInputPaths.some((root) => under(module.sourcePath, root))
		)
	)
		return unavailable(
			'INPUT_PERIMETER_DRIFT',
			'The provider invocation, workspace perimeter, or reported local-module population does not match the expected roots.',
			'ACCEPT',
			'$inputs.observation.invocation'
		);
	const unsupported = observation.limitations.find(
		(limitation) => !SUPPORTED_LIMITATIONS.has(limitation.code)
	);
	if (unsupported !== undefined)
		return unavailable(
			'UNSUPPORTED_OBSERVATION_SURFACE',
			`Provider limitation ${unsupported.code} is outside the accepted differential surface.`,
			'ACCEPT',
			'$inputs.observation.limitations'
		);
	if (
		graph.edges.length === 0 ||
		observation.modules.length === 0 ||
		observation.dependencies.length === 0
	)
		return unavailable(
			'EMPTY_REQUIRED_POPULATION',
			'The compiler edges, provider modules, and provider dependencies must all be nonempty.',
			'ACCEPT',
			'$inputs'
		);
	return { configSha256: configArtifacts[0]!.sha256 };
}

export function assessDependencyCruiserDifferential(
	requestValue: unknown,
	frozenSubject: FrozenSubject,
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation
): DependencyCruiserDifferentialOutcome {
	try {
		const request = parseRequest(requestValue);
		if (request === null)
			return unavailable(
				'REQUEST_INVALID',
				'The request is not an exact supported record.',
				'REQUEST'
			);
		const acceptedInputs = inputAcceptanceFailure(
			request,
			frozenSubject,
			semanticSnapshot,
			graph,
			observation
		);
		if (!('configSha256' in acceptedInputs)) return acceptedInputs;
		const compareRequest = comparisonRequest(
			request.budgets.comparison,
			semanticSnapshot,
			graph,
			observation
		);
		const compared = compareDependencyProviders(
			compareRequest,
			semanticSnapshot,
			graph,
			observation
		);
		if (compared.outcome === 'unavailable')
			return unavailable(
				'SOURCE_INVALID',
				compared.diagnostics[0]?.message ?? 'Dependency-provider comparison was unavailable.',
				'COMPARE',
				compared.diagnostics[0]?.path ?? '$comparison'
			);
		const validation = validateDependencyProviderComparison(
			compared.comparison,
			compareRequest,
			semanticSnapshot,
			graph,
			observation,
			{ maxIssues: request.budgets.comparison.maxDiagnostics }
		);
		if (validation.state !== 'VALID' || !compared.comparison.coverage.reconciles)
			return unavailable(
				'SOURCE_INVALID',
				validation.issues[0]?.message ?? 'The provider comparison population did not reconcile.',
				'COMPARE',
				validation.issues[0]?.path ?? '$comparison'
			);
		if (compared.comparison.records.length === 0)
			return unavailable(
				'EMPTY_REQUIRED_POPULATION',
				'The dependency-provider comparison record population is empty.',
				'ACCEPT',
				'$comparison.records'
			);
		const provisional = buildEvidence(
			'BASELINE_REQUIRED',
			request,
			frozenSubject,
			graph,
			observation,
			compared.comparison,
			acceptedInputs.configSha256
		);
		const state: DependencyCruiserDifferentialEvidence['acceptanceState'] =
			request.expectedDifferentialDigest === null
				? 'BASELINE_REQUIRED'
				: request.expectedDifferentialDigest === provisional.differentialDigest
					? 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL'
					: 'DIFFERENTIAL_DRIFT';
		const evidence = buildEvidence(
			state,
			request,
			frozenSubject,
			graph,
			observation,
			compared.comparison,
			acceptedInputs.configSha256
		);
		if (Buffer.byteLength(canonicalSemanticJson(evidence), 'utf8') > request.budgets.maxResultBytes)
			return unavailable(
				'SOURCE_INVALID',
				'The differential evidence exceeds maxResultBytes.',
				'ACCEPT',
				'$.budgets.maxResultBytes'
			);
		if (state === 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL')
			return deepFreeze({ diagnostics: [], evidence, outcome: 'accepted' }) as Extract<
				DependencyCruiserDifferentialOutcome,
				{ readonly outcome: 'accepted' }
			>;
		const code = state === 'BASELINE_REQUIRED' ? 'BASELINE_REQUIRED' : 'DIFFERENTIAL_DRIFT';
		return deepFreeze({
			diagnostics: [
				diagnostic(
					code,
					state === 'BASELINE_REQUIRED'
						? 'No reviewed semantic differential digest was supplied; evidence was not accepted.'
						: 'The semantic differential digest does not match the reviewed baseline.',
					'ACCEPT',
					'$.expectedDifferentialDigest'
				)
			],
			evidence,
			outcome: 'rejected'
		}) as Extract<DependencyCruiserDifferentialOutcome, { readonly outcome: 'rejected' }>;
	} catch {
		return unavailable(
			'SOURCE_INVALID',
			'The dependency-cruiser differential assessment failed closed on invalid input.',
			'VALIDATE'
		);
	}
}
