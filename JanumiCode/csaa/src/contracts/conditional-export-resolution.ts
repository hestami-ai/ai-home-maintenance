import type {
	ProjectContextGraphId,
	ProjectContextGraphSnapshot,
	ProjectContextProgramId,
	ProjectContextProjectId,
	ProjectContextSourceId
} from './project-context-graph.js';
import type {
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';
import type { FrozenSubject } from './subject.js';

export const CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-conditional-export-resolution-request/1.0.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION =
	'jan-csaa-conditional-export-resolution/1.0.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-conditional-export-resolution-progress/1.0.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION =
	'jan-csaa-resolve-conditional-export/0.1.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE =
	'jan-csaa-conditional-export-resolution-canonical/1.0.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_METHOD =
	'validated-frozen-workspace-exact-export-condition-evaluation/1.0.0' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY = 'JAN-CSAA-CAP-012' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS = 'PARTIAL' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE = 'NOT_CLAIMED' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY = 'NONE' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER = 'NONE' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT = 'NONE' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS = 'NOT_ASSESSED' as const;
export const CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS = 'NOT_CLAIMED' as const;

/**
 * A deliberately narrower-than-Node target grammar whose acceptance can be
 * established without URL normalization or filesystem resolution.
 */
export const CONDITIONAL_EXPORT_RESOLUTION_SAFE_TARGET_SYNTAX = Object.freeze({
	allowedPrefix: './',
	encodedCharacters: 'FORBIDDEN',
	forbiddenCharacters: Object.freeze(['\\', '%', '?', '#', '*'] as const),
	forbiddenSegments: Object.freeze(['', '.', '..', 'node_modules'] as const),
	nodeModulesSegmentComparison: 'ASCII_CASE_INSENSITIVE',
	trailingSlash: 'FORBIDDEN'
} as const);

export const CONDITIONAL_EXPORT_RESOLUTION_SAFE_SUBPATH_SYNTAX = Object.freeze({
	dotRoot: 'ALLOWED',
	nonRootPrefix: './',
	encodedCharacters: 'FORBIDDEN',
	forbiddenCharacters: Object.freeze(['\\', '%', '?', '#', '*'] as const),
	forbiddenSegments: Object.freeze(['', '.', '..', 'node_modules'] as const),
	nodeModulesSegmentComparison: 'ASCII_CASE_INSENSITIVE',
	trailingSlash: 'FORBIDDEN'
} as const);

/** Node's package-target numeric-property test, applied before condition selection. */
export const CONDITIONAL_EXPORT_RESOLUTION_NUMERIC_CONDITION_KEY_POLICY = Object.freeze({
	canonicalStringRule: 'STRING_OF_TO_NUMBER_EQUALS_ORIGINAL_KEY',
	disposition: 'FORBIDDEN_FOR_EXPLICIT_REQUEST_AND_SELECTED_TREE_CONDITION_KEYS',
	lowerBoundInclusive: 0,
	numericCoercion: 'ECMASCRIPT_TO_NUMBER',
	upperBoundExclusive: 4_294_967_295
} as const);

/**
 * Fixed method policy. Dynamic consumer and package coordinates remain explicit on
 * each request and are never inferred from an import occurrence.
 */
export const CONDITIONAL_EXPORT_RESOLUTION_SELECTION = Object.freeze({
	branchOrder: 'RAW_MANIFEST_DECLARATION_PREORDER',
	conditionActivation: 'EXPLICIT_CONDITIONS_PLUS_MODULE_MODE_AND_PLATFORM',
	conditionKeyNumericPropertyPolicy: CONDITIONAL_EXPORT_RESOLUTION_NUMERIC_CONDITION_KEY_POLICY,
	conditionPriority: 'RAW_MANIFEST_DECLARATION_ORDER',
	defaultCondition: 'ACTIVE_WHEN_ENCOUNTERED',
	effectiveConditionOrder: 'EXPLICIT_THEN_PLATFORM_THEN_MODULE_MODE',
	explicitConditions:
		'UNIQUE_NONEMPTY_UNICODE_SCALAR_NAMES_EXCLUDING_DEFAULT_IMPORT_REQUIRE_NODE_AND_NODE_CANONICAL_NUMERIC_PROPERTY_KEYS',
	exportMap: 'PACKAGE_EXPORTS_ONLY',
	exportSubpath: 'EXACT_DOT_OR_DOT_SLASH_SUBPATH_ONLY',
	exportSubpathSyntax: CONDITIONAL_EXPORT_RESOLUTION_SAFE_SUBPATH_SYNTAX,
	leafKinds: Object.freeze(['STRING', 'NULL'] as const),
	manifestSource: 'FROZEN_SUBJECT_ARTIFACT_BYTES_ONLY',
	packagePopulation: 'ONE_EXACT_FROZEN_WORKSPACE_PACKAGE',
	reservedExplicitConditions:
		'DEFAULT_IMPORT_REQUIRE_NODE_AND_NODE_CANONICAL_NUMERIC_PROPERTY_KEYS_FORBIDDEN',
	sourceSpanPolicy: 'TYPESCRIPT_NODE_GET_START_TO_END_EXCLUDING_LEADING_TRIVIA',
	targetSyntax: CONDITIONAL_EXPORT_RESOLUTION_SAFE_TARGET_SYNTAX,
	unsupportedTreatment: 'EXPLICIT_FRONTIER_NEVER_RESOLUTION_MISS'
} as const);

export const CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_012_CONDITIONAL_EXPORT_RESOLUTION',
	'PACKAGE_IMPORTS_MAP_RESOLUTION',
	'EXPORT_SUBPATH_PATTERN_RESOLUTION',
	'EXPORT_ARRAY_FALLBACK_RESOLUTION',
	'EXPORTS_ROOT_CONDITION_SUGAR_RESOLUTION',
	'EXTERNAL_OR_NODE_MODULES_PACKAGE_MAP_RESOLUTION',
	'PACKAGE_SELF_REFERENCE_OR_BARE_SPECIFIER_RESOLUTION',
	'UNDECLARED_OR_AUTOMATIC_CUSTOM_RUNTIME_LOADER_CONDITIONS',
	'AUTOMATIC_NODE_ADDONS_OR_MODULE_SYNC_CONDITION_ACTIVATION',
	'UNIVERSAL_CONDITION_SET_OR_EXPORT_TARGET',
	'JAN_CSAA_CAP_011_PATH_ALIAS_OR_MODULE_RESOLUTION',
	'TARGET_PATH_EXISTENCE_OR_FILESYSTEM_RESOLUTION',
	'TARGET_SYNTAX_BEYOND_DECLARED_SAFE_SUBSET',
	'TARGET_MODULE_FORMAT_TYPE_COMPATIBILITY_OR_LOADABILITY',
	'NODE_RESOLVER_EQUIVALENCE_BEYOND_SELECTED_EXACT_EXPORT_SLICE',
	'BUILD_SUCCESS_OR_RUNTIME_LOADABILITY',
	'CURRENTNESS_OR_FRESHNESS',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

declare const conditionalExportResolutionBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [conditionalExportResolutionBrand]: Kind;
};

export type ConditionalExportResolutionId = Branded<'ConditionalExportResolution'>;
export type ConditionalExportBranchId = Branded<'ConditionalExportBranch'>;
export type ConditionalExportDecisionId = Branded<'ConditionalExportDecision'>;
export type ConditionalExportFrontierId = Branded<'ConditionalExportFrontier'>;

export type ConditionalExportModuleMode = 'IMPORT' | 'REQUIRE';
export type ConditionalExportPlatform = 'NEUTRAL' | 'NODE';
export type ConditionalExportSubpath = '.' | `./${string}`;

export interface ConditionalExportResolutionBudgets {
	readonly maxAstNodes: number;
	/** Zero is valid when the exact export value is a direct string/null or is absent. */
	readonly maxBranches: number;
	/** Zero is valid when no conditional property is evaluated. */
	readonly maxConditionChecks: number;
	readonly maxDiagnostics: number;
	/** Zero is valid for a completely supported selected surface. */
	readonly maxFrontiers: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxManifestBytes: number;
	readonly maxOutputRecords: number;
	readonly maxTraversalSteps: number;
}

export interface ConditionalExportConsumerCriterion {
	readonly projectContextProgramId: ProjectContextProgramId;
	readonly projectContextSourceId: ProjectContextSourceId;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface ConditionalExportProjectContextGraphReference {
	readonly contentDigest: string;
	readonly graphId: ProjectContextGraphId;
	readonly inputDigest: string;
}

export interface ConditionalExportResolutionRequest {
	readonly budgets: ConditionalExportResolutionBudgets;
	readonly conditions: readonly string[];
	readonly consumer: ConditionalExportConsumerCriterion;
	readonly exportSubpath: ConditionalExportSubpath;
	readonly manifestPath: string;
	readonly moduleMode: ConditionalExportModuleMode;
	readonly operationVersion: typeof CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION;
	readonly packageName: string;
	readonly platform: ConditionalExportPlatform;
	readonly projectContextGraph: ConditionalExportProjectContextGraphReference;
	readonly schemaVersion: typeof CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION;
	readonly selection: typeof CONDITIONAL_EXPORT_RESOLUTION_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface ConditionalExportResolutionBuildInputs {
	readonly frozenSubject: FrozenSubject;
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	readonly request: ConditionalExportResolutionRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type ConditionalExportResolutionInputs = ConditionalExportResolutionBuildInputs;

/** A half-open span over the raw decoded manifest text. */
export interface ConditionalExportManifestSourceSpan {
	readonly coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN';
	readonly length: number;
	readonly start: number;
}

export interface ConditionalExportManifestWitness {
	readonly exportsPropertySpan: ConditionalExportManifestSourceSpan | null;
	/** SHA-256 of the UTF-8 encoding of the exact decoded exports-value source slice. */
	readonly exportsValueSha256: string | null;
	readonly exportsValueSpan: ConditionalExportManifestSourceSpan | null;
	readonly importsPropertySpan: ConditionalExportManifestSourceSpan | null;
	readonly manifestBytes: number;
	readonly manifestPath: string;
	readonly manifestSha256: string;
	readonly parseMethod: 'TYPESCRIPT_PARSE_JSON_TEXT';
	readonly parserVersion: string;
	readonly rootSpan: ConditionalExportManifestSourceSpan;
	readonly sourceEncoding: 'UTF-8';
	readonly workspaceKind: 'PACKAGE';
	readonly workspaceName: string;
	readonly workspacePath: string;
}

export interface ConditionalExportConsumerEnvironment {
	readonly conditionSemantics: 'MEMBERSHIP_ONLY_PRIORITY_FROM_MANIFEST_DECLARATION_ORDER';
	readonly conditions: readonly string[];
	readonly defaultConditionEnabled: true;
	readonly effectiveConditions: readonly string[];
	readonly logicalPath: string;
	readonly moduleMode: ConditionalExportModuleMode;
	readonly platform: ConditionalExportPlatform;
	readonly projectContextProgramId: ProjectContextProgramId;
	readonly projectContextProjectId: ProjectContextProjectId;
	readonly projectContextSourceId: ProjectContextSourceId;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface ConditionalExportResolutionCanonicalBinding {
	readonly consumerEnvironment: ConditionalExportConsumerEnvironment;
	readonly manifestWitness: ConditionalExportManifestWitness;
}

export type ConditionalExportExactKeyOutcome =
	| {
			readonly declarationOrdinal: number;
			readonly exportSubpath: ConditionalExportSubpath;
			/** For ROOT_DOT_SUGAR this is the root `exports` property-name span. */
			readonly keySpan: ConditionalExportManifestSourceSpan;
			readonly matchKind: 'EXPLICIT_SUBPATH_KEY' | 'ROOT_DOT_SUGAR';
			readonly state: 'MATCHED';
			readonly valueSpan: ConditionalExportManifestSourceSpan;
	  }
	| {
			readonly exportSubpath: ConditionalExportSubpath;
			readonly state: 'ABSENT';
	  };

export type ConditionalExportBranchEvaluation = 'CANDIDATE' | 'EXCLUDED' | 'SELECTED';
export type ConditionalExportBranchExclusionReason =
	| 'ANCESTOR_CONDITION_INACTIVE'
	| 'CONDITION_INACTIVE'
	| 'PRIOR_BRANCH_TERMINATED_EVALUATION'
	| null;

/**
 * One property in the selected exact-key condition tree. Direct string/null
 * export values deliberately produce no branch records.
 */
export interface ConditionalExportBranchRecord {
	readonly condition: string;
	readonly conditionMatch: 'DEFAULT' | 'EXPLICIT' | 'MODULE_MODE' | 'PLATFORM' | 'INACTIVE';
	readonly conditionPath: readonly string[];
	readonly declarationOrdinal: number;
	readonly depth: number;
	readonly evaluation: ConditionalExportBranchEvaluation;
	readonly exclusionReason: ConditionalExportBranchExclusionReason;
	readonly id: ConditionalExportBranchId;
	readonly keySpan: ConditionalExportManifestSourceSpan;
	readonly ordinal: number;
	readonly target: string | null;
	readonly valueKind: 'CONDITION_OBJECT' | 'NULL' | 'STRING';
	readonly valueSpan: ConditionalExportManifestSourceSpan;
}

export type ConditionalExportFrontierReason =
	| 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
	| 'EXPORT_PATTERN_KEY_UNSUPPORTED'
	| 'EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED'
	| 'PACKAGE_IMPORTS_MAP_UNSUPPORTED'
	| 'UNSUPPORTED_EXPORT_TARGET_SYNTAX'
	| 'UNSUPPORTED_EXPORT_VALUE_KIND';

export interface ConditionalExportFrontierRecord {
	/** Zero-based PropertyAssignment preorder; arrays use their containing property's ordinal. */
	readonly declarationOrdinal: number;
	readonly declarationPath: readonly string[];
	readonly id: ConditionalExportFrontierId;
	readonly impact: 'BLOCKS_SELECTED_DECISION' | 'OUTSIDE_SELECTED_DECISION';
	readonly ordinal: number;
	readonly reason: ConditionalExportFrontierReason;
	readonly sourceSpan: ConditionalExportManifestSourceSpan;
}

export type ConditionalExportDecisionState =
	| 'BLOCKED_BY_NULL'
	| 'NO_EXACT_EXPORT_KEY'
	| 'NO_MATCHING_CONDITION'
	| 'SELECTED_TARGET'
	| 'UNSUPPORTED';

interface ConditionalExportDecisionBase {
	readonly basis: 'RAW_MANIFEST_DECLARATION_ORDER_FOR_EXACT_CONSUMER_ENVIRONMENT';
	readonly id: ConditionalExportDecisionId;
	readonly ordinal: 0;
}

export type ConditionalExportDecisionRecord = ConditionalExportDecisionBase &
	(
		| {
				readonly selectedBranchId: ConditionalExportBranchId | null;
				readonly state: 'BLOCKED_BY_NULL';
				readonly target: null;
		  }
		| {
				readonly selectedBranchId: null;
				readonly state: 'NO_EXACT_EXPORT_KEY' | 'NO_MATCHING_CONDITION' | 'UNSUPPORTED';
				readonly target: null;
		  }
		| {
				readonly selectedBranchId: ConditionalExportBranchId | null;
				readonly state: 'SELECTED_TARGET';
				readonly target: string;
		  }
	);

export interface ConditionalExportResolutionCoverage {
	readonly astNodes: number;
	readonly branchPopulationReconciles: true;
	readonly branchRecords: number;
	readonly candidateBranches: number;
	/** astNodes + exactExportKeyComparisons + branchRecords + frontierRecords. */
	readonly chargedTraversalSteps: number;
	/** Exactly branchRecords; separately bounded and not double-charged as traversal. */
	readonly conditionChecks: number;
	readonly decisionPopulationReconciles: true;
	readonly decisionRecords: 1;
	/**
	 * Every raw exports subpath-map key beginning with '.', including patterns, or
	 * one implicit `.` comparison for a direct root exports-sugar candidate.
	 */
	readonly exactExportKeyComparisons: number;
	readonly exactExportKeyMatches: 0 | 1;
	readonly exactExportKeyMisses: 0 | 1;
	readonly excludedBranches: number;
	readonly frontierPopulationReconciles: true;
	readonly frontierRecords: number;
	readonly manifestBytes: number;
	/** One snapshot record plus branchRecords plus frontierRecords; singletons are embedded. */
	readonly outputRecords: number;
	readonly selectedBranches: number;
	readonly selectedConsumerPrograms: 1;
	readonly selectedConsumerSources: 1;
	readonly selectedManifests: 1;
	readonly selectedWorkspacePackages: 1;
	readonly blockedByNullDecisions: 0 | 1;
	readonly noExactExportKeyDecisions: 0 | 1;
	readonly noMatchingConditionDecisions: 0 | 1;
	readonly selectedTargetDecisions: 0 | 1;
	readonly unsupportedDecisions: 0 | 1;
}

export interface ConditionalExportResolutionSnapshot {
	readonly authorityTransfer: typeof CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER;
	readonly branches: readonly ConditionalExportBranchRecord[];
	readonly budgets: ConditionalExportResolutionBudgets;
	readonly canonicalProfile: typeof CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE;
	readonly capability: typeof CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY;
	readonly capabilityStatus: typeof CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS;
	readonly closure:
		'CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION' | 'OPEN_FOR_SELECTED_EXACT_EXPORT_DECISION';
	readonly consumerEnvironment: ConditionalExportConsumerEnvironment;
	readonly contentDigest: string;
	readonly coverage: ConditionalExportResolutionCoverage;
	readonly currentness: typeof CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS;
	readonly decision: ConditionalExportDecisionRecord;
	readonly exactKeyOutcome: ConditionalExportExactKeyOutcome;
	readonly freshness: typeof CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS;
	readonly frontiers: readonly ConditionalExportFrontierRecord[];
	readonly fullJanCsaa012Conformance: typeof CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE;
	readonly gateEffect: typeof CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT;
	readonly health: 'PARTIAL';
	readonly id: ConditionalExportResolutionId;
	readonly inputDigest: string;
	readonly manifestWitness: ConditionalExportManifestWitness;
	readonly method: typeof CONDITIONAL_EXPORT_RESOLUTION_METHOD;
	readonly nonclaims: typeof CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS;
	readonly operationVersion: typeof CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION;
	readonly projectContextGraph: ConditionalExportProjectContextGraphReference;
	readonly resolutionAuthority: typeof CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY;
	readonly resultCompleteness:
		| 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_CRITERION'
		| 'UNRESOLVED_SELECTED_CRITERION_WITH_EXPLICIT_FRONTIER';
	readonly schemaVersion: typeof CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION;
	readonly selection: typeof CONDITIONAL_EXPORT_RESOLUTION_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
	readonly truncation: { readonly reason: null; readonly state: 'NOT_TRUNCATED' };
}

export type ConditionalExportResolutionResult = ConditionalExportResolutionSnapshot;

export type ConditionalExportResolutionDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'MANIFEST_INVALID'
	| 'MANIFEST_UNAVAILABLE'
	| 'PROJECT_CONTEXT_GRAPH_INVALID'
	| 'REQUEST_INVALID'
	| 'RESOLUTION_VALIDATION_FAILED';

export interface ConditionalExportResolutionDiagnostic {
	readonly code: ConditionalExportResolutionDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase:
		'BIND' | 'CONSUMER' | 'EVALUATE' | 'MANIFEST' | 'MATERIALIZE' | 'REQUEST' | 'VALIDATE';
}

export type ConditionalExportResolutionBuildOutcome =
	| {
			readonly diagnostics: readonly ConditionalExportResolutionDiagnostic[];
			readonly outcome: 'partial';
			readonly resolution: ConditionalExportResolutionSnapshot;
	  }
	| {
			readonly diagnostics: readonly ConditionalExportResolutionDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type ConditionalExportResolutionProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'PROJECT_CONTEXT_GRAPH_VALIDATE'
	| 'CONSUMER_BIND'
	| 'MANIFEST_PARSE'
	| 'EXPORT_KEY_MATCH'
	| 'CONDITION_EVALUATE'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'RESOLUTION_VALIDATE';

export interface ConditionalExportResolutionProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: ConditionalExportResolutionProgressPhase;
	readonly schemaVersion: typeof CONDITIONAL_EXPORT_RESOLUTION_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildConditionalExportResolutionOptions {
	readonly onProgress?: (event: ConditionalExportResolutionProgressEvent) => void;
}

export interface ConditionalExportResolutionValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type ConditionalExportResolutionValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'DERIVATION_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface ConditionalExportResolutionValidationIssue {
	readonly code: ConditionalExportResolutionValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type ConditionalExportResolutionValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly ConditionalExportResolutionValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
