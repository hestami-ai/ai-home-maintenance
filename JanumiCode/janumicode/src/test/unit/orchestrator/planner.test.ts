import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generatePlan } from '../../../lib/orchestrator/planner';

vi.mock('vscode');
vi.mock('../../../lib/primitives/registry');
vi.mock('../../../lib/ui/governedStream/textCommands');
vi.mock('../../../lib/config/secretKeyManager.js');
vi.mock('../../../lib/llm/providerFactory.js');
vi.mock('../../../lib/types/index.js');
vi.mock('../../../lib/llm/provider.js');

describe('Orchestrator Planner', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('generatePlan', () => {
		it('generates plan using LLM', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { LLMProvider: LLMProviderEnum } = await import('../../../lib/types/index.js');
			const { MessageRole } = await import('../../../lib/llm/provider.js');

			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => {
					if (key === 'curator.provider') {return 'GEMINI';}
					if (key === 'curator.model') {return 'gemini-3-flash-lite';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('Primitive catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('Context summary');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			vi.mocked(LLMProviderEnum).GEMINI = 'GEMINI' as any;

			vi.mocked(MessageRole).USER = 'user' as any;

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Resume workflow',
							steps: [
								{
									id: 's1',
									primitiveId: 'state.getWorkflowState',
									params: { dialogueId: '$context.dialogueId' },
									reason: 'Get current state',
								},
							],
							expectedOutcome: 'Workflow resumed',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('resume', 'dialogue-123');

			expect(result).toBeTruthy();
			expect(result?.intent).toBe('Resume workflow');
			expect(result?.steps.length).toBe(1);
		});

		it('returns null if no API key', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue(null),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('returns null if provider creation fails', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			vi.mocked(createProvider).mockReturnValue({
				success: false,
				error: new Error('Provider failed'),
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('returns null if LLM call fails', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: false,
					error: new Error('LLM failed'),
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('returns null if plan has empty steps', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Cannot do this',
							steps: [],
							expectedOutcome: 'Unsafe operation',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('dangerous action', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('parses markdown-fenced JSON', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const planJson = {
				intent: 'Test',
				steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test step' }],
				expectedOutcome: 'Success',
			};

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: '```json\n' + JSON.stringify(planJson) + '\n```',
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeTruthy();
			expect(result?.intent).toBe('Test');
		});

		it('includes primitive catalog in system prompt', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const catalogSpy = vi.fn().mockReturnValue('Full primitive catalog');
			const mockRegistry = {
				generateCatalog: catalogSpy,
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Test',
							steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test' }],
							expectedOutcome: 'Success',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			await generatePlan('test', 'dialogue-123');

			expect(catalogSpy).toHaveBeenCalledWith({ includeRestricted: false });
		});

		it('includes workflow context in user message', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			const contextSpy = vi.fn().mockReturnValue('Workflow context summary');
			vi.mocked(buildWorkflowContextSummary).mockImplementation(contextSpy);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const completeSpy = vi.fn().mockResolvedValue({
				success: true,
				value: {
					content: JSON.stringify({
						intent: 'Test',
						steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test' }],
						expectedOutcome: 'Success',
					}),
				},
			});

			const mockProvider = {
				complete: completeSpy,
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			await generatePlan('resume workflow', 'dialogue-123');

			expect(contextSpy).toHaveBeenCalledWith('dialogue-123');
			expect(completeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							content: expect.stringContaining('Workflow context summary'),
						}),
					]),
				})
			);
		});

		it('uses temperature 0 for deterministic output', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const completeSpy = vi.fn().mockResolvedValue({
				success: true,
				value: {
					content: JSON.stringify({
						intent: 'Test',
						steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test' }],
						expectedOutcome: 'Success',
					}),
				},
			});

			const mockProvider = {
				complete: completeSpy,
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			await generatePlan('test', 'dialogue-123');

			expect(completeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0,
				})
			);
		});

		it('calls onProgress callback', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Test',
							steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test' }],
							expectedOutcome: 'Success',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const onProgress = vi.fn();
			await generatePlan('test', 'dialogue-123', onProgress);

			expect(onProgress).toHaveBeenCalledWith('Composing action plan...');
		});

		it('returns null on parsing failure', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Invalid JSON response',
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('handles thrown errors gracefully', async () => {
			const vscode = await import('vscode');

			vi.mocked(vscode.workspace.getConfiguration).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('validates step structure', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Test',
							steps: [
								{
									id: 's1',
									primitiveId: 'test',
									reason: 'Test step',
								},
							],
							expectedOutcome: 'Success',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeTruthy();
			expect(result?.steps[0].params).toBeDefined();
		});
	});

	describe('edge cases', () => {
		it('handles whitespace-only API key', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('   '),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeNull();
		});

		it('extracts JSON from prose', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const planJson = {
				intent: 'Test',
				steps: [{ id: 's1', primitiveId: 'test', params: {}, reason: 'Test' }],
				expectedOutcome: 'Success',
			};

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Here is the plan: ' + JSON.stringify(planJson) + ' End of plan.',
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('test', 'dialogue-123');

			expect(result).toBeTruthy();
			expect(result?.intent).toBe('Test');
		});

		it('handles plan with multiple steps', async () => {
			const vscode = await import('vscode');
			const { getPrimitiveRegistry } = await import('../../../lib/primitives/registry');
			const { buildWorkflowContextSummary } = await import('../../../lib/ui/governedStream/textCommands');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockRegistry = {
				generateCatalog: vi.fn().mockReturnValue('catalog'),
			};
			vi.mocked(getPrimitiveRegistry).mockReturnValue(mockRegistry as any);

			vi.mocked(buildWorkflowContextSummary).mockReturnValue('context');

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: JSON.stringify({
							intent: 'Multi-step plan',
							steps: [
								{ id: 's1', primitiveId: 'step1', params: {}, reason: 'First' },
								{ id: 's2', primitiveId: 'step2', params: {}, reason: 'Second' },
								{ id: 's3', primitiveId: 'step3', params: {}, reason: 'Third' },
							],
							expectedOutcome: 'All steps complete',
						}),
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const result = await generatePlan('complex task', 'dialogue-123');

			expect(result).toBeTruthy();
			expect(result?.steps.length).toBe(3);
		});
	});
});
