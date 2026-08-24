import type {
	ArtifactPrimaryClass,
	GeneratedContextRecord,
	ProgramRecipe,
	SubjectDiagnostic,
	WorkspaceSubjectRecord
} from './subject.js';

export const INVENTORY_SCHEMA_VERSION = 'jan-csaa-005.inventory/2.0.0' as const;
export const INVENTORY_GENERATOR_ID = 'jan-csaa-inventory' as const;
export const INVENTORY_GENERATOR_VERSION = '0.2.0' as const;

export type KnowledgeState =
	| 'IMPLEMENTED'
	| 'CONFIGURED_NOT_RUN'
	| 'UNIMPLEMENTED'
	| 'NOT_CONFIGURED'
	| 'NOT_RUN'
	| 'PARTIAL'
	| 'UNKNOWN';

export type ArtifactClass =
	'SOURCE' | 'TEST' | 'GENERATED_SOURCE' | 'CONFIGURATION' | 'SCRIPT' | 'VERIFICATION' | 'OTHER';

export interface SelectedFileRecord {
	readonly artifactClass: ArtifactClass;
	readonly bytes: number;
	readonly path: string;
	readonly sha256: string;
	readonly subjectArtifactClass: ArtifactPrimaryClass;
}

export interface ExclusionRecord {
	readonly countState: 'PHYSICAL_POPULATION_ENUMERATED' | 'PHYSICAL_POPULATION_NOT_ENUMERATED';
	readonly excludedPhysicalFileCount: number | null;
	readonly id: string;
	readonly includedFileCount: 0;
	readonly physicalPopulationState: 'EXCLUDED_AFTER_ENUMERATION' | 'EXCLUDED_BEFORE_ENUMERATION';
	readonly policyRuleCount: number;
	readonly rules: readonly string[];
}

export interface InventorySubjectDescriptor {
	readonly configurationDigest: string;
	readonly configurationPreimage: {
		readonly artifacts: readonly {
			readonly artifactClass: ArtifactPrimaryClass;
			readonly bytes: number;
			readonly path: string;
			readonly sha256: string;
		}[];
		readonly generatedContexts: readonly {
			readonly consumerProject: string;
			readonly path: string;
			readonly selectedInput: boolean;
			readonly sha256: string;
		}[];
		readonly projects: readonly ProgramRecipe[];
		readonly workspaces: readonly WorkspaceSubjectRecord[];
	};
	readonly dirtyState: 'UNKNOWN';
	readonly exclusionPolicyIds: readonly string[];
	readonly excludedClasses: readonly ExclusionRecord[];
	readonly fileManifestDigest: string;
	readonly generatedContexts: readonly GeneratedContextRecord[];
	readonly parentRevision: null;
	readonly perimeter: readonly string[];
	readonly repositoryRoot: '.';
	readonly revision: null;
	readonly resolutionCompleteness: 'COMPLETE' | 'PARTIAL';
	readonly resolutionDiagnostics: readonly SubjectDiagnostic[];
	readonly schemaVersion: 'jan-csaa-subject/1.1.0';
	readonly selectedFileCount: number;
	readonly selectedFiles: readonly SelectedFileRecord[];
	readonly subjectId: string;
	readonly subjectKind: 'WORKTREE';
}

export interface DependencyDeclaration {
	readonly name: string;
	readonly scope: 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies';
	readonly specifier: string;
}

export interface WorkspaceInventory {
	readonly dependencies: readonly DependencyDeclaration[];
	readonly exportsState: 'DECLARED' | 'NOT_DECLARED';
	readonly kind: 'APP' | 'PACKAGE';
	readonly manifestPath: string;
	readonly name: string;
	readonly path: string;
	readonly private: boolean;
	readonly provenance: readonly string[];
	readonly scripts: Readonly<Record<string, string>>;
	readonly version: string | null;
}

export interface TypeScriptProjectInventory {
	readonly candidateArtifactCount: number;
	readonly compilerOptions: Readonly<Record<string, unknown>>;
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly diagnosticsState: 'RUN';
	readonly exclude: readonly string[] | null;
	readonly extends: string | readonly string[] | null;
	readonly files: readonly string[] | null;
	readonly frameworkCandidates: readonly string[];
	readonly generatedContexts: readonly GeneratedContextRecord[];
	readonly include: readonly string[] | null;
	readonly partialityReasons: readonly TypeScriptProjectPartialityReason[];
	readonly parseState: 'PARSED';
	readonly path: string;
	readonly provenance: readonly string[];
	readonly references: readonly string[];
	readonly resolvedRootFiles: readonly string[];
	readonly resolvedRootState: 'RESOLVED_DWP002';
	readonly rootDisposition: 'COMPILER_ROOTS' | 'INTENTIONAL_EMPTY_SOLUTION' | 'INCOMPLETE';
	readonly semanticOptionCoverage: 'COMPLETE_RAW_DECLARATION';
	readonly status: 'COMPLETE' | 'PARTIAL';
}

export interface TypeScriptProjectPartialityReason {
	readonly code:
		| SubjectDiagnostic['code']
		| 'FRAMEWORK_CANDIDATES_PRESENT'
		| 'GENERATED_CONTEXT_STALE'
		| 'ROOT_DISPOSITION_INCOMPLETE';
	readonly message: string;
	readonly path: string | null;
	readonly provenance: readonly string[];
}

export interface CommandInventory {
	readonly categories: readonly string[];
	readonly command: string;
	readonly name: string;
	readonly owner: string;
	readonly provenance: readonly string[];
	readonly state: 'CONFIGURED_NOT_RUN';
}

export type AnalyzerDisposition =
	'CSAA_NATIVE' | 'RETAIN_DELEGATED' | 'WRAP' | 'PORT' | 'RETIRE_AFTER_EQUIVALENCE';

export interface VerificationAssetInventory {
	readonly associatedBaselines: readonly string[];
	readonly assertedPopulation: string;
	readonly contentSha256: string;
	readonly disposition: AnalyzerDisposition;
	readonly extractionMethod:
		| 'TYPESCRIPT_AST'
		| 'FILESYSTEM_OR_TEXT'
		| 'VITEST_EXECUTABLE_ASSERTION'
		| 'DECLARED_STATIC_DATA'
		| 'IMPORTED_EXECUTABLE_LOGIC';
	readonly gateCarriers: readonly string[];
	readonly path: string;
	readonly provenance: readonly string[];
	readonly role: 'ANALYZER' | 'TEST' | 'RUNTIME_GUARD' | 'SCRIPT' | 'SUPPORT_DATA';
}

export interface ProviderInventory {
	readonly adapterCapabilities: readonly string[];
	readonly adapterState: 'INVENTORY_INTEGRATED' | 'UNIMPLEMENTED';
	readonly configurationState: 'CONFIGURED' | 'NOT_CONFIGURED';
	readonly configuredState: KnowledgeState;
	readonly gateState: 'GATE_WIRED' | 'NOT_GATE_WIRED';
	readonly installationState: 'LOCKED' | 'NOT_LOCKED';
	readonly name: string;
	readonly potentialCapabilities: readonly string[];
	readonly provenance: readonly string[];
	readonly version: string | null;
}

export interface CapabilityInventory {
	readonly id: string;
	readonly provider: string | null;
	readonly provenance: readonly string[];
	readonly state: KnowledgeState;
	readonly explanation: string;
}

export interface ArtifactPopulation {
	readonly artifactClass: ArtifactClass;
	readonly discovered: number | 'UNKNOWN';
	readonly excluded: number | 'UNKNOWN';
	readonly failed: number;
	readonly included: number;
	readonly provenance: readonly string[];
	readonly successfullyInventoried: number;
}

export interface UnknownInventory {
	readonly provenance: readonly string[];
	readonly statement: string;
}

export interface AssuranceSurfaceInventory {
	readonly coverage: {
		readonly configurationPath: string | null;
		readonly exclude: readonly string[];
		readonly include: readonly string[];
		readonly outputIdentity: null;
		readonly provider: string | null;
		readonly state: KnowledgeState;
		readonly thresholds: Readonly<Record<string, number>>;
	};
	readonly e2e: {
		readonly deterministicFiles: readonly string[];
		readonly liveFiles: readonly string[];
		readonly state: KnowledgeState;
	};
	readonly mutation: {
		readonly commands: readonly string[];
		readonly ledgerPath: string | null;
		readonly runnerPath: string | null;
		readonly state: KnowledgeState;
	};
	readonly unitTests: {
		readonly files: readonly string[];
		readonly passWithNoTestsValues: readonly boolean[];
		readonly state: KnowledgeState;
	};
}

export interface DependencyBoundaryInventory {
	readonly analyzedPerimeter: readonly string[];
	readonly command: string | null;
	readonly configurationPath: string | null;
	readonly enforcementCarriers: readonly string[];
	readonly enforcementPerimeter: readonly string[];
	readonly provenance: readonly string[];
	readonly ruleIds: readonly string[];
	readonly state: KnowledgeState;
}

export interface InventoryDocument {
	readonly artifactPopulations: readonly ArtifactPopulation[];
	readonly assuranceSurfaces: AssuranceSurfaceInventory;
	readonly capabilities: readonly CapabilityInventory[];
	readonly commands: readonly CommandInventory[];
	readonly dependencyBoundary: DependencyBoundaryInventory;
	readonly generator: {
		readonly id: typeof INVENTORY_GENERATOR_ID;
		readonly version: typeof INVENTORY_GENERATOR_VERSION;
	};
	readonly providers: readonly ProviderInventory[];
	readonly schemaVersion: typeof INVENTORY_SCHEMA_VERSION;
	readonly subject: InventorySubjectDescriptor;
	readonly typescriptProjects: readonly TypeScriptProjectInventory[];
	readonly unknowns: readonly UnknownInventory[];
	readonly verificationAssets: readonly VerificationAssetInventory[];
	readonly workspaces: readonly WorkspaceInventory[];
}
