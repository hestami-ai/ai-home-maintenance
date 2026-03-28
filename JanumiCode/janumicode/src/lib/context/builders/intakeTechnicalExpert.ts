/**
 * INTAKE Technical Expert Context Builder
 * Builds context packs for the Technical Expert in INTAKE conversation mode.
 *
 * Unlike the standard Technical Expert context builder (which focuses on evidence),
 * this builder assembles conversation history + current draft plan for the
 * conversational planning phase.
 *
 * Context structure:
 * - Accumulation summaries (older turns condensed)
 * - Recent conversation turns (sliding window, raw)
 * - Current draft plan (full)
 * - Human's latest message
 */

import type { Result } from '../../types';
import type {
	IntakePlanDocument,
	IntakeConversationTurn,
	IntakeAccumulation,
} from '../../types/intake';
import { isAnalysisResponse } from '../../types/intake';
import {
	getRecentIntakeTurns,
	getIntakeTurns,
	getIntakeConversation,
} from '../../events/reader';

// ==================== CONSTANTS ====================

/** Number of most recent turns to keep in full (raw) in the context window */
export const INTAKE_CONTEXT_WINDOW_SIZE = 6;

/** Rough characters-per-token estimate (kept for estimatedTokens reporting, not for truncation) */
const CHARS_PER_TOKEN = 4;

// ==================== TYPES ====================

/**
 * Options for building INTAKE Technical Expert context
 */
export interface IntakeTechnicalExpertContextOptions {
	dialogueId: string;
	humanMessage: string;
	currentPlan: IntakePlanDocument;
	turnNumber: number;
	/** When true, include ALL turns (not just recent) for synthesis */
	synthesisMode?: boolean;
}

/**
 * The assembled context pack for an INTAKE conversation turn.
 * This is a simpler structure than CompiledContextPack since INTAKE
 * doesn't use claims/verdicts/evidence — it's focused on conversation.
 */
export interface IntakeContextPack {
	/** Dialogue ID (for file-based context writing) */
	dialogueId?: string;
	/** The Human's latest message */
	humanMessage: string;
	/** Current draft plan document */
	currentPlan: IntakePlanDocument;
	/** Accumulation summaries (condensed older turns) */
	accumulations: IntakeAccumulation[];
	/** Recent conversation turns in the sliding window */
	recentTurns: IntakeConversationTurn[];
	/** Current turn number */
	turnNumber: number;
	/** Token usage estimate */
	estimatedTokens: number;
	/** Whether this is a synthesis (finalization) context */
	isSynthesis: boolean;
}

// ==================== BUILD ====================

/**
 * Build INTAKE Technical Expert context pack.
 *
 * Assembles conversation history using the sliding window + accumulation strategy:
 * - Last INTAKE_CONTEXT_WINDOW_SIZE turns are kept in full
 * - Older turns are represented by their accumulation summaries
 * - Current draft plan is included in full
 * - Human's latest message is placed prominently
 *
 * @param options Context options
 * @returns Result containing the assembled context pack
 */
export async function buildIntakeTechnicalExpertContext(
	options: IntakeTechnicalExpertContextOptions
): Promise<Result<IntakeContextPack>> {
	try {
		const {
			dialogueId,
			humanMessage,
			currentPlan,
			turnNumber,
			synthesisMode = false,
		} = options;

		// Get conversation state for accumulations
		const convResult = getIntakeConversation(dialogueId);
		const accumulations = convResult.success && convResult.value
			? convResult.value.accumulations
			: [];

		// Get conversation turns
		let recentTurns: IntakeConversationTurn[] = [];

		if (synthesisMode) {
			// Synthesis mode: include all turns for comprehensive context
			const allTurnsResult = getIntakeTurns(dialogueId);
			if (allTurnsResult.success) {
				recentTurns = allTurnsResult.value;
			}
		} else {
			// Normal mode: sliding window of recent turns
			const recentResult = getRecentIntakeTurns(
				dialogueId,
				INTAKE_CONTEXT_WINDOW_SIZE
			);
			if (recentResult.success) {
				recentTurns = recentResult.value;
			}
		}

		// Estimate token usage
		const estimatedTokens = estimateContextTokens(
			humanMessage,
			currentPlan,
			accumulations,
			recentTurns
		);

		const contextPack: IntakeContextPack = {
			dialogueId,
			humanMessage,
			currentPlan,
			accumulations,
			recentTurns,
			turnNumber,
			estimatedTokens,
			isSynthesis: synthesisMode,
		};

		// No truncation — pass full context. CLI providers manage their own context windows.
		return { success: true, value: contextPack };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to build INTAKE Technical Expert context'),
		};
	}
}

// ==================== FORMAT ====================

/**
 * Format INTAKE context pack into a string for LLM consumption.
 *
 * Section order (optimized for INTAKE mode):
 * 1. Current Draft Plan (always present, gives the Expert continuity)
 * 2. Conversation History (accumulations then recent turns)
 * 3. Human's Latest Message (most prominent, at the end)
 *
 * @param context The assembled context pack
 * @returns Formatted context string
 */
export function formatIntakeTechnicalExpertContext(
	context: IntakeContextPack
): string {
	const sections: string[] = [];

	// Section 1: Current Draft Plan
	sections.push(formatPlanSection(context.currentPlan));

	// Section 2: Conversation History
	if (context.accumulations.length > 0 || context.recentTurns.length > 0) {
		sections.push(
			formatConversationHistory(context.accumulations, context.recentTurns)
		);
	}

	// Section 3: Human's Latest Message (most important — at the end)
	if (context.isSynthesis) {
		sections.push(
			`# Synthesis Request\n\nPlease synthesize the entire conversation above into a final, comprehensive implementation plan. Consolidate all requirements, decisions, and constraints. Resolve any open questions that were answered during the conversation. The resulting plan should be self-contained and actionable.`
		);
	} else {
		sections.push(
			`# Human's Message (Turn ${context.turnNumber})\n\n${context.humanMessage}`
		);
	}

	// Token usage footer
	sections.push(
		`---\n\nEstimated context tokens: ~${context.estimatedTokens}`
	);

	const inlineContent = sections.join('\n\n---\n\n');

	// If context is very large, write to files for CLI agent to read piecemeal
	const totalChars = inlineContent.length;
	if (totalChars > 100_000 && context.dialogueId) {
		try {
			const { writeContextToFiles, buildFileBasedPrompt } = require('../contextFileWriter');
			const contextSections = [
				{ name: 'plan.md', content: formatPlanSection(context.currentPlan) },
				...(context.accumulations.length > 0 || context.recentTurns.length > 0
					? [{ name: 'conversation-history.md', content: formatConversationHistory(context.accumulations, context.recentTurns) }]
					: []),
				{ name: 'request.md', content: context.isSynthesis
					? 'Please synthesize the entire conversation above into a final, comprehensive implementation plan.'
					: `# Human's Message (Turn ${context.turnNumber})\n\n${context.humanMessage}` },
			];
			const filePaths = writeContextToFiles(context.dialogueId, contextSections);
			if (filePaths) {
				return buildFileBasedPrompt(filePaths);
			}
		} catch {
			// File writing failed — fall back to inline
		}
	}

	return inlineContent;
}

// ==================== INTERNAL HELPERS ====================

/**
 * Format the current draft plan as a context section
 */
function formatPlanSection(plan: IntakePlanDocument): string {
	const parts: string[] = ['# Current Draft Plan (v' + plan.version + ')'];

	if (plan.requestCategory) {
		parts.push(`**Request Category:** ${plan.requestCategory}`);
	}
	if (plan.title) {
		parts.push(`**Title:** ${plan.title}`);
	}
	if (plan.summary) {
		parts.push(`**Summary:** ${plan.summary}`);
	}

	const requirements = plan.requirements ?? [];
	const decisions = plan.decisions ?? [];
	const constraints = plan.constraints ?? [];
	const openQuestions = plan.openQuestions ?? [];
	const technicalNotes = plan.technicalNotes ?? [];

	if (requirements.length > 0) {
		parts.push('## Requirements');
		for (const item of requirements) {
			parts.push(`- [${item.id}] ${item.text}`);
		}
	}

	if (decisions.length > 0) {
		parts.push('## Decisions');
		for (const item of decisions) {
			parts.push(`- [${item.id}] ${item.text}`);
		}
	}

	if (constraints.length > 0) {
		parts.push('## Constraints');
		for (const item of constraints) {
			parts.push(`- [${item.id}] ${item.text}`);
		}
	}

	if (openQuestions.length > 0) {
		parts.push('## Open Questions');
		for (const item of openQuestions) {
			parts.push(`- [${item.id}] ${item.text}`);
		}
	}

	if (technicalNotes.length > 0) {
		parts.push('## Technical Notes');
		for (const note of technicalNotes) {
			parts.push(`- ${note}`);
		}
	}

	if (plan.proposedApproach) {
		parts.push(`## Proposed Approach\n\n${plan.proposedApproach}`);
	}

	// Build ID→name lookup maps for human-readable cross-references
	const personaNameById = new Map((plan.personas ?? []).map(p => [p.id, p.name]));
	const journeyTitleById = new Map((plan.userJourneys ?? []).map(j => [j.id, j.title]));
	const domainNameById = new Map((plan.businessDomainProposals ?? []).map(d => [d.id, d.name]));

	// Product artifacts
	if (plan.productVision) {
		parts.push(`## Product Vision\n\n${plan.productVision}`);
	}
	if (plan.productDescription) {
		parts.push(`## Product Description\n\n${plan.productDescription}`);
	}
	if (plan.personas && plan.personas.length > 0) {
		parts.push('## Personas');
		for (const p of plan.personas) {
			parts.push(`- [${p.id}] **${p.name}**: ${p.description}`);
			if ((p.goals ?? []).length > 0) {parts.push(`  Goals: ${p.goals.join('; ')}`);}
			if ((p.painPoints ?? []).length > 0) {parts.push(`  Pain points: ${p.painPoints.join('; ')}`);}
		}
	}
	if (plan.userJourneys && plan.userJourneys.length > 0) {
		parts.push('## User Journeys');
		for (const j of plan.userJourneys) {
			parts.push(`- [${j.id}] **${j.title}** (persona: ${personaNameById.get(j.personaId) ?? j.personaId}, ${j.priority}): ${j.scenario}`);
			const steps = (j.steps ?? []).filter(s => s.actor || s.action);
			if (steps.length > 0) {
				for (const s of steps) {
					parts.push(`  ${s.stepNumber ?? 0}. ${s.actor || ''} → ${s.action || ''} → ${s.expectedOutcome || ''}`);
				}
			}
			if ((j.acceptanceCriteria ?? []).length > 0) {
				parts.push(`  Acceptance: ${j.acceptanceCriteria.join('; ')}`);
			}
		}
	}
	if (plan.phasingStrategy && plan.phasingStrategy.length > 0) {
		parts.push('## Phasing Strategy');
		for (const ph of plan.phasingStrategy) {
			const journeyList = (ph.journeyIds ?? []).length > 0
				? ` (journeys: ${ph.journeyIds.map(id => journeyTitleById.get(id) ?? id).join(', ')})`
				: '';
			parts.push(`- **${ph.phase ?? ''}**: ${ph.description ?? ''}${journeyList} — ${ph.rationale ?? ''}`);
		}
	}
	if (plan.successMetrics && plan.successMetrics.length > 0) {
		parts.push('## Success Metrics');
		for (const m of plan.successMetrics) {
			parts.push(`- ${m}`);
		}
	}
	if (plan.uxRequirements && plan.uxRequirements.length > 0) {
		parts.push('## UX Requirements');
		for (const ux of plan.uxRequirements) {
			parts.push(`- ${ux}`);
		}
	}

	// Proposer artifacts — these contain the detailed output from each proposer round
	if (plan.businessDomainProposals && plan.businessDomainProposals.length > 0) {
		parts.push('## Proposed Domains (from Proposer Round 1)');
		for (const d of plan.businessDomainProposals) {
			parts.push(`- [${d.id}] **${d.name}**: ${d.description}`);
			if (d.rationale) { parts.push(`  Rationale: ${d.rationale}`); }
			if (d.entityPreview?.length) { parts.push(`  Entity preview: ${d.entityPreview.join(', ')}`); }
			if (d.workflowPreview?.length) { parts.push(`  Workflow preview: ${d.workflowPreview.join(', ')}`); }
		}
	}
	if (plan.workflowProposals && plan.workflowProposals.length > 0) {
		parts.push('## Proposed Workflows (from Proposer Round 2)');
		for (const w of plan.workflowProposals) {
			parts.push(`- [${w.id}] **${w.name}** (domain: ${domainNameById.get(w.businessDomainId) ?? w.businessDomainId}): ${w.description}`);
		}
	}
	if (plan.entityProposals && plan.entityProposals.length > 0) {
		parts.push('## Proposed Entities (from Proposer Round 3)');
		for (const e of plan.entityProposals) {
			parts.push(`- [${e.id}] **${e.name}** (domain: ${domainNameById.get(e.businessDomainId) ?? e.businessDomainId}): ${e.description}`);
			if (e.keyAttributes?.length) { parts.push(`  Key attributes: ${e.keyAttributes.join(', ')}`); }
			if (e.relationships?.length) { parts.push(`  Relationships: ${e.relationships.join(', ')}`); }
		}
	}
	if (plan.integrationProposals && plan.integrationProposals.length > 0) {
		parts.push('## Proposed Integrations (from Proposer Round 4)');
		for (const int of plan.integrationProposals) {
			parts.push(`- [${int.id}] **${int.name}** (${int.category}): ${int.description}`);
			if (int.standardProviders?.length) { parts.push(`  Standard providers: ${int.standardProviders.join(', ')}`); }
			if (int.ownershipModel) { parts.push(`  Ownership: ${int.ownershipModel}`); }
		}
	}
	if (plan.qualityAttributes && plan.qualityAttributes.length > 0) {
		parts.push('## Quality Attributes (from Proposer Round 4)');
		for (const qa of plan.qualityAttributes) {
			parts.push(`- ${qa}`);
		}
	}

	return parts.join('\n\n');
}

/**
 * Format conversation history with accumulations and recent turns
 */
function formatConversationHistory(
	accumulations: IntakeAccumulation[],
	recentTurns: IntakeConversationTurn[]
): string {
	const parts: string[] = ['# Conversation History'];

	// Accumulation summaries (older turns, condensed)
	if (accumulations.length > 0) {
		parts.push('## Earlier Discussion (Summarized)');
		for (const acc of accumulations) {
			parts.push(
				`**Turns ${acc.summarizedTurnRange[0]}–${acc.summarizedTurnRange[1]}:**\n${acc.summary}`
			);
		}
	}

	// Recent turns (full detail)
	if (recentTurns.length > 0) {
		parts.push('## Recent Turns');
		for (const turn of recentTurns) {
			// Analysis turns use analysisSummary instead of conversationalResponse
			const expertText = isAnalysisResponse(turn.expertResponse)
				? turn.expertResponse.analysisSummary
				: turn.expertResponse.conversationalResponse;
			parts.push(
				`### Turn ${turn.turnNumber}\n\n` +
				`**Human:** ${turn.humanMessage}\n\n` +
				`**Expert:** ${expertText}`
			);
		}
	}

	return parts.join('\n\n');
}

/**
 * Estimate token count for the assembled context
 */
function estimateContextTokens(
	humanMessage: string,
	plan: IntakePlanDocument,
	accumulations: IntakeAccumulation[],
	recentTurns: IntakeConversationTurn[]
): number {
	let charCount = 0;

	// Human message
	charCount += humanMessage.length;

	// Plan (serialized)
	charCount += JSON.stringify(plan).length;

	// Accumulations
	for (const acc of accumulations) {
		charCount += acc.summary.length;
		charCount += JSON.stringify(acc.extractedItems).length;
	}

	// Recent turns
	for (const turn of recentTurns) {
		charCount += turn.humanMessage.length;
		// Analysis turns use analysisSummary instead of conversationalResponse
		const expertText = isAnalysisResponse(turn.expertResponse)
			? turn.expertResponse.analysisSummary
			: turn.expertResponse.conversationalResponse;
		charCount += (expertText ?? '').length;
	}

	// Formatting overhead (~20%)
	charCount = Math.ceil(charCount * 1.2);

	return Math.ceil(charCount / CHARS_PER_TOKEN);
}

// Token budget truncation removed — CLI providers manage their own context windows.
// Full context is always passed through. For very large contexts, the file-based
// context system in contextFileWriter.ts handles overflow.
