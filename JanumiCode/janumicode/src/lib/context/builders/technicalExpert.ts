/**
 * Technical Expert Context Builder
 * Implements Phase 5.2: Technical Expert role-specific context pack builder
 * Creates optimized context packs for Technical Expert role invocations
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
import { retrieveHistoricalContext } from '../historical';

/**
 * Technical Expert context pack options
 */
export interface TechnicalExpertContextOptions {
	dialogueId: string;
	question: string; // Specific technical question
	relatedClaimIds?: string[]; // Related claim IDs
	tokenBudget: number;
	includeHistoricalEvidence?: boolean;
	maxHistoricalItems?: number;
}

/**
 * Build Technical Expert context pack
 * Includes:
 * - Specific query/question
 * - Relevant domain context
 * - Prior evidence provided
 * - Related claims
 * - Historical evidence (prioritized)
 *
 * @param options Context options
 * @returns Result containing Technical Expert context pack
 */
export async function buildTechnicalExpertContext(
	options: TechnicalExpertContextOptions
): Promise<Result<CompiledContextPack>> {
	try {
		// Compile base context pack with reduced claim context
		const compileOptions: CompileContextOptions = {
			role: 'TECHNICAL_EXPERT' as Role,
			dialogueId: options.dialogueId,
			goal: options.question,
			tokenBudget: options.tokenBudget,
			includeHistorical: options.includeHistoricalEvidence ?? true,
			maxHistoricalFindings: options.maxHistoricalItems ?? 10,
		};

		const contextResult = compileContextPack(compileOptions);

		if (!contextResult.success) {
			return contextResult;
		}

		let context = contextResult.value;

		// Filter claims to only related ones
		if (options.relatedClaimIds && options.relatedClaimIds.length > 0) {
			context.active_claims = context.active_claims.filter((c) =>
				options.relatedClaimIds!.includes(c.claim_id)
			);

			// Also filter verdicts for these claims
			context.verdicts = context.verdicts.filter((v) =>
				options.relatedClaimIds!.includes(v.claim_id)
			);
		}

		// Retrieve additional historical evidence
		if (options.includeHistoricalEvidence) {
			const historicalResult = await retrieveHistoricalContext(
				options.question,
				options.relatedClaimIds || [],
				options.dialogueId,
				{
					limit: options.maxHistoricalItems,
					tokenBudget: Math.floor(options.tokenBudget * 0.3), // 30% for historical
					currentDialogueOnly: false, // Search across all dialogues
				}
			);

			if (historicalResult.success) {
				// Add historical evidence to context
				const historicalEvidence = historicalResult.value.verdicts.map(
					(v) => `Evidence from ${v.dialogueId}: ${v.item.rationale}`
				);
				context.historical_findings = [
					...context.historical_findings,
					...historicalEvidence,
				];
			}
		}

		// Check if truncation is needed
		if (context.tokenUsage.total > options.tokenBudget) {
			// Allocate budget using Technical Expert-specific strategy
			const budgetResult = allocateBudget(
				options.tokenBudget,
				'TECHNICAL_EXPERT' as Role,
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
					strategy: TruncationStrategy.RELEVANCE_BASED,
					preserveCritical: false, // Technical Expert focuses on evidence, not criticality
					preserveDecisions: false, // Can truncate decisions for Technical Expert
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

		// Enhance with Technical Expert-specific organization
		const enhanced = enhanceTechnicalExpertContext(context);

		return { success: true, value: enhanced };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to build Technical Expert context'),
		};
	}
}

/**
 * Enhance context pack with Technical Expert-specific organization
 * Prioritizes evidence and domain knowledge over governance
 */
function enhanceTechnicalExpertContext(
	context: CompiledContextPack
): CompiledContextPack {
	// Sort verdicts by evidence quality (those with evidence refs first)
	const sortedVerdicts = [...context.verdicts].sort((a, b) => {
		if (a.evidence_ref && !b.evidence_ref) {return -1;}
		if (!a.evidence_ref && b.evidence_ref) {return 1;}
		return 0;
	});

	// Prioritize historical findings with evidence keywords
	const evidenceKeywords = [
		'API',
		'documentation',
		'spec',
		'standard',
		'RFC',
		'example',
		'reference',
	];

	const sortedHistorical = [...context.historical_findings].sort((a, b) => {
		const aHasKeyword = evidenceKeywords.some((kw) =>
			a.toLowerCase().includes(kw.toLowerCase())
		);
		const bHasKeyword = evidenceKeywords.some((kw) =>
			b.toLowerCase().includes(kw.toLowerCase())
		);

		if (aHasKeyword && !bHasKeyword) {return -1;}
		if (!aHasKeyword && bHasKeyword) {return 1;}
		return 0;
	});

	return {
		...context,
		verdicts: sortedVerdicts,
		historical_findings: sortedHistorical,
	};
}

/**
 * Format Technical Expert context pack for LLM consumption
 * @param context Context pack
 * @returns Formatted context string
 */
export function formatTechnicalExpertContext(
	context: CompiledContextPack
): string {
	const sections: string[] = [];

	// Question section (most important)
	if (context.goal) {
		sections.push(`# Technical Question\n\n${context.goal}`);
	}

	// Evidence section (prioritized)
	if (context.verdicts.length > 0) {
		let evidenceSection = '# Available Evidence\n\n';
		for (const verdict of context.verdicts) {
			evidenceSection += `## Claim: ${verdict.claim_id}\n\n`;
			evidenceSection += `**Rationale:** ${verdict.rationale}\n\n`;
			if (verdict.evidence_ref) {
				evidenceSection += `**Evidence Reference:** ${verdict.evidence_ref}\n\n`;
			}
			evidenceSection += '---\n\n';
		}
		sections.push(evidenceSection);
	}

	// Historical evidence section
	if (context.historical_findings.length > 0) {
		let historicalSection = '# Historical Evidence\n\n';
		for (const finding of context.historical_findings) {
			historicalSection += `- ${finding}\n`;
		}
		sections.push(historicalSection);
	}

	// Related claims section (for context)
	if (context.active_claims.length > 0) {
		let claimsSection = '# Related Claims\n\n';
		for (const claim of context.active_claims) {
			claimsSection += `- ${claim.statement}\n`;
			claimsSection += `  Status: ${claim.status}\n\n`;
		}
		sections.push(claimsSection);
	}

	// Artifact references section
	if (context.artifact_refs.length > 0) {
		let artifactsSection = '# Relevant Artifacts\n\n';
		for (const ref of context.artifact_refs) {
			artifactsSection += `- ${ref}\n`;
		}
		sections.push(artifactsSection);
	}

	// Constraint context (minimal for Technical Expert)
	if (context.constraint_manifest) {
		sections.push(
			`# Constraints\n\nManifest Version: ${context.constraint_manifest.version}`
		);
	}

	// Token usage footer
	sections.push(
		`---\n\nToken Budget: ${context.token_budget}\nToken Usage: ${context.tokenUsage.total} / ${context.token_budget} (${Math.round((context.tokenUsage.total / context.token_budget) * 100)}%)`
	);

	return sections.join('\n\n');
}

/**
 * Validate Technical Expert context pack
 * Ensures question is present and evidence is available
 * @param context Context pack
 * @returns Validation result
 */
export function validateTechnicalExpertContext(
	context: CompiledContextPack
): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Question is required
	if (!context.goal) {
		errors.push('Technical question is required for Technical Expert context');
	}

	// Warn if no evidence is available
	if (
		context.verdicts.length === 0 &&
		context.historical_findings.length === 0
	) {
		warnings.push(
			'No evidence or historical findings available - Technical Expert may struggle to provide authoritative answers'
		);
	}

	// Warn if evidence lacks references
	const verdictsWithoutEvidence = context.verdicts.filter(
		(v) => !v.evidence_ref
	);
	if (verdictsWithoutEvidence.length > 0) {
		warnings.push(
			`${verdictsWithoutEvidence.length} verdicts lack evidence references`
		);
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Technical Expert context validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'context:technicalExpert' }).warn('Technical Expert context warnings', { warnings });
	}

	return { success: true, value: undefined };
}
