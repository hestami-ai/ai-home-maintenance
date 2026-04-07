import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	allocateBudget,
	prioritizeItems,
	calculateRemainingBudget,
	fitsWithinBudget,
	getBudgetUtilization,
	getBudgetStatus,
	formatBudgetAllocation,
	createComponentItem,
	BudgetAllocationStrategy,
	ComponentPriority,
	type ComponentItem,
} from '../../../lib/context/budgetManager';
import { Role } from '../../../lib/types';

describe('Budget Manager', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('allocateBudget', () => {
		it('allocates budget with EQUAL strategy', () => {
			const result = allocateBudget(10000, Role.EXECUTOR, BudgetAllocationStrategy.EQUAL);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.total).toBeLessThanOrEqual(10000);
				expect(allocation.goal).toBeGreaterThan(0);
				expect(allocation.constraints).toBeGreaterThan(0);
				expect(allocation.claims).toBeGreaterThan(0);
				expect(allocation.overhead).toBeGreaterThan(0);
			}
		});

		it('allocates budget with PRIORITY strategy', () => {
			const result = allocateBudget(10000, Role.EXECUTOR, BudgetAllocationStrategy.PRIORITY);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.constraints).toBeGreaterThan(allocation.artifacts);
				expect(allocation.claims).toBeGreaterThan(allocation.historical);
			}
		});

		it('allocates budget with ADAPTIVE strategy', () => {
			const result = allocateBudget(10000, Role.EXECUTOR, BudgetAllocationStrategy.ADAPTIVE);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.allocation.total).toBeLessThanOrEqual(10000);
			}
		});

		it('allocates budget with ROLE_SPECIFIC strategy for EXECUTOR', () => {
			const result = allocateBudget(10000, Role.EXECUTOR, BudgetAllocationStrategy.ROLE_SPECIFIC);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.claims).toBeGreaterThan(0);
				expect(allocation.verdicts).toBeGreaterThan(0);
				expect(allocation.total).toBeLessThanOrEqual(10000);
			}
		});

		it('allocates budget with ROLE_SPECIFIC strategy for VERIFIER', () => {
			const result = allocateBudget(10000, Role.VERIFIER, BudgetAllocationStrategy.ROLE_SPECIFIC);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.constraints).toBeGreaterThan(allocation.goal);
			}
		});

		it('allocates budget with ROLE_SPECIFIC strategy for TECHNICAL_EXPERT', () => {
			const result = allocateBudget(10000, Role.TECHNICAL_EXPERT, BudgetAllocationStrategy.ROLE_SPECIFIC);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.historical).toBeGreaterThan(allocation.decisions);
			}
		});

		it('allocates budget with ROLE_SPECIFIC strategy for HISTORIAN', () => {
			const result = allocateBudget(10000, Role.HISTORIAN, BudgetAllocationStrategy.ROLE_SPECIFIC);

			expect(result.success).toBe(true);
			if (result.success) {
				const allocation = result.value.allocation;
				expect(allocation.claims).toBeGreaterThan(0);
				expect(allocation.verdicts).toBeGreaterThan(0);
			}
		});

		it('includes overhead in allocation', () => {
			const result = allocateBudget(10000, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.allocation.overhead).toBeGreaterThan(0);
				expect(result.value.allocation.overhead).toBeLessThan(1000);
			}
		});

		it('warns when goal budget is very low', () => {
			const result = allocateBudget(500, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				const hasGoalWarning = result.value.warnings.some(w => 
					w.includes('Goal budget') && w.includes('very low')
				);
				expect(hasGoalWarning).toBe(true);
			}
		});

		it('warns when constraints budget is very low', () => {
			const result = allocateBudget(500, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				const hasConstraintsWarning = result.value.warnings.some(w => 
					w.includes('Constraints budget') && w.includes('very low')
				);
				expect(hasConstraintsWarning).toBe(true);
			}
		});

		it('provides recommendations when budget is tight', () => {
			const result = allocateBudget(500, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.recommendations.length).toBeGreaterThan(0);
			}
		});

		it('handles zero budget gracefully', () => {
			const result = allocateBudget(0, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.allocation.total).toBe(0);
			}
		});

		it('handles very large budget', () => {
			const result = allocateBudget(1000000, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.allocation.total).toBeLessThanOrEqual(1000000);
				expect(result.value.warnings.length).toBe(0);
			}
		});

		it('uses ROLE_SPECIFIC as default strategy', () => {
			const result = allocateBudget(10000, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.allocation.claims).toBeGreaterThan(0);
			}
		});
	});

	describe('prioritizeItems', () => {
		it('prioritizes items by priority level', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'low', priority: ComponentPriority.LOW, tokenCount: 100 },
				{ item: 'critical', priority: ComponentPriority.CRITICAL, tokenCount: 100 },
				{ item: 'medium', priority: ComponentPriority.MEDIUM, tokenCount: 100 },
				{ item: 'high', priority: ComponentPriority.HIGH, tokenCount: 100 },
			];

			const prioritized = prioritizeItems(items, 1000);

			expect(prioritized[0].item).toBe('critical');
			expect(prioritized[0].priority).toBe(ComponentPriority.CRITICAL);
		});

		it('prioritizes smaller items within same priority', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'large', priority: ComponentPriority.HIGH, tokenCount: 500 },
				{ item: 'small', priority: ComponentPriority.HIGH, tokenCount: 100 },
				{ item: 'medium', priority: ComponentPriority.HIGH, tokenCount: 300 },
			];

			const prioritized = prioritizeItems(items, 1000);

			expect(prioritized[0].item).toBe('small');
			expect(prioritized[0].tokenCount).toBe(100);
		});

		it('selects items within budget', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'item1', priority: ComponentPriority.CRITICAL, tokenCount: 300 },
				{ item: 'item2', priority: ComponentPriority.HIGH, tokenCount: 300 },
				{ item: 'item3', priority: ComponentPriority.MEDIUM, tokenCount: 300 },
				{ item: 'item4', priority: ComponentPriority.LOW, tokenCount: 300 },
			];

			const prioritized = prioritizeItems(items, 700);

			expect(prioritized.length).toBe(2);
			expect(prioritized[0].priority).toBe(ComponentPriority.CRITICAL);
			expect(prioritized[1].priority).toBe(ComponentPriority.HIGH);
		});

		it('excludes items that exceed budget', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'small1', priority: ComponentPriority.CRITICAL, tokenCount: 100 },
				{ item: 'small2', priority: ComponentPriority.HIGH, tokenCount: 100 },
				{ item: 'large', priority: ComponentPriority.MEDIUM, tokenCount: 1000 },
			];

			const prioritized = prioritizeItems(items, 300);

			expect(prioritized.length).toBe(2);
			expect(prioritized.some(p => p.item === 'large')).toBe(false);
		});

		it('handles empty items array', () => {
			const prioritized = prioritizeItems([], 1000);

			expect(prioritized).toEqual([]);
		});

		it('handles zero budget', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'item', priority: ComponentPriority.CRITICAL, tokenCount: 100 },
			];

			const prioritized = prioritizeItems(items, 0);

			expect(prioritized).toEqual([]);
		});
	});

	describe('calculateRemainingBudget', () => {
		it('calculates remaining budget correctly', () => {
			const remaining = calculateRemainingBudget(10000, 3000);

			expect(remaining).toBe(7000);
		});

		it('returns 0 when budget is exceeded', () => {
			const remaining = calculateRemainingBudget(1000, 1500);

			expect(remaining).toBe(0);
		});

		it('returns total when nothing is used', () => {
			const remaining = calculateRemainingBudget(10000, 0);

			expect(remaining).toBe(10000);
		});

		it('returns 0 when fully used', () => {
			const remaining = calculateRemainingBudget(10000, 10000);

			expect(remaining).toBe(0);
		});
	});

	describe('fitsWithinBudget', () => {
		it('returns true when content fits', () => {
			const fits = fitsWithinBudget('Short text', 1000);

			expect(fits).toBe(true);
		});

		it('returns false when content exceeds budget', () => {
			const longText = 'This is a very long text that contains many words '.repeat(100);
			const fits = fitsWithinBudget(longText, 50);

			expect(fits).toBe(false);
		});

		it('handles empty content', () => {
			const fits = fitsWithinBudget('', 100);

			expect(fits).toBe(true);
		});

		it('handles zero budget', () => {
			const fits = fitsWithinBudget('Some text', 0);

			expect(fits).toBe(false);
		});
	});

	describe('getBudgetUtilization', () => {
		it('calculates utilization percentage correctly', () => {
			const utilization = getBudgetUtilization(5000, 10000);

			expect(utilization).toBe(50);
		});

		it('returns 100 when fully used', () => {
			const utilization = getBudgetUtilization(10000, 10000);

			expect(utilization).toBe(100);
		});

		it('returns 0 when nothing is used', () => {
			const utilization = getBudgetUtilization(0, 10000);

			expect(utilization).toBe(0);
		});

		it('returns over 100 when exceeded', () => {
			const utilization = getBudgetUtilization(15000, 10000);

			expect(utilization).toBeGreaterThan(100);
		});

		it('handles zero total budget', () => {
			const utilization = getBudgetUtilization(100, 0);

			expect(utilization).toBe(0);
		});

		it('rounds to nearest integer', () => {
			const utilization = getBudgetUtilization(3333, 10000);

			expect(Number.isInteger(utilization)).toBe(true);
		});
	});

	describe('getBudgetStatus', () => {
		it('returns OK when utilization is below 90%', () => {
			const status = getBudgetStatus(5000, 10000);

			expect(status).toBe('OK');
		});

		it('returns WARNING when utilization is between 90% and 100%', () => {
			const status = getBudgetStatus(9500, 10000);

			expect(status).toBe('WARNING');
		});

		it('returns EXCEEDED when utilization is over 100%', () => {
			const status = getBudgetStatus(15000, 10000);

			expect(status).toBe('EXCEEDED');
		});

		it('returns OK at exactly 90%', () => {
			const status = getBudgetStatus(9000, 10000);

			expect(status).toBe('OK');
		});

		it('returns WARNING at exactly 91%', () => {
			const status = getBudgetStatus(9100, 10000);

			expect(status).toBe('WARNING');
		});

		it('returns EXCEEDED at exactly 101%', () => {
			const status = getBudgetStatus(10100, 10000);

			expect(status).toBe('EXCEEDED');
		});
	});

	describe('formatBudgetAllocation', () => {
		it('formats budget allocation as readable string', () => {
			const allocation = {
				goal: 1500,
				constraints: 2000,
				claims: 2500,
				verdicts: 2000,
				decisions: 1000,
				historical: 500,
				artifacts: 500,
				overhead: 500,
				total: 10500,
			};

			const formatted = formatBudgetAllocation(allocation);

			expect(formatted).toContain('Budget Allocation:');
			expect(formatted).toContain('Goal:');
			expect(formatted).toContain('1500 tokens');
			expect(formatted).toContain('Total:');
			expect(formatted).toContain('10500 tokens');
		});

		it('includes percentage calculations', () => {
			const allocation = {
				goal: 1000,
				constraints: 1000,
				claims: 1000,
				verdicts: 1000,
				decisions: 1000,
				historical: 1000,
				artifacts: 1000,
				overhead: 500,
				total: 7500,
			};

			const formatted = formatBudgetAllocation(allocation);

			expect(formatted).toContain('%');
		});

		it('handles zero values', () => {
			const allocation = {
				goal: 0,
				constraints: 0,
				claims: 0,
				verdicts: 0,
				decisions: 0,
				historical: 0,
				artifacts: 0,
				overhead: 0,
				total: 0,
			};

			const formatted = formatBudgetAllocation(allocation);

			expect(formatted).toContain('0 tokens');
		});
	});

	describe('createComponentItem', () => {
		it('creates component item with correct token count', () => {
			interface TestItem {
				text: string;
			}
			const item: TestItem = { text: 'This is a test claim statement' };
			
			const componentItem = createComponentItem(
				item,
				ComponentPriority.HIGH,
				(i) => i.text
			);

			expect(componentItem.item).toBe(item);
			expect(componentItem.priority).toBe(ComponentPriority.HIGH);
			expect(componentItem.tokenCount).toBeGreaterThan(0);
		});

		it('handles empty text', () => {
			const item = { text: '' };
			
			const componentItem = createComponentItem(
				item,
				ComponentPriority.LOW,
				(i) => i.text
			);

			expect(componentItem.tokenCount).toBe(0);
		});

		it('handles complex objects', () => {
			interface ComplexItem {
				title: string;
				description: string;
			}
			const item: ComplexItem = {
				title: 'Test',
				description: 'This is a description',
			};
			
			const componentItem = createComponentItem(
				item,
				ComponentPriority.CRITICAL,
				(i) => `${i.title}: ${i.description}`
			);

			expect(componentItem.item).toBe(item);
			expect(componentItem.priority).toBe(ComponentPriority.CRITICAL);
			expect(componentItem.tokenCount).toBeGreaterThan(0);
		});
	});

	describe('integration scenarios', () => {
		it('allocates and prioritizes for complete workflow', () => {
			const budgetResult = allocateBudget(10000, Role.EXECUTOR);

			expect(budgetResult.success).toBe(true);
			if (budgetResult.success) {
				const allocation = budgetResult.value.allocation;

				const items: ComponentItem<string>[] = [
					{ item: 'claim1', priority: ComponentPriority.CRITICAL, tokenCount: 200 },
					{ item: 'claim2', priority: ComponentPriority.HIGH, tokenCount: 150 },
					{ item: 'claim3', priority: ComponentPriority.MEDIUM, tokenCount: 100 },
				];

				const prioritized = prioritizeItems(items, allocation.claims);

				expect(prioritized.length).toBeGreaterThan(0);
				expect(prioritized[0].priority).toBe(ComponentPriority.CRITICAL);
			}
		});

		it('handles budget tracking across multiple components', () => {
			const totalBudget = 10000;
			let used = 0;

			used += 1500; // goal
			expect(calculateRemainingBudget(totalBudget, used)).toBe(8500);

			used += 2500; // claims
			expect(calculateRemainingBudget(totalBudget, used)).toBe(6000);

			used += 2000; // verdicts
			expect(calculateRemainingBudget(totalBudget, used)).toBe(4000);

			expect(getBudgetStatus(used, totalBudget)).toBe('OK');
		});

		it('detects budget issues early', () => {
			const budgetResult = allocateBudget(10000, Role.EXECUTOR);

			expect(budgetResult.success).toBe(true);
			if (budgetResult.success) {
				const allocation = budgetResult.value.allocation;
				const used = allocation.total * 0.95;

				const status = getBudgetStatus(used, allocation.total);
				expect(status).toBe('WARNING');
			}
		});
	});

	describe('edge cases', () => {
		it('handles negative budget gracefully', () => {
			const result = allocateBudget(-1000, Role.EXECUTOR);

			expect(result.success).toBe(true);
		});

		it('handles very small budget', () => {
			const result = allocateBudget(10, Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.warnings.length).toBeGreaterThan(0);
			}
		});

		it('handles all priority levels', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'critical', priority: ComponentPriority.CRITICAL, tokenCount: 100 },
				{ item: 'high', priority: ComponentPriority.HIGH, tokenCount: 100 },
				{ item: 'medium', priority: ComponentPriority.MEDIUM, tokenCount: 100 },
				{ item: 'low', priority: ComponentPriority.LOW, tokenCount: 100 },
			];

			const prioritized = prioritizeItems(items, 450);

			expect(prioritized.length).toBe(4);
		});

		it('handles single item exceeding budget', () => {
			const items: ComponentItem<string>[] = [
				{ item: 'huge', priority: ComponentPriority.CRITICAL, tokenCount: 10000 },
			];

			const prioritized = prioritizeItems(items, 1000);

			expect(prioritized).toEqual([]);
		});
	});
});
