import type { ArtifactDisposition, ArtifactPrimaryClass, ArtifactSemanticRole } from './subject.js';

export const ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-artifact-set/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-artifact-set-request/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION =
	'jan-csaa-bind-jpwb-arrow-command-census-artifacts/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-request/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-raw-output/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-observation/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_OPERATION_VERSION =
	'jan-csaa-observe-jpwb-arrow-command-census/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_CANONICAL_PROFILE =
	'jan-csaa-arrow-command-census-canonical/1.0.0' as const;
export const ARROW_COMMAND_CENSUS_METHOD =
	'jpwb-retained-arrow-command-census-adapter/0.1.0' as const;
export const ARROW_COMMAND_CENSUS_ADAPTER_ID = 'jan-csaa-jpwb-arrow-command-census' as const;
export const ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY = 'WRAP' as const;
export const ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY = 'RETAINED_DELEGATED' as const;
export const ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER = 'NONE' as const;
export const ARROW_COMMAND_CENSUS_ORACLE_CHANGE = 'NONE' as const;
export const ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

declare const arrowCommandCensusIdentityBrand: unique symbol;
export type ArrowCommandCensusArtifactSetId = string & {
	readonly [arrowCommandCensusIdentityBrand]: 'ArrowCommandCensusArtifactSet';
};
export type ArrowCommandCensusObservationId = string & {
	readonly [arrowCommandCensusIdentityBrand]: 'ArrowCommandCensusObservation';
};
export type ArrowCommandCensusRawOutputId = string & {
	readonly [arrowCommandCensusIdentityBrand]: 'ArrowCommandCensusRawOutput';
};
export type ArrowCommandCensusDeclaredArrowId = string & {
	readonly [arrowCommandCensusIdentityBrand]: 'ArrowCommandCensusDeclaredArrow';
};
export type ArrowCommandCensusDeclaredSiteId = string & {
	readonly [arrowCommandCensusIdentityBrand]: 'ArrowCommandCensusDeclaredSite';
};

/**
 * Why the retained verifier needs an artifact. Uses are independent of the
 * resolver's primary class and semantic roles; neither classification may be
 * inferred from the other.
 */
export type ArrowCommandCensusArtifactUse =
	| 'BASELINE'
	| 'COMMAND_DECLARATIONS'
	| 'CONTRACT_SCHEMA_SOURCE'
	| 'ENVIRONMENT_IDENTITY'
	| 'EXECUTOR_SOURCE'
	| 'EXECUTOR_TEST'
	| 'HANDLER_SOURCE'
	| 'PACKAGE_MANIFEST'
	| 'PACKAGE_SOURCE'
	| 'STATE_MACHINE_DECLARATIONS';

export interface ArrowCommandCensusArtifactBinding {
	readonly bytes: number;
	readonly canonicalPathKey: string;
	readonly disposition: Exclude<ArtifactDisposition, 'EXCLUDED'>;
	readonly path: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly reason: string;
	readonly roles: readonly ArtifactSemanticRole[];
	readonly sha256: string;
	readonly uses: readonly ArrowCommandCensusArtifactUse[];
}

export interface ArrowCommandCensusArtifactSetCoverage {
	readonly artifacts: number;
	readonly baselineArtifacts: number;
	readonly commandDeclarationArtifacts: number;
	readonly contractSchemaArtifacts: number;
	readonly environmentIdentityArtifacts: number;
	readonly executorSourceArtifacts: number;
	readonly executorTestArtifacts: number;
	readonly handlerSourceArtifacts: number;
	readonly packageManifestArtifacts: number;
	readonly packageSourceArtifacts: number;
	readonly reconciles: boolean;
	readonly stateMachineDeclarationArtifacts: number;
}

/** Exact FrozenSubject-backed input population used by the retained verifier. */
export interface ArrowCommandCensusArtifactSetBinding {
	readonly artifactSetDigest: string;
	readonly artifacts: readonly ArrowCommandCensusArtifactBinding[];
	readonly contentDigest: string;
	readonly coverage: ArrowCommandCensusArtifactSetCoverage;
	readonly id: ArrowCommandCensusArtifactSetId;
	readonly method: typeof ARROW_COMMAND_CENSUS_METHOD;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION;
	readonly subjectId: string;
}

/** Selection bounds are caller policy, not repository or product ceilings. */
export interface ArrowCommandCensusArtifactSetBudgets {
	readonly maxArtifacts: number;
	readonly maxDiagnostics: number;
	readonly maxTotalBytes: number;
}

export interface BuildArrowCommandCensusArtifactSetRequest {
	readonly budgets: ArrowCommandCensusArtifactSetBudgets;
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export type ArrowCommandCensusArtifactSetDiagnosticCode =
	| 'AMBIGUOUS_REQUIRED_ARTIFACT'
	| 'ARTIFACT_IDENTITY_INVALID'
	| 'BUDGET_EXHAUSTED'
	| 'POPULATION_RECONCILIATION_FAILED'
	| 'REQUEST_INVALID'
	| 'REQUIRED_ARTIFACT_MISSING'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_ID_MISMATCH'
	| 'UNSUPPORTED_REPOSITORY_LAYOUT';

export interface ArrowCommandCensusArtifactSetDiagnostic {
	readonly code: ArrowCommandCensusArtifactSetDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'SELECT' | 'RECONCILE';
}

export type BuildArrowCommandCensusArtifactSetOutcome =
	| {
			readonly artifactSet: ArrowCommandCensusArtifactSetBinding;
			readonly diagnostics: readonly [];
			readonly outcome: 'complete';
	  }
	| {
			readonly artifactSet?: never;
			readonly diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[];
			readonly outcome: 'unavailable';
	  };

/** All values are caller-supplied operation budgets, never product ceilings. */
export interface ArrowCommandCensusBudgets {
	readonly maxArtifacts: number;
	readonly maxBirthStates: number;
	readonly maxDeclaredArrowOccurrences: number;
	readonly maxDeclaredSites: number;
	readonly maxDiagnostics: number;
	readonly maxExecutorDurationMs: number;
	readonly maxMachines: number;
	readonly maxMapStates: number;
	readonly maxOutputBytes: number;
	readonly maxOutputStringCharacters: number;
	readonly maxRawArrayEntries: number;
	readonly maxRawJsonDepth: number;
}

export interface ObserveArrowCommandCensusRequest {
	readonly artifactSetId: ArrowCommandCensusArtifactSetId;
	readonly budgets: ArrowCommandCensusBudgets;
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_OPERATION_VERSION;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export interface ArrowCommandCensusExecutorIdentity {
	readonly adapterId: typeof ARROW_COMMAND_CENSUS_ADAPTER_ID;
	readonly adapterVersion: typeof ARROW_COMMAND_CENSUS_OPERATION_VERSION;
	readonly executable: string;
	readonly retainedVerifierCanonicalPathKey: string;
	readonly retainedVerifierSha256: string;
	readonly runtime: 'bun';
	readonly runtimeVersion: string;
}

export interface ArrowCommandCensusRawOutputIdentity {
	readonly bytes: number;
	readonly encoding: 'UTF-8';
	readonly exitCode: 0;
	readonly format: 'JSON';
	readonly id: ArrowCommandCensusRawOutputId;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION;
	readonly sha256: string;
}

/** Wire shape emitted by the isolated retained-verifier executor. */
export interface ArrowCommandCensusRawDeclaredArrow {
	readonly from: string;
	readonly machine: string;
	readonly site: string;
	readonly to: string;
}

export interface ArrowCommandCensusRawStateMapEntry {
	readonly machine: string;
	readonly states: readonly string[];
}

export interface ArrowCommandCensusRawFindingSet {
	readonly dead: readonly string[];
	readonly orphans: readonly string[];
	readonly total: number;
	readonly unanalysed: readonly string[];
	readonly uncovered: readonly string[];
}

export interface ArrowCommandCensusRawOutput {
	readonly baseline: ArrowCommandCensusRawFindingSet;
	readonly births: readonly ArrowCommandCensusRawStateMapEntry[];
	readonly census: Pick<ArrowCommandCensusRawFindingSet, 'orphans' | 'total' | 'uncovered'>;
	readonly deadCovered: Pick<ArrowCommandCensusRawFindingSet, 'dead' | 'unanalysed'>;
	readonly declaredArrows: readonly ArrowCommandCensusRawDeclaredArrow[];
	readonly occupiable: readonly ArrowCommandCensusRawStateMapEntry[];
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION;
}

export interface ArrowCommandCensusSourceSite {
	readonly line: number | null;
	readonly locator: string;
	readonly path: string | null;
}

export interface ArrowCommandCensusDeclaredArrowRecord {
	readonly arrowKey: string;
	readonly from: string;
	readonly id: ArrowCommandCensusDeclaredArrowId;
	readonly machine: string;
	readonly ordinalAtSite: number;
	readonly siteId: ArrowCommandCensusDeclaredSiteId;
	readonly to: string;
}

export interface ArrowCommandCensusDeclaredSiteRecord {
	readonly arrowIds: readonly ArrowCommandCensusDeclaredArrowId[];
	readonly id: ArrowCommandCensusDeclaredSiteId;
	readonly ordinal: number;
	readonly source: ArrowCommandCensusSourceSite;
}

export interface ArrowCommandCensusArrowRecord {
	readonly arrowKey: string;
	readonly from: string;
	readonly machine: string;
	readonly to: string;
}

export interface ArrowCommandCensusStateMapEntry {
	readonly machine: string;
	readonly states: readonly string[];
}

export interface ArrowCommandCensusActualFindingSet {
	readonly deadCovered: readonly ArrowCommandCensusArrowRecord[];
	readonly orphanMachines: readonly string[];
	readonly totalDeclaredMachineArrows: number;
	readonly unanalysedMachines: readonly string[];
	readonly uncoveredArrows: readonly ArrowCommandCensusArrowRecord[];
}

export interface ArrowCommandCensusBaselineFindingSet {
	readonly deadCoveredArrowKeys: readonly string[];
	readonly orphanMachines: readonly string[];
	readonly totalDeclaredMachineArrows: number;
	readonly unanalysedMachines: readonly string[];
	readonly uncoveredArrowKeys: readonly string[];
}

export interface ArrowCommandCensusBaselineComparisonItem {
	readonly actualCount: number;
	readonly baselineCount: number;
	readonly matches: boolean;
}

export interface ArrowCommandCensusBaselineComparison {
	readonly deadCovered: ArrowCommandCensusBaselineComparisonItem;
	readonly matches: boolean;
	readonly orphanMachines: ArrowCommandCensusBaselineComparisonItem;
	readonly totalDeclaredMachineArrows: ArrowCommandCensusBaselineComparisonItem;
	readonly unanalysedMachines: ArrowCommandCensusBaselineComparisonItem;
	readonly uncoveredArrows: ArrowCommandCensusBaselineComparisonItem;
}

export interface ArrowCommandCensusCoverage {
	readonly baselineMatches: boolean;
	readonly birthMachines: number;
	readonly birthStates: number;
	readonly coveredDeclaredMachineArrows: number;
	readonly deadCoveredArrows: number;
	readonly declaredArrowOccurrences: number;
	readonly declaredSites: number;
	readonly machinesWithDeclaredArrows: number;
	readonly occupiableMachines: number;
	readonly occupiableStates: number;
	readonly orphanMachines: number;
	readonly reconciles: boolean;
	readonly totalDeclaredMachineArrows: number;
	readonly unanalysedMachines: number;
	readonly uncoveredArrows: number;
}

export interface ArrowCommandCensusEpistemicState {
	readonly capabilityCoverage: 'PARTIAL';
	readonly conflictState: 'NOT_EVALUATED';
	readonly executionHealth: 'SUCCEEDED' | 'PARTIAL';
	readonly freshness: 'SUBJECT_BOUND';
	readonly inferenceState: 'NONE';
	readonly supportBasis: 'RETAINED_VERIFIER_EXECUTION';
}

export type ArrowCommandCensusLimitationCode =
	| 'BASELINE_MATCH_NOT_CORRECTNESS_PROOF'
	| 'BIRTH_DECLARATION_SCOPE_PARTIAL'
	| 'COMMAND_DECLARATION_CENSUS_PARTIAL'
	| 'EXECUTION_NOT_OBSERVED'
	| 'NO_GRAPH_RELATION_CONFORMANCE_CLAIM'
	| 'RETAINED_VERIFIER_AUTHORITY_UNCHANGED';

export interface ArrowCommandCensusLimitation {
	readonly code: ArrowCommandCensusLimitationCode;
	readonly reason: string;
}

export const ARROW_COMMAND_CENSUS_LIMITATIONS = [
	{
		code: 'BASELINE_MATCH_NOT_CORRECTNESS_PROOF',
		reason:
			'Agreement with the retained baseline proves only exact non-regression against that baseline.'
	},
	{
		code: 'BIRTH_DECLARATION_SCOPE_PARTIAL',
		reason:
			'Dead-covered analysis is supported only for machines with retained-verifier-readable birth declarations; every other covered machine remains explicitly unanalysed.'
	},
	{
		code: 'COMMAND_DECLARATION_CENSUS_PARTIAL',
		reason:
			'Only command idioms understood by the retained verifier contribute declared arrows; absent or unread idioms do not establish non-performability.'
	},
	{
		code: 'EXECUTION_NOT_OBSERVED',
		reason:
			'Declared command arrows and derived occupancy are static declarations, not observations that a transition executed at runtime.'
	},
	{
		code: 'NO_GRAPH_RELATION_CONFORMANCE_CLAIM',
		reason:
			'The adapter does not publish registered graph relations or claim full JAN-CSAA-007 or JAN-CSAA-008 conformance.'
	},
	{
		code: 'RETAINED_VERIFIER_AUTHORITY_UNCHANGED',
		reason:
			'The adapter wraps retained verification evidence and does not replace, weaken, retire, or assume its delegated oracle authority.'
	}
] as const satisfies readonly ArrowCommandCensusLimitation[];

export interface ArrowCommandCensusObservation {
	readonly artifactSet: ArrowCommandCensusArtifactSetBinding;
	readonly authorityTransfer: typeof ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER;
	readonly baseline: ArrowCommandCensusBaselineFindingSet;
	readonly baselineComparison: ArrowCommandCensusBaselineComparison;
	readonly births: readonly ArrowCommandCensusStateMapEntry[];
	readonly budgets: ArrowCommandCensusBudgets;
	readonly canonicalProfile: typeof ARROW_COMMAND_CENSUS_CANONICAL_PROFILE;
	readonly census: ArrowCommandCensusActualFindingSet;
	readonly contentDigest: string;
	readonly coverage: ArrowCommandCensusCoverage;
	readonly declaredArrows: readonly ArrowCommandCensusDeclaredArrowRecord[];
	readonly declaredSites: readonly ArrowCommandCensusDeclaredSiteRecord[];
	readonly epistemic: ArrowCommandCensusEpistemicState;
	readonly executor: ArrowCommandCensusExecutorIdentity;
	readonly fullJanCsaa007Conformance: typeof ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly id: ArrowCommandCensusObservationId;
	readonly integrationStrategy: typeof ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY;
	readonly limitations: typeof ARROW_COMMAND_CENSUS_LIMITATIONS;
	readonly method: typeof ARROW_COMMAND_CENSUS_METHOD;
	readonly occupiable: readonly ArrowCommandCensusStateMapEntry[];
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_OPERATION_VERSION;
	readonly oracleChange: typeof ARROW_COMMAND_CENSUS_ORACLE_CHANGE;
	readonly rawOutput: ArrowCommandCensusRawOutputIdentity;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION;
	readonly subjectId: string;
	readonly verifierAuthority: typeof ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY;
}

export type ArrowCommandCensusDiagnosticCode =
	| 'ARTIFACT_SET_IDENTITY_MISMATCH'
	| 'ARTIFACT_SET_INVALID'
	| 'BASELINE_MISMATCH'
	| 'BUDGET_EXHAUSTED'
	| 'EXECUTOR_FAILED'
	| 'EXECUTOR_IDENTITY_MISMATCH'
	| 'OBSERVATION_VALIDATION_FAILED'
	| 'RAW_OUTPUT_IDENTITY_MISMATCH'
	| 'RAW_OUTPUT_INVALID'
	| 'REQUEST_INVALID'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_ID_MISMATCH';

export interface ArrowCommandCensusDiagnostic {
	readonly code: ArrowCommandCensusDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'BIND' | 'EXECUTE' | 'NORMALIZE' | 'VALIDATE';
	readonly severity: 'WARNING' | 'ERROR';
}

export type ObserveArrowCommandCensusOutcome =
	| {
			readonly diagnostics: readonly ArrowCommandCensusDiagnostic[];
			readonly observation: ArrowCommandCensusObservation;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly ArrowCommandCensusDiagnostic[];
			readonly observation?: never;
			readonly outcome: 'unavailable';
	  };

export type ArrowCommandCensusValidationIssueCode =
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_SHAPE'
	| 'INVALID_VALUE'
	| 'NONCANONICAL_ORDER'
	| 'POPULATION_MISMATCH'
	| 'RECONCILIATION_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface ArrowCommandCensusValidationIssue {
	readonly code: ArrowCommandCensusValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface ArrowCommandCensusValidationOptions {
	/** Reporting budget only; it does not cap the validated population. */
	readonly maxIssues?: number;
}

export type ArrowCommandCensusValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly ArrowCommandCensusValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
