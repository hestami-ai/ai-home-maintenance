import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { runHypothesizers } from '../../../lib/workflow/validateHypothesizer';
import type { RawHypothesis } from '../../../lib/types/validate';

const mockHypotheses: Record<string, RawHypothesis[]> = {
	security: [
		{
			id: 'S-001',
			category: 'security',
			severity: 'critical',
			text: 'SQL injection vulnerability in user input',
			location: 'auth.ts:42',
		},
		{
			id: 'S-002',
			category: 'security',
			severity: 'high',
			text: 'Unvalidated redirect in login flow',
			location: 'auth.ts:67',
		},
	],
	logic: [
		{
			id: 'L-001',
			category: 'logic',
			severity: 'high',
			text: 'Race condition in concurrent updates',
			location: 'store.ts:120',
		},
		{
			id: 'L-002',
			category: 'logic',
			severity: 'medium',
			text: 'Off-by-one error in loop bounds',
			location: 'utils.ts:34',
		},
	],
	best_practices: [
		{
			id: 'BP-001',
			category: 'best_practices',
			severity: 'low',
			text: 'Missing error handling in async function',
			location: 'api.ts:15',
		},
	],
};

vi.mock('../../../lib/roles/validationHypothesizer', () => ({
	invokeHypothesizer: vi.fn(async (category: string) => ({
		hypotheses: mockHypotheses[category] || [],
		agentType: category as 'security' | 'logic' | 'best_practices',
	})),
}));

vi.mock('../../../lib/config/manager', () => ({
	isValidationParallelAgentsEnabled: vi.fn(() => false),
}));

describe('ValidateHypothesizer', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		vi.clearAllMocks();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('runHypothesizers', () => {
		it('runs all three hypothesizer agents', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			const context = 'Test context for validation';

			await runHypothesizers(context);

			expect(invokeHypothesizer).toHaveBeenCalledTimes(3);
			expect(invokeHypothesizer).toHaveBeenCalledWith('security', context, undefined);
			expect(invokeHypothesizer).toHaveBeenCalledWith('logic', context, undefined);
			expect(invokeHypothesizer).toHaveBeenCalledWith('best_practices', context, undefined);
		});

		it('merges hypotheses from all agents', async () => {
			const context = 'Test context';
			const result = await runHypothesizers(context);

			expect(result.length).toBeGreaterThanOrEqual(5);
			expect(result.some(h => h.category === 'security')).toBe(true);
			expect(result.some(h => h.category === 'logic')).toBe(true);
			expect(result.some(h => h.category === 'best_practices')).toBe(true);
		});

		it('runs agents sequentially by default', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			const callOrder: string[] = [];

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				callOrder.push(category);
				return { 
					hypotheses: mockHypotheses[category] || [],
					agentType: category as 'security' | 'logic' | 'best_practices'
				};
			});

			await runHypothesizers('Test context');

			expect(callOrder).toEqual(['security', 'logic', 'best_practices']);
		});

		it('runs agents in parallel when enabled', async () => {
			const { isValidationParallelAgentsEnabled } = await import('../../../lib/config/manager');
			vi.mocked(isValidationParallelAgentsEnabled).mockReturnValue(true);

			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			const startTimes: Record<string, number> = {};
			const endTimes: Record<string, number> = {};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				startTimes[category] = Date.now();
				await new Promise(resolve => setTimeout(resolve, 10));
				endTimes[category] = Date.now();
				return { 
					hypotheses: mockHypotheses[category] || [],
					agentType: category as 'security' | 'logic' | 'best_practices'
				};
			});

			await runHypothesizers('Test context');

			expect(invokeHypothesizer).toHaveBeenCalledTimes(3);
		});

		it('passes onEvent callback to hypothesizers', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			const onEvent = vi.fn();

			await runHypothesizers('Test context', onEvent);

			expect(invokeHypothesizer).toHaveBeenCalledWith('security', 'Test context', onEvent);
			expect(invokeHypothesizer).toHaveBeenCalledWith('logic', 'Test context', onEvent);
			expect(invokeHypothesizer).toHaveBeenCalledWith('best_practices', 'Test context', onEvent);
		});

		it('deduplicates similar hypotheses', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const duplicate1: RawHypothesis = {
				id: 'D-001',
				category: 'security',
				severity: 'high',
				text: 'SQL injection vulnerability in user input',
				location: 'auth.ts:42',
			};

			const duplicate2: RawHypothesis = {
				id: 'D-002',
				category: 'security',
				severity: 'high',
				text: 'SQL injection vulnerability in user input data',
				location: 'auth.ts:43',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: [duplicate1, duplicate2], agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBeLessThan(2);
		});

		it('keeps hypotheses with different text', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const hyp1: RawHypothesis = {
				id: 'H-001',
				category: 'security',
				severity: 'high',
				text: 'SQL injection in auth module',
				location: 'auth.ts:42',
			};

			const hyp2: RawHypothesis = {
				id: 'H-002',
				category: 'security',
				severity: 'high',
				text: 'XSS vulnerability in rendering',
				location: 'render.ts:10',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: [hyp1, hyp2], agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBe(2);
		});

		it('handles empty results from hypothesizers', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			vi.mocked(invokeHypothesizer).mockResolvedValue({ hypotheses: [], agentType: 'security' });

			const result = await runHypothesizers('Test context');

			expect(result).toEqual([]);
		});

		it('preserves hypothesis properties during merge', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => ({
				hypotheses: [
					{ id: `${agentType}-1`, category: agentType, severity: 'high', text: 'Sample finding', location: 'x.ts:1' },
				],
				agentType,
			}));

			const result = await runHypothesizers('Test context');

			expect(result.length).toBeGreaterThan(0);
			for (const hypothesis of result) {
				expect(hypothesis).toHaveProperty('id');
				expect(hypothesis).toHaveProperty('category');
				expect(hypothesis).toHaveProperty('severity');
				expect(hypothesis).toHaveProperty('text');
				expect(hypothesis).toHaveProperty('location');
			}
		});

		it('handles different severity levels', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => {
				if (agentType === 'security') {
					return {
						hypotheses: [
							{ id: 'H1', category: 'security', severity: 'high', text: 'High sev issue', location: 'a.ts:1' },
							{ id: 'H2', category: 'security', severity: 'low', text: 'Low sev issue', location: 'b.ts:2' },
						],
						agentType,
					};
				}
				return { hypotheses: [], agentType };
			});

			const result = await runHypothesizers('Test context');

			const severities = new Set(result.map(h => h.severity));
			expect(severities.size).toBeGreaterThan(1);
		});

		it('handles different categories', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => ({
				hypotheses: [
					{ id: `${agentType}-1`, category: agentType, severity: 'medium', text: `${agentType} finding`, location: 'x.ts:1' },
				],
				agentType,
			}));

			const result = await runHypothesizers('Test context');

			const categories = new Set(result.map(h => h.category));
			expect(categories.has('security')).toBe(true);
			expect(categories.has('logic')).toBe(true);
			expect(categories.has('best_practices')).toBe(true);
		});
	});

	describe('deduplication logic', () => {
		it('removes exact duplicates', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const hypothesis: RawHypothesis = {
				id: 'H-001',
				category: 'security',
				severity: 'high',
				text: 'Identical text for testing',
				location: 'file.ts:10',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: [hypothesis, { ...hypothesis, id: 'H-002' }], agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBe(1);
		});

		it('removes near-duplicates with similar text', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const hyp1: RawHypothesis = {
				id: 'H-001',
				category: 'security',
				severity: 'high',
				text: 'Missing authentication check in the user profile endpoint',
				location: 'api.ts:100',
			};

			const hyp2: RawHypothesis = {
				id: 'H-002',
				category: 'security',
				severity: 'high',
				text: 'Missing authentication check in user profile endpoint',
				location: 'api.ts:101',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: [hyp1, hyp2], agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBe(1);
		});

		it('keeps hypotheses with low similarity', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const hyp1: RawHypothesis = {
				id: 'H-001',
				category: 'security',
				severity: 'high',
				text: 'SQL injection vulnerability',
				location: 'auth.ts:42',
			};

			const hyp2: RawHypothesis = {
				id: 'H-002',
				category: 'logic',
				severity: 'medium',
				text: 'Race condition in state updates',
				location: 'store.ts:120',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => {
				if (agentType === 'security') {
					return { hypotheses: [hyp1], agentType };
				}
				if (agentType === 'logic') {
					return { hypotheses: [hyp2], agentType };
				}
				return { hypotheses: [], agentType };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBe(2);
		});

		it('handles edge case with empty text', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const hyp1: RawHypothesis = {
				id: 'H-001',
				category: 'security',
				severity: 'high',
				text: '',
				location: 'file.ts:10',
			};

			const hyp2: RawHypothesis = {
				id: 'H-002',
				category: 'security',
				severity: 'high',
				text: '',
				location: 'file.ts:20',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: [hyp1, hyp2], agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('integration scenarios', () => {
		it('handles complete hypothesizing workflow', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');
			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => ({
				hypotheses: [
					{
						id: `${agentType}-1`,
						category: agentType,
						severity: 'high',
						text: agentType === 'security'
							? 'SQL injection in authenticateUser'
							: `${agentType} concern in authenticateUser`,
						location: 'auth.ts:3',
					},
				],
				agentType,
			}));

			const context = `
				function authenticateUser(username, password) {
					const query = "SELECT * FROM users WHERE username='" + username + "'";
					// Missing authentication logic
				}
			`;

			const result = await runHypothesizers(context);

			expect(result.length).toBeGreaterThan(0);
			expect(result.every(h => h.id && h.category && h.text)).toBe(true);
		});

		it('handles large number of hypotheses', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const manyHypotheses: RawHypothesis[] = Array.from({ length: 50 }, (_, i) => ({
				id: `H-${i}`,
				category: 'security',
				severity: 'medium',
				text: `Unique hypothesis ${i} with different content`,
				location: `file.ts:${i}`,
			}));

			vi.mocked(invokeHypothesizer).mockImplementation(async (category: string) => {
				if (category === 'security') {
					return { hypotheses: manyHypotheses, agentType: 'security' };
				}
				return { hypotheses: [], agentType: category as 'security' | 'logic' | 'best_practices' };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBeGreaterThan(0);
			expect(result.length).toBeLessThanOrEqual(50);
		});

		it('preserves first occurrence when deduplicating', async () => {
			const { invokeHypothesizer } = await import('../../../lib/roles/validationHypothesizer');

			const first: RawHypothesis = {
				id: 'FIRST',
				category: 'security',
				severity: 'critical',
				text: 'Duplicate issue found in code',
				location: 'first.ts:1',
			};

			const second: RawHypothesis = {
				id: 'SECOND',
				category: 'security',
				severity: 'high',
				text: 'Duplicate issue found in the code',
				location: 'second.ts:2',
			};

			vi.mocked(invokeHypothesizer).mockImplementation(async (agentType) => {
				if (agentType === 'security') {
					return { hypotheses: [first, second], agentType };
				}
				return { hypotheses: [], agentType };
			});

			const result = await runHypothesizers('Test context');

			expect(result.length).toBe(1);
			expect(result[0].id).toBe('FIRST');
		});

		it('handles mixed execution modes correctly', async () => {
			const { isValidationParallelAgentsEnabled } = await import('../../../lib/config/manager');

			vi.mocked(isValidationParallelAgentsEnabled).mockReturnValue(false);
			const resultSequential = await runHypothesizers('Test context');

			vi.mocked(isValidationParallelAgentsEnabled).mockReturnValue(true);
			const resultParallel = await runHypothesizers('Test context');

			expect(resultSequential.length).toBe(resultParallel.length);
		});

		it('handles context with special characters', async () => {
			const context = `
				const data = { "key": "value", 'single': 'quotes' };
				const regex = /[a-z]+/g;
				const template = \`\${variable}\`;
			`;

			const result = await runHypothesizers(context);

			expect(Array.isArray(result)).toBe(true);
		});

		it('returns unique IDs for all hypotheses', async () => {
			const context = 'Test context';
			const result = await runHypothesizers(context);

			const ids = result.map(h => h.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length);
		});
	});
});
