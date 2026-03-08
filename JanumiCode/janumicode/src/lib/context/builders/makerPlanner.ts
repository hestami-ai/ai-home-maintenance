/**
 * MAKER Planner Context Builder
 *
 * Builds context for the task decomposer LLM call. Includes:
 * - Intent record + acceptance contract
 * - Workspace file structure
 * - Narrative memory (failure motifs + invariants)
 * - Constraint manifest
 */

import type { Result } from '../../types';
import type {
	IntentRecord,
	AcceptanceContract,
	HistoricalInvariantPacket,
} from '../../types/maker';
import type { CompiledContextPack } from '../compiler';
import { compileContextPack } from '../compiler';
import { getHistoricalInvariantPacketsForDialogue } from '../../database/makerStore';

export interface MakerPlannerContextOptions {
	dialogueId: string;
	intentRecord: IntentRecord;
	contract: AcceptanceContract;
	tokenBudget: number;
}

/**
 * Build context for the task decomposer.
 * Returns a formatted string suitable for the decomposer's user prompt.
 */
export async function buildMakerPlannerContext(
	options: MakerPlannerContextOptions
): Promise<Result<string>> {
	try {
		const sections: string[] = [];

		// Base context (constraints, claims, verdicts, historical)
		const baseContext = compileContextPack({
			role: 'EXECUTOR' as import('../../types').Role,
			dialogueId: options.dialogueId,
			goal: options.intentRecord.human_goal,
			tokenBudget: Math.floor(options.tokenBudget * 0.6),
			includeHistorical: true,
			maxHistoricalFindings: 10,
		});

		if (baseContext.success && baseContext.value.constraint_manifest) {
			sections.push(
				`# Constraint Manifest\nVersion: ${baseContext.value.constraint_manifest.version}\nReference: ${baseContext.value.constraint_manifest.constraints_ref}`
			);
		}

		// Narrative memory — failure motifs and invariants from prior dialogues
		const narrativeSection = buildNarrativeSection(options.dialogueId);
		if (narrativeSection) {
			sections.push(narrativeSection);
		}

		// Historical findings from base context
		if (baseContext.success && baseContext.value.historical_findings.length > 0) {
			sections.push(
				'# Historical Findings\n' +
				baseContext.value.historical_findings.map((f) => `- ${f}`).join('\n')
			);
		}

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to build planner context'),
		};
	}
}

/**
 * Build the narrative memory section from historical invariant packets.
 */
function buildNarrativeSection(dialogueId: string): string | null {
	const result = getHistoricalInvariantPacketsForDialogue(dialogueId);
	if (!result.success || result.value.length === 0) {
		return null;
	}

	const lines: string[] = ['# Narrative Memory (Prior Dialogue Lessons)'];

	for (const packet of result.value) {
		for (const inv of packet.relevant_invariants) {
			lines.push(`- [Invariant] ${inv}`);
		}
		for (const motif of packet.prior_failure_motifs) {
			lines.push(`- [Failure Motif] ${motif}`);
		}
		for (const pattern of packet.precedent_patterns) {
			lines.push(`- [Precedent] ${pattern}`);
		}
		for (const subplan of packet.reusable_subplans) {
			lines.push(`- [Reusable Subplan] ${subplan}`);
		}
	}

	return lines.length > 1 ? lines.join('\n') : null;
}
