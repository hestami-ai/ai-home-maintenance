import { isProxy } from 'node:util/types';

import {
	AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS,
	agentOperationRequestDigest,
	serializeAgentProtocolMessage,
	validateAgentOperationExchange,
	type AgentCapabilityStatus,
	type AgentCurrentnessStatus,
	type AgentOperation,
	type AgentOperationRequest,
	type AgentOperationResponse,
	type AgentSubjectResolutionOutcome
} from '../agent/agent-operation-protocol.js';
import {
	CODING_AGENT_CLI_IMPLEMENTATION_STATE,
	CODING_AGENT_CLI_SAFETY_CEILINGS,
	admitCodingAgentCliArguments,
	codingAgentCliExitCode,
	serializeCodingAgentCliDiagnostic,
	type CodingAgentCliInvocation
} from './coding-agent-cli-contract.js';

export interface CodingAgentCliHandlerContext {
	readonly implementationState: typeof CODING_AGENT_CLI_IMPLEMENTATION_STATE;
	readonly invocation: CodingAgentCliInvocation;
	/** Cooperative cancellation for the admitted timeout and optional host cancellation signal. */
	readonly signal: AbortSignal;
}

export type CodingAgentCliHandler = (
	context: CodingAgentCliHandlerContext
) => Promise<readonly unknown[]> | readonly unknown[];

export type CodingAgentCliHandlers = Partial<
	Readonly<Record<AgentOperation, CodingAgentCliHandler>>
>;

export interface RunCodingAgentCliOptions {
	readonly handlers?: CodingAgentCliHandlers;
	/** Supplies the response timestamp only. Tests and deterministic clients should inject it. */
	readonly now?: () => string;
	/** Optional host cancellation. Cancellation never publishes handler output. */
	readonly signal?: AbortSignal;
}

export type CodingAgentCliRunResult =
	| {
			readonly exitCode: 2;
			readonly state: 'ADMISSION_REFUSED';
			readonly stderr: string;
			readonly stdout: '';
	  }
	| {
			readonly exitCode: 0 | 2 | 3 | 4 | 5;
			readonly state: 'COMPLETED';
			readonly stderr: string;
			readonly stdout: string;
			readonly terminalResponse: Exclude<AgentOperationResponse, { readonly outcome: 'progress' }>;
	  };

const RFC3339_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function requestDigest(request: AgentOperationRequest): string {
	const outcome = agentOperationRequestDigest(request);
	if (outcome.state !== 'VALID') throw new Error('The admitted request digest became invalid.');
	return outcome.value;
}

function safeResponseTimestamp(request: AgentOperationRequest, now?: () => string): string {
	try {
		const value = now?.() ?? new Date().toISOString();
		if (
			RFC3339_MILLISECONDS.test(value) &&
			Number.isFinite(Date.parse(value)) &&
			new Date(value).toISOString() === value
		)
			return value;
	} catch {
		// The admitted request timestamp is the deterministic fail-closed fallback.
	}
	return request.requestedAt;
}

function unimplementedCapability(request: AgentOperationRequest): AgentCapabilityStatus {
	return {
		affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
		capabilityCoverage: 'unsupported',
		capabilityId: request.capabilityRequirement.capabilityId,
		capabilityVersion: request.capabilityRequirement.capabilityVersion,
		conflict: 'unopposed',
		conflictRefs: [],
		coverageRefs: [],
		excludedRegionRefs: [],
		executionHealth: 'not-run',
		implementationState: 'UNIMPLEMENTED',
		limitationRefs: ['limit:cli-root-operation-handler-unavailable'],
		provenanceRefs: ['provenance:cli-implementation-local-unregistered'],
		providerRefs: [],
		qualificationState: 'UNKNOWN',
		unknownRegionRefs: ['region:operation-not-analyzed']
	};
}

function unresolvedCurrentness(reasonCode: string): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:cli-request-admission',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode },
		status: 'unknown',
		subject: { kind: 'NOT_APPLICABLE', reasonCode },
		unresolvedDependencyRefs: []
	};
}

function callerBoundCurrentness(subjectId: string): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:cli-request-admission',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode: 'OPERATION_NOT_EXECUTED' },
		status: 'unknown',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: ['dependency:cli-root-operation-handler']
	};
}

function responseId(request: AgentOperationRequest, suffix: string): string {
	return `response:cli:${requestDigest(request).slice(0, 24)}:${suffix}`;
}

function unavailableResponse(
	request: AgentOperationRequest,
	responseAt: string
): Exclude<AgentOperationResponse, { readonly outcome: 'progress' }> {
	const capability = unimplementedCapability(request);
	const common = {
		capability,
		messageKind: 'response' as const,
		operation: request.operation,
		operationVersion: request.operationVersion,
		protocolVersion: request.protocolVersion,
		requestDigest: requestDigest(request),
		requestId: request.requestId,
		responseAt,
		responseId: responseId(request, 'unavailable'),
		warningRefs: ['warning:cli-foundation-unregistered']
	};
	if (request.subjectInput.kind === 'RESOLVED_SUBJECT') {
		return {
			...common,
			currentness: callerBoundCurrentness(request.subjectInput.subjectId),
			exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
			outcome: 'error',
			refusal: {
				attemptedEvidenceRefs: ['evidence:cli-request-admitted'],
				blockedActionRef: `action:${request.operation}-execution`,
				blockedClaimRefs: ['claim:requested-analysis'],
				code: 'CSAA-E-CAPABILITY-UNSUPPORTED',
				failedPredicateRef: 'predicate:registered-operation-handler-available',
				fallbackLimitRefs: ['limit:no-operation-result'],
				provenanceRefs: ['provenance:cli-handler-registry'],
				reasonCode: 'UNIMPLEMENTED_CAPABILITY',
				requiredNextActionRef: 'next:register-owning-operation-handler',
				residualRiskRef: 'risk:requested-analysis-unavailable',
				responsibleOwnerRef: 'owner:csaa-root-integration',
				retryability: 'RETRYABLE',
				unaffectedScopeRefs: []
			},
			state: 'failed',
			subjectResolution: {
				kind: 'RESOLVED',
				resolutionEvidenceRefs: ['subject-resolution:caller-bound-resolved-subject-input'],
				subjectId: request.subjectInput.subjectId
			}
		};
	}
	return {
		...common,
		currentness: unresolvedCurrentness('SUBJECT_RESOLUTION_HANDLER_UNAVAILABLE'),
		exitCategory: 'INVALID_REQUEST',
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: ['evidence:cli-request-admitted'],
			blockedActionRef: `action:${request.operation}-execution`,
			blockedClaimRefs: ['claim:requested-analysis'],
			code: 'CSAA-E-SUBJECT-UNAVAILABLE',
			failedPredicateRef: 'predicate:exact-subject-resolution-available',
			fallbackLimitRefs: ['limit:no-subject-no-analysis'],
			provenanceRefs: ['provenance:cli-handler-registry'],
			reasonCode: 'SUBJECT_UNRESOLVED',
			requiredNextActionRef: 'next:register-subject-resolution-and-operation-handler',
			residualRiskRef: 'risk:requested-subject-unresolved',
			responsibleOwnerRef: 'owner:csaa-root-integration',
			retryability: 'RETRYABLE',
			unaffectedScopeRefs: []
		},
		state: 'failed',
		subjectResolution: {
			diagnosticRefs: ['diagnostic:cli-subject-resolution-handler-unavailable'],
			kind: 'UNAVAILABLE',
			retryState: 'RETRYABLE'
		}
	};
}

function internalFailureResponse(
	request: AgentOperationRequest,
	responseAt: string
): Exclude<AgentOperationResponse, { readonly outcome: 'progress' }> {
	const subjectResolution: AgentSubjectResolutionOutcome =
		request.subjectInput.kind === 'RESOLVED_SUBJECT'
			? {
					kind: 'RESOLVED',
					resolutionEvidenceRefs: ['subject-resolution:caller-bound-resolved-subject-input'],
					subjectId: request.subjectInput.subjectId
				}
			: { kind: 'NOT_APPLICABLE', reasonCode: 'HANDLER_OUTPUT_INVALID' };
	return {
		capability: unimplementedCapability(request),
		currentness:
			subjectResolution.kind === 'RESOLVED'
				? callerBoundCurrentness(subjectResolution.subjectId)
				: unresolvedCurrentness('HANDLER_OUTPUT_INVALID'),
		exitCategory: 'INTERNAL_FAILURE',
		messageKind: 'response',
		operation: request.operation,
		operationVersion: request.operationVersion,
		outcome: 'error',
		protocolVersion: request.protocolVersion,
		refusal: {
			attemptedEvidenceRefs: ['evidence:cli-handler-invocation'],
			blockedActionRef: `action:${request.operation}-result-publication`,
			blockedClaimRefs: ['claim:requested-analysis'],
			code: 'CSAA-E-INTERNAL-UNEXPECTED',
			failedPredicateRef: 'predicate:exact-handler-response-stream-valid',
			fallbackLimitRefs: ['limit:invalid-handler-output-not-published'],
			provenanceRefs: ['provenance:cli-response-validation'],
			reasonCode: 'INTERNAL_FAILURE',
			requiredNextActionRef: 'next:repair-or-register-operation-handler',
			residualRiskRef: 'risk:requested-analysis-not-established',
			responsibleOwnerRef: 'owner:csaa-root-integration',
			retryability: 'UNKNOWN',
			unaffectedScopeRefs: []
		},
		requestDigest: requestDigest(request),
		requestId: request.requestId,
		responseAt,
		responseId: responseId(request, 'internal-failure'),
		state: 'unknown',
		subjectResolution,
		warningRefs: ['warning:handler-output-refused']
	};
}

function interruptedResponse(
	request: AgentOperationRequest,
	responseAt: string,
	kind: 'CANCELLED' | 'TIMED_OUT'
): Exclude<AgentOperationResponse, { readonly outcome: 'progress' }> {
	if (request.subjectInput.kind !== 'RESOLVED_SUBJECT')
		return unavailableResponse(request, responseAt);
	const timedOut = kind === 'TIMED_OUT';
	return {
		capability: {
			affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
			capabilityCoverage: 'partial',
			capabilityId: request.capabilityRequirement.capabilityId,
			capabilityVersion: request.capabilityRequirement.capabilityVersion,
			conflict: 'unopposed',
			conflictRefs: [],
			coverageRefs: [],
			excludedRegionRefs: [],
			executionHealth: timedOut ? 'timed-out' : 'cancelled',
			implementationState: 'IMPLEMENTED',
			limitationRefs: [timedOut ? 'limit:cli-timeout' : 'limit:cli-cancellation'],
			provenanceRefs: ['provenance:cli-execution-control'],
			providerRefs: [],
			qualificationState: 'UNKNOWN',
			unknownRegionRefs: ['region:unfinished-operation']
		},
		currentness: callerBoundCurrentness(request.subjectInput.subjectId),
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		messageKind: 'response',
		operation: request.operation,
		operationVersion: request.operationVersion,
		outcome: 'error',
		protocolVersion: request.protocolVersion,
		refusal: {
			attemptedEvidenceRefs: ['evidence:cli-handler-invocation'],
			blockedActionRef: `action:${request.operation}-completion`,
			blockedClaimRefs: ['claim:requested-analysis'],
			code: timedOut ? 'CSAA-E-EXECUTION-TIMED-OUT' : 'CSAA-E-EXECUTION-CANCELLED',
			failedPredicateRef: 'predicate:bounded-operation-completed',
			fallbackLimitRefs: ['limit:no-terminal-operation-result'],
			provenanceRefs: ['provenance:cli-execution-control'],
			reasonCode: timedOut ? 'TIMED_OUT' : 'CANCELLED',
			requiredNextActionRef: timedOut
				? 'next:review-timeout-and-operation-scope'
				: 'next:confirm-cancellation-and-retry-if-authorized',
			residualRiskRef: 'risk:requested-analysis-incomplete',
			responsibleOwnerRef: 'owner:analysis-client',
			retryability: 'RETRYABLE',
			unaffectedScopeRefs: []
		},
		requestDigest: requestDigest(request),
		requestId: request.requestId,
		responseAt,
		responseId: responseId(request, timedOut ? 'timed-out' : 'cancelled'),
		state: timedOut ? 'timed-out' : 'cancelled',
		subjectResolution: {
			kind: 'RESOLVED',
			resolutionEvidenceRefs: ['subject-resolution:caller-bound-resolved-subject-input'],
			subjectId: request.subjectInput.subjectId
		},
		warningRefs: [timedOut ? 'warning:operation-timed-out' : 'warning:operation-cancelled']
	};
}

function serializeTerminal(
	request: AgentOperationRequest,
	response: Exclude<AgentOperationResponse, { readonly outcome: 'progress' }>
): string {
	const serialized = serializeAgentProtocolMessage(
		response,
		Math.min(
			request.budgets.maxOutputBytes,
			AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxMessageBytes
		)
	);
	if (serialized.state !== 'SERIALIZED')
		throw new Error('The terminal response could not be serialized within the admitted budget.');
	return `${serialized.json}\n`;
}

function completed(
	request: AgentOperationRequest,
	terminalResponse: Exclude<AgentOperationResponse, { readonly outcome: 'progress' }>,
	stdout: string,
	stderr: string
): CodingAgentCliRunResult {
	return Object.freeze({
		exitCode: codingAgentCliExitCode(terminalResponse.exitCategory),
		state: 'COMPLETED' as const,
		stderr,
		stdout,
		terminalResponse
	});
}

function internalFailureResult(
	request: AgentOperationRequest,
	responseAt: string
): CodingAgentCliRunResult {
	const response = internalFailureResponse(request, responseAt);
	const validation = validateAgentOperationExchange(request, response);
	if (validation.state !== 'VALID')
		throw new Error('The CLI internal-failure envelope is invalid.');
	return completed(request, response, serializeTerminal(request, response), '');
}

function validateHandlerSequence(
	request: AgentOperationRequest,
	value: unknown
): readonly AgentOperationResponse[] | null {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		!Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		return null;
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value)
	)
		return null;
	const length = lengthDescriptor.value;
	if (length === 0 || length > CODING_AGENT_CLI_SAFETY_CEILINGS.maxProgressResponses + 1)
		return null;
	if (
		Reflect.ownKeys(value).some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' && !/^\d+$/u.test(key)) ||
				(key !== 'length' && String(Number(key)) !== key) ||
				(key !== 'length' && Number(key) >= length)
		)
	)
		return null;
	const responses: AgentOperationResponse[] = [];
	const responseIds = new Set<string>();
	let previousTimestamp = '';
	let terminalCount = 0;
	for (let index = 0; index < length; index += 1) {
		const property = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (property === undefined || !property.enumerable || !('value' in property)) return null;
		const exchange = validateAgentOperationExchange(request, property.value);
		if (exchange.state !== 'VALID') return null;
		const response = exchange.value.response;
		if (responseIds.has(response.responseId) || response.responseAt < previousTimestamp)
			return null;
		responseIds.add(response.responseId);
		previousTimestamp = response.responseAt;
		if (response.outcome === 'progress') {
			if (terminalCount !== 0 || index === length - 1) return null;
		} else {
			terminalCount += 1;
			if (index !== length - 1) return null;
		}
		responses.push(response);
	}
	return terminalCount === 1 ? Object.freeze(responses) : null;
}

function routeHandlerResponses(
	request: AgentOperationRequest,
	responses: readonly AgentOperationResponse[]
): CodingAgentCliRunResult | null {
	const stderrLines: string[] = [];
	let stdout = '';
	let cumulativeBytes = 0;
	let terminal: Exclude<AgentOperationResponse, { readonly outcome: 'progress' }> | null = null;
	for (const response of responses) {
		const serialized = serializeAgentProtocolMessage(
			response,
			Math.min(
				request.budgets.maxOutputBytes,
				AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxMessageBytes
			)
		);
		if (serialized.state !== 'SERIALIZED') return null;
		const line = `${serialized.json}\n`;
		cumulativeBytes += Buffer.byteLength(line, 'utf8');
		if (cumulativeBytes > request.budgets.maxOutputBytes) return null;
		if (response.outcome === 'progress') stderrLines.push(line);
		else {
			terminal = response;
			stdout = line;
		}
	}
	return terminal === null ? null : completed(request, terminal, stdout, stderrLines.join(''));
}

type ControlledHandlerOutcome =
	| { readonly kind: 'CANCELLED' }
	| { readonly kind: 'FAILED' }
	| { readonly kind: 'RESPONSES'; readonly value: unknown }
	| { readonly kind: 'TIMED_OUT' };

async function invokeHandlerWithControl(
	handler: CodingAgentCliHandler,
	invocation: CodingAgentCliInvocation,
	hostSignal: AbortSignal | undefined
): Promise<ControlledHandlerOutcome> {
	if (hostSignal?.aborted === true) return { kind: 'CANCELLED' };
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let removeAbortListener: (() => void) | undefined;
	const handlerOutcome = Promise.resolve()
		.then(() =>
			handler(
				Object.freeze({
					implementationState: CODING_AGENT_CLI_IMPLEMENTATION_STATE,
					invocation,
					signal: controller.signal
				})
			)
		)
		.then<ControlledHandlerOutcome, ControlledHandlerOutcome>(
			(value) => ({ kind: 'RESPONSES', value }),
			() => ({ kind: 'FAILED' })
		);
	const timeoutOutcome = new Promise<ControlledHandlerOutcome>((resolve) => {
		timeout = setTimeout(() => {
			controller.abort();
			resolve({ kind: 'TIMED_OUT' });
		}, invocation.request.budgets.timeoutMs);
	});
	const candidates: Promise<ControlledHandlerOutcome>[] = [handlerOutcome, timeoutOutcome];
	if (hostSignal !== undefined) {
		candidates.push(
			new Promise<ControlledHandlerOutcome>((resolve) => {
				const cancel = () => {
					controller.abort();
					resolve({ kind: 'CANCELLED' });
				};
				hostSignal.addEventListener('abort', cancel, { once: true });
				removeAbortListener = () => hostSignal.removeEventListener('abort', cancel);
			})
		);
	}
	try {
		return await Promise.race(candidates);
	} finally {
		if (timeout !== undefined) clearTimeout(timeout);
		removeAbortListener?.();
	}
}

/**
 * Validates the complete request/input binding before invoking a handler, buffers and validates the
 * complete handler response sequence, then routes progress to stderr and one terminal response to
 * stdout. This module does not open files, spawn processes, import subject modules, or use network APIs.
 */
export async function runCodingAgentCli(
	argv: readonly string[],
	options: RunCodingAgentCliOptions = {}
): Promise<CodingAgentCliRunResult> {
	const admission = admitCodingAgentCliArguments(argv);
	if (admission.state !== 'ADMITTED')
		return Object.freeze({
			exitCode: 2 as const,
			state: 'ADMISSION_REFUSED' as const,
			stderr: serializeCodingAgentCliDiagnostic(admission.diagnostic),
			stdout: '' as const
		});
	const invocation = admission.invocation;
	const responseAt = safeResponseTimestamp(invocation.request, options.now);
	const handler = options.handlers?.[invocation.command];
	if (handler === undefined) {
		const response = unavailableResponse(invocation.request, responseAt);
		const validation = validateAgentOperationExchange(invocation.request, response);
		if (validation.state !== 'VALID') return internalFailureResult(invocation.request, responseAt);
		return completed(
			invocation.request,
			response,
			serializeTerminal(invocation.request, response),
			''
		);
	}
	try {
		const controlled = await invokeHandlerWithControl(handler, invocation, options.signal);
		if (controlled.kind === 'CANCELLED' || controlled.kind === 'TIMED_OUT') {
			const response = interruptedResponse(invocation.request, responseAt, controlled.kind);
			const validation = validateAgentOperationExchange(invocation.request, response);
			if (validation.state !== 'VALID')
				return internalFailureResult(invocation.request, responseAt);
			return completed(
				invocation.request,
				response,
				serializeTerminal(invocation.request, response),
				''
			);
		}
		if (controlled.kind === 'FAILED') return internalFailureResult(invocation.request, responseAt);
		const responses = validateHandlerSequence(invocation.request, controlled.value);
		if (responses === null) return internalFailureResult(invocation.request, responseAt);
		return (
			routeHandlerResponses(invocation.request, responses) ??
			internalFailureResult(invocation.request, responseAt)
		);
	} catch {
		return internalFailureResult(invocation.request, responseAt);
	}
}
