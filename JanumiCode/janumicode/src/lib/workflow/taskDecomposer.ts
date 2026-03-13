/**
 * Task Decomposer
 *
 * Uses the configured Executor CLI provider to decompose an intent_record +
 * acceptance_contract into a structured task graph. Enforces the granularity
 * rubric from the Task Graph Granularity Guidance.
 */

import { randomUUID } from 'crypto';
import type { Result } from '../types';
import type {
	IntentRecord,
	AcceptanceContract,
	TaskGraph,
	TaskUnit,
	TaskEdge,
} from '../types/maker';
import { TASK_GRAPH_LIMITS } from '../types/maker';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { buildStdinContent } from '../cli/types';
import { createTaskGraph } from '../database/makerStore';
import { buildTaskGraphFromResponse, checkDecompositionQuality } from './taskGraph';
import type { RawTaskUnit, RawTaskEdge } from './taskGraph';

// ==================== DECOMPOSITION PROMPT ====================

const DECOMPOSITION_SYSTEM_PROMPT = `You are the TASK DECOMPOSER for JanumiCode.

Your job is to decompose a human's goal (captured as an IntentRecord with an AcceptanceContract) into a structured task graph of executable units.

# Granularity Rules

Each task_unit MUST:
- Have exactly ONE primary objective
- Be describable in 1-2 sentences
- Have at least one concrete observable output
- Have at least one concrete falsifier (what would prove it wrong)
- Be validatable without executing the whole project plan
- Have a local repair strategy if it fails
- Be understandable by a human reviewer

Target: ${TASK_GRAPH_LIMITS.target_min_units}-${TASK_GRAPH_LIMITS.target_max_units} units per goal.
Soft warning above ${TASK_GRAPH_LIMITS.soft_warning_units} units.
Require hierarchical grouping above ${TASK_GRAPH_LIMITS.require_grouping_units} units.
Reject below ${TASK_GRAPH_LIMITS.reject_below_for_nontrivial} units for any non-trivial feature.

# Anti-patterns

DO NOT create units that:
- Are too broad: "Implement the entire feature" or "Build the backend"
- Are too narrow: "Add import line" or "Rename variable" or "Open file"
- Have multiple independent objectives
- Cannot fail independently
- Exist only for sequencing details

# Required fields per unit

\`\`\`
temp_id: string          // Temporary ID for referencing in edges (e.g., "u1", "u2")
label: string            // Short human-readable label
goal: string             // One clear sentence describing the objective
category: string         // SCAFFOLD | IMPLEMENTATION | REFACTOR | TEST | DOCUMENTATION | CONFIGURATION | MIGRATION
inputs: string[]         // What this unit needs to start
outputs: string[]        // What this unit produces
preconditions: string[]  // What must be true before execution
postconditions: string[] // What must be true after execution
allowed_tools: string[]  // Tool categories this unit needs. Rules:
  // - "file_read" — reading files (always available, include for clarity)
  // - "file_write" — creating or modifying files. REQUIRED if the unit produces any file output.
  // - "bash" — running shell commands (tests, builds, installs, scripts)
  // - "web_search" — external web lookups
  // If a unit's outputs or postconditions mention creating/updating/writing files, it MUST include "file_write".
  // If a unit's verification_method runs commands, it MUST include "bash".
preferred_provider: string | null  // "claude-code" | "codex-cli" | "gemini-cli" | null (auto-select)
max_change_scope: string // Directory or file pattern bounding changes (e.g., "src/lib/auth/")
observables: string[]    // Concrete things to check after execution
falsifiers: string[]     // What would prove this unit failed
verification_method: string // How to validate completion (e.g., "tsc --noEmit passes", "tests pass in src/auth/")
\`\`\`

# Edge types

\`\`\`
from_temp_id: string   // Source unit temp_id
to_temp_id: string     // Target unit temp_id
edge_type: string      // DEPENDS_ON (to must finish before from) | BLOCKS | RELATED
\`\`\`

# Response Format

Your response MUST be valid JSON:

\`\`\`json
{
  "units": [ /* array of task unit objects */ ],
  "edges": [ /* array of edge objects */ ]
}
\`\`\`

Do NOT include any text outside the JSON block. Only output valid JSON.`;

// ==================== PUBLIC API ====================

export interface DecompositionResult {
	graph: TaskGraph;
	units: TaskUnit[];
	edges: TaskEdge[];
}

/**
 * Decompose a goal into a task graph via LLM.
 * Invokes the provided CLI provider with the decomposition prompt.
 * Validates decomposition quality before returning.
 *
 * @param intentRecord The captured intent
 * @param contract The acceptance contract
 * @param historicalContext Pre-formatted historical context string (invariants, failure motifs)
 * @param dialogueId Current dialogue ID
 * @param provider CLI provider to use for decomposition
 * @param workspaceRoot Workspace root path
 * @param maxAttempts Maximum decomposition attempts on quality failure (default 2)
 */
export async function decomposeGoalIntoTaskGraph(
	intentRecord: IntentRecord,
	contract: AcceptanceContract,
	historicalContext: string,
	dialogueId: string,
	provider: RoleCLIProvider,
	workspaceRoot: string,
	maxAttempts = 2
): Promise<Result<DecompositionResult>> {
	let lastQualityFeedback = '';

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const userPrompt = buildDecompositionUserPrompt(
			intentRecord, contract, historicalContext, lastQualityFeedback
		);

		const stdinContent = buildStdinContent(DECOMPOSITION_SYSTEM_PROMPT, userPrompt);

		const invokeResult = await provider.invoke({
			stdinContent,
			workingDirectory: workspaceRoot,
			outputFormat: 'json',
			timeout: 180000, // 3 minutes for decomposition
		});

		if (!invokeResult.success) {
			return { success: false, error: invokeResult.error };
		}

		// Parse LLM response
		const parseResult = parseDecompositionResponse(invokeResult.value.response);
		if (!parseResult.success) {
			lastQualityFeedback = `Previous attempt failed to parse: ${parseResult.error.message}. Please output only valid JSON.`;
			continue;
		}

		const { rawUnits, rawEdges } = parseResult.value;

		// Create task graph in DB
		const graphResult = createTaskGraph(dialogueId, intentRecord.intent_id, intentRecord.human_goal);
		if (!graphResult.success) {
			return { success: false, error: graphResult.error };
		}

		// Build and persist units + edges
		const buildResult = buildTaskGraphFromResponse(
			graphResult.value.graph_id, rawUnits, rawEdges
		);
		if (!buildResult.success) {
			return { success: false, error: buildResult.error };
		}

		// Check decomposition quality
		const quality = checkDecompositionQuality(
			graphResult.value.graph_id,
			buildResult.value.units,
			buildResult.value.edges
		);

		if (quality.is_acceptable) {
			return {
				success: true,
				value: {
					graph: graphResult.value,
					units: buildResult.value.units,
					edges: buildResult.value.edges,
				},
			};
		}

		// Quality failed — prepare feedback for retry
		lastQualityFeedback = formatQualityFeedback(quality);
	}

	return {
		success: false,
		error: new Error(`Decomposition failed quality checks after ${maxAttempts} attempts. Last feedback: ${lastQualityFeedback}`),
	};
}

// ==================== INTERNAL HELPERS ====================

function buildDecompositionUserPrompt(
	intent: IntentRecord,
	contract: AcceptanceContract,
	historicalContext: string,
	qualityFeedback: string
): string {
	const sections: string[] = [];

	sections.push(`# Intent Record
Goal: ${intent.human_goal}
Scope In: ${intent.scope_in.join(', ') || '(none specified)'}
Scope Out: ${intent.scope_out.join(', ') || '(none specified)'}
Priority Axes: ${intent.priority_axes.join(', ') || '(none specified)'}
Risk Posture: ${intent.risk_posture}`);

	sections.push(`# Acceptance Contract
Success Conditions:
${contract.success_conditions.map((c) => `- ${c}`).join('\n') || '- (none specified)'}

Required Validations:
${contract.required_validations.map((v) => `- ${v.type}: ${v.description}${v.command ? ` (${v.command})` : ''}`).join('\n') || '- (none specified)'}

Non-Goals:
${contract.non_goals.map((n) => `- ${n}`).join('\n') || '- (none specified)'}`);

	if (historicalContext) {
		sections.push(`# Historical Context (failure motifs, invariants, precedent patterns)
${historicalContext}`);
	}

	if (qualityFeedback) {
		sections.push(`# Quality Feedback from Previous Attempt (MUST address these issues)
${qualityFeedback}`);
	}

	sections.push('Now decompose the goal into a task graph. Output ONLY valid JSON.');

	return sections.join('\n\n');
}

function parseDecompositionResponse(
	response: string
): Result<{ rawUnits: RawTaskUnit[]; rawEdges: RawTaskEdge[] }> {
	try {
		// Try to extract JSON from the response (may be wrapped in markdown code blocks)
		let jsonStr = response.trim();

		// Strip markdown code fences if present
		const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.units) || parsed.units.length === 0) {
			return { success: false, error: new Error('Response missing "units" array or it is empty.') };
		}

		// Validate and normalize units
		const rawUnits: RawTaskUnit[] = parsed.units.map((u: Record<string, unknown>, i: number) => ({
			temp_id: (u.temp_id as string) || `u${i + 1}`,
			label: (u.label as string) || `Unit ${i + 1}`,
			goal: (u.goal as string) || '',
			category: (u.category as string) || 'IMPLEMENTATION',
			inputs: Array.isArray(u.inputs) ? u.inputs as string[] : [],
			outputs: Array.isArray(u.outputs) ? u.outputs as string[] : [],
			preconditions: Array.isArray(u.preconditions) ? u.preconditions as string[] : [],
			postconditions: Array.isArray(u.postconditions) ? u.postconditions as string[] : [],
			allowed_tools: Array.isArray(u.allowed_tools) ? u.allowed_tools as string[] : [],
			preferred_provider: (u.preferred_provider as string) || null,
			max_change_scope: (u.max_change_scope as string) || '.',
			observables: Array.isArray(u.observables) ? u.observables as string[] : [],
			falsifiers: Array.isArray(u.falsifiers) ? u.falsifiers as string[] : [],
			verification_method: (u.verification_method as string) || '',
			parent_unit_id: (u.parent_unit_id as string) || null,
		}));

		const rawEdges: RawTaskEdge[] = Array.isArray(parsed.edges)
			? (parsed.edges as Record<string, unknown>[]).map((e) => ({
				from_temp_id: (e.from_temp_id as string) || '',
				to_temp_id: (e.to_temp_id as string) || '',
				edge_type: (e.edge_type as string) || 'DEPENDS_ON',
			}))
			: [];

		return { success: true, value: { rawUnits, rawEdges } };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to parse decomposition response'),
		};
	}
}

function formatQualityFeedback(
	quality: ReturnType<typeof checkDecompositionQuality>
): string {
	const lines = [`Decomposition quality check FAILED (${quality.issues.length} issues):`];

	for (const issue of quality.issues) {
		lines.push(`- [${issue.issue}] ${issue.detail}`);
	}

	lines.push('');
	lines.push('Please address ALL issues above and re-decompose.');

	return lines.join('\n');
}
