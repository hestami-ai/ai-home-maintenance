import type { FrozenWorkingChangeSet } from './working-change-set.js';
import type { ArtifactPrimaryClass } from './artifact-class.js';

export type { ArtifactPrimaryClass } from './artifact-class.js';

export const SUBJECT_REQUEST_SCHEMA_VERSION = 'jan-csaa-subject-request/2.0.0' as const;
export const SUBJECT_SCHEMA_VERSION = 'jan-csaa-subject/2.0.0' as const;
export const SUBJECT_POLICY_VERSION = 'jan-csaa-subject-policy/2.0.0' as const;
// JAN-CSAA-001 W4 fixes the v1 domain preimage around configurationDigest rather than
// freezing the internal configuration-preimage schema. The schema/policy versions above
// therefore govern the additive test-population and generated-context inputs to that digest.
export const SUBJECT_ID_ALGORITHM_VERSION = '1' as const;
export const GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-generated-context-evidence/1.0.0' as const;
export const GENERATED_CONTEXT_INPUT_SELECTION_METHOD =
	'workspace-non-output-artifacts-plus-root-repository-context/1.0.0' as const;
export const GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD =
	'captured-consumed-generated-configuration-and-declarations/1.0.0' as const;
export const GENERATED_CONTEXT_GENERATOR_IDENTITY_METHOD =
	'bounded-runtime-config-and-installed-dependency-closure/2.0.0' as const;
export const GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID =
	'@sveltejs/kit:svelte-kit-sync' as const;

export const GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION =
	'jan-csaa-generated-context-execution-manifest/2.0.0' as const;

export type SubjectKind = 'WORKTREE';
export type SubjectCompleteness = 'COMPLETE' | 'PARTIAL';
export type ArtifactDisposition = 'ANALYZED' | 'INVENTORY_ONLY' | 'EXCLUDED';

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
	| 'GENERATED_CONTEXT_EVIDENCE_INVALID'
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
	| 'TEST_POPULATION_PARTIAL'
	| 'TYPESCRIPT_PROJECT_PARTIAL'
	| 'WORKING_CHANGE_SET_CHANGED_DURING_RESOLUTION'
	| 'WORKING_CHANGE_SET_INCOMPATIBLE'
	| 'WORKING_CHANGE_SET_UNAVAILABLE'
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

export interface GeneratedContextGeneratorIdentity {
	readonly id: string;
	readonly implementationDigest: string;
	readonly version: string;
}

export interface GeneratedContextExecutionConfigurationRecord {
	readonly imports: readonly string[];
	readonly path: string;
	readonly sha256: string;
}

export interface GeneratedContextExecutionPackageRecord {
	readonly bytes: number;
	readonly fileCount: number;
	readonly integrity: string;
	readonly locator: string;
	readonly lockKey: string;
	readonly manifestSha256: string;
	readonly name: string;
	readonly treeSha256: string;
	readonly version: string;
}

export interface GeneratedContextExecutionMissingOptionalRecord {
	readonly issuer: string;
	readonly name: string;
}

export interface GeneratedContextExecutionReadGrant {
	readonly kind: 'ABSENT_PATH' | 'DIRECTORY' | 'FILE';
	readonly path: string;
}

export interface GeneratedContextExecutionRuntimeRecord {
	readonly architecture: string;
	readonly engine: 'node';
	readonly executableBytes: number;
	readonly executableSha256: string;
	readonly platform: string;
	readonly version: string;
	readonly versionsDigest: string;
}

export interface GeneratedContextExecutionManifest {
	readonly containmentPolicy: 'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0';
	readonly configurationEntrypoints: readonly GeneratedContextExecutionConfigurationRecord[];
	readonly environment: readonly { readonly name: string; readonly value: string }[];
	readonly environmentPolicy: 'closed-svelte-kit-sync-environment/1.0.0';
	readonly executionLimitations: readonly [
		'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
		'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
		'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
	];
	readonly invocation: readonly ['svelte-kit.js', 'sync', '--mode', 'production'];
	readonly generatedOutputRoot: {
		readonly access: 'READ_WRITE';
		readonly baseline: 'EMPTY_PHYSICAL_DIRECTORY';
		readonly path: string;
		readonly replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION';
	};
	readonly lockfile: {
		readonly path: 'bun.lock';
		readonly sha256: string;
	};
	readonly missingOptionalPackages: readonly GeneratedContextExecutionMissingOptionalRecord[];
	readonly packages: readonly GeneratedContextExecutionPackageRecord[];
	readonly readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0';
	readonly repositoryReadGrants: readonly GeneratedContextExecutionReadGrant[];
	readonly runtime: GeneratedContextExecutionRuntimeRecord;
	readonly scratchRoots: readonly [
		{
			readonly access: 'READ_WRITE';
			readonly baseline: 'EMPTY_PHYSICAL_DIRECTORY';
			readonly lifecycle: 'RESET_BEFORE_EACH_SYNCHRONIZATION_AND_RESTORE_AFTER_OPERATION';
			readonly path: 'node_modules/.vite-temp';
		}
	];
	readonly schemaVersion: typeof GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION;
}

export interface GeneratedContextEvidence {
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly path: string;
	/** Captured canonical JSON GeneratedContextEvidenceRecord. */
	readonly source: string;
}

export interface GeneratedContextInputRecord {
	readonly artifactClass: ArtifactPrimaryClass;
	readonly bytes: number;
	readonly path: string;
	readonly sha256: string;
}

export interface GeneratedContextOutputRecord {
	readonly artifactClass: ArtifactPrimaryClass;
	readonly bytes: number;
	readonly path: string;
	readonly sha256: string;
}

export interface GeneratedContextEvidenceRecord {
	readonly executionManifest: GeneratedContextExecutionManifest;
	readonly executionManifestDigest: string;
	readonly generatedContext: {
		readonly path: string;
		readonly sha256: string;
	};
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly generatedOutputManifest: readonly GeneratedContextOutputRecord[];
	readonly generatedOutputManifestDigest: string;
	readonly inputManifest: readonly GeneratedContextInputRecord[];
	readonly inputManifestDigest: string;
	readonly inputSelectionMethod: typeof GENERATED_CONTEXT_INPUT_SELECTION_METHOD;
	readonly outputSelectionMethod: typeof GENERATED_CONTEXT_OUTPUT_SELECTION_METHOD;
	readonly schemaVersion: typeof GENERATED_CONTEXT_EVIDENCE_SCHEMA_VERSION;
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
	readonly generator: GeneratedContextGeneratorIdentity | null;
	readonly outputManifestDigest: string;
	readonly outputPaths: readonly string[];
	readonly path: string;
	readonly selectedInput: boolean;
	readonly sha256: string;
}

export type TestPopulationProvider = 'VITEST' | 'PLAYWRIGHT';
export type TestPopulationStatus = 'COMPLETE' | 'PARTIAL';

export interface TestPopulationRecord {
	readonly configurationPaths: readonly string[];
	readonly discovered: number;
	readonly discoveryMethod: string;
	readonly excluded: number;
	readonly excludePatterns: readonly string[];
	readonly excludedPaths: readonly string[];
	readonly failed: number;
	readonly id: string;
	readonly includePatterns: readonly string[];
	readonly included: number;
	readonly includedPaths: readonly string[];
	readonly limitations: readonly string[];
	/** Stable logical identity for this configured provider/profile lane. */
	readonly profileId: string;
	readonly populationClosure: 'CLOSED_FOR_CAPTURED_TEST_ARTIFACTS' | 'OPEN';
	readonly profile: string;
	readonly provider: TestPopulationProvider;
	readonly provenance: readonly string[];
	readonly reconciles: boolean;
	/** Content identity of the resolved selection and its explicit frontier. */
	readonly selectionDigest: string;
	readonly status: TestPopulationStatus;
}

export interface PopulationReconciliation {
	readonly analyzed: number;
	/** Count of serialized included and excluded artifact records. */
	readonly capturedRecords: number;
	readonly capturedRecordsReconcile: true;
	/** Known physical-file lower bound; collapsed excluded directories do not fabricate a count. */
	readonly discovered: number;
	/** Exact discovered physical-file population, or UNKNOWN when an exclusion was not enumerated. */
	readonly discoveredPhysicalFiles: number | 'UNKNOWN';
	readonly excluded: number;
	readonly excludedRecords: number;
	/**
	 * Exact physical excluded-file count when every collapsed excluded directory was enumerated.
	 * `UNKNOWN` prevents record-level reconciliation from being misread as physical completeness.
	 */
	readonly excludedPhysicalFiles: number | 'UNKNOWN';
	readonly failed: number;
	readonly included: number;
	readonly includedDispositionReconciles: true;
	readonly inventoryOnly: number;
	readonly knownPhysicalLowerBoundReconciles: true;
	/** Reconciliation of the serialized included/excluded records, not necessarily physical files. */
	readonly reconciles: boolean;
	readonly reconciliationScope: 'EXACT_PHYSICAL_POPULATION' | 'CAPTURED_RECORDS_ONLY';
	readonly physicalPopulationReconciles: true | 'UNKNOWN';
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
	readonly dirtyState: 'CLEAN' | 'DIRTY' | 'UNKNOWN';
	readonly operationVersion: string;
	readonly parentRevision: string | null;
	readonly perimeter: readonly string[];
	readonly policyVersion: typeof SUBJECT_POLICY_VERSION;
	readonly repositoryRoot: '.';
	readonly revision: string | null;
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
	readonly testPopulations: readonly TestPopulationRecord[];
	readonly workspaces: readonly WorkspaceSubjectRecord[];
	/** Plain serialized Git evidence when resolved through resolveWorkingSubject; null otherwise. */
	readonly workingChangeSet: FrozenWorkingChangeSet | null;
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
