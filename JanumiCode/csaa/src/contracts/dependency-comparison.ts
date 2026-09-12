import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphId,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphRelationKind
} from './graph.js';
import type {
	SemanticModuleResolutionRecord,
	SemanticSnapshotId,
	SemanticSourceId
} from './semantic.js';
import { FULL_JAN_CSAA_007_CONFORMANCE } from './semantic.js';

export const DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION =
	'jan-csaa-dependency-provider-comparison-request/1.0.0' as const;
export const DEPENDENCY_PROVIDER_COMPARISON_SCHEMA_VERSION =
	'jan-csaa-dependency-provider-comparison/1.0.0' as const;
export const DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION =
	'jan-csaa-compare-dependency-providers/0.1.0' as const;
export const DEPENDENCY_PROVIDER_COMPARISON_CANONICAL_PROFILE =
	'jan-csaa-dependency-provider-comparison-canonical/1.0.0' as const;
export const DEPENDENCY_PROVIDER_COMPARISON_METHOD =
	'compiler-occurrence-to-dependency-cruiser-aggregate-correlation/1.0.0' as const;

declare const dependencyProviderComparisonBrand: unique symbol;
export type DependencyProviderComparisonId = string & {
	readonly [dependencyProviderComparisonBrand]: 'DependencyProviderComparison';
};
export type DependencyProviderComparisonRecordId = string & {
	readonly [dependencyProviderComparisonBrand]: 'DependencyProviderComparisonRecord';
};

export type DependencyProviderResolutionContextState = 'NOT_EQUIVALENT' | 'UNKNOWN';

export interface DependencyProviderResolutionContext {
	/** Digest of the complete compiler resolution context used for this assessment. */
	readonly compilerContextDigest: string;
	/** Digest of the complete dependency-cruiser resolution context used for this assessment. */
	readonly providerContextDigest: string;
	readonly rationale: string;
	readonly state: DependencyProviderResolutionContextState;
}

export type DependencyProviderNegativeCoverageState = 'OPEN' | 'UNKNOWN';

export interface DependencyProviderNegativeCoverage {
	/**
	 * This first comparison contract cannot establish closed negative coverage. A future
	 * contract may accept a separately validated perimeter attestation.
	 */
	readonly rationale: string;
	readonly state: DependencyProviderNegativeCoverageState;
}

export interface DependencyProviderComparisonBudgets {
	readonly maxComparisonRecords: number;
	readonly maxDiagnostics: number;
	readonly maxRationaleCharacters: number;
}

export interface CompareDependencyProvidersRequest {
	readonly budgets: DependencyProviderComparisonBudgets;
	readonly dependencyCruiserObservationId: string;
	readonly graphId: ModuleDependencyGraphId;
	readonly negativeCoverage: DependencyProviderNegativeCoverage;
	readonly operationVersion: typeof DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION;
	readonly resolutionContext: DependencyProviderResolutionContext;
	readonly schemaVersion: typeof DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type DependencyProviderComparisonAssessment =
	'AGREEMENT' | 'CORROBORATION' | 'INCOMPARABLE' | 'OBSERVED_DIFFERENCE';

export type DependencyProviderComparisonDisposition =
	| 'AGREE_EXACT_TARGET'
	| 'AGREE_UNRESOLVED'
	| 'AGREE_TARGET_CLASS'
	| 'CORROBORATED_COLLAPSED_RELATION'
	| 'PRESENCE_ONLY_TARGET_MODEL_DIFFERENT'
	| 'INCOMPARABLE_EXCLUDED_OR_OUTSIDE_PERIMETER'
	| 'INCOMPARABLE_PROVIDER_DOMAIN'
	| 'INCOMPARABLE_RESOLUTION_CONTEXT'
	| 'UNKNOWN_PROVIDER_PARTIAL'
	| 'AMBIGUOUS_AGGREGATE'
	| 'OBSERVED_MISSING_RELATION'
	| 'OBSERVED_RESOLUTION_STATE_DIFFERENCE'
	| 'OBSERVED_TARGET_DIFFERENCE';

export type DependencyProviderModuleSystem = 'amd' | 'cjs' | 'es6' | 'tsd' | 'unknown';

export interface DependencyProviderComparisonKey {
	readonly importerBinding: 'AMBIGUOUS_GRAPH_SOURCES' | 'EXACT_GRAPH_SOURCE' | 'NO_GRAPH_SOURCE';
	/** Null for a provider source with zero or multiple matching compiler source identities. */
	readonly importerSemanticSourceId: SemanticSourceId | null;
	readonly moduleSystem: DependencyProviderModuleSystem;
	/** `node:` is normalized only for Node built-ins. Null represents non-literal compiler syntax. */
	readonly normalizedSpecifier: string | null;
	readonly sourcePath: string;
	/**
	 * The current compiler graph cannot reproduce dependency-cruiser's syntax-level type-only
	 * partition. This field makes the deliberately coarser join explicit.
	 */
	readonly typeOnlyPartition: 'COARSENED_NOT_COMPARED';
}

export interface CompilerDependencyComparisonEvidence {
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly occurrenceCount: number;
	readonly relationKinds: readonly ModuleDependencyGraphRelationKind[];
	readonly resolutionStates: readonly SemanticModuleResolutionRecord['resolutionState'][];
	readonly targetLogicalPaths: readonly string[];
	readonly targetNodeIds: readonly ModuleDependencyGraphNodeId[];
}

export type DependencyCruiserComparisonTargetKind =
	'CORE_MODULE' | 'EXTERNAL_MODULE' | 'RESOLVED_LOCAL_PATH' | 'UNRESOLVED';

export interface DependencyCruiserDependencyComparisonEvidence {
	readonly dependencyIds: readonly string[];
	readonly dependencyTypes: readonly string[];
	readonly rowCount: number;
	readonly targetKinds: readonly DependencyCruiserComparisonTargetKind[];
	readonly targetLogicalPaths: readonly string[];
}

export interface DependencyProviderComparisonRecord {
	readonly assessment: DependencyProviderComparisonAssessment;
	readonly compiler: CompilerDependencyComparisonEvidence;
	readonly dependencyCruiser: DependencyCruiserDependencyComparisonEvidence;
	readonly disposition: DependencyProviderComparisonDisposition;
	readonly id: DependencyProviderComparisonRecordId;
	readonly key: DependencyProviderComparisonKey;
	readonly rationale: string;
}

export type DependencyProviderComparisonLimitationKind =
	| 'CONFLICT_QUALIFICATION_UNAVAILABLE'
	| 'NEGATIVE_COVERAGE_NOT_CLOSED'
	| 'PROVIDER_AGGREGATES_OCCURRENCES'
	| 'PROVIDER_DOMAIN_OUTSIDE_COMPILER_GRAPH'
	| 'RESOLUTION_CONTEXT_NOT_PROVEN_EQUIVALENT'
	| 'TARGET_MODEL_DIFFERENCE'
	| 'TYPE_ONLY_PARTITION_NOT_REPRODUCED';

export interface DependencyProviderComparisonLimitation {
	readonly affectedRecordCount: number;
	readonly kind: DependencyProviderComparisonLimitationKind;
	readonly rationale: string;
}

export interface DependencyProviderComparisonCoverage {
	readonly agreementRecords: number;
	readonly compilerEdgesRepresented: number;
	readonly compilerEdgesTotal: number;
	readonly corroborationRecords: number;
	readonly dependencyCruiserDependenciesRepresented: number;
	readonly dependencyCruiserDependenciesTotal: number;
	readonly incomparableRecords: number;
	readonly observedDifferenceRecords: number;
	readonly reconciles: boolean;
	readonly recordCount: number;
}

export interface DependencyProviderComparisonSnapshot {
	readonly canonicalProfile: typeof DEPENDENCY_PROVIDER_COMPARISON_CANONICAL_PROFILE;
	readonly comparisonContextDigest: string;
	readonly contentDigest: string;
	readonly coverage: DependencyProviderComparisonCoverage;
	readonly dependencyCruiserObservationId: string;
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly graphId: ModuleDependencyGraphId;
	readonly health: 'COMPLETE' | 'PARTIAL';
	readonly id: DependencyProviderComparisonId;
	readonly limitations: readonly DependencyProviderComparisonLimitation[];
	readonly method: typeof DEPENDENCY_PROVIDER_COMPARISON_METHOD;
	readonly negativeCoverage: DependencyProviderNegativeCoverage;
	readonly operationVersion: typeof DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION;
	readonly records: readonly DependencyProviderComparisonRecord[];
	readonly resolutionContext: DependencyProviderResolutionContext;
	readonly schemaVersion: typeof DEPENDENCY_PROVIDER_COMPARISON_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type DependencyProviderComparisonDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'GRAPH_INVALID'
	| 'IDENTITY_MISMATCH'
	| 'OBSERVATION_INVALID'
	| 'REQUEST_INVALID';

export interface DependencyProviderComparisonDiagnostic {
	readonly code: DependencyProviderComparisonDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
}

export type DependencyProviderComparisonOutcome =
	| {
			readonly comparison: DependencyProviderComparisonSnapshot;
			readonly diagnostics: readonly DependencyProviderComparisonDiagnostic[];
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly comparison?: never;
			readonly diagnostics: readonly DependencyProviderComparisonDiagnostic[];
			readonly outcome: 'unavailable';
	  };
