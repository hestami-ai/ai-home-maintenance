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
	ResolveSubjectRequest,
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
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { runInventory, type RunInventoryResult } from '../inventory/run-inventory.js';
import { canonicalJson as canonicalInventoryJson } from '../inventory/canonical.js';
import {
	HARMONIZATION_FIRST_INCREMENT_CAPABILITY,
	HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION,
	HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION,
	HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
	evaluateHarmonizationFirstIncrementRule,
	type HarmonizationFirstIncrementEvaluationOutcome,
	type HarmonizationFirstIncrementEvaluationRequest,
	type HarmonizationFirstIncrementEvaluationResult
} from '../rules/harmonization-first-increment-rules.js';
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
	'jan-csaa-coding-agent-findings-request/0.1.0' as const;
export const CODING_AGENT_CLI_FINDINGS_RESULT_VERSION =
	'jan-csaa-coding-agent-findings-result/0.1.0' as const;
export const CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION =
	'jan-csaa-coding-agent-explanation-profile/0.1.0' as const;
export const CODING_AGENT_CLI_EXPLANATION_RESULT_VERSION =
	'jan-csaa-coding-agent-explanation-result/0.1.0' as const;
export const CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION =
	'jan-csaa-coding-agent-verification-expectation/0.1.0' as const;
export const CODING_AGENT_CLI_VERIFICATION_RESULT_VERSION =
	'jan-csaa-coding-agent-verification-result/0.1.0' as const;

export const CODING_AGENT_CLI_LOCAL_CAPABILITIES = Object.freeze({
	explain: 'IMPLEMENTATION_LOCAL_EXACT_FINDING_EXPLANATION',
	findings: HARMONIZATION_FIRST_INCREMENT_CAPABILITY,
	inventory: 'IMPLEMENTATION_LOCAL_REPOSITORY_INVENTORY',
	verify: 'IMPLEMENTATION_LOCAL_ARTIFACT_WORKFLOW_VERIFICATION'
} as const);

export const CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS = Object.freeze({
	explain: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.explain}@0.1.0`,
	findings: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.findings}@0.1.0`,
	inventory: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.inventory}@0.1.0`,
	verify: `${CODING_AGENT_CLI_LOCAL_CAPABILITIES.verify}@0.1.0`
} as const);

export const CODING_AGENT_CLI_COMPOSITION_STATE = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;

export const CODING_AGENT_CLI_COMPOSITION_NONCLAIMS = Object.freeze([
	'This composition is implementation-local and is not package-root registered, installed as a binary, or G6 completion evidence.',
	'Inventory, findings, exact-evidence explanation, and artifact-workflow verification are implementation-local adapters rather than registered JAN-CSAA operations or qualified providers.',
	'Findings evaluate only exact caller-supplied observations through the first-increment rule evaluator; this composition performs no native repository fact projection and preserves UNSUPPORTED and NOT_RUN.',
	'Explanation copies exact stored finding, rule, trace, evidence, currentness, and provenance fields and creates no inferred causal or remediation claim.',
	'Verification compares bounded stored artifacts to caller-declared exact expectations; it is not test execution, behavior preservation, conformance, acceptance, disposition, or gate authority.',
	'Snapshot, query, and impact responses preserve their owning operations limitations and cannot create gates, remediation, non-impact, safe-removal, or behavior-preservation authority.',
	'Only content-addressed canonical JSON artifacts are consumed or published; artifact references are never interpreted as filesystem paths.',
	'The composition does not execute subject code, use the network, or mutate subject source.'
] as const);

export const CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS = Object.freeze({
	maxVerificationAssertions: 32,
	maxVerificationArtifactBytes: CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes,
	maxVerificationDistinctArtifacts: 4,
	maxVerificationPathDepth: 32,
	maxProgressResponses: 16,
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
	readonly evaluationOutcome: HarmonizationFirstIncrementEvaluationOutcome;
	readonly ruleProfileRef: string;
	readonly schemaVersion: typeof CODING_AGENT_CLI_FINDINGS_RESULT_VERSION;
	readonly snapshotId: string;
	readonly snapshotRef: string;
	readonly subjectId: string;
}

export interface CodingAgentCliFindingsRequestArtifact {
	readonly evaluationRequest: HarmonizationFirstIncrementEvaluationRequest;
	readonly kind: 'HARMONIZATION_FIRST_INCREMENT_FINDINGS_REQUEST';
	readonly schemaVersion: typeof CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION;
	readonly snapshotRef: string;
}

export interface CodingAgentCliExplanationProfileArtifact {
	readonly evaluationId: string;
	readonly findingFingerprint: string | null;
	readonly kind: 'EXACT_FINDING_EXPLANATION_PROFILE';
	readonly schemaVersion: typeof CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION;
}

export interface CodingAgentCliExplanationResultArtifact {
	readonly analysisAuthority: 'NONE';
	readonly evaluation: {
		readonly currentness: HarmonizationFirstIncrementEvaluationResult['currentness'];
		readonly evaluationId: string;
		readonly evidence: HarmonizationFirstIncrementEvaluationResult['evidence'];
		readonly finding: HarmonizationFirstIncrementEvaluationResult['finding'];
		readonly population: HarmonizationFirstIncrementEvaluationResult['population'];
		readonly provenance: HarmonizationFirstIncrementEvaluationResult['provenance'];
		readonly rule: HarmonizationFirstIncrementEvaluationResult['rule'];
		readonly status: HarmonizationFirstIncrementEvaluationResult['status'];
		readonly statusRationale: string;
	};
	readonly gateEffect: 'NONE';
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
	readonly evaluateFinding: typeof evaluateHarmonizationFirstIncrementRule;
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
	readonly staticImpact: (
		request: unknown,
		options: RunStaticModuleImpactCandidateReportOptions
	) => StaticModuleImpactCandidateReportOutcome;
	readonly validateSnapshot: typeof validateStaticSemanticSnapshot;
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
	evaluateFinding: evaluateHarmonizationFirstIncrementRule,
	inventory: runInventory,
	query: runSemanticSourceQueryReport,
	resolveSubject,
	staticImpact: runStaticModuleImpactCandidateReport,
	validateSnapshot: validateStaticSemanticSnapshot,
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

const DEPTH_BUDGET_KEYS = new Set(['maxAstDepth', 'maxConfigDepth', 'maxDepth']);
const EDGE_BUDGET_KEYS = new Set([
	'maxCandidateWitnessHops',
	'maxCompilerFacts',
	'maxCompilerQueries',
	'maxCompilerQueryInvocations',
	'maxEdges',
	'maxEvaluations',
	'maxMemberships',
	'maxTraceNodes',
	'maxWitnessHops'
]);
const NODE_BUDGET_KEYS = new Set([
	'maxAstNodes',
	'maxFiles',
	'maxFrontierRecords',
	'maxInputRecords',
	'maxNodes',
	'maxOutputRecords',
	'maxPopulation',
	'maxPrograms',
	'maxProjects',
	'maxSources'
]);
const RESULT_BUDGET_KEYS = new Set(['maxResultRecords', 'maxResults']);
const TIME_BUDGET_KEYS = new Set(['maxDurationMs', 'maxGitOperationDurationMs']);

function assertBudgetValue(value: unknown, maximum: number, path: string): void {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
		throw new CompositionError('INVALID', `${path} must be a positive safe-integer budget.`);
	if (value > maximum)
		throw new CompositionError(
			'BUDGET',
			`${path} exceeds the enclosing agent-operation resource budget.`
		);
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
		if (key === 'maxResultBytes' || key === 'maxSnapshotBytes') {
			assertBudgetValue(child, artifactBudget, childPath);
			continue;
		}
		if (DEPTH_BUDGET_KEYS.has(key)) {
			assertBudgetValue(child, request.budgets.maxDepth, childPath);
			continue;
		}
		if (EDGE_BUDGET_KEYS.has(key)) {
			assertBudgetValue(child, request.budgets.maxEdges, childPath);
			continue;
		}
		if (NODE_BUDGET_KEYS.has(key)) {
			assertBudgetValue(child, request.budgets.maxNodes, childPath);
			continue;
		}
		if (RESULT_BUDGET_KEYS.has(key)) {
			assertBudgetValue(child, request.budgets.maxResults, childPath);
			continue;
		}
		if (TIME_BUDGET_KEYS.has(key)) {
			assertBudgetValue(child, request.budgets.timeoutMs, childPath);
			continue;
		}
		if (child !== null && typeof child === 'object' && !Array.isArray(child))
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
	validateSnapshot: typeof validateStaticSemanticSnapshot
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
	const validation = validateSnapshot(snapshotValue);
	if (validation.state !== 'VALID')
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
	return {
		buildOutcome,
		captureRequestRef,
		diagnostics: diagnostics as StaticSemanticSnapshotOutcome['diagnostics'],
		schemaVersion: CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION,
		snapshot
	};
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
): Promise<void> {
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
}

function materializeFindingsRequestArtifact(
	value: unknown,
	expectedSnapshotRef: string
): CodingAgentCliFindingsRequestArtifact {
	const record = exactRecord(
		value,
		['evaluationRequest', 'kind', 'schemaVersion', 'snapshotRef'],
		'$findingsRequest'
	);
	if (
		record.values.get('kind') !== 'HARMONIZATION_FIRST_INCREMENT_FINDINGS_REQUEST' ||
		record.values.get('schemaVersion') !== CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION
	)
		throw new CompositionError('INVALID', 'The findings request contract is unsupported.');
	const snapshotRef = exactArtifactReference(
		requiredString(record, 'snapshotRef', '$findingsRequest'),
		'$findingsRequest.snapshotRef'
	);
	if (snapshotRef !== expectedSnapshotRef)
		throw new CompositionError(
			'INVALID',
			'The findings request does not bind the exact CLI snapshot artifact.'
		);
	const evaluationRequest = record.values.get('evaluationRequest');
	const evaluationRecord = dataRecord(evaluationRequest, '$findingsRequest.evaluationRequest');
	if (
		evaluationRecord.values.get('schemaVersion') !==
			HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION ||
		evaluationRecord.values.get('operationVersion') !==
			HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION
	)
		throw new CompositionError('INVALID', 'The rule-evaluation request version is unsupported.');
	return {
		evaluationRequest: evaluationRequest as HarmonizationFirstIncrementEvaluationRequest,
		kind: 'HARMONIZATION_FIRST_INCREMENT_FINDINGS_REQUEST',
		schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
		snapshotRef
	};
}

function materializeFindingsResultArtifact(value: unknown): CodingAgentCliFindingsResultArtifact {
	const record = exactRecord(
		value,
		[
			'evaluationOutcome',
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
	const evaluationOutcome = record.values.get('evaluationOutcome');
	const outcomeRecord = dataRecord(evaluationOutcome, '$findingsResult.evaluationOutcome');
	if (
		outcomeRecord.values.get('schemaVersion') !==
			HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION ||
		outcomeRecord.values.get('outcome') !== 'evaluated' ||
		outcomeRecord.values.get('state') !== 'evaluated'
	)
		throw new CompositionError(
			'INVALID',
			'The stored findings outcome is not an evaluated result.'
		);
	return {
		evaluationOutcome: evaluationOutcome as HarmonizationFirstIncrementEvaluationOutcome,
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

function materializeExplanationProfile(value: unknown): CodingAgentCliExplanationProfileArtifact {
	const record = exactRecord(
		value,
		['evaluationId', 'findingFingerprint', 'kind', 'schemaVersion'],
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
	return {
		evaluationId: requiredString(record, 'evaluationId', '$explanationProfile'),
		findingFingerprint,
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
			const snapshotArtifact = materializeSnapshotResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, input.snapshotRef, artifactBudget),
				dependencies.validateSnapshot
			);
			const expectedSnapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, expectedSnapshot.subjectId);
			assertCurrentnessRequirement(
				request,
				expectedSnapshot.subjectId,
				expectedSnapshot.id,
				input.snapshotRef
			);
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
				onProgress: (event: SemanticSourceQueryReportProgressEvent): void => {
					stages.push(`QUERY_${event.phase}_${event.state}`);
				},
				repositoryRoot
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
			const snapshotArtifact = materializeSnapshotResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, input.snapshotRef, artifactBudget),
				dependencies.validateSnapshot
			);
			const expectedSnapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, expectedSnapshot.subjectId);
			assertCurrentnessRequirement(
				request,
				expectedSnapshot.subjectId,
				expectedSnapshot.id,
				input.snapshotRef
			);
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
					onPredecessorProgress: (event): void => {
						stages.push(`IMPACT_PREDECESSOR_${event.phase}_${event.state}`);
					},
					repositoryRoot
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
					onPredecessorProgress: (event): void => {
						stages.push(`IMPACT_PREDECESSOR_${event.phase}_${event.state}`);
					},
					repositoryRoot
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
			const snapshotArtifact = materializeSnapshotResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, input.snapshotRef, artifactBudget),
				dependencies.validateSnapshot
			);
			const snapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.snapshotRef, snapshot.subjectId);
			assertCurrentnessRequirement(request, snapshot.subjectId, snapshot.id, input.snapshotRef);
			await recaptureSnapshotSubject(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				snapshotArtifact,
				context
			);
			const findingsRequest = materializeFindingsRequestArtifact(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.ruleProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				input.snapshotRef
			);
			const outcome = dependencies.evaluateFinding(findingsRequest.evaluationRequest);
			assertNotCancelled(context);
			if (outcome.outcome !== 'evaluated')
				throw new CompositionError(
					outcome.state === 'resource-refused' ? 'BUDGET' : 'INVALID',
					'The first-increment rule evaluator did not admit an evaluation result.',
					snapshot.subjectId,
					snapshot.id
				);
			if (
				outcome.result.currentness.frozenSubjectId !== snapshot.subjectId ||
				!outcome.result.currentness.invalidationDependencyIds.includes(input.snapshotRef)
			)
				throw new CompositionError(
					'INVALID',
					'The rule observation does not bind the exact subject and snapshot dependency.',
					snapshot.subjectId,
					snapshot.id
				);
			const result: CodingAgentCliFindingsResultArtifact = {
				evaluationOutcome: outcome,
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
				[`FINDINGS_EVALUATION_${outcome.result.status}`]
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
			if (findings.evaluationOutcome.outcome !== 'evaluated')
				throw new CompositionError(
					'INVALID',
					'The explanation source is not an evaluated finding.'
				);
			assertSubjectInputBinding(request, input.resultRef, findings.subjectId);
			assertCurrentnessRequirement(
				request,
				findings.subjectId,
				findings.snapshotId,
				input.resultRef
			);
			const snapshotArtifact = materializeSnapshotResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, findings.snapshotRef, artifactBudget),
				dependencies.validateSnapshot
			);
			if (
				snapshotArtifact.snapshot.id !== findings.snapshotId ||
				snapshotArtifact.snapshot.subjectId !== findings.subjectId
			)
				throw new CompositionError(
					'INVALID',
					'The findings source does not bind its exact stored snapshot.'
				);
			await recaptureSnapshotSubject(
				request,
				artifactBudget,
				repositoryRoot,
				artifactStore,
				dependencies,
				snapshotArtifact,
				context
			);
			const findingsRequest = materializeFindingsRequestArtifact(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					findings.ruleProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				),
				findings.snapshotRef
			);
			const replayed = dependencies.evaluateFinding(findingsRequest.evaluationRequest);
			if (
				replayed.outcome !== 'evaluated' ||
				canonicalSemanticJson(replayed) !== canonicalSemanticJson(findings.evaluationOutcome)
			)
				throw new CompositionError(
					'INVALID',
					'The stored finding does not reproduce from its exact stored rule observation.'
				);
			const profile = materializeExplanationProfile(
				await readCodingAgentCliJsonArtifact(
					artifactStore,
					input.explanationProfileRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
				)
			);
			const findingFingerprint = replayed.result.finding?.findingFingerprint ?? null;
			if (
				profile.evaluationId !== replayed.result.evaluationId ||
				profile.findingFingerprint !== findingFingerprint
			)
				throw new CompositionError(
					'INVALID',
					'The explanation profile does not select the exact stored evaluation and finding.'
				);
			const result: CodingAgentCliExplanationResultArtifact = {
				analysisAuthority: 'NONE',
				evaluation: {
					currentness: replayed.result.currentness,
					evaluationId: replayed.result.evaluationId,
					evidence: replayed.result.evidence,
					finding: replayed.result.finding,
					population: replayed.result.population,
					provenance: replayed.result.provenance,
					rule: replayed.result.rule,
					status: replayed.result.status,
					statusRationale: replayed.result.statusRationale
				},
				gateEffect: 'NONE',
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
			const snapshotArtifact = materializeSnapshotResultArtifact(
				await readCodingAgentCliJsonArtifact(artifactStore, input.subjectInputRef, artifactBudget),
				dependencies.validateSnapshot
			);
			const snapshot = snapshotArtifact.snapshot;
			assertSubjectInputBinding(request, input.subjectInputRef, snapshot.subjectId);
			assertCurrentnessRequirement(request, snapshot.subjectId, snapshot.id, input.subjectInputRef);
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
