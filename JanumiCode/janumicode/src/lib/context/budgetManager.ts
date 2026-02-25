/**
 * Token Budget Manager
 * Implements Phase 5.3: Token budget allocation and management
 * Handles intelligent budget allocation across context components
 */

import type { Result, Role } from '../types';
import { countTokens } from '../llm/tokenCounter';

/**
 * Budget allocation strategy
 */
export enum BudgetAllocationStrategy {
	/**
	 * Equal allocation across all components
	 */
	EQUAL = 'EQUAL',

	/**
	 * Priority-based allocation (critical > non-critical)
	 */
	PRIORITY = 'PRIORITY',

	/**
	 * Adaptive allocation based on content size
	 */
	ADAPTIVE = 'ADAPTIVE',

	/**
	 * Role-specific allocation patterns
	 */
	ROLE_SPECIFIC = 'ROLE_SPECIFIC',
}

/**
 * Context component priority levels
 */
export enum ComponentPriority {
	CRITICAL = 100, // Must include (goal, critical claims)
	HIGH = 75, // Should include (verdicts, human decisions)
	MEDIUM = 50, // Nice to have (historical findings)
	LOW = 25, // Optional (artifact refs)
}

/**
 * Budget allocation for context components
 */
export interface BudgetAllocation {
	goal: number;
	constraints: number;
	claims: number;
	verdicts: number;
	decisions: number;
	historical: number;
	artifacts: number;
	overhead: number; // For formatting, markers, etc.
	total: number;
}

/**
 * Budget allocation result with warnings
 */
export interface BudgetAllocationResult {
	allocation: BudgetAllocation;
	warnings: string[];
	recommendations: string[];
}

/**
 * Component content item
 */
export interface ComponentItem<T> {
	item: T;
	priority: ComponentPriority;
	tokenCount: number;
}

/**
 * Default role-specific allocations (percentages)
 */
const ROLE_ALLOCATIONS: Record<
	Role,
	{
		goal: number;
		constraints: number;
		claims: number;
		verdicts: number;
		decisions: number;
		historical: number;
		artifacts: number;
	}
> = {
	EXECUTOR: {
		goal: 0.15, // 15% for goal
		constraints: 0.2, // 20% for constraints
		claims: 0.25, // 25% for claims
		verdicts: 0.2, // 20% for verdicts
		decisions: 0.1, // 10% for decisions
		historical: 0.05, // 5% for historical
		artifacts: 0.05, // 5% for artifacts
	},
	TECHNICAL_EXPERT: {
		goal: 0.2, // 20% for specific question
		constraints: 0.1, // 10% for constraints
		claims: 0.15, // 15% for related claims
		verdicts: 0.1, // 10% for verdicts
		decisions: 0.05, // 5% for decisions
		historical: 0.3, // 30% for historical context
		artifacts: 0.1, // 10% for evidence artifacts
	},
	VERIFIER: {
		goal: 0.1, // 10% for claim to verify
		constraints: 0.3, // 30% for constraints (critical)
		claims: 0.2, // 20% for claim context
		verdicts: 0.15, // 15% for prior verdicts
		decisions: 0.1, // 10% for decisions
		historical: 0.1, // 10% for historical
		artifacts: 0.05, // 5% for evidence
	},
	HISTORIAN: {
		goal: 0.15, // 15% for query
		constraints: 0.05, // 5% for constraints
		claims: 0.25, // 25% for claims to check
		verdicts: 0.2, // 20% for verdicts
		decisions: 0.15, // 15% for decisions
		historical: 0.15, // 15% for historical precedents
		artifacts: 0.05, // 5% for artifacts
	},
	HUMAN: {
		goal: 0.2,
		constraints: 0.15,
		claims: 0.25,
		verdicts: 0.2,
		decisions: 0.15,
		historical: 0.03,
		artifacts: 0.02,
	},
};

/**
 * Overhead percentage (formatting, markers, etc.)
 */
const OVERHEAD_PERCENTAGE = 0.05; // 5%

/**
 * Allocate token budget across context components
 * @param totalBudget Total token budget
 * @param role Role for allocation
 * @param strategy Allocation strategy
 * @returns Result containing budget allocation
 */
export function allocateBudget(
	totalBudget: number,
	role: Role,
	strategy: BudgetAllocationStrategy = BudgetAllocationStrategy.ROLE_SPECIFIC
): Result<BudgetAllocationResult> {
	try {
		const warnings: string[] = [];
		const recommendations: string[] = [];

		// Reserve overhead
		const overhead = Math.floor(totalBudget * OVERHEAD_PERCENTAGE);
		const availableBudget = totalBudget - overhead;

		let allocation: BudgetAllocation;

		switch (strategy) {
			case BudgetAllocationStrategy.EQUAL:
				allocation = allocateEqual(availableBudget, overhead);
				break;

			case BudgetAllocationStrategy.PRIORITY:
				allocation = allocatePriority(availableBudget, overhead);
				break;

			case BudgetAllocationStrategy.ADAPTIVE:
				allocation = allocateAdaptive(availableBudget, overhead);
				break;

			case BudgetAllocationStrategy.ROLE_SPECIFIC:
			default:
				allocation = allocateRoleSpecific(availableBudget, role, overhead);
				break;
		}

		// Validate allocation
		if (allocation.total > totalBudget) {
			warnings.push(
				`Allocation exceeds budget: ${allocation.total} > ${totalBudget}`
			);
		}

		// Check for insufficient budgets
		if (allocation.goal < 50) {
			warnings.push('Goal budget is very low (< 50 tokens)');
			recommendations.push('Consider increasing total budget or reducing other components');
		}

		if (allocation.constraints < 100) {
			warnings.push('Constraints budget is very low (< 100 tokens)');
		}

		return {
			success: true,
			value: {
				allocation,
				warnings,
				recommendations,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to allocate budget'),
		};
	}
}

/**
 * Allocate budget equally across components
 */
function allocateEqual(
	availableBudget: number,
	overhead: number
): BudgetAllocation {
	const componentCount = 7; // goal, constraints, claims, verdicts, decisions, historical, artifacts
	const perComponent = Math.floor(availableBudget / componentCount);

	return {
		goal: perComponent,
		constraints: perComponent,
		claims: perComponent,
		verdicts: perComponent,
		decisions: perComponent,
		historical: perComponent,
		artifacts: perComponent,
		overhead,
		total: perComponent * componentCount + overhead,
	};
}

/**
 * Allocate budget based on priority
 */
function allocatePriority(
	availableBudget: number,
	overhead: number
): BudgetAllocation {
	// Critical: goal, constraints, claims
	// High: verdicts, decisions
	// Medium: historical
	// Low: artifacts

	const critical = Math.floor(availableBudget * 0.6); // 60%
	const high = Math.floor(availableBudget * 0.25); // 25%
	const medium = Math.floor(availableBudget * 0.1); // 10%
	const low = Math.floor(availableBudget * 0.05); // 5%

	return {
		goal: Math.floor(critical * 0.25),
		constraints: Math.floor(critical * 0.35),
		claims: Math.floor(critical * 0.4),
		verdicts: Math.floor(high * 0.5),
		decisions: Math.floor(high * 0.5),
		historical: medium,
		artifacts: low,
		overhead,
		total: critical + high + medium + low + overhead,
	};
}

/**
 * Allocate budget adaptively (placeholder)
 */
function allocateAdaptive(
	availableBudget: number,
	overhead: number
): BudgetAllocation {
	// For now, use priority-based allocation
	// In future, this could analyze actual content sizes and adjust
	return allocatePriority(availableBudget, overhead);
}

/**
 * Allocate budget based on role-specific patterns
 */
function allocateRoleSpecific(
	availableBudget: number,
	role: Role,
	overhead: number
): BudgetAllocation {
	const percentages = ROLE_ALLOCATIONS[role];

	return {
		goal: Math.floor(availableBudget * percentages.goal),
		constraints: Math.floor(availableBudget * percentages.constraints),
		claims: Math.floor(availableBudget * percentages.claims),
		verdicts: Math.floor(availableBudget * percentages.verdicts),
		decisions: Math.floor(availableBudget * percentages.decisions),
		historical: Math.floor(availableBudget * percentages.historical),
		artifacts: Math.floor(availableBudget * percentages.artifacts),
		overhead,
		total:
			Math.floor(availableBudget * percentages.goal) +
			Math.floor(availableBudget * percentages.constraints) +
			Math.floor(availableBudget * percentages.claims) +
			Math.floor(availableBudget * percentages.verdicts) +
			Math.floor(availableBudget * percentages.decisions) +
			Math.floor(availableBudget * percentages.historical) +
			Math.floor(availableBudget * percentages.artifacts) +
			overhead,
	};
}

/**
 * Prioritize and sort items by priority and token count
 * @param items Items to prioritize
 * @param budget Token budget for this component
 * @returns Prioritized items within budget
 */
export function prioritizeItems<T>(
	items: ComponentItem<T>[],
	budget: number
): ComponentItem<T>[] {
	// Sort by priority (descending) then by token count (ascending)
	const sorted = items.sort((a, b) => {
		if (a.priority !== b.priority) {
			return b.priority - a.priority; // Higher priority first
		}
		return a.tokenCount - b.tokenCount; // Smaller items first within same priority
	});

	// Select items within budget
	const selected: ComponentItem<T>[] = [];
	let usedTokens = 0;

	for (const item of sorted) {
		if (usedTokens + item.tokenCount <= budget) {
			selected.push(item);
			usedTokens += item.tokenCount;
		}
	}

	return selected;
}

/**
 * Calculate remaining budget
 * @param totalBudget Total budget
 * @param used Used tokens
 * @returns Remaining tokens
 */
export function calculateRemainingBudget(
	totalBudget: number,
	used: number
): number {
	return Math.max(0, totalBudget - used);
}

/**
 * Check if content fits within budget
 * @param content Content to check
 * @param budget Token budget
 * @returns True if content fits
 */
export function fitsWithinBudget(content: string, budget: number): boolean {
	const tokens = countTokens(content);
	return tokens <= budget;
}

/**
 * Get budget utilization percentage
 * @param used Used tokens
 * @param total Total budget
 * @returns Utilization percentage (0-100)
 */
export function getBudgetUtilization(used: number, total: number): number {
	if (total === 0) {return 0;}
	return Math.round((used / total) * 100);
}

/**
 * Get budget status
 * @param used Used tokens
 * @param total Total budget
 * @returns Budget status
 */
export function getBudgetStatus(
	used: number,
	total: number
): 'OK' | 'WARNING' | 'EXCEEDED' {
	const utilization = getBudgetUtilization(used, total);

	if (utilization > 100) {return 'EXCEEDED';}
	if (utilization > 90) {return 'WARNING';}
	return 'OK';
}

/**
 * Format budget allocation for display
 * @param allocation Budget allocation
 * @returns Formatted string
 */
export function formatBudgetAllocation(allocation: BudgetAllocation): string {
	return `Budget Allocation:
  Goal:        ${allocation.goal} tokens (${Math.round((allocation.goal / allocation.total) * 100)}%)
  Constraints: ${allocation.constraints} tokens (${Math.round((allocation.constraints / allocation.total) * 100)}%)
  Claims:      ${allocation.claims} tokens (${Math.round((allocation.claims / allocation.total) * 100)}%)
  Verdicts:    ${allocation.verdicts} tokens (${Math.round((allocation.verdicts / allocation.total) * 100)}%)
  Decisions:   ${allocation.decisions} tokens (${Math.round((allocation.decisions / allocation.total) * 100)}%)
  Historical:  ${allocation.historical} tokens (${Math.round((allocation.historical / allocation.total) * 100)}%)
  Artifacts:   ${allocation.artifacts} tokens (${Math.round((allocation.artifacts / allocation.total) * 100)}%)
  Overhead:    ${allocation.overhead} tokens (${Math.round((allocation.overhead / allocation.total) * 100)}%)
  ---
  Total:       ${allocation.total} tokens`;
}

/**
 * Create component item with automatic token counting
 * @param item Item
 * @param priority Priority level
 * @param textExtractor Function to extract text from item
 * @returns Component item
 */
export function createComponentItem<T>(
	item: T,
	priority: ComponentPriority,
	textExtractor: (item: T) => string
): ComponentItem<T> {
	const text = textExtractor(item);
	const tokenCount = countTokens(text);

	return {
		item,
		priority,
		tokenCount,
	};
}
