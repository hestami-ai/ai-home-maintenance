import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

export const AGENT_OPERATION_PROTOCOL_VERSION = 'jan-csaa-agent-operation-protocol/0.1.0' as const;

export const AGENT_OPERATION_VERSIONS = Object.freeze({
	explain: 'jan-csaa-agent-explain/0.1.0',
	findings: 'jan-csaa-agent-findings/0.1.0',
	impact: 'jan-csaa-agent-impact/0.1.0',
	inventory: 'jan-csaa-agent-inventory/0.1.0',
	query: 'jan-csaa-agent-query/0.1.0',
	snapshot: 'jan-csaa-agent-snapshot/0.1.0',
	verify: 'jan-csaa-agent-verify/0.1.0'
} as const);

export const AGENT_OPERATION_PROTOCOL_NONCLAIMS = Object.freeze([
	'This foundation is not the complete JAN-CSAA-007 operation contract or a registered JAN-CSAA capability.',
	'This foundation does not execute operations, resolve subjects, establish provider qualification, activate a gate, mutate source, or confer authority.',
	'Operation-specific inputs and results remain content-bound references until their owning contracts are registered.',
	'Currentness, capability, provenance, conflict, and refusal fields carry supplied evidence references; this foundation validates their protocol consistency but does not prove the referenced evidence.'
] as const);

export const AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS = Object.freeze({
	maxDepth: 256,
	maxEdges: 5_000_000,
	maxMessageBytes: 1_048_576,
	maxNodes: 1_000_000,
	maxOutputBytes: 128 * 1024 * 1024,
	maxReferenceCount: 128,
	maxResults: 250_000,
	maxTimeoutMs: 3_600_000
} as const);

export type AgentOperation = keyof typeof AGENT_OPERATION_VERSIONS;
export type AgentEmploymentPoint =
	| 'REPOSITORY_INTAKE'
	| 'BEFORE_DESIGN'
	| 'BEFORE_PLANNING'
	| 'DURING_IMPLEMENTATION'
	| 'AFTER_COHERENT_INCREMENT'
	| 'LOCAL_PRE_COMMIT_CHECKPOINT'
	| 'BEFORE_MERGE'
	| 'REGRESSION_ANALYSIS'
	| 'BEFORE_COMPLETION'
	| 'REFACTORING'
	| 'DEFECT_INVESTIGATION'
	| 'SECURITY_WORK'
	| 'HANDOFF';

export type AgentCapabilityCoverage =
	'supported' | 'partial' | 'unsupported' | 'excluded' | 'not-analyzed';
export type AgentExecutionHealth =
	| 'succeeded'
	| 'failed'
	| 'timed-out'
	| 'cancelled'
	| 'resource-exhausted'
	| 'malformed-output'
	| 'unavailable'
	| 'not-run';
export type AgentConflictState =
	'unopposed' | 'corroborated' | 'conflicting' | 'corrected' | 'superseded';
export type AgentCurrentnessState = 'current-for-subject' | 'stale' | 'invalidated' | 'unknown';

export interface AgentProtocolResourceBudget {
	readonly maxDepth: number;
	readonly maxEdges: number;
	readonly maxNodes: number;
	readonly maxOutputBytes: number;
	readonly maxResults: number;
	readonly timeoutMs: number;
}

export type AgentChangeContractBinding =
	| { readonly kind: 'REFERENCE'; readonly changeContractRef: string }
	| { readonly kind: 'NOT_APPLICABLE'; readonly reasonCode: string };

export interface AgentWorkContext {
	readonly agentId: string;
	readonly authorityEnvelopeRef: string;
	readonly changeContract: AgentChangeContractBinding;
	readonly employmentPoint: AgentEmploymentPoint;
	readonly userRequestDigest: string;
	readonly workPackageRef: string;
}

export type AgentSubjectInput =
	| { readonly kind: 'RESOLVED_SUBJECT'; readonly subjectId: string }
	| {
			readonly kind: 'SUBJECT_LOCATOR';
			readonly locatorDigest: string;
			readonly locatorRef: string;
			readonly resolutionPolicyRef: string;
	  }
	| {
			readonly kind: 'SCOPED_TARGET';
			readonly scopeRef: string;
			readonly targetPopulationRefs: readonly string[];
	  }
	| { readonly kind: 'TARGET_RECORD'; readonly targetRecordRef: string }
	| { readonly kind: 'NOT_APPLICABLE'; readonly reasonCode: string };

export type AgentCurrentnessRequirement =
	| { readonly kind: 'REQUIRE_CURRENT' }
	| { readonly kind: 'REQUIRE_EXACT_SUBJECT'; readonly subjectId: string }
	| { readonly kind: 'ALLOW_HISTORICAL'; readonly rationaleRef: string };

export interface AgentCapabilityRequirement {
	readonly affectedQuestionRefs: readonly string[];
	readonly capabilityId: string;
	readonly capabilityVersion: string;
	readonly necessity: 'MANDATORY' | 'DISCRETIONARY';
}

export interface AgentOperationInputBinding {
	readonly contractId: string;
	readonly contractVersion: string;
	readonly inputDigest: string;
	readonly inputRef: string;
}

export interface AgentOperationRequest {
	readonly budgets: AgentProtocolResourceBudget;
	readonly capabilityRequirement: AgentCapabilityRequirement;
	readonly currentnessRequirement: AgentCurrentnessRequirement;
	readonly messageKind: 'request';
	readonly operation: AgentOperation;
	readonly operationInput: AgentOperationInputBinding;
	readonly operationVersion: (typeof AGENT_OPERATION_VERSIONS)[AgentOperation];
	readonly protocolVersion: typeof AGENT_OPERATION_PROTOCOL_VERSION;
	readonly requestId: string;
	readonly requestedAt: string;
	readonly subjectInput: AgentSubjectInput;
	readonly work: AgentWorkContext;
}

export type AgentSubjectResolutionOutcome =
	| {
			readonly kind: 'RESOLVED';
			readonly resolutionEvidenceRefs: readonly string[];
			readonly subjectId: string;
	  }
	| { readonly kind: 'NOT_FOUND'; readonly locatorDigest: string; readonly reasonCode: string }
	| {
			readonly candidateDisclosure:
				| { readonly candidateRefs: readonly string[]; readonly kind: 'AUTHORIZED_REFERENCES' }
				| { readonly kind: 'WITHHELD_COUNT'; readonly withheldCandidateCount: number };
			readonly kind: 'AMBIGUOUS';
	  }
	| { readonly accessDecisionRef: string; readonly kind: 'FORBIDDEN' }
	| {
			readonly diagnosticRefs: readonly string[];
			readonly kind: 'UNAVAILABLE';
			readonly retryState: 'RETRYABLE' | 'NOT_RETRYABLE' | 'UNKNOWN';
	  }
	| { readonly compatibilityDecisionRef: string; readonly kind: 'INCOMPATIBLE' }
	| { readonly kind: 'NOT_APPLICABLE'; readonly reasonCode: string };

export interface AgentCapabilityStatus {
	readonly affectedQuestionRefs: readonly string[];
	readonly capabilityCoverage: AgentCapabilityCoverage;
	readonly capabilityId: string;
	readonly capabilityVersion: string;
	readonly conflict: AgentConflictState;
	readonly conflictRefs: readonly string[];
	readonly coverageRefs: readonly string[];
	readonly excludedRegionRefs: readonly string[];
	readonly executionHealth: AgentExecutionHealth;
	readonly implementationState: 'IMPLEMENTED' | 'UNIMPLEMENTED';
	readonly limitationRefs: readonly string[];
	readonly provenanceRefs: readonly string[];
	readonly providerRefs: readonly string[];
	readonly qualificationState: 'QUALIFIED' | 'NONPASS' | 'UNKNOWN' | 'NOT_APPLICABLE';
	readonly unknownRegionRefs: readonly string[];
}

export type AgentSubjectCurrentnessBinding =
	| { readonly kind: 'SUBJECT'; readonly subjectId: string }
	| { readonly kind: 'NOT_APPLICABLE'; readonly reasonCode: string };

export type AgentSnapshotCurrentnessBinding =
	| { readonly kind: 'SNAPSHOT'; readonly snapshotId: string }
	| { readonly kind: 'NOT_APPLICABLE'; readonly reasonCode: string };

export interface AgentCurrentnessStatus {
	readonly freshnessEvidenceRefs: readonly string[];
	readonly invalidationRefs: readonly string[];
	readonly observationCutoffRef: string;
	readonly snapshot: AgentSnapshotCurrentnessBinding;
	readonly status: AgentCurrentnessState;
	readonly subject: AgentSubjectCurrentnessBinding;
	readonly unresolvedDependencyRefs: readonly string[];
}

export interface AgentOperationProgress {
	readonly completedUnits: number;
	readonly progressRef: string;
	readonly stageRef: string;
	readonly totalUnits: number;
	readonly unitKind: string;
}

export type AgentContinuation =
	| { readonly kind: 'NONE'; readonly reasonCode: string }
	| { readonly kind: 'TOKEN'; readonly tokenDigest: string; readonly tokenRef: string };

export interface AgentPartialResult {
	readonly admittedResultRefs: readonly string[];
	readonly causeRefs: readonly string[];
	readonly completedRegionRefs: readonly string[];
	readonly continuation: AgentContinuation;
	readonly failedRegionRefs: readonly string[];
	readonly missingRegionRefs: readonly string[];
	readonly withheldRegionRefs: readonly string[];
}

export type AgentRefusalReasonCode =
	| 'INVALID_REQUEST'
	| 'UNIMPLEMENTED_CAPABILITY'
	| 'SUBJECT_UNRESOLVED'
	| 'CAPABILITY_UNAVAILABLE'
	| 'CURRENTNESS_UNSATISFIED'
	| 'PROVENANCE_INSUFFICIENT'
	| 'BUDGET_REFUSED'
	| 'AUTHORIZATION_REFUSED'
	| 'CONFLICT_REQUIRES_ESCALATION'
	| 'CANCELLED'
	| 'TIMED_OUT'
	| 'INTERNAL_FAILURE';

export type AgentTypedErrorCode =
	| 'CSAA-E-REQUEST-MALFORMED'
	| 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION'
	| 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION'
	| 'CSAA-E-REQUEST-INVALID-PARAMETER'
	| 'CSAA-E-AUTH-UNAUTHORIZED'
	| 'CSAA-E-SUBJECT-UNIDENTIFIED'
	| 'CSAA-E-SUBJECT-UNAVAILABLE'
	| 'CSAA-E-SUBJECT-STALE'
	| 'CSAA-E-SUBJECT-MIXED-REVISION'
	| 'CSAA-E-CAPABILITY-UNSUPPORTED'
	| 'CSAA-E-CAPABILITY-PARTIAL'
	| 'CSAA-E-CAPABILITY-NOT-ANALYZED'
	| 'CSAA-E-PROVIDER-DISAGREEMENT'
	| 'CSAA-E-EXECUTION-TIMED-OUT'
	| 'CSAA-E-EXECUTION-CANCELLED'
	| 'CSAA-E-EXECUTION-BUDGET-REFUSED'
	| 'CSAA-E-VALIDATION-PROVENANCE-GAP'
	| 'CSAA-E-INTERNAL-UNEXPECTED';

export interface AgentOperationRefusal {
	readonly attemptedEvidenceRefs: readonly string[];
	readonly blockedActionRef: string;
	readonly blockedClaimRefs: readonly string[];
	readonly code: AgentTypedErrorCode;
	readonly failedPredicateRef: string;
	readonly fallbackLimitRefs: readonly string[];
	readonly provenanceRefs: readonly string[];
	readonly reasonCode: AgentRefusalReasonCode;
	readonly requiredNextActionRef: string;
	readonly residualRiskRef: string;
	readonly responsibleOwnerRef: string;
	readonly retryability: 'RETRYABLE' | 'NOT_RETRYABLE' | 'UNKNOWN';
	readonly unaffectedScopeRefs: readonly string[];
}

export type AgentExitCategory =
	| 'IN_PROGRESS'
	| 'SUCCESS'
	| 'INVALID_REQUEST'
	| 'INCOMPLETE_OR_UNSUPPORTED'
	| 'FAILED_EXPECTATION'
	| 'INTERNAL_FAILURE';

interface AgentOperationResponseBase {
	readonly capability: AgentCapabilityStatus;
	readonly currentness: AgentCurrentnessStatus;
	readonly messageKind: 'response';
	readonly operation: AgentOperation;
	readonly operationVersion: (typeof AGENT_OPERATION_VERSIONS)[AgentOperation];
	readonly protocolVersion: typeof AGENT_OPERATION_PROTOCOL_VERSION;
	readonly requestDigest: string;
	readonly requestId: string;
	readonly responseAt: string;
	readonly responseId: string;
	readonly subjectResolution: AgentSubjectResolutionOutcome;
	readonly warningRefs: readonly string[];
}

export interface AgentOperationProgressResponse extends AgentOperationResponseBase {
	readonly exitCategory: 'IN_PROGRESS';
	readonly outcome: 'progress';
	readonly progress: AgentOperationProgress;
	readonly state: 'requested' | 'accepted' | 'running';
}

export interface AgentOperationSuccessResponse extends AgentOperationResponseBase {
	readonly exitCategory: 'SUCCESS';
	readonly outcome: 'success';
	readonly result: { readonly resultDigest: string; readonly resultRef: string };
	readonly state: 'succeeded';
}

export interface AgentOperationPartialResponse extends AgentOperationResponseBase {
	readonly exitCategory: 'INCOMPLETE_OR_UNSUPPORTED';
	readonly outcome: 'partial';
	readonly partial: AgentPartialResult;
	readonly state: 'partial';
}

export interface AgentOperationErrorResponse extends AgentOperationResponseBase {
	readonly exitCategory: Exclude<AgentExitCategory, 'IN_PROGRESS' | 'SUCCESS'>;
	readonly outcome: 'error';
	readonly refusal: AgentOperationRefusal;
	readonly state:
		| 'failed'
		| 'cancelled'
		| 'timed-out'
		| 'resource-refused'
		| 'authorization-refused'
		| 'incompatible'
		| 'unknown';
}

export type AgentOperationResponse =
	| AgentOperationProgressResponse
	| AgentOperationSuccessResponse
	| AgentOperationPartialResponse
	| AgentOperationErrorResponse;

export type AgentProtocolMessage = AgentOperationRequest | AgentOperationResponse;

export type AgentProtocolValidationCode =
	| 'MESSAGE_INVALID'
	| 'PROTOCOL_UNSUPPORTED'
	| 'OPERATION_UNSUPPORTED'
	| 'BUDGET_REFUSED'
	| 'CURRENTNESS_INVALID'
	| 'CAPABILITY_INVALID'
	| 'EXCHANGE_MISMATCH'
	| 'SERIALIZATION_BUDGET_EXCEEDED'
	| 'INTERNAL_VALIDATION_FAILED';

export interface AgentProtocolValidationDiagnostic {
	readonly code: AgentProtocolValidationCode;
	readonly phase: 'VALIDATE_MESSAGE' | 'VALIDATE_EXCHANGE' | 'SERIALIZE';
	readonly safeSummary: string;
}

export type AgentProtocolValidationOutcome<Value> =
	| { readonly state: 'VALID'; readonly value: Value }
	| { readonly diagnostic: AgentProtocolValidationDiagnostic; readonly state: 'REFUSED' };

export type AgentProtocolSerializationOutcome =
	| {
			readonly bytes: number;
			readonly digest: string;
			readonly json: string;
			readonly message: AgentProtocolMessage;
			readonly state: 'SERIALIZED';
	  }
	| { readonly diagnostic: AgentProtocolValidationDiagnostic; readonly state: 'REFUSED' };

const OPERATIONS = new Set<AgentOperation>(
	Object.keys(AGENT_OPERATION_VERSIONS) as AgentOperation[]
);
const EMPLOYMENT_POINTS = new Set<AgentEmploymentPoint>([
	'REPOSITORY_INTAKE',
	'BEFORE_DESIGN',
	'BEFORE_PLANNING',
	'DURING_IMPLEMENTATION',
	'AFTER_COHERENT_INCREMENT',
	'LOCAL_PRE_COMMIT_CHECKPOINT',
	'BEFORE_MERGE',
	'REGRESSION_ANALYSIS',
	'BEFORE_COMPLETION',
	'REFACTORING',
	'DEFECT_INVESTIGATION',
	'SECURITY_WORK',
	'HANDOFF'
]);
const COVERAGE = new Set<AgentCapabilityCoverage>([
	'supported',
	'partial',
	'unsupported',
	'excluded',
	'not-analyzed'
]);
const EXECUTION_HEALTH = new Set<AgentExecutionHealth>([
	'succeeded',
	'failed',
	'timed-out',
	'cancelled',
	'resource-exhausted',
	'malformed-output',
	'unavailable',
	'not-run'
]);
const CONFLICT = new Set<AgentConflictState>([
	'unopposed',
	'corroborated',
	'conflicting',
	'corrected',
	'superseded'
]);
const CURRENTNESS = new Set<AgentCurrentnessState>([
	'current-for-subject',
	'stale',
	'invalidated',
	'unknown'
]);
const MAX_REFERENCE_CHARACTERS = 1_024;
const MAX_REASON_CODE_CHARACTERS = 128;
const SHA256 = /^[0-9a-f]{64}$/u;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._~:/@#-]*$/u;
const REASON_CODE = /^[A-Z][A-Z0-9_]*$/u;
const RFC3339_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type ValidationPhase = AgentProtocolValidationDiagnostic['phase'];

class AgentProtocolRefusal extends Error {
	readonly code: AgentProtocolValidationCode;
	readonly phase: ValidationPhase;

	constructor(code: AgentProtocolValidationCode, phase: ValidationPhase, safeSummary: string) {
		super(safeSummary);
		this.code = code;
		this.phase = phase;
	}
}

interface InspectedObject {
	readonly values: ReadonlyMap<string, unknown>;
}

function refuse(
	code: AgentProtocolValidationCode,
	phase: ValidationPhase,
	safeSummary: string
): never {
	throw new AgentProtocolRefusal(code, phase, safeSummary);
}

function deepFreezeConstructed<Value>(value: Value): Value {
	if (value === null || typeof value !== 'object') return value;
	const seen = new WeakSet<object>();
	const stack: object[] = [value];
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !('value' in descriptor)) continue;
			const child = descriptor.value;
			if (child !== null && typeof child === 'object') stack.push(child);
		}
		Object.freeze(current);
	}
	return value;
}

function isUnicodeScalarString(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

function inspectObject(value: unknown, safeSummary: string): InspectedObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
	const values = new Map<string, unknown>();
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string') refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
		values.set(key, descriptor.value);
	}
	return { values };
}

function exactKeys(inspected: InspectedObject, keys: readonly string[], safeSummary: string): void {
	if (inspected.values.size !== keys.length)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
	for (const key of keys)
		if (!inspected.values.has(key)) refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
}

function requiredReference(inspected: InspectedObject, key: string): string {
	const value = inspected.values.get(key);
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_REFERENCE_CHARACTERS ||
		!isUnicodeScalarString(value) ||
		!REFERENCE.test(value)
	)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A protocol reference is invalid.');
	return value;
}

function requiredReasonCode(inspected: InspectedObject, key: string): string {
	const value = inspected.values.get(key);
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_REASON_CODE_CHARACTERS ||
		!REASON_CODE.test(value)
	)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A protocol reason code is invalid.');
	return value;
}

function requiredDigest(inspected: InspectedObject, key: string): string {
	const value = inspected.values.get(key);
	if (typeof value !== 'string' || !SHA256.test(value))
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A SHA-256 digest is invalid.');
	return value;
}

function requiredTimestamp(inspected: InspectedObject, key: string): string {
	const value = inspected.values.get(key);
	if (
		typeof value !== 'string' ||
		!RFC3339_MILLISECONDS.test(value) ||
		!Number.isFinite(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A protocol timestamp is invalid.');
	return value;
}

function requiredEnum<Value extends string>(
	inspected: InspectedObject,
	key: string,
	values: ReadonlySet<Value>,
	safeSummary: string
): Value {
	const value = inspected.values.get(key);
	if (typeof value !== 'string' || !values.has(value as Value))
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', safeSummary);
	return value as Value;
}

function requiredSafeInteger(
	inspected: InspectedObject,
	key: string,
	minimum: number,
	maximum: number,
	code: AgentProtocolValidationCode = 'MESSAGE_INVALID'
): number {
	const value = inspected.values.get(key);
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		Object.is(value, -0) ||
		value < minimum ||
		value > maximum
	)
		refuse(code, 'VALIDATE_MESSAGE', 'A numeric protocol limit is invalid.');
	return value;
}

function referenceSet(value: unknown, options: { readonly nonempty?: boolean } = {}): string[] {
	if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A reference collection is invalid.');
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (lengthDescriptor === undefined || !('value' in lengthDescriptor))
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A reference collection is invalid.');
	const lengthValue = lengthDescriptor.value;
	if (
		typeof lengthValue !== 'number' ||
		!Number.isSafeInteger(lengthValue) ||
		lengthValue < (options.nonempty === true ? 1 : 0) ||
		lengthValue > AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxReferenceCount ||
		Reflect.ownKeys(value).length !== lengthValue + 1
	)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A reference collection is invalid.');
	const result: string[] = [];
	for (let index = 0; index < lengthValue; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A reference collection is invalid.');
		const item = descriptor.value;
		if (
			typeof item !== 'string' ||
			item.length === 0 ||
			item.length > MAX_REFERENCE_CHARACTERS ||
			!isUnicodeScalarString(item) ||
			!REFERENCE.test(item)
		)
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A reference collection is invalid.');
		if (index > 0 && result[index - 1]! >= item)
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'Reference sets must be strictly sorted and duplicate-free.'
			);
		result.push(item);
	}
	return result;
}

function validateChangeContract(value: unknown): AgentChangeContractBinding {
	const inspected = inspectObject(value, 'The change-contract binding is invalid.');
	const kind = inspected.values.get('kind');
	if (kind === 'REFERENCE') {
		exactKeys(inspected, ['changeContractRef', 'kind'], 'The change-contract binding is invalid.');
		return { changeContractRef: requiredReference(inspected, 'changeContractRef'), kind };
	}
	if (kind === 'NOT_APPLICABLE') {
		exactKeys(inspected, ['kind', 'reasonCode'], 'The change-contract binding is invalid.');
		return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The change-contract binding is invalid.');
}

function validateWorkContext(value: unknown): AgentWorkContext {
	const inspected = inspectObject(value, 'The agent work context is invalid.');
	exactKeys(
		inspected,
		[
			'agentId',
			'authorityEnvelopeRef',
			'changeContract',
			'employmentPoint',
			'userRequestDigest',
			'workPackageRef'
		],
		'The agent work context is invalid.'
	);
	return {
		agentId: requiredReference(inspected, 'agentId'),
		authorityEnvelopeRef: requiredReference(inspected, 'authorityEnvelopeRef'),
		changeContract: validateChangeContract(inspected.values.get('changeContract')),
		employmentPoint: requiredEnum(
			inspected,
			'employmentPoint',
			EMPLOYMENT_POINTS,
			'The employment point is invalid.'
		),
		userRequestDigest: requiredDigest(inspected, 'userRequestDigest'),
		workPackageRef: requiredReference(inspected, 'workPackageRef')
	};
}

function validateBudgets(value: unknown): AgentProtocolResourceBudget {
	const inspected = inspectObject(value, 'The resource budget is invalid.');
	exactKeys(
		inspected,
		['maxDepth', 'maxEdges', 'maxNodes', 'maxOutputBytes', 'maxResults', 'timeoutMs'],
		'The resource budget is invalid.'
	);
	return {
		maxDepth: requiredSafeInteger(
			inspected,
			'maxDepth',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxDepth,
			'BUDGET_REFUSED'
		),
		maxEdges: requiredSafeInteger(
			inspected,
			'maxEdges',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxEdges,
			'BUDGET_REFUSED'
		),
		maxNodes: requiredSafeInteger(
			inspected,
			'maxNodes',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxNodes,
			'BUDGET_REFUSED'
		),
		maxOutputBytes: requiredSafeInteger(
			inspected,
			'maxOutputBytes',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxOutputBytes,
			'BUDGET_REFUSED'
		),
		maxResults: requiredSafeInteger(
			inspected,
			'maxResults',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxResults,
			'BUDGET_REFUSED'
		),
		timeoutMs: requiredSafeInteger(
			inspected,
			'timeoutMs',
			1,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxTimeoutMs,
			'BUDGET_REFUSED'
		)
	};
}

function validateSubjectInput(value: unknown): AgentSubjectInput {
	const inspected = inspectObject(value, 'The subject input is invalid.');
	const kind = inspected.values.get('kind');
	switch (kind) {
		case 'RESOLVED_SUBJECT':
			exactKeys(inspected, ['kind', 'subjectId'], 'The resolved subject input is invalid.');
			return { kind, subjectId: requiredReference(inspected, 'subjectId') };
		case 'SUBJECT_LOCATOR':
			exactKeys(
				inspected,
				['kind', 'locatorDigest', 'locatorRef', 'resolutionPolicyRef'],
				'The subject locator input is invalid.'
			);
			return {
				kind,
				locatorDigest: requiredDigest(inspected, 'locatorDigest'),
				locatorRef: requiredReference(inspected, 'locatorRef'),
				resolutionPolicyRef: requiredReference(inspected, 'resolutionPolicyRef')
			};
		case 'SCOPED_TARGET':
			exactKeys(
				inspected,
				['kind', 'scopeRef', 'targetPopulationRefs'],
				'The scoped target input is invalid.'
			);
			return {
				kind,
				scopeRef: requiredReference(inspected, 'scopeRef'),
				targetPopulationRefs: referenceSet(inspected.values.get('targetPopulationRefs'), {
					nonempty: true
				})
			};
		case 'TARGET_RECORD':
			exactKeys(inspected, ['kind', 'targetRecordRef'], 'The target record input is invalid.');
			return { kind, targetRecordRef: requiredReference(inspected, 'targetRecordRef') };
		case 'NOT_APPLICABLE':
			exactKeys(inspected, ['kind', 'reasonCode'], 'The subject input is invalid.');
			return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
		default:
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The subject input discriminator is invalid.');
	}
}

const OPERATION_SUBJECT_POLICY: Readonly<Record<AgentOperation, ReadonlySet<string>>> =
	Object.freeze({
		explain: new Set(['RESOLVED_SUBJECT', 'TARGET_RECORD']),
		findings: new Set(['RESOLVED_SUBJECT', 'SCOPED_TARGET']),
		impact: new Set(['RESOLVED_SUBJECT', 'SCOPED_TARGET', 'TARGET_RECORD']),
		inventory: new Set(['RESOLVED_SUBJECT', 'SUBJECT_LOCATOR']),
		query: new Set(['RESOLVED_SUBJECT', 'TARGET_RECORD']),
		snapshot: new Set(['RESOLVED_SUBJECT', 'SUBJECT_LOCATOR']),
		verify: new Set(['RESOLVED_SUBJECT', 'SUBJECT_LOCATOR'])
	});

function validateCurrentnessRequirement(value: unknown): AgentCurrentnessRequirement {
	const inspected = inspectObject(value, 'The currentness requirement is invalid.');
	const kind = inspected.values.get('kind');
	if (kind === 'REQUIRE_CURRENT') {
		exactKeys(inspected, ['kind'], 'The currentness requirement is invalid.');
		return { kind };
	}
	if (kind === 'REQUIRE_EXACT_SUBJECT') {
		exactKeys(inspected, ['kind', 'subjectId'], 'The currentness requirement is invalid.');
		return { kind, subjectId: requiredReference(inspected, 'subjectId') };
	}
	if (kind === 'ALLOW_HISTORICAL') {
		exactKeys(inspected, ['kind', 'rationaleRef'], 'The currentness requirement is invalid.');
		return { kind, rationaleRef: requiredReference(inspected, 'rationaleRef') };
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The currentness requirement is invalid.');
}

function validateCapabilityRequirement(value: unknown): AgentCapabilityRequirement {
	const inspected = inspectObject(value, 'The capability requirement is invalid.');
	exactKeys(
		inspected,
		['affectedQuestionRefs', 'capabilityId', 'capabilityVersion', 'necessity'],
		'The capability requirement is invalid.'
	);
	return {
		affectedQuestionRefs: referenceSet(inspected.values.get('affectedQuestionRefs'), {
			nonempty: true
		}),
		capabilityId: requiredReference(inspected, 'capabilityId'),
		capabilityVersion: requiredReference(inspected, 'capabilityVersion'),
		necessity: requiredEnum(
			inspected,
			'necessity',
			new Set(['MANDATORY', 'DISCRETIONARY'] as const),
			'The capability necessity is invalid.'
		)
	};
}

function validateOperationInput(value: unknown): AgentOperationInputBinding {
	const inspected = inspectObject(value, 'The operation-input binding is invalid.');
	exactKeys(
		inspected,
		['contractId', 'contractVersion', 'inputDigest', 'inputRef'],
		'The operation-input binding is invalid.'
	);
	return {
		contractId: requiredReference(inspected, 'contractId'),
		contractVersion: requiredReference(inspected, 'contractVersion'),
		inputDigest: requiredDigest(inspected, 'inputDigest'),
		inputRef: requiredReference(inspected, 'inputRef')
	};
}

function validateRequestInternal(value: unknown): AgentOperationRequest {
	const inspected = inspectObject(value, 'The operation request envelope is invalid.');
	exactKeys(
		inspected,
		[
			'budgets',
			'capabilityRequirement',
			'currentnessRequirement',
			'messageKind',
			'operation',
			'operationInput',
			'operationVersion',
			'protocolVersion',
			'requestId',
			'requestedAt',
			'subjectInput',
			'work'
		],
		'The operation request envelope is invalid.'
	);
	if (inspected.values.get('messageKind') !== 'request')
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The request message kind is invalid.');
	if (inspected.values.get('protocolVersion') !== AGENT_OPERATION_PROTOCOL_VERSION)
		refuse(
			'PROTOCOL_UNSUPPORTED',
			'VALIDATE_MESSAGE',
			'The agent protocol version is unsupported.'
		);
	const operation = requiredEnum(
		inspected,
		'operation',
		OPERATIONS,
		'The requested operation is unsupported.'
	);
	if (inspected.values.get('operationVersion') !== AGENT_OPERATION_VERSIONS[operation])
		refuse('OPERATION_UNSUPPORTED', 'VALIDATE_MESSAGE', 'The operation version is unsupported.');
	const subjectInput = validateSubjectInput(inspected.values.get('subjectInput'));
	if (!OPERATION_SUBJECT_POLICY[operation].has(subjectInput.kind))
		refuse(
			'MESSAGE_INVALID',
			'VALIDATE_MESSAGE',
			'The subject input is invalid for the operation.'
		);
	return {
		budgets: validateBudgets(inspected.values.get('budgets')),
		capabilityRequirement: validateCapabilityRequirement(
			inspected.values.get('capabilityRequirement')
		),
		currentnessRequirement: validateCurrentnessRequirement(
			inspected.values.get('currentnessRequirement')
		),
		messageKind: 'request',
		operation,
		operationInput: validateOperationInput(inspected.values.get('operationInput')),
		operationVersion: AGENT_OPERATION_VERSIONS[operation],
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestId: requiredReference(inspected, 'requestId'),
		requestedAt: requiredTimestamp(inspected, 'requestedAt'),
		subjectInput,
		work: validateWorkContext(inspected.values.get('work'))
	};
}

function validateSubjectResolution(value: unknown): AgentSubjectResolutionOutcome {
	const inspected = inspectObject(value, 'The subject-resolution outcome is invalid.');
	const kind = inspected.values.get('kind');
	switch (kind) {
		case 'RESOLVED':
			exactKeys(
				inspected,
				['kind', 'resolutionEvidenceRefs', 'subjectId'],
				'The resolved-subject outcome is invalid.'
			);
			return {
				kind,
				resolutionEvidenceRefs: referenceSet(inspected.values.get('resolutionEvidenceRefs'), {
					nonempty: true
				}),
				subjectId: requiredReference(inspected, 'subjectId')
			};
		case 'NOT_FOUND':
			exactKeys(
				inspected,
				['kind', 'locatorDigest', 'reasonCode'],
				'The subject-not-found outcome is invalid.'
			);
			return {
				kind,
				locatorDigest: requiredDigest(inspected, 'locatorDigest'),
				reasonCode: requiredReasonCode(inspected, 'reasonCode')
			};
		case 'AMBIGUOUS': {
			exactKeys(
				inspected,
				['candidateDisclosure', 'kind'],
				'The ambiguous-subject outcome is invalid.'
			);
			const disclosure = inspectObject(
				inspected.values.get('candidateDisclosure'),
				'The candidate disclosure is invalid.'
			);
			const disclosureKind = disclosure.values.get('kind');
			if (disclosureKind === 'AUTHORIZED_REFERENCES') {
				exactKeys(disclosure, ['candidateRefs', 'kind'], 'The candidate disclosure is invalid.');
				return {
					candidateDisclosure: {
						candidateRefs: referenceSet(disclosure.values.get('candidateRefs'), {
							nonempty: true
						}),
						kind: disclosureKind
					},
					kind
				};
			}
			if (disclosureKind === 'WITHHELD_COUNT') {
				exactKeys(
					disclosure,
					['kind', 'withheldCandidateCount'],
					'The candidate disclosure is invalid.'
				);
				return {
					candidateDisclosure: {
						kind: disclosureKind,
						withheldCandidateCount: requiredSafeInteger(
							disclosure,
							'withheldCandidateCount',
							1,
							Number.MAX_SAFE_INTEGER
						)
					},
					kind
				};
			}
			return refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The candidate disclosure is invalid.');
		}
		case 'FORBIDDEN':
			exactKeys(
				inspected,
				['accessDecisionRef', 'kind'],
				'The forbidden-subject outcome is invalid.'
			);
			return { accessDecisionRef: requiredReference(inspected, 'accessDecisionRef'), kind };
		case 'UNAVAILABLE':
			exactKeys(
				inspected,
				['diagnosticRefs', 'kind', 'retryState'],
				'The unavailable-subject outcome is invalid.'
			);
			return {
				diagnosticRefs: referenceSet(inspected.values.get('diagnosticRefs'), { nonempty: true }),
				kind,
				retryState: requiredEnum(
					inspected,
					'retryState',
					new Set(['RETRYABLE', 'NOT_RETRYABLE', 'UNKNOWN'] as const),
					'The subject retry state is invalid.'
				)
			};
		case 'INCOMPATIBLE':
			exactKeys(
				inspected,
				['compatibilityDecisionRef', 'kind'],
				'The incompatible-subject outcome is invalid.'
			);
			return {
				compatibilityDecisionRef: requiredReference(inspected, 'compatibilityDecisionRef'),
				kind
			};
		case 'NOT_APPLICABLE':
			exactKeys(inspected, ['kind', 'reasonCode'], 'The subject-resolution outcome is invalid.');
			return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
		default:
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The subject-resolution outcome is invalid.');
	}
}

function validateCapabilityStatus(value: unknown): AgentCapabilityStatus {
	const inspected = inspectObject(value, 'The capability status is invalid.');
	exactKeys(
		inspected,
		[
			'affectedQuestionRefs',
			'capabilityCoverage',
			'capabilityId',
			'capabilityVersion',
			'conflict',
			'conflictRefs',
			'coverageRefs',
			'excludedRegionRefs',
			'executionHealth',
			'implementationState',
			'limitationRefs',
			'provenanceRefs',
			'providerRefs',
			'qualificationState',
			'unknownRegionRefs'
		],
		'The capability status is invalid.'
	);
	const result: AgentCapabilityStatus = {
		affectedQuestionRefs: referenceSet(inspected.values.get('affectedQuestionRefs'), {
			nonempty: true
		}),
		capabilityCoverage: requiredEnum(
			inspected,
			'capabilityCoverage',
			COVERAGE,
			'The capability coverage is invalid.'
		),
		capabilityId: requiredReference(inspected, 'capabilityId'),
		capabilityVersion: requiredReference(inspected, 'capabilityVersion'),
		conflict: requiredEnum(
			inspected,
			'conflict',
			CONFLICT,
			'The capability conflict state is invalid.'
		),
		conflictRefs: referenceSet(inspected.values.get('conflictRefs')),
		coverageRefs: referenceSet(inspected.values.get('coverageRefs')),
		excludedRegionRefs: referenceSet(inspected.values.get('excludedRegionRefs')),
		executionHealth: requiredEnum(
			inspected,
			'executionHealth',
			EXECUTION_HEALTH,
			'The capability execution health is invalid.'
		),
		implementationState: requiredEnum(
			inspected,
			'implementationState',
			new Set(['IMPLEMENTED', 'UNIMPLEMENTED'] as const),
			'The capability implementation state is invalid.'
		),
		limitationRefs: referenceSet(inspected.values.get('limitationRefs')),
		provenanceRefs: referenceSet(inspected.values.get('provenanceRefs'), { nonempty: true }),
		providerRefs: referenceSet(inspected.values.get('providerRefs')),
		qualificationState: requiredEnum(
			inspected,
			'qualificationState',
			new Set(['QUALIFIED', 'NONPASS', 'UNKNOWN', 'NOT_APPLICABLE'] as const),
			'The capability qualification state is invalid.'
		),
		unknownRegionRefs: referenceSet(inspected.values.get('unknownRegionRefs'))
	};
	if (result.capabilityCoverage === 'supported' && result.coverageRefs.length === 0)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Supported capability coverage needs evidence.'
		);
	if (
		result.capabilityCoverage === 'partial' &&
		result.unknownRegionRefs.length === 0 &&
		result.excludedRegionRefs.length === 0 &&
		result.limitationRefs.length === 0
	)
		refuse('CAPABILITY_INVALID', 'VALIDATE_MESSAGE', 'Partial capability coverage needs limits.');
	if (result.capabilityCoverage === 'unsupported' && result.limitationRefs.length === 0)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Unsupported capability coverage needs limits.'
		);
	if (result.capabilityCoverage === 'excluded' && result.excludedRegionRefs.length === 0)
		refuse('CAPABILITY_INVALID', 'VALIDATE_MESSAGE', 'Excluded capability coverage needs regions.');
	if (
		result.capabilityCoverage === 'not-analyzed' &&
		result.unknownRegionRefs.length === 0 &&
		result.limitationRefs.length === 0
	)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Not-analyzed coverage needs an explicit gap.'
		);
	if (result.conflict === 'conflicting' && result.conflictRefs.length === 0)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Conflicting capability evidence needs references.'
		);
	if (result.conflict === 'unopposed' && result.conflictRefs.length !== 0)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Unopposed capability evidence cannot hide conflicts.'
		);
	if (
		result.implementationState === 'UNIMPLEMENTED' &&
		(result.capabilityCoverage !== 'unsupported' ||
			result.executionHealth !== 'not-run' ||
			(result.qualificationState !== 'UNKNOWN' && result.qualificationState !== 'NOT_APPLICABLE'))
	)
		refuse(
			'CAPABILITY_INVALID',
			'VALIDATE_MESSAGE',
			'Unimplemented capability status must remain unsupported and not run.'
		);
	return result;
}

function validateSubjectCurrentnessBinding(value: unknown): AgentSubjectCurrentnessBinding {
	const inspected = inspectObject(value, 'The currentness subject binding is invalid.');
	const kind = inspected.values.get('kind');
	if (kind === 'SUBJECT') {
		exactKeys(inspected, ['kind', 'subjectId'], 'The currentness subject binding is invalid.');
		return { kind, subjectId: requiredReference(inspected, 'subjectId') };
	}
	if (kind === 'NOT_APPLICABLE') {
		exactKeys(inspected, ['kind', 'reasonCode'], 'The currentness subject binding is invalid.');
		return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The currentness subject binding is invalid.');
}

function validateSnapshotCurrentnessBinding(value: unknown): AgentSnapshotCurrentnessBinding {
	const inspected = inspectObject(value, 'The currentness snapshot binding is invalid.');
	const kind = inspected.values.get('kind');
	if (kind === 'SNAPSHOT') {
		exactKeys(inspected, ['kind', 'snapshotId'], 'The currentness snapshot binding is invalid.');
		return { kind, snapshotId: requiredReference(inspected, 'snapshotId') };
	}
	if (kind === 'NOT_APPLICABLE') {
		exactKeys(inspected, ['kind', 'reasonCode'], 'The currentness snapshot binding is invalid.');
		return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The currentness snapshot binding is invalid.');
}

function validateCurrentnessStatus(
	value: unknown,
	subjectResolution: AgentSubjectResolutionOutcome
): AgentCurrentnessStatus {
	const inspected = inspectObject(value, 'The currentness status is invalid.');
	exactKeys(
		inspected,
		[
			'freshnessEvidenceRefs',
			'invalidationRefs',
			'observationCutoffRef',
			'snapshot',
			'status',
			'subject',
			'unresolvedDependencyRefs'
		],
		'The currentness status is invalid.'
	);
	const result: AgentCurrentnessStatus = {
		freshnessEvidenceRefs: referenceSet(inspected.values.get('freshnessEvidenceRefs')),
		invalidationRefs: referenceSet(inspected.values.get('invalidationRefs')),
		observationCutoffRef: requiredReference(inspected, 'observationCutoffRef'),
		snapshot: validateSnapshotCurrentnessBinding(inspected.values.get('snapshot')),
		status: requiredEnum(inspected, 'status', CURRENTNESS, 'The currentness state is invalid.'),
		subject: validateSubjectCurrentnessBinding(inspected.values.get('subject')),
		unresolvedDependencyRefs: referenceSet(inspected.values.get('unresolvedDependencyRefs'))
	};
	if (subjectResolution.kind === 'RESOLVED') {
		if (
			result.subject.kind !== 'SUBJECT' ||
			result.subject.subjectId !== subjectResolution.subjectId
		)
			refuse(
				'CURRENTNESS_INVALID',
				'VALIDATE_MESSAGE',
				'Currentness must bind the exact resolved subject.'
			);
	} else if (
		result.subject.kind !== 'NOT_APPLICABLE' ||
		result.snapshot.kind !== 'NOT_APPLICABLE' ||
		result.status !== 'unknown'
	)
		refuse(
			'CURRENTNESS_INVALID',
			'VALIDATE_MESSAGE',
			'An unresolved subject cannot carry a currentness claim.'
		);
	if (
		result.status === 'current-for-subject' &&
		(result.freshnessEvidenceRefs.length === 0 ||
			result.invalidationRefs.length !== 0 ||
			result.unresolvedDependencyRefs.length !== 0)
	)
		refuse(
			'CURRENTNESS_INVALID',
			'VALIDATE_MESSAGE',
			'Currentness needs positive evidence and no invalidation or unresolved dependency.'
		);
	if (result.status === 'invalidated' && result.invalidationRefs.length === 0)
		refuse(
			'CURRENTNESS_INVALID',
			'VALIDATE_MESSAGE',
			'Invalidated state needs invalidation evidence.'
		);
	if (
		result.status === 'stale' &&
		result.invalidationRefs.length === 0 &&
		result.unresolvedDependencyRefs.length === 0
	)
		refuse('CURRENTNESS_INVALID', 'VALIDATE_MESSAGE', 'Stale state needs a stale basis.');
	if (
		result.status === 'unknown' &&
		subjectResolution.kind === 'RESOLVED' &&
		result.unresolvedDependencyRefs.length === 0
	)
		refuse(
			'CURRENTNESS_INVALID',
			'VALIDATE_MESSAGE',
			'Unknown currentness needs an unresolved basis.'
		);
	return result;
}

function validateProgress(value: unknown): AgentOperationProgress {
	const inspected = inspectObject(value, 'The operation progress is invalid.');
	exactKeys(
		inspected,
		['completedUnits', 'progressRef', 'stageRef', 'totalUnits', 'unitKind'],
		'The operation progress is invalid.'
	);
	const result: AgentOperationProgress = {
		completedUnits: requiredSafeInteger(inspected, 'completedUnits', 0, Number.MAX_SAFE_INTEGER),
		progressRef: requiredReference(inspected, 'progressRef'),
		stageRef: requiredReference(inspected, 'stageRef'),
		totalUnits: requiredSafeInteger(inspected, 'totalUnits', 0, Number.MAX_SAFE_INTEGER),
		unitKind: requiredReasonCode(inspected, 'unitKind')
	};
	if (result.completedUnits > result.totalUnits)
		refuse(
			'MESSAGE_INVALID',
			'VALIDATE_MESSAGE',
			'Completed progress cannot exceed total progress.'
		);
	return result;
}

function validateContinuation(value: unknown): AgentContinuation {
	const inspected = inspectObject(value, 'The continuation is invalid.');
	const kind = inspected.values.get('kind');
	if (kind === 'NONE') {
		exactKeys(inspected, ['kind', 'reasonCode'], 'The continuation is invalid.');
		return { kind, reasonCode: requiredReasonCode(inspected, 'reasonCode') };
	}
	if (kind === 'TOKEN') {
		exactKeys(inspected, ['kind', 'tokenDigest', 'tokenRef'], 'The continuation is invalid.');
		return {
			kind,
			tokenDigest: requiredDigest(inspected, 'tokenDigest'),
			tokenRef: requiredReference(inspected, 'tokenRef')
		};
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The continuation is invalid.');
}

function validatePartial(value: unknown): AgentPartialResult {
	const inspected = inspectObject(value, 'The partial result is invalid.');
	exactKeys(
		inspected,
		[
			'admittedResultRefs',
			'causeRefs',
			'completedRegionRefs',
			'continuation',
			'failedRegionRefs',
			'missingRegionRefs',
			'withheldRegionRefs'
		],
		'The partial result is invalid.'
	);
	const result: AgentPartialResult = {
		admittedResultRefs: referenceSet(inspected.values.get('admittedResultRefs')),
		causeRefs: referenceSet(inspected.values.get('causeRefs'), { nonempty: true }),
		completedRegionRefs: referenceSet(inspected.values.get('completedRegionRefs')),
		continuation: validateContinuation(inspected.values.get('continuation')),
		failedRegionRefs: referenceSet(inspected.values.get('failedRegionRefs')),
		missingRegionRefs: referenceSet(inspected.values.get('missingRegionRefs')),
		withheldRegionRefs: referenceSet(inspected.values.get('withheldRegionRefs'))
	};
	if (result.admittedResultRefs.length === 0 && result.completedRegionRefs.length === 0)
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'A partial result needs an admitted region.');
	if (
		result.failedRegionRefs.length === 0 &&
		result.missingRegionRefs.length === 0 &&
		result.withheldRegionRefs.length === 0
	)
		refuse(
			'MESSAGE_INVALID',
			'VALIDATE_MESSAGE',
			'A partial result needs an explicit omitted region.'
		);
	return result;
}

const REFUSAL_CODES = new Set<AgentTypedErrorCode>([
	'CSAA-E-REQUEST-MALFORMED',
	'CSAA-E-REQUEST-UNSUPPORTED-OPERATION',
	'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION',
	'CSAA-E-REQUEST-INVALID-PARAMETER',
	'CSAA-E-AUTH-UNAUTHORIZED',
	'CSAA-E-SUBJECT-UNIDENTIFIED',
	'CSAA-E-SUBJECT-UNAVAILABLE',
	'CSAA-E-SUBJECT-STALE',
	'CSAA-E-SUBJECT-MIXED-REVISION',
	'CSAA-E-CAPABILITY-UNSUPPORTED',
	'CSAA-E-CAPABILITY-PARTIAL',
	'CSAA-E-CAPABILITY-NOT-ANALYZED',
	'CSAA-E-PROVIDER-DISAGREEMENT',
	'CSAA-E-EXECUTION-TIMED-OUT',
	'CSAA-E-EXECUTION-CANCELLED',
	'CSAA-E-EXECUTION-BUDGET-REFUSED',
	'CSAA-E-VALIDATION-PROVENANCE-GAP',
	'CSAA-E-INTERNAL-UNEXPECTED'
]);
const REFUSAL_REASONS = new Set<AgentRefusalReasonCode>([
	'INVALID_REQUEST',
	'UNIMPLEMENTED_CAPABILITY',
	'SUBJECT_UNRESOLVED',
	'CAPABILITY_UNAVAILABLE',
	'CURRENTNESS_UNSATISFIED',
	'PROVENANCE_INSUFFICIENT',
	'BUDGET_REFUSED',
	'AUTHORIZATION_REFUSED',
	'CONFLICT_REQUIRES_ESCALATION',
	'CANCELLED',
	'TIMED_OUT',
	'INTERNAL_FAILURE'
]);

const ERROR_PROTOCOL_RULES: Readonly<
	Record<
		AgentTypedErrorCode,
		{
			readonly exitCategory: Exclude<AgentExitCategory, 'IN_PROGRESS' | 'SUCCESS'>;
			readonly reasons: ReadonlySet<string>;
			readonly state: AgentOperationErrorResponse['state'];
		}
	>
> = Object.freeze({
	'CSAA-E-AUTH-UNAUTHORIZED': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['AUTHORIZATION_REFUSED']),
		state: 'authorization-refused'
	},
	'CSAA-E-CAPABILITY-NOT-ANALYZED': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CAPABILITY_UNAVAILABLE', 'UNIMPLEMENTED_CAPABILITY']),
		state: 'failed'
	},
	'CSAA-E-CAPABILITY-PARTIAL': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CAPABILITY_UNAVAILABLE']),
		state: 'failed'
	},
	'CSAA-E-CAPABILITY-UNSUPPORTED': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CAPABILITY_UNAVAILABLE', 'UNIMPLEMENTED_CAPABILITY']),
		state: 'failed'
	},
	'CSAA-E-EXECUTION-BUDGET-REFUSED': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['BUDGET_REFUSED']),
		state: 'resource-refused'
	},
	'CSAA-E-EXECUTION-CANCELLED': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CANCELLED']),
		state: 'cancelled'
	},
	'CSAA-E-EXECUTION-TIMED-OUT': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['TIMED_OUT']),
		state: 'timed-out'
	},
	'CSAA-E-INTERNAL-UNEXPECTED': {
		exitCategory: 'INTERNAL_FAILURE',
		reasons: new Set(['INTERNAL_FAILURE']),
		state: 'unknown'
	},
	'CSAA-E-PROVIDER-DISAGREEMENT': {
		exitCategory: 'FAILED_EXPECTATION',
		reasons: new Set(['CONFLICT_REQUIRES_ESCALATION']),
		state: 'incompatible'
	},
	'CSAA-E-REQUEST-INVALID-PARAMETER': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['INVALID_REQUEST']),
		state: 'failed'
	},
	'CSAA-E-REQUEST-MALFORMED': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['INVALID_REQUEST']),
		state: 'failed'
	},
	'CSAA-E-REQUEST-UNSUPPORTED-OPERATION': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['INVALID_REQUEST', 'UNIMPLEMENTED_CAPABILITY']),
		state: 'failed'
	},
	'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['INVALID_REQUEST']),
		state: 'incompatible'
	},
	'CSAA-E-SUBJECT-MIXED-REVISION': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CURRENTNESS_UNSATISFIED']),
		state: 'incompatible'
	},
	'CSAA-E-SUBJECT-STALE': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['CURRENTNESS_UNSATISFIED']),
		state: 'incompatible'
	},
	'CSAA-E-SUBJECT-UNAVAILABLE': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['SUBJECT_UNRESOLVED']),
		state: 'failed'
	},
	'CSAA-E-SUBJECT-UNIDENTIFIED': {
		exitCategory: 'INVALID_REQUEST',
		reasons: new Set(['SUBJECT_UNRESOLVED']),
		state: 'failed'
	},
	'CSAA-E-VALIDATION-PROVENANCE-GAP': {
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		reasons: new Set(['PROVENANCE_INSUFFICIENT']),
		state: 'incompatible'
	}
});

function validateRefusal(value: unknown): AgentOperationRefusal {
	const inspected = inspectObject(value, 'The operation refusal is invalid.');
	exactKeys(
		inspected,
		[
			'attemptedEvidenceRefs',
			'blockedActionRef',
			'blockedClaimRefs',
			'code',
			'failedPredicateRef',
			'fallbackLimitRefs',
			'provenanceRefs',
			'reasonCode',
			'requiredNextActionRef',
			'residualRiskRef',
			'responsibleOwnerRef',
			'retryability',
			'unaffectedScopeRefs'
		],
		'The operation refusal is invalid.'
	);
	const result: AgentOperationRefusal = {
		attemptedEvidenceRefs: referenceSet(inspected.values.get('attemptedEvidenceRefs'), {
			nonempty: true
		}),
		blockedActionRef: requiredReference(inspected, 'blockedActionRef'),
		blockedClaimRefs: referenceSet(inspected.values.get('blockedClaimRefs'), { nonempty: true }),
		code: requiredEnum(inspected, 'code', REFUSAL_CODES, 'The typed refusal code is invalid.'),
		failedPredicateRef: requiredReference(inspected, 'failedPredicateRef'),
		fallbackLimitRefs: referenceSet(inspected.values.get('fallbackLimitRefs'), { nonempty: true }),
		provenanceRefs: referenceSet(inspected.values.get('provenanceRefs'), { nonempty: true }),
		reasonCode: requiredEnum(
			inspected,
			'reasonCode',
			REFUSAL_REASONS,
			'The refusal reason is invalid.'
		),
		requiredNextActionRef: requiredReference(inspected, 'requiredNextActionRef'),
		residualRiskRef: requiredReference(inspected, 'residualRiskRef'),
		responsibleOwnerRef: requiredReference(inspected, 'responsibleOwnerRef'),
		retryability: requiredEnum(
			inspected,
			'retryability',
			new Set(['RETRYABLE', 'NOT_RETRYABLE', 'UNKNOWN'] as const),
			'The refusal retryability is invalid.'
		),
		unaffectedScopeRefs: referenceSet(inspected.values.get('unaffectedScopeRefs'))
	};
	if (!ERROR_PROTOCOL_RULES[result.code].reasons.has(result.reasonCode))
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The typed error and refusal reason conflict.');
	return result;
}

function validateSubjectResolutionErrorCompatibility(
	subjectResolution: AgentSubjectResolutionOutcome,
	refusal: AgentOperationRefusal
): void {
	const compatible =
		subjectResolution.kind === 'RESOLVED' ||
		(subjectResolution.kind === 'NOT_APPLICABLE' &&
			subjectResolution.reasonCode === 'OPERATION_INTERRUPTED_BEFORE_SUBJECT_RESOLUTION' &&
			(refusal.code === 'CSAA-E-EXECUTION-CANCELLED' ||
				refusal.code === 'CSAA-E-EXECUTION-TIMED-OUT')) ||
		((subjectResolution.kind === 'NOT_FOUND' || subjectResolution.kind === 'AMBIGUOUS') &&
			refusal.code === 'CSAA-E-SUBJECT-UNIDENTIFIED') ||
		(subjectResolution.kind === 'FORBIDDEN' && refusal.code === 'CSAA-E-AUTH-UNAUTHORIZED') ||
		(subjectResolution.kind === 'UNAVAILABLE' && refusal.code === 'CSAA-E-SUBJECT-UNAVAILABLE') ||
		(subjectResolution.kind === 'INCOMPATIBLE' &&
			(refusal.code === 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION' ||
				refusal.code === 'CSAA-E-SUBJECT-MIXED-REVISION' ||
				refusal.code === 'CSAA-E-PROVIDER-DISAGREEMENT')) ||
		(subjectResolution.kind === 'NOT_APPLICABLE' &&
			(refusal.code === 'CSAA-E-REQUEST-MALFORMED' ||
				refusal.code === 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION' ||
				refusal.code === 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION' ||
				refusal.code === 'CSAA-E-REQUEST-INVALID-PARAMETER' ||
				refusal.code === 'CSAA-E-INTERNAL-UNEXPECTED'));
	if (!compatible)
		refuse(
			'MESSAGE_INVALID',
			'VALIDATE_MESSAGE',
			'The subject-resolution outcome conflicts with the typed refusal.'
		);
}

function validateResponseInternal(value: unknown): AgentOperationResponse {
	const inspected = inspectObject(value, 'The operation response envelope is invalid.');
	const baseKeys = [
		'capability',
		'currentness',
		'exitCategory',
		'messageKind',
		'operation',
		'operationVersion',
		'outcome',
		'protocolVersion',
		'requestDigest',
		'requestId',
		'responseAt',
		'responseId',
		'state',
		'subjectResolution',
		'warningRefs'
	] as const;
	if (inspected.values.get('messageKind') !== 'response')
		refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The response message kind is invalid.');
	if (inspected.values.get('protocolVersion') !== AGENT_OPERATION_PROTOCOL_VERSION)
		refuse(
			'PROTOCOL_UNSUPPORTED',
			'VALIDATE_MESSAGE',
			'The agent protocol version is unsupported.'
		);
	const operation = requiredEnum(
		inspected,
		'operation',
		OPERATIONS,
		'The response operation is unsupported.'
	);
	if (inspected.values.get('operationVersion') !== AGENT_OPERATION_VERSIONS[operation])
		refuse(
			'OPERATION_UNSUPPORTED',
			'VALIDATE_MESSAGE',
			'The response operation version is unsupported.'
		);
	const subjectResolution = validateSubjectResolution(inspected.values.get('subjectResolution'));
	const capability = validateCapabilityStatus(inspected.values.get('capability'));
	const currentness = validateCurrentnessStatus(
		inspected.values.get('currentness'),
		subjectResolution
	);
	const common = {
		capability,
		currentness,
		messageKind: 'response' as const,
		operation,
		operationVersion: AGENT_OPERATION_VERSIONS[operation],
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestDigest: requiredDigest(inspected, 'requestDigest'),
		requestId: requiredReference(inspected, 'requestId'),
		responseAt: requiredTimestamp(inspected, 'responseAt'),
		responseId: requiredReference(inspected, 'responseId'),
		subjectResolution,
		warningRefs: referenceSet(inspected.values.get('warningRefs'))
	};
	const outcome = inspected.values.get('outcome');
	if (outcome === 'progress') {
		exactKeys(inspected, [...baseKeys, 'progress'], 'The progress response envelope is invalid.');
		const state = requiredEnum(
			inspected,
			'state',
			new Set(['requested', 'accepted', 'running'] as const),
			'The progress response state is invalid.'
		);
		if (inspected.values.get('exitCategory') !== 'IN_PROGRESS')
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The progress exit category is invalid.');
		if (subjectResolution.kind !== 'RESOLVED' && subjectResolution.kind !== 'NOT_APPLICABLE')
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'Progress cannot finalize subject-resolution failure.'
			);
		if (capability.executionHealth !== 'not-run')
			refuse(
				'CAPABILITY_INVALID',
				'VALIDATE_MESSAGE',
				'Progress cannot fabricate terminal health.'
			);
		return {
			...common,
			exitCategory: 'IN_PROGRESS',
			outcome,
			progress: validateProgress(inspected.values.get('progress')),
			state
		};
	}
	if (outcome === 'success') {
		exactKeys(inspected, [...baseKeys, 'result'], 'The success response envelope is invalid.');
		if (
			inspected.values.get('state') !== 'succeeded' ||
			inspected.values.get('exitCategory') !== 'SUCCESS'
		)
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'The success state or exit category is invalid.'
			);
		if (subjectResolution.kind !== 'RESOLVED')
			refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'Success requires an exact resolved subject.');
		if (
			capability.implementationState !== 'IMPLEMENTED' ||
			capability.capabilityCoverage !== 'supported' ||
			capability.executionHealth !== 'succeeded' ||
			(capability.qualificationState !== 'QUALIFIED' &&
				capability.qualificationState !== 'NOT_APPLICABLE')
		)
			refuse(
				'CAPABILITY_INVALID',
				'VALIDATE_MESSAGE',
				'Success requires supported healthy capability evidence.'
			);
		if (currentness.status !== 'current-for-subject')
			refuse(
				'CURRENTNESS_INVALID',
				'VALIDATE_MESSAGE',
				'Success cannot carry noncurrent evidence.'
			);
		const result = inspectObject(
			inspected.values.get('result'),
			'The success result binding is invalid.'
		);
		exactKeys(result, ['resultDigest', 'resultRef'], 'The success result binding is invalid.');
		return {
			...common,
			exitCategory: 'SUCCESS',
			outcome,
			result: {
				resultDigest: requiredDigest(result, 'resultDigest'),
				resultRef: requiredReference(result, 'resultRef')
			},
			state: 'succeeded'
		};
	}
	if (outcome === 'partial') {
		exactKeys(inspected, [...baseKeys, 'partial'], 'The partial response envelope is invalid.');
		if (
			inspected.values.get('state') !== 'partial' ||
			inspected.values.get('exitCategory') !== 'INCOMPLETE_OR_UNSUPPORTED'
		)
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'The partial state or exit category is invalid.'
			);
		if (subjectResolution.kind !== 'RESOLVED')
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'A partial result requires an exact resolved subject.'
			);
		return {
			...common,
			exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
			outcome,
			partial: validatePartial(inspected.values.get('partial')),
			state: 'partial'
		};
	}
	if (outcome === 'error') {
		exactKeys(inspected, [...baseKeys, 'refusal'], 'The error response envelope is invalid.');
		const refusal = validateRefusal(inspected.values.get('refusal'));
		validateSubjectResolutionErrorCompatibility(subjectResolution, refusal);
		const rule = ERROR_PROTOCOL_RULES[refusal.code];
		const requiredExecutionHealth =
			refusal.code === 'CSAA-E-EXECUTION-CANCELLED'
				? 'cancelled'
				: refusal.code === 'CSAA-E-EXECUTION-TIMED-OUT'
					? 'timed-out'
					: refusal.code === 'CSAA-E-EXECUTION-BUDGET-REFUSED'
						? 'resource-exhausted'
						: null;
		if (requiredExecutionHealth !== null && capability.executionHealth !== requiredExecutionHealth)
			refuse(
				'CAPABILITY_INVALID',
				'VALIDATE_MESSAGE',
				'The execution refusal conflicts with capability execution health.'
			);
		if (
			inspected.values.get('state') !== rule.state ||
			inspected.values.get('exitCategory') !== rule.exitCategory
		)
			refuse(
				'MESSAGE_INVALID',
				'VALIDATE_MESSAGE',
				'The error state or exit category conflicts with its code.'
			);
		return {
			...common,
			exitCategory: rule.exitCategory,
			outcome,
			refusal,
			state: rule.state
		};
	}
	refuse('MESSAGE_INVALID', 'VALIDATE_MESSAGE', 'The response outcome is invalid.');
}

function validationOutcome<Value>(operation: () => Value): AgentProtocolValidationOutcome<Value> {
	try {
		return deepFreezeConstructed({ state: 'VALID' as const, value: operation() });
	} catch (error) {
		const diagnostic: AgentProtocolValidationDiagnostic =
			error instanceof AgentProtocolRefusal
				? { code: error.code, phase: error.phase, safeSummary: error.message }
				: {
						code: 'INTERNAL_VALIDATION_FAILED',
						phase: 'VALIDATE_MESSAGE',
						safeSummary:
							'Agent protocol validation failed without exposing internal exception text.'
					};
		return deepFreezeConstructed({ diagnostic, state: 'REFUSED' as const });
	}
}

export function validateAgentOperationRequest(
	value: unknown
): AgentProtocolValidationOutcome<AgentOperationRequest> {
	return validationOutcome(() => validateRequestInternal(value));
}

export function validateAgentOperationResponse(
	value: unknown
): AgentProtocolValidationOutcome<AgentOperationResponse> {
	return validationOutcome(() => validateResponseInternal(value));
}

function canonicalJson(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Non-finite canonical JSON number.');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	if (typeof value !== 'object') throw new Error('Unsupported canonical JSON value.');
	const entries = Object.keys(value)
		.sort()
		.map(
			(key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
		);
	return `{${entries.join(',')}}`;
}

function sha256(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function agentOperationRequestDigest(
	value: unknown
): AgentProtocolValidationOutcome<string> {
	return validationOutcome(() => {
		const request = validateRequestInternal(value);
		return sha256(canonicalJson(request));
	});
}

export function validateAgentOperationExchange(
	requestValue: unknown,
	responseValue: unknown
): AgentProtocolValidationOutcome<{
	readonly request: AgentOperationRequest;
	readonly response: AgentOperationResponse;
}> {
	return validationOutcome(() => {
		const request = validateRequestInternal(requestValue);
		const response = validateResponseInternal(responseValue);
		if (
			request.subjectInput.kind === 'RESOLVED_SUBJECT' &&
			response.subjectResolution.kind === 'NOT_APPLICABLE' &&
			response.subjectResolution.reasonCode === 'OPERATION_INTERRUPTED_BEFORE_SUBJECT_RESOLUTION'
		)
			refuse(
				'EXCHANGE_MISMATCH',
				'VALIDATE_EXCHANGE',
				'A caller-resolved subject cannot be reported as interrupted before subject resolution.'
			);
		if (
			response.requestId !== request.requestId ||
			response.requestDigest !== sha256(canonicalJson(request)) ||
			response.operation !== request.operation ||
			response.operationVersion !== request.operationVersion ||
			response.capability.capabilityId !== request.capabilityRequirement.capabilityId ||
			response.capability.capabilityVersion !== request.capabilityRequirement.capabilityVersion ||
			canonicalJson(response.capability.affectedQuestionRefs) !==
				canonicalJson(request.capabilityRequirement.affectedQuestionRefs)
		)
			refuse(
				'EXCHANGE_MISMATCH',
				'VALIDATE_EXCHANGE',
				'The response does not bind the exact request.'
			);
		if (
			request.currentnessRequirement.kind === 'REQUIRE_CURRENT' &&
			(response.outcome === 'success' || response.outcome === 'partial') &&
			response.currentness.status !== 'current-for-subject'
		)
			refuse(
				'EXCHANGE_MISMATCH',
				'VALIDATE_EXCHANGE',
				'The response does not satisfy required currentness.'
			);
		if (request.currentnessRequirement.kind === 'REQUIRE_EXACT_SUBJECT') {
			const resolved = response.subjectResolution;
			if (
				(response.outcome === 'success' || response.outcome === 'partial') &&
				(resolved.kind !== 'RESOLVED' ||
					resolved.subjectId !== request.currentnessRequirement.subjectId)
			)
				refuse(
					'EXCHANGE_MISMATCH',
					'VALIDATE_EXCHANGE',
					'The response does not bind the required exact subject.'
				);
		}
		if (
			request.capabilityRequirement.necessity === 'MANDATORY' &&
			response.outcome === 'success' &&
			response.capability.capabilityCoverage !== 'supported'
		)
			refuse(
				'EXCHANGE_MISMATCH',
				'VALIDATE_EXCHANGE',
				'A mandatory capability cannot be represented as successful without support.'
			);
		return { request, response };
	});
}

export function serializeAgentProtocolMessage(
	value: unknown,
	maxBytes: number = AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxMessageBytes
): AgentProtocolSerializationOutcome {
	try {
		if (
			!Number.isSafeInteger(maxBytes) ||
			maxBytes < 1 ||
			maxBytes > AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxMessageBytes
		)
			refuse(
				'SERIALIZATION_BUDGET_EXCEEDED',
				'SERIALIZE',
				'The serialization byte budget is invalid.'
			);
		const shell = inspectObject(value, 'The protocol message is invalid.');
		const messageKind = shell.values.get('messageKind');
		const message =
			messageKind === 'request'
				? validateRequestInternal(value)
				: messageKind === 'response'
					? validateResponseInternal(value)
					: refuse('MESSAGE_INVALID', 'SERIALIZE', 'The protocol message kind is invalid.');
		const json = canonicalJson(message);
		const bytes = Buffer.byteLength(json, 'utf8');
		if (bytes > maxBytes)
			refuse(
				'SERIALIZATION_BUDGET_EXCEEDED',
				'SERIALIZE',
				'The canonical protocol message exceeds its byte budget.'
			);
		return deepFreezeConstructed({
			bytes,
			digest: sha256(json),
			json,
			message,
			state: 'SERIALIZED' as const
		});
	} catch (error) {
		const diagnostic: AgentProtocolValidationDiagnostic =
			error instanceof AgentProtocolRefusal
				? { code: error.code, phase: error.phase, safeSummary: error.message }
				: {
						code: 'INTERNAL_VALIDATION_FAILED',
						phase: 'SERIALIZE',
						safeSummary:
							'Agent protocol serialization failed without exposing internal exception text.'
					};
		return deepFreezeConstructed({ diagnostic, state: 'REFUSED' as const });
	}
}
