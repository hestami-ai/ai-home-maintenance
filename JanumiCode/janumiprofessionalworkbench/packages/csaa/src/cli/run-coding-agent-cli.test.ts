import { describe, expect, it, vi } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	agentOperationRequestDigest,
	validateAgentOperationExchange,
	validateAgentOperationResponse,
	type AgentCapabilityStatus,
	type AgentCurrentnessStatus,
	type AgentOperation,
	type AgentOperationRequest,
	type AgentOperationResponse
} from '../agent/agent-operation-protocol.js';
import {
	CODING_AGENT_CLI_EXIT_CODES,
	CODING_AGENT_CLI_IMPLEMENTATION_STATE,
	CODING_AGENT_CLI_INPUT_CONTRACT_ID,
	CODING_AGENT_CLI_INPUT_VERSION,
	CODING_AGENT_CLI_NONCLAIMS,
	CODING_AGENT_CLI_VERSION,
	admitCodingAgentCliArguments,
	codingAgentCliExitCode,
	codingAgentCliInputDigest,
	type CodingAgentCliOperationInput
} from './coding-agent-cli-contract.js';
import { runCodingAgentCli, type CodingAgentCliHandlerContext } from './run-coding-agent-cli.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const RESPONSE_AT = '2026-08-25T00:00:01.000Z';

function inputFor(operation: AgentOperation): CodingAgentCliOperationInput {
	const common = {
		bindingRef: `input:${operation}:one`,
		output: 'STDOUT_JSON' as const,
		schemaVersion: CODING_AGENT_CLI_INPUT_VERSION
	};
	switch (operation) {
		case 'inventory':
			return { ...common, kind: 'INVENTORY', subjectInputRef: 'subject:one' };
		case 'snapshot':
			return { ...common, kind: 'SNAPSHOT', subjectInputRef: 'subject:one' };
		case 'query':
			return { ...common, kind: 'QUERY', queryRef: 'query:one', snapshotRef: 'snapshot:one' };
		case 'impact':
			return {
				...common,
				changeSetRef: 'change-set:one',
				kind: 'IMPACT',
				snapshotRef: 'snapshot:one'
			};
		case 'findings':
			return {
				...common,
				kind: 'FINDINGS',
				ruleProfileRef: 'rule-profile:one',
				snapshotRef: 'snapshot:one'
			};
		case 'explain':
			return {
				...common,
				explanationProfileRef: 'explanation-profile:one',
				kind: 'EXPLAIN',
				resultRef: 'result:one'
			};
		case 'verify':
			return {
				...common,
				expectationRef: 'expectation:one',
				kind: 'VERIFY',
				subjectInputRef: 'subject:one'
			};
	}
}

function requestFor(
	operation: AgentOperation,
	input: CodingAgentCliOperationInput = inputFor(operation),
	overrides: Partial<AgentOperationRequest> = {}
): AgentOperationRequest {
	const inputDigest = codingAgentCliInputDigest(input);
	if (inputDigest.state !== 'VALID') throw new Error(JSON.stringify(inputDigest));
	return {
		budgets: {
			maxDepth: 16,
			maxEdges: 10_000,
			maxNodes: 5_000,
			maxOutputBytes: 500_000,
			maxResults: 1_000,
			timeoutMs: 30_000
		},
		capabilityRequirement: {
			affectedQuestionRefs: [`question:${operation}`],
			capabilityId: `JAN-CSAA-CAP-${operation}`,
			capabilityVersion: `JAN-CSAA-CAP-${operation}@0.1.0`,
			necessity: 'MANDATORY'
		},
		currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
		messageKind: 'request',
		operation,
		operationInput: {
			contractId: CODING_AGENT_CLI_INPUT_CONTRACT_ID,
			contractVersion: CODING_AGENT_CLI_INPUT_VERSION,
			inputDigest: inputDigest.digest,
			inputRef: input.bindingRef
		},
		operationVersion: AGENT_OPERATION_VERSIONS[operation],
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestId: `request:${operation}:one`,
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

function argvFor(
	operation: AgentOperation,
	request: AgentOperationRequest = requestFor(operation),
	input: CodingAgentCliOperationInput = inputFor(operation)
): string[] {
	return [
		operation,
		'--request-json',
		JSON.stringify(request),
		'--input-json',
		JSON.stringify(input),
		'--output',
		'json'
	];
}

function digest(request: AgentOperationRequest): string {
	const outcome = agentOperationRequestDigest(request);
	if (outcome.state !== 'VALID') throw new Error(JSON.stringify(outcome));
	return outcome.value;
}

function capability(
	request: AgentOperationRequest,
	overrides: Partial<AgentCapabilityStatus> = {}
): AgentCapabilityStatus {
	return {
		affectedQuestionRefs: request.capabilityRequirement.affectedQuestionRefs,
		capabilityCoverage: 'supported',
		capabilityId: request.capabilityRequirement.capabilityId,
		capabilityVersion: request.capabilityRequirement.capabilityVersion,
		conflict: 'unopposed',
		conflictRefs: [],
		coverageRefs: ['coverage:complete'],
		excludedRegionRefs: [],
		executionHealth: 'succeeded',
		implementationState: 'IMPLEMENTED',
		limitationRefs: [],
		provenanceRefs: ['provenance:operation'],
		providerRefs: ['provider:test'],
		qualificationState: 'QUALIFIED',
		unknownRegionRefs: [],
		...overrides
	};
}

function currentness(subjectId = 'subject:one'): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: ['freshness:rechecked'],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:operation',
		snapshot: { kind: 'SNAPSHOT', snapshotId: 'snapshot:one' },
		status: 'current-for-subject',
		subject: { kind: 'SUBJECT', subjectId },
		unresolvedDependencyRefs: []
	};
}

function unresolvedCurrentness(reasonCode: string): AgentCurrentnessStatus {
	return {
		freshnessEvidenceRefs: [],
		invalidationRefs: [],
		observationCutoffRef: 'cutoff:subject-resolution',
		snapshot: { kind: 'NOT_APPLICABLE', reasonCode },
		status: 'unknown',
		subject: { kind: 'NOT_APPLICABLE', reasonCode },
		unresolvedDependencyRefs: []
	};
}

function responseBase(request: AgentOperationRequest, responseAt: string, responseId: string) {
	return {
		capability: capability(request),
		currentness: currentness(),
		messageKind: 'response' as const,
		operation: request.operation,
		operationVersion: request.operationVersion,
		protocolVersion: request.protocolVersion,
		requestDigest: digest(request),
		requestId: request.requestId,
		responseAt,
		responseId,
		subjectResolution: {
			kind: 'RESOLVED' as const,
			resolutionEvidenceRefs: ['subject-resolution:test'],
			subjectId: 'subject:one'
		},
		warningRefs: [] as string[]
	};
}

function progress(request: AgentOperationRequest): AgentOperationResponse {
	return {
		...responseBase(request, '2026-08-25T00:00:00.500Z', 'response:progress:one'),
		capability: capability(request, { executionHealth: 'not-run' }),
		exitCategory: 'IN_PROGRESS',
		outcome: 'progress',
		progress: {
			completedUnits: 1,
			progressRef: 'progress:one',
			stageRef: 'stage:analysis',
			totalUnits: 2,
			unitKind: 'PROJECT'
		},
		state: 'running'
	};
}

function success(request: AgentOperationRequest): AgentOperationResponse {
	return {
		...responseBase(request, RESPONSE_AT, 'response:success:one'),
		exitCategory: 'SUCCESS',
		outcome: 'success',
		result: { resultDigest: C, resultRef: 'result:one' },
		state: 'succeeded'
	};
}

function partial(request: AgentOperationRequest): AgentOperationResponse {
	return {
		...responseBase(request, RESPONSE_AT, 'response:partial:one'),
		capability: capability(request, {
			capabilityCoverage: 'partial',
			executionHealth: 'resource-exhausted',
			limitationRefs: ['limit:result-budget'],
			unknownRegionRefs: ['region:unvisited']
		}),
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		outcome: 'partial',
		partial: {
			admittedResultRefs: ['result:partial'],
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

function failedExpectation(request: AgentOperationRequest): AgentOperationResponse {
	return {
		...responseBase(request, RESPONSE_AT, 'response:conflict:one'),
		capability: capability(request, {
			conflict: 'conflicting',
			conflictRefs: ['conflict:provider-disagreement'],
			executionHealth: 'failed',
			qualificationState: 'NONPASS'
		}),
		exitCategory: 'FAILED_EXPECTATION',
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: ['evidence:provider-comparison'],
			blockedActionRef: 'action:publish-conclusion',
			blockedClaimRefs: ['claim:analysis-conclusion'],
			code: 'CSAA-E-PROVIDER-DISAGREEMENT',
			failedPredicateRef: 'predicate:provider-agreement',
			fallbackLimitRefs: ['limit:no-manufactured-consensus'],
			provenanceRefs: ['provenance:provider-comparison'],
			reasonCode: 'CONFLICT_REQUIRES_ESCALATION',
			requiredNextActionRef: 'next:reconcile-provider-evidence',
			residualRiskRef: 'risk:conflicting-analysis',
			responsibleOwnerRef: 'owner:capability',
			retryability: 'UNKNOWN',
			unaffectedScopeRefs: []
		},
		state: 'incompatible'
	};
}

function interrupted(
	request: AgentOperationRequest,
	kind: 'BUDGET' | 'CANCELLED' | 'TIMED_OUT'
): AgentOperationResponse {
	const details =
		kind === 'BUDGET'
			? {
					code: 'CSAA-E-EXECUTION-BUDGET-REFUSED' as const,
					health: 'resource-exhausted' as const,
					reasonCode: 'BUDGET_REFUSED' as const,
					state: 'resource-refused' as const
				}
			: kind === 'CANCELLED'
				? {
						code: 'CSAA-E-EXECUTION-CANCELLED' as const,
						health: 'cancelled' as const,
						reasonCode: 'CANCELLED' as const,
						state: 'cancelled' as const
					}
				: {
						code: 'CSAA-E-EXECUTION-TIMED-OUT' as const,
						health: 'timed-out' as const,
						reasonCode: 'TIMED_OUT' as const,
						state: 'timed-out' as const
					};
	return {
		...responseBase(request, RESPONSE_AT, `response:${kind.toLowerCase()}:one`),
		capability: capability(request, {
			capabilityCoverage: 'partial',
			executionHealth: details.health,
			limitationRefs: [`limit:${kind.toLowerCase()}`],
			unknownRegionRefs: ['region:unfinished']
		}),
		exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: ['evidence:bounded-execution'],
			blockedActionRef: 'action:complete-analysis',
			blockedClaimRefs: ['claim:complete-analysis'],
			code: details.code,
			failedPredicateRef: 'predicate:bounded-execution-complete',
			fallbackLimitRefs: ['limit:unfinished-region'],
			provenanceRefs: ['provenance:execution-control'],
			reasonCode: details.reasonCode,
			requiredNextActionRef: 'next:review-execution-limit',
			residualRiskRef: 'risk:unfinished-analysis',
			responsibleOwnerRef: 'owner:analysis-client',
			retryability: 'RETRYABLE',
			unaffectedScopeRefs: []
		},
		state: details.state
	};
}

function subjectFailure(
	request: AgentOperationRequest,
	kind: 'FORBIDDEN' | 'NOT_FOUND'
): AgentOperationResponse {
	const forbidden = kind === 'FORBIDDEN';
	return {
		...responseBase(request, RESPONSE_AT, `response:${kind.toLowerCase()}:one`),
		capability: capability(request, {
			capabilityCoverage: 'not-analyzed',
			coverageRefs: [],
			executionHealth: 'not-run',
			limitationRefs: ['limit:subject-unresolved'],
			providerRefs: [],
			qualificationState: 'UNKNOWN',
			unknownRegionRefs: ['region:subject']
		}),
		currentness: unresolvedCurrentness(forbidden ? 'SUBJECT_FORBIDDEN' : 'SUBJECT_NOT_FOUND'),
		exitCategory: 'INVALID_REQUEST',
		outcome: 'error',
		refusal: {
			attemptedEvidenceRefs: ['evidence:subject-resolution'],
			blockedActionRef: 'action:analysis',
			blockedClaimRefs: ['claim:analysis'],
			code: forbidden ? 'CSAA-E-AUTH-UNAUTHORIZED' : 'CSAA-E-SUBJECT-UNIDENTIFIED',
			failedPredicateRef: forbidden
				? 'predicate:subject-access-authorized'
				: 'predicate:exact-subject-resolved',
			fallbackLimitRefs: ['limit:no-analysis'],
			provenanceRefs: ['provenance:subject-resolution'],
			reasonCode: forbidden ? 'AUTHORIZATION_REFUSED' : 'SUBJECT_UNRESOLVED',
			requiredNextActionRef: forbidden ? 'next:obtain-authorization' : 'next:resolve-subject',
			residualRiskRef: 'risk:analysis-unavailable',
			responsibleOwnerRef: 'owner:subject-resolution',
			retryability: forbidden ? 'NOT_RETRYABLE' : 'RETRYABLE',
			unaffectedScopeRefs: []
		},
		state: forbidden ? 'authorization-refused' : 'failed',
		subjectResolution: forbidden
			? { accessDecisionRef: 'access-decision:denied', kind: 'FORBIDDEN' }
			: { kind: 'NOT_FOUND', locatorDigest: A, reasonCode: 'NO_MATCH' }
	};
}

describe('coding-agent CLI contract and routing foundation', () => {
	it('declares local unregistered scope and the exact terminal exit mapping', () => {
		expect(CODING_AGENT_CLI_VERSION).toBe('jan-csaa-coding-agent-cli/0.1.0');
		expect(CODING_AGENT_CLI_IMPLEMENTATION_STATE).toBe('IMPLEMENTATION_LOCAL_UNREGISTERED');
		expect(CODING_AGENT_CLI_NONCLAIMS).toHaveLength(4);
		expect(CODING_AGENT_CLI_NONCLAIMS.join(' ')).toContain('does not itself resolve subjects');
		expect(CODING_AGENT_CLI_EXIT_CODES).toEqual({
			FAILED_EXPECTATION: 4,
			INCOMPLETE_OR_UNSUPPORTED: 3,
			INTERNAL_FAILURE: 5,
			INVALID_REQUEST: 2,
			SUCCESS: 0
		});
		expect(codingAgentCliExitCode('SUCCESS')).toBe(0);
		expect(codingAgentCliExitCode('INVALID_REQUEST')).toBe(2);
		expect(codingAgentCliExitCode('INCOMPLETE_OR_UNSUPPORTED')).toBe(3);
		expect(codingAgentCliExitCode('FAILED_EXPECTATION')).toBe(4);
		expect(codingAgentCliExitCode('INTERNAL_FAILURE')).toBe(5);
	});

	it('admits all seven exact commands and fails closed to typed unsupported output without handlers', async () => {
		for (const operation of [
			'inventory',
			'snapshot',
			'query',
			'impact',
			'findings',
			'explain',
			'verify'
		] as const) {
			const request = requestFor(operation);
			const run = await runCodingAgentCli(argvFor(operation, request), {
				now: () => RESPONSE_AT
			});
			expect(run).toMatchObject({ exitCode: 3, state: 'COMPLETED', stderr: '' });
			if (run.state !== 'COMPLETED') throw new Error('Expected a terminal response.');
			expect(run.terminalResponse).toMatchObject({
				capability: {
					capabilityCoverage: 'unsupported',
					executionHealth: 'not-run',
					implementationState: 'UNIMPLEMENTED'
				},
				exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
				operation,
				refusal: {
					code: 'CSAA-E-CAPABILITY-UNSUPPORTED',
					reasonCode: 'UNIMPLEMENTED_CAPABILITY'
				},
				subjectResolution: { kind: 'RESOLVED', subjectId: 'subject:one' }
			});
			expect(validateAgentOperationExchange(request, JSON.parse(run.stdout))).toMatchObject({
				state: 'VALID'
			});
		}
	});

	it('does not fabricate a subject when locator resolution integration is unavailable', async () => {
		const input = { ...inputFor('inventory'), subjectInputRef: 'locator:repo' };
		const request = requestFor('inventory', input, {
			subjectInput: {
				kind: 'SUBJECT_LOCATOR',
				locatorDigest: A,
				locatorRef: 'locator:repo',
				resolutionPolicyRef: 'policy:exact'
			}
		});
		const run = await runCodingAgentCli(argvFor('inventory', request, input), {
			now: () => RESPONSE_AT
		});
		expect(run).toMatchObject({
			exitCode: 2,
			state: 'COMPLETED',
			terminalResponse: {
				refusal: { code: 'CSAA-E-SUBJECT-UNAVAILABLE' },
				subjectResolution: { kind: 'UNAVAILABLE' }
			}
		});
		expect(run.stdout).not.toContain('"subjectId"');
	});

	it('routes validated progress only to stderr and one success only to stdout', async () => {
		const request = requestFor('query');
		const handler = vi.fn((_context: CodingAgentCliHandlerContext) => [
			progress(request),
			success(request)
		]);
		const run = await runCodingAgentCli(argvFor('query', request), {
			handlers: { query: handler },
			now: () => RESPONSE_AT
		});
		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0]?.[0]).toMatchObject({
			implementationState: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			invocation: { command: 'query', output: 'json' }
		});
		expect(run).toMatchObject({ exitCode: 0, state: 'COMPLETED' });
		expect(run.stderr.trim().split('\n')).toHaveLength(1);
		expect(JSON.parse(run.stderr)).toMatchObject({
			exitCategory: 'IN_PROGRESS',
			outcome: 'progress'
		});
		expect(JSON.parse(run.stdout)).toMatchObject({ exitCategory: 'SUCCESS', outcome: 'success' });
		expect(run.stdout).not.toContain('progress:one');
		expect(run.stderr).not.toContain('result:one');
	});

	it('preserves partial and failed-expectation terminal categories without human reinterpretation', async () => {
		const request = requestFor('impact');
		const partialRun = await runCodingAgentCli(argvFor('impact', request), {
			handlers: { impact: () => [partial(request)] },
			now: () => RESPONSE_AT
		});
		expect(partialRun).toMatchObject({
			exitCode: 3,
			terminalResponse: {
				exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
				outcome: 'partial',
				partial: { continuation: { kind: 'TOKEN' }, missingRegionRefs: ['region:unvisited'] }
			}
		});
		const failedRun = await runCodingAgentCli(argvFor('impact', request), {
			handlers: { impact: () => [failedExpectation(request)] },
			now: () => RESPONSE_AT
		});
		expect(failedRun).toMatchObject({
			exitCode: 4,
			terminalResponse: {
				exitCategory: 'FAILED_EXPECTATION',
				refusal: { code: 'CSAA-E-PROVIDER-DISAGREEMENT' }
			}
		});
	});

	it.each(['BUDGET', 'CANCELLED', 'TIMED_OUT'] as const)(
		'routes %s exhaustion as incomplete without converting it to success',
		async (kind) => {
			const request = requestFor('query');
			const run = await runCodingAgentCli(argvFor('query', request), {
				handlers: { query: () => [interrupted(request, kind)] },
				now: () => RESPONSE_AT
			});
			expect(run).toMatchObject({
				exitCode: 3,
				terminalResponse: {
					exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
					outcome: 'error'
				}
			});
			expect(run.stdout).not.toContain('"outcome":"success"');
		}
	);

	it('enforces the admitted timeout and supplies cooperative cancellation to the handler', async () => {
		const input = inputFor('query');
		const baseRequest = requestFor('query', input);
		const request = {
			...baseRequest,
			budgets: { ...baseRequest.budgets, timeoutMs: 1 }
		};
		let handlerSignal: AbortSignal | undefined;
		const run = await runCodingAgentCli(argvFor('query', request, input), {
			handlers: {
				query: ({ signal }) => {
					handlerSignal = signal;
					return new Promise<readonly unknown[]>(() => undefined);
				}
			},
			now: () => RESPONSE_AT
		});
		expect(handlerSignal?.aborted).toBe(true);
		expect(run).toMatchObject({
			exitCode: 3,
			terminalResponse: {
				capability: { executionHealth: 'timed-out' },
				refusal: { code: 'CSAA-E-EXECUTION-TIMED-OUT' },
				state: 'timed-out'
			}
		});
	});

	it('honors an already-cancelled host signal without invoking the operation handler', async () => {
		const request = requestFor('query');
		const controller = new AbortController();
		controller.abort();
		const handler = vi.fn((_context: CodingAgentCliHandlerContext) => [success(request)]);
		const run = await runCodingAgentCli(argvFor('query', request), {
			handlers: { query: handler },
			now: () => RESPONSE_AT,
			signal: controller.signal
		});
		expect(handler).not.toHaveBeenCalled();
		expect(run).toMatchObject({
			exitCode: 3,
			terminalResponse: {
				capability: { executionHealth: 'cancelled' },
				refusal: { code: 'CSAA-E-EXECUTION-CANCELLED' },
				state: 'cancelled'
			}
		});
	});

	it('routes exact forbidden and not-found subject outcomes without a substitute subject', async () => {
		const resolvedRequest = requestFor('verify');
		const forbiddenRun = await runCodingAgentCli(argvFor('verify', resolvedRequest), {
			handlers: { verify: () => [subjectFailure(resolvedRequest, 'FORBIDDEN')] },
			now: () => RESPONSE_AT
		});
		expect(forbiddenRun).toMatchObject({
			exitCode: 2,
			terminalResponse: { subjectResolution: { kind: 'FORBIDDEN' } }
		});
		expect(forbiddenRun.stdout).not.toContain('"subjectId"');

		const input = { ...inputFor('inventory'), subjectInputRef: 'locator:repo' };
		const locatorRequest = requestFor('inventory', input, {
			subjectInput: {
				kind: 'SUBJECT_LOCATOR',
				locatorDigest: A,
				locatorRef: 'locator:repo',
				resolutionPolicyRef: 'policy:exact'
			}
		});
		const notFoundRun = await runCodingAgentCli(argvFor('inventory', locatorRequest, input), {
			handlers: { inventory: () => [subjectFailure(locatorRequest, 'NOT_FOUND')] },
			now: () => RESPONSE_AT
		});
		expect(notFoundRun).toMatchObject({
			exitCode: 2,
			terminalResponse: {
				refusal: { code: 'CSAA-E-SUBJECT-UNIDENTIFIED' },
				subjectResolution: { kind: 'NOT_FOUND', locatorDigest: A }
			}
		});
		expect(notFoundRun.stdout).not.toContain('"subjectId"');
	});

	it('produces byte-identical output for fixed input and the declared response timestamp', async () => {
		const request = requestFor('snapshot');
		const input = inputFor('snapshot');
		const first = await runCodingAgentCli(argvFor('snapshot', request, input), {
			now: () => RESPONSE_AT
		});
		const reordered = [
			'snapshot',
			'--output',
			'json',
			'--input-json',
			JSON.stringify(input),
			'--request-json',
			JSON.stringify(request)
		];
		const second = await runCodingAgentCli(reordered, { now: () => RESPONSE_AT });
		expect(second).toEqual(first);
		expect(first.stdout.endsWith('\n')).toBe(true);
	});

	it.each([
		{
			code: 'CLI_COMMAND_UNSUPPORTED',
			mutate: (argv: string[]) => ['delete', ...argv.slice(1)]
		},
		{
			code: 'CLI_OUTPUT_UNSUPPORTED',
			mutate: (argv: string[]) => [...argv.slice(0, 6), 'human']
		},
		{
			code: 'CLI_REQUEST_JSON_INVALID',
			mutate: (argv: string[]) => [argv[0]!, argv[1]!, '{', ...argv.slice(3)]
		},
		{
			code: 'CLI_FLAG_DUPLICATE',
			mutate: (argv: string[]) => [
				argv[0]!,
				argv[1]!,
				argv[2]!,
				'--output',
				'json',
				'--output',
				'json'
			]
		},
		{
			code: 'CLI_FLAG_UNSUPPORTED',
			mutate: (argv: string[]) => [argv[0]!, '--request-file', argv[2]!, ...argv.slice(3)]
		}
	])(
		'refuses hostile or open argv as versioned stderr diagnostics: $code',
		async ({ code, mutate }) => {
			const handler = vi.fn(() => []);
			const run = await runCodingAgentCli(mutate(argvFor('query')), {
				handlers: { query: handler }
			});
			expect(run).toMatchObject({ exitCode: 2, state: 'ADMISSION_REFUSED', stdout: '' });
			expect(JSON.parse(run.stderr)).toMatchObject({
				cliVersion: CODING_AGENT_CLI_VERSION,
				code,
				messageKind: 'cli-diagnostic',
				severity: 'error'
			});
			expect(handler).not.toHaveBeenCalled();
		}
	);

	it.each([
		{
			code: 'CLI_INPUT_INVALID',
			input: { ...inputFor('query'), injected: true }
		},
		{
			code: 'CLI_REFERENCE_UNSAFE',
			input: { ...inputFor('query'), queryRef: '../subject/code.ts' }
		},
		{
			code: 'CLI_REFERENCE_UNSAFE',
			input: { ...inputFor('query'), queryRef: 'C:/subject/code.ts' }
		},
		{
			code: 'CLI_INPUT_INVALID',
			input: { ...inputFor('query'), queryRef: 'query:one;Remove-Item' }
		}
	])(
		'rejects open, path, traversal, and injection input before handler invocation: $code',
		async ({ code, input }) => {
			const handler = vi.fn(() => []);
			const request = requestFor('query');
			const run = await runCodingAgentCli(
				argvFor('query', request, input as CodingAgentCliOperationInput),
				{
					handlers: { query: handler }
				}
			);
			expect(run).toMatchObject({ exitCode: 2, state: 'ADMISSION_REFUSED', stdout: '' });
			expect(JSON.parse(run.stderr)).toMatchObject({ code });
			expect(handler).not.toHaveBeenCalled();
		}
	);

	it('rejects request/input digest mismatch, unsafe request paths, shell syntax, and unusable output budgets', async () => {
		const baseInput = inputFor('query');
		const baseRequest = requestFor('query');
		const cases: readonly [string, AgentOperationRequest, CodingAgentCliOperationInput][] = [
			[
				'CLI_INPUT_BINDING_MISMATCH',
				{ ...baseRequest, operationInput: { ...baseRequest.operationInput, inputDigest: B } },
				baseInput
			],
			[
				'CLI_REFERENCE_UNSAFE',
				{
					...baseRequest,
					operationInput: { ...baseRequest.operationInput, inputRef: 'C:/subject/input.json' }
				},
				baseInput
			],
			['CLI_REQUEST_INVALID', { ...baseRequest, requestId: 'request:one;whoami' }, baseInput],
			[
				'CLI_OUTPUT_BUDGET_TOO_SMALL',
				{ ...baseRequest, budgets: { ...baseRequest.budgets, maxOutputBytes: 1 } },
				baseInput
			]
		];
		for (const [code, request, input] of cases) {
			const run = await runCodingAgentCli(argvFor('query', request, input));
			expect(run).toMatchObject({ exitCode: 2, state: 'ADMISSION_REFUSED', stdout: '' });
			expect(JSON.parse(run.stderr)).toMatchObject({ code });
			expect(run.stderr).not.toContain('whoami');
		}
	});

	it('refuses proxy and accessor input or argv without invoking accessors', () => {
		expect(codingAgentCliInputDigest(new Proxy(inputFor('query'), {}))).toMatchObject({
			diagnostic: { code: 'CLI_INPUT_INVALID' },
			state: 'REFUSED'
		});
		let getterHits = 0;
		const hostile = Object.defineProperty({}, 'kind', {
			enumerable: true,
			get() {
				getterHits += 1;
				return 'QUERY';
			}
		});
		expect(codingAgentCliInputDigest(hostile)).toMatchObject({
			diagnostic: { code: 'CLI_INPUT_INVALID' },
			state: 'REFUSED'
		});
		expect(getterHits).toBe(0);
		const hostileArgv = argvFor('query');
		Object.defineProperty(hostileArgv, '2', {
			enumerable: true,
			get() {
				getterHits += 1;
				return JSON.stringify(requestFor('query'));
			}
		});
		expect(admitCodingAgentCliArguments(hostileArgv)).toMatchObject({
			diagnostic: { code: 'CLI_ARGUMENT_ENCODING_INVALID' },
			state: 'REFUSED'
		});
		expect(getterHits).toBe(0);
	});

	it('converts thrown, malformed, reordered, duplicate, and unterminated handler streams to one safe internal response', async () => {
		const request = requestFor('query');
		const hostileError = 'SECRET_SOURCE_TEXT_SHOULD_NOT_ESCAPE';
		const cases: readonly (() => Promise<readonly unknown[]> | readonly unknown[])[] = [
			() => {
				throw new Error(hostileError);
			},
			() => [],
			() => [progress(request)],
			() => [success(request), progress(request)],
			() => [success(request), success(request)],
			() => [new Proxy(success(request), {})]
		];
		for (const handler of cases) {
			const run = await runCodingAgentCli(argvFor('query', request), {
				handlers: { query: handler },
				now: () => RESPONSE_AT
			});
			expect(run).toMatchObject({
				exitCode: 5,
				state: 'COMPLETED',
				stderr: '',
				terminalResponse: {
					exitCategory: 'INTERNAL_FAILURE',
					refusal: { code: 'CSAA-E-INTERNAL-UNEXPECTED' }
				}
			});
			expect(run.stdout).not.toContain(hostileError);
			expect(validateAgentOperationResponse(JSON.parse(run.stdout))).toMatchObject({
				state: 'VALID'
			});
		}
	});

	it('refuses an accessor-bearing handler stream without reading the accessor', async () => {
		const request = requestFor('query');
		let getterHits = 0;
		const stream: unknown[] = [success(request)];
		Object.defineProperty(stream, '0', {
			enumerable: true,
			get() {
				getterHits += 1;
				return success(request);
			}
		});
		const run = await runCodingAgentCli(argvFor('query', request), {
			handlers: { query: () => stream },
			now: () => RESPONSE_AT
		});
		expect(run).toMatchObject({
			exitCode: 5,
			terminalResponse: { refusal: { code: 'CSAA-E-INTERNAL-UNEXPECTED' } }
		});
		expect(getterHits).toBe(0);
	});

	it('exposes the exact admitted invocation but never filesystem or human-output modes', () => {
		const admission = admitCodingAgentCliArguments(argvFor('findings'));
		expect(admission).toMatchObject({
			invocation: {
				cliVersion: CODING_AGENT_CLI_VERSION,
				command: 'findings',
				input: {
					kind: 'FINDINGS',
					output: 'STDOUT_JSON',
					ruleProfileRef: 'rule-profile:one',
					snapshotRef: 'snapshot:one'
				},
				output: 'json'
			},
			state: 'ADMITTED'
		});
	});
});
