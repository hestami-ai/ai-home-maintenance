import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeTechnicalExpert,
	extractEvidenceReferences,
	type TechnicalExpertInvocationOptions,
	type EvidencePacket,
} from '../../../lib/roles/technicalExpert';
import { Phase, Role } from '../../../lib/types';

vi.mock('../../../lib/context');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/context/workspaceReader.js');

describe('Technical Expert Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('invokeTechnicalExpert', () => {
		it('assembles context for technical expert role', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace summary');
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
						answer: 'Technical answer',
						evidence_references: [],
						confidence_level: 'HIGH',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'How does X work?',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeTechnicalExpert(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					role: Role.TECHNICAL_EXPERT,
					phase: Phase.PROPOSE,
				})
			);
		});

		it('includes question in context extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Explain API behavior',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeTechnicalExpert(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						question: 'Explain API behavior',
					}),
				})
			);
		});

		it('parses HIGH confidence evidence packet', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Detailed technical explanation with multiple sources',
						evidence_references: [
							{
								type: 'API_DOC',
								url: 'https://docs.example.com/api',
								description: 'Official API documentation',
								relevance_score: 0.95,
							},
						],
						confidence_level: 'HIGH',
						caveats: ['Only applies to version 2.0+'],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test question',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.confidence_level).toBe('HIGH');
				expect(result.value.evidence_references.length).toBe(1);
			}
		});

		it('parses MEDIUM confidence evidence packet', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Technical explanation',
						evidence_references: [
							{
								type: 'EXAMPLE',
								description: 'Code example',
								relevance_score: 0.7,
							},
						],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.confidence_level).toBe('MEDIUM');
			}
		});

		it('parses LOW confidence evidence packet', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Limited information available',
						evidence_references: [],
						confidence_level: 'LOW',
						caveats: ['Based on general knowledge', 'May not apply to all cases'],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.confidence_level).toBe('LOW');
			}
		});

		it('adds IDs to evidence references', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [
							{ type: 'API_DOC', description: 'Ref 1', relevance_score: 0.9 },
							{ type: 'SPECIFICATION', description: 'Ref 2', relevance_score: 0.8 },
						],
						confidence_level: 'HIGH',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.evidence_references.length).toBe(2);
				expect(result.value.evidence_references[0].reference_id).toBeTruthy();
				expect(result.value.evidence_references[1].reference_id).toBeTruthy();
			}
		});

		it('adds packet ID', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test question',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.packet_id).toBeTruthy();
				expect(result.value.question).toBe('Test question');
			}
		});

		it('handles different evidence reference types', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [
							{ type: 'API_DOC', description: 'API docs', relevance_score: 0.9 },
							{ type: 'SPECIFICATION', description: 'Spec', relevance_score: 0.85 },
							{ type: 'STANDARD', description: 'Standard', relevance_score: 0.8 },
							{ type: 'RFC', description: 'RFC document', relevance_score: 0.75 },
							{ type: 'EXAMPLE', description: 'Example', relevance_score: 0.7 },
							{ type: 'OTHER', description: 'Other source', relevance_score: 0.6 },
						],
						confidence_level: 'HIGH',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.evidence_references.length).toBe(6);
			}
		});

		it('includes related claim IDs in context', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				relatedClaimIds: ['claim-1', 'claim-2'],
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeTechnicalExpert(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						relatedClaimIds: ['claim-1', 'claim-2'],
					}),
				})
			);
		});

		it('includes workspace specs in context', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('detailed workspace specs');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeTechnicalExpert(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						workspace_specs: 'detailed workspace specs',
					}),
				})
			);
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context assembly failed'),
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});

		it('handles CLI invocation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});

		it('handles JSON parsing errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
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

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});

		it('handles markdown code fences', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const jsonResponse = {
				answer: 'Answer',
				evidence_references: [],
				confidence_level: 'MEDIUM',
				caveats: [],
			};

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: '```json\n' + JSON.stringify(jsonResponse) + '\n```',
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
		});

		it('validates missing answer', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});

		it('validates invalid confidence level', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'INVALID',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockRejectedValue(new Error('Unexpected'));

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(false);
		});
	});

	describe('extractEvidenceReferences', () => {
		it('extracts reference IDs from packet', () => {
			const packet: EvidencePacket = {
				packet_id: 'packet-123',
				question: 'Test question',
				answer: 'Test answer',
				evidence_references: [
					{
						reference_id: 'ref-1',
						type: 'API_DOC',
						description: 'Doc 1',
						relevance_score: 0.9,
					},
					{
						reference_id: 'ref-2',
						type: 'SPECIFICATION',
						description: 'Doc 2',
						relevance_score: 0.8,
					},
				],
				confidence_level: 'HIGH',
				caveats: [],
				raw_response: 'raw',
			};

			const refs = extractEvidenceReferences(packet);

			expect(refs).toEqual(['ref-1', 'ref-2']);
		});

		it('handles empty references', () => {
			const packet: EvidencePacket = {
				packet_id: 'packet-123',
				question: 'Test',
				answer: 'Answer',
				evidence_references: [],
				confidence_level: 'LOW',
				caveats: [],
				raw_response: 'raw',
			};

			const refs = extractEvidenceReferences(packet);

			expect(refs).toEqual([]);
		});
	});

	describe('edge cases', () => {
		it('handles empty caveats array', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.caveats).toEqual([]);
			}
		});

		it('handles optional URL in evidence reference', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [
							{ type: 'EXAMPLE', description: 'Example without URL', relevance_score: 0.7 },
						],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.evidence_references[0].url).toBeUndefined();
			}
		});

		it('handles very long answers', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const longAnswer = 'x'.repeat(10000);
			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: longAnswer,
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.answer.length).toBeGreaterThan(9000);
			}
		});

		it('handles multiple caveats', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						answer: 'Answer',
						evidence_references: [],
						confidence_level: 'MEDIUM',
						caveats: [
							'Caveat 1',
							'Caveat 2',
							'Caveat 3',
							'Caveat 4',
						],
					}),
					exitCode: 0,
				} as any,
			});

			const options: TechnicalExpertInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				question: 'Test',
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeTechnicalExpert(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.caveats.length).toBe(4);
			}
		});
	});
});
