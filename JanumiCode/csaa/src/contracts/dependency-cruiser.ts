import { FULL_JAN_CSAA_007_CONFORMANCE } from './semantic.js';

export const DEPENDENCY_CRUISER_PROVIDER_ID = 'dependency-cruiser' as const;
export const DEPENDENCY_CRUISER_PROVIDER_VERSION = '16.10.4' as const;
export const DEPENDENCY_CRUISER_RAW_SCHEMA_ID =
	'https://dependency-cruiser.js.org/schema/cruise-result.schema.json' as const;
export const DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION =
	'jan-csaa-dependency-cruiser-invocation/1.0.0' as const;
export const DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION =
	'jan-csaa-dependency-cruiser-observation/1.0.0' as const;
export const DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION =
	'jan-csaa-normalize-dependency-cruiser-output/0.1.0' as const;
export const DEPENDENCY_CRUISER_CANONICAL_PROFILE =
	'jan-csaa-dependency-cruiser-canonical/1.0.0' as const;
export const DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION =
	'jan-csaa-dependency-cruiser-argv/1.0.0' as const;

declare const dependencyCruiserBrand: unique symbol;
export type DependencyCruiserObservationId = string & {
	readonly [dependencyCruiserBrand]: 'DependencyCruiserObservation';
};
export type DependencyCruiserModuleId = string & {
	readonly [dependencyCruiserBrand]: 'DependencyCruiserModule';
};
export type DependencyCruiserDependencyId = string & {
	readonly [dependencyCruiserBrand]: 'DependencyCruiserDependency';
};

export interface DependencyCruiserNormalizationBudgets {
	readonly maxCommandArgs: number;
	readonly maxDependencies: number;
	readonly maxDependents: number;
	readonly maxIssues: number;
	readonly maxJsonDepth: number;
	readonly maxInputPaths: number;
	readonly maxModules: number;
	readonly maxPathLength: number;
	readonly maxRawBytes: number;
	readonly maxRules: number;
	readonly maxStringLength: number;
	readonly maxSummaryViolations: number;
	readonly maxTotalStringCharacters: number;
}

export interface DependencyCruiserInvocationBinding {
	readonly argvGrammarVersion: typeof DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION;
	readonly baseDir: string;
	readonly budgets: DependencyCruiserNormalizationBudgets;
	readonly command: {
		readonly args: readonly string[];
		readonly exitStatus: number;
		readonly finishedAt: string;
		readonly startedAt: string;
	};
	readonly config: {
		readonly path: string;
		readonly sha256: string;
	};
	readonly inputPaths: readonly string[];
	readonly provider: {
		readonly id: typeof DEPENDENCY_CRUISER_PROVIDER_ID;
		readonly version: typeof DEPENDENCY_CRUISER_PROVIDER_VERSION;
	};
	readonly providerReportedBaseDir:
		| { readonly state: 'ABSENT' }
		| {
				readonly bytes: number;
				readonly representation: 'ABSOLUTE' | 'CANONICAL_RELATIVE';
				readonly sha256: string;
				readonly state: 'PRESENT';
		  };
	readonly raw: {
		readonly bytes: number;
		readonly sha256: string;
	};
	readonly rawSchemaId: typeof DEPENDENCY_CRUISER_RAW_SCHEMA_ID;
	readonly schemaVersion: typeof DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION;
	readonly subjectRoot: {
		readonly bytes: number;
		readonly sha256: string;
	};
	readonly subjectId: string;
}

export type DependencyCruiserTriState = boolean | 'UNSPECIFIED';
export type DependencyCruiserModuleSystem = 'amd' | 'cjs' | 'es6' | 'tsd';
export type DependencyCruiserProtocol = 'data:' | 'file:' | 'node:';
export type DependencyCruiserRuleSeverity = 'error' | 'ignore' | 'info' | 'warn';

export type DependencyCruiserDependencyType =
	| 'aliased-subpath-import'
	| 'aliased-tsconfig-base-url'
	| 'aliased-tsconfig-paths'
	| 'aliased-tsconfig'
	| 'aliased-webpack'
	| 'aliased-workspace'
	| 'aliased'
	| 'amd-define'
	| 'amd-exotic-require'
	| 'amd-require'
	| 'core'
	| 'deprecated'
	| 'dynamic-import'
	| 'exotic-require'
	| 'export'
	| 'import-equals'
	| 'import'
	| 'jsdoc-bracket-import'
	| 'jsdoc-import-tag'
	| 'jsdoc'
	| 'local'
	| 'localmodule'
	| 'npm-bundled'
	| 'npm-dev'
	| 'npm-no-pkg'
	| 'npm-optional'
	| 'npm-peer'
	| 'npm-unknown'
	| 'npm'
	| 'pre-compilation-only'
	| 'require'
	| 'triple-slash-amd-dependency'
	| 'triple-slash-directive'
	| 'triple-slash-file-reference'
	| 'triple-slash-type-reference'
	| 'type-import'
	| 'type-only'
	| 'undetermined'
	| 'unknown';

export interface DependencyCruiserNativeRule {
	readonly ruleId: string;
	readonly severity: DependencyCruiserRuleSeverity;
}

export type DependencyCruiserTarget =
	| { readonly kind: 'CORE_MODULE'; readonly name: string }
	| { readonly kind: 'EXTERNAL_MODULE'; readonly name: string }
	| { readonly kind: 'RESOLVED_LOCAL_PATH'; readonly path: string }
	| { readonly kind: 'UNRESOLVED'; readonly specifier: string };

export interface DependencyCruiserLocalModuleObservation {
	readonly couldNotResolve: DependencyCruiserTriState;
	readonly dependencyIds: readonly DependencyCruiserDependencyId[];
	readonly dependencyTypes: readonly DependencyCruiserDependencyType[];
	readonly dependentSourcePaths: readonly string[];
	readonly dependentsWitness: 'ABSENT' | 'PRESENT_RECONCILED';
	readonly followable: DependencyCruiserTriState;
	readonly id: DependencyCruiserModuleId;
	readonly matchesDoNotFollow: DependencyCruiserTriState;
	readonly rules: readonly DependencyCruiserNativeRule[];
	readonly sourcePath: string;
	readonly valid: boolean;
}

export interface DependencyCruiserNonLocalModuleObservation {
	readonly couldNotResolve: DependencyCruiserTriState;
	readonly dependencyTypes: readonly DependencyCruiserDependencyType[];
	readonly dependentSourcePaths: readonly string[];
	readonly dependentsWitness: 'ABSENT' | 'PRESENT_RECONCILED';
	readonly followable: DependencyCruiserTriState;
	readonly id: DependencyCruiserModuleId;
	readonly matchesDoNotFollow: DependencyCruiserTriState;
	readonly providerSource: string;
	readonly rules: readonly DependencyCruiserNativeRule[];
	readonly target: Exclude<DependencyCruiserTarget, { readonly kind: 'RESOLVED_LOCAL_PATH' }>;
	readonly valid: boolean;
}

export interface DependencyCruiserDependencyObservation {
	readonly circular: boolean;
	readonly coreModule: boolean;
	readonly couldNotResolve: boolean;
	readonly dependencyTypes: readonly DependencyCruiserDependencyType[];
	readonly dynamic: boolean;
	readonly exoticRequire: string | null;
	readonly exoticallyRequired: boolean;
	readonly followable: boolean;
	readonly id: DependencyCruiserDependencyId;
	readonly instability: number | null;
	readonly matchesDoNotFollow: DependencyCruiserTriState;
	readonly mimeType: string | null;
	readonly moduleSpecifier: string;
	readonly moduleSystem: DependencyCruiserModuleSystem;
	readonly preCompilationOnly: DependencyCruiserTriState;
	readonly protocol: DependencyCruiserProtocol | null;
	readonly rules: readonly DependencyCruiserNativeRule[];
	readonly sourceModuleId: DependencyCruiserModuleId;
	readonly sourcePath: string;
	readonly target: DependencyCruiserTarget;
	readonly typeOnlyPartition: 'TYPE_ONLY' | 'VALUE_OR_MIXED';
	readonly typeOnly: DependencyCruiserTriState;
	readonly valid: boolean;
}

export interface DependencyCruiserReverseLink {
	readonly dependencyIds: readonly DependencyCruiserDependencyId[];
	readonly sourcePaths: readonly string[];
	readonly target: DependencyCruiserTarget;
	readonly targetKey: string;
}

export type DependencyCruiserObservationLimitationCode =
	| 'FOLDERS_NOT_INTERPRETED'
	| 'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED'
	| 'DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED'
	| 'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY'
	| 'REVISION_DATA_NOT_INTERPRETED'
	| 'SUMMARY_VIOLATIONS_DIGEST_ONLY';

export interface DependencyCruiserObservationLimitation {
	readonly code: DependencyCruiserObservationLimitationCode;
	readonly fields: readonly string[];
	readonly reason: string;
}

export interface DependencyCruiserObservationSummary {
	readonly dependencyCount: number;
	readonly error: number;
	readonly ignore: number | null;
	readonly info: number;
	readonly localModuleCount: number;
	readonly nonLocalModuleCount: number;
	readonly optionsDigest: string;
	readonly providerTotalCruised: number;
	readonly providerTotalDependenciesCruised: number | null;
	readonly rawModuleCount: number;
	readonly rulesDigest: string | null;
	readonly violationsCount: number;
	readonly violationsDigest: string;
	readonly warn: number;
}

export interface DependencyCruiserObservation {
	readonly canonicalProfile: typeof DEPENDENCY_CRUISER_CANONICAL_PROFILE;
	readonly contentDigest: string;
	readonly dependencies: readonly DependencyCruiserDependencyObservation[];
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly health: 'COMPLETE' | 'PARTIAL';
	readonly id: DependencyCruiserObservationId;
	readonly invocation: DependencyCruiserInvocationBinding;
	readonly invocationDigest: string;
	readonly limitations: readonly DependencyCruiserObservationLimitation[];
	readonly modules: readonly DependencyCruiserLocalModuleObservation[];
	readonly nonLocalModules: readonly DependencyCruiserNonLocalModuleObservation[];
	readonly operationVersion: typeof DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION;
	readonly reverseLinks: readonly DependencyCruiserReverseLink[];
	readonly schemaVersion: typeof DEPENDENCY_CRUISER_OBSERVATION_SCHEMA_VERSION;
	readonly subjectId: string;
	readonly summary: DependencyCruiserObservationSummary;
}

export type DependencyCruiserNormalizationDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'DEPENDENTS_MISMATCH'
	| 'DUPLICATE_DEPENDENCY'
	| 'DUPLICATE_MODULE'
	| 'IDENTITY_MISMATCH'
	| 'INVOCATION_INVALID'
	| 'JSON_PARSE_FAILED'
	| 'NONLOCAL_SOURCE_HAS_DEPENDENCIES'
	| 'PROVIDER_BASE_DIR_MISMATCH'
	| 'PROVIDER_BASE_DIR_MAPPING_UNPROVEN'
	| 'RAW_SHAPE_INVALID'
	| 'UNSAFE_PATH'
	| 'VALIDATION_FAILED';

export interface DependencyCruiserNormalizationDiagnostic {
	readonly code: DependencyCruiserNormalizationDiagnosticCode;
	readonly message: string;
	readonly path: string;
}

export type DependencyCruiserNormalizationOutcome =
	| {
			readonly diagnostics: readonly [];
			readonly observation: DependencyCruiserObservation;
			readonly outcome: 'complete';
	  }
	| {
			readonly diagnostics: readonly DependencyCruiserNormalizationDiagnostic[];
			readonly observation?: never;
			readonly outcome: 'unavailable';
	  };

export type DependencyCruiserObservationValidationIssueCode =
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_SHAPE'
	| 'INVALID_VALUE'
	| 'NONCANONICAL_ORDER'
	| 'POPULATION_MISMATCH'
	| 'RECONCILIATION_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface DependencyCruiserObservationValidationIssue {
	readonly code: DependencyCruiserObservationValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface DependencyCruiserObservationValidationOptions {
	readonly maxIssues?: number;
}

export type DependencyCruiserObservationValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly DependencyCruiserObservationValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
