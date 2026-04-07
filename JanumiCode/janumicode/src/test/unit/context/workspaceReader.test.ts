import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	formatWorkspaceFilesForContext,
	type WorkspaceFile,
	type WorkspaceScanResult,
} from '../../../lib/context/workspaceReader';

describe('Workspace Reader', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockWorkspaceFile = (overrides?: Partial<WorkspaceFile>): WorkspaceFile => ({
		absolutePath: '/workspace/test/file.md',
		relativePath: 'test/file.md',
		content: 'Test file content',
		sizeBytes: 1024,
		truncated: false,
		extension: '.md',
		...overrides,
	});

	describe('formatWorkspaceFilesForContext', () => {
		it('formats single file correctly', () => {
			const files = [createMockWorkspaceFile()];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files (1 files)');
			expect(formatted).toContain('## test/file.md');
			expect(formatted).toContain('Test file content');
		});

		it('formats multiple files correctly', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'docs/readme.md', content: 'README content' }),
				createMockWorkspaceFile({ relativePath: 'specs/spec.md', content: 'Spec content' }),
				createMockWorkspaceFile({ relativePath: 'config.json', content: '{"key": "value"}' }),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files (3 files)');
			expect(formatted).toContain('## docs/readme.md');
			expect(formatted).toContain('## specs/spec.md');
			expect(formatted).toContain('## config.json');
			expect(formatted).toContain('README content');
			expect(formatted).toContain('Spec content');
			expect(formatted).toContain('{"key": "value"}');
		});

		it('wraps content in code blocks', () => {
			const files = [createMockWorkspaceFile({ content: 'Code content' })];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('```\nCode content\n```');
		});

		it('emits multiple large files in full (no truncation)', () => {
			const largeContent = 'A'.repeat(10000);
			const files = [
				createMockWorkspaceFile({ relativePath: 'file1.md', content: largeContent }),
				createMockWorkspaceFile({ relativePath: 'file2.md', content: largeContent }),
				createMockWorkspaceFile({ relativePath: 'file3.md', content: largeContent }),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			// No truncation: every file is emitted in full.
			expect(formatted).toContain('file1.md');
			expect(formatted).toContain('file2.md');
			expect(formatted).toContain('file3.md');
			expect(formatted).not.toContain('omitted');
		});

		it('handles empty files array', () => {
			const formatted = formatWorkspaceFilesForContext([]);

			expect(formatted).toContain('# Workspace Files (0 files)');
		});

		it('includes file count in header', () => {
			const files = Array.from({ length: 5 }, (_, i) =>
				createMockWorkspaceFile({ relativePath: `file${i}.md` })
			);
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files (5 files)');
		});

		it('emits every file regardless of total size (no truncation)', () => {
			const files = Array.from({ length: 10 }, (_, i) =>
				createMockWorkspaceFile({
					relativePath: `file${i}.md`,
					content: 'Content for file ' + i,
				})
			);

			const formatted = formatWorkspaceFilesForContext(files);

			const fileCount = (formatted.match(/^## /gm) || []).length;
			expect(fileCount).toBe(10);
			expect(formatted).not.toContain('omitted');
		});

		it('handles files with different extensions', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'readme.md', extension: '.md' }),
				createMockWorkspaceFile({ relativePath: 'config.json', extension: '.json' }),
				createMockWorkspaceFile({ relativePath: 'script.ts', extension: '.ts' }),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('readme.md');
			expect(formatted).toContain('config.json');
			expect(formatted).toContain('script.ts');
		});

		it('emits a single small file in full', () => {
			const files = [
				createMockWorkspaceFile({ content: 'Test content' }),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('Test content');
			expect(formatted).not.toContain('omitted');
		});

		it('emits a single file regardless of size', () => {
			const files = [
				createMockWorkspaceFile(),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files');
		});

		it('preserves relative paths in output', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'deeply/nested/folder/file.md' }),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('## deeply/nested/folder/file.md');
		});

		it('handles files with special characters in names', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'file-with-dashes.md' }),
				createMockWorkspaceFile({ relativePath: 'file_with_underscores.md' }),
				createMockWorkspaceFile({ relativePath: 'file.multiple.dots.md' }),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('file-with-dashes.md');
			expect(formatted).toContain('file_with_underscores.md');
			expect(formatted).toContain('file.multiple.dots.md');
		});

		it('handles content with markdown formatting', () => {
			const files = [
				createMockWorkspaceFile({
					content: '# Heading\n\n**Bold** and *italic*\n\n- List item',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Heading');
			expect(formatted).toContain('**Bold**');
			expect(formatted).toContain('*italic*');
			expect(formatted).toContain('- List item');
		});

		it('handles content with code blocks', () => {
			const files = [
				createMockWorkspaceFile({
					content: '```typescript\nconst x = 1;\n```',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('```typescript\nconst x = 1;\n```');
		});
	});

	describe('WorkspaceFile interface', () => {
		it('creates valid workspace file object', () => {
			const file = createMockWorkspaceFile();

			expect(file.absolutePath).toBeDefined();
			expect(file.relativePath).toBeDefined();
			expect(file.content).toBeDefined();
			expect(file.sizeBytes).toBeGreaterThanOrEqual(0);
			expect(typeof file.truncated).toBe('boolean');
			expect(file.extension).toBeDefined();
		});

		it('handles truncated files', () => {
			const file = createMockWorkspaceFile({
				truncated: true,
				content: 'Content...\n\n... [truncated]',
			});

			expect(file.truncated).toBe(true);
			expect(file.content).toContain('[truncated]');
		});

		it('handles different file sizes', () => {
			const smallFile = createMockWorkspaceFile({ sizeBytes: 100 });
			const largeFile = createMockWorkspaceFile({ sizeBytes: 100000 });

			expect(smallFile.sizeBytes).toBe(100);
			expect(largeFile.sizeBytes).toBe(100000);
		});

		it('handles various extensions', () => {
			const extensions = ['.md', '.txt', '.json', '.yaml', '.ts', '.js'];
			
			for (const ext of extensions) {
				const file = createMockWorkspaceFile({ extension: ext });
				expect(file.extension).toBe(ext);
			}
		});
	});

	describe('WorkspaceScanResult interface', () => {
		it('creates valid scan result object', () => {
			const result: WorkspaceScanResult = {
				files: [],
				totalFilesFound: 0,
				totalSizeBytes: 0,
				truncatedCount: 0,
				skippedCount: 0,
			};

			expect(result.files).toEqual([]);
			expect(result.totalFilesFound).toBe(0);
			expect(result.totalSizeBytes).toBe(0);
			expect(result.truncatedCount).toBe(0);
			expect(result.skippedCount).toBe(0);
		});

		it('tracks file counts correctly', () => {
			const result: WorkspaceScanResult = {
				files: [createMockWorkspaceFile(), createMockWorkspaceFile()],
				totalFilesFound: 5,
				totalSizeBytes: 10240,
				truncatedCount: 1,
				skippedCount: 2,
			};

			expect(result.files.length).toBe(2);
			expect(result.totalFilesFound).toBe(5);
			expect(result.skippedCount).toBe(2);
		});

		it('tracks total size correctly', () => {
			const files = [
				createMockWorkspaceFile({ sizeBytes: 1000 }),
				createMockWorkspaceFile({ sizeBytes: 2000 }),
			];

			const result: WorkspaceScanResult = {
				files,
				totalFilesFound: 2,
				totalSizeBytes: 3000,
				truncatedCount: 0,
				skippedCount: 0,
			};

			expect(result.totalSizeBytes).toBe(3000);
		});
	});

	describe('integration scenarios', () => {
		it('formats complete scan result for context', () => {
			const files = [
				createMockWorkspaceFile({
					relativePath: 'README.md',
					content: '# Project README\n\nDescription of the project.',
				}),
				createMockWorkspaceFile({
					relativePath: 'specs/architecture.md',
					content: '# Architecture\n\nSystem design details.',
				}),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files (2 files)');
			expect(formatted).toContain('## README.md');
			expect(formatted).toContain('## specs/architecture.md');
			expect(formatted).toContain('Project README');
			expect(formatted).toContain('System design');
		});

		it('handles mixed content types', () => {
			const files = [
				createMockWorkspaceFile({
					relativePath: 'package.json',
					content: '{"name": "test-project"}',
					extension: '.json',
				}),
				createMockWorkspaceFile({
					relativePath: 'README.md',
					content: '# Documentation',
					extension: '.md',
				}),
				createMockWorkspaceFile({
					relativePath: 'config.yaml',
					content: 'key: value',
					extension: '.yaml',
				}),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('package.json');
			expect(formatted).toContain('README.md');
			expect(formatted).toContain('config.yaml');
		});

		it('emits all 20 files (no truncation)', () => {
			const files = Array.from({ length: 20 }, (_, i) =>
				createMockWorkspaceFile({
					relativePath: `file${i}.md`,
					content: `Content ${i}`.repeat(100),
				})
			);

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files (20 files)');
			const includedCount = (formatted.match(/## file/g) || []).length;
			expect(includedCount).toBe(20);
			expect(formatted).not.toContain('omitted');
		});
	});

	describe('edge cases', () => {
		it('handles empty content', () => {
			const files = [createMockWorkspaceFile({ content: '' })];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('test/file.md');
			expect(formatted).toContain('```\n\n```');
		});

		it('handles very long file paths', () => {
			const longPath = 'deeply/nested/folder/structure/that/goes/very/deep/file.md';
			const files = [createMockWorkspaceFile({ relativePath: longPath })];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain(longPath);
		});

		it('handles content with newlines', () => {
			const files = [
				createMockWorkspaceFile({
					content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('Line 1');
			expect(formatted).toContain('Line 5');
		});

		it('handles content with tabs and spaces', () => {
			const files = [
				createMockWorkspaceFile({
					content: '\tIndented with tab\n    Indented with spaces',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('Indented with tab');
			expect(formatted).toContain('Indented with spaces');
		});

		it('handles files with no extension', () => {
			const files = [
				createMockWorkspaceFile({
					relativePath: 'Dockerfile',
					extension: '',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('Dockerfile');
		});

		it('handles unicode content', () => {
			const files = [
				createMockWorkspaceFile({
					content: '日本語のテキスト\n中文内容\nКириллица',
				}),
			];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('日本語');
			expect(formatted).toContain('中文');
			expect(formatted).toContain('Кириллица');
		});

		it('emits a large single file in full (no truncation)', () => {
			const files = [
				createMockWorkspaceFile({
					content: 'X'.repeat(10000),
				}),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('# Workspace Files');
			expect(formatted).not.toContain('omitted');
			expect(formatted).toContain('X'.repeat(10000));
		});

		it('handles files with identical content', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'file1.md', content: 'Same content' }),
				createMockWorkspaceFile({ relativePath: 'file2.md', content: 'Same content' }),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('file1.md');
			expect(formatted).toContain('file2.md');
			expect((formatted.match(/Same content/g) || []).length).toBe(2);
		});
	});

	describe('formatting consistency', () => {
		it('maintains consistent header format', () => {
			const files = [createMockWorkspaceFile()];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted.startsWith('# Workspace Files')).toBe(true);
		});

		it('maintains consistent file section format', () => {
			const files = [createMockWorkspaceFile()];
			
			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toMatch(/## [^\n]+\n```\n[\s\S]*?\n```/);
		});

		it('separates files with blank lines', () => {
			const files = [
				createMockWorkspaceFile({ relativePath: 'file1.md' }),
				createMockWorkspaceFile({ relativePath: 'file2.md' }),
			];

			const formatted = formatWorkspaceFilesForContext(files);

			expect(formatted).toContain('```\n\n## file2.md');
		});
	});
});
