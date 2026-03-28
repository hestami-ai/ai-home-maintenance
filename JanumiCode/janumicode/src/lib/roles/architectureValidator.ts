/**
 * Architecture Validator
 *
 * Performs goal-alignment checks on ArchitectureDocuments via the Historian role.
 * Also provides architecture drift detection for the PROPOSE boundary.
 *
 * Two check types:
 *   - GOAL_ALIGNMENT_CHECK: During VALIDATING sub-state — compares architecture against goal + plan
 *   - ARCHITECTURE_DRIFT_CHECK: At PROPOSE boundary — compares executor proposal against architecture
 */

import type { Result } from '../types';
import { Role } from '../types';
import type { ArchitectureDocument, RequirementsTraceabilityResult } from '../types/architecture';
import { resolveProviderForRole } from '../cli/providerResolver';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import { getWorkflowState } from '../workflow/stateMachine';
import { getLogger, isLoggerInitialized } from '../logging';
import {
	getAllDomainMappings,
	findUnbackedCapabilities,
} from '../database/architectureStore';

// ==================== GOAL ALIGNMENT CHECK ====================

export interface GoalAlignmentResult {
	score: number;      // 0-1, goal alignment score
	findings: string[]; // Specific findings/issues
}

const GOAL_ALIGNMENT_SYSTEM_PROMPT = `You are the HISTORIAN role in a governed multi-role dialogue system.

# Your Task
You are performing a GOAL ALIGNMENT CHECK on an architecture document.
Compare the architecture against the original user goal and approved implementation plan.

# What to Evaluate
1. **Requirement Coverage**: Does every requirement from the plan map to at least one capability?
2. **Scope Fidelity**: Are there capabilities that go beyond the plan's scope?
3. **Completeness**: Are there gaps where the plan specifies something the architecture doesn't address?
4. **Consistency**: Do the components, data models, and interfaces support the workflows?

# Response Format
Your response MUST be valid JSON:

\`\`\`json
{
  "score": 0.85,
  "findings": [
    "REQ-3 is not covered by any capability",
    "CAP-NOTIFY appears to be scope creep — not traced to any requirement"
  ]
}
\`\`\`

- score: 0.0 (no alignment) to 1.0 (perfect alignment)
- findings: specific, actionable issues (empty array if none)`;

/**
 * Run goal-alignment check on an architecture document.
 * Combines deterministic database checks with LLM-backed analysis.
 */
export async function runGoalAlignmentCheck(
	dialogueId: string,
	doc: ArchitectureDocument,
	onEvent?: (event: CLIActivityEvent) => void,
): Promise<Result<GoalAlignmentResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureValidator', check: 'GOAL_ALIGNMENT' })
		: null;

	try {
		const findings: string[] = [];

		// 1. Deterministic checks via lookup tables

		// Check for capabilities with no backing requirements (scope creep)
		const unbackedResult = findUnbackedCapabilities(doc.doc_id);
		if (unbackedResult.success) {
			for (const cap of unbackedResult.value) {
				findings.push(`Capability "${cap.label}" (${cap.capability_id}) has no backing requirements — potential scope creep`);
			}
		}

		// Note: orphan component detection is handled by the structural validator (runStructuralValidation)
		// with context-aware WARN/BLOCKING logic. Skipped here to avoid double-reporting.

		// Check domain mapping completeness
		const mappingsResult = getAllDomainMappings(doc.doc_id);
		if (mappingsResult.success) {
			// Get the approved plan's domain coverage from workflow metadata
			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				const meta = JSON.parse(stateResult.value.metadata);
				const engineeringDomainCoverage = meta.approvedIntakePlan?.engineeringDomainCoverage;
				if (engineeringDomainCoverage) {
					const mappedDomains = new Set(mappingsResult.value.map(m => m.domain));
					for (const [domain, coverage] of Object.entries(engineeringDomainCoverage)) {
						const entry = coverage as { level: string };
						if ((entry.level === 'ADEQUATE' || entry.level === 'PARTIAL') && !mappedDomains.has(domain as never)) {
							findings.push(`Domain "${domain}" has ${entry.level} INTAKE coverage but no capability mapping in architecture`);
						}
					}
				}
			}
		}

		// 2. LLM-backed goal alignment analysis
		let llmScore: number | null = null;
		let llmFindings: string[] = [];

		try {
			const providerResult = await resolveProviderForRole(Role.HISTORIAN);
			if (providerResult.success) {
				// Build context for the Historian
				const context = buildGoalAlignmentContext(dialogueId, doc);

				const stdinContent = buildStdinContent(GOAL_ALIGNMENT_SYSTEM_PROMPT, context);

				const cliResult = await invokeRoleStreaming({
					provider: providerResult.value,
					stdinContent,
					onEvent,
				});

				if (cliResult.success) {
					const parsed = parseGoalAlignmentResponse(cliResult.value.response);
					if (parsed) {
						llmScore = parsed.score;
						llmFindings = parsed.findings;
					}
				}
			}
		} catch (err) {
			log?.warn('LLM goal alignment check failed, using deterministic results only', {
				error: err instanceof Error ? err.message : String(err),
			});
		}

		// 3. Combine results
		const allFindings = [...findings, ...llmFindings];

		// Calculate score: if LLM provided one, use it; otherwise derive from findings
		let score: number;
		if (llmScore !== null) {
			score = llmScore;
		} else {
			// Heuristic: start at 1.0, subtract 0.1 per finding, minimum 0.0
			score = Math.max(0, 1.0 - allFindings.length * 0.1);
		}

		log?.info('Goal alignment check complete', {
			score,
			deterministicFindings: findings.length,
			llmFindings: llmFindings.length,
		});

		return {
			success: true,
			value: { score, findings: allFindings },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== REQUIREMENTS TRACEABILITY CHECK ====================

import { computeCapabilityCoverage } from '../workflow/architecturePhase';

/**
 * Check requirements traceability across the INTAKE → ARCHITECTURE bridge.
 * Pure deterministic check — no LLM calls.
 *
 * Returns:
 * - uncovered_requirements: plan requirements not mapped to any capability
 * - unbacked_capabilities: capabilities with no source requirements (scope creep)
 * - unmapped_engineering_domains: INTAKE domains with coverage but no capability mapping
 * - coverage_map: per-capability coverage assessment
 */
export function runRequirementsTraceabilityCheck(
	doc: ArchitectureDocument,
	 
	approvedPlan: any,
	 
	engineeringDomainCoverage: Record<string, any> | null,
): RequirementsTraceabilityResult {
	// 1. Uncovered requirements: plan requirements not in any capability's source_requirements
	const coveredReqs = new Set(doc.capabilities.flatMap(c => c.source_requirements));
	const allReqs: string[] = (approvedPlan?.requirements ?? []).map((r: { id: string }) => r.id);
	const uncovered_requirements = allReqs.filter(r => !coveredReqs.has(r));

	// 2. Unbacked capabilities: capabilities with empty source_requirements
	const unbacked_capabilities = doc.capabilities
		.filter(c => c.source_requirements.length === 0)
		.map(c => c.capability_id);

	// 3. Unmapped domains: INTAKE domains with PARTIAL/ADEQUATE coverage but no capability mapping
	const unmapped_engineering_domains: string[] = [];
	if (engineeringDomainCoverage) {
		const mappedDomains = new Set<string>(
			doc.capabilities.flatMap(c => c.engineering_domain_mappings.map(m => m.domain))
		);
		for (const [domain, entry] of Object.entries(engineeringDomainCoverage)) {
			const level = (entry as { level?: string }).level;
			if ((level === 'ADEQUATE' || level === 'PARTIAL') && !mappedDomains.has(domain)) {
				unmapped_engineering_domains.push(domain);
			}
		}
	}

	// 4. Compute capability coverage
	const coverage_map = computeCapabilityCoverage(doc);

	return { uncovered_requirements, unbacked_capabilities, unmapped_engineering_domains, coverage_map };
}

// ==================== ARCHITECTURE DRIFT CHECK ====================

export interface DriftCheckResult {
	drifted: boolean;
	driftItems: string[];
}

/**
 * Check if an executor proposal drifts from the approved architecture.
 * Called at the PROPOSE boundary to detect deviations.
 */
export async function runArchitectureDriftCheck(
	dialogueId: string,
	proposalSummary: string,
	architectureDoc: ArchitectureDocument
): Promise<Result<DriftCheckResult>> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'architectureValidator', check: 'ARCHITECTURE_DRIFT' })
		: null;

	try {
		const driftItems: string[] = [];

		// Deterministic: check if proposal references components not in architecture
		const componentIds = new Set(architectureDoc.components.map(c => c.component_id));
		const componentLabels = new Set(architectureDoc.components.map(c => c.label.toLowerCase()));

		// Simple heuristic: look for component names in the proposal
		// (Full implementation would use LLM to do semantic comparison)
		const proposalLower = proposalSummary.toLowerCase();

		// Check if the proposal mentions the expected components
		let referencedComponents = 0;
		for (const label of componentLabels) {
			if (proposalLower.includes(label.toLowerCase())) {
				referencedComponents++;
			}
		}

		if (componentLabels.size > 0 && referencedComponents === 0) {
			driftItems.push('Executor proposal does not reference any architecture components');
		}

		const drifted = driftItems.length > 0;

		log?.info('Architecture drift check complete', {
			drifted,
			driftItems: driftItems.length,
			referencedComponents,
			totalComponents: componentLabels.size,
		});

		return {
			success: true,
			value: { drifted, driftItems },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== INTERNAL HELPERS ====================

function buildGoalAlignmentContext(dialogueId: string, doc: ArchitectureDocument): string {
	const sections: string[] = [];

	// Get the original goal and approved plan from metadata
	try {
		const stateResult = getWorkflowState(dialogueId);
		if (stateResult.success) {
			const meta = JSON.parse(stateResult.value.metadata);
			if (meta.goal || meta.lastIntakeGoal) {
				sections.push(`# Original Goal\n${meta.goal ?? meta.lastIntakeGoal}`);
			}
			if (meta.approvedIntakePlan) {
				sections.push(`# Approved Plan: ${meta.approvedIntakePlan.title ?? 'Untitled'}`);
				if (meta.approvedIntakePlan.requirements?.length) {
					sections.push('## Requirements');
					for (const req of meta.approvedIntakePlan.requirements) {
						sections.push(`- ${req.id ?? ''}: ${req.text ?? req.description ?? JSON.stringify(req)}`);
					}
				}
			}
		}
	} catch { /* proceed without goal context */ }

	// Architecture summary
	sections.push('# Architecture Document');
	sections.push(`Version: ${doc.version}, Status: ${doc.status}`);

	sections.push('## Capabilities');
	for (const cap of doc.capabilities) {
		sections.push(`- **${cap.capability_id}**: ${cap.label} — Requirements: [${cap.source_requirements.join(', ')}]`);
	}

	sections.push('## Workflows');
	for (const wf of doc.workflow_graph) {
		sections.push(`- **${wf.workflow_id}**: ${wf.label} (capability: ${wf.capability_id})`);
	}

	sections.push('## Components');
	for (const comp of doc.components) {
		sections.push(`- **${comp.component_id}**: ${comp.label} — Serves: [${comp.workflows_served.join(', ')}]`);
	}

	if (doc.data_models.length > 0) {
		sections.push('## Data Models');
		for (const model of doc.data_models) {
			sections.push(`- **${model.model_id}**: ${model.entity_name} (${model.fields.length} fields)`);
		}
	}

	return sections.join('\n\n');
}

function parseGoalAlignmentResponse(raw: string): GoalAlignmentResult | null {
	try {
		const trimmed = raw.trim();

		// Try direct parse
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			// Try extracting from markdown fence
			const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
			if (fenceMatch) {
				parsed = JSON.parse(fenceMatch[1].trim());
			} else {
				return null;
			}
		}

		const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : null;
		const findings = Array.isArray(parsed.findings) ? parsed.findings.filter((f: unknown) => typeof f === 'string') as string[] : [];

		if (score === null) {return null;}

		return { score, findings };
	} catch {
		return null;
	}
}
