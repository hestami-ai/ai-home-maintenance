/**
 * Context Truncation Strategies
 * Implements Phase 5.3: Intelligent context truncation
 * Handles fitting context within token budgets through various strategies
 */

import type { Result, Claim, Verdict, HumanDecision } from '../types';
import { countTokens, truncateToTokenBudget } from '../llm/tokenCounter';
import type { CompiledContextPack } from './compiler';
import type { BudgetAllocation, ComponentItem } from './budgetManager';
import { ComponentPriority } from './budgetManager';

/**
 * Truncation strategy
 */
export enum TruncationStrategy {
	/**
	 * Remove oldest items first (FIFO)
	 */
	OLDEST_FIRST = 'OLDEST_FIRST',

	/**
	 * Remove newest items first (LIFO)
	 */
	NEWEST_FIRST = 'NEWEST_FIRST',

	/**
	 * Remove lowest priority items first
	 */
	PRIORITY_BASED = 'PRIORITY_BASED',

	/**
	 * Remove largest items first
	 */
	LARGEST_FIRST = 'LARGEST_FIRST',

	/**
	 * Keep only critical items
	 */
	CRITICAL_ONLY = 'CRITICAL_ONLY',

	/**
	 * Intelligent truncation based on relevance
	 */
	RELEVANCE_BASED = 'RELEVANCE_BASED',
}

/**
 * Truncation options
 */
export interface TruncationOptions {
	strategy: TruncationStrategy;
	preserveCritical: boolean; // Always preserve critical claims
	preserveDecisions: boolean; // Always preserve human decisions
	allowPartialContent: boolean; // Allow truncating individual items
}

/**
 * Truncation result
 */
export interface TruncationResult {
	truncatedPack: CompiledContextPack;
	removedItems: {
		claims: number;
		verdicts: number;
		decisions: number;
		historicalFindings: number;
	};
	tokensSaved: number;
	warnings: string[];
}

/**
 * Default truncation options
 */
const DEFAULT_TRUNCATION_OPTIONS: TruncationOptions = {
	strategy: TruncationStrategy.PRIORITY_BASED,
	preserveCritical: true,
	preserveDecisions: true,
	allowPartialContent: false,
};

/**
 * Truncate context pack to fit within budget
 * @param pack Context pack to truncate
 * @param budget Budget allocation
 * @param options Truncation options
 * @returns Result containing truncated pack
 */
export function truncateContextPack(
	pack: CompiledContextPack,
	budget: BudgetAllocation,
	options: Partial<TruncationOptions> = {}
): Result<TruncationResult> {
	try {
		const opts = { ...DEFAULT_TRUNCATION_OPTIONS, ...options };
		const warnings: string[] = [];
		const removedItems = {
			claims: 0,
			verdicts: 0,
			decisions: 0,
			historicalFindings: 0,
		};

		let truncatedPack = { ...pack };

		// Truncate goal if needed
		if (pack.tokenUsage.goal > budget.goal) {
			const truncatedGoal = truncateToTokenBudget(pack.goal || '', budget.goal);
			truncatedPack.goal = truncatedGoal;
			warnings.push('Goal was truncated to fit budget');
		}

		// Truncate claims
		if (pack.tokenUsage.claims > budget.claims) {
			const claimsResult = truncateClaims(
				pack.active_claims,
				budget.claims,
				opts
			);
			if (claimsResult.success) {
				truncatedPack.active_claims = claimsResult.value.items;
				removedItems.claims = pack.active_claims.length - claimsResult.value.items.length;
				if (claimsResult.value.warnings.length > 0) {
					warnings.push(...claimsResult.value.warnings);
				}
			}
		}

		// Truncate verdicts
		if (pack.tokenUsage.verdicts > budget.verdicts) {
			const verdictsResult = truncateVerdicts(
				pack.verdicts,
				budget.verdicts,
				opts
			);
			if (verdictsResult.success) {
				truncatedPack.verdicts = verdictsResult.value.items;
				removedItems.verdicts = pack.verdicts.length - verdictsResult.value.items.length;
				if (verdictsResult.value.warnings.length > 0) {
					warnings.push(...verdictsResult.value.warnings);
				}
			}
		}

		// Truncate decisions (only if allowed)
		if (
			!opts.preserveDecisions &&
			pack.tokenUsage.decisions > budget.decisions
		) {
			const decisionsResult = truncateDecisions(
				pack.human_decisions,
				budget.decisions,
				opts
			);
			if (decisionsResult.success) {
				truncatedPack.human_decisions = decisionsResult.value.items;
				removedItems.decisions =
					pack.human_decisions.length - decisionsResult.value.items.length;
				if (decisionsResult.value.warnings.length > 0) {
					warnings.push(...decisionsResult.value.warnings);
				}
			}
		} else if (
			opts.preserveDecisions &&
			pack.tokenUsage.decisions > budget.decisions
		) {
			warnings.push(
				'Human decisions exceed budget but are preserved (preserveDecisions=true)'
			);
		}

		// Truncate historical findings
		if (pack.tokenUsage.historical > budget.historical) {
			const historicalResult = truncateHistoricalFindings(
				pack.historical_findings,
				budget.historical,
				opts
			);
			if (historicalResult.success) {
				truncatedPack.historical_findings = historicalResult.value.items;
				removedItems.historicalFindings =
					pack.historical_findings.length - historicalResult.value.items.length;
			}
		}

		// Recalculate token usage for truncated pack
		const newTokenUsage = calculateTruncatedTokenUsage(truncatedPack);
		truncatedPack.tokenUsage = newTokenUsage;

		const tokensSaved = pack.tokenUsage.total - newTokenUsage.total;

		return {
			success: true,
			value: {
				truncatedPack,
				removedItems,
				tokensSaved,
				warnings,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to truncate context pack'),
		};
	}
}

/**
 * Truncate claims to fit within budget
 */
function truncateClaims(
	claims: Claim[],
	budget: number,
	options: TruncationOptions
): Result<{ items: Claim[]; warnings: string[] }> {
	try {
		const warnings: string[] = [];

		// Separate critical and non-critical claims
		const criticalClaims = claims.filter(
			(c) => c.criticality === 'CRITICAL'
		);
		const nonCriticalClaims = claims.filter(
			(c) => c.criticality === 'NON_CRITICAL'
		);

		// Calculate tokens for critical claims
		const criticalTokens = criticalClaims.reduce(
			(sum, c) => sum + countTokens(c.statement),
			0
		);

		if (options.preserveCritical && criticalTokens > budget) {
			warnings.push(
				`Critical claims exceed budget: ${criticalTokens} > ${budget}`
			);
			// Still preserve them - they're critical!
			return { success: true, value: { items: criticalClaims, warnings } };
		}

		// Remaining budget for non-critical claims
		const remainingBudget = budget - criticalTokens;

		// Truncate non-critical claims
		const truncatedNonCritical = selectItemsByStrategy(
			nonCriticalClaims,
			remainingBudget,
			options.strategy,
			(c) => c.statement,
			(c) => c.created_at
		);

		const finalClaims = [...criticalClaims, ...truncatedNonCritical];

		if (truncatedNonCritical.length < nonCriticalClaims.length) {
			warnings.push(
				`Removed ${nonCriticalClaims.length - truncatedNonCritical.length} non-critical claims`
			);
		}

		return { success: true, value: { items: finalClaims, warnings } };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to truncate claims'),
		};
	}
}

/**
 * Truncate verdicts to fit within budget
 */
function truncateVerdicts(
	verdicts: Verdict[],
	budget: number,
	options: TruncationOptions
): Result<{ items: Verdict[]; warnings: string[] }> {
	try {
		const warnings: string[] = [];

		const truncated = selectItemsByStrategy(
			verdicts,
			budget,
			options.strategy,
			(v) => `${v.verdict}: ${v.rationale}`,
			(v) => v.timestamp
		);

		if (truncated.length < verdicts.length) {
			warnings.push(`Removed ${verdicts.length - truncated.length} verdicts`);
		}

		return { success: true, value: { items: truncated, warnings } };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to truncate verdicts'),
		};
	}
}

/**
 * Truncate human decisions to fit within budget
 */
function truncateDecisions(
	decisions: HumanDecision[],
	budget: number,
	options: TruncationOptions
): Result<{ items: HumanDecision[]; warnings: string[] }> {
	try {
		const warnings: string[] = [];

		const truncated = selectItemsByStrategy(
			decisions,
			budget,
			options.strategy,
			(d) => `${d.action}: ${d.rationale}`,
			(d) => d.timestamp
		);

		if (truncated.length < decisions.length) {
			warnings.push(
				`Removed ${decisions.length - truncated.length} human decisions`
			);
		}

		return { success: true, value: { items: truncated, warnings } };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to truncate decisions'),
		};
	}
}

/**
 * Truncate historical findings to fit within budget
 */
function truncateHistoricalFindings(
	findings: string[],
	budget: number,
	options: TruncationOptions
): Result<{ items: string[]; warnings: string[] }> {
	try {
		const truncated = selectItemsByStrategy(
			findings,
			budget,
			options.strategy,
			(f) => f,
			() => '' // No timestamp for findings
		);

		return { success: true, value: { items: truncated, warnings: [] } };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to truncate historical findings'),
		};
	}
}

/**
 * Select items by strategy to fit within budget
 */
function selectItemsByStrategy<T>(
	items: T[],
	budget: number,
	strategy: TruncationStrategy,
	textExtractor: (item: T) => string,
	timestampExtractor: (item: T) => string
): T[] {
	let sorted: T[];

	switch (strategy) {
		case TruncationStrategy.OLDEST_FIRST:
			// Keep newest items
			sorted = [...items].sort(
				(a, b) =>
					new Date(timestampExtractor(b)).getTime() -
					new Date(timestampExtractor(a)).getTime()
			);
			break;

		case TruncationStrategy.NEWEST_FIRST:
			// Keep oldest items
			sorted = [...items].sort(
				(a, b) =>
					new Date(timestampExtractor(a)).getTime() -
					new Date(timestampExtractor(b)).getTime()
			);
			break;

		case TruncationStrategy.LARGEST_FIRST:
			// Keep smallest items
			sorted = [...items].sort(
				(a, b) =>
					countTokens(textExtractor(a)) - countTokens(textExtractor(b))
			);
			break;

		case TruncationStrategy.PRIORITY_BASED:
		case TruncationStrategy.RELEVANCE_BASED:
		default:
			// Keep items as-is for now
			// TODO: Implement more sophisticated relevance scoring
			sorted = items;
			break;
	}

	// Select items within budget
	const selected: T[] = [];
	let usedTokens = 0;

	for (const item of sorted) {
		const itemTokens = countTokens(textExtractor(item));
		if (usedTokens + itemTokens <= budget) {
			selected.push(item);
			usedTokens += itemTokens;
		}
	}

	return selected;
}

/**
 * Calculate token usage for truncated pack
 */
function calculateTruncatedTokenUsage(
	pack: CompiledContextPack
): CompiledContextPack['tokenUsage'] {
	const goalTokens = countTokens(pack.goal || '');

	// Estimate constraint manifest tokens
	const constraintTokens = pack.constraint_manifest ? 500 : 0;

	// Count tokens for claims
	const claimsText = pack.active_claims.map((c) => c.statement).join('\n');
	const claimsTokens = countTokens(claimsText);

	// Count tokens for verdicts
	const verdictsText = pack.verdicts
		.map((v) => `${v.verdict}: ${v.rationale}`)
		.join('\n');
	const verdictsTokens = countTokens(verdictsText);

	// Count tokens for decisions
	const decisionsText = pack.human_decisions
		.map((d) => `${d.action}: ${d.rationale}`)
		.join('\n');
	const decisionsTokens = countTokens(decisionsText);

	// Estimate historical findings tokens
	const historicalTokens = pack.historical_findings.length * 100;

	const total =
		goalTokens +
		constraintTokens +
		claimsTokens +
		verdictsTokens +
		decisionsTokens +
		historicalTokens;

	return {
		goal: goalTokens,
		constraints: constraintTokens,
		claims: claimsTokens,
		verdicts: verdictsTokens,
		decisions: decisionsTokens,
		historical: historicalTokens,
		workspace: 0,
		total,
	};
}

/**
 * Estimate truncation impact
 * Provides a preview of what would be removed
 * @param pack Context pack
 * @param budget Budget allocation
 * @param options Truncation options
 * @returns Truncation impact summary
 */
export function estimateTruncationImpact(
	pack: CompiledContextPack,
	budget: BudgetAllocation,
	options: Partial<TruncationOptions> = {}
): {
	wouldRemove: {
		claims: number;
		verdicts: number;
		decisions: number;
		historicalFindings: number;
	};
	wouldSaveTokens: number;
	criticalClaimsAffected: boolean;
} {
	const opts = { ...DEFAULT_TRUNCATION_OPTIONS, ...options };

	let claimsToRemove = 0;
	let verdictsToRemove = 0;
	let decisionsToRemove = 0;
	let historicalToRemove = 0;
	let criticalClaimsAffected = false;

	// Estimate claims removal
	if (pack.tokenUsage.claims > budget.claims) {
		const criticalClaims = pack.active_claims.filter(
			(c) => c.criticality === 'CRITICAL'
		);
		const criticalTokens = criticalClaims.reduce(
			(sum, c) => sum + countTokens(c.statement),
			0
		);

		if (!opts.preserveCritical || criticalTokens <= budget.claims) {
			claimsToRemove = Math.ceil(
				(pack.active_claims.length *
					(pack.tokenUsage.claims - budget.claims)) /
					pack.tokenUsage.claims
			);
		} else {
			criticalClaimsAffected = true;
		}
	}

	// Estimate verdicts removal
	if (pack.tokenUsage.verdicts > budget.verdicts) {
		verdictsToRemove = Math.ceil(
			(pack.verdicts.length * (pack.tokenUsage.verdicts - budget.verdicts)) /
				pack.tokenUsage.verdicts
		);
	}

	// Estimate decisions removal
	if (!opts.preserveDecisions && pack.tokenUsage.decisions > budget.decisions) {
		decisionsToRemove = Math.ceil(
			(pack.human_decisions.length *
				(pack.tokenUsage.decisions - budget.decisions)) /
				pack.tokenUsage.decisions
		);
	}

	// Estimate historical removal
	if (pack.tokenUsage.historical > budget.historical) {
		historicalToRemove = Math.ceil(
			(pack.historical_findings.length *
				(pack.tokenUsage.historical - budget.historical)) /
				pack.tokenUsage.historical
		);
	}

	const wouldSaveTokens = Math.max(
		0,
		pack.tokenUsage.total - budget.total
	);

	return {
		wouldRemove: {
			claims: claimsToRemove,
			verdicts: verdictsToRemove,
			decisions: decisionsToRemove,
			historicalFindings: historicalToRemove,
		},
		wouldSaveTokens,
		criticalClaimsAffected,
	};
}
