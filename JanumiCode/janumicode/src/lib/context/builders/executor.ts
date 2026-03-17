/**
 * Executor Context Builder
 * Implements Phase 5.2: Executor role-specific context pack builder
 * Creates optimized context packs for Executor role invocations
 */

import type { Result, Role, Claim, ClaimCriticality } from '../../types';
import type { ArchitectureDocument } from '../../types/architecture';
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
import { getApprovedArchitectureDocument } from '../../database/architectureStore';

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
	/** Pre-loaded architecture document (skips DB lookup if provided) */
	architectureDoc?: ArchitectureDocument;
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

		// Inject architecture document if available
		const archDoc = options.architectureDoc ?? loadApprovedArchitecture(options.dialogueId);
		if (archDoc) {
			const archBudget = Math.floor(options.tokenBudget * 0.15);
			enhanced.architectureContext = formatArchitectureForExecutor(archDoc, archBudget);
			const archTokens = Math.ceil(enhanced.architectureContext.length / 4);
			enhanced.tokenUsage.total += archTokens;
		}

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

	if (context.goal) {
		sections.push(`# Goal\n\n${context.goal}`);
	}

	if (context.constraint_manifest) {
		sections.push(
			`# Constraint Manifest\n\nVersion: ${context.constraint_manifest.version}\nReference: ${context.constraint_manifest.constraints_ref}`
		);
	}

	formatClaimsSection(context, sections);
	formatVerdictsSection(context, sections);
	formatDecisionsSection(context, sections);
	formatHistoricalAndNarrativeSection(context, sections);
	formatArtifactRefsSection(context, sections);

	if (context.architectureContext) {
		sections.push(context.architectureContext);
	}

	if (context.workspaceContext) {
		sections.push(`# Workspace Specifications\n\n${context.workspaceContext}`);
	}

	sections.push(
		`---\n\nToken Budget: ${context.token_budget}\nToken Usage: ${context.tokenUsage.total} / ${context.token_budget} (${Math.round((context.tokenUsage.total / context.token_budget) * 100)}%)`
	);

	return sections.join('\n\n');
}

function formatClaimsSection(context: CompiledContextPack, sections: string[]): void {
	if (context.active_claims.length === 0) { return; }

	const critical = context.active_claims.filter((c) => c.criticality === 'CRITICAL');
	const nonCritical = context.active_claims.filter((c) => c.criticality === 'NON_CRITICAL');

	let text = '# Active Claims\n\n';

	if (critical.length > 0) {
		text += '## Critical Claims\n\n';
		for (const claim of critical) {
			text += `- [${claim.status}] ${claim.statement}\n`;
			text += `  Introduced by: ${claim.introduced_by}\n`;
			text += `  ID: ${claim.claim_id}\n\n`;
		}
	}

	if (nonCritical.length > 0) {
		text += '## Non-Critical Claims\n\n';
		for (const claim of nonCritical) {
			text += `- [${claim.status}] ${claim.statement}\n`;
		}
	}

	sections.push(text);
}

function formatVerdictsSection(context: CompiledContextPack, sections: string[]): void {
	if (context.verdicts.length === 0) { return; }

	let text = '# Verifier Verdicts\n\n';
	for (const verdict of context.verdicts) {
		text += `## Claim: ${verdict.claim_id}\n\n`;
		text += `**Verdict:** ${verdict.verdict}\n\n`;
		text += `**Rationale:** ${verdict.rationale}\n\n`;
		if (verdict.evidence_ref) {
			text += `**Evidence:** ${verdict.evidence_ref}\n\n`;
		}
		text += '---\n\n';
	}
	sections.push(text);
}

function formatDecisionsSection(context: CompiledContextPack, sections: string[]): void {
	if (context.human_decisions.length === 0) { return; }

	let text = '# Human Decisions\n\n';
	for (const decision of context.human_decisions) {
		text += `## ${decision.action}\n\n`;
		text += `**Rationale:** ${decision.rationale}\n\n`;
		text += `**Gate:** ${decision.gate_id}\n\n`;
		text += '---\n\n';
	}
	sections.push(text);
}

const NARRATIVE_PREFIXES = ['[Invariant]', '[Failure Motif]', '[Precedent]', '[Prior Outcome]', '  →'];

function isNarrativeEntry(entry: string): boolean {
	return NARRATIVE_PREFIXES.some((p) => entry.startsWith(p));
}

function formatHistoricalAndNarrativeSection(context: CompiledContextPack, sections: string[]): void {
	if (context.historical_findings.length === 0) { return; }

	const narrativeEntries = context.historical_findings.filter(isNarrativeEntry);
	const generalFindings = context.historical_findings.filter((f) => !isNarrativeEntry(f));

	if (narrativeEntries.length > 0) {
		const lines = narrativeEntries.map((e) => `- ${e}`).join('\n');
		sections.push(`# Narrative Memory\n\nLessons, failure motifs, and invariants from prior dialogues:\n\n${lines}`);
	}

	if (generalFindings.length > 0) {
		const lines = generalFindings.map((f) => `- ${f}`).join('\n');
		sections.push(`# Historical Findings\n\n${lines}`);
	}
}

function formatArtifactRefsSection(context: CompiledContextPack, sections: string[]): void {
	if (context.artifact_refs.length === 0) { return; }
	const lines = context.artifact_refs.map((ref) => `- ${ref}`).join('\n');
	sections.push(`# Artifact References\n\n${lines}`);
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

// ==================== ARCHITECTURE CONTEXT ====================

function loadApprovedArchitecture(dialogueId: string): ArchitectureDocument | null {
	try {
		const result = getApprovedArchitectureDocument(dialogueId);
		if (result.success && result.value) {
			return result.value;
		}
	} catch { /* DB not ready or no architecture phase ran */ }
	return null;
}

function formatArchitectureForExecutor(doc: ArchitectureDocument, tokenBudget: number): string {
	const sections: string[] = [];
	sections.push(`# Approved Architecture Document v${doc.version}`);

	// Capabilities
	if (doc.capabilities.length > 0) {
		sections.push('## Capabilities');
		for (const cap of doc.capabilities) {
			const reqs = cap.source_requirements.length > 0 ? ` — Reqs: [${cap.source_requirements.join(', ')}]` : '';
			sections.push(`- **${cap.capability_id}**: ${cap.label}${reqs}`);
			if (cap.workflows.length > 0) {
				sections.push(`  Workflows: ${cap.workflows.join(', ')}`);
			}
		}
	}

	// Components (enriched with rationale, interaction patterns)
	if (doc.components.length > 0) {
		sections.push('## Components');
		for (const comp of doc.components) {
			sections.push(`### ${comp.component_id}: ${comp.label}`);
			sections.push(comp.responsibility);
			if (comp.rationale) {
				sections.push(`**Rationale:** ${comp.rationale}`);
			}
			if (comp.workflows_served.length > 0) {
				sections.push(`**Implements:** ${comp.workflows_served.join(', ')}`);
			}
			if (comp.dependencies.length > 0) {
				sections.push(`**Dependencies:** ${comp.dependencies.join(', ')}`);
			}
			if (comp.interaction_patterns && comp.interaction_patterns.length > 0) {
				sections.push(`**Interactions:** ${comp.interaction_patterns.join('; ')}`);
			}
			if (comp.technology_notes) {
				sections.push(`**Technology:** ${comp.technology_notes}`);
			}
			if (comp.file_scope) {
				sections.push(`**File scope:** ${comp.file_scope}`);
			}
		}
	}

	// Domain Model (enriched with full field detail, relationships, invariants)
	if (doc.data_models.length > 0) {
		sections.push('## Domain Model');
		for (const model of doc.data_models) {
			sections.push(`### ${model.model_id}: ${model.entity_name}`);
			if (model.description) {
				sections.push(model.description);
			}
			if (model.fields.length > 0) {
				sections.push('**Fields:**');
				for (const f of model.fields) {
					sections.push(`  - ${f.name}: ${f.type}${f.required ? ' (required)' : ''} — ${f.description}`);
				}
			}
			if (model.relationships.length > 0) {
				sections.push('**Relationships:**');
				for (const r of model.relationships) {
					sections.push(`  - → ${r.target_model} (${r.type}) — ${r.description}`);
				}
			}
			if (model.invariants && model.invariants.length > 0) {
				sections.push(`**Invariants:** ${model.invariants.join('; ')}`);
			}
		}
	}

	// Interface Contracts (enriched with full contracts)
	if (doc.interfaces.length > 0) {
		sections.push('## Interface Contracts');
		for (const iface of doc.interfaces) {
			sections.push(`### ${iface.interface_id} [${iface.type}]: ${iface.label}`);
			if (iface.description) {
				sections.push(iface.description);
			}
			if (iface.contract) {
				sections.push(`**Contract:**\n\`\`\`\n${iface.contract}\n\`\`\``);
			}
			sections.push(`**Provider:** ${iface.provider_component}`);
			sections.push(`**Consumers:** ${iface.consumer_components.join(', ')}`);
			if (iface.source_workflows.length > 0) {
				sections.push(`**Workflows:** ${iface.source_workflows.join(', ')}`);
			}
		}
	}

	// Implementation Roadmap
	if (doc.implementation_sequence.length > 0) {
		sections.push('## Implementation Roadmap');
		for (let i = 0; i < doc.implementation_sequence.length; i++) {
			const step = doc.implementation_sequence[i];
			const deps = step.dependencies.length > 0 ? ` — Depends on: ${step.dependencies.join(', ')}` : '';
			sections.push(`${i + 1}. **${step.label}** [${step.estimated_complexity}]: ${step.description}${deps}`);
			sections.push(`   Components: ${step.components_involved.join(', ')} | Verify: ${step.verification_method}`);
		}
	}

	let result = sections.join('\n\n');

	// Truncate to token budget (rough: 4 chars per token)
	const maxChars = tokenBudget * 4;
	if (result.length > maxChars) {
		result = result.slice(0, maxChars - 20) + '\n\n[...truncated]';
	}

	return result;
}
