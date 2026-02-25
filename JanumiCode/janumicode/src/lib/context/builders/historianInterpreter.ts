/**
 * Historian-Interpreter Context Builder
 * Implements Phase 5.2: Historian-Interpreter role-specific context pack builder
 * Creates optimized context packs for Historian-Interpreter role invocations
 */

import type { Result, Role } from '../../types';
import { getLogger, isLoggerInitialized } from '../../logging';
import {
	compileContextPack,
	type CompileContextOptions,
	type CompiledContextPack,
} from '../compiler';
import {
	allocateBudget,
	BudgetAllocationStrategy,
} from '../budgetManager';
import { truncateContextPack, TruncationStrategy } from '../truncation';
import {
	retrieveHistoricalContext,
	searchForContradictions,
	searchForPrecedents,
	retrieveTurnsByTimeWindow,
} from '../historical';

/**
 * Historian-Interpreter query type
 */
export enum HistorianQueryType {
	CONTRADICTION_CHECK = 'CONTRADICTION_CHECK',
	PRECEDENT_SEARCH = 'PRECEDENT_SEARCH',
	INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
	GENERAL_HISTORY = 'GENERAL_HISTORY',
}

/**
 * Historian-Interpreter context pack options
 */
export interface HistorianInterpreterContextOptions {
	dialogueId: string;
	query: string; // Query for contradiction/precedent/history
	queryType: HistorianQueryType;
	relatedClaimIds?: string[]; // Claims to check
	tokenBudget: number;
	timeWindowDays?: number; // Limit historical search window
	maxHistoricalItems?: number;
}

/**
 * Build Historian-Interpreter context pack
 * Includes:
 * - Relevant history segment
 * - Query for contradiction/precedent
 * - Current state snapshot
 * - Related claims and verdicts
 * - Historical decisions
 *
 * @param options Context options
 * @returns Result containing Historian-Interpreter context pack
 */
export async function buildHistorianInterpreterContext(
	options: HistorianInterpreterContextOptions
): Promise<Result<CompiledContextPack>> {
	try {
		// Compile base context pack with extensive historical context
		const compileOptions: CompileContextOptions = {
			role: 'HISTORIAN' as Role,
			dialogueId: options.dialogueId,
			goal: options.query,
			tokenBudget: options.tokenBudget,
			includeHistorical: true,
			maxHistoricalFindings: options.maxHistoricalItems ?? 15,
		};

		const contextResult = compileContextPack(compileOptions);

		if (!contextResult.success) {
			return contextResult;
		}

		let context = contextResult.value;

		// Enhance context based on query type
		switch (options.queryType) {
			case HistorianQueryType.CONTRADICTION_CHECK:
				context = await enhanceForContradictionCheck(context, options);
				break;

			case HistorianQueryType.PRECEDENT_SEARCH:
				context = await enhanceForPrecedentSearch(context, options);
				break;

			case HistorianQueryType.INVARIANT_VIOLATION:
				context = await enhanceForInvariantCheck(context, options);
				break;

			case HistorianQueryType.GENERAL_HISTORY:
			default:
				context = await enhanceForGeneralHistory(context, options);
				break;
		}

		// Check if truncation is needed
		if (context.tokenUsage.total > options.tokenBudget) {
			// Allocate budget using Historian-specific strategy
			const budgetResult = allocateBudget(
				options.tokenBudget,
				'HISTORIAN' as Role,
				BudgetAllocationStrategy.ROLE_SPECIFIC
			);

			if (!budgetResult.success) {
				return {
					success: false,
					error: budgetResult.error,
				};
			}

			// Truncate context to fit budget
			const truncateResult = truncateContextPack(
				context,
				budgetResult.value.allocation,
				{
					strategy: TruncationStrategy.OLDEST_FIRST, // Keep recent history
					preserveCritical: false, // Historian focuses on all history
					preserveDecisions: true, // Always preserve decisions
					allowPartialContent: true,
				}
			);

			if (!truncateResult.success) {
				return {
					success: false,
					error: truncateResult.error,
				};
			}

			context = truncateResult.value.truncatedPack;
		}

		// Enhance with Historian-specific organization
		const enhanced = enhanceHistorianInterpreterContext(context);

		return { success: true, value: enhanced };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to build Historian-Interpreter context'),
		};
	}
}

/**
 * Enhance context for contradiction checking
 */
async function enhanceForContradictionCheck(
	context: CompiledContextPack,
	options: HistorianInterpreterContextOptions
): Promise<CompiledContextPack> {
	// Search for contradictions for each claim
	if (options.relatedClaimIds && options.relatedClaimIds.length > 0) {
		for (const claimId of options.relatedClaimIds) {
			const claim = context.active_claims.find((c) => c.claim_id === claimId);
			if (claim) {
				const contradictionsResult = await searchForContradictions(claim, {
					limit: 5,
					tokenBudget: Math.floor(options.tokenBudget * 0.2),
					timeWindowDays: options.timeWindowDays,
				});

				if (
					contradictionsResult.success &&
					contradictionsResult.value.length > 0
				) {
					const contradictionNotes = contradictionsResult.value.map(
						(c) =>
							`Contradiction found: "${c.item.statement}" (${c.item.status}) in dialogue ${c.dialogueId} - Similarity: ${Math.round(c.relevanceScore * 100)}%`
					);
					context.historical_findings = [
						...context.historical_findings,
						...contradictionNotes,
					];
				}
			}
		}
	}

	return context;
}

/**
 * Enhance context for precedent searching
 */
async function enhanceForPrecedentSearch(
	context: CompiledContextPack,
	options: HistorianInterpreterContextOptions
): Promise<CompiledContextPack> {
	// Search for precedents
	const precedentsResult = await searchForPrecedents(options.query, {
		limit: 10,
		tokenBudget: Math.floor(options.tokenBudget * 0.3),
		timeWindowDays: options.timeWindowDays,
		currentDialogueOnly: false,
	});

	if (precedentsResult.success && precedentsResult.value.length > 0) {
		const precedentNotes = precedentsResult.value.map(
			(p) =>
				`Precedent: ${p.item.action} in dialogue ${p.dialogueId} - "${p.item.rationale}" - Relevance: ${Math.round(p.relevanceScore * 100)}%`
		);
		context.historical_findings = [
			...precedentNotes,
			...context.historical_findings,
		];
	}

	return context;
}

/**
 * Enhance context for invariant violation checking
 */
async function enhanceForInvariantCheck(
	context: CompiledContextPack,
	options: HistorianInterpreterContextOptions
): Promise<CompiledContextPack> {
	// Retrieve comprehensive historical context
	const historicalResult = await retrieveHistoricalContext(
		options.query,
		options.relatedClaimIds || [],
		options.dialogueId,
		{
			limit: 20,
			tokenBudget: Math.floor(options.tokenBudget * 0.4),
			timeWindowDays: options.timeWindowDays,
		}
	);

	if (historicalResult.success) {
		// Add all historical claims to check for invariant violations
		const historicalClaimNotes = historicalResult.value.claims.map(
			(c) =>
				`Historical claim: [${c.item.status}] "${c.item.statement}" in dialogue ${c.dialogueId}`
		);

		// Add all historical verdicts
		const historicalVerdictNotes = historicalResult.value.verdicts.map(
			(v) => `Historical verdict: ${v.item.verdict} - ${v.item.rationale}`
		);

		context.historical_findings = [
			...historicalClaimNotes,
			...historicalVerdictNotes,
			...context.historical_findings,
		];
	}

	return context;
}

/**
 * Enhance context for general history queries
 */
async function enhanceForGeneralHistory(
	context: CompiledContextPack,
	options: HistorianInterpreterContextOptions
): Promise<CompiledContextPack> {
	// Retrieve recent dialogue turns
	const turnsResult = await retrieveTurnsByTimeWindow(options.dialogueId, {
		limit: 20,
		tokenBudget: Math.floor(options.tokenBudget * 0.3),
		timeWindowDays: options.timeWindowDays,
		currentDialogueOnly: true,
	});

	if (turnsResult.success && turnsResult.value.length > 0) {
		const turnNotes = turnsResult.value.map(
			(t) =>
				`Turn ${t.item.turn_id}: ${t.item.role} - ${t.item.phase} - ${t.item.speech_act}`
		);
		context.historical_findings = [
			...turnNotes,
			...context.historical_findings,
		];
	}

	return context;
}

/**
 * Enhance context pack with Historian-Interpreter-specific organization
 * Organizes history chronologically and by relevance
 */
function enhanceHistorianInterpreterContext(
	context: CompiledContextPack
): CompiledContextPack {
	// Sort claims by timestamp (oldest first for historical context)
	const sortedClaims = [...context.active_claims].sort(
		(a, b) =>
			new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	);

	// Sort verdicts by timestamp
	const sortedVerdicts = [...context.verdicts].sort(
		(a, b) =>
			new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
	);

	// Sort decisions by timestamp
	const sortedDecisions = [...context.human_decisions].sort(
		(a, b) =>
			new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
	);

	return {
		...context,
		active_claims: sortedClaims,
		verdicts: sortedVerdicts,
		human_decisions: sortedDecisions,
	};
}

/**
 * Format Historian-Interpreter context pack for LLM consumption
 * @param context Context pack
 * @returns Formatted context string
 */
export function formatHistorianInterpreterContext(
	context: CompiledContextPack
): string {
	const sections: string[] = [];

	// Query section
	if (context.goal) {
		sections.push(`# Historical Query\n\n${context.goal}`);
	}

	// Current state snapshot section
	let stateSection = '# Current State Snapshot\n\n';

	if (context.active_claims.length > 0) {
		stateSection += '## Active Claims\n\n';
		for (const claim of context.active_claims) {
			stateSection += `- [${claim.status}] ${claim.statement}\n`;
			stateSection += `  Introduced: ${claim.created_at} by ${claim.introduced_by}\n`;
			stateSection += `  Criticality: ${claim.criticality}\n\n`;
		}
	}

	if (context.verdicts.length > 0) {
		stateSection += '## Verdicts\n\n';
		for (const verdict of context.verdicts) {
			stateSection += `- ${verdict.verdict} for claim ${verdict.claim_id}\n`;
			stateSection += `  Timestamp: ${verdict.timestamp}\n`;
			stateSection += `  Rationale: ${verdict.rationale}\n\n`;
		}
	}

	if (context.human_decisions.length > 0) {
		stateSection += '## Human Decisions\n\n';
		for (const decision of context.human_decisions) {
			stateSection += `- ${decision.action}\n`;
			stateSection += `  Timestamp: ${decision.timestamp}\n`;
			stateSection += `  Rationale: ${decision.rationale}\n\n`;
		}
	}

	sections.push(stateSection);

	// Historical findings section (prioritized)
	if (context.historical_findings.length > 0) {
		let historicalSection = '# Historical Findings\n\n';
		for (const finding of context.historical_findings) {
			historicalSection += `- ${finding}\n`;
		}
		sections.push(historicalSection);
	}

	// Constraint manifest section
	if (context.constraint_manifest) {
		sections.push(
			`# Constraint Manifest\n\nVersion: ${context.constraint_manifest.version}\nReference: ${context.constraint_manifest.constraints_ref}`
		);
	}

	// Artifact references section
	if (context.artifact_refs.length > 0) {
		let artifactsSection = '# Referenced Artifacts\n\n';
		for (const ref of context.artifact_refs) {
			artifactsSection += `- ${ref}\n`;
		}
		sections.push(artifactsSection);
	}

	// Analysis guidelines
	sections.push(
		`# Analysis Guidelines\n\n1. Identify contradictions between current and historical state\n2. Surface relevant precedents from past decisions\n3. Detect invariant violations\n4. Provide temporal context for decisions\n5. Do not modify history - only interpret and report\n6. Do not override Verifier verdicts\n7. Flag suspicious patterns or anomalies`
	);

	// Token usage footer
	sections.push(
		`---\n\nToken Budget: ${context.token_budget}\nToken Usage: ${context.tokenUsage.total} / ${context.token_budget} (${Math.round((context.tokenUsage.total / context.token_budget) * 100)}%)`
	);

	return sections.join('\n\n');
}

/**
 * Validate Historian-Interpreter context pack
 * Ensures query and historical context are present
 * @param context Context pack
 * @returns Validation result
 */
export function validateHistorianInterpreterContext(
	context: CompiledContextPack
): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Query is required
	if (!context.goal) {
		errors.push('Historical query is required for Historian-Interpreter context');
	}

	// Warn if no historical findings
	if (context.historical_findings.length === 0) {
		warnings.push(
			'No historical findings available - Historian-Interpreter may have limited analysis capability'
		);
	}

	// Warn if no current state
	if (
		context.active_claims.length === 0 &&
		context.verdicts.length === 0 &&
		context.human_decisions.length === 0
	) {
		warnings.push(
			'No current state available - Historian-Interpreter cannot compare against history'
		);
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Historian-Interpreter context validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'context:historian' }).warn('Historian-Interpreter context warnings', { warnings });
	}

	return { success: true, value: undefined };
}
