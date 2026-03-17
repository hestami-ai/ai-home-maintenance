/**
 * Architecture Phase Context Builder
 *
 * Builds context packs for the Architecture Expert agent invocations:
 *   - DECOMPOSING: approved plan + domain coverage → capabilities + workflows
 *   - MODELING: capabilities + workflows + plan requirements → domain model
 *   - DESIGNING: capabilities + workflows + domain model → components + interfaces
 *   - SEQUENCING: components + interfaces + domain model → implementation roadmap
 */

import type { Result } from '../../types';
import type { IntakePlanDocument, DomainCoverageMap } from '../../types/intake';
import type {
	ArchitectureDocument,
	DecompositionConfig,
} from '../../types/architecture';
import { compileContextPack } from '../compiler';
import type { Role } from '../../types';

// ==================== DECOMPOSING CONTEXT ====================

export interface DecomposingContextOptions {
	dialogueId: string;
	approvedPlan: IntakePlanDocument;
	domainCoverage: DomainCoverageMap | null;
	tokenBudget: number;
	/** Validation findings from a previous iteration (re-decomposition feedback). */
	humanFeedback?: string | null;
}

/**
 * Build context for the DECOMPOSING sub-state (Global Planner).
 * Provides the approved plan, domain coverage, and relevant history.
 */
export function buildDecomposingContext(
	options: DecomposingContextOptions
): Result<string> {
	try {
		const sections: string[] = [];

		// 1. Goal and plan
		sections.push('# Approved Implementation Plan');
		sections.push(`## Title\n${options.approvedPlan.title}`);
		if (options.approvedPlan.proposedApproach) {
			sections.push(`## Proposed Approach\n${options.approvedPlan.proposedApproach}`);
		}

		// 2. Requirements
		if (options.approvedPlan.requirements?.length) {
			sections.push('## Requirements');
			for (const req of options.approvedPlan.requirements) {
				sections.push(`- **${req.id ?? 'REQ'}**: ${req.text ?? JSON.stringify(req)}`);
			}
		}

		// 3. Decisions
		if (options.approvedPlan.decisions?.length) {
			sections.push('## Decisions');
			for (const dec of options.approvedPlan.decisions) {
				sections.push(`- **${dec.id ?? 'DEC'}**: ${dec.text ?? JSON.stringify(dec)}`);
			}
		}

		// 4. Constraints
		if (options.approvedPlan.constraints?.length) {
			sections.push('## Constraints');
			for (const con of options.approvedPlan.constraints) {
				sections.push(`- ${typeof con === 'string' ? con : (con.text ?? JSON.stringify(con))}`);
			}
		}

		// 5. Domain coverage
		if (options.domainCoverage) {
			sections.push('## Domain Coverage from INTAKE');
			for (const [domain, coverage] of Object.entries(options.domainCoverage)) {
				const entry = coverage as { level: string; notes?: string };
				sections.push(`- **${domain}**: ${entry.level}${entry.notes ? ` — ${entry.notes}` : ''}`);
			}
		}

		// 6. Historical context (constraints, claims, verdicts)
		const baseContext = compileContextPack({
			role: 'TECHNICAL_EXPERT' as Role,
			dialogueId: options.dialogueId,
			goal: options.approvedPlan.title,
			tokenBudget: Math.floor(options.tokenBudget * 0.3),
			includeHistorical: true,
			maxHistoricalFindings: 5,
		});

		if (baseContext.success && baseContext.value.historical_findings.length > 0) {
			sections.push(
				'## Historical Context\n' +
				baseContext.value.historical_findings.map(f => `- ${f}`).join('\n')
			);
		}

		// Validation feedback from a previous iteration (re-decomposition)
		if (options.humanFeedback) {
			sections.push(
				'# Validation Feedback (MUST Address)\n\n' +
				'The previous decomposition failed validation. You MUST fix these issues:\n\n' +
				options.humanFeedback +
				'\n\nFor capabilities that have no workflows: either add concrete workflows that ' +
				'trace through the capability, or merge the capability into a parent capability ' +
				'that does have workflows. Infrastructure/cross-cutting capabilities are acceptable ' +
				'without workflows only if they serve as shared foundations referenced by other capabilities.'
			);
		}

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to build decomposing context') };
	}
}

// ==================== MODELING CONTEXT ====================

export interface ModelingContextOptions {
	dialogueId: string;
	architectureDoc: ArchitectureDocument;
	tokenBudget: number;
}

/**
 * Build context for the MODELING sub-state (Domain Model).
 * Provides capabilities, workflows, and plan requirements so the agent
 * can identify data entities that flow through the system.
 */
export function buildModelingContext(
	options: ModelingContextOptions
): Result<string> {
	try {
		const sections: string[] = [];
		const doc = options.architectureDoc;

		// 1. Capabilities with requirement traceability (hierarchical)
		sections.push('# Architecture: Capabilities');
		const topLevel = doc.capabilities.filter(c => !c.parent_capability_id);
		for (const cap of topLevel) {
			sections.push(`## ${cap.capability_id}: ${cap.label}`);
			sections.push(cap.description);
			if (cap.source_requirements.length > 0) {
				sections.push(`Requirements: ${cap.source_requirements.join(', ')}`);
			}
			// Render children
			const children = doc.capabilities.filter(c => c.parent_capability_id === cap.capability_id);
			for (const child of children) {
				sections.push(`  - **${child.capability_id}**: ${child.label} — ${child.description}`);
				if (child.source_requirements.length > 0) {
					sections.push(`    Requirements: ${child.source_requirements.join(', ')}`);
				}
			}
		}

		// 2. Workflows with detailed steps (primary input for entity identification)
		sections.push('# Architecture: Workflows');
		for (const wf of doc.workflow_graph) {
			sections.push(`## ${wf.workflow_id}: ${wf.label}`);
			sections.push(wf.description);
			if (wf.steps.length > 0) {
				sections.push('Steps:');
				for (const step of wf.steps) {
					const inputs = step.inputs.length > 0 ? ` | inputs: ${step.inputs.join(', ')}` : '';
					const outputs = step.outputs.length > 0 ? ` | outputs: ${step.outputs.join(', ')}` : '';
					sections.push(`  ${step.step_id}. ${step.label} (${step.actor}) → ${step.action}${inputs}${outputs}`);
				}
			}
			if (wf.triggers.length > 0) {
				sections.push(`Triggers: ${wf.triggers.join(', ')}`);
			}
			if (wf.outputs.length > 0) {
				sections.push(`Outputs: ${wf.outputs.join(', ')}`);
			}
		}

		// 3. Instruction to examine workspace
		sections.push('# Workspace Guidance');
		sections.push('If ground-truth specification files exist in the workspace (look for specs/ or ground-truth-specs/ directories), examine them for domain entity patterns, field naming conventions, and relationship structures.');

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to build modeling context') };
	}
}

// ==================== DESIGNING CONTEXT ====================

export interface DesigningContextOptions {
	dialogueId: string;
	architectureDoc: ArchitectureDocument;
	decompositionConfig: DecompositionConfig;
	humanFeedback: string | null;
	tokenBudget: number;
}

/**
 * Build context for the DESIGNING sub-state (Component Architecture + Interfaces).
 * Provides capabilities, workflows, AND the Domain Model from MODELING.
 */
export function buildDesigningContext(
	options: DesigningContextOptions
): Result<string> {
	try {
		const sections: string[] = [];
		const doc = options.architectureDoc;

		// 1. Capabilities from DECOMPOSING (hierarchical)
		sections.push('# Architecture: Capabilities');
		const topCaps = doc.capabilities.filter(c => !c.parent_capability_id);
		for (const cap of topCaps) {
			sections.push(`## ${cap.capability_id}: ${cap.label}`);
			sections.push(cap.description);
			if (cap.source_requirements.length > 0) {
				sections.push(`Requirements: ${cap.source_requirements.join(', ')}`);
			}
			if (cap.workflows.length > 0) {
				sections.push(`Workflows: ${cap.workflows.join(', ')}`);
			}
			const childCaps = doc.capabilities.filter(c => c.parent_capability_id === cap.capability_id);
			for (const child of childCaps) {
				sections.push(`  - **${child.capability_id}**: ${child.label} (${child.workflows.join(', ')})`);
			}
		}

		// 2. Workflows from DECOMPOSING
		sections.push('# Architecture: Workflows');
		for (const wf of doc.workflow_graph) {
			sections.push(`## ${wf.workflow_id}: ${wf.label}`);
			sections.push(wf.description);
			if (wf.steps.length > 0) {
				sections.push('Steps:');
				for (const step of wf.steps) {
					sections.push(`  ${step.step_id}. ${step.label} (${step.actor}) → ${step.action}`);
				}
			}
		}

		// 3. Domain Model from MODELING (key input for flow-first design)
		if (doc.data_models.length > 0) {
			sections.push('# Domain Model (from MODELING stage)');
			sections.push('Use this domain model to inform component design. Components should align with these entities.');
			for (const model of doc.data_models) {
				sections.push(`## ${model.model_id}: ${model.entity_name}`);
				sections.push(model.description);
				if (model.fields.length > 0) {
					sections.push('Fields:');
					for (const f of model.fields) {
						sections.push(`  - ${f.name}: ${f.type}${f.required ? ' (required)' : ''} — ${f.description}`);
					}
				}
				if (model.relationships.length > 0) {
					sections.push('Relationships:');
					for (const r of model.relationships) {
						sections.push(`  → ${r.target_model} (${r.type}) — ${r.description}`);
					}
				}
				if (model.invariants?.length > 0) {
					sections.push(`Invariants: ${model.invariants.join('; ')}`);
				}
			}
		}

		// 4. Decomposition configuration
		sections.push('# Decomposition Constraints');
		sections.push(`- Max recursion depth: ${options.decompositionConfig.max_depth}`);
		sections.push(`- Max components per level: ${options.decompositionConfig.max_breadth}`);
		sections.push(`- Single-responsibility threshold: ≤${options.decompositionConfig.responsibility_threshold} workflows per component`);
		sections.push(`- Context token limit: ${options.decompositionConfig.context_token_limit}`);

		// 5. Existing design (if redesigning after validation failure or human feedback)
		if (doc.components.length > 0) {
			sections.push('# Previous Design (for revision)');
			sections.push('## Components');
			for (const comp of doc.components) {
				sections.push(`- **${comp.component_id}**: ${comp.label} — ${comp.responsibility}`);
				if (comp.rationale) {
					sections.push(`  Rationale: ${comp.rationale}`);
				}
			}
			if (doc.interfaces.length > 0) {
				sections.push('## Interfaces');
				for (const iface of doc.interfaces) {
					sections.push(`- **${iface.interface_id}**: ${iface.label} (${iface.type}) — ${iface.description}`);
					if (iface.contract) {
						sections.push(`  Contract: ${iface.contract}`);
					}
				}
			}
		}

		// 6. Validation findings (if redesigning after validation failure)
		if (doc.validation_findings.length > 0) {
			sections.push('# Validation Findings to Address');
			for (const [i, finding] of doc.validation_findings.entries()) {
				sections.push(`${i + 1}. ${finding}`);
			}
		}

		// 7. Human feedback (if redesigning after human revision)
		if (options.humanFeedback) {
			sections.push('# Human Feedback (MUST Address)');
			sections.push(options.humanFeedback);
		}

		// 8. Workspace guidance
		sections.push(
			'# Workspace Guidance',
			'Examine the workspace for implementation patterns. Look for existing module structures in src/, domain patterns in ground-truth-specs/, and project conventions in config files to inform component boundaries and file_scope.',
		);

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to build designing context') };
	}
}

// ==================== SEQUENCING CONTEXT ====================

export interface SequencingContextOptions {
	dialogueId: string;
	architectureDoc: ArchitectureDocument;
	tokenBudget: number;
}

/**
 * Build context for the SEQUENCING sub-state (Implementation Roadmap).
 * Provides the complete architecture (capabilities, domain model, components, interfaces)
 * so the agent can determine optimal implementation order.
 */
export function buildSequencingContext(
	options: SequencingContextOptions
): Result<string> {
	try {
		const sections: string[] = [];
		const doc = options.architectureDoc;

		// 1. Capabilities (hierarchical grouping)
		sections.push('# Capabilities');
		const seqTopLevel = doc.capabilities.filter(c => !c.parent_capability_id);
		for (const cap of seqTopLevel) {
			sections.push(`- **${cap.capability_id}**: ${cap.label} — ${cap.description}`);
			const seqChildren = doc.capabilities.filter(c => c.parent_capability_id === cap.capability_id);
			for (const child of seqChildren) {
				sections.push(`  - **${child.capability_id}**: ${child.label}`);
			}
		}

		// 2. Components with dependencies (primary input for sequencing)
		sections.push('# Components');
		for (const comp of doc.components) {
			const deps = comp.dependencies.length > 0
				? ` | depends on: ${comp.dependencies.join(', ')}`
				: ' | no dependencies';
			const wfs = comp.workflows_served.length > 0
				? ` | workflows: ${comp.workflows_served.join(', ')}`
				: '';
			sections.push(`- **${comp.component_id}**: ${comp.label}${deps}${wfs}`);
			sections.push(`  ${comp.responsibility}`);
		}

		// 3. Domain Model (for understanding data dependencies)
		if (doc.data_models.length > 0) {
			sections.push('# Domain Model');
			for (const model of doc.data_models) {
				const rels = model.relationships.length > 0
					? ` → ${model.relationships.map(r => `${r.target_model} (${r.type})`).join(', ')}`
					: '';
				sections.push(`- **${model.model_id}**: ${model.entity_name} (${model.fields.length} fields)${rels}`);
			}
		}

		// 4. Interfaces (for understanding integration points)
		if (doc.interfaces.length > 0) {
			sections.push('# Interfaces');
			for (const iface of doc.interfaces) {
				sections.push(`- **${iface.interface_id}**: ${iface.label} (${iface.type}) — ${iface.provider_component} → ${iface.consumer_components.join(', ')}`);
			}
		}

		// 5. Workspace guidance
		sections.push(
			'# Workspace Guidance',
			'Examine the workspace for build and deployment patterns. Check for existing migration files, build scripts, test infrastructure, and deployment configs to inform implementation order and verification methods.',
		);

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error('Failed to build sequencing context') };
	}
}
