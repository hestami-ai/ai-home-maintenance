import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeExecutorWithContext,
	invokeTechnicalExpertWithContext,
	invokeVerifierWithContext,
	invokeHistorianInterpreterWithContext,
	compileRoleContext,
} from '../../../lib/integration/roleConnector';
import { Role, Phase, ClaimStatus, ClaimCriticality, VerdictType, CodedError } from '../../../lib/types';
import type { Claim } from '../../../lib/types';
import type { RoleCLIProvider } from '../../../lib/cli/roleCLIProvider';
import type { ExecutorResponse } from '../../../lib/roles/executor';
import type { EvidencePacket } from '../../../lib/roles/technicalExpert';
import type { VerifierResponse } from '../../../lib/roles/verifier';
import type { HistorianInterpreterResponse } from '../../../lib/roles/historianInterpreter';
import { HistorianQueryType, type HandoffPacket } from '../../../lib/context/engineTypes';

// ─── Canonical fixture builders ──────────────────────────────────────

function makeExecutorResponse(overrides: Partial<ExecutorResponse> = {}): ExecutorResponse {
	return {
		proposal: 'Test proposal',
		assumptions: [],
		artifacts: [],
		constraint_adherence_notes: [],
		raw_response: 'raw',
		...overrides,
	};
}

function makeEvidencePacket(overrides: Partial<EvidencePacket> = {}): EvidencePacket {
	return {
		packet_id: 'pkt-1',
		question: 'Test question',
		answer: 'Test answer',
		evidence_references: [],
		confidence_level: 'HIGH',
		caveats: [],
		raw_response: 'raw',
		...overrides,
	};
}

function makeVerifierResponse(overrides: Partial<VerifierResponse> = {}): VerifierResponse {
	return {
		normalized_claim: 'Test claim',
		disconfirming_queries: [],
		evidence_classifications: [],
		verdict: VerdictType.VERIFIED,
		rationale: 'Test reasoning',
		raw_response: 'raw',
		...overrides,
	};
}

function makeHistorianResponse(overrides: Partial<HistorianInterpreterResponse> = {}): HistorianInterpreterResponse {
	return {
		query_type: HistorianQueryType.GENERAL_HISTORY,
		findings: [],
		contradictions: [],
		invariant_violations: [],
		precedents: [],
		summary: 'Test interpretation',
		raw_response: 'raw',
		...overrides,
	};
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
	return {
		claim_id: 'claim-1',
		dialogue_id: 'test-dialogue-123',
		turn_id: 1,
		statement: 'Test claim',
		status: ClaimStatus.OPEN,
		criticality: ClaimCriticality.NON_CRITICAL,
		introduced_by: Role.EXECUTOR,
		created_at: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

function makeHandoffPacket(briefing: string, overrides: Partial<HandoffPacket> = {}): HandoffPacket {
	return {
		briefing,
		sectionManifest: [],
		omissions: [],
		tokenAccounting: { budget: 10000, used: 1000, remaining: 9000, perSection: {} },
		sufficiency: { sufficient: true, missingRequired: [], warnings: [], confidenceLevel: 'high' },
		fingerprint: 'test-fp',
		diagnostics: {
			policyKey: 'test-policy',
			policyVersion: 1,
			handoffDocsConsumed: [],
			sqlQueriesExecuted: 0,
			agentReasoningTokens: 0,
			wallClockMs: 0,
		},
		...overrides,
	};
}

vi.mock('../../../lib/roles/executor');
vi.mock('../../../lib/roles/verifier');
vi.mock('../../../lib/roles/technicalExpert');
vi.mock('../../../lib/roles/historianInterpreter');
vi.mock('../../../lib/context');

describe('Role Connector Integration', () => {
	let mockProvider: RoleCLIProvider;

	beforeEach(() => {
		vi.clearAllMocks();

		mockProvider = {
			id: 'test-provider',
			name: 'Test Provider',
			detect: vi.fn(),
			invoke: vi.fn(),
			invokeStreaming: vi.fn(),
			getCommandPreview: vi.fn(),
		};
	});

	describe('invokeExecutorWithContext', () => {
		it('invokes executor with dialogue context', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse(),
			});

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider
			);

			expect(result.success).toBe(true);
			expect(invokeExecutor).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					goal: 'Test proposal',
					provider: mockProvider,
					includeHistoricalFindings: true,
				})
			);
		});

		it('applies custom token budget', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse({ proposal: '' }),
			});

			await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider,
				15000
			);

			expect(invokeExecutor).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenBudget: 15000,
				})
			);
		});

		it('uses default token budget when not specified', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse({ proposal: '' }),
			});

			await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider
			);

			expect(invokeExecutor).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenBudget: 10000,
				})
			);
		});

		it('handles executor invocation failure', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: false,
				error: new Error('Executor failed'),
			});

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider
			);

			expect(result.success).toBe(false);
		});

		it('handles executor throwing error', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockRejectedValue(new Error('Unexpected error'));

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Unexpected error');
			}
		});

		it('includes historical findings flag', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse({ proposal: '' }),
			});

			await invokeExecutorWithContext(
				'test-dialogue-123',
				'Test proposal',
				mockProvider
			);

			expect(invokeExecutor).toHaveBeenCalledWith(
				expect.objectContaining({
					includeHistoricalFindings: true,
				})
			);
		});
	});

	describe('invokeTechnicalExpertWithContext', () => {
		it('invokes technical expert with query', async () => {
			const { invokeTechnicalExpert } = await import('../../../lib/roles/technicalExpert');

			vi.mocked(invokeTechnicalExpert).mockResolvedValue({
				success: true,
				value: makeEvidencePacket({ answer: 'Test analysis' }),
			});

			const result = await invokeTechnicalExpertWithContext(
				'test-dialogue-123',
				'Technical query',
				mockProvider
			);

			expect(result.success).toBe(true);
			expect(invokeTechnicalExpert).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					question: 'Technical query',
					provider: mockProvider,
					includeHistoricalEvidence: true,
				})
			);
		});

		it('applies custom token budget', async () => {
			const { invokeTechnicalExpert } = await import('../../../lib/roles/technicalExpert');

			vi.mocked(invokeTechnicalExpert).mockResolvedValue({
				success: true,
				value: makeEvidencePacket({ answer: '' }),
			});

			await invokeTechnicalExpertWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider,
				20000
			);

			expect(invokeTechnicalExpert).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenBudget: 20000,
				})
			);
		});

		it('handles technical expert failure', async () => {
			const { invokeTechnicalExpert } = await import('../../../lib/roles/technicalExpert');

			vi.mocked(invokeTechnicalExpert).mockResolvedValue({
				success: false,
				error: new Error('Technical expert failed'),
			});

			const result = await invokeTechnicalExpertWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { invokeTechnicalExpert } = await import('../../../lib/roles/technicalExpert');

			vi.mocked(invokeTechnicalExpert).mockRejectedValue(new Error('Unexpected'));

			const result = await invokeTechnicalExpertWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
		});
	});

	describe('invokeVerifierWithContext', () => {
		it('invokes verifier with claim', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockResolvedValue({
				success: true,
				value: makeVerifierResponse(),
			});

			const claim = makeClaim();

			const result = await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(result.success).toBe(true);
			expect(invokeVerifier).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					claimToVerify: claim,
					provider: mockProvider,
					includeHistoricalVerdicts: true,
					checkForContradictions: true,
				})
			);
		});

		it('includes historical verdicts flag', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockResolvedValue({
				success: true,
				value: makeVerifierResponse({ rationale: '' }),
			});

			const claim = makeClaim();

			await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(invokeVerifier).toHaveBeenCalledWith(
				expect.objectContaining({
					includeHistoricalVerdicts: true,
				})
			);
		});

		it('enables contradiction checking', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockResolvedValue({
				success: true,
				value: makeVerifierResponse({ rationale: '' }),
			});

			const claim = makeClaim();

			await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(invokeVerifier).toHaveBeenCalledWith(
				expect.objectContaining({
					checkForContradictions: true,
				})
			);
		});

		it('handles verifier failure', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockResolvedValue({
				success: false,
				error: new Error('Verifier failed'),
			});

			const claim = makeClaim();

			const result = await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockRejectedValue(new Error('Unexpected'));

			const claim = makeClaim();

			const result = await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(result.success).toBe(false);
		});
	});

	describe('invokeHistorianInterpreterWithContext', () => {
		it('invokes historian interpreter with query', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockResolvedValue({
				success: true,
				value: makeHistorianResponse(),
			});

			const result = await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'History query',
				mockProvider
			);

			expect(result.success).toBe(true);
			expect(invokeHistorianInterpreter).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					query: 'History query',
					provider: mockProvider,
				})
			);
		});

		it('sets GENERAL_HISTORY query type', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockResolvedValue({
				success: true,
				value: makeHistorianResponse({ summary: '' }),
			});

			await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(invokeHistorianInterpreter).toHaveBeenCalledWith(
				expect.objectContaining({
					queryType: HistorianQueryType.GENERAL_HISTORY,
				})
			);
		});

		it('applies custom token budget', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockResolvedValue({
				success: true,
				value: makeHistorianResponse({ summary: '' }),
			});

			await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider,
				8000
			);

			expect(invokeHistorianInterpreter).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenBudget: 8000,
				})
			);
		});

		it('handles historian interpreter failure', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockResolvedValue({
				success: false,
				error: new Error('Historian failed'),
			});

			const result = await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockRejectedValue(new Error('Unexpected'));

			const result = await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
		});
	});

	describe('compileRoleContext', () => {
		it('compiles context for executor role', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Test context briefing'),
			});

			const result = await compileRoleContext(
				Role.EXECUTOR,
				'test-dialogue-123'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe('Test context briefing');
			}
			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					role: Role.EXECUTOR,
					phase: Phase.EXECUTE,
				})
			);
		});

		it('compiles context for verifier role', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Verifier context'),
			});

			const result = await compileRoleContext(
				Role.VERIFIER,
				'test-dialogue-123'
			);

			expect(result.success).toBe(true);
			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					role: Role.VERIFIER,
					phase: Phase.VERIFY,
				})
			);
		});

		it('compiles context for historian role', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Historian context'),
			});

			const result = await compileRoleContext(
				Role.HISTORIAN,
				'test-dialogue-123'
			);

			expect(result.success).toBe(true);
			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					role: Role.HISTORIAN,
					phase: Phase.HISTORICAL_CHECK,
				})
			);
		});

		it('compiles context for technical expert role', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Technical expert context'),
			});

			const result = await compileRoleContext(
				Role.TECHNICAL_EXPERT,
				'test-dialogue-123'
			);

			expect(result.success).toBe(true);
			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					role: Role.TECHNICAL_EXPERT,
					phase: Phase.PROPOSE,
				})
			);
		});

		it('applies custom token budget', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Context', {
					tokenAccounting: { budget: 5000, used: 5000, remaining: 0, perSection: {} },
				}),
			});

			await compileRoleContext(
				Role.EXECUTOR,
				'test-dialogue-123',
				5000
			);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					tokenBudget: 5000,
				})
			);
		});

		it('handles context compilation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context assembly failed'),
			});

			const result = await compileRoleContext(
				Role.EXECUTOR,
				'test-dialogue-123'
			);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockRejectedValue(new Error('Unexpected error'));

			const result = await compileRoleContext(
				Role.EXECUTOR,
				'test-dialogue-123'
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Unexpected error');
			}
		});

		it('uses default phase for unknown role', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: makeHandoffPacket('Context'),
			});

			await compileRoleContext(
				'UNKNOWN_ROLE' as Role,
				'test-dialogue-123'
			);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					phase: Phase.PROPOSE,
				})
			);
		});
	});

	describe('error handling', () => {
		it('wraps executor errors with coded error', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockRejectedValue(new Error('Test error'));

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Proposal',
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('EXECUTOR_INVOCATION_FAILED');
			}
		});

		it('wraps technical expert errors with coded error', async () => {
			const { invokeTechnicalExpert } = await import('../../../lib/roles/technicalExpert');

			vi.mocked(invokeTechnicalExpert).mockRejectedValue(new Error('Test error'));

			const result = await invokeTechnicalExpertWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('TECHNICAL_EXPERT_INVOCATION_FAILED');
			}
		});

		it('wraps verifier errors with coded error', async () => {
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeVerifier).mockRejectedValue(new Error('Test error'));

			const claim = makeClaim({ statement: 'Test' });

			const result = await invokeVerifierWithContext(
				'test-dialogue-123',
				claim,
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('VERIFIER_INVOCATION_FAILED');
			}
		});

		it('wraps historian errors with coded error', async () => {
			const { invokeHistorianInterpreter } = await import('../../../lib/roles/historianInterpreter');

			vi.mocked(invokeHistorianInterpreter).mockRejectedValue(new Error('Test error'));

			const result = await invokeHistorianInterpreterWithContext(
				'test-dialogue-123',
				'Query',
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('HISTORIAN_INVOCATION_FAILED');
			}
		});

		it('wraps context compilation errors with coded error', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockRejectedValue(new Error('Test error'));

			const result = await compileRoleContext(
				Role.EXECUTOR,
				'test-dialogue-123'
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('ROLE_CONTEXT_COMPILATION_FAILED');
			}
		});

		it('handles non-Error thrown values', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockRejectedValue('String error');

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Proposal',
				mockProvider
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toBe('Unknown error');
			}
		});
	});

	describe('integration scenarios', () => {
		it('handles full executor workflow', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse({
					proposal: 'Complete proposal with three artifacts',
					assumptions: [
						{ assumption_id: 'A-1', statement: 'Assumption 1', criticality: ClaimCriticality.NON_CRITICAL, rationale: 'rationale' },
					],
					artifacts: [
						{ artifact_id: 'art-1', type: 'CODE', content: 'code1', description: 'd1' },
						{ artifact_id: 'art-2', type: 'CODE', content: 'code2', description: 'd2' },
						{ artifact_id: 'art-3', type: 'CODE', content: 'code3', description: 'd3' },
					],
				}),
			});

			const result = await invokeExecutorWithContext(
				'test-dialogue-123',
				'Build feature X',
				mockProvider,
				12000
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.artifacts.length).toBe(3);
				expect(result.value.proposal).toContain('Complete');
			}
		});

		it('handles concurrent role invocations', async () => {
			const { invokeExecutor } = await import('../../../lib/roles/executor');
			const { invokeVerifier } = await import('../../../lib/roles/verifier');

			vi.mocked(invokeExecutor).mockResolvedValue({
				success: true,
				value: makeExecutorResponse({ proposal: '' }),
			});

			vi.mocked(invokeVerifier).mockResolvedValue({
				success: true,
				value: makeVerifierResponse({ rationale: '' }),
			});

			const claim = makeClaim({ statement: 'Test' });

			const results = await Promise.all([
				invokeExecutorWithContext('test-dialogue-123', 'Proposal', mockProvider),
				invokeVerifierWithContext('test-dialogue-123', claim, mockProvider),
			]);

			expect(results.every(r => r.success)).toBe(true);
		});
	});
});
