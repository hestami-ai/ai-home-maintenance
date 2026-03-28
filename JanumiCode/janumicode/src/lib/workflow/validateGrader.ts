/**
 * Validate Phase — GRADING sub-state
 *
 * Single LLM pass over validated hypotheses that:
 *   1. Assigns a confidence score (0–1)
 *   2. Suppresses low-confidence findings (< 0.6)
 *   3. Merges semantically duplicate findings (same root cause)
 *   4. Returns a final GradedFinding[] list
 */

import { Role } from '../types';
import { resolveProviderForRole } from '../cli/providerResolver';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import type { ValidatedHypothesis, GradedFinding } from '../types/validate';
import { newFindingId } from '../database/validationStore';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== SYSTEM PROMPT ====================

const GRADER_SYSTEM_PROMPT = `You are a Validation Grader in a governed code review pipeline.

You will receive a list of validated hypotheses — potential code issues that have already passed through a validation engine. Your job is to:

1. **Assign a confidence score (0.0–1.0)** to each hypothesis based on:
   - Clarity and specificity of the issue description
   - Impact on correctness or security if the issue is real
   - Developer usefulness: would a reasonable developer want to act on this?

2. **Merge duplicates**: If two hypotheses describe the same root cause (even with different wording or locations), merge them into ONE finding. Use the most specific description.

3. **Suppress low-value findings**: Items with confidence < 0.6 should be excluded from your output.

## Response Format
Your response MUST be valid JSON:

\`\`\`json
{
  "gradedFindings": [
    {
      "sourceId": "S-001",
      "confidence": 0.85,
      "mergedWith": []
    },
    {
      "sourceId": "L-002",
      "confidence": 0.72,
      "mergedWith": ["L-003"]
    }
  ]
}
\`\`\`

**Fields:**
- sourceId: the id of the primary hypothesis to keep
- confidence: 0.0–1.0 (exclude findings below 0.6)
- mergedWith: ids of other hypotheses that are duplicates of this one (empty array if none)

Only include findings you are confident should be surfaced to a developer.
`;

// ==================== GRADER ====================

/**
 * Grade a list of validated hypotheses, assigning confidence scores
 * and merging duplicates. Returns only findings with confidence ≥ 0.6.
 */
export async function gradeFindings(
	validatedHypotheses: ValidatedHypothesis[],
	onEvent?: (event: CLIActivityEvent) => void,
): Promise<GradedFinding[]> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validateGrader' })
		: null;

	const candidates = validatedHypotheses.filter(
		h => h.proof_status === 'proven' || h.proof_status === 'probable'
	);

	if (candidates.length === 0) {
		log?.info('No candidates to grade');
		return [];
	}

	log?.info('Grading candidates', { count: candidates.length });

	try {
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			log?.warn('Could not resolve provider for grader — using default confidence');
			return fallbackGrade(candidates);
		}

		const context = buildGraderContext(candidates);
		const stdinContent = buildStdinContent(GRADER_SYSTEM_PROMPT, context);

		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent,
		});

		if (!cliResult.success) {
			log?.warn('Grader invocation failed — using default confidence');
			return fallbackGrade(candidates);
		}

		const graded = parseGraderResponse(cliResult.value.response, candidates);
		log?.info('Grading complete', { surfaced: graded.length, suppressed: candidates.length - graded.length });
		return graded;

	} catch (err) {
		log?.error('Grader threw', { error: err instanceof Error ? err.message : String(err) });
		return fallbackGrade(candidates);
	}
}

// ==================== HELPERS ====================

function buildGraderContext(candidates: ValidatedHypothesis[]): string {
	const lines: string[] = ['# Validated Hypotheses to Grade\n'];
	for (const h of candidates) {
		lines.push(
			`## ${h.id} [${h.category}] [${h.severity}] [${h.proof_status}]`,
			`**Description:** ${h.text}`,
			`**Location:** ${h.location}`,
			`**Tool used:** ${h.tool_used}`,
			h.proof_artifact ? `**Proof artifact:**\n\`\`\`\n${h.proof_artifact.slice(0, 500)}\n\`\`\`` : '',
			''
		);
	}
	return lines.join('\n');
}

function parseGraderResponse(
	raw: string,
	candidates: ValidatedHypothesis[],
): GradedFinding[] {
	try {
		const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
		const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
		const payload = JSON.parse(jsonStr) as { gradedFindings?: Array<{ sourceId: string; confidence: number; mergedWith?: string[] }> };

		if (!Array.isArray(payload.gradedFindings)) {
			return fallbackGrade(candidates);
		}

		const byId = new Map(candidates.map(c => [c.id, c]));
		const results: GradedFinding[] = [];

		for (const g of payload.gradedFindings) {
			if (typeof g.confidence !== 'number' || g.confidence < 0.6) { continue; }
			const source = byId.get(g.sourceId);
			if (!source) { continue; }
			results.push({
				...source,
				finding_id: newFindingId(),
				confidence: Math.min(1.0, Math.max(0.0, g.confidence)),
			});
		}

		return results;
	} catch {
		return fallbackGrade(candidates);
	}
}

/** Fallback: assign default confidence without LLM grading. */
function fallbackGrade(candidates: ValidatedHypothesis[]): GradedFinding[] {
	const confidenceMap: Record<string, number> = {
		proven: 0.9,
		probable: 0.7,
	};
	const severityBonus: Record<string, number> = {
		critical: 0.05,
		high: 0.02,
		medium: 0,
		low: -0.05,
	};

	return candidates
		.filter(h => h.proof_status === 'proven' || h.proof_status === 'probable')
		.map(h => ({
			...h,
			finding_id: newFindingId(),
			confidence: Math.min(1.0,
				(confidenceMap[h.proof_status] ?? 0.7) + (severityBonus[h.severity] ?? 0)
			),
		}))
		.filter(f => f.confidence >= 0.6);
}
