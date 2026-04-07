import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	approximateTokensByChars,
	approximateTokensByWords,
	countTokens,
	countMessageTokens,
	countTokensSafe,
	estimateCost,
	truncateToTokenBudget,
	splitIntoChunks,
	getContextWindow,
	fitsInContextWindow,
	TokenCountMethod,
	MODEL_PRICING,
} from '../../../lib/llm/tokenCounter';
import type { Message } from '../../../lib/llm/provider';
import { MessageRole } from '../../../lib/llm/provider';

describe('Token Counter', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('approximateTokensByChars', () => {
		it('approximates tokens for short text', () => {
			const text = 'Hello world';
			const tokens = approximateTokensByChars(text);

			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThan(10);
		});

		it('approximates tokens for long text', () => {
			const text = 'This is a longer text that contains many words and characters. '.repeat(10);
			const tokens = approximateTokensByChars(text);

			expect(tokens).toBeGreaterThan(100);
		});

		it('handles empty string', () => {
			const tokens = approximateTokensByChars('');

			expect(tokens).toBe(0);
		});

		it('normalizes whitespace', () => {
			const text1 = 'Hello    world';
			const text2 = 'Hello world';
			const tokens1 = approximateTokensByChars(text1);
			const tokens2 = approximateTokensByChars(text2);

			expect(tokens1).toBe(tokens2);
		});

		it('uses ~4 characters per token approximation', () => {
			const text = 'A'.repeat(400);
			const tokens = approximateTokensByChars(text);

			expect(tokens).toBeGreaterThan(95);
			expect(tokens).toBeLessThan(105);
		});

		it('handles unicode characters', () => {
			const text = '日本語のテキスト';
			const tokens = approximateTokensByChars(text);

			expect(tokens).toBeGreaterThan(0);
		});

		it('trims leading and trailing whitespace', () => {
			const text1 = '   Hello world   ';
			const text2 = 'Hello world';
			const tokens1 = approximateTokensByChars(text1);
			const tokens2 = approximateTokensByChars(text2);

			expect(tokens1).toBe(tokens2);
		});
	});

	describe('approximateTokensByWords', () => {
		it('approximates tokens for text with words', () => {
			const text = 'This is a test sentence';
			const tokens = approximateTokensByWords(text);

			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThan(20);
		});

		it('uses ~1.3 tokens per word approximation', () => {
			const text = Array.from({ length: 100 }, (_, i) => 'word').join(' ');
			const tokens = approximateTokensByWords(text);

			expect(tokens).toBeGreaterThan(125);
			expect(tokens).toBeLessThan(135);
		});

		it('handles single word', () => {
			const tokens = approximateTokensByWords('Hello');

			expect(tokens).toBeGreaterThan(0);
		});

		it('handles empty string', () => {
			const tokens = approximateTokensByWords('');

			expect(tokens).toBe(0);
		});

		it('handles multiple spaces between words', () => {
			const text = 'word1    word2    word3';
			const tokens = approximateTokensByWords(text);

			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe('countTokens', () => {
		it('uses character approximation by default', () => {
			const text = 'Test text';
			const tokens = countTokens(text);

			expect(tokens).toBe(approximateTokensByChars(text));
		});

		it('uses word approximation when specified', () => {
			const text = 'Test text';
			const tokens = countTokens(text, TokenCountMethod.WORD_APPROXIMATION);

			expect(tokens).toBe(approximateTokensByWords(text));
		});

		it('uses character approximation when explicitly specified', () => {
			const text = 'Test text';
			const tokens = countTokens(text, TokenCountMethod.CHARACTER_APPROXIMATION);

			expect(tokens).toBe(approximateTokensByChars(text));
		});

		it('handles long text', () => {
			const text = 'Long text. '.repeat(1000);
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(1000);
		});
	});

	describe('countMessageTokens', () => {
		it('counts tokens in simple message', () => {
			const messages: Message[] = [
				{ role: MessageRole.USER, content: 'Hello' },
			];

			const tokens = countMessageTokens(messages);

			expect(tokens).toBeGreaterThan(0);
		});

		it('includes role overhead per message', () => {
			const messages: Message[] = [
				{ role: MessageRole.USER, content: 'Test' },
			];

			const tokens = countMessageTokens(messages);
			const contentTokens = countTokens('Test');

			expect(tokens).toBeGreaterThan(contentTokens);
		});

		it('counts multiple messages', () => {
			const messages: Message[] = [
				{ role: MessageRole.USER, content: 'Hello' },
				{ role: MessageRole.ASSISTANT, content: 'Hi there' },
				{ role: MessageRole.USER, content: 'How are you?' },
			];

			const tokens = countMessageTokens(messages);

			expect(tokens).toBeGreaterThan(10);
		});

		it('handles multimodal content with text', () => {
			const messages: Message[] = [
				{
					role: MessageRole.USER,
					content: [
						{ type: 'text', text: 'Describe this image' },
					],
				},
			];

			const tokens = countMessageTokens(messages);

			expect(tokens).toBeGreaterThan(0);
		});

		it('handles multimodal content with image', () => {
			const messages: Message[] = [
				{
					role: MessageRole.USER,
					content: [
						{ type: 'image', image_url: 'https://example.com/image.jpg' },
					],
				},
			];

			const tokens = countMessageTokens(messages);

			expect(tokens).toBeGreaterThan(1000);
		});

		it('handles mixed multimodal content', () => {
			const messages: Message[] = [
				{
					role: MessageRole.USER,
					content: [
						{ type: 'text', text: 'What is in this image?' },
						{ type: 'image', image_url: 'https://example.com/image.jpg' },
					],
				},
			];

			const tokens = countMessageTokens(messages);

			expect(tokens).toBeGreaterThan(1000);
		});

		it('includes message wrapper overhead', () => {
			const messages: Message[] = [];
			const tokens = countMessageTokens(messages);

			expect(tokens).toBe(3);
		});

		it('handles empty messages array', () => {
			const tokens = countMessageTokens([]);

			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe('countTokensSafe', () => {
		it('returns success result for valid text', () => {
			const result = countTokensSafe('Test text');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeGreaterThan(0);
			}
		});

		it('matches countTokens output', () => {
			const text = 'Test text';
			const result = countTokensSafe(text);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(countTokens(text));
			}
		});

		it('respects counting method', () => {
			const text = 'Test text';
			const result = countTokensSafe(text, TokenCountMethod.WORD_APPROXIMATION);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(countTokens(text, TokenCountMethod.WORD_APPROXIMATION));
			}
		});

		it('handles empty string', () => {
			const result = countTokensSafe('');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(0);
			}
		});
	});

	describe('MODEL_PRICING', () => {
		it('includes Claude models', () => {
			expect(MODEL_PRICING['claude-opus-4']).toBeDefined();
			expect(MODEL_PRICING['claude-sonnet-4']).toBeDefined();
			expect(MODEL_PRICING['claude-haiku-4']).toBeDefined();
		});

		it('includes OpenAI models', () => {
			expect(MODEL_PRICING['gpt-4']).toBeDefined();
			expect(MODEL_PRICING['gpt-4-turbo']).toBeDefined();
			expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
		});

		it('all models have input and output pricing', () => {
			for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
				expect(pricing.inputPerMillion).toBeGreaterThan(0);
				expect(pricing.outputPerMillion).toBeGreaterThan(0);
			}
		});

		it('output pricing is higher than input', () => {
			for (const pricing of Object.values(MODEL_PRICING)) {
				expect(pricing.outputPerMillion).toBeGreaterThan(pricing.inputPerMillion);
			}
		});
	});

	describe('estimateCost', () => {
		it('calculates cost for Claude Opus', () => {
			const cost = estimateCost(1000000, 1000000, 'claude-opus-4');

			expect(cost).toBeGreaterThan(0);
			expect(cost).toBe(15.0 + 75.0);
		});

		it('calculates cost for GPT-4', () => {
			const cost = estimateCost(1000000, 1000000, 'gpt-4');

			expect(cost).toBe(30.0 + 60.0);
		});

		it('handles small token counts', () => {
			const cost = estimateCost(1000, 500, 'claude-haiku-4');

			expect(cost).toBeGreaterThan(0);
			expect(cost).toBeLessThan(0.01);
		});

		it('returns 0 for unknown model', () => {
			const cost = estimateCost(1000000, 1000000, 'unknown-model');

			expect(cost).toBe(0);
		});

		it('handles zero tokens', () => {
			const cost = estimateCost(0, 0, 'claude-sonnet-4');

			expect(cost).toBe(0);
		});

		it('calculates cost correctly for different input/output ratios', () => {
			const cost1 = estimateCost(10000, 1000, 'claude-sonnet-4');
			const cost2 = estimateCost(1000, 10000, 'claude-sonnet-4');

			expect(cost1).not.toBe(cost2);
		});
	});

	describe('truncateToTokenBudget', () => {
		it('returns text unchanged if within budget', () => {
			const text = 'Short text';
			const truncated = truncateToTokenBudget(text, 1000);

			expect(truncated).toBe(text);
		});

		it('truncates text that exceeds budget', () => {
			const text = 'This is a very long text. '.repeat(1000);
			const truncated = truncateToTokenBudget(text, 100);

			expect(truncated.length).toBeLessThan(text.length);
			expect(truncated).toContain('...');
		});

		it('adds ellipsis to truncated text', () => {
			const text = 'Long text. '.repeat(1000);
			const truncated = truncateToTokenBudget(text, 50);

			expect(truncated.endsWith('...')).toBe(true);
		});

		it('respects token counting method', () => {
			const text = 'Test text. '.repeat(1000);
			const truncated1 = truncateToTokenBudget(text, 100, TokenCountMethod.CHARACTER_APPROXIMATION);
			const truncated2 = truncateToTokenBudget(text, 100, TokenCountMethod.WORD_APPROXIMATION);

			expect(truncated1.length).not.toBe(truncated2.length);
		});

		it('handles empty string', () => {
			const truncated = truncateToTokenBudget('', 100);

			expect(truncated).toBe('');
		});

		it('handles very small budget', () => {
			const text = 'Test text';
			const truncated = truncateToTokenBudget(text, 1);

			expect(truncated.length).toBeLessThan(text.length);
		});
	});

	describe('splitIntoChunks', () => {
		it('returns single chunk for short text', () => {
			const text = 'Short text';
			const chunks = splitIntoChunks(text, 1000);

			expect(chunks.length).toBe(1);
			expect(chunks[0]).toBe(text);
		});

		it('splits text into multiple chunks', () => {
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i} with some content`);
			const text = lines.join('\n');
			const chunks = splitIntoChunks(text, 50);

			expect(chunks.length).toBeGreaterThan(1);
		});

		it('preserves line boundaries', () => {
			const text = 'Line 1\nLine 2\nLine 3';
			const chunks = splitIntoChunks(text, 5);

			chunks.forEach(chunk => {
				expect(chunk.split('\n').every(line => line.includes('Line'))).toBe(true);
			});
		});

		it('truncates single line that exceeds budget', () => {
			const longLine = 'A'.repeat(1000);
			const chunks = splitIntoChunks(longLine, 50);

			expect(chunks.length).toBe(1);
			expect(chunks[0].length).toBeLessThan(longLine.length);
		});

		it('handles empty text', () => {
			const chunks = splitIntoChunks('', 100);

			expect(chunks).toEqual([]);
		});

		it('handles text with no newlines', () => {
			const text = 'This is a single line of text';
			const chunks = splitIntoChunks(text, 1000);

			expect(chunks.length).toBe(1);
		});

		it('respects token counting method', () => {
			const text = 'Line 1\nLine 2\nLine 3\n'.repeat(10);
			const chunks1 = splitIntoChunks(text, 50, TokenCountMethod.CHARACTER_APPROXIMATION);
			const chunks2 = splitIntoChunks(text, 50, TokenCountMethod.WORD_APPROXIMATION);

			expect(chunks1.length).not.toBe(chunks2.length);
		});
	});

	describe('getContextWindow', () => {
		it('returns correct size for Claude Opus', () => {
			const size = getContextWindow('claude-opus-4');

			expect(size).toBe(200000);
		});

		it('returns correct size for Claude Sonnet', () => {
			const size = getContextWindow('claude-sonnet-4');

			expect(size).toBe(200000);
		});

		it('returns correct size for Claude Haiku', () => {
			const size = getContextWindow('claude-haiku-4');

			expect(size).toBe(200000);
		});

		it('returns correct size for GPT-4 Turbo', () => {
			const size = getContextWindow('gpt-4-turbo');

			expect(size).toBe(128000);
		});

		it('returns correct size for GPT-4', () => {
			const size = getContextWindow('gpt-4');

			expect(size).toBe(8192);
		});

		it('returns correct size for GPT-3.5 Turbo', () => {
			const size = getContextWindow('gpt-3.5-turbo');

			expect(size).toBe(16385);
		});

		it('returns default for unknown model', () => {
			const size = getContextWindow('unknown-model');

			expect(size).toBe(8192);
		});

		it('handles model name variations', () => {
			const size1 = getContextWindow('claude-sonnet-4-20240620');
			const size2 = getContextWindow('claude-sonnet');

			expect(size1).toBe(200000);
			expect(size2).toBe(200000);
		});
	});

	describe('fitsInContextWindow', () => {
		it('returns true for text within window', () => {
			const text = 'Short text';
			const fits = fitsInContextWindow(text, 'claude-sonnet-4');

			expect(fits).toBe(true);
		});

		it('returns false for text exceeding window', () => {
			const text = 'A'.repeat(10000000);
			const fits = fitsInContextWindow(text, 'gpt-4');

			expect(fits).toBe(false);
		});

		it('handles edge case at boundary', () => {
			const contextWindow = getContextWindow('gpt-3.5-turbo');
			const text = 'A'.repeat(contextWindow * 4);
			const fits = fitsInContextWindow(text, 'gpt-3.5-turbo');

			expect(fits).toBe(false);
		});

		it('respects counting method', () => {
			const text = 'Test text. '.repeat(1000);
			const fits1 = fitsInContextWindow(text, 'gpt-4', TokenCountMethod.CHARACTER_APPROXIMATION);
			const fits2 = fitsInContextWindow(text, 'gpt-4', TokenCountMethod.WORD_APPROXIMATION);

			expect(typeof fits1).toBe('boolean');
			expect(typeof fits2).toBe('boolean');
		});

		it('handles empty text', () => {
			const fits = fitsInContextWindow('', 'claude-haiku-4');

			expect(fits).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles very long text', () => {
			const text = 'A'.repeat(1000000);
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(200000);
		});

		it('handles special characters', () => {
			const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(0);
		});

		it('handles newlines and tabs', () => {
			const text = 'Line 1\nLine 2\tTabbed';
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(0);
		});

		it('handles unicode emoji', () => {
			const text = '😀😃😄😁';
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(0);
		});

		it('handles mixed language text', () => {
			const text = 'Hello 你好 Bonjour こんにちは';
			const tokens = countTokens(text);

			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe('integration scenarios', () => {
		it('counts tokens for typical context pack', () => {
			const context = `# Context\n\nGoal: Build a REST API\n\nConstraints:\n- Use TypeScript\n- Follow best practices`;
			const tokens = countTokens(context);

			expect(tokens).toBeGreaterThan(10);
			expect(tokens).toBeLessThan(100);
		});

		it('truncates large context to budget', () => {
			const largeContext = 'Context section. '.repeat(10000);
			const truncated = truncateToTokenBudget(largeContext, 1000);
			const tokens = countTokens(truncated);

			expect(tokens).toBeLessThanOrEqual(1000);
		});

		it('splits large conversation into chunks', () => {
			const turns = Array.from({ length: 50 }, (_, i) => `Turn ${i}: This is a conversation turn.`);
			const conversation = turns.join('\n');
			const chunks = splitIntoChunks(conversation, 500);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach(chunk => {
				const tokens = countTokens(chunk);
				expect(tokens).toBeLessThanOrEqual(500);
			});
		});

		it('estimates cost for typical workflow', () => {
			const inputTokens = 50000;
			const outputTokens = 10000;
			const cost = estimateCost(inputTokens, outputTokens, 'claude-sonnet-4');

			expect(cost).toBeGreaterThan(0);
			expect(cost).toBeLessThan(1);
		});

		it('checks if large plan fits in context window', () => {
			const plan = 'Planning detail. '.repeat(50000);
			const fits = fitsInContextWindow(plan, 'claude-opus-4');

			expect(typeof fits).toBe('boolean');
		});
	});

	describe('consistency across methods', () => {
		it('different methods give different but reasonable results', () => {
			const text = 'This is a test sentence with multiple words';
			const charTokens = countTokens(text, TokenCountMethod.CHARACTER_APPROXIMATION);
			const wordTokens = countTokens(text, TokenCountMethod.WORD_APPROXIMATION);

			expect(charTokens).toBeGreaterThan(0);
			expect(wordTokens).toBeGreaterThan(0);
			expect(Math.abs(charTokens - wordTokens)).toBeLessThan(20);
		});

		it('maintains consistency for same text', () => {
			const text = 'Consistent text for testing';
			const tokens1 = countTokens(text);
			const tokens2 = countTokens(text);

			expect(tokens1).toBe(tokens2);
		});
	});
});
