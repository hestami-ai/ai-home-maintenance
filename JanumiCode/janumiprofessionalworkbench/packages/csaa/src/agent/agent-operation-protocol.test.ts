import { describe, expect, it } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_NONCLAIMS,
	AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS,
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	agentOperationRequestDigest,
	serializeAgentProtocolMessage,
	validateAgentOperationExchange,
	validateAgentOperationRequest,
	validateAgentOperationResponse,
	type AgentCapabilityStatus,
	type AgentCurrentnessStatus,
	type AgentOperation,
	type AgentOperationRequest,
	type AgentOperationResponse
} from './agent-operation-protocol.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

function request(overrides: Partial<AgentOperationRequest> = {}): AgentOperationRequest {
	return {
		budgets: {
			maxDepth: 16,
			maxEdges: 10_000,
			maxNodes: 5_000,
			maxOutputBytes: 1_000_000,
			maxResults: 1_000,
			timeoutMs: 30_000
		},
		capabilityRequirement: {
			affectedQuestionRefs: ['question:caller-impact'],
			capabilityId: 'JAN-CSAA-CAP-029',
			capabilityVersion: 'JAN-CSAA-CAP-029@0.1.0',
			necessity: 'MANDATORY'
		},
		currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
		messageKind: 'request',
		operation: 'query',
		operationInput: {
			contractId: 'jan-csaa-query-input',
			contractVersion: 'jan-csaa-query-input/1.0.0',
			inputDigest: B,
			inputRef: 'input:query:one'
		},
		operationVersion: AGENT_OPERATION_VERSIONS.query,
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestId: 'request:one',
		requestedAt: '2026-08-25T00:00:00.000Z',
		subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: 'subject:one' },
		work: {
			agentId: 'agent:codex',
			authorityEnvelopeRef: 'authority:local-readonly',
			changeContract: { changeContractRef: 'change:csaa-g6', kind: 'REFERENCE' },
			employmentPoint: 'DURING_IMPLEMENTATION',
			userRequestDigest: A,
			workPackageRef: 'work-package:DWP-006'
		},
		...overrides
	};
}

function requestDigest(candidate: AgentOperationRequest): string {
	const outcome = agentOperationRequestDigest(candidate);
	if (outcome.state !== 'VALID') throw new Error(JSON.stringify(outcome));
	return outcome.value;
}

function capability(overrides: Partial<AgentCapabilityStatus> = {}): AgentCapabilityStatus {
	return {
		affectedQuestionRefs: ['question:caller-impact'],
		capabilityCoverage: 'supported',
		capabilityId: 'JAN-CSAA-CAP-029',
		capabilityVersion: 'JAN-CSAA-CAP-029@0.1.0',
		conflict: 'unopposed',
		conflictRefs: [],
		coverageRefs: ['coverage:query-complete'],
		excludedRegionRefs: [],
		executionHealth: 'succeeded',
		implementationState: 'IMPLEMENTED',
		limitationRefs: [],
		provenanceRefs: ['provenance:query-run'],
		providerRefs: ['provider:typescript'],
		qualificationState: 'QUALIFIED',
		unknownRegionRefs: [],
		...overrides
	};
}

function currentness(overrides: Partial<AgentCurrentnessStatus> = {}): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: ['freshness:subject-rechecked'],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:query-run',
		snapshot: { kind: 'SNAPSHOT', snapshotId: 'snapshot:one' },
		status: 'current-for-subject',
		subject: { kind: 'SUBJECT', subjectId: 'subject:one' },
		unresolvedDependencyRefs: [],
		...overrides
	};
}

function responseBase(candidateRequest: AgentOperationRequest) {
	return {
		capability: capability(),
		currentness: currentness(),
		messageKind: 'response' as const,
		operation: candidateRequest.operation,
		operationVersion: candidateRequest.operationVersion,
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestDigest: requestDigest(candidateRequest),
		requestId: candidateRequest.requestId,
		responseAt: '2026-08-25T00:00:01.000Z',
		responseId: 'response:one',
		subjectResolution: {
			kind: 'RESOLVED' as const,
			resolutionEvidenceRefs: ['subject-resolution:one'],
			subjectId: 'subject:one'
		},
		warningRefs: [] as string[]
	};
}

function success(candidateRequest = request()): AgentOperationResponse {
	return {
		...responseBase(candidateRequest),
		exitCategory: 'SUCCESS',
		outcome: 'success',
		result: { resultDigest: C, resultRef: 'result:query:one' },
		state: 'succeeded'
	};
}

function partial(candidateRequest = request()): AgentOperationResponse {
	return {
		...responseBase(candidateRequest),
		capability: capability({
			capabilityCoverage: 'partial',
			executionHealth: 'resource-exhausted',
			limitationRefs: ['limit:result-budget'],
			unknownRegionRefs: ['region:unvisited']
		}),
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		outcome: 'partial',
		partial: {
			admittedResultRefs: ['result:query:partial'],
			causeRefs: ['cause:result-budget'],
			completedRegionRefs: ['region:visited'],
			continuation: { kind: 'TOKEN', tokenDigest: B, tokenRef: 'continuation:one' },
			failedRegionRefs: [],
			missingRegionRefs: ['region:unvisited'],
			withheldRegionRefs: []
		},
		state: 'partial'
	};
}

function unresolvedCurrentness(): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:subject-resolution',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode: 'SUBJECT_UNRESOLVED' },
		status: 'unknown',
		subject: { kind: 'NOT_APPLICABLE', reasonCode: 'SUBJECT_UNRESOLVED' },
		unresolvedDependencyRefs: []
	};
}

function errorResponse(candidateRequest = request()): AgentOperationResponse {
	return {
		...responseBase(candidateRequest),
		capability: capability({
			capabilityCoverage: 'unsupported',
			coverageRefs: [],
			executionHealth: 'not-run',
			implementationState: 'UNIMPLEMENTED',
			limitationRefs: ['limit:subject-unresolved'],
			providerRefs: [],
			qualificationState: 'UNKNOWN'
		}),
		currentness: unresolvedCurrentness(),
		exitCategory: 'INVALID_REQUEST',
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: ['evidence:subject-locator'],
			blockedActionRef: 'action:query-execution',
			blockedClaimRefs: ['claim:caller-impact'],
			code: 'CSAA-E-SUBJECT-UNIDENTIFIED',
			failedPredicateRef: 'predicate:exact-subject-required',
			fallbackLimitRefs: ['limit:no-semantic-result'],
			provenanceRefs: ['provenance:subject-resolution'],
			reasonCode: 'SUBJECT_UNRESOLVED',
			requiredNextActionRef: 'next:resolve-exact-subject',
			residualRiskRef: 'risk:unknown-caller-impact',
			responsibleOwnerRef: 'owner:subject-resolution',
			retryability: 'RETRYABLE',
			unaffectedScopeRefs: ['scope:documentation-only']
		},
		state: 'failed',
		subjectResolution: { kind: 'NOT_FOUND', locatorDigest: A, reasonCode: 'NO_MATCH' }
	};
}

function progress(candidateRequest = request()): AgentOperationResponse {
	return {
		...responseBase(candidateRequest),
		capability: capability({ executionHealth: 'not-run' }),
		exitCategory: 'IN_PROGRESS',
		outcome: 'progress',
		progress: {
			completedUnits: 2,
			progressRef: 'progress:query:one',
			stageRef: 'stage:normalization',
			totalUnits: 5,
			unitKind: 'PROJECT'
		},
		state: 'running'
	};
}

function expectRequestRefused(candidate: unknown, code: string): void {
	expect(validateAgentOperationRequest(candidate)).toMatchObject({
		diagnostic: { code },
		state: 'REFUSED'
	});
}

function expectResponseRefused(candidate: unknown, code: string): void {
	expect(validateAgentOperationResponse(candidate)).toMatchObject({
		diagnostic: { code },
		state: 'REFUSED'
	});
}

function expectDeeplyFrozen(value: unknown): void {
	const stack: unknown[] = [value];
	const seen = new WeakSet<object>();
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === null || typeof current !== 'object' || seen.has(current)) continue;
		seen.add(current);
		expect(Object.isFrozen(current)).toBe(true);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor !== undefined && 'value' in descriptor) stack.push(descriptor.value);
		}
	}
}

function reverseObjectKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reverseObjectKeys);
	if (value === null || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value)
			.reverse()
			.map(([key, child]) => [key, reverseObjectKeys(child)])
	);
}

describe('agent operation request protocol', () => {
	it('validates and freezes a closed bounded work/subject/capability request', () => {
		const outcome = validateAgentOperationRequest(request());
		expect(outcome).toMatchObject({
			state: 'VALID',
			value: {
				capabilityRequirement: {
					capabilityId: 'JAN-CSAA-CAP-029',
					necessity: 'MANDATORY'
				},
				currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
				operation: 'query',
				protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
				subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: 'subject:one' },
				work: { employmentPoint: 'DURING_IMPLEMENTATION' }
			}
		});
		expectDeeplyFrozen(outcome);
	});

	it('enforces the closed operation-to-subject-input policy for every operation', () => {
		const cases: readonly [AgentOperation, AgentOperationRequest['subjectInput']][] = [
			['explain', { kind: 'TARGET_RECORD', targetRecordRef: 'target:finding:one' }],
			[
				'findings',
				{
					kind: 'SCOPED_TARGET',
					scopeRef: 'scope:repository',
					targetPopulationRefs: ['population:source']
				}
			],
			[
				'impact',
				{
					kind: 'SCOPED_TARGET',
					scopeRef: 'scope:change',
					targetPopulationRefs: ['population:module']
				}
			],
			[
				'inventory',
				{
					kind: 'SUBJECT_LOCATOR',
					locatorDigest: A,
					locatorRef: 'locator:repo',
					resolutionPolicyRef: 'policy:exact'
				}
			],
			['query', { kind: 'TARGET_RECORD', targetRecordRef: 'target:snapshot:one' }],
			[
				'snapshot',
				{
					kind: 'SUBJECT_LOCATOR',
					locatorDigest: A,
					locatorRef: 'locator:repo',
					resolutionPolicyRef: 'policy:exact'
				}
			],
			[
				'verify',
				{
					kind: 'SUBJECT_LOCATOR',
					locatorDigest: A,
					locatorRef: 'locator:repo',
					resolutionPolicyRef: 'policy:exact'
				}
			]
		];
		for (const [operation, subjectInput] of cases) {
			const candidate = request({
				operation,
				operationVersion: AGENT_OPERATION_VERSIONS[operation],
				subjectInput
			});
			expect(validateAgentOperationRequest(candidate)).toMatchObject({ state: 'VALID' });
		}
		expectRequestRefused(
			request({
				subjectInput: {
					kind: 'SUBJECT_LOCATOR',
					locatorDigest: A,
					locatorRef: 'locator:repo',
					resolutionPolicyRef: 'policy:exact'
				}
			}),
			'MESSAGE_INVALID'
		);
	});

	it('refuses invalid versions, unsafe limits, open shapes, proxies, accessors, and unordered sets', () => {
		expectRequestRefused({ ...request(), protocolVersion: 'future/9.0.0' }, 'PROTOCOL_UNSUPPORTED');
		expectRequestRefused(
			{ ...request(), operationVersion: 'query/9.0.0' },
			'OPERATION_UNSUPPORTED'
		);
		expectRequestRefused(
			request({
				budgets: {
					...request().budgets,
					maxNodes: AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS.maxNodes + 1
				}
			}),
			'BUDGET_REFUSED'
		);
		expectRequestRefused({ ...request(), extra: true }, 'MESSAGE_INVALID');
		expectRequestRefused(new Proxy(request(), {}), 'MESSAGE_INVALID');
		expectRequestRefused(
			request({
				capabilityRequirement: {
					...request().capabilityRequirement,
					affectedQuestionRefs: ['question:z', 'question:a']
				}
			}),
			'MESSAGE_INVALID'
		);
		expectRequestRefused(request({ requestId: 'bad\ud800' }), 'MESSAGE_INVALID');
		let getterHits = 0;
		const accessor = { ...request() } as Record<string, unknown>;
		Object.defineProperty(accessor, 'requestId', {
			enumerable: true,
			get() {
				getterHits += 1;
				return 'request:hostile';
			}
		});
		expectRequestRefused(accessor, 'MESSAGE_INVALID');
		expect(getterHits).toBe(0);
	});
});

describe('agent operation response protocol', () => {
	it('validates the disjoint success union only with supported healthy current evidence', () => {
		const outcome = validateAgentOperationResponse(success());
		expect(outcome).toMatchObject({
			state: 'VALID',
			value: {
				capability: {
					capabilityCoverage: 'supported',
					executionHealth: 'succeeded',
					provenanceRefs: ['provenance:query-run']
				},
				currentness: { status: 'current-for-subject' },
				exitCategory: 'SUCCESS',
				outcome: 'success',
				state: 'succeeded',
				subjectResolution: { kind: 'RESOLVED', subjectId: 'subject:one' }
			}
		});
		expectDeeplyFrozen(outcome);
		expectResponseRefused(
			{
				...success(),
				subjectResolution: { kind: 'NOT_FOUND', locatorDigest: A, reasonCode: 'NO_MATCH' }
			},
			'CURRENTNESS_INVALID'
		);
		expectResponseRefused(
			{
				...success(),
				capability: capability({ capabilityCoverage: 'partial', limitationRefs: ['limit:partial'] })
			},
			'CAPABILITY_INVALID'
		);
		expectResponseRefused(
			{
				...success(),
				currentness: currentness({
					freshnessEvidenceRefs: [],
					status: 'stale',
					unresolvedDependencyRefs: ['dependency:changed']
				})
			},
			'CURRENTNESS_INVALID'
		);
	});

	it('keeps partial output separate from success and requires admitted plus omitted regions', () => {
		expect(validateAgentOperationResponse(partial())).toMatchObject({
			state: 'VALID',
			value: {
				exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
				outcome: 'partial',
				partial: {
					admittedResultRefs: ['result:query:partial'],
					missingRegionRefs: ['region:unvisited']
				},
				state: 'partial'
			}
		});
		const noOmission = partial() as Extract<AgentOperationResponse, { outcome: 'partial' }>;
		expectResponseRefused(
			{
				...noOmission,
				partial: {
					...noOmission.partial,
					failedRegionRefs: [],
					missingRegionRefs: [],
					withheldRegionRefs: []
				}
			},
			'MESSAGE_INVALID'
		);
		expectResponseRefused(
			{ ...partial(), result: { resultDigest: C, resultRef: 'result:false-success' } },
			'MESSAGE_INVALID'
		);
	});

	it('validates progress without fabricated terminal health or semantic result', () => {
		expect(validateAgentOperationResponse(progress())).toMatchObject({
			state: 'VALID',
			value: {
				capability: { executionHealth: 'not-run' },
				exitCategory: 'IN_PROGRESS',
				outcome: 'progress',
				progress: { completedUnits: 2, totalUnits: 5 },
				state: 'running'
			}
		});
		expectResponseRefused(
			{ ...progress(), capability: capability({ executionHealth: 'succeeded' }) },
			'CAPABILITY_INVALID'
		);
		const tooFar = progress() as Extract<AgentOperationResponse, { outcome: 'progress' }>;
		expectResponseRefused(
			{ ...tooFar, progress: { ...tooFar.progress, completedUnits: 6 } },
			'MESSAGE_INVALID'
		);
	});

	it('requires a typed refusal with blocked claims, evidence, limits, owner, risk, and next action', () => {
		expect(validateAgentOperationResponse(errorResponse())).toMatchObject({
			state: 'VALID',
			value: {
				exitCategory: 'INVALID_REQUEST',
				outcome: 'error',
				refusal: {
					blockedClaimRefs: ['claim:caller-impact'],
					code: 'CSAA-E-SUBJECT-UNIDENTIFIED',
					reasonCode: 'SUBJECT_UNRESOLVED',
					requiredNextActionRef: 'next:resolve-exact-subject'
				},
				state: 'failed',
				subjectResolution: { kind: 'NOT_FOUND' }
			}
		});
		const error = errorResponse() as Extract<AgentOperationResponse, { outcome: 'error' }>;
		expectResponseRefused(
			{ ...error, refusal: { ...error.refusal, blockedClaimRefs: [] } },
			'MESSAGE_INVALID'
		);
		expectResponseRefused(
			{ ...error, exitCategory: 'INTERNAL_FAILURE', state: 'unknown' },
			'MESSAGE_INVALID'
		);
		expectResponseRefused(
			{ ...error, refusal: { ...error.refusal, reasonCode: 'BUDGET_REFUSED' } },
			'MESSAGE_INVALID'
		);
	});

	it('validates every nonresolved subject branch only with a compatible typed refusal', () => {
		const base = errorResponse() as Extract<AgentOperationResponse, { outcome: 'error' }>;
		const branches: AgentOperationResponse[] = [
			base,
			{
				...base,
				subjectResolution: {
					candidateDisclosure: {
						candidateRefs: ['subject-candidate:one', 'subject-candidate:two'],
						kind: 'AUTHORIZED_REFERENCES'
					},
					kind: 'AMBIGUOUS'
				}
			},
			{
				...base,
				subjectResolution: {
					candidateDisclosure: { kind: 'WITHHELD_COUNT', withheldCandidateCount: 2 },
					kind: 'AMBIGUOUS'
				}
			},
			{
				...base,
				refusal: {
					...base.refusal,
					code: 'CSAA-E-AUTH-UNAUTHORIZED',
					reasonCode: 'AUTHORIZATION_REFUSED'
				},
				state: 'authorization-refused',
				subjectResolution: { accessDecisionRef: 'access-decision:denied', kind: 'FORBIDDEN' }
			},
			{
				...base,
				refusal: { ...base.refusal, code: 'CSAA-E-SUBJECT-UNAVAILABLE' },
				subjectResolution: {
					diagnosticRefs: ['diagnostic:repository-unavailable'],
					kind: 'UNAVAILABLE',
					retryState: 'RETRYABLE'
				}
			},
			{
				...base,
				refusal: {
					...base.refusal,
					code: 'CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION',
					reasonCode: 'INVALID_REQUEST'
				},
				state: 'incompatible',
				subjectResolution: {
					compatibilityDecisionRef: 'compatibility:nonpass',
					kind: 'INCOMPATIBLE'
				}
			},
			{
				...base,
				refusal: {
					...base.refusal,
					code: 'CSAA-E-REQUEST-MALFORMED',
					reasonCode: 'INVALID_REQUEST'
				},
				subjectResolution: { kind: 'NOT_APPLICABLE', reasonCode: 'REQUEST_NOT_ADMITTED' }
			}
		];
		for (const branch of branches)
			expect(validateAgentOperationResponse(branch)).toMatchObject({ state: 'VALID' });

		expectResponseRefused(
			{
				...base,
				subjectResolution: { accessDecisionRef: 'access-decision:denied', kind: 'FORBIDDEN' }
			},
			'MESSAGE_INVALID'
		);
		expectResponseRefused(
			{
				...base,
				currentness: {
					...base.currentness,
					snapshot: { kind: 'SNAPSHOT', snapshotId: 'snapshot:fabricated' }
				}
			},
			'CURRENTNESS_INVALID'
		);
	});

	it('preserves explicit unknown and conflict references instead of coercing either to clean', () => {
		const conflicting = partial() as Extract<AgentOperationResponse, { outcome: 'partial' }>;
		expect(
			validateAgentOperationResponse({
				...conflicting,
				capability: capability({
					capabilityCoverage: 'partial',
					conflict: 'conflicting',
					conflictRefs: ['conflict:provider-disagreement'],
					executionHealth: 'succeeded',
					limitationRefs: ['limit:conflicting-provider'],
					unknownRegionRefs: ['region:dynamic-entry']
				})
			})
		).toMatchObject({ state: 'VALID' });
		expectResponseRefused(
			{
				...conflicting,
				capability: capability({
					capabilityCoverage: 'partial',
					conflict: 'conflicting',
					conflictRefs: [],
					limitationRefs: ['limit:conflicting-provider']
				})
			},
			'CAPABILITY_INVALID'
		);
		expectResponseRefused(
			{
				...errorResponse(),
				capability: capability({
					capabilityCoverage: 'unsupported',
					coverageRefs: [],
					executionHealth: 'not-run',
					implementationState: 'UNIMPLEMENTED',
					limitationRefs: ['limit:not-implemented'],
					qualificationState: 'QUALIFIED'
				})
			},
			'CAPABILITY_INVALID'
		);
	});

	it('refuses a currentness claim with unresolved dependencies, invalidations, or subject mismatch', () => {
		for (const invalidCurrentness of [
			currentness({ unresolvedDependencyRefs: ['dependency:unobserved'] }),
			currentness({ invalidationRefs: ['invalidation:source-change'] }),
			currentness({ subject: { kind: 'SUBJECT', subjectId: 'subject:other' } })
		])
			expectResponseRefused(
				{ ...success(), currentness: invalidCurrentness },
				'CURRENTNESS_INVALID'
			);
	});
});

describe('agent operation exchange and canonical serialization', () => {
	it('binds response to exact request digest, operation, capability, questions, and subject', () => {
		const candidateRequest = request();
		const candidateResponse = success(candidateRequest);
		expect(validateAgentOperationExchange(candidateRequest, candidateResponse)).toMatchObject({
			state: 'VALID',
			value: {
				request: { requestId: 'request:one' },
				response: { requestId: 'request:one', outcome: 'success' }
			}
		});
		for (const mismatch of [
			{ ...candidateResponse, requestDigest: A },
			{ ...candidateResponse, requestId: 'request:other' },
			{
				...candidateResponse,
				operation: 'impact',
				operationVersion: AGENT_OPERATION_VERSIONS.impact
			},
			{
				...candidateResponse,
				capability: capability({ capabilityId: 'JAN-CSAA-CAP-031' })
			}
		])
			expect(validateAgentOperationExchange(candidateRequest, mismatch)).toMatchObject({
				diagnostic: { code: 'EXCHANGE_MISMATCH' },
				state: 'REFUSED'
			});
	});

	it('enforces required currentness while allowing explicitly historical partial evidence', () => {
		const stalePartial = partial() as Extract<AgentOperationResponse, { outcome: 'partial' }>;
		const staleResponse: AgentOperationResponse = {
			...stalePartial,
			currentness: currentness({
				freshnessEvidenceRefs: [],
				status: 'stale',
				unresolvedDependencyRefs: ['dependency:source-changed']
			})
		};
		expect(validateAgentOperationResponse(staleResponse)).toMatchObject({ state: 'VALID' });
		expect(validateAgentOperationExchange(request(), staleResponse)).toMatchObject({
			diagnostic: { code: 'EXCHANGE_MISMATCH' },
			state: 'REFUSED'
		});
		const historicalRequest = request({
			currentnessRequirement: {
				kind: 'ALLOW_HISTORICAL',
				rationaleRef: 'rationale:historical-comparison'
			}
		});
		const historicalResponse = {
			...staleResponse,
			requestDigest: requestDigest(historicalRequest)
		};
		expect(validateAgentOperationExchange(historicalRequest, historicalResponse)).toMatchObject({
			state: 'VALID'
		});
	});

	it('serializes canonical byte-identical JSON independent of object key insertion order', () => {
		const candidate = request();
		const first = serializeAgentProtocolMessage(candidate);
		const second = serializeAgentProtocolMessage(reverseObjectKeys(candidate));
		expect(first).toMatchObject({ state: 'SERIALIZED' });
		expect(second).toMatchObject({ state: 'SERIALIZED' });
		if (first.state !== 'SERIALIZED' || second.state !== 'SERIALIZED')
			throw new Error('unreachable');
		expect(second.json).toBe(first.json);
		expect(second.digest).toBe(first.digest);
		expect(first.bytes).toBe(Buffer.byteLength(first.json, 'utf8'));
		expect(JSON.parse(first.json)).toEqual(first.message);
		expectDeeplyFrozen(first);
	});

	it('refuses serialization over a caller byte budget and freezes safe diagnostics', () => {
		const refusal = serializeAgentProtocolMessage(request(), 1);
		expect(refusal).toMatchObject({
			diagnostic: {
				code: 'SERIALIZATION_BUDGET_EXCEEDED',
				phase: 'SERIALIZE'
			},
			state: 'REFUSED'
		});
		expectDeeplyFrozen(refusal);
	});

	it('freezes protocol registries, safety ceilings, and nonclaim disclosures', () => {
		expect(Object.isFrozen(AGENT_OPERATION_VERSIONS)).toBe(true);
		expect(Object.isFrozen(AGENT_OPERATION_PROTOCOL_SAFETY_CEILINGS)).toBe(true);
		expect(Object.isFrozen(AGENT_OPERATION_PROTOCOL_NONCLAIMS)).toBe(true);
	});
});
