/**
 * Verifier Context Builder
 * Implements Phase 5.2: Verifier role-specific context pack builder
 * Creates optimized context packs for Verifier role invocations
 */

import type { Result, Role, Claim } from '../../types';
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
import { retrieveHistoricalContext, searchForContradictions } from '../historical';

/**
 * Verifier context pack options
 */
export interface VerifierContextOptions {
	dialogueId: string;
	claimToVerify: Claim; // Specific claim to verify
	tokenBudget: number;
	includeHistoricalVerdicts?: boolean;
	maxHistoricalItems?: number;
	checkForContradictions?: boolean;
}

/**
 * Build Verifier context pack
 * Includes:
 * - Claim to verify
 * - Constraint manifest (critical)
 * - Available evidence
 * - Verification criteria
 * - Prior verdicts on similar claims
 * - Historical contradictions
 *
 * @param options Context options
 * @returns Result containing Verifier context pack
 */
export async function buildVerifierContext(
	options: VerifierContextOptions
): Promise<Result<CompiledContextPack>> {
	try {
		// Compile base context pack
		const compileOptions: CompileContextOptions = {
			role: 'VERIFIER' as Role,
			dialogueId: options.dialogueId,
			goal: `Verify claim: ${options.claimToVerify.statement}`,
			tokenBudget: options.tokenBudget,
			includeHistorical: options.includeHistoricalVerdicts ?? true,
			maxHistoricalFindings: options.maxHistoricalItems ?? 5,
		};

		const contextResult = compileContextPack(compileOptions);

		if (!contextResult.success) {
			return contextResult;
		}

		let context = contextResult.value;

		// Filter to focus on the claim being verified
		context.active_claims = context.active_claims.filter(
			(c) =>
				c.claim_id === options.claimToVerify.claim_id ||
				options.claimToVerify.statement.includes(c.statement)
		);

		// Add claim to verify if not present
		if (
			!context.active_claims.some(
				(c) => c.claim_id === options.claimToVerify.claim_id
			)
		) {
			context.active_claims = [options.claimToVerify, ...context.active_claims];
		}

		// Filter verdicts to related claims only
		const relatedClaimIds = context.active_claims.map((c) => c.claim_id);
		context.verdicts = context.verdicts.filter((v) =>
			relatedClaimIds.includes(v.claim_id)
		);

		// Search for contradictions if requested
		if (options.checkForContradictions) {
			const contradictionsResult = await searchForContradictions(
				options.claimToVerify,
				{
					limit: 5,
					tokenBudget: Math.floor(options.tokenBudget * 0.1), // 10% for contradictions
				}
			);

			if (contradictionsResult.success && contradictionsResult.value.length > 0) {
				const contradictionNotes = contradictionsResult.value.map(
					(c) =>
						`Potential contradiction: "${c.item.statement}" (${c.item.status}) - Similarity: ${Math.round(c.relevanceScore * 100)}%`
				);
				context.historical_findings = [
					...contradictionNotes,
					...context.historical_findings,
				];
			}
		}

		// Retrieve historical verdicts on similar claims
		if (options.includeHistoricalVerdicts) {
			const historicalResult = await retrieveHistoricalContext(
				options.claimToVerify.statement,
				[options.claimToVerify.claim_id],
				options.dialogueId,
				{
					limit: options.maxHistoricalItems,
					tokenBudget: Math.floor(options.tokenBudget * 0.15), // 15% for historical
					currentDialogueOnly: false,
				}
			);

			if (historicalResult.success) {
				const historicalVerdicts = historicalResult.value.verdicts.map(
					(v) => `Historical verdict: ${v.item.verdict} - ${v.item.rationale}`
				);
				context.historical_findings = [
					...context.historical_findings,
					...historicalVerdicts,
				];
			}
		}

		// Check if truncation is needed
		if (context.tokenUsage.total > options.tokenBudget) {
			// Allocate budget using Verifier-specific strategy
			const budgetResult = allocateBudget(
				options.tokenBudget,
				'VERIFIER' as Role,
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
					strategy: TruncationStrategy.PRIORITY_BASED,
					preserveCritical: true, // Preserve critical claims
					preserveDecisions: false, // Can truncate decisions for Verifier
					allowPartialContent: false,
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

		// Enhance with Verifier-specific organization
		const enhanced = enhanceVerifierContext(context, options.claimToVerify);

		return { success: true, value: enhanced };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to build Verifier context'),
		};
	}
}

/**
 * Enhance context pack with Verifier-specific organization
 * Prioritizes constraint adherence and evidence quality
 */
function enhanceVerifierContext(
	context: CompiledContextPack,
	claimToVerify: Claim
): CompiledContextPack {
	// Ensure claim to verify is first
	const sortedClaims = [
		claimToVerify,
		...context.active_claims.filter((c) => c.claim_id !== claimToVerify.claim_id),
	];

	// Sort verdicts by evidence quality and relevance
	const sortedVerdicts = [...context.verdicts].sort((a, b) => {
		// Verdicts for the claim being verified come first
		if (a.claim_id === claimToVerify.claim_id && b.claim_id !== claimToVerify.claim_id)
			{return -1;}
		if (a.claim_id !== claimToVerify.claim_id && b.claim_id === claimToVerify.claim_id)
			{return 1;}

		// Then by evidence availability
		if (a.evidence_ref && !b.evidence_ref) {return -1;}
		if (!a.evidence_ref && b.evidence_ref) {return 1;}

		return 0;
	});

	return {
		...context,
		active_claims: sortedClaims,
		verdicts: sortedVerdicts,
	};
}

/**
 * Format Verifier context pack for LLM consumption
 * @param context Context pack
 * @returns Formatted context string
 */
export function formatVerifierContext(context: CompiledContextPack): string {
	const sections: string[] = [];

	// Claim to verify section (most important)
	if (context.active_claims.length > 0) {
		const primaryClaim = context.active_claims[0];
		sections.push(
			`# Claim to Verify\n\n**Statement:** ${primaryClaim.statement}\n\n**Introduced by:** ${primaryClaim.introduced_by}\n\n**Criticality:** ${primaryClaim.criticality}\n\n**Current Status:** ${primaryClaim.status}\n\n**Claim ID:** ${primaryClaim.claim_id}`
		);
	}

	// Constraint manifest section (critical for Verifier)
	if (context.constraint_manifest) {
		sections.push(
			`# Constraint Manifest\n\nVersion: ${context.constraint_manifest.version}\n\nReference: ${context.constraint_manifest.constraints_ref}\n\n**Note:** All verification must be conducted within these constraints.`
		);
	}

	// Available evidence section
	if (context.verdicts.length > 0) {
		let evidenceSection = '# Available Evidence\n\n';
		for (const verdict of context.verdicts) {
			evidenceSection += `## Claim: ${verdict.claim_id}\n\n`;
			evidenceSection += `**Previous Verdict:** ${verdict.verdict}\n\n`;
			evidenceSection += `**Rationale:** ${verdict.rationale}\n\n`;
			if (verdict.evidence_ref) {
				evidenceSection += `**Evidence Reference:** ${verdict.evidence_ref}\n\n`;
			}
			if (verdict.constraints_ref) {
				evidenceSection += `**Constraints Reference:** ${verdict.constraints_ref}\n\n`;
			}
			evidenceSection += '---\n\n';
		}
		sections.push(evidenceSection);
	}

	// Historical context section (contradictions and prior verdicts)
	if (context.historical_findings.length > 0) {
		let historicalSection = '# Historical Context\n\n';
		for (const finding of context.historical_findings) {
			historicalSection += `- ${finding}\n`;
		}
		sections.push(historicalSection);
	}

	// Related claims section
	if (context.active_claims.length > 1) {
		let relatedSection = '# Related Claims\n\n';
		for (let i = 1; i < context.active_claims.length; i++) {
			const claim = context.active_claims[i];
			relatedSection += `- [${claim.status}] ${claim.statement}\n`;
		}
		sections.push(relatedSection);
	}

	// Human decisions section (may override verification)
	if (context.human_decisions.length > 0) {
		let decisionsSection = '# Relevant Human Decisions\n\n';
		for (const decision of context.human_decisions) {
			decisionsSection += `- ${decision.action}: ${decision.rationale}\n`;
		}
		sections.push(decisionsSection);
	}

	// Artifact references section
	if (context.artifact_refs.length > 0) {
		let artifactsSection = '# Evidence Artifacts\n\n';
		for (const ref of context.artifact_refs) {
			artifactsSection += `- ${ref}\n`;
		}
		sections.push(artifactsSection);
	}

	// Verification criteria section
	sections.push(
		`# Verification Criteria\n\n1. Claims must be verified against authoritative evidence\n2. Use disconfirming queries to test assumptions\n3. Default to UNKNOWN when evidence is insufficient\n4. Emit DISPROVED for falsified claims\n5. Emit CONDITIONAL when claims hold under specific conditions\n6. Emit VERIFIED only when evidence strongly supports the claim`
	);

	// Token usage footer
	sections.push(
		`---\n\nToken Budget: ${context.token_budget}\nToken Usage: ${context.tokenUsage.total} / ${context.token_budget} (${Math.round((context.tokenUsage.total / context.token_budget) * 100)}%)`
	);

	return sections.join('\n\n');
}

/**
 * Validate Verifier context pack
 * Ensures claim and constraints are present
 * @param context Context pack
 * @returns Validation result
 */
export function validateVerifierContext(
	context: CompiledContextPack
): Result<void> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Claim to verify is required
	if (context.active_claims.length === 0) {
		errors.push('Claim to verify is required for Verifier context');
	}

	// Constraint manifest should be present
	if (!context.constraint_manifest) {
		warnings.push(
			'No constraint manifest available - verification may lack constraint context'
		);
	}

	// Warn if no evidence is available
	if (context.verdicts.length === 0 && context.artifact_refs.length === 0) {
		warnings.push(
			'No evidence or artifacts available - Verifier may default to UNKNOWN'
		);
	}

	// Warn if claim has no prior verdicts
	const claimId = context.active_claims[0]?.claim_id;
	if (claimId) {
		const hasVerdict = context.verdicts.some((v) => v.claim_id === claimId);
		if (!hasVerdict) {
			warnings.push('Claim has no prior verdicts');
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Verifier context validation failed:\n${errors.join('\n')}\n\nWarnings:\n${warnings.join('\n')}`
			),
		};
	}

	if (warnings.length > 0 && isLoggerInitialized()) {
		getLogger().child({ component: 'context:verifier' }).warn('Verifier context warnings', { warnings });
	}

	return { success: true, value: undefined };
}
