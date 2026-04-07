import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeVerifier,
	type VerifierInvocationOptions,
	type VerifierResponse,
} from '../../../lib/roles/verifier';
import { VerdictType, Phase, Role, ClaimStatus, ClaimCriticality } from '../../../lib/types';
import type { Claim } from '../../../lib/types';

vi.mock('../../../lib/context');
vi.mock('../../../lib/database');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/integration/eventBus');

describe('Verifier Role', () => {
	const mockClaim: Claim = {
		claim_id: 'claim-123',
		dialogue_id: 'dialogue-123',
		turn_id: 1,
		statement: 'Database supports JSON',
		status: ClaimStatus.OPEN,
		criticality: ClaimCriticality.CRITICAL,
		introduced_by: Role.EXECUTOR,
		created_at: '2024-01-01T00:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('invokeVerifier', () => {
		it('assembles context for verifier role', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: {
					briefing: 'context briefing',
					tokenUsage: {},
				} as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Normalized statement',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Evidence supports claim',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeVerifier(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					role: Role.VERIFIER,
					phase: Phase.VERIFY,
				})
			);
		});

		it('includes claim in context extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeVerifier(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						claimToVerify: mockClaim,
					}),
				})
			);
		});

		it('parses VERIFIED verdict', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Normalized claim',
						disconfirming_queries: [
							{ query: 'Query 1', rationale: 'Test rationale' },
						],
						evidence_classifications: [
							{
								source: 'Documentation',
								type: 'AUTHORITATIVE',
								confidence: 0.95,
								summary: 'Evidence summary',
							},
						],
						verdict: 'VERIFIED',
						rationale: 'Strong authoritative evidence supports claim',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe('VERIFIED');
			}
		});

		it('parses CONDITIONAL verdict', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'CONDITIONAL',
						rationale: 'True under specific conditions',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe('CONDITIONAL');
			}
		});

		it('parses DISPROVED verdict', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'DISPROVED',
						rationale: 'Evidence contradicts claim',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe('DISPROVED');
			}
		});

		it('parses UNKNOWN verdict', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'UNKNOWN',
						rationale: 'Insufficient evidence',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe('UNKNOWN');
			}
		});

		it('adds IDs to disconfirming queries', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [
							{ query: 'Query 1', rationale: 'Rationale 1' },
							{ query: 'Query 2', rationale: 'Rationale 2' },
						],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.disconfirming_queries.length).toBe(2);
				expect(result.value.disconfirming_queries[0].query_id).toBeTruthy();
				expect(result.value.disconfirming_queries[1].query_id).toBeTruthy();
			}
		});

		it('adds IDs to evidence classifications', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [
							{ source: 'Docs', type: 'AUTHORITATIVE', confidence: 0.9, summary: 'Summary' },
							{ source: 'Blog', type: 'SUPPORTING', confidence: 0.7, summary: 'Summary 2' },
						],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.evidence_classifications.length).toBe(2);
				expect(result.value.evidence_classifications[0].classification_id).toBeTruthy();
				expect(result.value.evidence_classifications[1].classification_id).toBeTruthy();
			}
		});

		it('parses claim scope classification', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
						claim_scope: 'ATOMIC',
						decompose_required: false,
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim_scope).toBe('ATOMIC');
				expect(result.value.decompose_required).toBe(false);
			}
		});

		it('parses novel dependency flag', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
						novel_dependency: true,
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.novel_dependency).toBe(true);
			}
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context assembly failed'),
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});

		it('handles CLI invocation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});

		it('handles JSON parsing errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: 'Invalid JSON',
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});

		it('handles markdown code fences', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const jsonResponse = {
				normalized_claim: 'Claim',
				disconfirming_queries: [],
				evidence_classifications: [],
				verdict: 'VERIFIED',
				rationale: 'Rationale',
			};

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: '```json\n' + JSON.stringify(jsonResponse) + '\n```',
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
		});

		it('validates missing normalized_claim', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});

		it('validates invalid verdict type', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'INVALID_VERDICT',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});

		it('emits stdin content when commandId provided', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { emitWorkflowCommand } = await import('../../../lib/integration/eventBus');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
				commandId: 'cmd-123',
			};

			await invokeVerifier(options);

			expect(emitWorkflowCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					lineType: 'stdin',
				})
			);
		});

		it('includes checkForContradictions in extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
				checkForContradictions: true,
			};

			await invokeVerifier(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						checkForContradictions: true,
					}),
				})
			);
		});
	});

	describe('edge cases', () => {
		it('handles empty disconfirming queries', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.disconfirming_queries).toEqual([]);
			}
		});

		it('handles multiple evidence types', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [
							{ source: 'Official Docs', type: 'AUTHORITATIVE', confidence: 0.95, summary: 'S1' },
							{ source: 'Blog Post', type: 'SUPPORTING', confidence: 0.75, summary: 'S2' },
							{ source: 'Reddit Comment', type: 'ANECDOTAL', confidence: 0.5, summary: 'S3' },
							{ source: 'Assumption', type: 'SPECULATIVE', confidence: 0.3, summary: 'S4' },
						],
						verdict: 'VERIFIED',
						rationale: 'Rationale',
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.evidence_classifications.length).toBe(4);
			}
		});

		it('handles composite claim scope', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim',
						disconfirming_queries: [],
						evidence_classifications: [],
						verdict: 'UNKNOWN',
						rationale: 'Claim too broad to verify',
						claim_scope: 'COMPOSITE',
						decompose_required: true,
					}),
					exitCode: 0,
				} as any,
			});

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim_scope).toBe('COMPOSITE');
				expect(result.value.decompose_required).toBe(true);
			}
		});

		it('handles thrown errors', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockRejectedValue(new Error('Unexpected'));

			const options: VerifierInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				claimToVerify: mockClaim,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeVerifier(options);

			expect(result.success).toBe(false);
		});
	});

	describe('constraint waiver downgrade', () => {
		// Helper to set up all the mocks a waiver-downgrade test needs.
		// Returns a getDatabase mock whose `prepare(...).get(...)` can be tuned
		// per-test to simulate an active (or absent) waiver.
		async function setupWaiverMocks(options: {
			llmVerdict: 'VERIFIED' | 'CONDITIONAL' | 'DISPROVED' | 'UNKNOWN';
			llmConstraintsRef?: string;
			activeWaiverRow?: { waiver_id: string; expiration: string | null };
		}) {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getDatabase } = await import('../../../lib/database');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'base context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						normalized_claim: 'Claim under test',
						disconfirming_queries: [{ query: 'q', rationale: 'r' }],
						evidence_classifications: [{ source: 's', type: 'AUTHORITATIVE', confidence: 0.9, summary: 'e' }],
						verdict: options.llmVerdict,
						rationale: 'LLM verdict rationale',
						constraints_ref: options.llmConstraintsRef,
					}),
					exitCode: 0,
				} as any,
			});

			// Mock getDatabase to return a stub that handles both the waiver-lookup
			// (from hasActiveWaiver) and the getActiveWaivers list-lookup.
			const getWaiversResult = options.activeWaiverRow
				? [{
					waiver_id: options.activeWaiverRow.waiver_id,
					constraint_ref: options.llmConstraintsRef ?? 'unknown',
					justification: 'Test waiver justification',
					granted_by: 'test-admin@example.com',
					timestamp: new Date().toISOString(),
					expiration: options.activeWaiverRow.expiration,
				}]
				: [];

			const getFn = vi.fn().mockReturnValue(options.activeWaiverRow);
			const allFn = vi.fn().mockReturnValue(getWaiversResult);
			const prepareFn = vi.fn().mockReturnValue({ get: getFn, all: allFn });
			vi.mocked(getDatabase).mockReturnValue({ prepare: prepareFn } as any);

			return { prepareFn, getFn, allFn };
		}

		const testOptions: VerifierInvocationOptions = {
			dialogueId: 'test-dialogue-123',
			claimToVerify: mockClaim,
			provider: { id: 'test-provider', name: 'Test' } as any,
		};

		it('does not downgrade VERIFIED verdicts', async () => {
			await setupWaiverMocks({
				llmVerdict: 'VERIFIED',
				llmConstraintsRef: 'constraint-abc',
				activeWaiverRow: { waiver_id: 'w1', expiration: null },
			});

			const result = await invokeVerifier(testOptions);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe(VerdictType.VERIFIED);
				expect(result.value.rationale).not.toContain('WAIVER APPLIED');
			}
		});

		it('does not downgrade DISPROVED without constraints_ref', async () => {
			await setupWaiverMocks({
				llmVerdict: 'DISPROVED',
				// no llmConstraintsRef — the LLM didn't identify which constraint failed
			});

			const result = await invokeVerifier(testOptions);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe(VerdictType.DISPROVED);
				expect(result.value.rationale).not.toContain('WAIVER APPLIED');
			}
		});

		it('does not downgrade DISPROVED when no waiver is active', async () => {
			await setupWaiverMocks({
				llmVerdict: 'DISPROVED',
				llmConstraintsRef: 'constraint-xyz',
				// activeWaiverRow undefined → hasActiveWaiver returns false
			});

			const result = await invokeVerifier(testOptions);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe(VerdictType.DISPROVED);
				expect(result.value.rationale).not.toContain('WAIVER APPLIED');
			}
		});

		it('downgrades DISPROVED to CONDITIONAL when constraint has an active waiver', async () => {
			const futureDate = new Date(Date.now() + 86400000).toISOString();
			await setupWaiverMocks({
				llmVerdict: 'DISPROVED',
				llmConstraintsRef: 'constraint-xyz',
				activeWaiverRow: { waiver_id: 'w-abc', expiration: futureDate },
			});

			const result = await invokeVerifier(testOptions);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdict).toBe(VerdictType.CONDITIONAL);
				expect(result.value.rationale).toContain('WAIVER APPLIED');
				expect(result.value.rationale).toContain('constraint-xyz');
				// Original rationale should be preserved at the start
				expect(result.value.rationale).toContain('LLM verdict rationale');
			}
		});

		it('preserves the original rationale as a prefix when downgrading', async () => {
			await setupWaiverMocks({
				llmVerdict: 'DISPROVED',
				llmConstraintsRef: 'constraint-migration',
				activeWaiverRow: { waiver_id: 'w-mig', expiration: null },
			});

			const result = await invokeVerifier(testOptions);

			expect(result.success).toBe(true);
			if (result.success) {
				// The downgraded rationale is composed of the original + [WAIVER APPLIED] block
				expect(result.value.rationale.startsWith('LLM verdict rationale')).toBe(true);
			}
		});
	});
});
