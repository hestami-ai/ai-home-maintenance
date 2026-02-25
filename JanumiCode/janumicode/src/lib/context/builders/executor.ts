/**
 * Executor Context Builder
 * Implements Phase 5.2: Executor role-specific context pack builder
 * Creates optimized context packs for Executor role invocations
 */

import type { Result, Role, Claim, ClaimCriticality } from '../../types';
import {
	compileContextPack,
	type CompileContextOptions,
	type CompiledContextPack,
} from '../compiler';
import {
	allocateBudget,
	BudgetAllocationStrategy,
	ComponentPriority,
	createComponentItem,
} from '../budgetManager';
import { truncateContextPack, TruncationStrategy } from '../truncation';
import { retrieveHistoricalContext } from '../historical';
import {
	scanSpecFiles,
	formatWorkspaceFilesForContext,
	type WorkspaceFile,
} from '../workspaceReader';

/**
 * Executor context pack options
 */
export interface ExecutorContextOptions {
	dialogueId: string;
	goal: string;
	tokenBudget: number;
	includeHistoricalFindings?: boolean;
	maxHistoricalFindings?: number;
	truncationStrategy?: TruncationStrategy;
	/** Relative paths to spec folders to include in context */
	specFolderPaths?: string[];
	/** Maximum number of spec files to include */
	maxSpecFiles?: number;
	/** Pre-loaded workspace files (skips scanning if provided) */
	workspaceFiles?: WorkspaceFile[];
}

/**
 * Build Executor context pack
 * Includes:
 * - Goal/requirements
 * - Current constraint manifest
 * - Active claims (prioritize CRITICAL)
 * - Verifier verdict summary
 * - Human decisions
 * - Relevant historical findings
 * - Artifact pointers
 *
 * @param options Context options
 * @returns Result containing Executor context pack
 */
export async function buildExecutorContext(
	options: ExecutorContextOptions
): Promise<Result<CompiledContextPack>> {
	try {
		// Compile base context pack
		const compileOptions: CompileContextOptions = {
			role: 'EXECUTOR' as Role,
			dialogueId: options.dialogueId,
			goal: options.goal,
			tokenBudget: options.tokenBudget,
			includeHistorical: options.includeHistoricalFindings ?? true,
			maxHistoricalFindings: options.maxHistoricalFindings ?? 5,
		};

		const contextResult = compileContextPack(compileOptions);

		if (!contextResult.success) {
			return contextResult;
		}

		let context = contextResult.value;

		// Check if truncation is needed
		if (context.tokenUsage.total > options.tokenBudget) {
			// Allocate budget using Executor-specific strategy
			const budgetResult = allocateBudget(
				options.tokenBudget,
				'EXECUTOR' as Role,
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
					strategy: options.truncationStrategy ?? TruncationStrategy.PRIORITY_BASED,
					preserveCritical: true, // Always preserve critical claims for Executor
					preserveDecisions: true, // Always preserve human decisions
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

		// Enhance with Executor-specific organization
		const enhanced = enhanceExecutorContext(context);

		// Inject workspace files if spec folders are configured or files are provided
		if (options.workspaceFiles && options.workspaceFiles.length > 0) {
			const workspaceTokenBudget = Math.floor(options.tokenBudget * 0.2);
			enhanced.workspaceContext = formatWorkspaceFilesForContext(
				options.workspaceFiles,
				workspaceTokenBudget
			);
			enhanced.tokenUsage.workspace = Math.ceil(enhanced.workspaceContext.length / 4);
			enhanced.tokenUsage.total += enhanced.tokenUsage.workspace;
		} else if (options.specFolderPaths && options.specFolderPaths.length > 0) {
			const scanResult = await scanSpecFiles(
				options.specFolderPaths[0],
				options.maxSpecFiles ?? 30
			);
			if (scanResult.success && scanResult.value.files.length > 0) {
				const workspaceTokenBudget = Math.floor(options.tokenBudget * 0.2);
				enhanced.workspaceContext = formatWorkspaceFilesForContext(
					scanResult.value.files,
					workspaceTokenBudget
				);
				enhanced.tokenUsage.workspace = Math.ceil(enhanced.workspaceContext.length / 4);
				enhanced.tokenUsage.total += enhanced.tokenUsage.workspace;
			}
		}

		return { success: true, value: enhanced };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to build Executor context'),
		};
	}
}

/**
 * Enhance context pack with Executor-specific organization
 * Prioritizes critical claims and execution-relevant information
 */
function enhanceExecutorContext(
	context: CompiledContextPack
): CompiledContextPack {
	// Sort claims by criticality (CRITICAL first) and status
	const sortedClaims = [...context.active_claims].sort((a, b) => {
		// Critical claims first
		if (a.criticality !== b.criticality) {
			return a.criticality === 'CRITICAL' ? -1 : 1;
		}

		// Within same criticality, sort by status
		// DISPROVED > UNKNOWN > OPEN > CONDITIONAL > VERIFIED
		const statusOrder: Record<string, number> = {
			DISPROVED: 0,
			UNKNOWN: 1,
			OPEN: 2,
			CONDITIONAL: 3,
			VERIFIED: 4,
		};

		return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
	});

	return {
		...context,
		active_claims: sortedClaims,
	};
}

/**
 * Format Executor context pack for LLM consumption
 * @param context Context pack
 * @returns Formatted context string
 */
export function formatExecutorContext(context: CompiledContextPack): string {
	const sections: string[] = [];

	// Goal section
	if (context.goal) {
		sections.push(`# Goal\n\n${context.goal}`);
	}

	// Constraint manifest section
	if (context.constraint_manifest) {
		sections.push(
			`# Constraint Manifest\n\nVersion: ${context.constraint_manifest.version}\nReference: ${context.constraint_manifest.constraints_ref}`
		);
	}

	// Active claims section (grouped by criticality)
	if (context.active_claims.length > 0) {
		const criticalClaims = context.active_claims.filter(
			(c) => c.criticality === 'CRITICAL'
		);
		const nonCriticalClaims = context.active_claims.filter(
			(c) => c.criticality === 'NON_CRITICAL'
		);

		let claimsSection = '# Active Claims\n\n';

		if (criticalClaims.length > 0) {
			claimsSection += '## Critical Claims\n\n';
			for (const claim of criticalClaims) {
				claimsSection += `- [${claim.status}] ${claim.statement}\n`;
				claimsSection += `  Introduced by: ${claim.introduced_by}\n`;
				claimsSection += `  ID: ${claim.claim_id}\n\n`;
			}
		}

		if (nonCriticalClaims.length > 0) {
			claimsSection += '## Non-Critical Claims\n\n';
			for (const claim of nonCriticalClaims) {
				claimsSection += `- [${claim.status}] ${claim.statement}\n`;
			}
		}

		sections.push(claimsSection);
	}

	// Verdicts section
	if (context.verdicts.length > 0) {
		let verdictsSection = '# Verifier Verdicts\n\n';
		for (const verdict of context.verdicts) {
			verdictsSection += `## Claim: ${verdict.claim_id}\n\n`;
			verdictsSection += `**Verdict:** ${verdict.verdict}\n\n`;
			verdictsSection += `**Rationale:** ${verdict.rationale}\n\n`;
			if (verdict.evidence_ref) {
				verdictsSection += `**Evidence:** ${verdict.evidence_ref}\n\n`;
			}
			verdictsSection += '---\n\n';
		}
		sections.push(verdictsSection);
	}

	// Human decisions section
	if (context.human_decisions.length > 0) {
		let decisionsSection = '# Human Decisions\n\n';
		for (const decision of context.human_decisions) {
			decisionsSection += `## ${decision.action}\n\n`;
			decisionsSection += `**Rationale:** ${decision.rationale}\n\n`;
			decisionsSection += `**Gate:** ${decision.gate_id}\n\n`;
			decisionsSection += '---\n\n';
		}
		sections.push(decisionsSection);
	}

	// Historical findings section
	if (context.historical_findings.length > 0) {
		let historicalSection = '# Historical Findings\n\n';
		for (const finding of context.historical_findings) {
			historicalSection += `- ${finding}\n`;
		}
		sections.push(historicalSection);
	}

	// Artifact references section
	if (context.artifact_refs.length > 0) {
		let artifactsSection = '# Artifact References\n\n';
		for (const ref of context.artifact_refs) {
			artifactsSection += `- ${ref}\n`;
		}
		sections.push(artifactsSection);
	}

	// Workspace context section
	if (context.workspaceContext) {
		sections.push(`# Workspace Specifications\n\n${context.workspaceContext}`);
	}

	// Token usage footer
	sections.push(
		`---\n\nToken Budget: ${context.token_budget}\nToken Usage: ${context.tokenUsage.total} / ${context.token_budget} (${Math.round((context.tokenUsage.total / context.token_budget) * 100)}%)`
	);

	return sections.join('\n\n');
}

/**
 * Validate Executor context pack
 * Ensures all required components are present
 * @param context Context pack
 * @returns Validation result
 */
export function validateExecutorContext(
	context: CompiledContextPack
): Result<void> {
	const errors: string[] = [];

	// Goal is required
	if (!context.goal) {
		errors.push('Goal is required for Executor context');
	}

	// At least one active claim should be present
	if (context.active_claims.length === 0) {
		errors.push('At least one active claim is required for Executor context');
	}

	// Critical claims must have verdicts
	const criticalClaims = context.active_claims.filter(
		(c) => c.criticality === 'CRITICAL'
	);
	const criticalClaimIds = criticalClaims.map((c) => c.claim_id);
	const verdictClaimIds = context.verdicts.map((v) => v.claim_id);

	for (const claimId of criticalClaimIds) {
		if (!verdictClaimIds.includes(claimId)) {
			errors.push(
				`Critical claim ${claimId} does not have a corresponding verdict`
			);
		}
	}

	// Check for blocking conditions
	const blockingClaims = context.active_claims.filter(
		(c) =>
			c.criticality === 'CRITICAL' &&
			(c.status === 'DISPROVED' || c.status === 'UNKNOWN')
	);

	if (blockingClaims.length > 0) {
		errors.push(
			`Found ${blockingClaims.length} blocking critical claims (DISPROVED or UNKNOWN)`
		);
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(`Executor context validation failed:\n${errors.join('\n')}`),
		};
	}

	return { success: true, value: undefined };
}
