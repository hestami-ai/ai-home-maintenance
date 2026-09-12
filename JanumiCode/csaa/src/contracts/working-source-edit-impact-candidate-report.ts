import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	type StaticModuleImpactCandidateReportBudgets,
	type StaticModuleImpactCandidateReportPartialOutcome
} from './static-module-impact-candidate-report.js';
import type { CapturedArtifactRecord, SubjectDescriptor } from './subject.js';

/**
 * An implementation-local composition of one selected raw working-source edit and the existing
 * static module importer-candidate report. The edit observation is deliberately path-local: it
 * compares one immutable HEAD tree blob with one current FrozenSubject artifact and does not
 * enumerate or classify the rest of the Git worktree.
 */
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-working-source-edit-impact-candidate-report-request/0.1.0' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION =
	'jan-csaa-working-source-edit-impact-candidate-report/0.1.0' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-working-source-edit-impact-candidate-report-result/0.1.0' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION =
	'jan-csaa-report-working-source-edit-impact-candidates/0.1.0' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION =
	'jan-csaa-working-source-edit-seed/0.1.0' as const;
export const WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION =
	'jan-csaa-working-source-edit-observation/0.1.0' as const;

export const WORKING_SOURCE_EDIT_OBSERVATION_METHOD =
	'raw-immutable-head-blob-stage-zero-index-to-frozen-subject-artifact/1.0.0' as const;
export const WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD =
	'utf16-longest-common-prefix-suffix-single-envelope/1.0.0' as const;
export const WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD = 'canonical-json-sha256/1.0.0' as const;
export const WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE =
	'RAW_OBSERVATION_CORE_EXCLUDING_DIGEST_AND_FROZEN_SUBJECT_BINDING' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD =
	'validated-raw-working-source-edit-plus-static-module-importer-candidate-projection/1.0.0' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY =
	'IMPLEMENTATION_LOCAL_WORKING_SOURCE_EDIT_IMPACT_CANDIDATES' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY = 'NONE' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER = 'NONE' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT = 'NONE' as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031 = 'NOT_CLAIMED' as const;

/**
 * The embedded predecessor must leave deterministic room for the outer evidence envelope. Runtime
 * validation also applies the exact outer result-byte budget after composition.
 */
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_PREDECESSOR_RESULT_BUDGET_DIVISOR = 2 as const;
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION = 64 * 1024;

export const WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS = Object.freeze([
	'ONLY_THE_SELECTED_TRACKED_EXISTING_REGULAR_SOURCE_PATH_IS_OBSERVED',
	'NO_REPOSITORY_WIDE_WORKTREE_CHANGE_ENUMERATION',
	'NO_GIT_STATUS_OR_PORCELAIN_DIRTY_STATE_CLASSIFICATION',
	'NO_OTHER_PATH_STAGED_UNSTAGED_UNTRACKED_IGNORED_OR_SUBMODULE_STATE_ASSESSMENT',
	'NO_GIT_ATTRIBUTE_FILTER_NORMALIZATION_OR_DIFF_DRIVER_EXECUTION',
	'NO_ADD_DELETE_RENAME_COPY_MODE_TYPE_OR_UNMERGED_CHANGE_SUPPORT',
	'NO_INDEX_STAGE_OTHER_THAN_ZERO',
	'NO_BINARY_OR_NON_UTF8_SOURCE_SUPPORT',
	'NO_BRANCH_TAG_OR_SYMBOLIC_REF_BASE_SELECTION',
	'HOST_INSTALLED_GIT_EXECUTABLE_AND_OS_PROCESS_LAUNCH_REMAIN_AMBIENT_TRUST_BOUNDARIES'
] as const);

export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE = Object.freeze([
	'COMPLETE_REPOSITORY_WORKING_CHANGE_SET_ENUMERATION_AND_IDENTITY',
	'SEMANTIC_OR_CROSS_SNAPSHOT_CHANGE_DELTA',
	'SYMBOL_REFERENCE_CALL_CONTROL_AND_DATA_FLOW_PROPAGATION',
	'FRAMEWORK_GENERATED_CONFIGURATION_AND_ENTRY_MECHANISM_PROPAGATION',
	'RELEVANT_TEST_MAPPING_AND_EXECUTION_EVIDENCE',
	'RUNTIME_OBSERVATION_WHERE_STATIC_CLOSURE_IS_INSUFFICIENT'
] as const);

export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'DWP_005_OR_DWP_006_COMPLETION',
	'G5_G6_OR_ANY_GATE',
	'REGISTERED_JAN_CSAA_007_IMPACT_OPERATION_OR_FULL_JAN_CSAA_007_008_CONFORMANCE',
	'JAN_CSAA_WORKING_CHANGE_SET_RECORD_CHANGE_SEED_RECORD_OR_CHANGE_IMPACT_RESULT_RECORD',
	'COMPLETE_WORKING_CHANGE_SET_IDENTITY_OR_REPOSITORY_WIDE_DIRTY_STATE',
	'OTHER_PATH_STAGED_UNSTAGED_UNTRACKED_IGNORED_OR_SUBMODULE_STATE',
	'GIT_STATUS_PORCELAIN_OR_FILTER_NORMALIZED_CHANGE_SEMANTICS',
	'ADD_DELETE_RENAME_COPY_MODE_TYPE_UNMERGED_BINARY_OR_NON_UTF8_CHANGE_SUPPORT',
	'CROSS_SNAPSHOT_SEMANTIC_CHANGE_OR_REVISION_COMPARISON',
	'SEMANTIC_MEANING_OF_THE_TEXTUAL_EDIT',
	'MULTI_HUNK_MINIMAL_EDIT_SCRIPT_OR_UNCHANGED_INTERIOR_CLASSIFICATION',
	'GRAPH_FAMILIES_BEYOND_TYPESCRIPT_MODULE_DEPENDENCY',
	'DEFINITE_DIRECT_OR_TRANSITIVE_BREAKAGE',
	'CALL_CONTROL_DATA_STATE_FRAMEWORK_GENERATED_CONFIGURATION_RUNTIME_OR_RULE_IMPACT',
	'TEST_SELECTION_RULE_AFFECTED_OR_BEHAVIORAL_PRESERVATION_PROOF',
	'NOT_AFFECTED_UNVISITED_IRRELEVANCE_DEAD_CODE_OR_SAFE_REMOVAL',
	'FINDING_SEVERITY_GATE_REMEDIATION_DISPOSITION_MERGE_OR_DESIGN_AUTHORITY',
	'GIT_OR_ANALYSIS_PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'PROCESS_SANDBOX_CONFINEMENT_OR_HOST_SECURITY_CERTIFICATION',
	'HOST_GIT_EXECUTABLE_INSTALLATION_OR_OPERATING_SYSTEM_TRUST_ATTESTATION'
] as const);

export interface WorkingSourceEditObservationBudgets {
	/** Maximum stdout or stderr bytes admitted from any metadata-only Git invocation. */
	readonly maxGitMetadataBytes: number;
	/** Aggregate monotonic wall timeout for all Git invocations in one complete observation. */
	readonly maxGitOperationDurationMs: number;
	/** Maximum selected immutable blob and current raw source size, assessed independently. */
	readonly maxSourceBytes: number;
	readonly maxPathCharacters: number;
}

export interface WorkingSourceEditImpactCandidateReportBudgets {
	/** Maximum complete terminal stdout envelope bytes after request admission, including the LF. */
	readonly maxResultBytes: number;
	readonly observation: WorkingSourceEditObservationBudgets;
	readonly staticImpact: StaticModuleImpactCandidateReportBudgets;
}

/** Absolute request ceilings, not implicit defaults, expected runtimes, or product SLOs. */
export const WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS = Object.freeze({
	maxResultBytes: 64 * 1024 * 1024,
	observation: Object.freeze({
		maxGitMetadataBytes: 1024 * 1024,
		maxGitOperationDurationMs: 30_000,
		maxSourceBytes: 8 * 1024 * 1024,
		maxPathCharacters: 4_096
	}),
	staticImpact: Object.freeze({
		...STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
		maxResultBytes:
			(64 * 1024 * 1024) / WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_PREDECESSOR_RESULT_BUDGET_DIVISOR
	})
} satisfies WorkingSourceEditImpactCandidateReportBudgets);

export interface WorkingSourceEditImpactCandidateSeedRequest {
	/** Caller-owned correlation identity; the observed edit evidence has a separate content digest. */
	readonly id: string;
	readonly logicalPath: string;
	readonly operation: 'EDIT';
	readonly projectConfigPath: string;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION;
	readonly scope: 'WHOLE_SOURCE';
}

export interface WorkingSourceEditImpactCandidateReportRequest {
	readonly budgets: WorkingSourceEditImpactCandidateReportBudgets;
	/** Exact full lowercase object ID; branch, tag, abbreviation, and symbolic-ref inputs are refused. */
	readonly immutableBaseCommitOid: string;
	readonly operationVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION;
	readonly seed: WorkingSourceEditImpactCandidateSeedRequest;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type WorkingSourceEditGitObjectFormat = 'sha1' | 'sha256';
export type WorkingSourceEditRegularFileMode = '100644' | '100755';

export interface WorkingSourceEditTextRange {
	/** Inclusive UTF-16 code-unit offset. */
	readonly startUtf16: number;
	/** Exclusive UTF-16 code-unit offset; neither boundary may split a surrogate pair. */
	readonly endUtf16: number;
}

export interface WorkingSourceEditObservedText {
	readonly bytes: number;
	readonly sha256: string;
	readonly utf16CodeUnits: number;
}

/**
 * Serializable evidence for one selected raw source edit. Raw source bytes are intentionally not
 * included. `evidenceSha256` is computed before subject capture and covers the canonical raw
 * observation core: schema, methods, exclusions, Git evidence, textual change, and source text
 * metadata. Its preimage excludes `evidenceSha256` and the later FrozenSubject-only
 * `source.after.artifact` and `source.after.binding` fields. The binder must independently require
 * that artifact path, byte count, and SHA-256 equal the already observed current raw source.
 */
export interface WorkingSourceEditObservation {
	readonly change: {
		readonly afterRange: WorkingSourceEditTextRange;
		readonly beforeRange: WorkingSourceEditTextRange;
		readonly coordinateSystem: 'UTF16_CODE_UNIT_OFFSET';
		readonly operation: 'EDIT';
		readonly scope: 'WHOLE_SOURCE';
		readonly textualDifference: 'OBSERVED';
		/** One outer envelope; it can contain unchanged interior text and is not a minimal edit script. */
		readonly textualMethod: typeof WORKING_SOURCE_EDIT_TEXTUAL_CHANGE_METHOD;
	};
	readonly evidenceDigestMethod: typeof WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_METHOD;
	readonly evidenceDigestScope: typeof WORKING_SOURCE_EDIT_EVIDENCE_DIGEST_SCOPE;
	readonly evidenceSha256: string;
	readonly exclusions: typeof WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS;
	readonly git: {
		readonly headMatch: 'EXACT_FULL_OID_MATCH_TO_REQUESTED_IMMUTABLE_BASE';
		readonly headOid: string;
		readonly indexBlobOid: string;
		readonly indexMatch: 'EXACT_STAGE_ZERO_BLOB_AND_MODE_MATCH_TO_HEAD_TREE_ENTRY';
		readonly indexMode: WorkingSourceEditRegularFileMode;
		readonly indexStage: 0;
		readonly objectFormat: WorkingSourceEditGitObjectFormat;
		readonly providerId: 'git';
		readonly providerQualification: 'NOT_CLAIMED';
		readonly providerVersion: string;
		readonly requestedBaseCommitOid: string;
		readonly treeBlobOid: string;
		readonly treeMode: WorkingSourceEditRegularFileMode;
	};
	readonly method: typeof WORKING_SOURCE_EDIT_OBSERVATION_METHOD;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_OBSERVATION_SCHEMA_VERSION;
	readonly source: {
		readonly after: WorkingSourceEditObservedText & {
			readonly artifact: CapturedArtifactRecord;
			readonly binding: 'RAW_CURRENT_BYTES_MATCH_FROZEN_SUBJECT_ARTIFACT';
		};
		readonly before: WorkingSourceEditObservedText & {
			readonly binding: 'RAW_IMMUTABLE_HEAD_TREE_BLOB';
		};
		readonly encoding: 'UTF-8';
		readonly logicalPath: string;
		/** Canonical slash-separated path passed literally to Git after repository-root validation. */
		readonly repositoryPath: string;
	};
}

export interface WorkingSourceEditImpactCandidateSeedBinding {
	readonly basis: 'VALIDATED_RAW_IMMUTABLE_HEAD_BLOB_TO_CURRENT_FROZEN_SUBJECT_ARTIFACT';
	readonly currentArtifact: CapturedArtifactRecord;
	readonly evidenceSha256: string;
	readonly id: string;
	readonly logicalPath: string;
	readonly operation: 'EDIT';
	readonly projectConfigPath: string;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION;
	readonly scope: 'WHOLE_SOURCE';
	readonly staticImpactWorkingChangeSetBinding: {
		readonly id: string;
		readonly interpretation: 'OBSERVED_EDIT_EVIDENCE_SHA256_NOT_A_WORKING_CHANGE_SET_RECORD';
	};
}

export type WorkingSourceEditImpactCandidateReportStage =
	| 'REQUEST'
	| 'GIT_PROVIDER'
	| 'BASE_REVISION'
	| 'HEAD_TREE'
	| 'INDEX'
	| 'CURRENT_SOURCE'
	| 'TEXTUAL_CHANGE'
	| 'SUBJECT'
	| 'PREDECESSOR_REPORT'
	| 'CURRENTNESS'
	| 'RESULT';

export interface WorkingSourceEditImpactCandidateReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly predecessorCode: string | null;
	readonly predecessorStage: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'WORKING_EDIT_OBSERVATION' | 'PREDECESSOR_REPORT' | 'CURRENTNESS';
}

export interface WorkingSourceEditImpactCandidateReportResult {
	readonly capability: {
		readonly fullJanCsaaCap031: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_FULL_CAP_031;
		readonly id: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY;
		readonly predecessorCapability: 'IMPLEMENTATION_LOCAL_STATIC_MODULE_IMPACT_CANDIDATES';
		readonly predecessorStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED';
		readonly status: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_CAPABILITY_STATUS;
	};
	readonly conclusion:
		| 'VALIDATED_WORKING_SOURCE_EDIT_WITH_STATIC_MODULE_IMPORTER_CANDIDATES'
		| 'VALIDATED_WORKING_SOURCE_EDIT_WITH_NO_STATIC_MODULE_IMPORTER_CANDIDATES_WITHIN_SELECTED_GRAPH';
	readonly currentness: {
		readonly finalFacadeVerification: 'RECHECKED_AFTER_COMPOSITION_AND_RESULT_SIZE_ACCOUNTING';
		readonly frozenSubject: 'CURRENT_FOR_CAPTURED_SUBJECT';
		readonly gitHead: 'EXACT_REQUESTED_IMMUTABLE_BASE_REOBSERVED';
		readonly index: 'EXACT_STAGE_ZERO_HEAD_TREE_MATCH_REOBSERVED';
		readonly rawCurrentSource: 'EXACT_OBSERVED_BYTES_REOBSERVED';
		readonly scope: 'SELECTED_SOURCE_HEAD_INDEX_RAW_BYTES_AND_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_VALIDATED_SELECTED_WORKING_SOURCE_EDIT';
	};
	readonly evidence: {
		readonly composition: 'FULL_WORKING_EDIT_OBSERVATION_PLUS_UNMODIFIED_PREDECESSOR_REPORT';
		readonly staticModuleImpactCandidateReport: StaticModuleImpactCandidateReportPartialOutcome;
		readonly workingSourceEdit: WorkingSourceEditObservation;
	};
	readonly exclusions: {
		readonly editObservation: typeof WORKING_SOURCE_EDIT_OBSERVATION_EXCLUSIONS;
		readonly subjectExcludedClasses: SubjectDescriptor['excludedClasses'];
		readonly subjectExclusionPolicyIds: SubjectDescriptor['exclusionPolicyIds'];
		readonly subjectPerimeter: SubjectDescriptor['perimeter'];
	};
	readonly facadeNonclaims: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS;
	readonly globalImpactClosure: 'OPEN';
	readonly invalidationDependencies: {
		readonly currentArtifactSha256: string;
		readonly immutableBaseCommitOid: string;
		readonly indexBlobOid: string;
		readonly predecessorAnalysisContentDigest: string;
		readonly predecessorAnalysisId: string;
		readonly predecessorSourceGraphContentDigest: string;
		readonly predecessorSourceGraphId: string;
		readonly subjectId: string;
		readonly treeBlobOid: string;
		readonly workingSourceEditEvidenceSha256: string;
	};
	readonly method: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_METHOD;
	readonly nextEvidenceNeeded: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_NEXT_EVIDENCE;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION;
	readonly seed: WorkingSourceEditImpactCandidateSeedBinding;
	readonly uncertainty: {
		readonly changeInterpretation: 'TEXTUAL_SINGLE_ENVELOPE_ONLY';
		readonly repositoryWorkingChangeClosure: 'NOT_ASSESSED';
		readonly staticImpactCandidates: 'POSSIBLE_ONLY';
		readonly staticImpactGlobalClosure: 'OPEN';
	};
}

export interface WorkingSourceEditImpactCandidateReportPartialOutcome {
	readonly analysisAuthority: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly WorkingSourceEditImpactCandidateReportDiagnostic[];
	readonly gateEffect: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT;
	readonly operationVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: WorkingSourceEditImpactCandidateReportRequest;
	readonly result: WorkingSourceEditImpactCandidateReportResult;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type WorkingSourceEditImpactCandidateReportFailureState =
	'failed' | 'incompatible' | 'resource-refused' | 'stale';

export interface WorkingSourceEditImpactCandidateReportUnavailableOutcome {
	readonly analysisAuthority: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly WorkingSourceEditImpactCandidateReportDiagnostic[];
	readonly facadeNonclaims: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_NONCLAIMS;
	readonly gateEffect: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_GATE_EFFECT;
	readonly observation?: WorkingSourceEditObservation;
	readonly operationVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: WorkingSourceEditImpactCandidateReportRequest;
	readonly schemaVersion: typeof WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION;
	readonly stage: WorkingSourceEditImpactCandidateReportStage;
	readonly state: WorkingSourceEditImpactCandidateReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type WorkingSourceEditImpactCandidateReportOutcome =
	| WorkingSourceEditImpactCandidateReportPartialOutcome
	| WorkingSourceEditImpactCandidateReportUnavailableOutcome;
