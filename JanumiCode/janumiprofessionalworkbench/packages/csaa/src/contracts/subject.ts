export const SUBJECT_REQUEST_SCHEMA_VERSION = 'jan-csaa-subject-request/1.1.0' as const;
export const SUBJECT_SCHEMA_VERSION = 'jan-csaa-subject/1.1.0' as const;
export const SUBJECT_POLICY_VERSION = 'jan-csaa-subject-policy/1.1.0' as const;
export const SUBJECT_ID_ALGORITHM_VERSION = '1' as const;

export type SubjectKind = 'WORKTREE';
export type SubjectCompleteness = 'COMPLETE' | 'PARTIAL';
export type ArtifactDisposition = 'ANALYZED' | 'INVENTORY_ONLY' | 'EXCLUDED';

export type ArtifactPrimaryClass =
	| 'MANIFEST'
	| 'LOCKFILE'
	| 'TOOL_CONFIGURATION'
	| 'PROJECT_CONFIGURATION'
	| 'GENERATED_CONFIGURATION'
	| 'PRODUCTION_SOURCE'
	| 'TEST_SOURCE'
	| 'GENERATOR_SOURCE'
	| 'GENERATED_SOURCE'
	| 'SCRIPT'
	| 'VERIFICATION'
	| 'BUILD_OUTPUT'
	| 'CACHE'
	| 'EXTERNAL_DEPENDENCY'
	| 'VENDOR'
	| 'OTHER';

export type ArtifactSemanticRole =
	| 'ANALYSIS_INPUT'
	| 'COMPILER_CANDIDATE'
	| 'CONFIGURATION'
	| 'EXPORT_DECLARATION'
	| 'FRAMEWORK_CANDIDATE'
	| 'GENERATED'
	| 'GENERATOR'
	| 'MANIFEST'
	| 'PRODUCTION'
	| 'SCRIPT'
	| 'TEST'
	| 'VERIFICATION';

export type SubjectDiagnosticCode =
	| 'ADDITIONAL_ARTIFACT_REQUIRED_MISSING'
	| 'ABSOLUTE_FILTER_FORBIDDEN'
	| 'BUDGET_EXCEEDED'
	| 'CANONICAL_PATH_COLLISION'
	| 'CONFIG_CLOSURE_CYCLE'
	| 'CONFIG_DIAGNOSTIC'
	| 'CONFIG_MALFORMED'
	| 'CONFIG_REQUIRED_MISSING'
	| 'EMPTY_SUBJECT'
	| 'FILTER_INVALID'
	| 'GENERATED_CONTEXT_ABSENT'
	| 'GENERATED_CONTEXT_FRESHNESS_UNKNOWN'
	| 'PATH_ESCAPE'
	| 'PROJECT_AMBIGUOUS'
	| 'PROJECT_NOT_FOUND'
	| 'READ_FAILED'
	| 'RECONCILIATION_FAILED'
	| 'REFERENCE_CYCLE'
	| 'REFERENCE_REQUIRED_MISSING'
	| 'REPOSITORY_ROOT_INVALID'
	| 'SUBJECT_CHANGED_DURING_RESOLUTION'
	| 'SYMLINK_ESCAPE'
	| 'TYPESCRIPT_PROJECT_PARTIAL'
	| 'UNSUPPORTED_REQUEST_VERSION';

export interface SubjectDiagnostic {
	readonly code: SubjectDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'CAPTURE' | 'RESOLVE' | 'RECHECK' | 'FRESHNESS';
	readonly severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface SubjectBudgets {
	readonly maxBytes: number;
	readonly maxConfigDepth: number;
	readonly maxDiagnostics: number;
	readonly maxDurationMs: number;
	readonly maxFiles: number;
	readonly maxProjects: number;
}

export interface SubjectFilters {
	readonly exclude: readonly string[];
	readonly include: readonly string[];
}

export type SubjectScope =
	| { readonly kind: 'REPOSITORY' }
	| {
			readonly additionalArtifacts?: readonly string[];
			readonly kind: 'EXPLICIT_PROJECTS';
			readonly projects: readonly string[];
	  };

export interface ResolveSubjectRequest {
	readonly budgets: SubjectBudgets;
	readonly expectEmpty?: boolean;
	readonly filters: SubjectFilters;
	readonly generatedContextEvidence?: readonly GeneratedContextEvidence[];
	readonly operationVersion: string;
	readonly outputs: readonly string[];
	readonly policyVersion: typeof SUBJECT_POLICY_VERSION;
	readonly rootLocator: string;
	readonly schemaVersion: typeof SUBJECT_REQUEST_SCHEMA_VERSION;
	readonly scope: SubjectScope;
	readonly subjectKind: SubjectKind;
}

export interface GeneratedContextEvidence {
	readonly generatorInputDigest: string;
	readonly path: string;
	readonly recordedInputDigest: string;
	readonly source: string;
}

export interface CapturedArtifactRecord {
	readonly bytes: number;
	readonly canonicalPathKey: string;
	readonly disposition: ArtifactDisposition;
	readonly path: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly reason: string;
	readonly roles: readonly ArtifactSemanticRole[];
	readonly sha256: string;
}

export interface ExcludedArtifactRecord {
	readonly canonicalPathKey: string;
	readonly disposition: 'EXCLUDED';
	readonly path: string;
	readonly physicalFileCount: number | 'UNKNOWN';
	readonly policyId: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly reason: string;
	readonly roles: readonly ArtifactSemanticRole[];
}

export interface WorkspaceSubjectRecord {
	readonly exports: readonly WorkspaceExportRecord[];
	readonly kind: 'APP' | 'PACKAGE';
	readonly manifestPath: string;
	readonly name: string;
	readonly path: string;
	readonly private: boolean;
	readonly provenance: readonly string[];
	readonly workspacePatterns: readonly string[];
}

export interface WorkspaceExportRecord {
	readonly conditions: readonly string[];
	readonly exportName: string;
	readonly target: string | null;
}

export interface ConfigurationClosureRecord {
	readonly path: string;
	readonly requiredBy: readonly string[];
	readonly sha256: string;
}

export interface ProjectReferenceRecord {
	readonly fromProject: string;
	readonly toProject: string;
}

export interface ProgramRecipe {
	readonly compilerOptions: Readonly<Record<string, unknown>>;
	readonly configClosureDigest: string;
	readonly configPath: string;
	readonly kind: 'PROJECT' | 'BUILD' | 'SOLUTION';
	readonly projectReferences: readonly string[];
	readonly projectResolutionDigest: string;
	readonly provider: { readonly id: 'typescript'; readonly version: string };
	readonly rootNames: readonly string[];
}

export interface ProjectSubjectRecord {
	readonly configClosure: readonly ConfigurationClosureRecord[];
	readonly configPath: string;
	readonly effectiveCompilerOptions: Readonly<Record<string, unknown>>;
	readonly fileNames: readonly string[];
	readonly frameworkCandidates: readonly string[];
	readonly kind: 'PROJECT' | 'BUILD' | 'SOLUTION';
	readonly projectReferences: readonly string[];
	readonly programRecipe: ProgramRecipe;
	readonly rawCompilerOptions: Readonly<Record<string, unknown>>;
	readonly rawExclude: readonly string[] | null;
	readonly rawExtends: string | readonly string[] | null;
	readonly rawFiles: readonly string[] | null;
	readonly rawInclude: readonly string[] | null;
	readonly rootDisposition: 'COMPILER_ROOTS' | 'INTENTIONAL_EMPTY_SOLUTION' | 'INCOMPLETE';
	readonly status: 'COMPLETE' | 'PARTIAL';
	readonly typescriptDiagnostics: readonly SubjectDiagnostic[];
}

export interface GeneratedContextRecord {
	readonly consumerProject: string;
	readonly freshness: 'CURRENT' | 'STALE' | 'UNKNOWN';
	readonly freshnessBasis: string;
	readonly freshnessEvidence: readonly string[];
	readonly path: string;
	readonly selectedInput: boolean;
	readonly sha256: string;
}

export interface PopulationReconciliation {
	readonly analyzed: number;
	readonly discovered: number;
	readonly excluded: number;
	readonly failed: number;
	readonly included: number;
	readonly inventoryOnly: number;
	readonly reconciles: boolean;
}

export interface SubjectDescriptor {
	readonly configurationDigest: string;
	readonly exclusionPolicyIds: readonly string[];
	readonly excludedClasses: readonly {
		readonly physicalFileCount: number | 'UNKNOWN';
		readonly primaryClass: ArtifactPrimaryClass;
		readonly recordCount: number;
	}[];
	readonly fileManifestDigest: string;
	readonly dirtyState: 'UNKNOWN';
	readonly operationVersion: string;
	readonly parentRevision: null;
	readonly perimeter: readonly string[];
	readonly policyVersion: typeof SUBJECT_POLICY_VERSION;
	readonly repositoryRoot: '.';
	readonly revision: null;
	readonly schemaVersion: typeof SUBJECT_SCHEMA_VERSION;
	readonly subjectId: string;
	readonly subjectKind: SubjectKind;
}

export interface FrozenSubject {
	readonly artifacts: readonly CapturedArtifactRecord[];
	readonly descriptor: SubjectDescriptor;
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly excludedArtifacts: readonly ExcludedArtifactRecord[];
	readonly generatedContexts: readonly GeneratedContextRecord[];
	readonly population: PopulationReconciliation;
	readonly projects: readonly ProjectSubjectRecord[];
	readonly request: Omit<ResolveSubjectRequest, 'rootLocator'> & {
		readonly rootLocator: '<runtime>';
	};
	readonly workspaces: readonly WorkspaceSubjectRecord[];
}

interface ResolutionFailureBase {
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly subject?: never;
}

export type SubjectResolutionOutcome =
	| {
			readonly completeness: SubjectCompleteness;
			readonly diagnostics: readonly SubjectDiagnostic[];
			readonly outcome: 'resolved';
			readonly subject: FrozenSubject;
	  }
	| (ResolutionFailureBase & { readonly outcome: 'not-found' })
	| (ResolutionFailureBase & { readonly outcome: 'ambiguous' })
	| (ResolutionFailureBase & { readonly outcome: 'forbidden' })
	| (ResolutionFailureBase & { readonly outcome: 'unavailable' })
	| (ResolutionFailureBase & { readonly outcome: 'incompatible' });

export type FrozenSubjectFreshness =
	| {
			readonly changedPaths: readonly string[];
			readonly diagnostics: readonly SubjectDiagnostic[];
			readonly state: 'CURRENT';
	  }
	| {
			readonly changedPaths: readonly string[];
			readonly diagnostics: readonly SubjectDiagnostic[];
			readonly state: 'STALE';
	  }
	| {
			readonly changedPaths: readonly string[];
			readonly diagnostics: readonly SubjectDiagnostic[];
			readonly state: 'UNAVAILABLE';
	  };
