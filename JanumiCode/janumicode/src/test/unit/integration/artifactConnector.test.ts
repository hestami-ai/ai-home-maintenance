import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	processExecutorOutput,
	getDialogueArtifacts,
	getArtifactStatistics,
	exportArtifactsToFiles,
	validateArtifactContent,
	type ProcessExecutorOutputOptions,
} from '../../../lib/integration/artifactConnector';
import type { Artifact, ArtifactReference } from '../../../lib/types';
import { ArtifactType, CodedError } from '../../../lib/types';
import type { ArtifactWithReferences } from '../../../lib/artifacts/manager';

vi.mock('../../../lib/artifacts');
vi.mock('../../../lib/database');

// ─── Canonical fixture builders ──────────────────────────────────────

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
	return {
		artifact_id: 'artifact-123',
		content_hash: 'sha256-test-hash',
		content: Buffer.from('test content'),
		mime_type: 'text/plain',
		size: 12,
		created_at: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

function makeArtifactReference(overrides: Partial<ArtifactReference> = {}): ArtifactReference {
	return {
		reference_id: 'ref-123',
		artifact_type: ArtifactType.BLOB,
		file_path: null,
		content_hash: 'sha256-test-hash',
		git_commit: null,
		metadata: '{}',
		created_at: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

function makeStoredArtifact(content = 'test content', mimeType = 'text/plain'): ArtifactWithReferences {
	return {
		artifact: makeArtifact({ content: Buffer.from(content), mime_type: mimeType, size: Buffer.byteLength(content) }),
		reference: makeArtifactReference(),
		contentRef: 'blob://sha256-test-hash',
	};
}

describe('Artifact Connector Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('processExecutorOutput', () => {
		it('extracts code blocks from proposal', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact('test code'),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\nconsole.log("Hello");\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.fileCount).toBeGreaterThan(0);
			}
		});

		it('creates artifacts for each code block', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```typescript\nconst x = 1;\n```\n\n```javascript\nconst y = 2;\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.fileCount).toBe(2);
			}
		});

		it('creates proposal artifact', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			let proposalArtifactCreated = false;
			vi.mocked(storeArtifact).mockImplementation(async (options: any) => {
				if (options.mimeType === 'text/markdown') {
					proposalArtifactCreated = true;
				}
				return {
					success: true,
					value: makeStoredArtifact(options.content, options.mimeType),
				};
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: 'Test proposal with ```javascript\ncode\n```',
				} as any,
			};

			await processExecutorOutput(options);

			expect(proposalArtifactCreated).toBe(true);
		});

		it('counts total lines correctly', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\nline1\nline2\nline3\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.totalLines).toBeGreaterThan(0);
			}
		});

		it('handles empty proposal', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.fileCount).toBe(0);
			}
		});

		it('handles proposal with no code blocks', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact('', 'text/markdown'),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: 'Just plain text with no code blocks',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.fileCount).toBe(0);
			}
		});

		it('includes turn ID in metadata', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			let capturedMetadata: any = null;
			vi.mocked(storeArtifact).mockImplementation(async (options: any) => {
				capturedMetadata = options.metadata;
				return {
					success: true,
					value: makeStoredArtifact(''),
				};
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\ncode\n```',
				} as any,
				turnId: 5,
			};

			await processExecutorOutput(options);

			expect(capturedMetadata?.turnId).toBe(5);
		});

		it('includes language in metadata', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			// processExecutorOutput calls storeArtifact once per code block AND once
			// for the full markdown proposal — the latter has no `language` field.
			// Capture only the first observation of a language.
			let capturedLanguage: string | undefined;
			vi.mocked(storeArtifact).mockImplementation(async (options: any) => {
				if (capturedLanguage === undefined && options.metadata?.language !== undefined) {
					capturedLanguage = options.metadata.language;
				}
				return {
					success: true,
					value: makeStoredArtifact(''),
				};
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```typescript\nconst x: number = 1;\n```',
				} as any,
			};

			await processExecutorOutput(options);

			expect(capturedLanguage).toBe('typescript');
		});

		it('handles code blocks with metadata', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			// Capture only the first observation of a filePath (proposal call has none).
			let capturedFilePath: string | undefined;
			vi.mocked(storeArtifact).mockImplementation(async (options: any) => {
				if (capturedFilePath === undefined && options.metadata?.filePath !== undefined) {
					capturedFilePath = options.metadata.filePath;
				}
				return {
					success: true,
					value: makeStoredArtifact(''),
				};
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```typescript [src/main.ts - Main file]\ncode\n```',
				} as any,
			};

			await processExecutorOutput(options);

			expect(capturedFilePath).toBe('src/main.ts');
		});

		it('handles artifact storage failure', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: false,
				error: new Error('Storage failed'),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\ncode\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.artifacts.length).toBe(0);
			}
		});

		it('handles thrown errors', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockRejectedValue(new Error('Unexpected error'));

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\ncode\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(false);
		});
	});

	describe('getDialogueArtifacts', () => {
		it('retrieves all artifacts for dialogue', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('code1'), mime_type: 'text/javascript' }),
				makeArtifact({ artifact_id: 'artifact-2', content: Buffer.from('code2'), mime_type: 'text/typescript' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getDialogueArtifacts('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
			}
		});

		it('handles empty artifact list', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: [],
			});

			const result = getDialogueArtifacts('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(0);
			}
		});

		it('handles getAllArtifacts failure', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: false,
				error: new Error('Database error'),
			});

			const result = getDialogueArtifacts('test-dialogue-123');

			expect(result.success).toBe(false);
		});

		it('passes dialogue ID to getAllArtifacts', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: [],
			});

			getDialogueArtifacts('test-dialogue-456');

			expect(getAllArtifacts).toHaveBeenCalledWith('test-dialogue-456');
		});

		it('handles thrown errors', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			const result = getDialogueArtifacts('test-dialogue-123');

			expect(result.success).toBe(false);
		});
	});

	describe('getArtifactStatistics', () => {
		it('counts total artifacts', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('code1'), mime_type: 'text/javascript' }),
				makeArtifact({ artifact_id: 'artifact-2', content: Buffer.from('code2'), mime_type: 'text/typescript' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.totalArtifacts).toBe(2);
			}
		});

		it('counts code artifacts by mime type', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('code'), mime_type: 'text/javascript' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.codeArtifacts).toBeGreaterThan(0);
			}
		});

		it('counts proposal artifacts', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('proposal'), mime_type: 'text/markdown' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proposalArtifacts).toBe(1);
			}
		});

		it('counts total lines', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('line1\nline2\nline3'), mime_type: 'text/javascript' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.totalLines).toBeGreaterThan(0);
			}
		});

		it('tracks languages', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			const mockArtifacts: Artifact[] = [
				makeArtifact({ artifact_id: 'artifact-1', content: Buffer.from('code'), mime_type: 'text/javascript' }),
				makeArtifact({ artifact_id: 'artifact-2', content: Buffer.from('code'), mime_type: 'text/typescript' }),
			];

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: mockArtifacts,
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.languages.javascript).toBe(1);
				expect(result.value.languages.typescript).toBe(1);
			}
		});

		it('handles empty artifact list', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: true,
				value: [],
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.totalArtifacts).toBe(0);
				expect(result.value.totalLines).toBe(0);
			}
		});

		it('handles getAllArtifacts failure', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockReturnValue({
				success: false,
				error: new Error('Database error'),
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			const { getAllArtifacts } = await import('../../../lib/artifacts');

			vi.mocked(getAllArtifacts).mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			const result = getArtifactStatistics('test-dialogue-123');

			expect(result.success).toBe(false);
		});
	});

	describe('exportArtifactsToFiles', () => {
		it('returns not implemented error', () => {
			const result = exportArtifactsToFiles('test-dialogue-123', '/output');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('NOT_IMPLEMENTED');
			}
		});

		it('accepts dialogue ID parameter', () => {
			const result = exportArtifactsToFiles('test-dialogue-456', '/output');

			expect(result.success).toBe(false);
		});

		it('accepts output directory parameter', () => {
			const result = exportArtifactsToFiles('test-dialogue-123', '/custom/path');

			expect(result.success).toBe(false);
		});
	});

	describe('validateArtifactContent', () => {
		it('validates non-empty content', () => {
			const artifact = makeArtifact({ content: Buffer.from('valid content') });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(true);
				expect(result.value.issues.length).toBe(0);
			}
		});

		it('detects empty content', () => {
			const artifact = makeArtifact({ content: Buffer.from('') });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(false);
				expect(result.value.issues.length).toBeGreaterThan(0);
			}
		});

		it('detects content exceeding size limit', () => {
			const largeContent = Buffer.alloc(2000000);
			const artifact = makeArtifact({ content: largeContent, size: largeContent.length });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(false);
				expect(result.value.issues.some(i => i.includes('1MB'))).toBe(true);
			}
		});

		it('detects whitespace-only content', () => {
			const artifact = makeArtifact({ content: Buffer.from('   \n\n   ') });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(false);
			}
		});

		it('validates UTF-8 content', () => {
			const artifact = makeArtifact({ content: Buffer.from('Valid UTF-8 content with émojis 🎉') });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(true);
			}
		});

		it('handles validation errors', () => {
			const artifact = null as unknown as Artifact;

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(false);
		});

		it('reports multiple issues', () => {
			const artifact = makeArtifact({ content: Buffer.from('') });

			const result = validateArtifactContent(artifact);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe('edge cases', () => {
		it('handles code blocks without language', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```\ncode without language\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
		});

		it('handles malformed code blocks', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```javascript\nunclosed code block',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
		});

		it('handles nested code blocks', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: '```markdown\n```javascript\ncode\n```\n```',
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
		});

		it('handles very long proposals', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const longProposal = 'x'.repeat(100000) + '```javascript\ncode\n```';
			const options: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-123',
				executorResponse: {
					proposal: longProposal,
				} as any,
			};

			const result = await processExecutorOutput(options);

			expect(result.success).toBe(true);
		});

		it('handles concurrent processing', async () => {
			const { storeArtifact } = await import('../../../lib/artifacts');

			vi.mocked(storeArtifact).mockResolvedValue({
				success: true,
				value: makeStoredArtifact(''),
			});

			const options1: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-1',
				executorResponse: { proposal: '```js\ncode1\n```' } as any,
			};

			const options2: ProcessExecutorOutputOptions = {
				dialogueId: 'test-dialogue-2',
				executorResponse: { proposal: '```js\ncode2\n```' } as any,
			};

			const results = await Promise.all([
				processExecutorOutput(options1),
				processExecutorOutput(options2),
			]);

			expect(results.every(r => r.success)).toBe(true);
		});
	});
});
