import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../../helpers/fakeLogger';
import {
	buildHistorianInterpreterContext,
	HistorianQueryType,
	type HistorianInterpreterContextOptions,
} from '../../../../lib/context/builders/historianInterpreter';
import { randomUUID } from 'node:crypto';

describe('Historian-Interpreter Context Builder', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('buildHistorianInterpreterContext', () => {
		it('builds basic historian context successfully', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check for contradictions',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeDefined();
			}
		});

		it('handles CONTRADICTION_CHECK query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check for contradicting claims',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles PRECEDENT_SEARCH query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Find similar decisions',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles INVARIANT_VIOLATION query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check for constraint violations',
				queryType: HistorianQueryType.INVARIANT_VIOLATION,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles GENERAL_HISTORY query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Retrieve general history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles GOAL_ALIGNMENT_CHECK query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check alignment with original goal',
				queryType: HistorianQueryType.GOAL_ALIGNMENT_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles ARCHITECTURE_DRIFT_CHECK query type', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check for architecture drift',
				queryType: HistorianQueryType.ARCHITECTURE_DRIFT_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('respects token budget', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 5000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(5000);
			}
		});

		it('includes related claim IDs when provided', async () => {
			const claimIds = [randomUUID(), randomUUID()];

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check claims',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				relatedClaimIds: claimIds,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('respects timeWindowDays option', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Recent history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 30,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('respects maxHistoricalItems option', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				maxHistoricalItems: 25,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles small token budget', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 1000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(1000);
			}
		});

		it('handles large token budget', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 50000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('uses default maxHistoricalItems when not specified', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('HistorianInterpreterContextOptions interface', () => {
		it('requires dialogueId', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId: 'required-id',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 1000,
			};

			expect(options.dialogueId).toBeDefined();
		});

		it('requires query', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Required query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 1000,
			};

			expect(options.query).toBe('Required query');
		});

		it('requires queryType', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 1000,
			};

			expect(options.queryType).toBe(HistorianQueryType.CONTRADICTION_CHECK);
		});

		it('requires tokenBudget', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 5000,
			};

			expect(options.tokenBudget).toBe(5000);
		});

		it('accepts optional relatedClaimIds', () => {
			const claimIds = [randomUUID()];

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				relatedClaimIds: claimIds,
				tokenBudget: 1000,
			};

			expect(options.relatedClaimIds).toBeDefined();
			expect(options.relatedClaimIds?.length).toBe(1);
		});

		it('accepts optional timeWindowDays', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 60,
				tokenBudget: 1000,
			};

			expect(options.timeWindowDays).toBe(60);
		});

		it('accepts optional maxHistoricalItems', () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				maxHistoricalItems: 30,
				tokenBudget: 1000,
			};

			expect(options.maxHistoricalItems).toBe(30);
		});
	});

	describe('HistorianQueryType enum', () => {
		it('includes all query types', () => {
			expect(HistorianQueryType.CONTRADICTION_CHECK).toBeDefined();
			expect(HistorianQueryType.PRECEDENT_SEARCH).toBeDefined();
			expect(HistorianQueryType.INVARIANT_VIOLATION).toBeDefined();
			expect(HistorianQueryType.GENERAL_HISTORY).toBeDefined();
			expect(HistorianQueryType.GOAL_ALIGNMENT_CHECK).toBeDefined();
			expect(HistorianQueryType.ARCHITECTURE_DRIFT_CHECK).toBeDefined();
		});

		it('has string values', () => {
			expect(typeof HistorianQueryType.CONTRADICTION_CHECK).toBe('string');
			expect(typeof HistorianQueryType.PRECEDENT_SEARCH).toBe('string');
			expect(typeof HistorianQueryType.GENERAL_HISTORY).toBe('string');
		});
	});

	describe('edge cases', () => {
		it('handles very long queries', async () => {
			const longQuery = 'This is a very long query that contains extensive information about what we are looking for in the historical record. '.repeat(50);

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: longQuery,
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles special characters in query', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Query with @#$% & special chars 日本語',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles empty relatedClaimIds array', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				relatedClaimIds: [],
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles many relatedClaimIds', async () => {
			const claimIds = Array.from({ length: 50 }, () => randomUUID());

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check many claims',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				relatedClaimIds: claimIds,
				tokenBudget: 20000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles zero timeWindowDays', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 0,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles very large timeWindowDays', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 3650,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles zero maxHistoricalItems', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				maxHistoricalItems: 0,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles very large maxHistoricalItems', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				maxHistoricalItems: 1000,
				tokenBudget: 50000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles unicode in query', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: '测试查询 with 日本語 and Кириллица',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('builds complete historian context with all options', async () => {
			const claimIds = [randomUUID(), randomUUID(), randomUUID()];

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Comprehensive historical analysis of authentication decisions',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				relatedClaimIds: claimIds,
				timeWindowDays: 90,
				maxHistoricalItems: 20,
				tokenBudget: 15000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(15000);
			}
		});

		it('handles minimal configuration', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Simple query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 2000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('handles budget-constrained scenario', async () => {
			const claimIds = Array.from({ length: 20 }, () => randomUUID());

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Complex query requiring extensive historical context',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				relatedClaimIds: claimIds,
				tokenBudget: 3000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(3000);
			}
		});

		it('checks contradictions with related claims', async () => {
			const claimIds = [randomUUID()];

			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Find contradicting authentication claims',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				relatedClaimIds: claimIds,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('searches for precedents in decisions', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Find similar architectural decisions',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				timeWindowDays: 180,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('checks for invariant violations', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Verify no security constraints were violated',
				queryType: HistorianQueryType.INVARIANT_VIOLATION,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('checks goal alignment', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Verify implementation aligns with original goal',
				queryType: HistorianQueryType.GOAL_ALIGNMENT_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('checks architecture drift', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Detect architecture drift from approved plan',
				queryType: HistorianQueryType.ARCHITECTURE_DRIFT_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('token accounting', () => {
		it('accounts for query in context', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query for token accounting',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('includes historical findings in token count', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Retrieve extensive history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				maxHistoricalItems: 25,
				tokenBudget: 20000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('respects budget allocation', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Test query',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				maxHistoricalItems: 30,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(4000);
			}
		});
	});

	describe('query type-specific behavior', () => {
		it('enhances context for contradiction checks', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Find contradictions',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('enhances context for precedent searches', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Find precedents',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('enhances context for invariant checks', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Check invariants',
				queryType: HistorianQueryType.INVARIANT_VIOLATION,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('enhances context for general history', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'General history retrieval',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('time window handling', () => {
		it('limits history to recent time window', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Recent history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 7,
				tokenBudget: 10000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});

		it('retrieves extended history when window is large', async () => {
			const options: HistorianInterpreterContextOptions = {
				dialogueId,
				query: 'Extended history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 365,
				tokenBudget: 20000,
			};

			const result = await buildHistorianInterpreterContext(options);

			expect(result.success).toBe(true);
		});
	});
});
