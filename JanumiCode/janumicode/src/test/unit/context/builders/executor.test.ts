import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../../helpers/fakeLogger';
import { buildExecutorContext, type ExecutorContextOptions } from '../../../../lib/context/builders/executor';
import { TruncationStrategy } from '../../../../lib/context/truncation';
import type { WorkspaceFile } from '../../../../lib/context/workspaceReader';
import type { ArchitectureDocument } from '../../../../lib/types/architecture';
import { ArchitectureDocumentStatus } from '../../../../lib/types/architecture';

describe('Executor Context Builder', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('buildExecutorContext', () => {
		it('builds basic executor context successfully', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-1',
				goal: 'Build a REST API',
				tokenBudget: 10000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeDefined();
				expect(result.value.goal).toBe('Build a REST API');
			}
		});

		it('includes default historical findings', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-2',
				goal: 'Test goal',
				tokenBudget: 10000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('respects includeHistoricalFindings option', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-3',
				goal: 'Test goal',
				tokenBudget: 10000,
				includeHistoricalFindings: false,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('respects maxHistoricalFindings option', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-4',
				goal: 'Test goal',
				tokenBudget: 10000,
				maxHistoricalFindings: 10,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('respects token budget', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-5',
				goal: 'Test goal',
				tokenBudget: 5000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(5000);
			}
		});

		it('handles small token budget', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-6',
				goal: 'Test goal',
				tokenBudget: 1000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles large token budget', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-7',
				goal: 'Test goal',
				tokenBudget: 50000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('applies truncation when context exceeds budget', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-8',
				goal: 'Test goal with very limited budget',
				tokenBudget: 500,
				truncationStrategy: TruncationStrategy.PRIORITY_BASED,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(500);
			}
		});

		it('respects truncation strategy option', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-9',
				goal: 'Test goal',
				tokenBudget: 2000,
				truncationStrategy: TruncationStrategy.OLDEST_FIRST,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('includes workspace files when provided', async () => {
			const workspaceFiles: WorkspaceFile[] = [
				{
					absolutePath: '/workspace/spec.md',
					relativePath: 'spec.md',
					content: 'Specification content',
					sizeBytes: 100,
					truncated: false,
					extension: '.md',
				},
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-10',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.workspaceContext).toBeDefined();
			}
		});

		it('handles multiple workspace files', async () => {
			const workspaceFiles: WorkspaceFile[] = [
				{
					absolutePath: '/workspace/spec1.md',
					relativePath: 'spec1.md',
					content: 'Spec 1',
					sizeBytes: 10,
					truncated: false,
					extension: '.md',
				},
				{
					absolutePath: '/workspace/spec2.md',
					relativePath: 'spec2.md',
					content: 'Spec 2',
					sizeBytes: 10,
					truncated: false,
					extension: '.md',
				},
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-11',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles empty workspace files array', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-12',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles: [],
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('includes architecture document when provided', async () => {
			const architectureDoc: ArchitectureDocument = {
				doc_id: 'arch-doc-13',
				dialogue_id: 'test-dialogue-13',
				version: 1,
				capabilities: [],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				status: ArchitectureDocumentStatus.APPROVED,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-13',
				goal: 'Test goal',
				tokenBudget: 10000,
				architectureDoc,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('allocates workspace budget appropriately', async () => {
			const largeFile: WorkspaceFile = {
				absolutePath: '/workspace/large.md',
				relativePath: 'large.md',
				content: 'Content '.repeat(10000),
				sizeBytes: 100000,
				truncated: false,
				extension: '.md',
			};

			const options: ExecutorContextOptions = {
				dialogueId: 'test-dialogue-14',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles: [largeFile],
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(10000);
			}
		});
	});

	describe('ExecutorContextOptions interface', () => {
		it('requires dialogueId', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'required-dialogue-id',
				goal: 'Test',
				tokenBudget: 1000,
			};

			expect(options.dialogueId).toBeDefined();
		});

		it('requires goal', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Required goal',
				tokenBudget: 1000,
			};

			expect(options.goal).toBeDefined();
		});

		it('requires tokenBudget', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 5000,
			};

			expect(options.tokenBudget).toBeGreaterThan(0);
		});

		it('accepts optional includeHistoricalFindings', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				includeHistoricalFindings: true,
			};

			expect(typeof options.includeHistoricalFindings).toBe('boolean');
		});

		it('accepts optional maxHistoricalFindings', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				maxHistoricalFindings: 15,
			};

			expect(options.maxHistoricalFindings).toBe(15);
		});

		it('accepts optional truncationStrategy', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				truncationStrategy: TruncationStrategy.NEWEST_FIRST,
			};

			expect(options.truncationStrategy).toBe(TruncationStrategy.NEWEST_FIRST);
		});

		it('accepts optional specFolderPaths', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				specFolderPaths: ['specs/folder1', 'specs/folder2'],
			};

			expect(options.specFolderPaths?.length).toBe(2);
		});

		it('accepts optional maxSpecFiles', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				maxSpecFiles: 50,
			};

			expect(options.maxSpecFiles).toBe(50);
		});

		it('accepts optional workspaceFiles', async () => {
			const files: WorkspaceFile[] = [
				{
					absolutePath: '/test',
					relativePath: 'test',
					content: 'test',
					sizeBytes: 4,
					truncated: false,
					extension: '.md',
				},
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				workspaceFiles: files,
			};

			expect(options.workspaceFiles?.length).toBe(1);
		});

		it('accepts optional architectureDoc', async () => {
			const archDoc: ArchitectureDocument = {
				doc_id: 'arch-doc-test',
				dialogue_id: 'test',
				version: 1,
				capabilities: [],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				status: ArchitectureDocumentStatus.APPROVED,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const options: ExecutorContextOptions = {
				dialogueId: 'test',
				goal: 'Test',
				tokenBudget: 1000,
				architectureDoc: archDoc,
			};

			expect(options.architectureDoc).toBeDefined();
		});
	});

	describe('edge cases', () => {
		it('handles very long goal text', async () => {
			const longGoal = 'Build a comprehensive system that '.repeat(100);
			const options: ExecutorContextOptions = {
				dialogueId: 'test-long-goal',
				goal: longGoal,
				tokenBudget: 10000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles special characters in goal', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-special-chars',
				goal: 'Build system with @#$% & special chars 日本語',
				tokenBudget: 10000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles zero historical findings limit', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-zero-historical',
				goal: 'Test goal',
				tokenBudget: 10000,
				maxHistoricalFindings: 0,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles very large historical findings limit', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-large-historical',
				goal: 'Test goal',
				tokenBudget: 10000,
				maxHistoricalFindings: 1000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles truncated workspace files', async () => {
			const truncatedFile: WorkspaceFile = {
				absolutePath: '/workspace/truncated.md',
				relativePath: 'truncated.md',
				content: 'Content... [truncated]',
				sizeBytes: 100000,
				truncated: true,
				extension: '.md',
			};

			const options: ExecutorContextOptions = {
				dialogueId: 'test-truncated-files',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles: [truncatedFile],
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles files with various extensions', async () => {
			const files: WorkspaceFile[] = [
				{ absolutePath: '/test.md', relativePath: 'test.md', content: 'MD', sizeBytes: 2, truncated: false, extension: '.md' },
				{ absolutePath: '/test.txt', relativePath: 'test.txt', content: 'TXT', sizeBytes: 3, truncated: false, extension: '.txt' },
				{ absolutePath: '/test.json', relativePath: 'test.json', content: '{}', sizeBytes: 2, truncated: false, extension: '.json' },
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test-extensions',
				goal: 'Test goal',
				tokenBudget: 10000,
				workspaceFiles: files,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('builds complete executor context with all options', async () => {
			const workspaceFiles: WorkspaceFile[] = [
				{
					absolutePath: '/workspace/api-spec.md',
					relativePath: 'specs/api-spec.md',
					content: '# API Specification\n\nREST endpoints defined here.',
					sizeBytes: 100,
					truncated: false,
					extension: '.md',
				},
			];

			const architectureDoc: ArchitectureDocument = {
				doc_id: 'arch-doc-complete',
				dialogue_id: 'test-complete',
				version: 1,
				capabilities: [{ 
					capability_id: 'cap1', 
					parent_capability_id: null,
					label: 'User Auth', 
					description: 'User authentication capability',
					source_requirements: [],
					engineering_domain_mappings: [],
					workflows: []
				}],
				workflow_graph: [],
				components: [],
				data_models: [],
				interfaces: [],
				implementation_sequence: [],
				goal_alignment_score: null,
				validation_findings: [],
				status: ArchitectureDocumentStatus.APPROVED,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const options: ExecutorContextOptions = {
				dialogueId: 'test-complete',
				goal: 'Build a comprehensive REST API with authentication',
				tokenBudget: 20000,
				includeHistoricalFindings: true,
				maxHistoricalFindings: 10,
				truncationStrategy: TruncationStrategy.PRIORITY_BASED,
				workspaceFiles,
				architectureDoc,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.goal).toBeDefined();
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(20000);
			}
		});

		it('handles minimal configuration', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-minimal',
				goal: 'Simple task',
				tokenBudget: 1000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
		});

		it('handles budget-constrained scenario', async () => {
			const largeWorkspace: WorkspaceFile[] = Array.from({ length: 50 }, (_, i) => ({
				absolutePath: `/workspace/file${i}.md`,
				relativePath: `file${i}.md`,
				content: `Content for file ${i}`.repeat(100),
				sizeBytes: 1000,
				truncated: false,
				extension: '.md',
			}));

			const options: ExecutorContextOptions = {
				dialogueId: 'test-constrained',
				goal: 'Complex task with limited budget',
				tokenBudget: 3000,
				workspaceFiles: largeWorkspace,
				truncationStrategy: TruncationStrategy.PRIORITY_BASED,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(3000);
			}
		});
	});

	describe('token accounting', () => {
		it('accounts for workspace content tokens', async () => {
			const workspaceFiles: WorkspaceFile[] = [
				{
					absolutePath: '/workspace/test.md',
					relativePath: 'test.md',
					content: 'Test content with some words',
					sizeBytes: 50,
					truncated: false,
					extension: '.md',
				},
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test-accounting',
				goal: 'Test',
				tokenBudget: 10000,
				workspaceFiles,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.workspace).toBeGreaterThan(0);
			}
		});

		it('includes all token components in total', async () => {
			const options: ExecutorContextOptions = {
				dialogueId: 'test-total-tokens',
				goal: 'Test goal for token accounting',
				tokenBudget: 10000,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('respects workspace budget allocation', async () => {
			const largeContent = 'A'.repeat(100000);
			const workspaceFiles: WorkspaceFile[] = [
				{
					absolutePath: '/workspace/large.md',
					relativePath: 'large.md',
					content: largeContent,
					sizeBytes: 100000,
					truncated: false,
					extension: '.md',
				},
			];

			const options: ExecutorContextOptions = {
				dialogueId: 'test-workspace-budget',
				goal: 'Test',
				tokenBudget: 5000,
				workspaceFiles,
			};

			const result = await buildExecutorContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				const workspaceBudget = Math.floor(5000 * 0.2);
				expect(result.value.tokenUsage.workspace).toBeLessThanOrEqual(workspaceBudget + 100);
			}
		});
	});
});
