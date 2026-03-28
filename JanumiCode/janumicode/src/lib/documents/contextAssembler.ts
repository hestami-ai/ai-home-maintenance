/**
 * Context Assembler for Document Generation
 *
 * Reads all relevant structured data for a dialogue and assembles it
 * into a formatted context string that the LLM can use to generate
 * a prose document. Keeps generator.ts focused on the LLM call.
 */

import { getIntakeConversation, getClaims, getVerdicts } from '../events/reader.js';
import { getWorkflowState } from '../workflow/stateMachine.js';
import { getArchitectureDocumentForDialogue } from '../database/architectureStore.js';
import { getTaskGraphForDialogue, getTaskUnitsForGraph } from '../database/makerStore.js';
import { getAllDialogues, type DialogueRecord } from '../dialogue/lifecycle.js';
import type { IntakePlanDocument } from '../types/intake.js';
import type { ArchitectureDocument } from '../types/architecture.js';
import type { Claim, Verdict } from '../types/index.js';

// ==================== CONTEXT ASSEMBLY ====================

/**
 * Assemble all available context for a dialogue into a structured
 * text block suitable for inclusion in an LLM prompt.
 */
export function assembleDocumentContext(dialogueId: string): string {
	const sections: string[] = [];

	// 1. Dialogue metadata
	const dialogueMeta = assembleDialogueMetadata(dialogueId);
	if (dialogueMeta) { sections.push(dialogueMeta); }

	// 2. Intake plan
	const planContext = assembleIntakePlan(dialogueId);
	if (planContext) { sections.push(planContext); }

	// 3. Architecture document
	const archContext = assembleArchitectureDocument(dialogueId);
	if (archContext) { sections.push(archContext); }

	// 4. Claims & verdicts
	const claimsContext = assembleClaimsAndVerdicts(dialogueId);
	if (claimsContext) { sections.push(claimsContext); }

	// 5. Task graph
	const taskContext = assembleTaskGraph(dialogueId);
	if (taskContext) { sections.push(taskContext); }

	return sections.join('\n\n---\n\n');
}

// ==================== SECTION ASSEMBLERS ====================

function assembleDialogueMetadata(dialogueId: string): string | null {
	const dialoguesResult = getAllDialogues();
	if (!dialoguesResult.success) { return null; }

	const dialogue = dialoguesResult.value.find(
		(d: DialogueRecord) => d.dialogue_id === dialogueId
	);
	if (!dialogue) { return null; }

	const stateResult = getWorkflowState(dialogueId);
	const phase = stateResult.success ? stateResult.value.current_phase : 'UNKNOWN';

	const lines = [
		'## Dialogue Metadata',
		'',
		`- **Dialogue ID:** ${dialogueId}`,
		`- **Goal:** ${dialogue.goal}`,
		`- **Title:** ${dialogue.title ?? '(untitled)'}`,
		`- **Status:** ${dialogue.status}`,
		`- **Current Phase:** ${phase}`,
		`- **Created:** ${dialogue.created_at}`,
	];

	return lines.join('\n');
}

function assembleIntakePlan(dialogueId: string): string | null {
	const result = getIntakeConversation(dialogueId);
	if (!result.success || !result.value) { return null; }

	const plan: IntakePlanDocument = result.value.finalizedPlan ?? result.value.draftPlan;
	if (!plan) { return null; }

	const lines: string[] = ['## INTAKE Plan'];
	lines.push('');

	if (plan.title) { lines.push(`**Title:** ${plan.title}`); }
	if (plan.summary) { lines.push(`\n**Summary:** ${plan.summary}`); }
	if (plan.requestCategory) { lines.push(`\n**Request Category:** ${plan.requestCategory}`); }
	if (plan.productVision) { lines.push(`\n**Product Vision:** ${plan.productVision}`); }
	if (plan.productDescription) { lines.push(`\n**Product Description:** ${plan.productDescription}`); }
	if (plan.proposedApproach) { lines.push(`\n**Proposed Approach:** ${plan.proposedApproach}`); }

	// Requirements
	if (plan.requirements?.length) {
		lines.push('\n### Requirements');
		for (const r of plan.requirements) {
			lines.push(`- **${r.id}:** ${r.text}`);
		}
	}

	// Decisions
	if (plan.decisions?.length) {
		lines.push('\n### Decisions');
		for (const d of plan.decisions) {
			lines.push(`- **${d.id}:** ${d.text}`);
		}
	}

	// Constraints
	if (plan.constraints?.length) {
		lines.push('\n### Constraints');
		for (const c of plan.constraints) {
			lines.push(`- **${c.id}:** ${c.text}`);
		}
	}

	// Open questions
	if (plan.openQuestions?.length) {
		lines.push('\n### Open Questions');
		for (const q of plan.openQuestions) {
			lines.push(`- **${q.id}:** ${q.text}`);
		}
	}

	// Technical notes
	if (plan.technicalNotes?.length) {
		lines.push('\n### Technical Notes');
		for (const n of plan.technicalNotes) {
			lines.push(`- ${n}`);
		}
	}

	// Personas
	if (plan.personas?.length) {
		lines.push('\n### Personas');
		for (const p of plan.personas) {
			lines.push(`\n#### ${p.name} (${p.id})`);
			lines.push(p.description);
			if (p.goals.length) { lines.push(`**Goals:** ${p.goals.join('; ')}`); }
			if (p.painPoints.length) { lines.push(`**Pain Points:** ${p.painPoints.join('; ')}`); }
		}
	}

	// User journeys
	if (plan.userJourneys?.length) {
		lines.push('\n### User Journeys');
		for (const j of plan.userJourneys) {
			lines.push(`\n#### ${j.title} (${j.id}) — ${j.priority}`);
			lines.push(`**Persona:** ${j.personaId}`);
			lines.push(`**Scenario:** ${j.scenario}`);
			if (j.steps.length) {
				lines.push('**Steps:**');
				for (const s of j.steps) {
					lines.push(`  ${s.stepNumber}. [${s.actor}] ${s.action} → ${s.expectedOutcome}`);
				}
			}
			if (j.acceptanceCriteria.length) {
				lines.push(`**Acceptance Criteria:** ${j.acceptanceCriteria.join('; ')}`);
			}
		}
	}

	// Success metrics
	if (plan.successMetrics?.length) {
		lines.push('\n### Success Metrics');
		for (const m of plan.successMetrics) { lines.push(`- ${m}`); }
	}

	// Phasing strategy
	if (plan.phasingStrategy?.length) {
		lines.push('\n### Release Phasing');
		for (const p of plan.phasingStrategy) {
			lines.push(`\n#### ${p.phase}`);
			lines.push(p.description);
			lines.push(`**Rationale:** ${p.rationale}`);
			if (p.journeyIds.length) { lines.push(`**Journeys:** ${p.journeyIds.join(', ')}`); }
		}
	}

	// UX requirements
	if (plan.uxRequirements?.length) {
		lines.push('\n### UX Requirements');
		for (const u of plan.uxRequirements) { lines.push(`- ${u}`); }
	}

	// Domain proposals
	if (plan.businessDomainProposals?.length) {
		lines.push('\n### Business Domains');
		for (const d of plan.businessDomainProposals) {
			lines.push(`\n#### ${d.name} (${d.id})`);
			lines.push(d.description);
			lines.push(`**Rationale:** ${d.rationale}`);
			if (d.entityPreview.length) { lines.push(`**Entities:** ${d.entityPreview.join(', ')}`); }
			if (d.workflowPreview.length) { lines.push(`**Workflows:** ${d.workflowPreview.join(', ')}`); }
		}
	}

	// Entity proposals
	if (plan.entityProposals?.length) {
		lines.push('\n### Data Entities');
		for (const e of plan.entityProposals) {
			lines.push(`\n#### ${e.name} (${e.id}, domain: ${e.businessDomainId})`);
			lines.push(e.description);
			if (e.keyAttributes.length) { lines.push(`**Attributes:** ${e.keyAttributes.join(', ')}`); }
			if (e.relationships.length) { lines.push(`**Relationships:** ${e.relationships.join('; ')}`); }
		}
	}

	// Workflow proposals
	if (plan.workflowProposals?.length) {
		lines.push('\n### System Workflows');
		for (const w of plan.workflowProposals) {
			lines.push(`\n#### ${w.name} (${w.id}, domain: ${w.businessDomainId})`);
			lines.push(w.description);
			if (w.triggers.length) { lines.push(`**Triggers:** ${w.triggers.join(', ')}`); }
			if (w.actors.length) { lines.push(`**Actors:** ${w.actors.join(', ')}`); }
			if (w.steps.length) {
				lines.push('**Steps:**');
				for (let i = 0; i < w.steps.length; i++) {
					lines.push(`  ${i + 1}. ${w.steps[i]}`);
				}
			}
		}
	}

	// Integration proposals
	if (plan.integrationProposals?.length) {
		lines.push('\n### External Integrations');
		for (const ig of plan.integrationProposals) {
			lines.push(`\n#### ${ig.name} (${ig.id}, category: ${ig.category})`);
			lines.push(ig.description);
		}
	}

	// Quality attributes
	if (plan.qualityAttributes?.length) {
		lines.push('\n### Quality Attributes');
		for (const q of plan.qualityAttributes) { lines.push(`- ${q}`); }
	}

	return lines.join('\n');
}

function assembleArchitectureDocument(dialogueId: string): string | null {
	const result = getArchitectureDocumentForDialogue(dialogueId);
	if (!result.success || !result.value) { return null; }

	const doc: ArchitectureDocument = result.value;
	const lines: string[] = ['## Architecture Document'];
	lines.push('');
	lines.push(`**Status:** ${doc.status}`);
	if (doc.goal_alignment_score !== null) {
		lines.push(`**Goal Alignment Score:** ${doc.goal_alignment_score}`);
	}

	// Capabilities
	if (doc.capabilities?.length) {
		lines.push('\n### Capabilities');
		for (const c of doc.capabilities) {
			lines.push(`- **${c.label}** (${c.capability_id}): ${c.description}`);
		}
	}

	// Workflow graph
	if (doc.workflow_graph?.length) {
		lines.push('\n### Workflow Graph');
		for (const w of doc.workflow_graph) {
			lines.push(`- **${w.label}** (${w.workflow_id}): ${w.steps?.length ?? 0} steps`);
		}
	}

	// Components
	if (doc.components?.length) {
		lines.push('\n### Components');
		for (const comp of doc.components) {
			lines.push(`- **${comp.label}** (${comp.component_id}): ${comp.responsibility}`);
			if (comp.technology_notes) { lines.push(`  Tech: ${comp.technology_notes}`); }
		}
	}

	// Data models
	if (doc.data_models?.length) {
		lines.push('\n### Data Models');
		for (const dm of doc.data_models) {
			lines.push(`- **${dm.entity_name}** (${dm.model_id}): ${dm.fields?.length ?? 0} fields`);
		}
	}

	// Interfaces
	if (doc.interfaces?.length) {
		lines.push('\n### Interfaces');
		for (const iface of doc.interfaces) {
			lines.push(`- **${iface.label}** (${iface.interface_id}): ${iface.type} — ${iface.description}`);
		}
	}

	// Implementation sequence
	if (doc.implementation_sequence?.length) {
		lines.push('\n### Implementation Sequence');
		for (const step of doc.implementation_sequence) {
			lines.push(`${step.sort_order}. **${step.label}**: ${step.description}`);
		}
	}

	// Validation findings
	if (doc.validation_findings?.length) {
		lines.push('\n### Validation Findings');
		for (const f of doc.validation_findings) { lines.push(`- ${f}`); }
	}

	return lines.join('\n');
}

function assembleClaimsAndVerdicts(dialogueId: string): string | null {
	const claimsResult = getClaims({ dialogue_id: dialogueId });
	if (!claimsResult.success || !claimsResult.value.length) { return null; }

	const claims: Claim[] = claimsResult.value;
	const verdictsResult = getVerdicts();
	const verdicts: Verdict[] = verdictsResult.success ? verdictsResult.value : [];

	// Build verdict lookup by claim_id
	const verdictMap = new Map<string, Verdict[]>();
	for (const v of verdicts) {
		const list = verdictMap.get(v.claim_id) ?? [];
		list.push(v);
		verdictMap.set(v.claim_id, list);
	}

	const lines: string[] = ['## Claims & Verdicts'];
	lines.push('');
	lines.push(`Total claims: ${claims.length}, Total verdicts: ${verdicts.length}`);
	lines.push('');
	lines.push('| Claim ID | Statement | Status | Criticality | Verdict |');
	lines.push('|----------|-----------|--------|-------------|---------|');

	for (const c of claims) {
		const stmt = c.statement.replaceAll('\n', ' ').substring(0, 80);
		const cv = verdictMap.get(c.claim_id);
		const latestVerdict = cv?.length ? cv[cv.length - 1].verdict : '—';
		lines.push(`| ${c.claim_id.substring(0, 8)}… | ${stmt} | ${c.status} | ${c.criticality} | ${latestVerdict} |`);
	}

	return lines.join('\n');
}

function assembleTaskGraph(dialogueId: string): string | null {
	const graphResult = getTaskGraphForDialogue(dialogueId);
	if (!graphResult.success || !graphResult.value) { return null; }

	const graph = graphResult.value;
	const unitsResult = getTaskUnitsForGraph(graph.graph_id);
	if (!unitsResult.success || !unitsResult.value.length) { return null; }

	const units = unitsResult.value;
	const lines: string[] = ['## Task Graph'];
	lines.push('');
	lines.push(`**Graph ID:** ${graph.graph_id}`);
	lines.push(`**Status:** ${graph.graph_status}`);
	lines.push(`**Units:** ${units.length}`);
	lines.push('');
	lines.push('| Unit ID | Label | Status | Type |');
	lines.push('|---------|-------|--------|------|');

	for (const u of units) {
			lines.push(`| ${u.unit_id.substring(0, 8)}… | ${u.label} | ${u.status} | — |`);
	}

	return lines.join('\n');
}
