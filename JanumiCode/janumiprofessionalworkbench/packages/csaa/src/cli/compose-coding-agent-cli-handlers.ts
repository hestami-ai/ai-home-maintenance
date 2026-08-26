import { isAbsolute, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isProxy } from 'node:util/types';

import {
	agentOperationRequestDigest,
	type AgentCapabilityStatus,
	type AgentCurrentnessStatus,
	type AgentOperationErrorResponse,
	type AgentOperation,
	type AgentOperationPartialResponse,
	type AgentOperationProgressResponse,
	type AgentOperationRequest,
	type AgentOperationResponse,
	type AgentSubjectResolutionOutcome,
	type AgentTypedErrorCode
} from '../agent/agent-operation-protocol.js';
import { INVENTORY_SCHEMA_VERSION, type InventoryDocument } from '../contracts/inventory.js';
import {
	runSemanticSourceQueryReport,
	type RunSemanticSourceQueryReportOptions,
	type SemanticSourceQueryReportProgressEvent
} from '../application/run-semantic-source-query-report.js';
import {
	runStaticModuleImpactCandidateReport,
	type RunStaticModuleImpactCandidateReportOptions
} from '../application/run-static-module-impact-candidate-report.js';
import {
	runWorkingSourceEditImpactCandidateReport,
	type RunWorkingSourceEditImpactCandidateReportOptions
} from '../application/run-working-source-edit-impact-candidate-report.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	type SemanticSourceQueryReportOutcome
} from '../contracts/semantic-source-query-report.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticCapability,
	type StaticSemanticSnapshot,
	type StaticSemanticSnapshotOutcome
} from '../contracts/semantic.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	type StaticModuleImpactCandidateReportOutcome
} from '../contracts/static-module-impact-candidate-report.js';
import type {
	FrozenSubject,
	FrozenSubjectFreshness,
	ResolveSubjectRequest,
	SubjectFilters,
	SubjectResolutionOutcome
} from '../contracts/subject.js';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	type WorkingSourceEditImpactCandidateReportOutcome
} from '../contracts/working-source-edit-impact-candidate-report.js';
import {
	buildStaticSemanticSnapshot,
	type BuildStaticSemanticSnapshotRuntimeOptions,
	type StaticSemanticSnapshotProgressEvent
} from '../semantic/build-static-semantic-snapshot.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { runInventory, type RunInventoryResult } from '../inventory/run-inventory.js';
import { canonicalJson as canonicalInventoryJson } from '../inventory/canonical.js';
import {
	JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_RESULT_SCHEMA_VERSION,
	runJpwbHarmonizationNativeProjection,
	type JpwbHarmonizationNativeProjectionBudgets,
	type JpwbHarmonizationNativeProjectionOutcome,
	type JpwbHarmonizationNativeProjectionResult,
	type JpwbHarmonizationNativeRuleProjection
} from '../rules/jpwb-harmonization-native-projection.js';
import {
	evaluateProjectedHybridRuntimeRows,
	JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION,
	projectJpwbHybridStaticPrerequisites,
	type JpwbHybridStaticPrerequisiteProjection
} from '../providers/runtime/project-hybrid-static-prerequisites.js';
import {
	importDeterministicRuntimeTrace,
	type DeterministicRuntimeTraceObservation
} from '../providers/runtime/import-runtime-trace.js';
import {
	ENRICHED_PROVIDER_EVIDENCE_SCHEMA_VERSION,
	type ProviderEvidenceResult,
	type ProviderRunInput
} from '../providers/runtime/provider-evidence.js';
import {
	HYBRID_RUNTIME_EVALUATION_SCHEMA_VERSION,
	type HybridRuntimeEvaluationResult
} from '../providers/runtime/evaluate-hybrid-runtime.js';
import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	CodingAgentCliArtifactError,
	codingAgentCliArtifactDigest,
	codingAgentCliArtifactReference,
	publishCodingAgentCliJsonArtifact,
	readCodingAgentCliJsonArtifact,
	type CodingAgentCliArtifactStore,
	type CodingAgentCliPublishedArtifact
} from './coding-agent-cli-artifact-store.js';
import {
	type CodingAgentCliExplainInput,
	type CodingAgentCliFindingsInput,
	type CodingAgentCliImpactInput,
	type CodingAgentCliInventoryInput,
	type CodingAgentCliQueryInput,
	type CodingAgentCliSnapshotInput,
	type CodingAgentCliVerifyInput
} from './coding-agent-cli-contract.js';
import type {
	CodingAgentCliHandler,
	CodingAgentCliHandlerContext,
	CodingAgentCliHandlers
} from './run-coding-agent-cli.js';

export const CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION =
	'jan-csaa-coding-agent-static-semantic-snapshot-request/0.1.0' as const;
export const CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION =
	'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0' as const;
export const CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION =
	'jan-csaa-coding-agent-inventory-request/0.1.0' as const;
export const CODING_AGENT_CLI_INVENTORY_RESULT_VERSION =
	'jan-csaa-coding-agent-inventory-result/0.1.0' as const;
export const CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION =
	'jan-csaa-coding-agent-findings-request/2.0.0' as const;
export const CODING_AGENT_CLI_FINDINGS_RESULT_VERSION =
	'jan-csaa-coding-agent-findings-result/2.0.0' as const;
export const CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION =
	'jan-csaa-coding-agent-explanation-profile/1.0.0' as const;
export const CODING_AGENT_CLI_EXPLANATION_RESULT_VERSION =
	'jan-csaa-coding-agent-explanation-result/1.0.0' as const;
export const CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION =
	'jan-csaa-coding-agent-verification-expectation/0.1.0' as const;
export const CODING_AGENT_CLI_VERIFICATION_RESULT_VERSION =
	'jan-csaa-coding-agent-verification-result/0.1.0' as const;

export const CODING_AGENT_CLI_LOCAL_CAPABILITIES = Object.freeze({
	explain: 'IMPLEMENTATION_LOCAL_EXACT_FINDING_EXPLANATION',
	findings: 'IMPLEMENTATION_LOCAL_JPWB_HARMONIZATION_FINDINGS',
	inventory: 'IMPLEMENTATION_LOCAL_REPOSITORY_INVENTORY',
	verify: 'IMPLEMENTATION_LOCAL_ARTIFACT_WORKFLOW_VERIFICATION'
} as const);

export const CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS = Object.freeze({
	explain: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.explain}@1.0.0`,
	findings: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.findings}@2.0.0`,
	inventory: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.inventory}@0.1.0`,
	verify: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.verify}@0.1.0`
} as const);

export const CODING_AGENT_CLI_COMPOSITION_STATE = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;

export const CODING_AGENT_CLI_COMPOSITION_NONCLAIMS = Object.freeze([
	'This package-root-exported binary composition is implementation-local and is not a governance-registered JAN-CSAA capability or gate.',
	'Inventory, findings, exact-evidence explanation, and artifact-workflow verification are implementation-local adapters rather than registered JAN-CSAA operations or qualified providers.',
	'Findings project all 23 first-increment rules and five rule-specific hybrid static prerequisites from exact retained FrozenSubject bytes; each row closes only an independently reconciled eligible population and preserves UNSUPPORTED, NOT_RUN, stale, conflict, and open regions.',
	'Optional runtime enrichment imports one caller-supplied deterministic trace without executing subject code and evaluates only the five allocated hybrid rows; it makes no general-purpose DFG, taint, or runtime-provider claim.',
	'Native projection currentness remains caller-declared inside the provider result; this composition separately resolves and verifies the exact subject before and after projection.',
	'Explanation independently recaptures and replays the exact stored native projection and hybrid evidence envelope, copies exact rule, fact, population, evidence, currentness, and provenance fields, and creates no inferred causal or remediation claim.',
	'Verification compares bounded stored artifacts to caller-declared exact expectations; it is not test execution, behavior preservation, conformance, acceptance, disposition, or gate authority.',
	'Snapshot, query, and impact responses preserve their owning operations limitations and cannot create gates, remediation, non-impact, safe-removal, or behavior-preservation authority.',
	'Only content-addressed canonical JSON artifacts are consumed or published; artifact references are never interpreted as filesystem paths.',
	'The composition does not execute subject code, use the network, or mutate subject source.'
] as const);

export const CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS = Object.freeze({
	maxVerificationAssertions: 32,
	maxVerificationArtifactBytes: CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes,
	maxVerificationDistinctArtifacts: 8,
	maxVerificationPathDepth: 32,
	maxProgressResponses: 16,
	maxRuntimeFreshnessWindowMs: 31 * 24 * 60 * 60 * 1_000,
	nativeProjectionWrapperReservationBytes: 32_768,
	outputEnvelopeReservationBytes: 65_536
} as const);

export interface CodingAgentCliSnapshotRequestArtifact {
	readonly kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST';
	readonly schemaVersion: typeof CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION;
	readonly semanticRequest: Omit<
		BuildStaticSemanticSnapshotRequest,
		'rootLocator' | 'subjectId'
	> & {
		readonly rootLocator: '<repository-root>';
		readonly subjectId: '<resolved-subject>' | string;
	};
	readonly subjectRequest: Omit<ResolveSubjectRequest, 'rootLocator'> & {
		readonly rootLocator: '<repository-root>';
	};
}

export interface CodingAgentCliSnapshotResultArtifact {
	readonly buildOutcome: 'complete' | 'partial';
	readonly captureRequestRef: string;
	readonly diagnostics: StaticSemanticSnapshotOutcome['diagnostics'];
	readonly schemaVersion: typeof CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION;
	readonly snapshot: StaticSemanticSnapshot;
}

export interface CodingAgentCliInventoryRequestArtifact {
	readonly kind: 'REPOSITORY_INVENTORY_REQUEST';
	readonly requireJpwbPopulations: boolean;
	readonly rootLocator: '<repository-root>';
	readonly schemaVersion: typeof CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION;
}

export interface CodingAgentCliInventoryResultArtifact {
	readonly capture: {
		readonly comparison: 'TWO_CONSECUTIVE_CANONICAL_CAPTURES_EQUAL';
		readonly subjectId: string;
	};
	readonly inventory: InventoryDocument;
	readonly schemaVersion: typeof CODING_AGENT_CLI_INVENTORY_RESULT_VERSION;
}

export interface CodingAgentCliFindingsResultArtifact {
	readonly currentness: {
		readonly afterProjection: FrozenSubjectFreshness;
		readonly basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER';
		readonly beforeProjection: FrozenSubjectFreshness;
	};
	readonly nativeProjectionOutcome: JpwbHarmonizationNativeProjectionOutcome;
	readonly hybridEvidence: {
		readonly runtimeEvaluation: HybridRuntimeEvaluationResult | null;
		readonly runtimeTrace: ProviderEvidenceResult<DeterministicRuntimeTraceObservation> | null;
		readonly runtimeTraceRef: string | null;
		readonly staticProjection: JpwbHybridStaticPrerequisiteProjection;
	};
	readonly ruleProfileRef: string;
	readonly schemaVersion: typeof CODING_AGENT_CLI_FINDINGS_RESULT_VERSION;
	readonly snapshotId: string;
	readonly snapshotRef: string;
	readonly subjectId: string;
}

export interface CodingAgentCliHybridRuntimeEvidenceRequestArtifact {
	readonly assessedAt: string;
	readonly freshnessWindowMs: number;
	readonly kind: 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE';
	readonly run: ProviderRunInput;
	readonly traceRef: string;
}

export interface CodingAgentCliFindingsRequestArtifact {
	readonly budgets: JpwbHarmonizationNativeProjectionBudgets;
	readonly executionDisposition: 'NOT_RUN' | 'RUN';
	readonly executionId: string;
	readonly hybridRuntimeEvidence: CodingAgentCliHybridRuntimeEvidenceRequestArtifact | null;
	readonly hybridStaticObservedAt: string;
	readonly kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST';
	readonly operationVersion: typeof JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION;
	readonly schemaVersion: typeof CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION;
	readonly snapshotRef: string;
}

export interface CodingAgentCliExplanationProfileArtifact {
	readonly evaluationId: string;
	readonly findingFingerprint: string | null;
	readonly findingId: number;
	readonly kind: 'EXACT_FINDING_EXPLANATION_PROFILE';
	readonly schemaVersion: typeof CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION;
}

export interface CodingAgentCliExplanationResultArtifact {
	readonly analysisAuthority: 'NONE';
	readonly gateEffect: 'NONE';
	readonly nativeProjection: {
		readonly capability: JpwbHarmonizationNativeProjectionResult['capability'];
		readonly currentRepositoryStatusTotals: JpwbHarmonizationNativeProjectionResult['currentRepositoryStatusTotals'];
		readonly currentness: JpwbHarmonizationNativeProjectionResult['currentness'];
		readonly executionId: string;
		readonly resultWitness: { readonly bytes: number; readonly sha256: string };
	};
	readonly projection: JpwbHarmonizationNativeRuleProjection;
	readonly replayCurrentness: CodingAgentCliFindingsResultArtifact['currentness'];
	readonly schemaVersion: typeof CODING_AGENT_CLI_EXPLANATION_RESULT_VERSION;
	readonly source: {
		readonly findingsResultRef: string;
		readonly ruleProfileRef: string;
		readonly snapshotId: string;
		readonly snapshotRef: string;
		readonly subjectId: string;
	};
}

export type CodingAgentCliJsonValue =
	| boolean
	| null
	| number
	| string
	| readonly CodingAgentCliJsonValue[]
	| { readonly [key: string]: CodingAgentCliJsonValue };

export type CodingAgentCliVerificationAssertion =
	| {
			readonly artifactRef: string;
			readonly kind: 'ARTIFACT_DIGEST_EQUALS';
			readonly sha256: string;
	  }
	| {
			readonly artifactRef: string;
			readonly expected: CodingAgentCliJsonValue;
			readonly kind: 'JSON_VALUE_EQUALS';
			readonly path: readonly (number | string)[];
	  };

export interface CodingAgentCliVerificationExpectationArtifact {
	readonly assertions: readonly CodingAgentCliVerificationAssertion[];
	readonly kind: 'ARTIFACT_WORKFLOW_EXPECTATION';
	readonly schemaVersion: typeof CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION;
	readonly snapshotId: string;
	readonly subjectId: string;
}

export interface CodingAgentCliVerificationResultArtifact {
	readonly analysisAuthority: 'NONE';
	readonly assertions: readonly {
		readonly actualDigest: string | null;
		readonly assertionIndex: number;
		readonly artifactRef: string;
		readonly kind: CodingAgentCliVerificationAssertion['kind'];
		readonly passed: boolean;
	}[];
	readonly expectationRef: string;
	readonly gateEffect: 'NONE';
	readonly passed: boolean;
	readonly schemaVersion: typeof CODING_AGENT_CLI_VERIFICATION_RESULT_VERSION;
	readonly snapshotBindingPassed: boolean;
	readonly snapshotId: string;
	readonly subjectBindingPassed: boolean;
	readonly subjectId: string;
}

export interface CodingAgentCliCompositionDependencies {
	readonly buildSnapshot: (
		request: BuildStaticSemanticSnapshotRequest,
		options: { readonly subject: FrozenSubject },
		runtimeOptions?: BuildStaticSemanticSnapshotRuntimeOptions
	) => StaticSemanticSnapshotOutcome;
	readonly inventory: (options: {
		readonly mode: 'json';
		readonly repositoryRoot: string;
		readonly requireJpwbPopulations?: boolean;
	}) => RunInventoryResult;
	readonly query: (
		request: unknown,
		options: RunSemanticSourceQueryReportOptions
	) => Promise<SemanticSourceQueryReportOutcome>;
	readonly resolveSubject: (request: ResolveSubjectRequest) => SubjectResolutionOutcome;
	readonly projectFindings: typeof runJpwbHarmonizationNativeProjection;
	readonly staticImpact: (
		request: unknown,
		options: RunStaticModuleImpactCandidateReportOptions
	) => StaticModuleImpactCandidateReportOutcome;
	readonly validateSnapshot: typeof validateStaticSemanticSnapshot;
	readonly verifySubject: typeof verifyFrozenSubject;
	readonly workingImpact: (
		request: unknown,
		options: RunWorkingSourceEditImpactCandidateReportOptions
	) => WorkingSourceEditImpactCandidateReportOutcome;
}

export interface ComposeCodingAgentCliHandlersOptions {
	readonly artifactStore: CodingAgentCliArtifactStore;
	readonly dependencies?: Partial<CodingAgentCliCompositionDependencies>;
	/** Trusted absolute worktree root. Operation artifacts cannot override it. */
	readonly repositoryRoot: string;
}

const DEFAULT_DEPENDENCIES: CodingAgentCliCompositionDependencies = Object.freeze({
	buildSnapshot: buildStaticSemanticSnapshot,
	inventory: runInventory,
	projectFindings: runJpwbHarmonizationNativeProjection,
	query: runSemanticSourceQueryReport,
	resolveSubject,
	staticImpact: runStaticModuleImpactCandidateReport,
	validateSnapshot: validateStaticSemanticSnapshot,
	verifySubject: verifyFrozenSubject,
	workingImpact: runWorkingSourceEditImpactCandidateReport
});

const CAPABILITY_VERSIONS = Object.freeze({
	'JAN-CSAA-CAP-001': 'JAN-CSAA-CAP-001@0.1.0',
	'JAN-CSAA-CAP-002': 'JAN-CSAA-CAP-002@0.1.0',
	'JAN-CSAA-CAP-003': 'JAN-CSAA-CAP-003@0.1.0',
	'JAN-CSAA-CAP-029': 'JAN-CSAA-CAP-029@0.1.0',
	'JAN-CSAA-CAP-031': 'JAN-CSAA-CAP-031@0.1.0'
} as const);

const SNAPSHOT_CAPABILITIES = Object.freeze({
	'JAN-CSAA-CAP-001': 'TS_SYNTAX',
	'JAN-CSAA-CAP-002': 'TS_SYMBOL',
	'JAN-CSAA-CAP-003': 'TS_TYPE'
} as const satisfies Readonly<Record<string, SemanticCapability>>);

type SupportedCapabilityId = keyof typeof CAPABILITY_VERSIONS;
type OperationErrorKind =
	| 'BUDGET'
	| 'CAPABILITY_UNAVAILABLE'
	| 'EXPECTATION_FAILED'
	| 'INTERNAL'
	| 'INVALID'
	| 'STALE'
	| 'TIMEOUT'
	| 'UNSUPPORTED';

class CompositionError extends Error {
	constructor(
		readonly kind: OperationErrorKind,
		message: string,
		readonly subjectId?: string,
		readonly snapshotId?: string
	) {
		super(message);
		this.name = 'CompositionError';
	}
}

class FrozenSubjectWitnessRequiredError extends Error {
	constructor(readonly artifact: CodingAgentCliSnapshotResultArtifact) {
		super('The semantic snapshot requires its exact authored FrozenSubject witness.');
		this.name = 'FrozenSubjectWitnessRequiredError';
	}
}

interface DataRecord {
	readonly values: ReadonlyMap<string, unknown>;
}

function dataRecord(value: unknown, path: string): DataRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new CompositionError('INVALID', `${path} must be a non-proxy data object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new CompositionError('INVALID', `${path} must be a plain data object.`);
	const values = new Map<string, unknown>();
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string')
			throw new CompositionError('INVALID', `${path} contains a symbol key.`);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new CompositionError('INVALID', `${path}.${key} must be an enumerable data property.`);
		values.set(key, descriptor.value);
	}
	return { values };
}

function exactRecord(value: unknown, keys: readonly string[], path: string): DataRecord {
	const record = dataRecord(value, path);
	if (record.values.size !== keys.length || keys.some((key) => !record.values.has(key)))
		throw new CompositionError('INVALID', `${path} has an open or incomplete shape.`);
	return record;
}

function requiredString(record: DataRecord, key: string, path: string): string {
	const value = record.values.get(key);
	if (typeof value !== 'string' || value.length === 0)
		throw new CompositionError('INVALID', `${path}.${key} must be a nonempty string.`);
	return value;
}

function requiredBoolean(record: DataRecord, key: string, path: string): boolean {
	const value = record.values.get(key);
	if (typeof value !== 'boolean')
		throw new CompositionError('INVALID', `${path}.${key} must be boolean.`);
	return value;
}

function requiredNullableString(record: DataRecord, key: string, path: string): string | null {
	const value = record.values.get(key);
	if (value !== null && (typeof value !== 'string' || value.length === 0))
		throw new CompositionError('INVALID', `${path}.${key} must be null or a nonempty string.`);
	return value;
}

function denseArray(value: unknown, maximum: number, path: string): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new CompositionError('INVALID', `${path} must be a plain dense array.`);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0 ||
		lengthDescriptor.value > maximum
	)
		throw new CompositionError('INVALID', `${path} exceeds its dense-array ceiling.`);
	const length = lengthDescriptor.value;
	const result: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new CompositionError('INVALID', `${path} must not contain holes or accessors.`);
		result.push(descriptor.value);
	}
	if (
		Reflect.ownKeys(value).some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' &&
					(!/^\d+$/u.test(key) || String(Number(key)) !== key || Number(key) >= length))
		)
	)
		throw new CompositionError('INVALID', `${path} has an open array shape.`);
	return Object.freeze(result);
}

function exactArtifactReference(value: string, path: string): string {
	try {
		codingAgentCliArtifactDigest(value);
		return value;
	} catch {
		throw new CompositionError(
			'INVALID',
			`${path} must be a content-addressed artifact reference.`
		);
	}
}

function requestDigest(request: AgentOperationRequest): string {
	const outcome = agentOperationRequestDigest(request);
	if (outcome.state !== 'VALID')
		throw new CompositionError('INTERNAL', 'Request digest unavailable.');
	return outcome.value;
}

function responseId(request: AgentOperationRequest, suffix: string): string {
	return `response:cli-composition:${requestDigest(request).slice(0, 24)}:${suffix}`;
}

function outputArtifactBudget(request: AgentOperationRequest): number {
	const available =
		request.budgets.maxOutputBytes -
		CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.outputEnvelopeReservationBytes;
	if (available < 1)
		throw new CompositionError(
			'BUDGET',
			'The admitted output budget cannot reserve both a result artifact and protocol envelope.'
		);
	return Math.min(available, CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes);
}

function materializeRepositoryRoot(value: string): string {
	if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || !isAbsolute(value))
		throw new Error('The coding-agent CLI composition repository root must be absolute.');
	return resolve(value);
}

function stableDependencies(
	overrides: Partial<CodingAgentCliCompositionDependencies> | undefined
): CodingAgentCliCompositionDependencies {
	return Object.freeze({ ...DEFAULT_DEPENDENCIES, ...overrides });
}

type DomainBudgetLimit = 'ARTIFACT_BYTES' | 'DEPTH' | 'EDGES' | 'NODES' | 'RESULTS' | 'TIMEOUT';

/**
 * Exhaustive scalar leaves admitted by the seven coding-agent operation adapters. The mapping is
 * deliberately explicit: an owning report may impose a narrower ceiling, but no nested operation
 * artifact may expand beyond its enclosing AgentOperationRequest resource authority.
 */
const DOMAIN_BUDGET_LIMITS = Object.freeze({
	maxArtifacts: 'NODES',
	maxAstDepth: 'DEPTH',
	maxAstNodes: 'NODES',
	maxBytes: 'ARTIFACT_BYTES',
	maxCandidateWitnessHops: 'EDGES',
	maxCompilerFacts: 'EDGES',
	maxCompilerInputMetadataBytes: 'ARTIFACT_BYTES',
	maxCompilerQueries: 'EDGES',
	maxCompilerQueryInvocations: 'EDGES',
	maxConfigDepth: 'DEPTH',
	maxContextBytes: 'ARTIFACT_BYTES',
	maxContextFileBytes: 'ARTIFACT_BYTES',
	maxContextFiles: 'NODES',
	maxDepth: 'DEPTH',
	maxDiagnosticCharacters: 'ARTIFACT_BYTES',
	maxDiagnostics: 'RESULTS',
	maxDirectoryEntries: 'NODES',
	maxDurationMs: 'TIMEOUT',
	maxEdges: 'EDGES',
	maxEvaluations: 'EDGES',
	maxFanout: 'EDGES',
	maxFiles: 'NODES',
	maxFrontierRecords: 'NODES',
	maxGitMetadataBytes: 'ARTIFACT_BYTES',
	maxGitOperationDurationMs: 'TIMEOUT',
	maxInputRecords: 'NODES',
	maxInputStringCharacters: 'ARTIFACT_BYTES',
	maxLiteralCharacters: 'ARTIFACT_BYTES',
	maxNodes: 'NODES',
	maxPathCharacters: 'ARTIFACT_BYTES',
	maxPopulation: 'NODES',
	maxProjects: 'NODES',
	maxReachableNodes: 'NODES',
	maxResultBytes: 'ARTIFACT_BYTES',
	maxResultRecords: 'RESULTS',
	maxScopes: 'NODES',
	maxSnapshotBytes: 'ARTIFACT_BYTES',
	maxSourceBytes: 'ARTIFACT_BYTES',
	maxSources: 'NODES',
	maxTraceNodes: 'NODES',
	maxTraversalSteps: 'EDGES',
	maxWitnessEdges: 'EDGES'
} as const satisfies Readonly<Record<string, DomainBudgetLimit>>);

const DOMAIN_BUDGET_RECORD_KEYS = new Set([
	'observation',
	'query',
	'reachability',
	'semantic',
	'staticImpact',
	'subject'
]);

function assertBudgetValue(value: unknown, maximum: number, path: string): void {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
		throw new CompositionError('INVALID', `${path} must be a positive safe-integer budget.`);
	if (value > maximum)
		throw new CompositionError(
			'BUDGET',
			`${path} exceeds the enclosing agent-operation resource budget.`
		);
}

function domainBudgetMaximum(
	limit: DomainBudgetLimit,
	request: AgentOperationRequest,
	artifactBudget: number
): number {
	switch (limit) {
		case 'ARTIFACT_BYTES':
			return artifactBudget;
		case 'DEPTH':
			return request.budgets.maxDepth;
		case 'EDGES':
			return request.budgets.maxEdges;
		case 'NODES':
			return request.budgets.maxNodes;
		case 'RESULTS':
			return request.budgets.maxResults;
		case 'TIMEOUT':
			return request.budgets.timeoutMs;
	}
}

function assertDomainBudgetEnvelope(
	value: unknown,
	request: AgentOperationRequest,
	artifactBudget: number,
	path = '$.budgets',
	depth = 0
): void {
	if (depth > 32)
		throw new CompositionError('INVALID', 'The nested operation budget shape is too deep.');
	const record = dataRecord(value, path);
	for (const [key, child] of record.values) {
		const childPath = `${path}.${key}`;
		if (Object.hasOwn(DOMAIN_BUDGET_LIMITS, key)) {
			const limit = DOMAIN_BUDGET_LIMITS[key as keyof typeof DOMAIN_BUDGET_LIMITS];
			assertBudgetValue(child, domainBudgetMaximum(limit, request, artifactBudget), childPath);
			continue;
		}
		if (!DOMAIN_BUDGET_RECORD_KEYS.has(key))
			throw new CompositionError('INVALID', `${childPath} is not a registered operation budget.`);
		assertDomainBudgetEnvelope(child, request, artifactBudget, childPath, depth + 1);
	}
}

function operationCapabilityAccepted(
	request: AgentOperationRequest,
	capabilityId: SupportedCapabilityId
): void {
	if (
		request.capabilityRequirement.capabilityId !== capabilityId ||
		request.capabilityRequirement.capabilityVersion !== CAPABILITY_VERSIONS[capabilityId]
	)
		throw new CompositionError(
			'UNSUPPORTED',
			`The operation adapter supports only ${CAPABILITY_VERSIONS[capabilityId]}.`
		);
}

function localOperationCapabilityAccepted(
	request: AgentOperationRequest,
	operation: keyof typeof CODING_AGENT_CLI_LOCAL_CAPABILITIES
): void {
	if (
		request.capabilityRequirement.capabilityId !== CODING_AGENT_CLI_LOCAL_CAPABILITIES[operation] ||
		request.capabilityRequirement.capabilityVersion !==
			CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS[operation]
	)
		throw new CompositionError(
			'UNSUPPORTED',
			`The ${operation} adapter supports only ${CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS[operation]}.`
		);
}

function currentnessUnknown(subjectId: string): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:cli-composition-request',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode: 'TERMINAL_CURRENTNESS_NOT_ESTABLISHED' },
		status: 'unknown',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: ['dependency:cli-composition-terminal-currentness']
	};
}

function currentnessNotApplicable(reasonCode: string): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:cli-composition-request',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode },
		status: 'unknown',
		subject: { kind: 'NOT_APPLICABLE', reasonCode },
		unresolvedDependencyRefs: []
	};
}

function currentnessCurrent(
	subjectId: string,
	snapshotId: string,
	artifactReference: string
): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [artifactReference, 'evidence:final-selected-subject-currentness'],
		invalidationRefs: [],
		observationCutoffRef: `cutoff:${codingAgentCliArtifactDigest(artifactReference)}`,
		snapshot: { kind: 'SNAPSHOT', snapshotId },
		status: 'current-for-subject',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: []
	};
}

function currentnessCurrentWithoutSnapshot(
	subjectId: string,
	artifactReference: string
): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [artifactReference, 'evidence:two-consecutive-inventory-captures-equal'],
		invalidationRefs: [],
		observationCutoffRef: `cutoff:${codingAgentCliArtifactDigest(artifactReference)}`,
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode: 'INVENTORY_HAS_NO_SEMANTIC_SNAPSHOT' },
		status: 'current-for-subject',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: []
	};
}

function currentnessStale(
	subjectId: string,
	snapshotId: string | undefined,
	basisReference: string
): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [basisReference, 'invalidation:requested-subject-or-snapshot-mismatch'],
		observationCutoffRef: 'cutoff:cli-composition-final-check',
		snapshot:
			snapshotId === undefined
				? { kind: 'NOT_APPLICABLE', reasonCode: 'SNAPSHOT_ID_UNAVAILABLE' }
				: { kind: 'SNAPSHOT', snapshotId },
		status: 'stale',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: []
	};
}

function resolvedSubject(
	subjectId: string,
	evidenceReference: string
): AgentSubjectResolutionOutcome {
	return {
		kind: 'RESOLVED',
		resolutionEvidenceRefs: [evidenceReference],
		subjectId
	};
}

function progressCapability(request: AgentOperationRequest): AgentCapabilityStatus {
	return {
		affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
		capabilityCoverage: 'not-analyzed',
		capabilityId: request.capabilityRequirement.capabilityId,
		capabilityVersion: request.capabilityRequirement.capabilityVersion,
		conflict: 'unopposed',
		conflictRefs: [],
		coverageRefs: [],
		excludedRegionRefs: [],
		executionHealth: 'not-run',
		implementationState: 'IMPLEMENTED',
		limitationRefs: ['limit:operation-in-progress'],
		provenanceRefs: ['provenance:cli-composition-local-unregistered'],
		providerRefs: [],
		qualificationState: 'UNKNOWN',
		unknownRegionRefs: ['region:terminal-capability-state-pending']
	};
}

function partialCapability(
	request: AgentOperationRequest,
	artifactReference: string,
	operation: AgentOperation
): AgentCapabilityStatus {
	return {
		affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
		capabilityCoverage: 'partial',
		capabilityId: request.capabilityRequirement.capabilityId,
		capabilityVersion: request.capabilityRequirement.capabilityVersion,
		conflict: 'unopposed',
		conflictRefs: [],
		coverageRefs: [artifactReference, `coverage:${operation}:bounded-current-result`],
		excludedRegionRefs: [],
		executionHealth: 'succeeded',
		implementationState: 'IMPLEMENTED',
		limitationRefs: [
			'limit:cli-composition-implementation-local-unregistered',
			`limit:${operation}:owning-operation-nonclaims-preserved`
		],
		provenanceRefs: [artifactReference, 'provenance:cli-composition-local-unregistered'],
		providerRefs: [],
		qualificationState: 'UNKNOWN',
		unknownRegionRefs: [
			'region:provider-qualification',
			`region:${operation}:registered-full-capability`
		].sort()
	};
}

function errorCapability(
	request: AgentOperationRequest,
	kind: OperationErrorKind,
	resolved: boolean
): AgentCapabilityStatus {
	const unsupported = kind === 'UNSUPPORTED' && resolved;
	const expectationFailed = kind === 'EXPECTATION_FAILED' && resolved;
	return {
		affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
		capabilityCoverage: unsupported
			? 'unsupported'
			: expectationFailed
				? 'partial'
				: 'not-analyzed',
		capabilityId: request.capabilityRequirement.capabilityId,
		capabilityVersion: request.capabilityRequirement.capabilityVersion,
		conflict: expectationFailed ? 'conflicting' : 'unopposed',
		conflictRefs: expectationFailed ? ['conflict:expected-vs-observed-artifact-value'] : [],
		coverageRefs: expectationFailed ? ['coverage:verification:executed-assertions'] : [],
		excludedRegionRefs: [],
		executionHealth:
			kind === 'BUDGET'
				? 'resource-exhausted'
				: expectationFailed
					? 'succeeded'
					: kind === 'CAPABILITY_UNAVAILABLE'
						? 'unavailable'
						: kind === 'TIMEOUT'
							? 'timed-out'
							: kind === 'INTERNAL'
								? 'failed'
								: 'not-run',
		implementationState: unsupported ? 'UNIMPLEMENTED' : 'IMPLEMENTED',
		limitationRefs: [
			unsupported
				? 'limit:requested-capability-not-integrated'
				: expectationFailed
					? 'limit:caller-declared-artifact-expectations-only'
					: 'limit:requested-operation-result-not-admitted'
		],
		provenanceRefs: ['provenance:cli-composition-local-unregistered'],
		providerRefs: [],
		qualificationState: expectationFailed ? 'NONPASS' : 'UNKNOWN',
		unknownRegionRefs: unsupported
			? []
			: expectationFailed
				? ['region:behavioral-or-test-execution-not-assessed']
				: ['region:requested-operation-result']
	};
}

function baseResponse(request: AgentOperationRequest, responseAt: string, suffix: string) {
	return {
		messageKind: 'response' as const,
		operation: request.operation,
		operationVersion: request.operationVersion,
		protocolVersion: request.protocolVersion,
		requestDigest: requestDigest(request),
		requestId: request.requestId,
		responseAt,
		responseId: responseId(request, suffix)
	};
}

const ERROR_RULES = Object.freeze({
	BUDGET: {
		code: 'CSAA-E-EXECUTION-BUDGET-REFUSED',
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasonCode: 'BUDGET_REFUSED',
		state: 'resource-refused'
	},
	CAPABILITY_UNAVAILABLE: {
		code: 'CSAA-E-CAPABILITY-NOT-ANALYZED',
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasonCode: 'CAPABILITY_UNAVAILABLE',
		state: 'failed'
	},
	EXPECTATION_FAILED: {
		code: 'CSAA-E-PROVIDER-DISAGREEMENT',
		exitCategory: 'FAILED_EXPECTATION',
		reasonCode: 'CONFLICT_REQUIRES_ESCALATION',
		state: 'incompatible'
	},
	INTERNAL: {
		code: 'CSAA-E-INTERNAL-UNEXPECTED',
		exitCategory: 'INTERNAL_FAILURE',
		reasonCode: 'INTERNAL_FAILURE',
		state: 'unknown'
	},
	INVALID: {
		code: 'CSAA-E-REQUEST-INVALID-PARAMETER',
		exitCategory: 'INVALID_REQUEST',
		reasonCode: 'INVALID_REQUEST',
		state: 'failed'
	},
	STALE: {
		code: 'CSAA-E-SUBJECT-STALE',
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasonCode: 'CURRENTNESS_UNSATISFIED',
		state: 'incompatible'
	},
	TIMEOUT: {
		code: 'CSAA-E-EXECUTION-TIMED-OUT',
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasonCode: 'TIMED_OUT',
		state: 'timed-out'
	},
	UNSUPPORTED: {
		code: 'CSAA-E-CAPABILITY-UNSUPPORTED',
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasonCode: 'UNIMPLEMENTED_CAPABILITY',
		state: 'failed'
	}
} as const satisfies Readonly<
	Record<
		OperationErrorKind,
		{
			readonly code: AgentTypedErrorCode;
			readonly exitCategory:
				'FAILED_EXPECTATION' | 'INCOMPLETE_OR_UNSUPPORTED' | 'INTERNAL_FAILURE' | 'INVALID_REQUEST';
			readonly reasonCode:
				| 'BUDGET_REFUSED'
				| 'CAPABILITY_UNAVAILABLE'
				| 'CONFLICT_REQUIRES_ESCALATION'
				| 'CURRENTNESS_UNSATISFIED'
				| 'INTERNAL_FAILURE'
				| 'INVALID_REQUEST'
				| 'TIMED_OUT'
				| 'UNIMPLEMENTED_CAPABILITY';
			readonly state: 'failed' | 'incompatible' | 'resource-refused' | 'timed-out' | 'unknown';
		}
	>
>);

function requestResolvedSubjectId(request: AgentOperationRequest): string | undefined {
	return request.subjectInput.kind === 'RESOLVED_SUBJECT'
		? request.subjectInput.subjectId
		: undefined;
}

function errorResponse(
	request: AgentOperationRequest,
	responseAt: string,
	error: CompositionError,
	basisReference: string
): AgentOperationErrorResponse {
	const subjectId = error.subjectId ?? requestResolvedSubjectId(request);
	let kind = error.kind;
	if (
		subjectId === undefined &&
		(kind === 'BUDGET' || kind === 'CAPABILITY_UNAVAILABLE' || kind === 'STALE')
	)
		kind = 'INVALID';
	if (subjectId === undefined && kind === 'UNSUPPORTED') kind = 'INVALID';
	const rule = ERROR_RULES[kind];
	const subjectResolution: AgentSubjectResolutionOutcome =
		subjectId === undefined
			? { kind: 'NOT_APPLICABLE', reasonCode: 'OPERATION_INPUT_NOT_RESOLVED' }
			: resolvedSubject(subjectId, basisReference);
	const currentness =
		subjectId === undefined
			? currentnessNotApplicable('OPERATION_INPUT_NOT_RESOLVED')
			: kind === 'STALE'
				? currentnessStale(subjectId, error.snapshotId, basisReference)
				: kind === 'EXPECTATION_FAILED' && error.snapshotId !== undefined
					? currentnessCurrent(subjectId, error.snapshotId, basisReference)
					: currentnessUnknown(subjectId);
	return {
		...baseResponse(request, responseAt, `error:${kind.toLowerCase()}`),
		capability: errorCapability(request, kind, subjectId !== undefined),
		currentness,
		exitCategory: rule.exitCategory,
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: [basisReference],
			blockedActionRef:
				kind === 'EXPECTATION_FAILED'
					? 'action:verify:workflow-completion'
					: `action:${request.operation}:result-publication`,
			blockedClaimRefs:
				kind === 'EXPECTATION_FAILED'
					? ['claim:declared-workflow-expectations-satisfied']
					: ['claim:requested-analysis-result'],
			code: rule.code,
			failedPredicateRef: `predicate:cli-composition:${kind.toLowerCase()}`,
			fallbackLimitRefs:
				kind === 'EXPECTATION_FAILED'
					? ['limit:failed-expectation-artifact-is-evidence-not-success']
					: ['limit:no-result-admitted'],
			provenanceRefs: ['provenance:cli-composition-local-unregistered'],
			reasonCode: rule.reasonCode,
			requiredNextActionRef:
				kind === 'UNSUPPORTED'
					? 'next:integrate-owning-capability-operation'
					: kind === 'EXPECTATION_FAILED'
						? 'next:review-failed-workflow-expectations'
						: kind === 'STALE'
							? 'next:recapture-subject-and-snapshot'
							: 'next:correct-input-or-retry-owning-operation',
			residualRiskRef:
				kind === 'EXPECTATION_FAILED'
					? 'risk:declared-workflow-expectations-unsatisfied'
					: 'risk:requested-analysis-not-established',
			responsibleOwnerRef: 'owner:csaa-root-integration',
			retryability:
				kind === 'INVALID' || kind === 'UNSUPPORTED' || kind === 'EXPECTATION_FAILED'
					? 'NOT_RETRYABLE'
					: kind === 'INTERNAL'
						? 'UNKNOWN'
						: 'RETRYABLE',
			unaffectedScopeRefs: []
		},
		state: rule.state,
		subjectResolution,
		warningRefs: ['warning:cli-composition-local-unregistered']
	};
}

function artifactError(error: CodingAgentCliArtifactError): CompositionError {
	switch (error.code) {
		case 'ARTIFACT_BUDGET_EXCEEDED':
			return new CompositionError('BUDGET', error.message);
		case 'ARTIFACT_NOT_FOUND':
			return new CompositionError('INVALID', error.message);
		case 'ARTIFACT_STORE_FAILED':
			return new CompositionError('CAPABILITY_UNAVAILABLE', error.message);
		default:
			return new CompositionError('INVALID', error.message);
	}
}

function compositionError(error: unknown): CompositionError {
	if (error instanceof CompositionError) return error;
	if (error instanceof CodingAgentCliArtifactError) return artifactError(error);
	return new CompositionError(
		'INTERNAL',
		'The coding-agent CLI operation composition failed closed.'
	);
}

function assertSubjectInputBinding(
	request: AgentOperationRequest,
	expectedReference: string,
	resolvedSubjectId?: string
): void {
	if (request.subjectInput.kind === 'SUBJECT_LOCATOR') {
		if (
			request.subjectInput.locatorRef !== expectedReference ||
			request.subjectInput.locatorDigest !== codingAgentCliArtifactDigest(expectedReference)
		)
			throw new CompositionError(
				'INVALID',
				'The AgentOperationRequest subject locator does not bind the exact operation artifact.'
			);
		return;
	}
	if (request.subjectInput.kind === 'RESOLVED_SUBJECT') {
		if (resolvedSubjectId !== undefined && request.subjectInput.subjectId !== resolvedSubjectId)
			throw new CompositionError(
				'STALE',
				'The operation resolved a different exact subject than the caller requested.',
				resolvedSubjectId
			);
		return;
	}
	if (request.subjectInput.kind === 'TARGET_RECORD') {
		if (request.subjectInput.targetRecordRef !== expectedReference)
			throw new CompositionError(
				'INVALID',
				'The target-record subject input does not bind the exact referenced snapshot.'
			);
		return;
	}
	if (request.subjectInput.kind === 'SCOPED_TARGET') {
		if (
			request.subjectInput.targetPopulationRefs.length !== 1 ||
			request.subjectInput.targetPopulationRefs[0] !== expectedReference
		)
			throw new CompositionError(
				'INVALID',
				'The scoped-target subject input does not bind only the exact referenced snapshot.'
			);
		return;
	}
	throw new CompositionError(
		'INVALID',
		'This operation requires a content-addressed subject locator or exact resolved subject.'
	);
}

function assertCurrentnessRequirement(
	request: AgentOperationRequest,
	subjectId: string,
	snapshotId: string | undefined,
	basisReference: string
): void {
	if (
		request.currentnessRequirement.kind === 'REQUIRE_EXACT_SUBJECT' &&
		request.currentnessRequirement.subjectId !== subjectId
	)
		throw new CompositionError(
			'STALE',
			'The result does not bind the exact subject required by the caller.',
			subjectId,
			snapshotId
		);
	if (
		request.subjectInput.kind === 'RESOLVED_SUBJECT' &&
		request.subjectInput.subjectId !== subjectId
	)
		throw new CompositionError(
			'STALE',
			'The result subject differs from the exact resolved subject input.',
			subjectId,
			snapshotId
		);
	void basisReference;
}

function normalizedStage(value: string): string {
	const normalized = value
		.toUpperCase()
		.replaceAll(/[^A-Z0-9_]/gu, '_')
		.slice(0, 96);
	return normalized.length === 0 ? 'OPERATION_STAGE' : normalized;
}

function progressResponses(
	request: AgentOperationRequest,
	responseAt: string,
	subjectId: string,
	evidenceReference: string,
	stagesValue: readonly string[]
): readonly AgentOperationProgressResponse[] {
	const stages = (stagesValue.length === 0 ? ['COMPOSITION_RESULT_READY'] : stagesValue).slice(
		0,
		CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxProgressResponses
	);
	return Object.freeze(
		stages.map((stageValue, index) => {
			const stage = normalizedStage(stageValue);
			return Object.freeze({
				...baseResponse(request, responseAt, `progress:${String(index + 1)}`),
				capability: progressCapability(request),
				currentness: currentnessUnknown(subjectId),
				exitCategory: 'IN_PROGRESS' as const,
				outcome: 'progress' as const,
				progress: {
					completedUnits: index + 1,
					progressRef: `progress:cli-composition:${requestDigest(request).slice(0, 24)}:${String(index + 1)}`,
					stageRef: `stage:cli-composition:${request.operation}:${stage}`,
					totalUnits: stages.length,
					unitKind: 'STAGE_EVENTS'
				},
				state: 'running' as const,
				subjectResolution: resolvedSubject(subjectId, evidenceReference),
				warningRefs: ['warning:progress-is-preliminary-non-evidence']
			});
		})
	);
}

function partialResponse(
	request: AgentOperationRequest,
	responseAt: string,
	operation: AgentOperation,
	subjectId: string,
	snapshotId: string | null,
	artifact: CodingAgentCliPublishedArtifact,
	progressTruncated: boolean
): AgentOperationPartialResponse {
	return {
		...baseResponse(request, responseAt, 'partial'),
		capability: partialCapability(request, artifact.reference, operation),
		currentness:
			snapshotId === null
				? currentnessCurrentWithoutSnapshot(subjectId, artifact.reference)
				: currentnessCurrent(subjectId, snapshotId, artifact.reference),
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		outcome: 'partial',
		partial: {
			admittedResultRefs: [artifact.reference],
			causeRefs: [
				'cause:cli-composition-local-unregistered',
				`cause:${operation}:bounded-scope-only`
			].sort(),
			completedRegionRefs: [`region:${operation}:bounded-current-result`],
			continuation: { kind: 'NONE', reasonCode: 'OPERATION_DOES_NOT_PAGE' },
			failedRegionRefs: [],
			missingRegionRefs: [`region:${operation}:registered-full-capability`],
			withheldRegionRefs: []
		},
		state: 'partial',
		subjectResolution: resolvedSubject(subjectId, artifact.reference),
		warningRefs: [
			'warning:cli-composition-local-unregistered',
			...(progressTruncated ? ['warning:progress-events-truncated'] : [])
		]
	};
}

function subjectFailureResponse(
	request: AgentOperationRequest,
	responseAt: string,
	outcome: Exclude<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>,
	basisReference: string
): AgentOperationErrorResponse {
	const commonRefusal = {
		attemptedEvidenceRefs: [basisReference],
		blockedActionRef: `action:${request.operation}:subject-bound-execution`,
		blockedClaimRefs: ['claim:requested-analysis-result'],
		failedPredicateRef: 'predicate:exact-current-subject-resolved',
		fallbackLimitRefs: ['limit:no-subject-no-analysis'],
		provenanceRefs: ['provenance:subject-resolution-operation'],
		requiredNextActionRef: 'next:correct-or-retry-subject-resolution',
		residualRiskRef: 'risk:requested-subject-not-established',
		responsibleOwnerRef: 'owner:csaa-root-integration',
		unaffectedScopeRefs: [] as readonly string[]
	};
	const capability = errorCapability(request, 'INVALID', false);
	const currentness = currentnessNotApplicable('SUBJECT_NOT_RESOLVED');
	if (outcome.outcome === 'not-found') {
		const locatorDigest =
			request.subjectInput.kind === 'SUBJECT_LOCATOR'
				? request.subjectInput.locatorDigest
				: codingAgentCliArtifactDigest(basisReference);
		return {
			...baseResponse(request, responseAt, 'subject-not-found'),
			capability,
			currentness,
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: {
				...commonRefusal,
				code: 'CSAA-E-SUBJECT-UNIDENTIFIED',
				reasonCode: 'SUBJECT_UNRESOLVED',
				retryability: 'NOT_RETRYABLE'
			},
			state: 'failed',
			subjectResolution: {
				kind: 'NOT_FOUND',
				locatorDigest,
				reasonCode: 'SUBJECT_NOT_FOUND'
			},
			warningRefs: ['warning:cli-composition-local-unregistered']
		};
	}
	if (outcome.outcome === 'forbidden')
		return {
			...baseResponse(request, responseAt, 'subject-forbidden'),
			capability,
			currentness,
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: {
				...commonRefusal,
				code: 'CSAA-E-AUTH-UNAUTHORIZED',
				reasonCode: 'AUTHORIZATION_REFUSED',
				retryability: 'NOT_RETRYABLE'
			},
			state: 'authorization-refused',
			subjectResolution: {
				accessDecisionRef: 'access-decision:subject-resolution-forbidden',
				kind: 'FORBIDDEN'
			},
			warningRefs: ['warning:cli-composition-local-unregistered']
		};
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'ambiguous')
		return {
			...baseResponse(request, responseAt, 'subject-unavailable'),
			capability,
			currentness,
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: {
				...commonRefusal,
				code: 'CSAA-E-SUBJECT-UNAVAILABLE',
				reasonCode: 'SUBJECT_UNRESOLVED',
				retryability: 'RETRYABLE'
			},
			state: 'failed',
			subjectResolution: {
				diagnosticRefs: [
					outcome.outcome === 'ambiguous'
						? 'diagnostic:ambiguous-subject-candidates-not-safely-disclosed'
						: 'diagnostic:subject-resolution-unavailable'
				],
				kind: 'UNAVAILABLE',
				retryState: 'RETRYABLE'
			},
			warningRefs: ['warning:cli-composition-local-unregistered']
		};
	return errorResponse(
		request,
		responseAt,
		new CompositionError(
			'INVALID',
			'The subject request is incompatible with the integrated resolver.'
		),
		basisReference
	);
}

function materializeSnapshotRequestArtifact(
	value: unknown,
	repositoryRoot: string,
	request: AgentOperationRequest,
	artifactBudget: number
): {
	readonly semanticRequest: BuildStaticSemanticSnapshotRequest;
	readonly subjectRequest: ResolveSubjectRequest;
} {
	const envelope = exactRecord(
		value,
		['kind', 'schemaVersion', 'semanticRequest', 'subjectRequest'],
		'$snapshotRequest'
	);
	if (envelope.values.get('kind') !== 'STATIC_SEMANTIC_SNAPSHOT_REQUEST')
		throw new CompositionError('INVALID', 'The snapshot request artifact kind is unsupported.');
	if (envelope.values.get('schemaVersion') !== CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION)
		throw new CompositionError('INVALID', 'The snapshot request artifact version is unsupported.');

	const subjectRecord = dataRecord(
		envelope.values.get('subjectRequest'),
		'$snapshotRequest.subjectRequest'
	);
	if (subjectRecord.values.get('rootLocator') !== '<repository-root>')
		throw new CompositionError(
			'INVALID',
			'The snapshot subject request must use the trusted repository-root sentinel.'
		);
	assertDomainBudgetEnvelope(
		subjectRecord.values.get('budgets'),
		request,
		artifactBudget,
		'$snapshotRequest.subjectRequest.budgets'
	);
	const subjectRequest = {
		...Object.fromEntries(subjectRecord.values),
		rootLocator: repositoryRoot
	} as unknown as ResolveSubjectRequest;

	const semanticRecord = exactRecord(
		envelope.values.get('semanticRequest'),
		[
			'assignabilityRequests',
			'budgets',
			'capabilities',
			'expectEmpty',
			'operationVersion',
			'rootLocator',
			'schemaVersion',
			'subjectId'
		],
		'$snapshotRequest.semanticRequest'
	);
	if (
		semanticRecord.values.get('operationVersion') !== SEMANTIC_OPERATION_VERSION ||
		semanticRecord.values.get('schemaVersion') !== SEMANTIC_REQUEST_SCHEMA_VERSION
	)
		throw new CompositionError(
			'INVALID',
			'The semantic snapshot operation version is unsupported.'
		);
	if (semanticRecord.values.get('rootLocator') !== '<repository-root>')
		throw new CompositionError(
			'INVALID',
			'The semantic request must use the trusted repository-root sentinel.'
		);
	const requestedSubjectId = semanticRecord.values.get('subjectId');
	if (requestedSubjectId !== '<resolved-subject>' && typeof requestedSubjectId !== 'string')
		throw new CompositionError('INVALID', 'The semantic request subject binding is invalid.');
	assertDomainBudgetEnvelope(
		semanticRecord.values.get('budgets'),
		request,
		artifactBudget,
		'$snapshotRequest.semanticRequest.budgets'
	);
	const semanticRequest = {
		...Object.fromEntries(semanticRecord.values),
		rootLocator: repositoryRoot
	} as unknown as BuildStaticSemanticSnapshotRequest;
	return { semanticRequest, subjectRequest };
}

function materializeSnapshotResultArtifact(
	value: unknown,
	validateSnapshot: typeof validateStaticSemanticSnapshot,
	frozenSubject?: FrozenSubject
): CodingAgentCliSnapshotResultArtifact {
	const envelope = exactRecord(
		value,
		['buildOutcome', 'captureRequestRef', 'diagnostics', 'schemaVersion', 'snapshot'],
		'$snapshotResult'
	);
	if (envelope.values.get('schemaVersion') !== CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION)
		throw new CompositionError(
			'INVALID',
			'The referenced snapshot artifact version is unsupported.'
		);
	const buildOutcome = envelope.values.get('buildOutcome');
	if (buildOutcome !== 'complete' && buildOutcome !== 'partial')
		throw new CompositionError('INVALID', 'The referenced snapshot build outcome is invalid.');
	const snapshotValue = envelope.values.get('snapshot');
	const captureRequestRef = requiredString(envelope, 'captureRequestRef', '$snapshotResult');
	try {
		codingAgentCliArtifactDigest(captureRequestRef);
	} catch (error) {
		throw artifactError(error as CodingAgentCliArtifactError);
	}
	const validation = validateSnapshot(
		snapshotValue,
		{},
		frozenSubject === undefined ? {} : { frozenSubject }
	);
	const requiresFrozenSubjectWitness =
		frozenSubject === undefined &&
		validation.state === 'INVALID' &&
		validation.issues.length === 1 &&
		validation.issues[0]?.code === 'FROZEN_EVIDENCE_REQUIRED' &&
		validation.issues[0].path === '$validationContext.frozenSubject';
	if (validation.state !== 'VALID' && !requiresFrozenSubjectWitness)
		throw new CompositionError('INVALID', 'The referenced semantic snapshot is invalid.');
	const snapshot = snapshotValue as StaticSemanticSnapshot;
	if (
		snapshot.schemaVersion !== SEMANTIC_SNAPSHOT_SCHEMA_VERSION ||
		(buildOutcome === 'complete') !== (snapshot.health === 'COMPLETE')
	)
		throw new CompositionError(
			'INVALID',
			'The referenced snapshot envelope conflicts with its validated snapshot.'
		);
	const diagnostics = envelope.values.get('diagnostics');
	if (!Array.isArray(diagnostics) || isProxy(diagnostics))
		throw new CompositionError('INVALID', 'The referenced snapshot diagnostics are invalid.');
	const artifact: CodingAgentCliSnapshotResultArtifact = {
		buildOutcome,
		captureRequestRef,
		diagnostics: diagnostics as StaticSemanticSnapshotOutcome['diagnostics'],
		schemaVersion: CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION,
		snapshot
	};
	if (requiresFrozenSubjectWitness) throw new FrozenSubjectWitnessRequiredError(artifact);
	return artifact;
}

function materializeInventoryRequestArtifact(
	value: unknown
): CodingAgentCliInventoryRequestArtifact {
	const record = exactRecord(
		value,
		['kind', 'requireJpwbPopulations', 'rootLocator', 'schemaVersion'],
		'$inventoryRequest'
	);
	if (
		record.values.get('kind') !== 'REPOSITORY_INVENTORY_REQUEST' ||
		record.values.get('schemaVersion') !== CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
	)
		throw new CompositionError('INVALID', 'The inventory request contract is unsupported.');
	if (record.values.get('rootLocator') !== '<repository-root>')
		throw new CompositionError(
			'INVALID',
			'The inventory request must use the trusted repository-root sentinel.'
		);
	return {
		kind: 'REPOSITORY_INVENTORY_REQUEST',
		requireJpwbPopulations: requiredBoolean(record, 'requireJpwbPopulations', '$inventoryRequest'),
		rootLocator: '<repository-root>',
		schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
	};
}

function validatedInventoryResult(result: RunInventoryResult): RunInventoryResult {
	if (
		result.mode !== 'json' ||
		result.ok !== true ||
		result.differences.length !== 0 ||
		result.inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION ||
		result.inventory.subject.subjectId !== result.subjectId ||
		canonicalInventoryJson(result.inventory) !== result.json
	)
		throw new CompositionError(
			'INTERNAL',
			'The inventory operation returned an internally inconsistent JSON capture.'
		);
	return result;
}

async function recaptureSnapshotSubject(
	request: AgentOperationRequest,
	artifactBudget: number,
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies,
	snapshotArtifact: CodingAgentCliSnapshotResultArtifact,
	context: CodingAgentCliHandlerContext
): Promise<{ readonly freshness: FrozenSubjectFreshness; readonly subject: FrozenSubject }> {
	assertNotCancelled(context);
	const captureRequest = materializeSnapshotRequestArtifact(
		await readCodingAgentCliJsonArtifact(
			artifactStore,
			snapshotArtifact.captureRequestRef,
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
		),
		repositoryRoot,
		request,
		artifactBudget
	);
	const resolution = dependencies.resolveSubject(captureRequest.subjectRequest);
	assertNotCancelled(context);
	if (resolution.outcome !== 'resolved')
		throw new CompositionError(
			'STALE',
			'The exact snapshot subject could not be recaptured for final currentness.',
			snapshotArtifact.snapshot.subjectId,
			snapshotArtifact.snapshot.id
		);
	const recapturedSubjectId = resolution.subject.descriptor.subjectId;
	if (recapturedSubjectId !== snapshotArtifact.snapshot.subjectId)
		throw new CompositionError(
			'STALE',
			'The final subject recapture differs from the stored exact snapshot.',
			recapturedSubjectId,
			snapshotArtifact.snapshot.id
		);
	const freshness = dependencies.verifySubject(resolution.subject, { rootLocator: repositoryRoot });
	assertNotCancelled(context);
	if (freshness.state !== 'CURRENT')
		throw new CompositionError(
			'STALE',
			'The independently verified recaptured subject is not current.',
			recapturedSubjectId,
			snapshotArtifact.snapshot.id
		);
	return Object.freeze({ freshness, subject: resolution.subject });
}

async function loadValidatedSnapshotResultArtifact(
	request: AgentOperationRequest,
	artifactBudget: number,
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies,
	reference: string,
	context: CodingAgentCliHandlerContext
): Promise<{
	readonly artifact: CodingAgentCliSnapshotResultArtifact;
	readonly recaptured?: {
		readonly freshness: FrozenSubjectFreshness;
		readonly subject: FrozenSubject;
	};
}> {
	const value = await readCodingAgentCliJsonArtifact(artifactStore, reference, artifactBudget);
	try {
		return Object.freeze({
			artifact: materializeSnapshotResultArtifact(value, dependencies.validateSnapshot)
		});
	} catch (error) {
		if (!(error instanceof FrozenSubjectWitnessRequiredError)) throw error;
		const recaptured = await recaptureSnapshotSubject(
			request,
			artifactBudget,
			repositoryRoot,
			artifactStore,
			dependencies,
			error.artifact,
			context
		);
		return Object.freeze({
			artifact: materializeSnapshotResultArtifact(
				value,
				dependencies.validateSnapshot,
				recaptured.subject
			),
			recaptured
		});
	}
}

function trustedAdditionalArtifactsForCapturedSubject(subject: FrozenSubject): readonly string[] {
	const scope = subject.request.scope;
	if (scope.kind !== 'EXPLICIT_PROJECTS') return Object.freeze([]);
	return Object.freeze([...(scope.additionalArtifacts ?? [])]);
}

function trustedSubjectFiltersForCapturedSubject(subject: FrozenSubject): SubjectFilters {
	return Object.freeze({
		exclude: Object.freeze([...subject.request.filters.exclude]),
		include: Object.freeze([...subject.request.filters.include])
	});
}

function boundedFindingsString(value: unknown, path: string, maximum = 2_048): string {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum)
		throw new CompositionError('INVALID', `${path} must be one bounded nonempty string.`);
	return value;
}

function findingsSha256(value: unknown, path: string): string {
	const text = boundedFindingsString(value, path, 64);
	if (!/^[a-f0-9]{64}$/u.test(text))
		throw new CompositionError('INVALID', `${path} must be one lowercase SHA-256 digest.`);
	return text;
}

function findingsTimestamp(value: unknown, path: string): string {
	const text = boundedFindingsString(value, path, 32);
	if (
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(text) ||
		Number.isNaN(Date.parse(text))
	)
		throw new CompositionError('INVALID', `${path} must be one canonical UTC timestamp.`);
	const canonical = new Date(Date.parse(text)).toISOString();
	if (text !== canonical && text !== canonical.replace('.000Z', 'Z'))
		throw new CompositionError('INVALID', `${path} must be one canonical UTC timestamp.`);
	return text;
}

function materializeProviderRun(value: unknown): ProviderRunInput {
	const path = '$findingsRequest.hybridRuntimeEvidence.run';
	const record = exactRecord(
		value,
		[
			'command',
			'endedAt',
			'environmentSha256',
			'outputComplete',
			'profile',
			'provider',
			'runId',
			'startedAt',
			'subjectId',
			'subjectManifestSha256',
			'termination'
		],
		path
	);
	const command = denseArray(record.values.get('command'), 256, `${path}.command`).map(
		(argument, index) => boundedFindingsString(argument, `${path}.command[${index}]`)
	);
	if (command.length === 0)
		throw new CompositionError('INVALID', `${path}.command must not be empty.`);
	const providerPath = `${path}.provider`;
	const provider = exactRecord(
		record.values.get('provider'),
		['configurationSha256', 'dependencyClosureSha256', 'executableSha256', 'id', 'version'],
		providerPath
	);
	const terminationPath = `${path}.termination`;
	const terminationRecord = dataRecord(record.values.get('termination'), terminationPath);
	const terminationKind = terminationRecord.values.get('kind');
	let termination: ProviderRunInput['termination'];
	if (terminationKind === 'EXITED') {
		const exact = exactRecord(
			record.values.get('termination'),
			['exitCode', 'kind'],
			terminationPath
		);
		const exitCode = exact.values.get('exitCode');
		if (typeof exitCode !== 'number' || !Number.isSafeInteger(exitCode))
			throw new CompositionError('INVALID', `${terminationPath}.exitCode must be a safe integer.`);
		termination = Object.freeze({ exitCode, kind: 'EXITED' });
	} else if (terminationKind === 'CRASHED') {
		const exact = exactRecord(
			record.values.get('termination'),
			['kind', 'signal'],
			terminationPath
		);
		const signal = exact.values.get('signal');
		if (
			signal !== null &&
			(typeof signal !== 'string' || signal.length === 0 || signal.length > 256)
		)
			throw new CompositionError('INVALID', `${terminationPath}.signal is invalid.`);
		termination = Object.freeze({
			kind: 'CRASHED',
			signal: signal as string | null
		});
	} else if (terminationKind === 'TIMED_OUT') {
		const exact = exactRecord(
			record.values.get('termination'),
			['budgetMs', 'kind'],
			terminationPath
		);
		const budgetMs = exact.values.get('budgetMs');
		if (typeof budgetMs !== 'number' || !Number.isSafeInteger(budgetMs) || budgetMs < 1)
			throw new CompositionError('INVALID', `${terminationPath}.budgetMs must be positive.`);
		termination = Object.freeze({ budgetMs, kind: 'TIMED_OUT' });
	} else throw new CompositionError('INVALID', `${terminationPath}.kind is unsupported.`);
	return Object.freeze({
		command: Object.freeze(command),
		endedAt: findingsTimestamp(record.values.get('endedAt'), `${path}.endedAt`),
		environmentSha256: findingsSha256(
			record.values.get('environmentSha256'),
			`${path}.environmentSha256`
		),
		outputComplete: requiredBoolean(record, 'outputComplete', path),
		profile: boundedFindingsString(record.values.get('profile'), `${path}.profile`, 256),
		provider: Object.freeze({
			configurationSha256: findingsSha256(
				provider.values.get('configurationSha256'),
				`${providerPath}.configurationSha256`
			),
			dependencyClosureSha256: findingsSha256(
				provider.values.get('dependencyClosureSha256'),
				`${providerPath}.dependencyClosureSha256`
			),
			executableSha256: findingsSha256(
				provider.values.get('executableSha256'),
				`${providerPath}.executableSha256`
			),
			id: boundedFindingsString(provider.values.get('id'), `${providerPath}.id`, 256),
			version: boundedFindingsString(provider.values.get('version'), `${providerPath}.version`, 256)
		}),
		runId: boundedFindingsString(record.values.get('runId'), `${path}.runId`, 256),
		startedAt: findingsTimestamp(record.values.get('startedAt'), `${path}.startedAt`),
		subjectId: boundedFindingsString(record.values.get('subjectId'), `${path}.subjectId`),
		subjectManifestSha256: findingsSha256(
			record.values.get('subjectManifestSha256'),
			`${path}.subjectManifestSha256`
		),
		termination
	});
}

function materializeHybridRuntimeEvidenceRequest(
	value: unknown
): CodingAgentCliHybridRuntimeEvidenceRequestArtifact | null {
	if (value === null) return null;
	const path = '$findingsRequest.hybridRuntimeEvidence';
	const record = exactRecord(
		value,
		['assessedAt', 'freshnessWindowMs', 'kind', 'run', 'traceRef'],
		path
	);
	if (record.values.get('kind') !== 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE')
		throw new CompositionError('INVALID', `${path}.kind is unsupported.`);
	const freshnessWindowMs = record.values.get('freshnessWindowMs');
	if (
		typeof freshnessWindowMs !== 'number' ||
		!Number.isSafeInteger(freshnessWindowMs) ||
		freshnessWindowMs < 0 ||
		freshnessWindowMs > CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxRuntimeFreshnessWindowMs
	)
		throw new CompositionError('INVALID', `${path}.freshnessWindowMs is outside its ceiling.`);
	return Object.freeze({
		assessedAt: findingsTimestamp(record.values.get('assessedAt'), `${path}.assessedAt`),
		freshnessWindowMs,
		kind: 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE',
		run: materializeProviderRun(record.values.get('run')),
		traceRef: exactArtifactReference(
			boundedFindingsString(record.values.get('traceRef'), `${path}.traceRef`, 128),
			`${path}.traceRef`
		)
	});
}

function materializeFindingsRequestArtifact(
	value: unknown,
	expectedSnapshotRef: string,
	request: AgentOperationRequest,
	artifactBudget: number
): CodingAgentCliFindingsRequestArtifact {
	const record = exactRecord(
		value,
		[
			'budgets',
			'executionDisposition',
			'executionId',
			'hybridRuntimeEvidence',
			'hybridStaticObservedAt',
			'kind',
			'operationVersion',
			'schemaVersion',
			'snapshotRef'
		],
		'$findingsRequest'
	);
	if (
		record.values.get('kind') !== 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST' ||
		record.values.get('schemaVersion') !== CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION
	)
		throw new CompositionError('INVALID', 'The findings request contract is unsupported.');
	if (
		record.values.get('operationVersion') !== JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION
	)
		throw new CompositionError(
			'INVALID',
			'The native projection operation version is unsupported.'
		);
	const snapshotRef = exactArtifactReference(
		requiredString(record, 'snapshotRef', '$findingsRequest'),
		'$findingsRequest.snapshotRef'
	);
	if (snapshotRef !== expectedSnapshotRef)
		throw new CompositionError(
			'INVALID',
			'The findings request does not bind the exact CLI snapshot artifact.'
		);
	const budgetsValue = record.values.get('budgets');
	const budgetsRecord = exactRecord(
		budgetsValue,
		['maxArtifacts', 'maxAstNodes', 'maxDurationMs', 'maxResultBytes', 'maxSourceBytes'],
		'$findingsRequest.budgets'
	);
	const nativeArtifactBudget =
		artifactBudget -
		CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.nativeProjectionWrapperReservationBytes;
	if (nativeArtifactBudget < 1)
		throw new CompositionError(
			'BUDGET',
			'The findings output budget cannot reserve the native projection wrapper.'
		);
	assertDomainBudgetEnvelope(
		budgetsValue,
		request,
		nativeArtifactBudget,
		'$findingsRequest.budgets'
	);
	const budgets = Object.fromEntries(
		budgetsRecord.values
	) as unknown as JpwbHarmonizationNativeProjectionBudgets;
	for (const [key, ceiling] of Object.entries(
		JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS
	)) {
		const candidate = budgets[key as keyof JpwbHarmonizationNativeProjectionBudgets];
		if (
			typeof candidate !== 'number' ||
			!Number.isSafeInteger(candidate) ||
			candidate < 1 ||
			candidate > ceiling
		)
			throw new CompositionError(
				candidate > ceiling ? 'BUDGET' : 'INVALID',
				`$findingsRequest.budgets.${key} exceeds the composition safety ceiling.`
			);
	}
	const executionDisposition = record.values.get('executionDisposition');
	if (executionDisposition !== 'RUN' && executionDisposition !== 'NOT_RUN')
		throw new CompositionError('INVALID', 'The findings execution disposition is invalid.');
	const executionId = requiredString(record, 'executionId', '$findingsRequest');
	if (executionId.length > 2_048)
		throw new CompositionError('INVALID', 'The findings execution identity is too long.');
	const hybridStaticObservedAt = requiredString(
		record,
		'hybridStaticObservedAt',
		'$findingsRequest'
	);
	if (
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u.test(
			hybridStaticObservedAt
		) ||
		Number.isNaN(Date.parse(hybridStaticObservedAt))
	)
		throw new CompositionError(
			'INVALID',
			'The hybrid static observation time must be canonical millisecond UTC.'
		);
	const hybridRuntimeEvidence = materializeHybridRuntimeEvidenceRequest(
		record.values.get('hybridRuntimeEvidence')
	);
	return {
		budgets,
		executionDisposition,
		executionId,
		hybridRuntimeEvidence,
		hybridStaticObservedAt,
		kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
		operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
		schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
		snapshotRef
	};
}

function materializeCurrentFreshness(value: unknown, path: string): FrozenSubjectFreshness {
	const record = exactRecord(value, ['changedPaths', 'diagnostics', 'state'], path);
	if (record.values.get('state') !== 'CURRENT')
		throw new CompositionError('STALE', `${path} does not establish currentness.`);
	const changedPaths = denseArray(
		record.values.get('changedPaths'),
		200_001,
		`${path}.changedPaths`
	);
	const diagnostics = denseArray(record.values.get('diagnostics'), 200_001, `${path}.diagnostics`);
	if (changedPaths.length !== 0)
		throw new CompositionError('STALE', `${path} reports changed paths while marked current.`);
	return {
		changedPaths: changedPaths as readonly string[],
		diagnostics: diagnostics as FrozenSubjectFreshness['diagnostics'],
		state: 'CURRENT'
	};
}

function materializeNativeProjectionOutcome(
	value: unknown
): Extract<JpwbHarmonizationNativeProjectionOutcome, { readonly outcome: 'projected' }> {
	const outcome = exactRecord(
		value,
		['diagnostics', 'outcome', 'result', 'schemaVersion', 'state'],
		'$findingsResult.nativeProjectionOutcome'
	);
	if (
		outcome.values.get('schemaVersion') !==
			JPWB_HARMONIZATION_NATIVE_PROJECTION_OUTCOME_SCHEMA_VERSION ||
		outcome.values.get('outcome') !== 'projected' ||
		outcome.values.get('state') !== 'projected' ||
		denseArray(
			outcome.values.get('diagnostics'),
			1,
			'$findingsResult.nativeProjectionOutcome.diagnostics'
		).length !== 0
	)
		throw new CompositionError('INVALID', 'The stored native projection outcome is invalid.');
	const resultValue = outcome.values.get('result');
	const result = exactRecord(
		resultValue,
		[
			'analysisAuthority',
			'authorityTransfer',
			'capability',
			'currentness',
			'currentRepositoryStatusTotals',
			'executionId',
			'facadeNonclaims',
			'projections',
			'resultWitness',
			'schemaVersion'
		],
		'$findingsResult.nativeProjectionOutcome.result'
	);
	if (
		result.values.get('schemaVersion') !==
			JPWB_HARMONIZATION_NATIVE_PROJECTION_RESULT_SCHEMA_VERSION ||
		result.values.get('analysisAuthority') !== 'NONE' ||
		result.values.get('authorityTransfer') !== 'NONE' ||
		denseArray(
			result.values.get('projections'),
			23,
			'$findingsResult.nativeProjectionOutcome.result.projections'
		).length !== 23
	)
		throw new CompositionError('INVALID', 'The stored native projection result is invalid.');
	const witness = exactRecord(
		result.values.get('resultWitness'),
		['bytes', 'sha256'],
		'$findingsResult.nativeProjectionOutcome.result.resultWitness'
	);
	const resultWithoutWitness = Object.fromEntries(
		[...result.values].filter(([key]) => key !== 'resultWitness')
	);
	const expectedWitness = canonicalSemanticJsonWitness(resultWithoutWitness);
	if (
		witness.values.get('bytes') !== expectedWitness.bytes ||
		witness.values.get('sha256') !== expectedWitness.sha256
	)
		throw new CompositionError(
			'INVALID',
			'The stored native projection witness does not reconcile.'
		);
	return value as Extract<
		JpwbHarmonizationNativeProjectionOutcome,
		{ readonly outcome: 'projected' }
	>;
}

function materializeHybridEvidence(
	value: unknown
): CodingAgentCliFindingsResultArtifact['hybridEvidence'] {
	const path = '$findingsResult.hybridEvidence';
	const record = exactRecord(
		value,
		['runtimeEvaluation', 'runtimeTrace', 'runtimeTraceRef', 'staticProjection'],
		path
	);
	const staticProjectionValue = record.values.get('staticProjection');
	const staticProjection = exactRecord(
		staticProjectionValue,
		[
			'analysisAuthority',
			'budgets',
			'freshness',
			'gateEffect',
			'limitations',
			'observedAt',
			'operationVersion',
			'population',
			'prerequisites',
			'projector',
			'rows',
			'schemaVersion',
			'subject'
		],
		`${path}.staticProjection`
	);
	if (
		staticProjection.values.get('schemaVersion') !== JPWB_HYBRID_STATIC_PROJECTION_SCHEMA_VERSION ||
		staticProjection.values.get('analysisAuthority') !== 'NONE' ||
		staticProjection.values.get('gateEffect') !== 'NONE'
	)
		throw new CompositionError('INVALID', 'The stored hybrid static projection is invalid.');

	const runtimeTraceRefValue = record.values.get('runtimeTraceRef');
	const runtimeTraceRef =
		runtimeTraceRefValue === null
			? null
			: exactArtifactReference(
					boundedFindingsString(runtimeTraceRefValue, `${path}.runtimeTraceRef`, 128),
					`${path}.runtimeTraceRef`
				);
	const runtimeTraceValue = record.values.get('runtimeTrace');
	const runtimeEvaluationValue = record.values.get('runtimeEvaluation');
	if (runtimeTraceRef === null) {
		if (runtimeTraceValue !== null || runtimeEvaluationValue !== null)
			throw new CompositionError(
				'INVALID',
				'The stored hybrid evidence has runtime output without a runtime trace reference.'
			);
	} else {
		const runtimeTrace = exactRecord(
			runtimeTraceValue,
			[
				'adapter',
				'analysisAuthority',
				'availability',
				'conflicts',
				'coverage',
				'diagnostics',
				'freshness',
				'gateEffect',
				'health',
				'observations',
				'provider',
				'rawArtifact',
				'redactions',
				'run',
				'schemaVersion',
				'subject',
				'usableForCurrentSubject'
			],
			`${path}.runtimeTrace`
		);
		const runtimeEvaluation = exactRecord(
			runtimeEvaluationValue,
			['analysisAuthority', 'evaluator', 'gateEffect', 'rows', 'schemaVersion', 'subjectId'],
			`${path}.runtimeEvaluation`
		);
		if (
			runtimeTrace.values.get('schemaVersion') !== ENRICHED_PROVIDER_EVIDENCE_SCHEMA_VERSION ||
			runtimeTrace.values.get('analysisAuthority') !== 'NONE' ||
			runtimeTrace.values.get('gateEffect') !== 'NONE' ||
			runtimeEvaluation.values.get('schemaVersion') !== HYBRID_RUNTIME_EVALUATION_SCHEMA_VERSION ||
			runtimeEvaluation.values.get('analysisAuthority') !== 'NONE' ||
			runtimeEvaluation.values.get('gateEffect') !== 'NONE'
		)
			throw new CompositionError('INVALID', 'The stored hybrid runtime evidence is invalid.');
	}

	return {
		runtimeEvaluation: runtimeEvaluationValue as HybridRuntimeEvaluationResult | null,
		runtimeTrace:
			runtimeTraceValue as ProviderEvidenceResult<DeterministicRuntimeTraceObservation> | null,
		runtimeTraceRef,
		staticProjection: staticProjectionValue as JpwbHybridStaticPrerequisiteProjection
	};
}

function materializeFindingsResultArtifact(value: unknown): CodingAgentCliFindingsResultArtifact {
	const record = exactRecord(
		value,
		[
			'currentness',
			'hybridEvidence',
			'nativeProjectionOutcome',
			'ruleProfileRef',
			'schemaVersion',
			'snapshotId',
			'snapshotRef',
			'subjectId'
		],
		'$findingsResult'
	);
	if (record.values.get('schemaVersion') !== CODING_AGENT_CLI_FINDINGS_RESULT_VERSION)
		throw new CompositionError('INVALID', 'The findings result contract is unsupported.');
	const currentnessRecord = exactRecord(
		record.values.get('currentness'),
		['afterProjection', 'basis', 'beforeProjection'],
		'$findingsResult.currentness'
	);
	if (
		currentnessRecord.values.get('basis') !==
		'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER'
	)
		throw new CompositionError('INVALID', 'The findings currentness basis is unsupported.');
	return {
		currentness: {
			afterProjection: materializeCurrentFreshness(
				currentnessRecord.values.get('afterProjection'),
				'$findingsResult.currentness.afterProjection'
			),
			basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER',
			beforeProjection: materializeCurrentFreshness(
				currentnessRecord.values.get('beforeProjection'),
				'$findingsResult.currentness.beforeProjection'
			)
		},
		hybridEvidence: materializeHybridEvidence(record.values.get('hybridEvidence')),
		nativeProjectionOutcome: materializeNativeProjectionOutcome(
			record.values.get('nativeProjectionOutcome')
		),
		ruleProfileRef: exactArtifactReference(
			requiredString(record, 'ruleProfileRef', '$findingsResult'),
			'$findingsResult.ruleProfileRef'
		),
		schemaVersion: CODING_AGENT_CLI_FINDINGS_RESULT_VERSION,
		snapshotId: requiredString(record, 'snapshotId', '$findingsResult'),
		snapshotRef: exactArtifactReference(
			requiredString(record, 'snapshotRef', '$findingsResult'),
			'$findingsResult.snapshotRef'
		),
		subjectId: requiredString(record, 'subjectId', '$findingsResult')
	};
}

async function projectHybridEvidence(
	findingsRequest: CodingAgentCliFindingsRequestArtifact,
	recaptured: { readonly freshness: FrozenSubjectFreshness; readonly subject: FrozenSubject },
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	context: CodingAgentCliHandlerContext
): Promise<CodingAgentCliFindingsResultArtifact['hybridEvidence']> {
	let staticProjection: JpwbHybridStaticPrerequisiteProjection;
	try {
		staticProjection = projectJpwbHybridStaticPrerequisites({
			freshness: recaptured.freshness,
			observedAt: findingsRequest.hybridStaticObservedAt,
			subject: recaptured.subject
		});
	} catch (error) {
		if (error instanceof TypeError)
			throw new CompositionError(
				'INVALID',
				'The source-bound hybrid static prerequisite request was refused.'
			);
		throw error;
	}
	assertNotCancelled(context);
	const runtimeRequest = findingsRequest.hybridRuntimeEvidence;
	if (runtimeRequest === null)
		return Object.freeze({
			runtimeEvaluation: null,
			runtimeTrace: null,
			runtimeTraceRef: null,
			staticProjection
		});

	const rawTrace = await readCodingAgentCliJsonArtifact(
		artifactStore,
		runtimeRequest.traceRef,
		CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
	);
	assertNotCancelled(context);
	try {
		const runtimeTrace = importDeterministicRuntimeTrace(canonicalInventoryJson(rawTrace), {
			assessedAt: runtimeRequest.assessedAt,
			freshnessWindowMs: runtimeRequest.freshnessWindowMs,
			repositoryRoot,
			run: runtimeRequest.run,
			subject: recaptured.subject
		});
		const runtimeEvaluation = evaluateProjectedHybridRuntimeRows({
			assessedAt: runtimeRequest.assessedAt,
			projection: staticProjection,
			trace: runtimeTrace
		});
		assertNotCancelled(context);
		return Object.freeze({
			runtimeEvaluation,
			runtimeTrace,
			runtimeTraceRef: runtimeRequest.traceRef,
			staticProjection
		});
	} catch (error) {
		if (error instanceof TypeError)
			throw new CompositionError(
				'INVALID',
				'The supplied deterministic runtime trace request was refused.'
			);
		throw error;
	}
}

function materializeExplanationProfile(value: unknown): CodingAgentCliExplanationProfileArtifact {
	const record = exactRecord(
		value,
		['evaluationId', 'findingFingerprint', 'findingId', 'kind', 'schemaVersion'],
		'$explanationProfile'
	);
	if (
		record.values.get('kind') !== 'EXACT_FINDING_EXPLANATION_PROFILE' ||
		record.values.get('schemaVersion') !== CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
	)
		throw new CompositionError('INVALID', 'The explanation profile contract is unsupported.');
	const findingFingerprint = requiredNullableString(
		record,
		'findingFingerprint',
		'$explanationProfile'
	);
	if (findingFingerprint !== null && !/^[0-9a-f]{64}$/u.test(findingFingerprint))
		throw new CompositionError(
			'INVALID',
			'$explanationProfile.findingFingerprint must be a lowercase SHA-256 or null.'
		);
	const findingId = record.values.get('findingId');
	if (typeof findingId !== 'number' || !Number.isSafeInteger(findingId) || findingId < 1)
		throw new CompositionError('INVALID', '$explanationProfile.findingId is invalid.');
	return {
		evaluationId: requiredString(record, 'evaluationId', '$explanationProfile'),
		findingFingerprint,
		findingId,
		kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
		schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
	};
}

function materializeVerificationExpectation(
	value: unknown,
	request: AgentOperationRequest
): CodingAgentCliVerificationExpectationArtifact {
	const record = exactRecord(
		value,
		['assertions', 'kind', 'schemaVersion', 'snapshotId', 'subjectId'],
		'$verificationExpectation'
	);
	if (
		record.values.get('kind') !== 'ARTIFACT_WORKFLOW_EXPECTATION' ||
		record.values.get('schemaVersion') !== CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION
	)
		throw new CompositionError('INVALID', 'The verification expectation contract is unsupported.');
	const assertionValues = denseArray(
		record.values.get('assertions'),
		Math.min(
			CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxVerificationAssertions,
			request.budgets.maxResults
		),
		'$verificationExpectation.assertions'
	);
	if (assertionValues.length === 0)
		throw new CompositionError('INVALID', 'Verification requires at least one exact assertion.');
	const distinctArtifacts = new Set<string>();
	const assertions = assertionValues.map((assertionValue, index) => {
		const path = `$verificationExpectation.assertions[${String(index)}]`;
		const inspected = dataRecord(assertionValue, path);
		const kind = inspected.values.get('kind');
		if (kind === 'ARTIFACT_DIGEST_EQUALS') {
			const exact = exactRecord(assertionValue, ['artifactRef', 'kind', 'sha256'], path);
			const artifactRef = exactArtifactReference(
				requiredString(exact, 'artifactRef', path),
				`${path}.artifactRef`
			);
			distinctArtifacts.add(artifactRef);
			const sha256 = requiredString(exact, 'sha256', path);
			if (!/^[0-9a-f]{64}$/u.test(sha256))
				throw new CompositionError('INVALID', `${path}.sha256 must be lowercase SHA-256.`);
			return { artifactRef, kind, sha256 } as const;
		}
		if (kind === 'JSON_VALUE_EQUALS') {
			const exact = exactRecord(assertionValue, ['artifactRef', 'expected', 'kind', 'path'], path);
			const artifactRef = exactArtifactReference(
				requiredString(exact, 'artifactRef', path),
				`${path}.artifactRef`
			);
			distinctArtifacts.add(artifactRef);
			const pathValues = denseArray(
				exact.values.get('path'),
				CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxVerificationPathDepth,
				`${path}.path`
			).map((segment, segmentIndex) => {
				if (
					typeof segment === 'number' &&
					Number.isSafeInteger(segment) &&
					segment >= 0 &&
					segment <= request.budgets.maxNodes
				)
					return segment;
				if (
					typeof segment === 'string' &&
					segment.length > 0 &&
					segment.length <= 256 &&
					segment !== '__proto__' &&
					segment !== 'constructor' &&
					segment !== 'prototype'
				)
					return segment;
				throw new CompositionError(
					'INVALID',
					`${path}.path[${String(segmentIndex)}] is unsafe or outside budget.`
				);
			});
			const expected = exact.values.get('expected');
			let expectedJson: string;
			try {
				expectedJson = canonicalSemanticJson(expected);
			} catch {
				throw new CompositionError('INVALID', `${path}.expected is not closed canonical JSON.`);
			}
			if (Buffer.byteLength(expectedJson, 'utf8') > 65_536)
				throw new CompositionError('BUDGET', `${path}.expected exceeds the comparison ceiling.`);
			return {
				artifactRef,
				expected: expected as CodingAgentCliJsonValue,
				kind,
				path: Object.freeze(pathValues)
			} as const;
		}
		throw new CompositionError('INVALID', `${path}.kind is unsupported.`);
	});
	if (
		distinctArtifacts.size >
		CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxVerificationDistinctArtifacts
	)
		throw new CompositionError('BUDGET', 'Verification references too many distinct artifacts.');
	return {
		assertions: Object.freeze(assertions),
		kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
		schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
		snapshotId: requiredString(record, 'snapshotId', '$verificationExpectation'),
		subjectId: requiredString(record, 'subjectId', '$verificationExpectation')
	};
}

function jsonValueAtPath(
	root: unknown,
	path: readonly (number | string)[],
	request: AgentOperationRequest
): { readonly found: boolean; readonly value: unknown } {
	let current = root;
	for (let index = 0; index < path.length; index += 1) {
		const segment = path[index]!;
		if (typeof segment === 'number') {
			if (!Array.isArray(current) || segment >= current.length)
				return { found: false, value: null };
			if (current.length > request.budgets.maxNodes)
				throw new CompositionError('BUDGET', 'A verified JSON array exceeds maxNodes.');
			current = current[segment];
		} else {
			if (current === null || typeof current !== 'object' || Array.isArray(current))
				return { found: false, value: null };
			const record = dataRecord(current, `$verifiedArtifact.path[${String(index)}]`);
			if (!record.values.has(segment)) return { found: false, value: null };
			current = record.values.get(segment);
		}
	}
	return { found: true, value: current };
}

function reportRequestEnvelope(
	value: unknown,
	request: AgentOperationRequest,
	artifactBudget: number,
	expectedSchemaVersion: string,
	expectedOperationVersion: string,
	path: string
): unknown {
	const record = dataRecord(value, path);
	if (
		record.values.get('schemaVersion') !== expectedSchemaVersion ||
		record.values.get('operationVersion') !== expectedOperationVersion
	)
		throw new CompositionError('INVALID', `${path} has an unsupported operation version.`);
	assertDomainBudgetEnvelope(
		record.values.get('budgets'),
		request,
		artifactBudget,
		`${path}.budgets`
	);
	return value;
}

function reportFailure(
	state: 'failed' | 'incompatible' | 'resource-refused' | 'stale',
	subjectId?: string,
	snapshotId?: string
): CompositionError {
	if (state === 'resource-refused')
		return new CompositionError(
			'BUDGET',
			'The owning report refused its resource budget.',
			subjectId
		);
	if (state === 'stale')
		return new CompositionError(
			'STALE',
			'The owning report could not establish final currentness.',
			subjectId,
			snapshotId
		);
	if (state === 'incompatible')
		return new CompositionError(
			'INVALID',
			'The owning report found the operation request incompatible.',
			subjectId
		);
	return new CompositionError(
		'CAPABILITY_UNAVAILABLE',
		'The owning report failed closed without an admitted result.',
		subjectId
	);
}

function assertNotCancelled(context: CodingAgentCliHandlerContext): void {
	if (context.signal.aborted)
		throw new CompositionError(
			'CAPABILITY_UNAVAILABLE',
			'The operation was cancelled before the owning operation completed.'
		);
}

function assertWithinDuration(
	startedAt: number,
	request: AgentOperationRequest,
	subjectId?: string
): void {
	if (performance.now() - startedAt > request.budgets.timeoutMs)
		throw new CompositionError(
			'TIMEOUT',
			'The synchronous operation exceeded timeoutMs.',
			subjectId
		);
}

function snapshotCapability(request: AgentOperationRequest): SemanticCapability {
	const capabilityId = request.capabilityRequirement.capabilityId;
	if (!Object.hasOwn(SNAPSHOT_CAPABILITIES, capabilityId))
		throw new CompositionError(
			'UNSUPPORTED',
			'The static semantic snapshot adapter supports only CAP-001, CAP-002, and CAP-003.'
		);
	const id = capabilityId as keyof typeof SNAPSHOT_CAPABILITIES;
	if (request.capabilityRequirement.capabilityVersion !== CAPABILITY_VERSIONS[id])
		throw new CompositionError(
			'UNSUPPORTED',
			`The snapshot adapter supports only ${CAPABILITY_VERSIONS[id]}.`
		);
	return SNAPSHOT_CAPABILITIES[id];
}

function inventoryHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliInventoryInput;
		const basisReference = input.subjectInputRef;
		try {
			if (context.invocation.command !== 'inventory' || input.kind !== 'INVENTORY')
				throw new CompositionError(
					'INTERNAL',
					'The inventory handler received a mismatched command.'
				);
			localOperationCapabilityAccepted(request, 'inventory');
			assertSubjectInputBinding(request, basisReference);
			assertNotCancelled(context);
			const artifactBudget = outputArtifactBudget(request);
			const inventoryRequest = materializeInventoryRequestArtifact(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					basisReference,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				)
			);
			const startedAt = performance.now();
			const first = validatedInventoryResult(
				dependencies.inventory({
					mode: 'json',
					repositoryRoot,
					requireJpwbPopulations: inventoryRequest.requireJpwbPopulations
				})
			);
			assertWithinDuration(startedAt, request, first.subjectId);
			assertNotCancelled(context);
			const second = validatedInventoryResult(
				dependencies.inventory({
					mode: 'json',
					repositoryRoot,
					requireJpwbPopulations: inventoryRequest.requireJpwbPopulations
				})
			);
			assertWithinDuration(startedAt, request, second.subjectId);
			assertNotCancelled(context);
			if (first.subjectId !== second.subjectId || first.json !== second.json)
				throw new CompositionError(
					'STALE',
					'Two consecutive inventory captures did not reproduce the same exact subject.',
					second.subjectId
				);
			const subjectId = second.subjectId;
			assertSubjectInputBinding(request, basisReference, subjectId);
			assertCurrentnessRequirement(request, subjectId, undefined, basisReference);
			const result: CodingAgentCliInventoryResultArtifact = {
				capture: {
					comparison: 'TWO_CONSECUTIVE_CANONICAL_CAPTURES_EQUAL',
					subjectId
				},
				inventory: second.inventory,
				schemaVersion: CODING_AGENT_CLI_INVENTORY_RESULT_VERSION
			};
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				result,
				artifactBudget
			);
			const progress = progressResponses(request, responseAt, subjectId, published.reference, [
				'INVENTORY_FIRST_CAPTURE_COMPLETE',
				'INVENTORY_SECOND_CAPTURE_EQUAL'
			]);
			return Object.freeze([
				...progress,
				partialResponse(request, responseAt, 'inventory', subjectId, null, published, false)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function snapshotHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliSnapshotInput;
		const basisReference = input.subjectInputRef;
		try {
			if (context.invocation.command !== 'snapshot' || input.kind !== 'SNAPSHOT')
				throw new CompositionError(
					'INTERNAL',
					'The snapshot handler received a mismatched command.'
				);
			const requestedCapability = snapshotCapability(request);
			assertSubjectInputBinding(request, basisReference);
			assertNotCancelled(context);
			const artifactBudget = outputArtifactBudget(request);
			const artifactValue = await readCodingAgentCliJsonArtifact(
				artifactStore,
				basisReference,
				CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
			);
			const materialized = materializeSnapshotRequestArtifact(
				artifactValue,
				repositoryRoot,
				request,
				artifactBudget
			);
			const capabilities = materialized.semanticRequest.capabilities;
			if (!Array.isArray(capabilities) || !capabilities.includes(requestedCapability))
				throw new CompositionError(
					'INVALID',
					'The semantic request does not include the exact capability required by the agent request.'
				);
			assertNotCancelled(context);
			const resolution = dependencies.resolveSubject(materialized.subjectRequest);
			if (resolution.outcome !== 'resolved')
				return Object.freeze([
					subjectFailureResponse(request, responseAt, resolution, basisReference)
				]);
			const subjectId = resolution.subject.descriptor.subjectId;
			assertSubjectInputBinding(request, basisReference, subjectId);
			const requestedSubjectId = materialized.semanticRequest.subjectId;
			if (requestedSubjectId !== '<resolved-subject>' && requestedSubjectId !== subjectId)
				throw new CompositionError(
					'INVALID',
					'The semantic request subject identifier differs from the resolved subject.',
					subjectId
				);
			const semanticRequest: BuildStaticSemanticSnapshotRequest = {
				...materialized.semanticRequest,
				subjectId
			};
			const stages: string[] = [];
			const outcome = dependencies.buildSnapshot(
				semanticRequest,
				{ subject: resolution.subject },
				{
					onProgress: (event: StaticSemanticSnapshotProgressEvent): void => {
						stages.push(`SNAPSHOT_${event.phase}_${event.state}`);
					}
				}
			);
			assertNotCancelled(context);
			if (outcome.outcome === 'unavailable')
				throw new CompositionError(
					'CAPABILITY_UNAVAILABLE',
					'The static semantic snapshot operation was unavailable.',
					subjectId
				);
			if (outcome.outcome === 'incompatible')
				throw new CompositionError(
					'INVALID',
					'The static semantic snapshot request was incompatible.',
					subjectId
				);
			const snapshot = outcome.snapshot;
			if (snapshot.subjectId !== subjectId)
				throw new CompositionError(
					'INTERNAL',
					'The snapshot operation returned a different subject identity.',
					subjectId
				);
			const capability = snapshot.capabilities.find(
				(candidate) => candidate.capability === requestedCapability
			);
			if (capability === undefined)
				throw new CompositionError(
					'INTERNAL',
					'The snapshot omitted the requested semantic capability record.',
					subjectId,
					snapshot.id
				);
			if (capability.state === 'UNSUPPORTED')
				throw new CompositionError(
					'UNSUPPORTED',
					'The snapshot provider does not support the requested semantic capability.',
					subjectId,
					snapshot.id
				);
			const afterBuild = dependencies.verifySubject(resolution.subject, {
				rootLocator: repositoryRoot
			});
			assertNotCancelled(context);
			if (afterBuild.state !== 'CURRENT')
				throw new CompositionError(
					'STALE',
					'The exact frozen subject changed during static semantic snapshot construction.',
					subjectId,
					snapshot.id
				);
			assertCurrentnessRequirement(request, subjectId, snapshot.id, basisReference);
			const resultArtifact: CodingAgentCliSnapshotResultArtifact = {
				buildOutcome: outcome.outcome,
				captureRequestRef: basisReference,
				diagnostics: outcome.diagnostics,
				schemaVersion: CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION,
				snapshot
			};
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				resultArtifact,
				artifactBudget
			);
			const progress = progressResponses(
				request,
				responseAt,
				subjectId,
				published.reference,
				stages
			);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'snapshot',
					subjectId,
					snapshot.id,
					published,
					stages.length > progress.length
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function queryHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliQueryInput;
		const basisReference = input.queryRef;
		try {
			if (context.invocation.command !== 'query' || input.kind !== 'QUERY')
				throw new CompositionError('INTERNAL', 'The query handler received a mismatched command.');
			operationCapabilityAccepted(request, 'JAN-CSAA-CAP-029');
			const artifactBudget = outputArtifactBudget(request);
			assertNotCancelled(context);
			const loadedSnapshot = await loadValidatedSnapshotResultArtifact(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				input.snapshotRef,
				context
			);
			const snapshotArtifact = loadedSnapshot.artifact;
			const expectedSnapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, expectedSnapshot.subjectId);
			assertCurrentnessRequirement(
				request,
				expectedSnapshot.subjectId,
				expectedSnapshot.id,
				input.snapshotRef
			);
			const additionalArtifacts =
				loadedSnapshot.recaptured === undefined
					? Object.freeze([])
					: trustedAdditionalArtifactsForCapturedSubject(loadedSnapshot.recaptured.subject);
			const subjectFilters =
				loadedSnapshot.recaptured === undefined
					? Object.freeze({ exclude: Object.freeze([]), include: Object.freeze([]) })
					: trustedSubjectFiltersForCapturedSubject(loadedSnapshot.recaptured.subject);
			const queryRequest = reportRequestEnvelope(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.queryRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				request,
				artifactBudget,
				SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
				SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
				'$queryRequest'
			);
			const stages: string[] = [];
			const outcome = await dependencies.query(queryRequest, {
				additionalArtifacts,
				onProgress: (event: SemanticSourceQueryReportProgressEvent): void => {
					stages.push(`QUERY_${event.phase}_${event.state}`);
				},
				repositoryRoot,
				subjectFilters
			});
			assertNotCancelled(context);
			if (outcome.outcome === 'unavailable')
				throw reportFailure(outcome.state, outcome.subject?.subjectId);
			const subjectId = outcome.subject.subjectId;
			const snapshotId = outcome.result.population.semanticSnapshotId;
			if (
				outcome.result.currentness.state !== 'CURRENT_FOR_CAPTURED_SUBJECT' ||
				outcome.result.currentness.changedPaths.length !== 0
			)
				throw new CompositionError(
					'STALE',
					'The semantic query report did not establish final currentness.',
					subjectId,
					snapshotId
				);
			if (subjectId !== expectedSnapshot.subjectId || snapshotId !== expectedSnapshot.id)
				throw new CompositionError(
					'STALE',
					'The semantic query recapture differs from the requested exact snapshot.',
					subjectId,
					snapshotId
				);
			assertCurrentnessRequirement(request, subjectId, snapshotId, input.snapshotRef);
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				outcome,
				artifactBudget
			);
			const progress = progressResponses(request, responseAt, subjectId, input.snapshotRef, stages);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'query',
					subjectId,
					snapshotId,
					published,
					stages.length > progress.length
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function impactHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliImpactInput;
		const basisReference = input.changeSetRef;
		try {
			if (context.invocation.command !== 'impact' || input.kind !== 'IMPACT')
				throw new CompositionError('INTERNAL', 'The impact handler received a mismatched command.');
			operationCapabilityAccepted(request, 'JAN-CSAA-CAP-031');
			const artifactBudget = outputArtifactBudget(request);
			assertNotCancelled(context);
			const loadedSnapshot = await loadValidatedSnapshotResultArtifact(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				input.snapshotRef,
				context
			);
			const snapshotArtifact = loadedSnapshot.artifact;
			const expectedSnapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, expectedSnapshot.subjectId);
			assertCurrentnessRequirement(
				request,
				expectedSnapshot.subjectId,
				expectedSnapshot.id,
				input.snapshotRef
			);
			const additionalArtifacts =
				loadedSnapshot.recaptured === undefined
					? Object.freeze([])
					: trustedAdditionalArtifactsForCapturedSubject(loadedSnapshot.recaptured.subject);
			const subjectFilters =
				loadedSnapshot.recaptured === undefined
					? Object.freeze({ exclude: Object.freeze([]), include: Object.freeze([]) })
					: trustedSubjectFiltersForCapturedSubject(loadedSnapshot.recaptured.subject);
			const changeRequest = await readCodingAgentCliJsonArtifact(
				artifactStore,
				input.changeSetRef,
				CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
			);
			const changeRecord = dataRecord(changeRequest, '$impactRequest');
			const schemaVersion = requiredString(changeRecord, 'schemaVersion', '$impactRequest');
			const stages: string[] = [];
			let outcome:
				StaticModuleImpactCandidateReportOutcome | WorkingSourceEditImpactCandidateReportOutcome;
			let working = false;
			if (schemaVersion === STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION) {
				reportRequestEnvelope(
					changeRequest,
					request,
					artifactBudget,
					STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
					STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
					'$impactRequest'
				);
				outcome = dependencies.staticImpact(changeRequest, {
					additionalArtifacts,
					onPredecessorProgress: (event): void => {
						stages.push(`IMPACT_PREDECESSOR_${event.phase}_${event.state}`);
					},
					repositoryRoot,
					subjectFilters
				});
			} else if (
				schemaVersion === WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION
			) {
				working = true;
				reportRequestEnvelope(
					changeRequest,
					request,
					artifactBudget,
					WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
					WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
					'$impactRequest'
				);
				outcome = dependencies.workingImpact(changeRequest, {
					additionalArtifacts,
					onPredecessorProgress: (event): void => {
						stages.push(`IMPACT_PREDECESSOR_${event.phase}_${event.state}`);
					},
					repositoryRoot,
					subjectFilters
				});
			} else {
				throw new CompositionError('INVALID', 'The impact request schema version is unsupported.');
			}
			assertNotCancelled(context);
			if (outcome.outcome === 'unavailable')
				throw reportFailure(outcome.state, outcome.subject?.subjectId);
			const subjectId = outcome.subject.subjectId;
			const snapshotId = working
				? (
						outcome as WorkingSourceEditImpactCandidateReportOutcome & {
							readonly outcome: 'partial';
						}
					).result.evidence.staticModuleImpactCandidateReport.result.invalidationDependencies
						.semanticSnapshotId
				: (
						outcome as StaticModuleImpactCandidateReportOutcome & {
							readonly outcome: 'partial';
						}
					).result.invalidationDependencies.semanticSnapshotId;
			const current = working
				? (
						outcome as WorkingSourceEditImpactCandidateReportOutcome & {
							readonly outcome: 'partial';
						}
					).result.currentness.state === 'CURRENT_FOR_VALIDATED_SELECTED_WORKING_SOURCE_EDIT'
				: (
						outcome as StaticModuleImpactCandidateReportOutcome & {
							readonly outcome: 'partial';
						}
					).result.currentness.state === 'CURRENT_FOR_CAPTURED_SUBJECT';
			if (!current)
				throw new CompositionError(
					'STALE',
					'The impact report did not establish final currentness.',
					subjectId,
					snapshotId
				);
			if (subjectId !== expectedSnapshot.subjectId || snapshotId !== expectedSnapshot.id)
				throw new CompositionError(
					'STALE',
					'The impact report recapture differs from the requested exact snapshot.',
					subjectId,
					snapshotId
				);
			assertCurrentnessRequirement(request, subjectId, snapshotId, input.snapshotRef);
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				outcome,
				artifactBudget
			);
			const progress = progressResponses(request, responseAt, subjectId, input.snapshotRef, stages);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'impact',
					subjectId,
					snapshotId,
					published,
					stages.length > progress.length
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function findingsHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliFindingsInput;
		const basisReference = input.ruleProfileRef;
		try {
			if (context.invocation.command !== 'findings' || input.kind !== 'FINDINGS')
				throw new CompositionError(
					'INTERNAL',
					'The findings handler received a mismatched command.'
				);
			localOperationCapabilityAccepted(request, 'findings');
			const artifactBudget = outputArtifactBudget(request);
			const loadedSnapshot = await loadValidatedSnapshotResultArtifact(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				input.snapshotRef,
				context
			);
			const snapshotArtifact = loadedSnapshot.artifact;
			const snapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, snapshot.subjectId);
			assertCurrentnessRequirement(request, snapshot.subjectId, snapshot.id, input.snapshotRef);
			const recaptured =
				loadedSnapshot.recaptured ??
				(await recaptureSnapshotSubject(
					request,
					artifactBudget,
					repositoryRoot,
					artifactStore,
					dependencies,
					snapshotArtifact,
					context
				));
			const findingsRequest = materializeFindingsRequestArtifact(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.ruleProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				input.snapshotRef,
				request,
				artifactBudget
			);
			const outcome = dependencies.projectFindings({
				budgets: findingsRequest.budgets,
				executionDisposition: findingsRequest.executionDisposition,
				executionId: findingsRequest.executionId,
				freshness: recaptured.freshness,
				operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
				schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION,
				subject: recaptured.subject
			});
			assertNotCancelled(context);
			if (outcome.outcome !== 'projected')
				throw new CompositionError(
					outcome.state === 'resource-refused' ? 'BUDGET' : 'INVALID',
					'The native harmonization projector did not admit a projection result.',
					snapshot.subjectId,
					snapshot.id
				);
			if (outcome.result.currentness.frozenSubjectId !== snapshot.subjectId)
				throw new CompositionError(
					'INVALID',
					'The native projection does not bind the exact snapshot subject.',
					snapshot.subjectId,
					snapshot.id
				);
			const hybridEvidence = await projectHybridEvidence(
				findingsRequest,
				recaptured,
				repositoryRoot,
				artifactStore,
				context
			);
			const afterProjection = dependencies.verifySubject(recaptured.subject, {
				rootLocator: repositoryRoot
			});
			assertNotCancelled(context);
			if (afterProjection.state !== 'CURRENT')
				throw new CompositionError(
					'STALE',
					'The exact frozen subject changed during native findings projection.',
					snapshot.subjectId,
					snapshot.id
				);
			const result: CodingAgentCliFindingsResultArtifact = {
				currentness: {
					afterProjection,
					basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER',
					beforeProjection: recaptured.freshness
				},
				hybridEvidence,
				nativeProjectionOutcome: outcome,
				ruleProfileRef: input.ruleProfileRef,
				schemaVersion: CODING_AGENT_CLI_FINDINGS_RESULT_VERSION,
				snapshotId: snapshot.id,
				snapshotRef: input.snapshotRef,
				subjectId: snapshot.subjectId
			};
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				result,
				artifactBudget
			);
			const progress = progressResponses(
				request,
				responseAt,
				snapshot.subjectId,
				published.reference,
				[
					`FINDINGS_NATIVE_PROJECTED_${outcome.result.projections.length}_RULES`,
					`FINDINGS_HYBRID_STATIC_PROJECTED_${hybridEvidence.staticProjection.population.conclusive}_CONCLUSIVE_${hybridEvidence.staticProjection.population.unsupported}_UNSUPPORTED_${hybridEvidence.staticProjection.population.conflicting}_CONFLICTING`,
					hybridEvidence.runtimeTrace === null
						? 'FINDINGS_HYBRID_RUNTIME_TRACE_NOT_SUPPLIED'
						: `FINDINGS_HYBRID_RUNTIME_TRACE_${hybridEvidence.runtimeTrace.health}_${hybridEvidence.runtimeEvaluation!.rows.length}_ROWS`,
					'FINDINGS_SUBJECT_RECHECKED_CURRENT_AFTER_PROJECTION'
				]
			);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'findings',
					snapshot.subjectId,
					snapshot.id,
					published,
					false
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function explainHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliExplainInput;
		const basisReference = input.resultRef;
		try {
			if (context.invocation.command !== 'explain' || input.kind !== 'EXPLAIN')
				throw new CompositionError(
					'INTERNAL',
					'The explain handler received a mismatched command.'
				);
			localOperationCapabilityAccepted(request, 'explain');
			const artifactBudget = outputArtifactBudget(request);
			const findings = materializeFindingsResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, input.resultRef, artifactBudget)
			);
			assertSubjectInputBinding(request, input.resultRef, findings.subjectId);
			assertCurrentnessRequirement(
				request,
				findings.subjectId,
				findings.snapshotId,
				input.resultRef
			);
			const loadedSnapshot = await loadValidatedSnapshotResultArtifact(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				findings.snapshotRef,
				context
			);
			const snapshotArtifact = loadedSnapshot.artifact;
			if (
				snapshotArtifact.snapshot.id !== findings.snapshotId ||
				snapshotArtifact.snapshot.subjectId !== findings.subjectId
			)
				throw new CompositionError(
					'INVALID',
					'The findings source does not bind its exact stored snapshot.'
				);
			const recaptured =
				loadedSnapshot.recaptured ??
				(await recaptureSnapshotSubject(
					request,
					artifactBudget,
					repositoryRoot,
					artifactStore,
					dependencies,
					snapshotArtifact,
					context
				));
			const findingsRequest = materializeFindingsRequestArtifact(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					findings.ruleProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				findings.snapshotRef,
				request,
				artifactBudget
			);
			const replayed = dependencies.projectFindings({
				budgets: findingsRequest.budgets,
				executionDisposition: findingsRequest.executionDisposition,
				executionId: findingsRequest.executionId,
				freshness: recaptured.freshness,
				operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
				schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION,
				subject: recaptured.subject
			});
			const replayedHybridEvidence = await projectHybridEvidence(
				findingsRequest,
				recaptured,
				repositoryRoot,
				artifactStore,
				context
			);
			const afterReplay = dependencies.verifySubject(recaptured.subject, {
				rootLocator: repositoryRoot
			});
			if (
				afterReplay.state !== 'CURRENT' ||
				replayed.outcome !== 'projected' ||
				canonicalSemanticJson(replayed) !==
					canonicalSemanticJson(findings.nativeProjectionOutcome) ||
				canonicalSemanticJson(replayedHybridEvidence) !==
					canonicalSemanticJson(findings.hybridEvidence)
			)
				throw new CompositionError(
					afterReplay.state === 'CURRENT' ? 'INVALID' : 'STALE',
					'The stored native and hybrid findings evidence does not reproduce from current exact frozen bytes.'
				);
			const profile = materializeExplanationProfile(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.explanationProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				)
			);
			const projection = replayed.result.projections.find(
				(candidate) => candidate.findingId === profile.findingId
			);
			if (projection === undefined || projection.evaluation.outcome !== 'evaluated')
				throw new CompositionError(
					'INVALID',
					'The explanation profile does not select one evaluated native projection.'
				);
			const findingFingerprint = projection.evaluation.result.finding?.findingFingerprint ?? null;
			if (
				profile.evaluationId !== projection.evaluation.result.evaluationId ||
				profile.findingFingerprint !== findingFingerprint
			)
				throw new CompositionError(
					'INVALID',
					'The explanation profile does not select the exact stored evaluation and finding.'
				);
			const result: CodingAgentCliExplanationResultArtifact = {
				analysisAuthority: 'NONE',
				gateEffect: 'NONE',
				nativeProjection: {
					capability: replayed.result.capability,
					currentRepositoryStatusTotals: replayed.result.currentRepositoryStatusTotals,
					currentness: replayed.result.currentness,
					executionId: replayed.result.executionId,
					resultWitness: replayed.result.resultWitness
				},
				projection,
				replayCurrentness: {
					afterProjection: afterReplay,
					basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER',
					beforeProjection: recaptured.freshness
				},
				schemaVersion: CODING_AGENT_CLI_EXPLANATION_RESULT_VERSION,
				source: {
					findingsResultRef: input.resultRef,
					ruleProfileRef: findings.ruleProfileRef,
					snapshotId: findings.snapshotId,
					snapshotRef: findings.snapshotRef,
					subjectId: findings.subjectId
				}
			};
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				result,
				artifactBudget
			);
			const progress = progressResponses(
				request,
				responseAt,
				findings.subjectId,
				published.reference,
				['EXPLANATION_EXACT_EVIDENCE_REPLAYED_AND_BOUND']
			);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'explain',
					findings.subjectId,
					findings.snapshotId,
					published,
					false
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

function verifyHandler(
	repositoryRoot: string,
	artifactStore: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies
): CodingAgentCliHandler {
	return async (context): Promise<readonly AgentOperationResponse[]> => {
		const { request } = context.invocation;
		const responseAt = request.requestedAt;
		const input = context.invocation.input as CodingAgentCliVerifyInput;
		const basisReference = input.expectationRef;
		try {
			if (context.invocation.command !== 'verify' || input.kind !== 'VERIFY')
				throw new CompositionError('INTERNAL', 'The verify handler received a mismatched command.');
			localOperationCapabilityAccepted(request, 'verify');
			const artifactBudget = outputArtifactBudget(request);
			const loadedSnapshot = await loadValidatedSnapshotResultArtifact(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				input.subjectInputRef,
				context
			);
			const snapshotArtifact = loadedSnapshot.artifact;
			const snapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.subjectInputRef, snapshot.subjectId);
			assertCurrentnessRequirement(request, snapshot.subjectId, snapshot.id, input.subjectInputRef);
			if (loadedSnapshot.recaptured === undefined)
				await recaptureSnapshotSubject(
					request,
					artifactBudget,
					repositoryRoot,
					artifactStore,
					dependencies,
					snapshotArtifact,
					context
				);
			const expectation = materializeVerificationExpectation(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.expectationRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				request
			);
			const artifactCache = new Map<
				string,
				{ readonly present: false } | { readonly present: true; readonly value: unknown }
			>();
			const readExpectedArtifact = async (
				artifactRef: string
			): Promise<
				{ readonly present: false } | { readonly present: true; readonly value: unknown }
			> => {
				const cached = artifactCache.get(artifactRef);
				if (cached !== undefined) return cached;
				try {
					const value = await readCodingAgentCliJsonArtifact(
						artifactStore,
						artifactRef,
						CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxVerificationArtifactBytes
					);
					const present = { present: true as const, value };
					artifactCache.set(artifactRef, present);
					return present;
				} catch (error) {
					if (error instanceof CodingAgentCliArtifactError && error.code === 'ARTIFACT_NOT_FOUND') {
						const absent = { present: false as const };
						artifactCache.set(artifactRef, absent);
						return absent;
					}
					throw error;
				}
			};
			const assertionResults: CodingAgentCliVerificationResultArtifact['assertions'][number][] = [];
			for (let index = 0; index < expectation.assertions.length; index += 1) {
				assertNotCancelled(context);
				const assertion = expectation.assertions[index]!;
				const observed = await readExpectedArtifact(assertion.artifactRef);
				if (assertion.kind === 'ARTIFACT_DIGEST_EQUALS') {
					const actualDigest = observed.present
						? codingAgentCliArtifactDigest(assertion.artifactRef)
						: null;
					assertionResults.push({
						actualDigest,
						assertionIndex: index,
						artifactRef: assertion.artifactRef,
						kind: assertion.kind,
						passed: actualDigest === assertion.sha256
					});
					continue;
				}
				const selected = observed.present
					? jsonValueAtPath(observed.value, assertion.path, request)
					: { found: false as const, value: null };
				const actualJson = selected.found ? canonicalSemanticJson(selected.value) : null;
				assertionResults.push({
					actualDigest:
						actualJson === null
							? null
							: codingAgentCliArtifactDigest(codingAgentCliArtifactReference(actualJson)),
					assertionIndex: index,
					artifactRef: assertion.artifactRef,
					kind: assertion.kind,
					passed: actualJson !== null && actualJson === canonicalSemanticJson(assertion.expected)
				});
			}
			const snapshotBindingPassed = expectation.snapshotId === snapshot.id;
			const subjectBindingPassed = expectation.subjectId === snapshot.subjectId;
			const passed =
				snapshotBindingPassed &&
				subjectBindingPassed &&
				assertionResults.every((assertion) => assertion.passed);
			const result: CodingAgentCliVerificationResultArtifact = {
				analysisAuthority: 'NONE',
				assertions: Object.freeze(assertionResults),
				expectationRef: input.expectationRef,
				gateEffect: 'NONE',
				passed,
				schemaVersion: CODING_AGENT_CLI_VERIFICATION_RESULT_VERSION,
				snapshotBindingPassed,
				snapshotId: snapshot.id,
				subjectBindingPassed,
				subjectId: snapshot.subjectId
			};
			const published = await publishCodingAgentCliJsonArtifact(
				artifactStore,
				result,
				artifactBudget
			);
			if (!passed)
				return Object.freeze([
					errorResponse(
						request,
						responseAt,
						new CompositionError(
							'EXPECTATION_FAILED',
							'One or more exact artifact-workflow expectations failed.',
							snapshot.subjectId,
							snapshot.id
						),
						published.reference
					)
				]);
			const progress = progressResponses(
				request,
				responseAt,
				snapshot.subjectId,
				published.reference,
				['VERIFICATION_ALL_DECLARED_ARTIFACT_EXPECTATIONS_MET']
			);
			return Object.freeze([
				...progress,
				partialResponse(
					request,
					responseAt,
					'verify',
					snapshot.subjectId,
					snapshot.id,
					published,
					false
				)
			]);
		} catch (error) {
			return Object.freeze([
				errorResponse(request, responseAt, compositionError(error), basisReference)
			]);
		}
	};
}

/**
 * Composes all seven exact coding-agent commands. Every terminal admitted result remains partial
 * because these adapters are implementation-local, unregistered, and confer no gate authority.
 */
export function composeCodingAgentCliHandlers(
	options: ComposeCodingAgentCliHandlersOptions
): CodingAgentCliHandlers {
	if (options === null || typeof options !== 'object' || isProxy(options))
		throw new Error('The coding-agent CLI composition options are invalid.');
	const repositoryRoot = materializeRepositoryRoot(options.repositoryRoot);
	if (
		options.artifactStore === null ||
		typeof options.artifactStore !== 'object' ||
		isProxy(options.artifactStore) ||
		typeof options.artifactStore.read !== 'function' ||
		typeof options.artifactStore.write !== 'function'
	)
		throw new Error('The coding-agent CLI composition artifact store is invalid.');
	const dependencies = stableDependencies(options.dependencies);
	return Object.freeze({
		explain: explainHandler(repositoryRoot, options.artifactStore, dependencies),
		findings: findingsHandler(repositoryRoot, options.artifactStore, dependencies),
		impact: impactHandler(repositoryRoot, options.artifactStore, dependencies),
		inventory: inventoryHandler(repositoryRoot, options.artifactStore, dependencies),
		query: queryHandler(repositoryRoot, options.artifactStore, dependencies),
		snapshot: snapshotHandler(repositoryRoot, options.artifactStore, dependencies),
		verify: verifyHandler(repositoryRoot, options.artifactStore, dependencies)
	});
}
