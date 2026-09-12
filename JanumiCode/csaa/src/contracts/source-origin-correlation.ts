import type {
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	SourceOrigin,
	StaticSemanticSnapshot
} from './semantic.js';
import type { FrozenSubject } from './subject.js';

export const SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-source-origin-correlation-request/1.0.0' as const;
export const SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION =
	'jan-csaa-source-origin-correlation/1.0.0' as const;
export const SOURCE_ORIGIN_CORRELATION_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-source-origin-correlation-progress/1.0.0' as const;
export const SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION =
	'jan-csaa-build-source-origin-correlation/0.1.0' as const;
export const SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE =
	'jan-csaa-source-origin-correlation-canonical/1.0.0' as const;
export const SOURCE_ORIGIN_CORRELATION_METHOD =
	'validated-typescript-external-declaration-map-exact-segment-correlation-over-fresh-project-scoped-re-emission/1.0.0' as const;
export const SOURCE_ORIGIN_CORRELATION_CAPABILITY = 'JAN-CSAA-CAP-014' as const;
export const SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS = 'PARTIAL' as const;
export const SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE = 'NOT_CLAIMED' as const;
export const SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const SOURCE_ORIGIN_CORRELATION_AUTHORITY = 'NONE' as const;
export const SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER = 'NONE' as const;
export const SOURCE_ORIGIN_CORRELATION_GATE_EFFECT = 'NONE' as const;
export const SOURCE_ORIGIN_CORRELATION_FRESHNESS = 'NOT_ASSESSED' as const;
export const SOURCE_ORIGIN_CORRELATION_CURRENTNESS = 'NOT_CLAIMED' as const;

export const SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER = Object.freeze([
	'TARGET_DECLARATION',
	'EXTERNAL_DECLARATION_MAP',
	'AUTHORED_SOURCE'
] as const);

export const SOURCE_ORIGIN_CORRELATION_LOCATION_ROLE_ORDER = Object.freeze([
	'GENERATED_TARGET',
	'AUTHORED_ORIGIN'
] as const);

/** The only accepted v1 source-origin correlation surface. */
export const SOURCE_ORIGIN_CORRELATION_SELECTION = Object.freeze({
	artifactOrdering:
		'ROLE_RANK_TARGET_DECLARATION_EXTERNAL_DECLARATION_MAP_AUTHORED_SOURCE_THEN_LOGICAL_PATH_UTF16_CODE_UNIT_LEXICOGRAPHIC',
	authoredCoordinateUniqueness:
		'REQUIRE_ONE_TO_ONE_UNIQUE_ZERO_BASED_UTF16_AUTHORED_LINE_COLUMN_ACROSS_THE_COMPLETE_DECODED_MAPPED_SEGMENT_POPULATION',
	authoredSourcePopulation:
		'ONE_EXACT_SELECTED_SEMANTIC_ROOT_SOURCE_IN_ONE_EXACT_SELECTED_BUILD_PROGRAM',
	canonicalSourceMapShape:
		'FLAT_EXTERNAL_SOURCE_MAP_V3_WITH_VERSION_3_FILE_TARGET_BASENAME_EMPTY_SOURCE_ROOT_ONE_RELATIVE_SOURCE_EMPTY_NAMES_ABSENT_SOURCES_CONTENT_AND_NO_SECTIONS',
	callerCapturePolicy:
		'DESCRIPTOR_ONLY_PROXY_BRAND_BACKING_BUFFER_VIEW_AND_COMBINED_LENGTH_PREFLIGHT_MAY_PRECEDE_COPY_WITH_NO_BYTE_OR_CONTENT_INSPECTION_OR_CALLER_BEHAVIOR_THEN_COPY_TARGET_DECLARATION_AND_EXTERNAL_DECLARATION_MAP_UINT8ARRAY_INPUTS_AND_RECONCILE_EXACT_REQUEST_LENGTH_SHA256_AND_FRESH_EMISSION_BYTES',
	capabilityPredecessors: 'NONE_EXACT_ARTIFACT_AND_BUILD_IDENTITIES_ARE_DIRECT_INPUTS',
	coordinateEncoding: 'ZERO_BASED_UTF16_CODE_UNIT_OFFSET_LINE_AND_COLUMN',
	decodedSegmentPopulation:
		'EVERY_BASE64_VLQ_DECODED_SEGMENT_MUST_BE_A_FOUR_FIELD_MAPPED_SEGMENT_WITH_SOURCE_INDEX_ZERO_AND_NO_NAME_INDEX',
	deliveryWorkPackage: 'DWP-003_SEMANTIC_COMPLETION',
	emissionApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT',
	emissionDiagnostics: 'ZERO_PUBLIC_EMIT_DIAGNOSTICS',
	emissionMode:
		'FRESH_VERIFIED_PROJECT_SCOPED_PROGRAM_EMIT_SELECTED_SOURCE_FILE_WITH_EMIT_ONLY_DTS_FILES_TRUE',
	emissionOutputPopulation:
		'EXACTLY_ONE_DECLARATION_AND_ONE_EXTERNAL_DECLARATION_MAP_WITH_NO_OTHER_WRITEFILE_OUTPUTS',
	emissionReconciliation:
		'UTF8_ENCODE_EACH_PUBLIC_WRITEFILE_TEXT_WITH_ITS_BYTE_ORDER_MARK_FLAG_AND_REQUIRE_BYTE_EQUALITY_TO_CALLER_CAPTURE',
	generatedCoordinateUniqueness:
		'REQUIRE_ONE_TO_ONE_UNIQUE_ZERO_BASED_UTF16_GENERATED_LINE_COLUMN_ACROSS_THE_COMPLETE_DECODED_MAPPED_SEGMENT_POPULATION',
	locationPopulation:
		'EXACTLY_TWO_ZERO_WIDTH_LOCATIONS_PER_DECODED_MAPPED_SEGMENT_ONE_GENERATED_AND_ONE_AUTHORED',
	mapDecoding: 'COMPLETE_STRICT_BASE64_VLQ_SOURCE_MAP_V3_MAPPINGS_DECODE',
	mapOrdering: 'GENERATED_LINE_THEN_GENERATED_COLUMN_ASCENDING',
	mapPathResolution:
		'POSIX_MAP_DIRECTORY_PLUS_EMPTY_SOURCE_ROOT_PLUS_ONE_RELATIVE_SOURCE_NORMALIZED_INSIDE_FROZEN_SUBJECT_ROOT',
	originCorrelationPopulation:
		'EXACTLY_ONE_EXACT_BIDIRECTIONAL_CORRELATION_PER_DECODED_MAPPED_SEGMENT',
	programInputAccounting:
		'ALL_ACTUAL_PROGRAM_COMPILER_HOST_CALLBACK_ATTEMPTS_INCLUDING_BOUNDED_DECLARATION_EMIT_REPLAY_OF_EXACT_ALREADY_ATTRIBUTED_QUERY_IDENTITIES_AND_RESPONSES_CHARGED_WITH_DUPLICATE_PRESENT_READ_BYTES_NO_UNKNOWN_QUERY_OR_LIVE_FILESYSTEM_FALLBACK_AND_COMPACT_COUNT_DIGEST_RECONCILIATION_WITHOUT_PER_ATTEMPT_OUTPUT_RECORDS',
	programInputStages: Object.freeze([
		'PROGRAM_CONSTRUCTION',
		'TYPE_CHECKER_CREATE',
		'CALLER_ANALYSIS',
		'DECLARATION_EMIT'
	] as const),
	programSourceOrdering: 'LOGICAL_PATH_THEN_SEMANTIC_SOURCE_ID_UTF16_CODE_UNIT_LEXICOGRAPHIC',
	rangeInference: 'FORBIDDEN_ZERO_WIDTH_SEGMENT_LOCATIONS_ONLY',
	reverseLookup:
		'EXACT_ONLY_WHEN_EVERY_GENERATED_AND_AUTHORED_COORDINATE_IS_UNIQUE_WITHIN_THE_COMPLETE_MAPPED_SEGMENT_POPULATION',
	sourceMappingTrailer:
		'REQUIRE_ONE_FINAL_SOURCE_MAPPING_URL_LINE_TARGETING_THE_SELECTED_EXTERNAL_DECLARATION_MAP_AND_RECORD_IT_AS_EXPLICITLY_UNMAPPED',
	targetPopulation:
		'ONE_CALLER_CAPTURED_DECLARATION_OUTPUT_AND_ITS_ONE_CALLER_CAPTURED_EXTERNAL_DECLARATION_MAP',
	unmappedGeneratedLinePopulation:
		'EVERY_TARGET_LINE_WITHOUT_A_DECODED_MAPPED_SEGMENT_RECORDED_EXPLICITLY_AND_V1_REQUIRES_EXACTLY_THE_FINAL_SOURCE_MAPPING_URL_TRAILER_LINE',
	unsupportedTreatment: 'OPERATION_UNAVAILABLE_NEVER_PARTIAL_OUTPUT'
} as const);

export const SOURCE_ORIGIN_CORRELATION_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_014_SOURCE_MAP_OR_SOURCE_ORIGIN_CORRELATION',
	'FULL_JAN_CSAA_007_CONFORMANCE',
	'FULL_JAN_CSAA_008_CONFORMANCE',
	'SOURCE_MAP_FORMATS_BEYOND_FLAT_EXTERNAL_VERSION_3_DECLARATION_MAPS',
	'INDEXED_SOURCE_MAPS_OR_SECTIONS',
	'INLINE_SOURCE_MAPS_OR_INLINE_SOURCES_CONTENT',
	'NONEMPTY_SOURCE_ROOT',
	'MULTIPLE_MAP_SOURCES',
	'SOURCE_MAP_NAMES_OR_NAME_INDEXES',
	'ABSOLUTE_URI_BACKSLASH_QUERY_FRAGMENT_OR_REPOSITORY_ESCAPING_SOURCE_PATHS',
	'UNMAPPED_DECODED_SEGMENTS',
	'PARTIAL_AMBIGUOUS_CONFLICTING_INFERRED_GREATEST_LOWER_BOUND_OR_LEAST_UPPER_BOUND_MAPPING',
	'DECLARATION_NAME_SYMBOL_NODE_OR_TOKEN_RANGE_CORRELATION',
	'CONTINUOUS_INTERIOR_RANGE_COVERAGE_BETWEEN_SOURCE_MAP_SEGMENTS',
	'NONZERO_WIDTH_SOURCE_RANGE_INFERENCE',
	'MULTI_HOP_OR_CHAINED_SOURCE_MAP_CORRELATION',
	'JAVASCRIPT_BUNDLE_MINIFIER_TRANSPILER_PREPROCESSOR_OR_FRAMEWORK_SOURCE_MAPS',
	'PROJECTS_PROGRAMS_SOURCES_TARGETS_OR_MAPS_BEYOND_THE_EXACT_REQUEST_SELECTION',
	'JAN_CSAA_CAP_013_DECLARATION_CONTEXT_ANALYSIS',
	'JAN_CSAA_CAP_023_GENERATED_ARTIFACT_LINEAGE',
	'HISTORICAL_OR_PERSISTED_GENERATOR_INPUT_OR_CONFIGURATION_LINEAGE_BEYOND_THE_EXACT_FRESH_REEMISSION_WITNESS',
	'AUTHORED_DECLARATION_SYMBOL_TYPE_OR_SEMANTIC_IDENTITY_FROM_A_MAPPED_LOCATION',
	'AUTHORED_AND_GENERATED_ARTIFACT_EQUIVALENCE',
	'BUILD_SUCCESS_BEYOND_THE_EXACT_FRESH_DECLARATION_EMISSION',
	'TARGET_RUNTIME_LOADABILITY_OR_RUNTIME_BEHAVIOR',
	'FILESYSTEM_CURRENTNESS_OR_FRESHNESS_AFTER_FROZEN_CAPTURE',
	'PERSISTED_STRUCTURED_CLONED_OR_DESERIALIZED_COMPILER_CAPTURE_REPLAY',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'DECLARATION_OR_SOURCE_EDIT_AUTHORITY',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

declare const sourceOriginCorrelationBrand: unique symbol;
type Branded<Kind extends string> = string & { readonly [sourceOriginCorrelationBrand]: Kind };

export type SourceOriginCorrelationId = Branded<'SourceOriginCorrelation'>;
export type SourceOriginArtifactId = Branded<'SourceOriginArtifact'>;
export type SourceOriginSourceMapId = Branded<'SourceOriginSourceMap'>;
export type SourceOriginEmissionId = Branded<'SourceOriginEmission'>;
export type SourceOriginMappingHealthId = Branded<'SourceOriginMappingHealth'>;
export type SourceOriginMapSegmentId = Branded<'SourceOriginMapSegment'>;
export type SourceOriginLocationId = Branded<'SourceOriginLocation'>;
export type SourceOriginCorrelationRecordId = Branded<'SourceOriginCorrelationRecord'>;
export type SourceOriginUnmappedGeneratedLineId = Branded<'SourceOriginUnmappedGeneratedLine'>;

export interface SourceOriginCorrelationBudgets {
	/** Caller-captured target declaration plus declaration-map bytes. */
	readonly maxCallerCaptureBytes: number;
	/** Actual Program host-attempt total, including bounded declaration-emit replay attempts. */
	readonly maxCompilerInputAttempts: number;
	readonly maxCorrelations: number;
	readonly maxDecodedMapLines: number;
	readonly maxDecodedMapSegments: number;
	readonly maxDiagnostics: number;
	/** Fail-closed elapsed wall-clock resource guard; never semantic evidence. */
	readonly maxDurationMs: number;
	readonly maxEmitBytes: number;
	readonly maxEmitOutputs: number;
	/** Bounds public `writeFile` text before UTF-8 encoding. */
	readonly maxEmitStringCharacters: number;
	/**
	 * Occurrence-based plain-data census across exactly three roots: the request, FrozenSubject,
	 * and StaticSemanticSnapshot. Every visited value occurrence is one record; every own property
	 * key and string value is charged by UTF-16 code units. Repeated aliases are recounted at each
	 * occurrence. The outer build-input wrapper and caller target/map Uint8Array captures (including
	 * their elements) are excluded and governed by the separate capture/read byte budgets.
	 */
	readonly maxInputRecords: number;
	/** String-character component of the exact three-root occurrence census defined above. */
	readonly maxInputStringCharacters: number;
	readonly maxLocations: number;
	readonly maxMappingsCharacters: number;
	readonly maxOutputRecords: number;
	/** Per-path ceiling for request, capture, map, emitted-output, and resolved-source paths. */
	readonly maxPathCharacters: number;
	/** Preflighted against the complete capture-attributed PRESENT READ_FILE byte upper bound. */
	readonly maxProgramReadBytes: number;
	readonly maxProgramSourceFiles: number;
	/** Program reads plus caller-captured target and map bytes; duplicate reads are charged. */
	readonly maxReadBytes: number;
	readonly maxSourceMapJsonDepth: number;
	readonly maxSourceMapJsonRecords: number;
	readonly maxSourceTextCodeUnits: number;
	readonly maxTraversalSteps: number;
	readonly maxUnmappedGeneratedLines: number;
}

/** Exact caller-visible identity for one immutable byte capture. */
export interface SourceOriginArtifactCaptureDescriptor {
	readonly contentBytes: number;
	readonly contentSha256: string;
	readonly logicalPath: string;
}

export interface SourceOriginCorrelationRequest {
	readonly budgets: SourceOriginCorrelationBudgets;
	readonly declarationMap: SourceOriginArtifactCaptureDescriptor;
	readonly operationVersion: typeof SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION;
	readonly schemaVersion: typeof SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION;
	readonly selection: typeof SOURCE_ORIGIN_CORRELATION_SELECTION;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSourceId: SemanticSourceId;
	readonly subjectId: string;
	readonly targetDeclaration: SourceOriginArtifactCaptureDescriptor;
}

/**
 * The byte arrays are capability inputs, not serialized evidence. Descriptor-only proxy, brand,
 * backing-buffer, view, and combined-length preflight may precede copying, but it must not inspect
 * byte/content values or invoke caller behavior. The builder then copies both arrays before byte or
 * content validation and binds the copies to their request descriptors and fresh emission.
 */
export interface SourceOriginCorrelationBuildInputs {
	readonly declarationMapBytes: Readonly<Uint8Array>;
	readonly frozenSubject: FrozenSubject;
	readonly request: SourceOriginCorrelationRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly targetDeclarationBytes: Readonly<Uint8Array>;
}

export type SourceOriginCorrelationInputs = SourceOriginCorrelationBuildInputs;

export interface SourceOriginSemanticValidationWitness {
	readonly context: 'FROZEN_SUBJECT';
	readonly frozenSubjectSha256: string;
	readonly method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSnapshotSha256: string;
	readonly state: 'VALID';
	readonly subjectId: string;
}

export interface SourceOriginCanonicalizationWitness {
	readonly algorithm: 'CANONICAL_SEMANTIC_JSON_PREFIXED_SHA256';
	readonly idAlgorithmVersion: '1';
	readonly inputDigest: string;
	readonly state: 'INPUT_AND_DERIVED_POPULATIONS_RECONCILED';
}

export type SourceOriginArtifactRole =
	(typeof SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER)[number];

interface SourceOriginArtifactRecordBase {
	readonly bytes: number;
	readonly contentSha256: string;
	readonly id: SourceOriginArtifactId;
	readonly logicalPath: string;
	readonly ordinal: number;
	readonly role: SourceOriginArtifactRole;
}

export interface SourceOriginTargetDeclarationArtifactRecord extends SourceOriginArtifactRecordBase {
	readonly artifactClass: 'GENERATED_DECLARATION';
	readonly captureDescriptorReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256';
	readonly captureMethod: 'CALLER_SUPPLIED_IMMUTABLE_BYTE_COPY';
	readonly declarationFile: true;
	readonly emissionReconciliation: 'EXACT_BYTE_EQUAL';
	readonly origin: 'GENERATED_DECLARATION';
	readonly role: 'TARGET_DECLARATION';
}

export interface SourceOriginDeclarationMapArtifactRecord extends SourceOriginArtifactRecordBase {
	readonly artifactClass: 'SOURCE_MAP';
	readonly captureDescriptorReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256';
	readonly captureMethod: 'CALLER_SUPPLIED_IMMUTABLE_BYTE_COPY';
	readonly emissionReconciliation: 'EXACT_BYTE_EQUAL';
	readonly mapRole: 'EXTERNAL_DECLARATION_MAP';
	readonly origin: 'GENERATED';
	readonly role: 'EXTERNAL_DECLARATION_MAP';
}

export interface SourceOriginAuthoredArtifactRecord extends SourceOriginArtifactRecordBase {
	readonly artifactClass: 'AUTHORED_SOURCE';
	readonly captureMethod: 'VERIFIED_PROJECT_SCOPED_PROGRAM_SOURCE';
	readonly frozenSubjectManifestReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256';
	readonly origin: SourceOrigin;
	readonly programSourceReconciliation: 'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID';
	readonly role: 'AUTHORED_SOURCE';
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export type SourceOriginArtifactRecord =
	| SourceOriginTargetDeclarationArtifactRecord
	| SourceOriginDeclarationMapArtifactRecord
	| SourceOriginAuthoredArtifactRecord;

export interface SourceOriginEmissionOutputWitness {
	readonly artifactId: SourceOriginArtifactId;
	readonly bytes: number;
	readonly contentSha256: string;
	readonly logicalPath: string;
	readonly ordinal: 0 | 1;
	readonly role: 'EXTERNAL_DECLARATION_MAP' | 'TARGET_DECLARATION';
	readonly sourceFileSemanticSourceIds: readonly [SemanticSourceId];
	readonly writeByteOrderMark: false;
}

/** One exact fresh declaration-only emission from the selected captured build Program. */
export interface SourceOriginEmissionWitness {
	readonly attributedCompilerInputAttempts: number;
	readonly attributedProgramReadBytes: number;
	readonly attributedUniqueQueries: number;
	readonly captureContextDigest: string;
	readonly compilerOptionsDigest: string;
	readonly compilerVersion: string;
	readonly configPath: string;
	readonly declarationEmitCallbacksUseOnlyAttributedQueries: true;
	readonly declarationEmitCompilerInputAttempts: number;
	readonly declarationEmitReadBytes: number;
	readonly emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT';
	readonly emitDiagnostics: readonly [];
	readonly emitOnlyDtsFiles: true;
	readonly emitSkipped: false;
	readonly id: SourceOriginEmissionId;
	readonly materializedRecipeDigest: string;
	readonly outputReconciliation: 'EXACT_TARGET_DECLARATION_AND_EXTERNAL_DECLARATION_MAP_BYTE_EQUALITY';
	readonly outputs: readonly [SourceOriginEmissionOutputWitness, SourceOriginEmissionOutputWitness];
	/** Construction, checker-creation, and caller-analysis callbacks remain within capture bounds. */
	readonly programCallbacksWithinAttributedInvocationBounds: true;
	/** Actual total including the separately bounded `DECLARATION_EMIT` replay attempts. */
	readonly programCompilerInputAttempts: number;
	readonly programInputAttemptPopulationDigest: string;
	readonly programInputAttemptPopulationReconciles: true;
	readonly programPresentReadFileAttempts: number;
	/** Actual duplicate-inclusive total including `DECLARATION_EMIT` replay reads. */
	readonly programReadBytes: number;
	readonly programSourceFiles: number;
	readonly programSourceFilePopulationReconciles: true;
	readonly programSourcePopulationDigest: string;
	readonly projectResolutionDigest: string;
	readonly selectedSourceLogicalPath: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly state: 'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE';
}

export interface SourceOriginSourceMapRecord {
	readonly decodedLines: number;
	readonly decodedSegments: number;
	readonly file: string;
	readonly format: 'SOURCE_MAP_V3';
	readonly id: SourceOriginSourceMapId;
	readonly mapArtifactId: SourceOriginArtifactId;
	readonly mappingEncoding: 'BASE64_VLQ';
	readonly mappingsCharacters: number;
	readonly mappingsSha256: string;
	readonly names: readonly [];
	readonly ordinal: 0;
	readonly rawSources: readonly [string];
	readonly resolvedSourceArtifactIds: readonly [SourceOriginArtifactId];
	readonly segmentIds: readonly SourceOriginMapSegmentId[];
	readonly sourceRoot: '';
	readonly sourcesContent: 'ABSENT';
	readonly targetArtifactId: SourceOriginArtifactId;
	readonly unmappedGeneratedLineIds: readonly SourceOriginUnmappedGeneratedLineId[];
	readonly version: 3;
}

/** One mapped four-field segment from the complete decoded mappings population. */
export interface SourceOriginMapSegmentRecord {
	readonly decodedFieldCount: 4;
	readonly generatedColumn: number;
	readonly generatedLine: number;
	readonly id: SourceOriginMapSegmentId;
	readonly lineSegmentOrdinal: number;
	readonly mapId: SourceOriginSourceMapId;
	readonly nameIndex: null;
	readonly ordinal: number;
	readonly originalColumn: number;
	readonly originalLine: number;
	readonly sourceArtifactId: SourceOriginArtifactId;
	readonly sourceIndex: 0;
	readonly state: 'MAPPED';
	readonly targetArtifactId: SourceOriginArtifactId;
}

export type SourceOriginLocationRole =
	(typeof SOURCE_ORIGIN_CORRELATION_LOCATION_ROLE_ORDER)[number];

/** A zero-width Source Map coordinate resolved to an exact UTF-16 offset. */
export interface SourceOriginLocationRecord {
	readonly artifactId: SourceOriginArtifactId;
	readonly column: number;
	readonly coordinateEncoding: 'ZERO_BASED_UTF16_CODE_UNIT';
	readonly id: SourceOriginLocationId;
	readonly line: number;
	readonly offset: number;
	readonly ordinal: number;
	readonly role: SourceOriginLocationRole;
	readonly segmentId: SourceOriginMapSegmentId;
	readonly width: 0;
}

/** Exact in both directions because both endpoint coordinate populations are unique. */
export interface SourceOriginExactCorrelationRecord {
	readonly authoredLocationId: SourceOriginLocationId;
	readonly directionality: 'BIDIRECTIONAL_EXACT_ONE_TO_ONE';
	readonly generatedLocationId: SourceOriginLocationId;
	readonly id: SourceOriginCorrelationRecordId;
	readonly kind: 'GENERATED_TO_AUTHORED_SOURCE_MAP_SEGMENT';
	readonly mapId: SourceOriginSourceMapId;
	readonly mappingHealthId: SourceOriginMappingHealthId;
	readonly ordinal: number;
	readonly segmentId: SourceOriginMapSegmentId;
	readonly state: 'EXACT';
}

/** One complete generated line that has no decoded mapped segment in the selected map. */
export interface SourceOriginUnmappedGeneratedLineRecord {
	readonly classification: 'SOURCE_MAPPING_URL_TRAILER';
	readonly contentSha256: string;
	readonly endColumn: number;
	readonly endOffset: number;
	readonly id: SourceOriginUnmappedGeneratedLineId;
	readonly line: number;
	readonly lineTerminatorWidth: 0 | 1 | 2;
	readonly mapId: SourceOriginSourceMapId;
	readonly ordinal: number;
	readonly reason: 'NO_DECODED_SOURCE_MAP_SEGMENT_FOR_REQUIRED_FINAL_SOURCE_MAPPING_URL_LINE';
	readonly startColumn: 0;
	readonly startOffset: number;
	readonly state: 'UNMAPPED';
	readonly targetArtifactId: SourceOriginArtifactId;
}

export interface SourceOriginMappingHealthRecord {
	readonly authoredCoordinatePopulationUnique: true;
	readonly callerCapturePopulationReconciles: true;
	readonly completeDecodedSegmentPopulation: true;
	readonly correlationPopulationReconciles: true;
	readonly emittedDeclarationMapMatchesCapture: true;
	readonly emittedDeclarationMatchesCapture: true;
	readonly generatedCoordinatePopulationUnique: true;
	readonly id: SourceOriginMappingHealthId;
	readonly mapArtifactIdentityMatches: true;
	readonly mapParseHealth: 'VALID';
	readonly mappedSegments: number;
	readonly ordinal: 0;
	readonly reverseLookup: 'TOTAL_UNIQUE_OVER_COMPLETE_MAPPED_SEGMENT_POPULATION';
	readonly sourceArtifactIdentityMatches: true;
	readonly sourcePathResolution: 'EXACT_REPOSITORY_INTERNAL';
	readonly state: 'EXACT';
	readonly targetArtifactIdentityMatches: true;
	readonly unmappedGeneratedLinesExplicit: true;
}

export interface SourceOriginCorrelationCoverage {
	readonly ambiguousMappings: 0;
	readonly artifacts: 3;
	readonly authoredLocations: number;
	readonly brokenMappings: 0;
	readonly callerCaptureBytes: number;
	readonly callerCapturePopulationReconciles: true;
	readonly callerCaptureRecords: 2;
	/**
	 * Program attempts plus two caller capture records. Caller capture bytes are charged once even
	 * when they equal freshly emitted output bytes.
	 */
	readonly chargedInputRecords: number;
	readonly chargedTraversalSteps: number;
	readonly conflictingMappings: 0;
	readonly correlationPopulationReconciles: true;
	readonly correlations: number;
	readonly decodedLines: number;
	readonly decodedSegmentPopulationReconciles: true;
	readonly decodedSegments: number;
	readonly emitBytes: number;
	readonly emitDiagnostics: 0;
	readonly emitOutputs: 2;
	readonly emittedOutputPopulationReconciles: true;
	readonly exactMappings: number;
	readonly generatedLocations: number;
	readonly inferredMappings: 0;
	readonly locationPopulationReconciles: true;
	readonly locations: number;
	readonly mappingHealthRecords: 1;
	readonly mappingsCharacters: number;
	readonly outputRecords: number;
	readonly partialMappings: 0;
	readonly programCompilerInputAttemptPopulationReconciles: true;
	readonly programCompilerInputAttempts: number;
	readonly programPresentReadFileAttempts: number;
	readonly programReadBytes: number;
	readonly programSourceFilePopulationReconciles: true;
	readonly programSourceFiles: number;
	/** Program reads plus the two caller capture byte populations. */
	readonly readBytes: number;
	readonly sourceMaps: 1;
	readonly unavailableMappings: 0;
	readonly unmappedGeneratedLinePopulationReconciles: true;
	readonly unmappedGeneratedLines: number;
}

export interface SourceOriginCorrelationSnapshot {
	readonly analysisAuthority: typeof SOURCE_ORIGIN_CORRELATION_AUTHORITY;
	readonly artifacts: readonly SourceOriginArtifactRecord[];
	readonly authorityTransfer: typeof SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER;
	readonly budgets: SourceOriginCorrelationBudgets;
	readonly canonicalProfile: typeof SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE;
	readonly canonicalizationWitness: SourceOriginCanonicalizationWitness;
	readonly capability: typeof SOURCE_ORIGIN_CORRELATION_CAPABILITY;
	readonly capabilityStatus: typeof SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS;
	readonly closure: 'CLOSED_FOR_EXACT_REEMITTED_DECLARATION_MAP_DECODED_SEGMENT_POPULATION';
	readonly contentDigest: string;
	readonly correlations: readonly SourceOriginExactCorrelationRecord[];
	readonly coverage: SourceOriginCorrelationCoverage;
	readonly currentness: typeof SOURCE_ORIGIN_CORRELATION_CURRENTNESS;
	readonly emission: SourceOriginEmissionWitness;
	readonly freshness: typeof SOURCE_ORIGIN_CORRELATION_FRESHNESS;
	readonly fullJanCsaa007Conformance: typeof SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly fullJanCsaa014Conformance: typeof SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE;
	readonly gateEffect: typeof SOURCE_ORIGIN_CORRELATION_GATE_EFFECT;
	readonly health: 'PARTIAL';
	readonly id: SourceOriginCorrelationId;
	readonly inputDigest: string;
	readonly locations: readonly SourceOriginLocationRecord[];
	readonly mappingHealth: SourceOriginMappingHealthRecord;
	readonly method: typeof SOURCE_ORIGIN_CORRELATION_METHOD;
	readonly nonclaims: typeof SOURCE_ORIGIN_CORRELATION_NONCLAIMS;
	readonly operationVersion: typeof SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION;
	readonly resultCompleteness: 'COMPLETE_FOR_EVERY_DECODED_MAPPED_SEGMENT_WITH_EXPLICIT_UNMAPPED_GENERATED_LINES';
	readonly schemaVersion: typeof SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION;
	readonly segments: readonly SourceOriginMapSegmentRecord[];
	readonly selection: typeof SOURCE_ORIGIN_CORRELATION_SELECTION;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSourceId: SemanticSourceId;
	readonly semanticValidationWitness: SourceOriginSemanticValidationWitness;
	readonly sourceMap: SourceOriginSourceMapRecord;
	readonly subjectId: string;
	readonly truncation: { readonly reason: null; readonly state: 'NOT_TRUNCATED' };
	readonly unmappedGeneratedLines: readonly SourceOriginUnmappedGeneratedLineRecord[];
}

export type SourceOriginCorrelationResult = SourceOriginCorrelationSnapshot;

export type SourceOriginCorrelationDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'CAPTURE_INVALID'
	| 'EMISSION_FAILED'
	| 'EMISSION_OUTPUT_MISMATCH'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'PROGRAM_CONSTRUCTION_UNAVAILABLE'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_SNAPSHOT_INVALID'
	| 'SOURCE_MAP_INVALID'
	| 'SOURCE_MAP_UNSUPPORTED'
	| 'SOURCE_ORIGIN_UNAVAILABLE'
	| 'TARGET_UNAVAILABLE'
	| 'UNSUPPORTED_REQUEST'
	| 'VALIDATION_FAILED';

export type SourceOriginCorrelationProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'CAPTURE_BIND'
	| 'SEMANTIC_SNAPSHOT_VALIDATE'
	| 'PROGRAM_BIND'
	| 'PROGRAM_CONSTRUCT'
	| 'PROGRAM_SOURCE_ACCOUNT'
	| 'DECLARATION_EMIT'
	| 'EMISSION_RECONCILE'
	| 'SOURCE_MAP_PARSE'
	| 'SOURCE_PATH_RESOLVE'
	| 'SOURCE_MAP_DECODE'
	| 'LOCATION_BIND'
	| 'CORRELATION_BIND'
	| 'UNMAPPED_LINE_BIND'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'ANALYSIS_VALIDATE';

export interface SourceOriginCorrelationDiagnostic {
	readonly code: SourceOriginCorrelationDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: SourceOriginCorrelationProgressPhase;
}

export type SourceOriginCorrelationBuildOutcome =
	| {
			readonly analysis: SourceOriginCorrelationSnapshot;
			readonly diagnostics: readonly SourceOriginCorrelationDiagnostic[];
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly SourceOriginCorrelationDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export interface SourceOriginCorrelationProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: SourceOriginCorrelationProgressPhase;
	readonly schemaVersion: typeof SOURCE_ORIGIN_CORRELATION_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildSourceOriginCorrelationOptions {
	readonly onProgress?: (event: SourceOriginCorrelationProgressEvent) => void;
}

export interface SourceOriginCorrelationValidationOptions {
	readonly maxDepth?: number;
	/** Optional validator-local wall-clock cap; resource control only and never hashed evidence. */
	readonly maxDurationMs?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type SourceOriginCorrelationValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'DERIVATION_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface SourceOriginCorrelationValidationIssue {
	readonly code: SourceOriginCorrelationValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type SourceOriginCorrelationValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly SourceOriginCorrelationValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

/** Canonical source-population member; no compiler-native object is hash input. */
export interface SourceOriginProgramSourceIdentity {
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly logicalPath: string;
	readonly origin: SourceOrigin;
	readonly semanticSourceId: SemanticSourceId;
}
