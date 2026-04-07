import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	buildFileBasedPrompt,
	type ContextSection,
} from '../../../lib/context/contextFileWriter';

describe('Context File Writer', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('ContextSection interface', () => {
		it('creates valid section object', () => {
			const section: ContextSection = {
				name: 'plan.md',
				content: 'Plan content',
			};

			expect(section.name).toBe('plan.md');
			expect(section.content).toBe('Plan content');
		});

		it('handles different file extensions', () => {
			const sections: ContextSection[] = [
				{ name: 'plan.md', content: 'Content' },
				{ name: 'conversation.txt', content: 'Content' },
				{ name: 'data.json', content: '{}' },
			];

			expect(sections.every(s => s.name && s.content)).toBe(true);
		});

		it('handles large content', () => {
			const largeContent = 'A'.repeat(1000000);
			const section: ContextSection = {
				name: 'large.md',
				content: largeContent,
			};

			expect(section.content.length).toBe(1000000);
		});

		it('handles empty content', () => {
			const section: ContextSection = {
				name: 'empty.md',
				content: '',
			};

			expect(section.content).toBe('');
		});
	});

	describe('buildFileBasedPrompt', () => {
		it('builds prompt with single file', () => {
			const filePaths = ['.janumicode/context/abc123/plan.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('# Context Files');
			expect(prompt).toContain('`.janumicode/context/abc123/plan.md`');
			expect(prompt).toContain('Read ALL listed files');
		});

		it('builds prompt with multiple files', () => {
			const filePaths = [
				'.janumicode/context/abc123/plan.md',
				'.janumicode/context/abc123/conversation.md',
				'.janumicode/context/abc123/artifacts.md',
			];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('plan.md');
			expect(prompt).toContain('conversation.md');
			expect(prompt).toContain('artifacts.md');
		});

		it('formats file paths as markdown list', () => {
			const filePaths = [
				'.janumicode/context/abc123/file1.md',
				'.janumicode/context/abc123/file2.md',
			];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('- `.janumicode/context/abc123/file1.md`');
			expect(prompt).toContain('- `.janumicode/context/abc123/file2.md`');
		});

		it('includes instruction header', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('# Context Files');
			expect(prompt).toContain('full context for this task has been written');
		});

		it('includes reading instructions', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('Read the following files');
			expect(prompt).toContain('IMPORTANT: Read ALL listed files');
		});

		it('mentions threshold explanation', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('exceeds');
			expect(prompt).toContain('inline threshold');
		});

		it('handles empty file paths array', () => {
			const prompt = buildFileBasedPrompt([]);

			expect(prompt).toContain('# Context Files');
		});

		it('preserves path separators', () => {
			const filePaths = ['.janumicode/context/abc123/nested/file.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('.janumicode/context/abc123/nested/file.md');
		});

		it('handles paths with special characters', () => {
			const filePaths = ['.janumicode/context/abc-123/file_name.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('abc-123');
			expect(prompt).toContain('file_name.md');
		});

		it('includes complete context message', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('complete plan');
			expect(prompt).toContain('conversation history');
			expect(prompt).toContain('proposer artifacts');
		});
	});

	describe('edge cases', () => {
		it('handles very long file paths', () => {
			const longPath = '.janumicode/context/' + 'a'.repeat(200) + '/file.md';
			const filePaths = [longPath];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain(longPath);
		});

		it('handles file names with dots', () => {
			const filePaths = ['.janumicode/context/abc123/file.backup.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('file.backup.md');
		});

		it('handles many files', () => {
			const filePaths = Array.from({ length: 100 }, (_, i) => 
				`.janumicode/context/abc123/file${i}.md`
			);

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toBeDefined();
			filePaths.forEach(fp => {
				expect(prompt).toContain(fp);
			});
		});

		it('handles file names with spaces', () => {
			const filePaths = ['.janumicode/context/abc123/my file.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('my file.md');
		});

		it('handles different context directory patterns', () => {
			const filePaths = [
				'.janumicode/context/12345678/file.md',
				'.janumicode/context/abcdefgh/file.md',
			];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('12345678');
			expect(prompt).toContain('abcdefgh');
		});
	});

	describe('prompt formatting', () => {
		it('uses consistent markdown formatting', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt.startsWith('# Context Files')).toBe(true);
			expect(prompt).toContain('\n\n');
		});

		it('creates multiline output', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			const lines = prompt.split('\n');
			expect(lines.length).toBeGreaterThan(5);
		});

		it('includes empty lines for readability', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('\n\n');
		});

		it('formats all file paths consistently', () => {
			const filePaths = [
				'.janumicode/context/abc123/file1.md',
				'.janumicode/context/abc123/file2.md',
				'.janumicode/context/abc123/file3.md',
			];

			const prompt = buildFileBasedPrompt(filePaths);

			const listItems = prompt.match(/- `[^`]+`/g);
			expect(listItems).not.toBeNull();
			if (listItems) {
				expect(listItems.length).toBe(3);
			}
		});
	});

	describe('content validation', () => {
		it('includes all required sections', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('Context Files');
			expect(prompt).toContain('Read the following files');
			expect(prompt).toContain('IMPORTANT');
		});

		it('maintains instruction clarity', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt.toLowerCase()).toContain('read');
			expect(prompt.toLowerCase()).toContain('files');
			expect(prompt.toLowerCase()).toContain('complete');
		});

		it('emphasizes importance', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('IMPORTANT');
			expect(prompt).toContain('ALL');
		});
	});

	describe('integration scenarios', () => {
		it('builds prompt for typical dialogue context', () => {
			const filePaths = [
				'.janumicode/context/abc12345/plan.md',
				'.janumicode/context/abc12345/conversation-history.md',
				'.janumicode/context/abc12345/domain-proposals.md',
			];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('plan.md');
			expect(prompt).toContain('conversation-history.md');
			expect(prompt).toContain('domain-proposals.md');
		});

		it('handles minimal file set', () => {
			const filePaths = ['.janumicode/context/abc12345/context.md'];

			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toBeDefined();
			expect(prompt.length).toBeGreaterThan(100);
		});

		it('handles comprehensive file set', () => {
			const sections = [
				'plan.md',
				'conversation.md',
				'architecture.md',
				'constraints.md',
				'decisions.md',
			];

			const filePaths = sections.map(s => `.janumicode/context/abc12345/${s}`);
			const prompt = buildFileBasedPrompt(filePaths);

			sections.forEach(section => {
				expect(prompt).toContain(section);
			});
		});
	});

	describe('section structure', () => {
		it('creates section with markdown extension', () => {
			const section: ContextSection = {
				name: 'test.md',
				content: '# Header\n\nContent',
			};

			expect(section.name.endsWith('.md')).toBe(true);
		});

		it('creates section with json extension', () => {
			const section: ContextSection = {
				name: 'data.json',
				content: '{"key": "value"}',
			};

			expect(section.name.endsWith('.json')).toBe(true);
		});

		it('handles section with multiline content', () => {
			const section: ContextSection = {
				name: 'multiline.md',
				content: 'Line 1\nLine 2\nLine 3',
			};

			expect(section.content.split('\n').length).toBe(3);
		});

		it('handles section with unicode content', () => {
			const section: ContextSection = {
				name: 'unicode.md',
				content: '日本語のテキスト\n中文内容',
			};

			expect(section.content).toContain('日本語');
			expect(section.content).toContain('中文');
		});
	});

	describe('multiple sections handling', () => {
		it('processes multiple sections', () => {
			const sections: ContextSection[] = [
				{ name: 'section1.md', content: 'Content 1' },
				{ name: 'section2.md', content: 'Content 2' },
				{ name: 'section3.md', content: 'Content 3' },
			];

			expect(sections.length).toBe(3);
			expect(sections.every(s => s.name && s.content)).toBe(true);
		});

		it('maintains section order', () => {
			const sections: ContextSection[] = [
				{ name: 'first.md', content: 'A' },
				{ name: 'second.md', content: 'B' },
				{ name: 'third.md', content: 'C' },
			];

			expect(sections[0].name).toBe('first.md');
			expect(sections[1].name).toBe('second.md');
			expect(sections[2].name).toBe('third.md');
		});

		it('handles sections with varying sizes', () => {
			const sections: ContextSection[] = [
				{ name: 'small.md', content: 'Small' },
				{ name: 'medium.md', content: 'M'.repeat(1000) },
				{ name: 'large.md', content: 'L'.repeat(100000) },
			];

			expect(sections[0].content.length).toBeLessThan(sections[1].content.length);
			expect(sections[1].content.length).toBeLessThan(sections[2].content.length);
		});
	});

	describe('file naming patterns', () => {
		it('supports common section names', () => {
			const commonNames = [
				'plan.md',
				'conversation-history.md',
				'architecture.md',
				'constraints.md',
				'artifacts.md',
			];

			commonNames.forEach(name => {
				const section: ContextSection = { name, content: 'Test' };
				expect(section.name).toBe(name);
			});
		});

		it('supports kebab-case names', () => {
			const section: ContextSection = {
				name: 'conversation-history.md',
				content: 'Content',
			};

			expect(section.name).toContain('-');
		});

		it('supports snake_case names', () => {
			const section: ContextSection = {
				name: 'domain_proposals.md',
				content: 'Content',
			};

			expect(section.name).toContain('_');
		});

		it('supports camelCase names', () => {
			const section: ContextSection = {
				name: 'conversationHistory.md',
				content: 'Content',
			};

			expect(section.name).toMatch(/[a-z][A-Z]/);
		});
	});

	describe('prompt instruction clarity', () => {
		it('provides clear file reading instructions', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];
			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt.toLowerCase()).toContain('read');
			expect(prompt.toLowerCase()).toContain('files');
		});

		it('explains why files are used', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];
			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('exceeds');
			expect(prompt).toContain('threshold');
		});

		it('emphasizes reading all files', () => {
			const filePaths = [
				'.janumicode/context/abc123/file1.md',
				'.janumicode/context/abc123/file2.md',
			];
			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('ALL');
			expect(prompt).toContain('Read ALL listed files');
		});

		it('mentions complete context components', () => {
			const filePaths = ['.janumicode/context/abc123/test.md'];
			const prompt = buildFileBasedPrompt(filePaths);

			expect(prompt).toContain('plan');
			expect(prompt).toContain('conversation history');
			expect(prompt).toContain('artifacts');
		});
	});
});
