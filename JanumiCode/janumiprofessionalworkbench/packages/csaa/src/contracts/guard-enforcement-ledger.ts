import type { ArtifactPrimaryClass, ArtifactSemanticRole } from './subject.js';

export const GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-artifact-set/1.0.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-artifact-set-request/1.0.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION =
	'jan-csaa-bind-jpwb-guard-enforcement-ledger-artifacts/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-observation/1.0.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-request/1.0.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION =
	'jan-csaa-observe-jpwb-guard-enforcement-ledger/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_METHOD =
	'jpwb-retained-guard-enforcement-ledger-adapter/0.1.0' as const;
export const GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID =
	'jan-csaa-jpwb-guard-enforcement-ledger' as const;
export const GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE = 'RFC8785_JCS_UTF8_SHA256' as const;
export const GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY = 'WRAP' as const;
export const GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY = 'RETAINED_DELEGATED' as const;
export const GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE = 'NONE' as const;
export const GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE = 'NOT_CLAIMED' as const;
export const GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION = 'NOT_EXECUTED_BY_CSAA' as const;
export const GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT = 'NOT_CLAIMED' as const;
/** Largest millisecond duration representable without Node timer clamping. */
export const GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS = 2_147_483_647 as const;
export const GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH = 'verif/guard-enforcement-ledger.ts' as const;
export const GUARD_ENFORCEMENT_LEDGER_DATA_PATH = 'verif/guard-enforcement-ledger.data.ts' as const;
export const GUARD_ENFORCEMENT_LEDGER_TEST_PATH = 'verif/guard-enforcement-ledger.test.ts' as const;
export const GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS = Object.freeze([
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_TEST_PATH
] as const);

declare const guardLedgerBrand: unique symbol;
export type GuardEnforcementLedgerArtifactSetId = string & {
	readonly [guardLedgerBrand]: 'GuardEnforcementLedgerArtifactSetId';
};
export type GuardEnforcementLedgerObservationId = string & {
	readonly [guardLedgerBrand]: 'GuardEnforcementLedgerObservationId';
};
export type GuardEnforcementLedgerRawOutputId = string & {
	readonly [guardLedgerBrand]: 'GuardEnforcementLedgerRawOutputId';
};
export type GuardEnforcementLedgerArrowId = string & {
	readonly [guardLedgerBrand]: 'GuardEnforcementLedgerArrowId';
};
export type GuardEnforcementLedgerGuardId = string & {
	readonly [guardLedgerBrand]: 'GuardEnforcementLedgerGuardId';
};

export type GuardEnforcementLedgerArtifactUse =
	| 'ANALYZER_SOURCE'
	| 'AUTHORITY_TEST'
	| 'ENVIRONMENT_IDENTITY'
	| 'ENFORCEMENT_SITE_SOURCE'
	| 'LEDGER_DATA'
	| 'PACKAGE_MANIFEST'
	| 'PACKAGE_SOURCE'
	| 'STATE_MACHINE_DECLARATIONS';

export interface GuardEnforcementLedgerArtifactBinding {
	readonly bytes: number;
	readonly canonicalPathKey: string;
	readonly path: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly semanticRoles: readonly ArtifactSemanticRole[];
	readonly sha256: string;
	readonly uses: readonly GuardEnforcementLedgerArtifactUse[];
}

export interface GuardEnforcementLedgerArtifactSetCoverage {
	readonly analyzerArtifacts: number;
	readonly artifacts: number;
	readonly authorityTestArtifacts: number;
	readonly enforcementSiteArtifacts: number;
	readonly ledgerDataArtifacts: number;
	readonly packageSourceArtifacts: number;
	readonly reconciles: boolean;
	readonly stateMachineDeclarationArtifacts: number;
	readonly totalBytes: number;
}

export interface GuardEnforcementLedgerArtifactSetBinding {
	readonly artifacts: readonly GuardEnforcementLedgerArtifactBinding[];
	readonly canonicalProfile: typeof GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE;
	readonly contentDigest: string;
	readonly coverage: GuardEnforcementLedgerArtifactSetCoverage;
	readonly id: GuardEnforcementLedgerArtifactSetId;
	readonly method: typeof GUARD_ENFORCEMENT_LEDGER_METHOD;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_SCHEMA_VERSION;
	readonly subjectId: string;
}

export interface GuardEnforcementLedgerArtifactSetBudgets {
	readonly maxArtifacts: number;
	readonly maxDiagnostics: number;
	readonly maxTotalBytes: number;
}

export interface BuildGuardEnforcementLedgerArtifactSetRequest {
	readonly budgets: GuardEnforcementLedgerArtifactSetBudgets;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export interface GuardEnforcementLedgerBudgets {
	readonly maxArtifacts: number;
	readonly maxAuditEntries: number;
	readonly maxDiagnostics: number;
	readonly maxExecutorDurationMs: number;
	readonly maxExternalModuleBytes: number;
	readonly maxExternalModuleFiles: number;
	readonly maxGuardedArrows: number;
	readonly maxGuardTexts: number;
	readonly maxLedgerRows: number;
	readonly maxMaterializedBytes: number;
	readonly maxOutputStringCharacters: number;
	readonly maxRawArrayEntries: number;
	readonly maxRawJsonDepth: number;
	readonly maxStderrBytes: number;
	readonly maxStdoutBytes: number;
}

export interface ObserveGuardEnforcementLedgerRequest {
	readonly artifactSetId: GuardEnforcementLedgerArtifactSetId;
	readonly budgets: GuardEnforcementLedgerBudgets;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export type GuardEnforcementDisposition =
	| 'ARROW_UNREACHABLE'
	| 'ENFORCED'
	| 'NOT_MECHANICALLY_CHECKABLE'
	| 'REDUNDANT_WITH_MACHINE'
	| 'UNENFORCED';

export interface GuardEnforcementDispositionCount {
	readonly count: number;
	readonly disposition: GuardEnforcementDisposition;
}

export interface GuardEnforcementLedgerAudit {
	readonly arrowCount: number;
	readonly counts: readonly GuardEnforcementDispositionCount[];
	readonly enforcedAnchorBroken: readonly string[];
	readonly enforcedWithoutSite: readonly string[];
	readonly stale: readonly string[];
	readonly textCount: number;
	readonly unclassified: readonly string[];
}

export interface GuardEnforcementLedgerArrowRecord {
	readonly from: string;
	readonly guardId: GuardEnforcementLedgerGuardId;
	readonly guardText: string;
	readonly id: GuardEnforcementLedgerArrowId;
	readonly machine: string;
	readonly ordinal: number;
	readonly to: string;
}

export interface GuardEnforcementLedgerGuardRecord {
	readonly arrowIds: readonly GuardEnforcementLedgerArrowId[];
	readonly disposition: GuardEnforcementDisposition | null;
	readonly enforcingAnchor: string | null;
	readonly enforcingSite: string | null;
	readonly evidence: string | null;
	readonly guardText: string;
	readonly id: GuardEnforcementLedgerGuardId;
	readonly ledgerState: 'CLASSIFIED' | 'STALE' | 'UNCLASSIFIED';
}

export interface GuardEnforcementLedgerRawEvidence {
	readonly analyzerPath: typeof GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH;
	readonly audit: GuardEnforcementLedgerAudit;
	readonly dataPath: typeof GUARD_ENFORCEMENT_LEDGER_DATA_PATH;
	readonly guardTexts: readonly string[];
	readonly guardedArrows: readonly {
		readonly from: string;
		readonly guard: string;
		readonly machine: string;
		readonly to: string;
	}[];
	readonly ledgerRows: readonly {
		readonly disposition: GuardEnforcementDisposition;
		readonly enforcingAnchor: string | null;
		readonly enforcingSite: string | null;
		readonly evidence: string;
		readonly guardText: string;
	}[];
	readonly runtime: { readonly bunVersion: string };
	readonly schemaVersion: string;
}

export interface GuardEnforcementLedgerRawOutputIdentity {
	/** UTF-8 byte length of canonicalSemanticJson(rawEvidence), not worker transport stdout. */
	readonly bytes: number;
	/** Digest of the sanitized public rawEvidence projection. */
	readonly evidenceContentDigest: string;
	readonly id: GuardEnforcementLedgerRawOutputId;
	readonly schemaVersion: string;
	/** SHA-256 of canonicalSemanticJson(rawEvidence), excluding private runtime paths. */
	readonly sha256: string;
}

export interface GuardEnforcementLedgerExternalModuleIdentity {
	readonly bytes: number;
	readonly contentDigest: string;
	readonly files: number;
	readonly name: 'typescript' | 'ulid' | 'zod';
	readonly version: string;
}

export interface GuardEnforcementLedgerExecutorIdentity {
	readonly adapterId: typeof GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID;
	readonly adapterVersion: typeof GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION;
	readonly executableBytes: number;
	readonly executableSha256: string;
	readonly externalModules: readonly GuardEnforcementLedgerExternalModuleIdentity[];
	readonly retainedAnalyzerCanonicalPathKey: string;
	readonly retainedAnalyzerSha256: string;
	readonly retainedDataCanonicalPathKey: string;
	readonly retainedDataSha256: string;
	readonly runtime: 'bun';
	readonly runtimeVersion: string;
	readonly worker: {
		readonly bytes: number;
		readonly sha256: string;
	};
}

export type GuardEnforcementLedgerLimitationCode =
	| 'CLASSIFICATION_IS_RETAINED_REVIEW_JUDGMENT'
	| 'CONTROL_FLOW_NOT_ANALYZED'
	| 'EFFECTS_EVENTS_PERSISTENCE_NOT_ANALYZED'
	| 'IN_MEMORY_OBJECT_WIDTH_NOT_BOUNDED'
	| 'POST_EXECUTION_ACCEPTANCE_BOUNDS'
	| 'RETAINED_SUBJECT_INITIALIZERS_MAY_EXECUTE'
	| 'RETAINED_TEST_NOT_EXECUTED_BY_CSAA'
	| 'RUNTIME_ENFORCEMENT_NOT_CLAIMED'
	| 'STRUCTURAL_VALIDATION_NOT_EXECUTOR_REPLAY';

export interface GuardEnforcementLedgerLimitation {
	readonly code: GuardEnforcementLedgerLimitationCode;
	readonly reason: string;
}

export const GUARD_ENFORCEMENT_LEDGER_LIMITATIONS = [
	{
		code: 'CLASSIFICATION_IS_RETAINED_REVIEW_JUDGMENT',
		reason:
			'Dispositions are preserved retained repository classifications; this adapter does not independently prove their semantic correctness.'
	},
	{
		code: 'CONTROL_FLOW_NOT_ANALYZED',
		reason:
			'The observation does not establish guard dominance, path feasibility, reachability, or refusal control flow.'
	},
	{
		code: 'EFFECTS_EVENTS_PERSISTENCE_NOT_ANALYZED',
		reason:
			'This bounded increment does not analyze payload reads, emitted events, persistence writes, or handler effects.'
	},
	{
		code: 'IN_MEMORY_OBJECT_WIDTH_NOT_BOUNDED',
		reason:
			'Public in-memory validation must enumerate own keys to prove exact record shape. maxRecords bounds containers and array entries after materialization, but cannot bound enumeration of an arbitrarily wide plain-object key table; untrusted serialized input requires a byte-bounded transport and parser before this API.'
	},
	{
		code: 'POST_EXECUTION_ACCEPTANCE_BOUNDS',
		reason:
			'Process duration and stdout/stderr byte budgets actively guard worker execution; population, JSON depth, and output-character budgets reject completed output after execution or parsing and do not bound allocations inside retained code.'
	},
	{
		code: 'RETAINED_SUBJECT_INITIALIZERS_MAY_EXECUTE',
		reason:
			'The retained analyzer imports frozen subject modules in an isolated process; process isolation is not a hostile-code security sandbox, and the worker duration/output guards cannot confine an intentionally detached descendant process.'
	},
	{
		code: 'RETAINED_TEST_NOT_EXECUTED_BY_CSAA',
		reason:
			'The retained Vitest authority remains separately delegated and is identity-bound but not executed by this adapter.'
	},
	{
		code: 'RUNTIME_ENFORCEMENT_NOT_CLAIMED',
		reason:
			'Classification and anchor integrity do not prove that any guard executes or refuses a command at runtime.'
	},
	{
		code: 'STRUCTURAL_VALIDATION_NOT_EXECUTOR_REPLAY',
		reason:
			'Public validation reproduces canonical structure, identities, populations, canonical sanitized raw-evidence bytes, and optional FrozenSubject binding; it does not retain or replay private worker transport bytes, rerun retained code, or independently recapture the external executor environment.'
	}
] as const satisfies readonly GuardEnforcementLedgerLimitation[];

for (const limitation of GUARD_ENFORCEMENT_LEDGER_LIMITATIONS) Object.freeze(limitation);
Object.freeze(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS);

export interface GuardEnforcementLedgerCoverage {
	readonly arrowOccurrences: number;
	readonly classifiedGuardTexts: number;
	readonly distinctGuardTexts: number;
	readonly enforcedAnchorBroken: number;
	readonly enforcedWithoutSite: number;
	readonly ledgerRows: number;
	readonly reconciles: boolean;
	readonly staleLedgerRows: number;
	readonly unclassifiedGuardTexts: number;
}

export interface GuardEnforcementLedgerObservation {
	readonly artifactSet: GuardEnforcementLedgerArtifactSetBinding;
	readonly authorityTransfer: typeof GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER;
	readonly baselineChange: typeof GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE;
	readonly budgets: GuardEnforcementLedgerBudgets;
	readonly canonicalProfile: typeof GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE;
	readonly contentDigest: string;
	readonly coverage: GuardEnforcementLedgerCoverage;
	readonly executor: GuardEnforcementLedgerExecutorIdentity;
	readonly gateEffect: typeof GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT;
	readonly guardedArrows: readonly GuardEnforcementLedgerArrowRecord[];
	readonly guards: readonly GuardEnforcementLedgerGuardRecord[];
	readonly health: 'PARTIAL';
	readonly id: GuardEnforcementLedgerObservationId;
	readonly integrationStrategy: typeof GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY;
	readonly limitations: readonly GuardEnforcementLedgerLimitation[];
	readonly method: typeof GUARD_ENFORCEMENT_LEDGER_METHOD;
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION;
	readonly oracleChange: typeof GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE;
	readonly rawEvidence: GuardEnforcementLedgerRawEvidence;
	readonly rawOutput: GuardEnforcementLedgerRawOutputIdentity;
	readonly replacementEquivalence: typeof GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE;
	readonly retainedTestExecution: typeof GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION;
	readonly runtimeEnforcement: typeof GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION;
	readonly subjectId: string;
	readonly verifierAuthority: typeof GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY;
}

export type GuardEnforcementLedgerDiagnosticCode =
	| 'ARTIFACT_SET_IDENTITY_MISMATCH'
	| 'ARTIFACT_SET_INVALID'
	| 'BUDGET_EXHAUSTED'
	| 'EXECUTOR_FAILED'
	| 'EXECUTOR_IDENTITY_MISMATCH'
	| 'OBSERVATION_VALIDATION_FAILED'
	| 'RAW_OUTPUT_INVALID'
	| 'REQUEST_INVALID'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_CHANGED_DURING_EXECUTION'
	| 'SUBJECT_ID_MISMATCH';

export interface GuardEnforcementLedgerDiagnostic {
	readonly code: GuardEnforcementLedgerDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'EXECUTE' | 'NORMALIZE' | 'REQUEST' | 'VALIDATE';
	readonly severity: 'ERROR' | 'WARNING';
}

export type GuardEnforcementLedgerArtifactSetDiagnosticCode =
	| 'ARTIFACT_CLASSIFICATION_MISMATCH'
	| 'BUDGET_EXHAUSTED'
	| 'POPULATION_RECONCILIATION_FAILED'
	| 'REQUEST_INVALID'
	| 'REQUIRED_ARTIFACT_MISSING'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_ID_MISMATCH';

export interface GuardEnforcementLedgerArtifactSetDiagnostic {
	readonly code: GuardEnforcementLedgerArtifactSetDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'CLASSIFY' | 'RECONCILE' | 'REQUEST';
}

export type BuildGuardEnforcementLedgerArtifactSetOutcome =
	| {
			readonly artifactSet: GuardEnforcementLedgerArtifactSetBinding;
			readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
			readonly outcome: 'complete';
	  }
	| {
			readonly diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[];
			readonly artifactSet?: never;
			readonly outcome: 'unavailable';
	  };

export type ObserveGuardEnforcementLedgerOutcome =
	| {
			readonly diagnostics: readonly GuardEnforcementLedgerDiagnostic[];
			readonly observation: GuardEnforcementLedgerObservation;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly GuardEnforcementLedgerDiagnostic[];
			readonly observation?: never;
			readonly outcome: 'unavailable';
	  };

export type GuardEnforcementLedgerValidationIssueCode =
	| 'ARTIFACT_SET_INVALID'
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_VALUE'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID'
	| 'SUBJECT_MISMATCH';

export interface GuardEnforcementLedgerValidationIssue {
	readonly code: GuardEnforcementLedgerValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface GuardEnforcementLedgerValidationOptions {
	readonly maxIssues?: number;
	/** Bounds containers and array entries, not already-materialized plain-object own-key enumeration. */
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type GuardEnforcementLedgerValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly GuardEnforcementLedgerValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
