import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	type DependencyCruiserInvocationBinding,
	type DependencyCruiserObservation
} from '../contracts/dependency-cruiser.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphBuildOutcome,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type SemanticBudgets,
	type StaticSemanticSnapshot,
	type StaticSemanticSnapshotOutcome
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubjectFreshness,
	type ResolveSubjectRequest,
	type SubjectResolutionOutcome
} from '../contracts/subject.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
	DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION,
	assessDependencyCruiserDifferential,
	dependencyCruiserDifferentialDigestFromComponents,
	type DependencyCruiserDifferentialEvidence
} from './assess-dependency-cruiser-differential.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import { validateModuleDependencyGraph } from './validate-graph.js';
import { normalizeDependencyCruiserOutput } from '../providers/dependency-cruiser/normalize-output.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { resolveSubject } from '../subject/resolve-subject.js';

export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION =
	'jan-csaa-current-dependency-cruiser-differential-request/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-current-dependency-cruiser-differential-evidence/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION =
	'jan-csaa-run-current-dependency-cruiser-differential/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REQUEST_SCHEMA_VERSION =
	'jan-csaa-current-dependency-cruiser-g4-closure-request/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-current-dependency-cruiser-g4-closure-evidence/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION =
	'jan-csaa-run-current-dependency-cruiser-g4-closure/0.1.0' as const;
export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY = 'NONE' as const;
export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT = 'NONE' as const;
export const CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST =
	'702f5a25ee3316c43a4066d3d0cd95bb860950a1a24663b4b43b4c3962a5e355' as const;
export const CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST =
	'b4eddb605074ed4554dbc7999c075a2585c290faf37e9668b104ee5a692fa825' as const;
export const CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH = '.dependency-cruiser.cjs' as const;
export const CURRENT_DEPENDENCY_CRUISER_LOCK_PATH = 'bun.lock' as const;
export const CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH =
	'verif/csaa/dwp-004.current-dependency-cruiser-differential.evidence.json' as const;
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH =
	'verif/csaa/dwp-004.rph-contracts-build-same-perimeter-differential.evidence.json' as const;
export const CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH =
	'node_modules/dependency-cruiser/package.json' as const;
export const CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH =
	'node_modules/dependency-cruiser/bin/dependency-cruise.mjs' as const;
export const CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS = Object.freeze(['apps', 'packages'] as const);
export const CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS = Object.freeze([
	'packages/rph-contracts/tsconfig.build.json'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS = Object.freeze([
	'packages/rph-contracts/src/**'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS = Object.freeze([
	'packages/rph-contracts/src/common.ts',
	'packages/rph-contracts/src/enums.ts',
	'packages/rph-contracts/src/envelopes.ts',
	'packages/rph-contracts/src/errors.ts',
	'packages/rph-contracts/src/hash.ts',
	'packages/rph-contracts/src/ids.ts',
	'packages/rph-contracts/src/index.ts',
	'packages/rph-contracts/src/messages.ts',
	'packages/rph-contracts/src/objects.ts',
	'packages/rph-contracts/src/validate.ts'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_PROVIDER_ARGS = Object.freeze([
	CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH,
	...CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS,
	'--config',
	CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
	'--output-type',
	'json'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_PROVIDER_ARGS = Object.freeze([
	CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH,
	...CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS,
	'--config',
	CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
	'--output-type',
	'json'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS = Object.freeze([
	'APP_COMPILER_PROJECT_CAPTURE',
	'ARCHITECTURE_RULE_COMPLIANCE',
	'COMPILER_PROVIDER_PERIMETER_EQUIVALENCE',
	'CONTEXT_EQUIVALENCE',
	'DECLARATION_CONTEXT_POST_PROVIDER_CURRENTNESS',
	'DIFFERENTIAL_DRIFT_LOCALIZATION_TO_COMPILER_SLICE',
	'FULL_DWP_004_COMPLETION',
	'G4_PASS',
	'HOSTILE_CONFIGURATION_SECURITY_SANDBOX',
	'MULTI_PROJECT_SEMANTIC_CLOSURE',
	'NEGATIVE_COVERAGE_CLOSED',
	'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION',
	'PERSISTENT_OR_CROSS_REVISION_CURRENTNESS',
	'PROVIDER_QUALIFICATION',
	'REPOSITORY_GATE_AUTHORITY',
	'RPH_CONTRACTS_CHECK_TYPES_PROJECT_CLOSURE',
	'TRANSITIVE_PROVIDER_INSTALLATION_CLOSURE',
	'WHOLE_APPS_PACKAGES_COMPILER_CLOSURE',
	'WHOLE_APPS_PACKAGES_FROZEN_SUBJECT_CLOSURE'
] as const);
export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_NONCLAIMS = Object.freeze([
	'ARCHITECTURE_RULE_COMPLIANCE',
	'COMPILER_PROVIDER_RESOLUTION_CONTEXT_EQUIVALENCE',
	'DECLARATION_CONTEXT_POST_PROVIDER_CURRENTNESS',
	'FULL_DWP_004_COMPLETION',
	'G4_REPOSITORY_GATE_ACTIVATION',
	'HOSTILE_CONFIGURATION_SECURITY_SANDBOX',
	'MULTI_PROJECT_SEMANTIC_CLOSURE',
	'NEGATIVE_COVERAGE_BEYOND_EXACT_BUILD_ROOT_AND_RELATION_POPULATIONS',
	'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION',
	'PERSISTENT_OR_CROSS_REVISION_CURRENTNESS',
	'PROVIDER_QUALIFICATION',
	'REPOSITORY_WIDE_G4_PASS',
	'RPH_CONTRACTS_CHECK_TYPES_PROJECT_CLOSURE',
	'TARGET_SEMANTIC_EQUIVALENCE',
	'TRANSITIVE_PROVIDER_INSTALLATION_CLOSURE',
	'WHOLE_APPS_PACKAGES_COMPILER_CLOSURE',
	'WHOLE_APPS_PACKAGES_PROVIDER_DIFFERENTIAL_CLOSURE'
] as const);

export const CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REVIEWED_DIGEST =
	'951c6e3c623feaa898824cf37bb129c633982f688b409f3d985ad2998400d648' as const;

const SHA256 = /^[0-9a-f]{64}$/u;

export interface CurrentDependencyCruiserDifferentialBudgets {
	readonly assessment: {
		readonly maxComparisonRecords: number;
		readonly maxDiagnostics: number;
		readonly maxRationaleCharacters: number;
		readonly maxResultBytes: number;
	};
	readonly maxEvidenceBytes: number;
	readonly maxProcessRssBytes: number;
	readonly maxProviderDependencies: number;
	readonly maxProviderModules: number;
	readonly maxStderrBytes: number;
	readonly maxStdoutBytes: number;
	readonly providerDurationMs: number;
	readonly semantic: SemanticBudgets;
	readonly subject: ResolveSubjectRequest['budgets'];
}

export interface CurrentDependencyCruiserDifferentialRequest {
	readonly budgets: CurrentDependencyCruiserDifferentialBudgets;
	readonly expectedDifferentialDigest: string | null;
	readonly operationVersion: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION;
	readonly rootLocator: string;
	readonly schemaVersion: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION;
}

export interface CurrentDependencyCruiserG4ClosureRequest {
	readonly budgets: CurrentDependencyCruiserDifferentialBudgets;
	/** Null performs discovery only. A reviewed exact closure digest is required for acceptance. */
	readonly expectedClosureDigest: string | null;
	readonly operationVersion: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION;
	readonly rootLocator: string;
	readonly schemaVersion: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REQUEST_SCHEMA_VERSION;
}

export interface CurrentDependencyCruiserExecutorRequest {
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env: Readonly<Record<string, string>>;
	readonly executable: string;
	readonly maxStderrBytes: number;
	readonly maxStdoutBytes: number;
	readonly networkUse: 'NONE';
	readonly shell: false;
	readonly subjectEntryPoints: readonly [];
	readonly timeoutMs: number;
}

export interface CurrentDependencyCruiserExecutorResult {
	readonly errorCode: string | null;
	readonly errorMessage: string | null;
	readonly signal: string | null;
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
	readonly timedOut: boolean;
}

export interface CurrentDependencyCruiserDifferentialDependencies {
	readonly buildGraph?: (
		request: Parameters<typeof buildModuleDependencyGraph>[0],
		snapshot: Parameters<typeof buildModuleDependencyGraph>[1]
	) => ModuleDependencyGraphBuildOutcome;
	readonly buildSemantic?: (
		request: Parameters<typeof buildStaticSemanticSnapshot>[0],
		input: Parameters<typeof buildStaticSemanticSnapshot>[1],
		runtimeOptions?: Parameters<typeof buildStaticSemanticSnapshot>[2]
	) => StaticSemanticSnapshotOutcome;
	readonly clock?: {
		readonly monotonicMs: () => number;
		readonly now: () => Date;
	};
	readonly execute?: (
		request: CurrentDependencyCruiserExecutorRequest
	) => CurrentDependencyCruiserExecutorResult;
	readonly memoryUsage?: () => NodeJS.MemoryUsage;
	readonly resolve?: (request: ResolveSubjectRequest) => SubjectResolutionOutcome;
	readonly validateGraph?: typeof validateModuleDependencyGraph;
	readonly validateSemantic?: typeof validateStaticSemanticSnapshot;
	readonly verifyCurrentness?: (
		subject: Parameters<typeof verifyFrozenSubject>[0],
		options: Parameters<typeof verifyFrozenSubject>[1]
	) => FrozenSubjectFreshness;
}

export interface CurrentDependencyCruiserDifferentialEvidence {
	readonly analysisAuthority: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY;
	readonly capabilityStatus: 'PARTIAL';
	readonly contentDigest: string;
	readonly currentness: {
		readonly changedPaths: readonly [];
		readonly checkedAfterProviderExecution: true;
		readonly checkedAtFinalEvidenceBoundary: true;
		readonly declarationContextState: 'CONTEXT_ONLY_NOT_RECHECKED_AFTER_PROVIDER';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT_AT_PROVIDER_AND_FINAL_BOUNDARIES';
	};
	readonly differential: DependencyCruiserDifferentialEvidence & {
		readonly acceptanceState: 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL';
	};
	readonly discovery: {
		readonly acceptanceState: 'BASELINE_REQUIRED';
		readonly differentialDigest: string;
		readonly evidenceContentDigest: string;
	};
	readonly execution: {
		readonly args: typeof CURRENT_DEPENDENCY_CRUISER_PROVIDER_ARGS;
		readonly durationMs: number;
		readonly executable: typeof CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH;
		readonly exitStatus: number;
		readonly finishedAt: string;
		readonly networkUse: 'NONE';
		readonly shell: false;
		readonly stageOrder: 'PROVIDER_COMPLETE_BEFORE_SEMANTIC_MATERIALIZATION';
		readonly startedAt: string;
		readonly stderr: { readonly bytes: number; readonly sha256: string };
		readonly stdout: { readonly bytes: number; readonly sha256: string };
		readonly subjectEntryPoints: readonly [];
		readonly timeoutMs: number;
	};
	readonly gateEffect: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT;
	readonly graph: {
		readonly contentDigest: string;
		readonly edges: number;
		readonly id: string;
		readonly nodes: number;
		readonly representedModuleResolutions: number;
		readonly representedSources: number;
		readonly reconciles: true;
	};
	readonly nonclaims: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS;
	readonly operationVersion: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION;
	readonly provider: {
		readonly config: { readonly path: string; readonly sha256: string };
		readonly entry: { readonly path: string; readonly sha256: string };
		readonly id: typeof DEPENDENCY_CRUISER_PROVIDER_ID;
		readonly inputPaths: typeof CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS;
		readonly lock: { readonly path: string; readonly sha256: string };
		readonly packageManifest: { readonly path: string; readonly sha256: string };
		readonly version: typeof DEPENDENCY_CRUISER_PROVIDER_VERSION;
	};
	readonly resourceGuard: {
		readonly admittedContextArtifacts: number;
		readonly admittedContextDirectoryEntries: number;
		readonly admittedManifestDerivedDeclarationRoots: number;
		readonly admittedProviderDependencies: number;
		readonly admittedProviderModules: number;
		readonly admittedSubjectIncludeFilters: number;
		readonly maxContextPopulationRecords: number;
		readonly maxProcessRssBytes: number;
		readonly maxProviderDependencies: number;
		readonly maxProviderModules: number;
		readonly maxRawBytes: number;
		readonly memoryCheckpointState: 'WITHIN_BOUND_AT_ALL_OPERATION_CHECKPOINTS';
		readonly rawBytes: number;
	};
	readonly reviewedBaseline: {
		readonly expectedDifferentialDigest: string;
		readonly state: 'EXACT_MATCH';
	};
	readonly schemaVersion: typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_SCHEMA_VERSION;
	readonly semanticSnapshot: {
		readonly contextDigest: string;
		readonly declarationContext: {
			readonly authority: 'CONTEXT_ONLY';
			readonly currentness: 'NOT_RECHECKED_AFTER_PROVIDER';
			readonly manifestDerivedRoots: number;
			readonly source: 'CAPTURED_WORKSPACE_MANIFEST_EXPORTS_TYPES';
		};
		readonly id: string;
		readonly moduleResolutions: number;
		readonly projectionBoundary: 'EXACT_ONE_PROJECT_RPH_CONTRACTS_BUILD_SLICE';
		readonly sources: number;
		readonly validationState: 'VALID';
	};
	readonly subject: {
		readonly artifacts: number;
		readonly contextArtifacts: number;
		readonly contextConfigurations: number;
		readonly contextWorkspaceManifests: number;
		readonly dirtyState: string;
		readonly populationReconciles: true;
		readonly projectPaths: typeof CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS;
		readonly projects: number;
		readonly sourceIncludeFilters: typeof CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS;
		readonly subjectId: string;
		readonly workspaces: number;
	};
	readonly wireShape: 'CLOSED_EXACT';
}

export interface CurrentDependencyCruiserG4ClosureWitness {
	readonly claim: 'EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS_CLOSED_WITH_NO_OBSERVED_DIFFERENCE';
	readonly comparison: {
		readonly agreementRecords: number;
		readonly comparisonRecords: number;
		readonly corroborationRecords: number;
		readonly incomparableRecords: number;
		readonly observedDifferenceRecords: 0;
		readonly reconciles: true;
	};
	readonly compiler: {
		readonly deepIndexedSourcePaths: readonly string[];
		readonly edgeSourcePaths: readonly string[];
		readonly edges: number;
		readonly projectPath: string;
		readonly rootNames: readonly string[];
	};
	readonly contextEquivalence: 'UNKNOWN';
	readonly populationClosure: {
		readonly compilerEdgesRepresented: true;
		readonly compilerRootsEqualProviderInputs: true;
		readonly compilerSourcesEqualProviderModules: true;
		readonly providerDependenciesRepresented: true;
		readonly relationImporterPathsWithinExactRoots: true;
		readonly state: 'CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS';
	};
	readonly provider: {
		readonly dependencies: number;
		readonly dependencySourcePaths: readonly string[];
		readonly inputPaths: readonly string[];
		readonly modulePaths: readonly string[];
		readonly modules: number;
	};
	readonly state: 'CLOSED_NO_OBSERVED_DIFFERENCE';
	readonly underlyingComparisonNegativeCoverage: 'OPEN';
}

export type CurrentDependencyCruiserG4ClosureEvidence = Omit<
	CurrentDependencyCruiserDifferentialEvidence,
	| 'discovery'
	| 'execution'
	| 'nonclaims'
	| 'operationVersion'
	| 'provider'
	| 'reviewedBaseline'
	| 'schemaVersion'
	| 'semanticSnapshot'
	| 'subject'
> & {
	readonly discovery: {
		readonly acceptanceState: 'BASELINE_REQUIRED';
		readonly closureDigest: string;
		readonly differentialDigest: string;
		readonly evidenceContentDigest: string;
	};
	readonly execution: Omit<CurrentDependencyCruiserDifferentialEvidence['execution'], 'args'> & {
		readonly args: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_PROVIDER_ARGS;
	};
	readonly g4Closure: CurrentDependencyCruiserG4ClosureWitness;
	readonly nonclaims: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_NONCLAIMS;
	readonly operationVersion: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION;
	readonly provider: Omit<
		CurrentDependencyCruiserDifferentialEvidence['provider'],
		'inputPaths'
	> & {
		readonly inputPaths: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS;
	};
	readonly reviewedBaseline: {
		readonly baseDifferentialDigest: string;
		readonly expectedClosureDigest: string;
		readonly state: 'EXACT_MATCH';
	};
	readonly schemaVersion: typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_SCHEMA_VERSION;
	readonly semanticSnapshot: Omit<
		CurrentDependencyCruiserDifferentialEvidence['semanticSnapshot'],
		'projectionBoundary'
	> & {
		readonly projectionBoundary: 'EXACT_RPH_CONTRACTS_BUILD_ROOT_FILE_PERIMETER';
	};
	readonly subject: Omit<
		CurrentDependencyCruiserDifferentialEvidence['subject'],
		'projectPaths' | 'sourceIncludeFilters'
	> & {
		readonly projectPaths: typeof CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS;
		readonly sourceIncludeFilters: typeof CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS;
	};
};

/** Validates both canonical evidence envelopes and the persisted semantic differential identity. */
export function currentDependencyCruiserEvidenceDigestsAreValid(
	evidence: CurrentDependencyCruiserDifferentialEvidence | CurrentDependencyCruiserG4ClosureEvidence
): boolean {
	const { contentDigest, ...withoutContentDigest } = evidence;
	if (contentDigest !== evidenceDigest(withoutContentDigest)) return false;
	const { contentDigest: differentialContentDigest, ...withoutDifferentialContentDigest } =
		evidence.differential;
	if (differentialContentDigest !== sha256(canonicalSemanticJson(withoutDifferentialContentDigest)))
		return false;
	return (
		evidence.differential.differentialDigest ===
		dependencyCruiserDifferentialDigestFromComponents(
			evidence.differential.comparison,
			evidence.differential.graph.contentDigest,
			evidence.differential.observation.providerSemanticDigest
		)
	);
}

export type CurrentDependencyCruiserDifferentialDiagnosticCode =
	| 'ARTIFACT_DRIFT'
	| 'BASELINE_REQUIRED'
	| 'DIFFERENTIAL_DRIFT'
	| 'DIFFERENTIAL_UNAVAILABLE'
	| 'EVIDENCE_OVERSIZE'
	| 'GRAPH_INVALID'
	| 'GRAPH_UNAVAILABLE'
	| 'INTERNAL_FAILURE'
	| 'PROCESS_CRASH'
	| 'PROCESS_OUTPUT_OVERSIZE'
	| 'PROCESS_TIMEOUT'
	| 'PROVIDER_CARDINALITY_EXCEEDED'
	| 'PROVIDER_BASE_DIR_MISMATCH'
	| 'PROVIDER_OUTPUT_INVALID'
	| 'REQUEST_INVALID'
	| 'RESOURCE_MEMORY_EXCEEDED'
	| 'ROOT_BOUNDARY_INVALID'
	| 'SEMANTIC_INVALID'
	| 'SEMANTIC_UNAVAILABLE'
	| 'SAME_PERIMETER_CLOSURE_FAILED'
	| 'SUBJECT_CURRENTNESS_FAILED'
	| 'SUBJECT_POPULATION_INVALID'
	| 'SUBJECT_RESOLUTION_FAILED'
	| 'TOOL_IDENTITY_MISMATCH';

export interface CurrentDependencyCruiserDifferentialDiagnostic {
	readonly code: CurrentDependencyCruiserDifferentialDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase:
		| 'ACCEPT'
		| 'CURRENTNESS'
		| 'EVIDENCE'
		| 'EXECUTE'
		| 'GRAPH'
		| 'NORMALIZE'
		| 'REQUEST'
		| 'SEMANTIC'
		| 'SUBJECT'
		| 'TOOL';
}

export type CurrentDependencyCruiserDifferentialOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly evidence: CurrentDependencyCruiserDifferentialEvidence;
			readonly outcome: 'accepted';
	  }
	| {
			readonly diagnostics: readonly [CurrentDependencyCruiserDifferentialDiagnostic];
			readonly discovery: DependencyCruiserDifferentialEvidence & {
				readonly acceptanceState: 'BASELINE_REQUIRED' | 'DIFFERENTIAL_DRIFT';
			};
			readonly outcome: 'rejected';
	  }
	| {
			readonly diagnostics: readonly [CurrentDependencyCruiserDifferentialDiagnostic];
			readonly outcome: 'unavailable';
	  };

export type CurrentDependencyCruiserG4ClosureOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly evidence: CurrentDependencyCruiserG4ClosureEvidence;
			readonly outcome: 'accepted';
	  }
	| {
			readonly closure: CurrentDependencyCruiserG4ClosureWitness;
			readonly diagnostics: readonly [CurrentDependencyCruiserDifferentialDiagnostic];
			readonly discovery: DependencyCruiserDifferentialEvidence & {
				readonly acceptanceState: 'BASELINE_REQUIRED';
			};
			readonly discoveryClosureDigest: string;
			readonly outcome: 'rejected';
	  }
	| {
			readonly diagnostics: readonly [CurrentDependencyCruiserDifferentialDiagnostic];
			readonly outcome: 'unavailable';
	  };

class RunnerFailure extends Error {
	constructor(readonly diagnostic: CurrentDependencyCruiserDifferentialDiagnostic) {
		super(diagnostic.message);
	}
}

function fail(
	code: CurrentDependencyCruiserDifferentialDiagnosticCode,
	message: string,
	phase: CurrentDependencyCruiserDifferentialDiagnostic['phase'],
	path: string | null = null
): never {
	throw new RunnerFailure({ code, message, path, phase });
}

function positiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

type CurrentDependencyCruiserRunnerRequest =
	CurrentDependencyCruiserDifferentialRequest | CurrentDependencyCruiserG4ClosureRequest;

interface CurrentDependencyCruiserRunnerProfile {
	readonly evidencePath:
		| typeof CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH
		| typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH;
	readonly inputPaths: readonly string[];
	readonly kind: 'BROAD_ASYMMETRIC' | 'G4_SAME_PERIMETER';
	readonly operationVersion:
		| typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION
		| typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION;
	readonly providerArgs: readonly string[];
	readonly requestSchemaVersion:
		| typeof CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
		| typeof CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REQUEST_SCHEMA_VERSION;
}

const BROAD_ASYMMETRIC_PROFILE: CurrentDependencyCruiserRunnerProfile = {
	evidencePath: CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH,
	inputPaths: CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS,
	kind: 'BROAD_ASYMMETRIC',
	operationVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
	providerArgs: CURRENT_DEPENDENCY_CRUISER_PROVIDER_ARGS,
	requestSchemaVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
};

const G4_SAME_PERIMETER_PROFILE: CurrentDependencyCruiserRunnerProfile = {
	evidencePath: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH,
	inputPaths: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS,
	kind: 'G4_SAME_PERIMETER',
	operationVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION,
	providerArgs: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_PROVIDER_ARGS,
	requestSchemaVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REQUEST_SCHEMA_VERSION
};

function expectedDigest(request: CurrentDependencyCruiserRunnerRequest): string | null {
	return 'expectedClosureDigest' in request
		? request.expectedClosureDigest
		: request.expectedDifferentialDigest;
}

function validRequest(
	request: CurrentDependencyCruiserRunnerRequest,
	profile: CurrentDependencyCruiserRunnerProfile
): boolean {
	const expected = expectedDigest(request);
	return (
		request.schemaVersion === profile.requestSchemaVersion &&
		request.operationVersion === profile.operationVersion &&
		typeof request.rootLocator === 'string' &&
		isAbsolute(request.rootLocator) &&
		(expected === null || SHA256.test(expected)) &&
		positiveInteger(request.budgets.maxEvidenceBytes) &&
		positiveInteger(request.budgets.maxProcessRssBytes) &&
		positiveInteger(request.budgets.maxProviderDependencies) &&
		positiveInteger(request.budgets.maxProviderModules) &&
		positiveInteger(request.budgets.maxStderrBytes) &&
		positiveInteger(request.budgets.maxStdoutBytes) &&
		positiveInteger(request.budgets.providerDurationMs) &&
		positiveInteger(request.budgets.assessment.maxComparisonRecords) &&
		request.budgets.assessment.maxComparisonRecords <= 10_000_000 &&
		positiveInteger(request.budgets.assessment.maxDiagnostics) &&
		request.budgets.assessment.maxDiagnostics <= 100_000 &&
		positiveInteger(request.budgets.assessment.maxRationaleCharacters) &&
		request.budgets.assessment.maxRationaleCharacters <= 1_000_000 &&
		positiveInteger(request.budgets.assessment.maxResultBytes)
	);
}

function pathKey(path: string): string {
	const normalized = resolve(path);
	return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function containedPath(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function exactContainedFile(root: string, logicalPath: string): string {
	const candidate = resolve(root, logicalPath);
	if (!containedPath(root, candidate) || !statSync(candidate).isFile())
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A required trusted-root file is absent or outside the root.',
			'TOOL'
		);
	const real = realpathSync(candidate);
	if (!containedPath(root, real))
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A required trusted-root file resolves outside the root.',
			'TOOL'
		);
	return real;
}

function exactContainedDirectory(root: string, logicalPath: string): string {
	const candidate = resolve(root, logicalPath);
	if (
		!containedPath(root, candidate) ||
		!statSync(candidate).isDirectory() ||
		lstatSync(candidate).isSymbolicLink()
	)
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A required dependency-cruiser input root is absent, not a directory, or a symlink.',
			'TOOL',
			logicalPath
		);
	const real = realpathSync(candidate);
	if (!containedPath(root, real))
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A dependency-cruiser input root resolves outside the root.',
			'TOOL'
		);
	return real;
}

function exactContainedProviderInput(root: string, logicalPath: string): string {
	const candidate = resolve(root, logicalPath);
	if (
		!containedPath(root, candidate) ||
		!existsSync(candidate) ||
		lstatSync(candidate).isSymbolicLink()
	)
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A dependency-cruiser input is absent, outside the root, or a symbolic link.',
			'TOOL',
			logicalPath
		);
	const status = statSync(candidate);
	if (!status.isFile() && !status.isDirectory())
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A dependency-cruiser input is not one exact regular file or directory.',
			'TOOL',
			logicalPath
		);
	const real = realpathSync(candidate);
	if (!containedPath(root, real))
		fail(
			'ROOT_BOUNDARY_INVALID',
			'A dependency-cruiser input resolves outside the root.',
			'TOOL',
			logicalPath
		);
	return real;
}

interface CurrentDependencyCruiserContextPopulation {
	readonly configurations: number;
	readonly directoryEntries: number;
	readonly paths: readonly string[];
	readonly workspaceManifests: number;
}

function collectCurrentDependencyCruiserContextPopulation(
	root: string,
	budgets: ResolveSubjectRequest['budgets']
): CurrentDependencyCruiserContextPopulation {
	const paths = new Set<string>();
	let configurations = 0;
	let directoryEntries = 0;
	let workspaceManifests = 0;
	const admit = (logicalPath: string, kind: 'CONFIGURATION' | 'MANIFEST') => {
		exactContainedFile(root, logicalPath);
		if (paths.has(logicalPath)) return;
		paths.add(logicalPath);
		if (paths.size > budgets.maxFiles)
			fail(
				'SUBJECT_POPULATION_INVALID',
				'The exact compiler-context artifact population exceeds the subject file bound.',
				'SUBJECT',
				logicalPath
			);
		if (kind === 'CONFIGURATION') configurations += 1;
		else workspaceManifests += 1;
	};
	const entries = (logicalDirectory: string) => {
		const absolute = exactContainedDirectory(root, logicalDirectory);
		const result = readdirSync(absolute, { withFileTypes: true }).sort((left, right) =>
			left.name < right.name ? -1 : left.name > right.name ? 1 : 0
		);
		directoryEntries += result.length;
		if (directoryEntries > budgets.maxFiles)
			fail(
				'SUBJECT_POPULATION_INVALID',
				'The exact compiler-context directory population exceeds the subject file bound.',
				'SUBJECT',
				logicalDirectory
			);
		return result;
	};
	if (existsSync(resolve(root, 'tsconfig.json'))) admit('tsconfig.json', 'CONFIGURATION');
	for (const inputRoot of CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS) {
		for (const workspaceEntry of entries(inputRoot)) {
			const workspacePath = `${inputRoot}/${workspaceEntry.name}`;
			if (workspaceEntry.isSymbolicLink())
				fail(
					'ROOT_BOUNDARY_INVALID',
					'A dependency-cruiser workspace candidate is a symbolic link.',
					'SUBJECT',
					workspacePath
				);
			if (!workspaceEntry.isDirectory()) continue;
			const workspaceEntries = entries(workspacePath);
			const manifest = workspaceEntries.find((entry) => entry.name === 'package.json');
			if (manifest === undefined) continue;
			if (!manifest.isFile() || manifest.isSymbolicLink())
				fail(
					'ROOT_BOUNDARY_INVALID',
					'A workspace package manifest is not one exact regular file.',
					'SUBJECT',
					`${workspacePath}/package.json`
				);
			admit(`${workspacePath}/package.json`, 'MANIFEST');
			for (const entry of workspaceEntries) {
				if (entry.name === 'package.json') continue;
				const logicalPath = `${workspacePath}/${entry.name}`;
				if (entry.isSymbolicLink())
					fail(
						'ROOT_BOUNDARY_INVALID',
						'A workspace compiler-context candidate is a symbolic link.',
						'SUBJECT',
						logicalPath
					);
				if (entry.isFile() && entry.name.endsWith('.json')) admit(logicalPath, 'CONFIGURATION');
			}
		}
	}
	return {
		configurations,
		directoryEntries,
		paths: Object.freeze([...paths].sort()),
		workspaceManifests
	};
}

function manifestDerivedDeclarationRoots(
	subject: Extract<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>['subject']
): readonly string[] {
	const roots = new Set<string>();
	for (const workspace of subject.workspaces) {
		for (const record of workspace.exports) {
			const target = record.target;
			if (
				target === null ||
				target.length === 0 ||
				target.includes('\\') ||
				target.startsWith('/') ||
				/^[A-Za-z]:/u.test(target) ||
				(!record.conditions.includes('types') && !/\.d\.[cm]?ts$/u.test(target))
			)
				continue;
			const resolvedTarget = posix.normalize(posix.join(workspace.path, target));
			if (resolvedTarget === '.' || resolvedTarget === '..' || resolvedTarget.startsWith('../'))
				continue;
			const root = posix.dirname(resolvedTarget);
			if (root !== '.') roots.add(root);
		}
	}
	return Object.freeze([...roots].sort());
}

function subjectRequest(
	rootLocator: string,
	budgets: ResolveSubjectRequest['budgets'],
	contextArtifacts: readonly string[],
	profile: CurrentDependencyCruiserRunnerProfile
): ResolveSubjectRequest {
	const selectedProjects = new Set<string>(CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS);
	const additionalArtifacts = [
		...new Set([
			CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
			CURRENT_DEPENDENCY_CRUISER_LOCK_PATH,
			...contextArtifacts
		])
	]
		.filter((path) => !selectedProjects.has(path))
		.sort();
	const includeFilters = [
		...new Set([...CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS, ...additionalArtifacts])
	].sort();
	return {
		budgets,
		expectEmpty: false,
		filters: { exclude: [], include: includeFilters },
		operationVersion: profile.operationVersion,
		outputs: [profile.evidencePath],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			additionalArtifacts,
			kind: 'EXPLICIT_PROJECTS',
			projects: CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS
		},
		subjectKind: 'WORKTREE'
	};
}

function defaultEnvironment(): Readonly<Record<string, string>> {
	const result: Record<string, string> = {
		CSAA_NETWORK_POLICY: 'NONE',
		HTTP_PROXY: '',
		HTTPS_PROXY: '',
		NO_PROXY: '*',
		npm_config_offline: 'true'
	};
	for (const key of ['SystemRoot', 'TEMP', 'TMP', 'WINDIR'] as const) {
		const value = process.env[key];
		if (value !== undefined) result[key] = value;
	}
	return result;
}

function defaultExecute(
	request: CurrentDependencyCruiserExecutorRequest
): CurrentDependencyCruiserExecutorResult {
	const result = spawnSync(request.executable, [...request.args], {
		cwd: request.cwd,
		encoding: 'utf8',
		env: { ...request.env },
		maxBuffer: Math.max(request.maxStdoutBytes, request.maxStderrBytes),
		shell: false,
		timeout: request.timeoutMs,
		windowsHide: true
	});
	const error = result.error as (Error & { readonly code?: string }) | undefined;
	return {
		errorCode: error?.code ?? null,
		errorMessage: error?.message ?? null,
		signal: result.signal,
		status: result.status,
		stderr: result.stderr ?? '',
		stdout: result.stdout ?? '',
		timedOut: error?.code === 'ETIMEDOUT'
	};
}

function artifact(
	subject: Extract<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>['subject'],
	path: string
) {
	const matches = subject.artifacts.filter((item) => item.path === path);
	if (matches.length !== 1)
		fail(
			'SUBJECT_POPULATION_INVALID',
			'A required captured subject artifact does not have one exact record.',
			'SUBJECT',
			path
		);
	return matches[0]!;
}

function readCapturedArtifact(
	root: string,
	subject: Extract<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>['subject'],
	path: string
): { readonly bytes: Buffer; readonly sha256: string } {
	const captured = artifact(subject, path);
	const bytes = readFileSync(exactContainedFile(root, path));
	const digest = sha256(bytes);
	if (bytes.byteLength !== captured.bytes || digest !== captured.sha256)
		fail(
			'ARTIFACT_DRIFT',
			'A required live artifact no longer matches its FrozenSubject record.',
			'SUBJECT',
			path
		);
	return { bytes, sha256: digest };
}

interface ProviderRawPreflight {
	readonly dependencyKeys: number;
	readonly moduleKeys: number;
	readonly reportedBaseDir: string;
}

function decodedJsonString(rawToken: string): string | null {
	try {
		const value = JSON.parse(rawToken) as unknown;
		return typeof value === 'string' ? value : null;
	} catch {
		return null;
	}
}

function jsonWhitespace(code: number): boolean {
	return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

/**
 * Non-materializing lexical admission. Module rows carry `source` and dependency rows carry
 * `module`; same-named optional nested keys only make these conservative upper bounds.
 */
function preflightProviderRaw(
	raw: string,
	root: string,
	budgets: Pick<
		CurrentDependencyCruiserDifferentialBudgets,
		'maxProviderDependencies' | 'maxProviderModules'
	>
): ProviderRawPreflight {
	let first = 0;
	while (first < raw.length && jsonWhitespace(raw.charCodeAt(first))) first += 1;
	let last = raw.length - 1;
	while (last >= first && jsonWhitespace(raw.charCodeAt(last))) last -= 1;
	if (raw.charCodeAt(first) !== 0x7b || raw.charCodeAt(last) !== 0x7d)
		fail('PROVIDER_OUTPUT_INVALID', 'dependency-cruiser stdout is not a JSON object.', 'NORMALIZE');
	let dependencyKeys = 0;
	let moduleKeys = 0;
	const baseDirs: string[] = [];
	for (let index = 0; index < raw.length; index += 1) {
		if (raw.charCodeAt(index) !== 0x22) continue;
		const start = index;
		index += 1;
		let escaped = false;
		let containsEscape = false;
		for (; index < raw.length; index += 1) {
			const code = raw.charCodeAt(index);
			if (escaped) escaped = false;
			else if (code === 0x5c) {
				escaped = true;
				containsEscape = true;
			} else if (code === 0x22) break;
		}
		if (index >= raw.length)
			fail(
				'PROVIDER_OUTPUT_INVALID',
				'dependency-cruiser stdout has an unterminated string.',
				'NORMALIZE'
			);
		let cursor = index + 1;
		while (cursor < raw.length && jsonWhitespace(raw.charCodeAt(cursor))) cursor += 1;
		if (raw[cursor] !== ':') continue;
		let key: string | null = null;
		if (containsEscape) key = decodedJsonString(raw.slice(start, index + 1));
		else {
			const keyLength = index - start - 1;
			if (keyLength === 6 && raw.startsWith('source', start + 1)) key = 'source';
			else if (keyLength === 6 && raw.startsWith('module', start + 1)) key = 'module';
			else if (keyLength === 7 && raw.startsWith('baseDir', start + 1)) key = 'baseDir';
		}
		if (key === 'source') {
			moduleKeys += 1;
			if (moduleKeys > budgets.maxProviderModules)
				fail(
					'PROVIDER_CARDINALITY_EXCEEDED',
					'dependency-cruiser module-key cardinality exceeds its pre-normalization bound.',
					'NORMALIZE',
					'$.modules'
				);
		} else if (key === 'module') {
			dependencyKeys += 1;
			if (dependencyKeys > budgets.maxProviderDependencies)
				fail(
					'PROVIDER_CARDINALITY_EXCEEDED',
					'dependency-cruiser dependency-key cardinality exceeds its pre-normalization bound.',
					'NORMALIZE',
					'$.modules[*].dependencies'
				);
		} else if (key === 'baseDir') {
			cursor += 1;
			while (cursor < raw.length && jsonWhitespace(raw.charCodeAt(cursor))) cursor += 1;
			if (raw[cursor] !== '"')
				fail(
					'PROVIDER_OUTPUT_INVALID',
					'dependency-cruiser baseDir is not a string.',
					'NORMALIZE',
					'$.summary.optionsUsed.baseDir'
				);
			const valueStart = cursor;
			cursor += 1;
			escaped = false;
			for (; cursor < raw.length; cursor += 1) {
				const code = raw.charCodeAt(cursor);
				if (escaped) escaped = false;
				else if (code === 0x5c) escaped = true;
				else if (code === 0x22) break;
			}
			const value = decodedJsonString(raw.slice(valueStart, cursor + 1));
			if (value === null)
				fail('PROVIDER_OUTPUT_INVALID', 'dependency-cruiser baseDir is malformed.', 'NORMALIZE');
			baseDirs.push(value);
		}
	}
	if (baseDirs.length !== 1)
		fail(
			'PROVIDER_BASE_DIR_MISMATCH',
			'dependency-cruiser did not report one exact baseDir witness.',
			'NORMALIZE',
			'$.summary.optionsUsed.baseDir'
		);
	const reportedBaseDir = baseDirs[0]!;
	if (!isAbsolute(reportedBaseDir) || pathKey(reportedBaseDir) !== pathKey(root))
		fail(
			'PROVIDER_BASE_DIR_MISMATCH',
			'dependency-cruiser did not report the exact absolute trusted root.',
			'NORMALIZE',
			'$.summary.optionsUsed.baseDir'
		);
	return { dependencyKeys, moduleKeys, reportedBaseDir };
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const child of Object.values(value)) deepFreeze(child, seen);
	return Object.freeze(value);
}

function evidenceDigest(value: unknown) {
	return sha256(canonicalJson(value));
}

export type CurrentDependencyCruiserG4ClosureAssessment =
	| {
			readonly outcome: 'closed';
			readonly witness: CurrentDependencyCruiserG4ClosureWitness;
	  }
	| {
			readonly diagnostic: string;
			readonly outcome: 'unavailable';
	  };

function canonicalPaths(values: readonly string[]): readonly string[] {
	return Object.freeze([...new Set(values)].sort());
}

function samePaths(left: readonly string[], right: readonly string[]): boolean {
	return canonicalJson(left) === canonicalJson(right);
}

export function assessCurrentDependencyCruiserG4Closure(
	semanticSnapshot: StaticSemanticSnapshot,
	graph: ModuleDependencyGraphSnapshot,
	observation: DependencyCruiserObservation,
	differential: DependencyCruiserDifferentialEvidence,
	expectedInputPaths: readonly string[] = CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS,
	expectedProjectPath: string = CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS[0]
): CurrentDependencyCruiserG4ClosureAssessment {
	const unavailable = (diagnostic: string): CurrentDependencyCruiserG4ClosureAssessment => ({
		diagnostic,
		outcome: 'unavailable'
	});
	if (
		semanticSnapshot.projects.length !== 1 ||
		semanticSnapshot.projects[0]?.configPath !== expectedProjectPath
	)
		return unavailable('The compiler evidence is not the one exact rph-contracts build project.');
	const expected = canonicalPaths(expectedInputPaths);
	if (!samePaths(expected, expectedInputPaths))
		return unavailable('The expected same-perimeter input population is not canonical and unique.');
	const rawRootNames = semanticSnapshot.projects[0].rootNames;
	const rawDeepIndexedSourcePaths = semanticSnapshot.sources
		.filter((source) => source.analysisDisposition === 'DEEP_INDEXED' && !source.declarationFile)
		.map((source) => source.logicalPath);
	const rawProviderInputPaths = observation.invocation.inputPaths;
	const rawProviderModulePaths = observation.modules.map((module) => module.sourcePath);
	const rootNames = canonicalPaths(rawRootNames);
	const deepIndexedSourcePaths = canonicalPaths(rawDeepIndexedSourcePaths);
	const providerInputPaths = canonicalPaths(rawProviderInputPaths);
	const providerModulePaths = canonicalPaths(rawProviderModulePaths);
	if (
		rawRootNames.length !== rootNames.length ||
		rawDeepIndexedSourcePaths.length !== deepIndexedSourcePaths.length ||
		rawProviderInputPaths.length !== providerInputPaths.length ||
		rawProviderModulePaths.length !== providerModulePaths.length
	)
		return unavailable(
			'The compiler-root, compiler-source, provider-input, or provider-module population contains duplicate rows.'
		);
	if (
		!samePaths(rootNames, expected) ||
		!samePaths(deepIndexedSourcePaths, expected) ||
		!samePaths(providerInputPaths, expected) ||
		!samePaths(providerModulePaths, expected)
	)
		return unavailable(
			'Compiler roots, deep-indexed compiler sources, provider inputs, and provider modules do not form one exact population.'
		);
	const sourcePathsByNodeId = new Map(
		graph.nodes
			.filter((node) => node.kind === 'SOURCE')
			.map((node) => [node.id, node.logicalPath] as const)
	);
	const edgeSourcePaths = canonicalPaths(
		graph.edges.map((edge) => sourcePathsByNodeId.get(edge.source.nodeId) ?? '')
	);
	const dependencySourcePaths = canonicalPaths(
		observation.dependencies.map((dependency) => dependency.sourcePath)
	);
	if (
		edgeSourcePaths.includes('') ||
		edgeSourcePaths.some((path) => !expected.includes(path)) ||
		dependencySourcePaths.some((path) => !expected.includes(path))
	)
		return unavailable(
			'A represented compiler or provider relation has an importer outside the exact roots.'
		);
	const comparison = differential.comparison.coverage;
	if (
		graph.edges.length === 0 ||
		observation.dependencies.length === 0 ||
		comparison.recordCount === 0 ||
		!comparison.reconciles ||
		comparison.compilerEdgesRepresented !== graph.edges.length ||
		comparison.compilerEdgesTotal !== graph.edges.length ||
		comparison.dependencyCruiserDependenciesRepresented !== observation.dependencies.length ||
		comparison.dependencyCruiserDependenciesTotal !== observation.dependencies.length ||
		comparison.observedDifferenceRecords !== 0 ||
		differential.comparison.negativeCoverage.state !== 'OPEN'
	)
		return unavailable(
			'The represented relation population is empty, unreconciled, different, or does not retain the v1 comparison frontier.'
		);
	return {
		outcome: 'closed',
		witness: {
			claim:
				'EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS_CLOSED_WITH_NO_OBSERVED_DIFFERENCE',
			comparison: {
				agreementRecords: comparison.agreementRecords,
				comparisonRecords: comparison.recordCount,
				corroborationRecords: comparison.corroborationRecords,
				incomparableRecords: comparison.incomparableRecords,
				observedDifferenceRecords: 0,
				reconciles: true
			},
			compiler: {
				deepIndexedSourcePaths: expectedInputPaths,
				edgeSourcePaths,
				edges: graph.edges.length,
				projectPath: expectedProjectPath,
				rootNames: expectedInputPaths
			},
			contextEquivalence: 'UNKNOWN',
			populationClosure: {
				compilerEdgesRepresented: true,
				compilerRootsEqualProviderInputs: true,
				compilerSourcesEqualProviderModules: true,
				providerDependenciesRepresented: true,
				relationImporterPathsWithinExactRoots: true,
				state: 'CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS'
			},
			provider: {
				dependencies: observation.dependencies.length,
				dependencySourcePaths,
				inputPaths: expectedInputPaths,
				modulePaths: expectedInputPaths,
				modules: observation.modules.length
			},
			state: 'CLOSED_NO_OBSERVED_DIFFERENCE',
			underlyingComparisonNegativeCoverage: 'OPEN'
		}
	};
}

function g4ClosureDigest(
	differentialDigest: string,
	witness: CurrentDependencyCruiserG4ClosureWitness
): string {
	return sha256(
		canonicalJson({
			differentialDigest,
			operationVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION,
			witness
		})
	);
}

export function defaultCurrentDependencyCruiserDifferentialRequest(
	rootLocator: string,
	expectedDifferentialDigest: string | null
): CurrentDependencyCruiserDifferentialRequest {
	return {
		budgets: {
			assessment: {
				maxComparisonRecords: 500_000,
				maxDiagnostics: 100_000,
				maxRationaleCharacters: 1_000_000,
				maxResultBytes: 256 * 1024 * 1024
			},
			maxEvidenceBytes: 256 * 1024 * 1024,
			// An external current-repository discovery observed a 4,737,843,200-byte
			// aggregate-private high-water mark. The in-process guard measures parent-process RSS
			// at checkpoints, so this 6 GiB ceiling is informed by but not equivalent to that value.
			maxProcessRssBytes: 6 * 1024 * 1024 * 1024,
			maxProviderDependencies: 250_000,
			maxProviderModules: 25_000,
			maxStderrBytes: 16 * 1024 * 1024,
			maxStdoutBytes: 256 * 1024 * 1024,
			providerDurationMs: 600_000,
			semantic: {
				maxAstDepth: 2_048,
				maxAstNodes: 1_000_000,
				maxCompilerFacts: 1_000_000,
				maxCompilerInputMetadataBytes: 268_435_456,
				maxCompilerQueries: 1_000_000,
				maxCompilerQueryInvocations: 10_000_000,
				maxContextBytes: 268_435_456,
				maxContextFileBytes: 67_108_864,
				maxContextFiles: 100_000,
				maxDiagnosticCharacters: 50_000_000,
				maxDiagnostics: 500_000,
				maxDirectoryEntries: 5_000_000,
				maxDurationMs: 3_600_000,
				maxLiteralCharacters: 10_000,
				maxPathCharacters: 4_096,
				maxProjects: 200,
				maxScopes: 1_000_000,
				maxSnapshotBytes: 268_435_456,
				maxSources: 100_000
			},
			subject: {
				maxBytes: 536_870_912,
				maxConfigDepth: 64,
				maxDiagnostics: 100_000,
				maxDurationMs: 180_000,
				maxFiles: 100_000,
				maxProjects: 200
			}
		},
		expectedDifferentialDigest,
		operationVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
		rootLocator,
		schemaVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
	};
}

export function defaultCurrentDependencyCruiserG4ClosureRequest(
	rootLocator: string,
	expectedClosureDigest: string | null
): CurrentDependencyCruiserG4ClosureRequest {
	const base = defaultCurrentDependencyCruiserDifferentialRequest(rootLocator, null);
	return {
		budgets: base.budgets,
		expectedClosureDigest,
		operationVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION,
		rootLocator,
		schemaVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REQUEST_SCHEMA_VERSION
	};
}

function runCurrentDependencyCruiserProfile(
	request: CurrentDependencyCruiserRunnerRequest,
	dependencies: CurrentDependencyCruiserDifferentialDependencies,
	profile: CurrentDependencyCruiserRunnerProfile
): CurrentDependencyCruiserDifferentialOutcome | CurrentDependencyCruiserG4ClosureOutcome {
	try {
		if (!validRequest(request, profile))
			fail('REQUEST_INVALID', 'The current-repository differential request is invalid.', 'REQUEST');
		const readMemory = dependencies.memoryUsage ?? (() => process.memoryUsage());
		const assertMemory = (phase: CurrentDependencyCruiserDifferentialDiagnostic['phase']): void => {
			if (readMemory().rss > request.budgets.maxProcessRssBytes)
				fail(
					'RESOURCE_MEMORY_EXCEEDED',
					'The operation exceeded its process RSS bound at a mandatory checkpoint.',
					phase,
					'$.budgets.maxProcessRssBytes'
				);
		};
		assertMemory('REQUEST');
		const root = realpathSync(request.rootLocator);
		if (!statSync(root).isDirectory())
			fail('ROOT_BOUNDARY_INVALID', 'The trusted root is not a directory.', 'REQUEST');
		for (const inputPath of profile.inputPaths) exactContainedProviderInput(root, inputPath);
		const contextPopulation = collectCurrentDependencyCruiserContextPopulation(
			root,
			request.budgets.subject
		);
		const packagePath = exactContainedFile(root, CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH);
		const entryPath = exactContainedFile(root, CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH);
		const providerPackageBytes = readFileSync(packagePath);
		const providerPackageDigest = sha256(providerPackageBytes);
		const providerEntryDigest = sha256(readFileSync(entryPath));
		let providerManifest: unknown;
		try {
			providerManifest = JSON.parse(providerPackageBytes.toString('utf8')) as unknown;
		} catch {
			fail('TOOL_IDENTITY_MISMATCH', 'The local dependency-cruiser manifest is invalid.', 'TOOL');
		}
		if (
			(providerManifest as { readonly name?: unknown }).name !== DEPENDENCY_CRUISER_PROVIDER_ID ||
			(providerManifest as { readonly version?: unknown }).version !==
				DEPENDENCY_CRUISER_PROVIDER_VERSION
		)
			fail(
				'TOOL_IDENTITY_MISMATCH',
				'The local dependency-cruiser installation is not the locked 16.10.4 provider.',
				'TOOL'
			);

		const resolveOperation = dependencies.resolve ?? resolveSubject;
		const subjectOutcome = resolveOperation(
			subjectRequest(root, request.budgets.subject, contextPopulation.paths, profile)
		);
		if (subjectOutcome.outcome !== 'resolved')
			fail(
				'SUBJECT_RESOLUTION_FAILED',
				subjectOutcome.diagnostics[0]?.message ?? 'The JPWB FrozenSubject was unavailable.',
				'SUBJECT'
			);
		const subject = subjectOutcome.subject;
		if (
			!subject.population.reconciles ||
			subject.artifacts.length === 0 ||
			subject.projects.length === 0 ||
			subject.workspaces.length === 0
		)
			fail(
				'SUBJECT_POPULATION_INVALID',
				'The captured JPWB subject population is empty or unreconciled.',
				'SUBJECT'
			);
		const capturedArtifactPaths = new Set(subject.artifacts.map((item) => item.path));
		const absentContextArtifact = contextPopulation.paths.find(
			(path) => !capturedArtifactPaths.has(path)
		);
		if (absentContextArtifact !== undefined)
			fail(
				'SUBJECT_POPULATION_INVALID',
				'An exact compiler-context artifact is absent from the resolved FrozenSubject.',
				'SUBJECT',
				absentContextArtifact
			);
		const declarationContextRoots = manifestDerivedDeclarationRoots(subject);
		if (declarationContextRoots.length > request.budgets.subject.maxFiles)
			fail(
				'SUBJECT_POPULATION_INVALID',
				'The manifest-derived declaration-context root population exceeds the subject file bound.',
				'SUBJECT'
			);
		const config = readCapturedArtifact(root, subject, CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH);
		const lock = readCapturedArtifact(root, subject, CURRENT_DEPENDENCY_CRUISER_LOCK_PATH);
		assertMemory('SUBJECT');

		const clock = dependencies.clock ?? {
			monotonicMs: () => performance.now(),
			now: () => new Date()
		};
		const startedAt = clock.now();
		const startedMs = clock.monotonicMs();
		const execute = dependencies.execute ?? defaultExecute;
		const processResult = execute({
			args: profile.providerArgs,
			cwd: root,
			env: defaultEnvironment(),
			executable: process.execPath,
			maxStderrBytes: request.budgets.maxStderrBytes,
			maxStdoutBytes: request.budgets.maxStdoutBytes,
			networkUse: 'NONE',
			shell: false,
			subjectEntryPoints: [],
			timeoutMs: request.budgets.providerDurationMs
		});
		const finishedMs = clock.monotonicMs();
		const finishedAt = clock.now();
		if (processResult.timedOut || processResult.errorCode === 'ETIMEDOUT')
			fail('PROCESS_TIMEOUT', 'dependency-cruiser exceeded its execution timeout.', 'EXECUTE');
		if (processResult.errorCode === 'ENOBUFS')
			fail('PROCESS_OUTPUT_OVERSIZE', 'dependency-cruiser exceeded an output bound.', 'EXECUTE');
		if (processResult.errorCode !== null || processResult.status === null)
			fail('PROCESS_CRASH', 'dependency-cruiser did not return an exit status.', 'EXECUTE');
		const providerRaw = processResult.stdout;
		const stdoutBytes = Buffer.byteLength(providerRaw, 'utf8');
		const stderrBytes = Buffer.byteLength(processResult.stderr, 'utf8');
		if (
			stdoutBytes > request.budgets.maxStdoutBytes ||
			stderrBytes > request.budgets.maxStderrBytes
		)
			fail('PROCESS_OUTPUT_OVERSIZE', 'dependency-cruiser exceeded an output bound.', 'EXECUTE');
		const rawPreflight = preflightProviderRaw(providerRaw, root, request.budgets);
		const reportedBaseDir = rawPreflight.reportedBaseDir;
		assertMemory('NORMALIZE');
		if (
			sha256(readFileSync(exactContainedFile(root, CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH))) !==
				providerPackageDigest ||
			sha256(readFileSync(exactContainedFile(root, CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH))) !==
				providerEntryDigest
		)
			fail(
				'TOOL_IDENTITY_MISMATCH',
				'The locked dependency-cruiser provider changed during execution.',
				'TOOL'
			);
		readCapturedArtifact(root, subject, CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH);
		readCapturedArtifact(root, subject, CURRENT_DEPENDENCY_CRUISER_LOCK_PATH);
		const currentContextPopulation = collectCurrentDependencyCruiserContextPopulation(
			root,
			request.budgets.subject
		);
		if (canonicalJson(currentContextPopulation.paths) !== canonicalJson(contextPopulation.paths))
			fail(
				'SUBJECT_CURRENTNESS_FAILED',
				'The exact compiler-context artifact population changed during provider execution.',
				'CURRENTNESS'
			);
		const verify = dependencies.verifyCurrentness ?? verifyFrozenSubject;
		const postProviderCurrentness = verify(subject, { rootLocator: root });
		if (postProviderCurrentness.state !== 'CURRENT')
			fail(
				'SUBJECT_CURRENTNESS_FAILED',
				'The FrozenSubject was not current after dependency-cruiser execution.',
				'CURRENTNESS',
				postProviderCurrentness.changedPaths[0] ?? null
			);
		assertMemory('EXECUTE');

		const buildSemantic = dependencies.buildSemantic ?? buildStaticSemanticSnapshot;
		let semanticMemoryExceeded = false;
		const semanticOutcome = buildSemantic(
			{
				assignabilityRequests: [],
				budgets: request.budgets.semantic,
				capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: root,
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			},
			{ subject },
			{
				onProgress(event) {
					if (event.memoryUsage.rss > request.budgets.maxProcessRssBytes)
						semanticMemoryExceeded = true;
				}
			}
		);
		if (semanticMemoryExceeded)
			fail(
				'RESOURCE_MEMORY_EXCEEDED',
				'The semantic build exceeded the operation process RSS bound.',
				'SEMANTIC',
				'$.budgets.maxProcessRssBytes'
			);
		assertMemory('SEMANTIC');
		if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
			fail(
				'SEMANTIC_UNAVAILABLE',
				semanticOutcome.diagnostics[0]?.message ?? 'The static semantic snapshot was unavailable.',
				'SEMANTIC'
			);
		assertMemory('SEMANTIC');
		const snapshot = semanticOutcome.snapshot;
		const validateSemantic = dependencies.validateSemantic ?? validateStaticSemanticSnapshot;
		const snapshotValidation = validateSemantic(
			snapshot,
			{
				maxDepth: 4_096,
				maxDiagnostics: snapshot.budgets.maxDiagnostics,
				maxIssues: 100_000,
				maxRecords: snapshot.budgets.maxSnapshotBytes,
				maxReferenceChecks: snapshot.budgets.maxSnapshotBytes,
				maxStringCharacters: snapshot.budgets.maxSnapshotBytes
			},
			{ frozenSubject: subject }
		);
		if (
			snapshotValidation.state !== 'VALID' ||
			snapshot.sources.length === 0 ||
			snapshot.moduleResolutions.length === 0
		)
			fail(
				'SEMANTIC_INVALID',
				snapshotValidation.issues[0]?.message ??
					'The semantic source or module-resolution population is empty.',
				'SEMANTIC'
			);

		const buildGraph = dependencies.buildGraph ?? buildModuleDependencyGraph;
		const graphOutcome = buildGraph(
			{
				operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
				schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
				semanticSnapshotId: snapshot.id,
				subjectId: snapshot.subjectId
			},
			snapshot
		);
		if (graphOutcome.outcome === 'unavailable')
			fail(
				'GRAPH_UNAVAILABLE',
				graphOutcome.diagnostics[0]?.message ?? 'The module-dependency graph was unavailable.',
				'GRAPH'
			);
		assertMemory('GRAPH');
		const graph = graphOutcome.graph;
		const validateGraph = dependencies.validateGraph ?? validateModuleDependencyGraph;
		const graphValidation = validateGraph(graph, snapshot, { maxIssues: 100_000 });
		if (
			graphValidation.state !== 'VALID' ||
			!graph.coverage.reconciles ||
			graph.nodes.length === 0 ||
			graph.edges.length === 0 ||
			graph.coverage.representedSources !== snapshot.sources.length ||
			graph.coverage.representedModuleResolutions !== snapshot.moduleResolutions.length
		)
			fail(
				'GRAPH_INVALID',
				graphValidation.issues[0]?.message ??
					'The module-dependency graph population did not reconcile.',
				'GRAPH'
			);

		const invocationArgs = profile.providerArgs.slice(1);
		const binding: DependencyCruiserInvocationBinding = {
			argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
			baseDir: '.',
			budgets: {
				maxCommandArgs: 100,
				maxDependencies: request.budgets.maxProviderDependencies,
				maxDependents: request.budgets.maxProviderDependencies,
				maxInputPaths: profile.inputPaths.length,
				maxIssues: 100_000,
				maxJsonDepth: 256,
				maxModules: request.budgets.maxProviderModules,
				maxPathLength: 4_096,
				maxRawBytes: request.budgets.maxStdoutBytes,
				maxRules: 1_000_000,
				maxStringLength: 1_000_000,
				maxSummaryViolations: 1_000_000,
				maxTotalStringCharacters: request.budgets.maxStdoutBytes
			},
			command: {
				args: invocationArgs,
				exitStatus: processResult.status,
				finishedAt: finishedAt.toISOString(),
				startedAt: startedAt.toISOString()
			},
			config: { path: CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH, sha256: config.sha256 },
			inputPaths: profile.inputPaths,
			provider: {
				id: DEPENDENCY_CRUISER_PROVIDER_ID,
				version: DEPENDENCY_CRUISER_PROVIDER_VERSION
			},
			providerReportedBaseDir: {
				bytes: Buffer.byteLength(reportedBaseDir, 'utf8'),
				representation: 'ABSOLUTE',
				sha256: sha256(reportedBaseDir),
				state: 'PRESENT'
			},
			raw: { bytes: stdoutBytes, sha256: sha256(providerRaw) },
			rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
			schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
			subjectRoot: {
				bytes: Buffer.byteLength(reportedBaseDir, 'utf8'),
				sha256: sha256(reportedBaseDir)
			},
			subjectId: subject.descriptor.subjectId
		};
		const normalized = normalizeDependencyCruiserOutput(providerRaw, binding);
		assertMemory('NORMALIZE');
		if (normalized.outcome !== 'complete')
			fail(
				'PROVIDER_OUTPUT_INVALID',
				normalized.diagnostics[0]?.message ?? 'dependency-cruiser output normalization failed.',
				'NORMALIZE',
				normalized.diagnostics[0]?.path ?? null
			);
		const observation = normalized.observation;
		if (observation.modules.length === 0 || observation.dependencies.length === 0)
			fail(
				'PROVIDER_OUTPUT_INVALID',
				'dependency-cruiser returned an empty required module or dependency population.',
				'NORMALIZE'
			);

		const assessmentRequest = {
			budgets: {
				comparison: {
					maxComparisonRecords: request.budgets.assessment.maxComparisonRecords,
					maxDiagnostics: request.budgets.assessment.maxDiagnostics,
					maxRationaleCharacters: request.budgets.assessment.maxRationaleCharacters
				},
				maxResultBytes: request.budgets.assessment.maxResultBytes
			},
			configPath: CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH,
			expectedDifferentialDigest: null,
			expectedInputPaths: profile.inputPaths,
			operationVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
			schemaVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
		} as const;
		const discovery = assessDependencyCruiserDifferential(
			assessmentRequest,
			subject,
			snapshot,
			graph,
			observation
		);
		assertMemory('ACCEPT');
		if (
			discovery.outcome !== 'rejected' ||
			discovery.evidence.acceptanceState !== 'BASELINE_REQUIRED'
		)
			fail(
				'DIFFERENTIAL_UNAVAILABLE',
				discovery.diagnostics[0]?.message ?? 'Differential discovery was unavailable.',
				'ACCEPT'
			);
		const assertFinalSubjectCurrentness = (): void => {
			const finalCurrentness = verify(subject, { rootLocator: root });
			if (finalCurrentness.state !== 'CURRENT')
				fail(
					'SUBJECT_CURRENTNESS_FAILED',
					'The FrozenSubject was not current at the final evidence boundary.',
					'CURRENTNESS',
					finalCurrentness.changedPaths[0] ?? null
				);
		};
		const closureAssessment =
			profile.kind === 'G4_SAME_PERIMETER'
				? assessCurrentDependencyCruiserG4Closure(snapshot, graph, observation, discovery.evidence)
				: null;
		if (closureAssessment?.outcome === 'unavailable')
			fail('SAME_PERIMETER_CLOSURE_FAILED', closureAssessment.diagnostic, 'ACCEPT', '$.g4Closure');
		const closureWitness =
			closureAssessment?.outcome === 'closed' ? closureAssessment.witness : null;
		const discoveredClosureDigest =
			closureWitness === null
				? null
				: g4ClosureDigest(discovery.evidence.differentialDigest, closureWitness);
		const reviewedDigest = expectedDigest(request);
		if (reviewedDigest === null) {
			assertFinalSubjectCurrentness();
			if (profile.kind === 'G4_SAME_PERIMETER' && closureWitness !== null)
				return deepFreeze({
					closure: closureWitness,
					diagnostics: [
						{
							code: 'BASELINE_REQUIRED',
							message: 'A reviewed exact same-perimeter closure digest is required.',
							path: '$.expectedClosureDigest',
							phase: 'ACCEPT'
						}
					],
					discovery: discovery.evidence,
					discoveryClosureDigest: discoveredClosureDigest!,
					outcome: 'rejected'
				});
			return deepFreeze({
				diagnostics: [
					{
						code: 'BASELINE_REQUIRED',
						message: 'A reviewed differential digest is required before acceptance.',
						path: '$.expectedDifferentialDigest',
						phase: 'ACCEPT'
					}
				],
				discovery: discovery.evidence,
				outcome: 'rejected'
			});
		}
		if (
			profile.kind === 'G4_SAME_PERIMETER' &&
			(discoveredClosureDigest === null || reviewedDigest !== discoveredClosureDigest)
		) {
			assertFinalSubjectCurrentness();
			return deepFreeze({
				closure: closureWitness!,
				diagnostics: [
					{
						code: 'DIFFERENTIAL_DRIFT',
						message: 'The exact same-perimeter closure does not match the reviewed baseline.',
						path: '$.expectedClosureDigest',
						phase: 'ACCEPT'
					}
				],
				discovery: discovery.evidence,
				discoveryClosureDigest: discoveredClosureDigest!,
				outcome: 'rejected'
			});
		}
		const acceptedDifferentialDigest =
			profile.kind === 'G4_SAME_PERIMETER' ? discovery.evidence.differentialDigest : reviewedDigest;
		const acceptance = assessDependencyCruiserDifferential(
			{ ...assessmentRequest, expectedDifferentialDigest: acceptedDifferentialDigest },
			subject,
			snapshot,
			graph,
			observation
		);
		assertMemory('ACCEPT');
		assertFinalSubjectCurrentness();
		if (acceptance.outcome !== 'accepted')
			return deepFreeze({
				...(profile.kind === 'G4_SAME_PERIMETER' && closureWitness !== null
					? {
							closure: closureWitness,
							discoveryClosureDigest: discoveredClosureDigest!
						}
					: {}),
				diagnostics: [
					{
						code: 'DIFFERENTIAL_DRIFT',
						message: 'The current differential does not match the reviewed baseline.',
						path:
							profile.kind === 'G4_SAME_PERIMETER'
								? '$.expectedClosureDigest'
								: '$.expectedDifferentialDigest',
						phase: 'ACCEPT'
					}
				],
				discovery: discovery.evidence,
				outcome: 'rejected'
			});

		const common = {
			analysisAuthority: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_AUTHORITY,
			capabilityStatus: 'PARTIAL',
			currentness: {
				changedPaths: [],
				checkedAfterProviderExecution: true,
				checkedAtFinalEvidenceBoundary: true,
				declarationContextState: 'CONTEXT_ONLY_NOT_RECHECKED_AFTER_PROVIDER',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT_AT_PROVIDER_AND_FINAL_BOUNDARIES'
			},
			differential: acceptance.evidence,
			execution: {
				args: profile.providerArgs,
				durationMs: Math.max(0, finishedMs - startedMs),
				executable: CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH,
				exitStatus: processResult.status,
				finishedAt: finishedAt.toISOString(),
				networkUse: 'NONE',
				shell: false,
				stageOrder: 'PROVIDER_COMPLETE_BEFORE_SEMANTIC_MATERIALIZATION',
				startedAt: startedAt.toISOString(),
				stderr: { bytes: stderrBytes, sha256: sha256(processResult.stderr) },
				stdout: { bytes: stdoutBytes, sha256: sha256(providerRaw) },
				subjectEntryPoints: [],
				timeoutMs: request.budgets.providerDurationMs
			},
			gateEffect: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_GATE_EFFECT,
			graph: {
				contentDigest: graph.contentDigest,
				edges: graph.edges.length,
				id: graph.id,
				nodes: graph.nodes.length,
				representedModuleResolutions: graph.coverage.representedModuleResolutions,
				representedSources: graph.coverage.representedSources,
				reconciles: true
			},
			provider: {
				config: { path: CURRENT_DEPENDENCY_CRUISER_CONFIG_PATH, sha256: config.sha256 },
				entry: {
					path: CURRENT_DEPENDENCY_CRUISER_ENTRY_PATH,
					sha256: providerEntryDigest
				},
				id: DEPENDENCY_CRUISER_PROVIDER_ID,
				inputPaths: profile.inputPaths,
				lock: { path: CURRENT_DEPENDENCY_CRUISER_LOCK_PATH, sha256: lock.sha256 },
				packageManifest: {
					path: CURRENT_DEPENDENCY_CRUISER_PACKAGE_PATH,
					sha256: providerPackageDigest
				},
				version: DEPENDENCY_CRUISER_PROVIDER_VERSION
			},
			resourceGuard: {
				admittedContextArtifacts: contextPopulation.paths.length,
				admittedContextDirectoryEntries: contextPopulation.directoryEntries,
				admittedManifestDerivedDeclarationRoots: declarationContextRoots.length,
				admittedProviderDependencies: observation.dependencies.length,
				admittedProviderModules: observation.modules.length,
				admittedSubjectIncludeFilters: subject.request.filters.include.length,
				maxContextPopulationRecords: request.budgets.subject.maxFiles,
				maxProcessRssBytes: request.budgets.maxProcessRssBytes,
				maxProviderDependencies: request.budgets.maxProviderDependencies,
				maxProviderModules: request.budgets.maxProviderModules,
				maxRawBytes: request.budgets.maxStdoutBytes,
				memoryCheckpointState: 'WITHIN_BOUND_AT_ALL_OPERATION_CHECKPOINTS',
				rawBytes: stdoutBytes
			},
			semanticSnapshot: {
				contextDigest: snapshot.contextDigest,
				declarationContext: {
					authority: 'CONTEXT_ONLY',
					currentness: 'NOT_RECHECKED_AFTER_PROVIDER',
					manifestDerivedRoots: declarationContextRoots.length,
					source: 'CAPTURED_WORKSPACE_MANIFEST_EXPORTS_TYPES'
				},
				id: snapshot.id,
				moduleResolutions: snapshot.moduleResolutions.length,
				sources: snapshot.sources.length,
				validationState: 'VALID'
			},
			subject: {
				artifacts: subject.artifacts.length,
				contextArtifacts: contextPopulation.paths.length,
				contextConfigurations: contextPopulation.configurations,
				contextWorkspaceManifests: contextPopulation.workspaceManifests,
				dirtyState: subject.descriptor.dirtyState,
				populationReconciles: true,
				projectPaths: CURRENT_DEPENDENCY_CRUISER_PROJECT_PATHS,
				projects: subject.projects.length,
				sourceIncludeFilters: CURRENT_DEPENDENCY_CRUISER_SOURCE_INCLUDE_FILTERS,
				subjectId: subject.descriptor.subjectId,
				workspaces: subject.workspaces.length
			},
			wireShape: 'CLOSED_EXACT'
		} as const;
		const withoutDigest =
			profile.kind === 'G4_SAME_PERIMETER' && closureWitness !== null
				? {
						...common,
						discovery: {
							acceptanceState: 'BASELINE_REQUIRED',
							closureDigest: discoveredClosureDigest!,
							differentialDigest: discovery.evidence.differentialDigest,
							evidenceContentDigest: discovery.evidence.contentDigest
						},
						g4Closure: closureWitness,
						nonclaims: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_NONCLAIMS,
						operationVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION,
						provider: {
							...common.provider,
							inputPaths: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS
						},
						reviewedBaseline: {
							baseDifferentialDigest: discovery.evidence.differentialDigest,
							expectedClosureDigest: reviewedDigest,
							state: 'EXACT_MATCH'
						},
						schemaVersion: CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_SCHEMA_VERSION,
						semanticSnapshot: {
							...common.semanticSnapshot,
							projectionBoundary: 'EXACT_RPH_CONTRACTS_BUILD_ROOT_FILE_PERIMETER'
						}
					}
				: {
						...common,
						discovery: {
							acceptanceState: 'BASELINE_REQUIRED',
							differentialDigest: discovery.evidence.differentialDigest,
							evidenceContentDigest: discovery.evidence.contentDigest
						},
						nonclaims: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_NONCLAIMS,
						operationVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
						provider: {
							...common.provider,
							inputPaths: CURRENT_DEPENDENCY_CRUISER_INPUT_PATHS
						},
						reviewedBaseline: {
							expectedDifferentialDigest: reviewedDigest,
							state: 'EXACT_MATCH'
						},
						schemaVersion: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_SCHEMA_VERSION,
						semanticSnapshot: {
							...common.semanticSnapshot,
							projectionBoundary: 'EXACT_ONE_PROJECT_RPH_CONTRACTS_BUILD_SLICE'
						}
					};
		const evidence = {
			...withoutDigest,
			contentDigest: evidenceDigest(withoutDigest)
		} as unknown as
			CurrentDependencyCruiserDifferentialEvidence | CurrentDependencyCruiserG4ClosureEvidence;
		if (Buffer.byteLength(canonicalJson(evidence), 'utf8') > request.budgets.maxEvidenceBytes)
			fail(
				'EVIDENCE_OVERSIZE',
				'Canonical differential evidence exceeds its byte bound.',
				'EVIDENCE'
			);
		if (profile.kind === 'G4_SAME_PERIMETER')
			return deepFreeze({
				diagnostics: [],
				evidence: evidence as CurrentDependencyCruiserG4ClosureEvidence,
				outcome: 'accepted'
			});
		return deepFreeze({
			diagnostics: [],
			evidence: evidence as CurrentDependencyCruiserDifferentialEvidence,
			outcome: 'accepted'
		});
	} catch (cause) {
		const diagnostic =
			cause instanceof RunnerFailure
				? cause.diagnostic
				: {
						code: 'INTERNAL_FAILURE' as const,
						message: 'The current dependency-cruiser differential failed closed.',
						path: null,
						phase: 'EVIDENCE' as const
					};
		return deepFreeze({ diagnostics: [diagnostic], outcome: 'unavailable' });
	}
}

export function runCurrentDependencyCruiserDifferential(
	request: CurrentDependencyCruiserDifferentialRequest,
	dependencies: CurrentDependencyCruiserDifferentialDependencies = {}
): CurrentDependencyCruiserDifferentialOutcome {
	return runCurrentDependencyCruiserProfile(
		request,
		dependencies,
		BROAD_ASYMMETRIC_PROFILE
	) as CurrentDependencyCruiserDifferentialOutcome;
}

export function runCurrentDependencyCruiserG4Closure(
	request: CurrentDependencyCruiserG4ClosureRequest,
	dependencies: CurrentDependencyCruiserDifferentialDependencies = {}
): CurrentDependencyCruiserG4ClosureOutcome {
	return runCurrentDependencyCruiserProfile(
		request,
		dependencies,
		G4_SAME_PERIMETER_PROFILE
	) as CurrentDependencyCruiserG4ClosureOutcome;
}
