import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDocument } from '../../../lib/documents/generator';
import type { DocumentDefinition } from '../../../lib/documents/types';
import { DocumentType } from '../../../lib/documents/types';

vi.mock('vscode');
vi.mock('../../../lib/documents/contextAssembler.js');
vi.mock('../../../lib/llm/providerFactory.js');
vi.mock('../../../lib/config/secretKeyManager.js');

describe('Document Generator', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('generateDocument', () => {
		it('generates document using LLM', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => {
					if (key === 'documentGenerator.provider') {return 'GEMINI';}
					if (key === 'documentGenerator.model') {return 'gemini-2.5-flash';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: '# Generated Document\n\nContent here',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.VISION,
				label: 'Vision Document',
				description: 'Vision description',
				systemPrompt: 'Generate vision document',
				applicableCategory: 'product_or_feature',
			};

			const result = await generateDocument('dialogue-123', definition);

			expect(result.documentType).toBe(DocumentType.VISION);
			expect(result.title).toBe('Vision Document');
			expect(result.content).toContain('Generated Document');
		});

		it('assembles context from dialogue', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Content',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.PRD,
				label: 'PRD',
				description: 'Product Requirements',
				systemPrompt: 'Generate PRD',
				applicableCategory: 'product_or_feature',
			};

			await generateDocument('dialogue-123', definition);

			expect(assembleDocumentContext).toHaveBeenCalledWith('dialogue-123');
		});

		it('throws if context is empty', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');

			vi.mocked(assembleDocumentContext).mockReturnValue('   ');

			const definition: DocumentDefinition = {
				type: DocumentType.ARCHITECTURE,
				label: 'Architecture',
				description: 'Architecture doc',
				systemPrompt: 'Generate architecture',
				applicableCategory: 'product_or_feature',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('No data available');
		});

		it('throws if provider creation fails', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue(null),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const definition: DocumentDefinition = {
				type: DocumentType.CONOPS,
				label: 'CONOPS',
				description: 'Concept of Operations',
				systemPrompt: 'Generate CONOPS',
				applicableCategory: 'product_or_feature',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('not available');
		});

		it('throws if LLM call fails', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: false,
					error: new Error('LLM API error'),
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.DOMAIN_MODEL,
				label: 'Domain Model',
				description: 'Domain model',
				systemPrompt: 'Generate domain model',
				applicableCategory: 'product_or_feature',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('LLM call failed');
		});

		it('uses configured provider and model', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === 'documentGenerator.provider') {return 'CLAUDE';}
					if (key === 'documentGenerator.model') {return 'claude-3-opus';}
					return undefined;
				}),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('claude-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Content',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.IMPLEMENTATION_ROADMAP,
				label: 'Implementation Roadmap',
				description: 'Roadmap',
				systemPrompt: 'Generate roadmap',
				applicableCategory: 'product_or_feature',
			};

			await generateDocument('dialogue-123', definition);

			expect(mockProvider.complete).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-3-opus',
				})
			);
		});

		it('includes system prompt from definition', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Content',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const customSystemPrompt = 'Custom system prompt for technical brief';
			const definition: DocumentDefinition = {
				type: DocumentType.TECHNICAL_BRIEF,
				label: 'Technical Brief',
				description: 'Brief',
				systemPrompt: customSystemPrompt,
				applicableCategory: 'technical_task',
			};

			await generateDocument('dialogue-123', definition);

			expect(mockProvider.complete).toHaveBeenCalledWith(
				expect.objectContaining({
					systemPrompt: customSystemPrompt,
				})
			);
		});

		it('sets temperature to 0.4', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Content',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.CHANGE_IMPACT,
				label: 'Change Impact',
				description: 'Impact analysis',
				systemPrompt: 'Analyze impact',
				applicableCategory: 'technical_task',
			};

			await generateDocument('dialogue-123', definition);

			expect(mockProvider.complete).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.4,
				})
			);
		});

		it('handles API key resolution failure', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('OPENAI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockRejectedValue(new Error('SecretStorage not initialized')),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const definition: DocumentDefinition = {
				type: DocumentType.VERIFICATION_SUMMARY,
				label: 'Verification Summary',
				description: 'Summary',
				systemPrompt: 'Summarize verification',
				applicableCategory: 'technical_task',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('not available');
		});

		it('handles provider creation returning error', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

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
				error: new Error('Provider creation failed'),
			});

			const definition: DocumentDefinition = {
				type: DocumentType.VISION,
				label: 'Vision',
				description: 'Vision doc',
				systemPrompt: 'Generate vision',
				applicableCategory: 'product_or_feature',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('not available');
		});

		it('returns generated content with metadata', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const generatedContent = '# Document Title\n\nDocument content here';
			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: generatedContent,
						usage: { inputTokens: 500, outputTokens: 1000 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.PRD,
				label: 'Product Requirements Document',
				description: 'PRD',
				systemPrompt: 'Generate PRD',
				applicableCategory: 'product_or_feature',
			};

			const result = await generateDocument('dialogue-123', definition);

			expect(result).toEqual({
				documentType: DocumentType.PRD,
				title: 'Product Requirements Document',
				content: generatedContent,
			});
		});
	});

	describe('edge cases', () => {
		it('handles whitespace-only API key', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn().mockReturnValue('GEMINI'),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('   '),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const definition: DocumentDefinition = {
				type: DocumentType.VISION,
				label: 'Vision',
				description: 'Vision',
				systemPrompt: 'Generate vision',
				applicableCategory: 'product_or_feature',
			};

			await expect(generateDocument('dialogue-123', definition)).rejects.toThrow('not available');
		});

		it('defaults to GEMINI for invalid provider', async () => {
			const { assembleDocumentContext } = await import('../../../lib/documents/contextAssembler.js');
			const { createProvider } = await import('../../../lib/llm/providerFactory.js');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager.js');
			const vscode = await import('vscode');

			vi.mocked(assembleDocumentContext).mockReturnValue('Context data');

			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === 'documentGenerator.provider') {return 'INVALID_PROVIDER';}
					return 'gemini-2.5-flash';
				}),
			};
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const mockProvider = {
				complete: vi.fn().mockResolvedValue({
					success: true,
					value: {
						content: 'Content',
						usage: { inputTokens: 100, outputTokens: 200 },
					},
				}),
			};

			vi.mocked(createProvider).mockReturnValue({
				success: true,
				value: mockProvider as any,
			});

			const definition: DocumentDefinition = {
				type: DocumentType.VISION,
				label: 'Vision',
				description: 'Vision',
				systemPrompt: 'Generate vision',
				applicableCategory: 'product_or_feature',
			};

			await generateDocument('dialogue-123', definition);

			expect(createProvider).toHaveBeenCalled();
		});
	});
});
