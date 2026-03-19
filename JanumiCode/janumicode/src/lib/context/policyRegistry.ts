/**
 * Context Policy Registry
 *
 * Declarative policies defining the bounded situational awareness required
 * for each Role/Phase/SubPhase/Intent combination. The Context Engineer
 * consults these policies to decide what data to include, what to shed,
 * and what constitutes a sufficiency failure.
 *
 * Lookup: exact match → role:phase:* → role:*:*:* fallback chain.
 */

import { Role, Phase } from '../types';
import { HandoffDocType } from './engineTypes';
import type { ContextPolicy, ContextBlockSpec } from './engineTypes';

// ==================== REUSABLE BLOCK SPECS ====================

/** Common block specs reused across multiple policies. */

const APPROVED_PLAN: ContextBlockSpec = {
	blockId: 'approved_plan',
	label: 'Approved Intake Plan',
	source: 'handoff_doc',
	handoffDocType: HandoffDocType.INTAKE,
};

const CONSTRAINTS: ContextBlockSpec = {
	blockId: 'constraints',
	label: 'Constraint Manifest',
	source: 'db_query',
	queryHint: 'SELECT * FROM constraint_manifests WHERE dialogue_id = ?',
};

const GOAL: ContextBlockSpec = {
	blockId: 'goal',
	label: 'Dialogue Goal',
	source: 'db_query',
	queryHint: 'SELECT goal, title FROM dialogues WHERE dialogue_id = ?',
};

const ACTIVE_CLAIMS: ContextBlockSpec = {
	blockId: 'active_claims',
	label: 'Active Claims',
	source: 'db_query',
	queryHint: 'claims table — filter by status IN (OPEN, CONDITIONAL) and dialogue_id',
};

const HUMAN_DECISIONS: ContextBlockSpec = {
	blockId: 'human_decisions',
	label: 'Human Decisions',
	source: 'db_query',
	queryHint: 'human_decisions table — ordered by timestamp DESC',
};

const HISTORICAL_FINDINGS: ContextBlockSpec = {
	blockId: 'historical_findings',
	label: 'Historical Findings',
	source: 'db_query',
	queryHint: 'dialogue_events WHERE event_type LIKE \'%historical%\' or role = \'HISTORIAN\'',
};

const NARRATIVE_MEMORY: ContextBlockSpec = {
	blockId: 'narrative_memory',
	label: 'Narrative Memory',
	source: 'handoff_doc',
	handoffDocType: HandoffDocType.HISTORICAL,
};

const ARCHITECTURE_DOC: ContextBlockSpec = {
	blockId: 'architecture_doc',
	label: 'Architecture Document',
	source: 'handoff_doc',
	handoffDocType: HandoffDocType.ARCHITECTURE,
};

const DOMAIN_COVERAGE: ContextBlockSpec = {
	blockId: 'domain_coverage',
	label: 'Domain Coverage Analysis',
	source: 'db_query',
	queryHint: 'intake_conversations — domain_coverage field from finalized plan',
};

const HISTORICAL_VERDICTS: ContextBlockSpec = {
	blockId: 'historical_verdicts',
	label: 'Historical Verdicts',
	source: 'db_query',
	queryHint: 'verdicts JOIN claims — ordered by timestamp',
};

const WORKSPACE_SPECS: ContextBlockSpec = {
	blockId: 'workspace_specs',
	label: 'Workspace Specification Files',
	source: 'agent_synthesized',
};

const HUMAN_CORRECTIONS: ContextBlockSpec = {
	blockId: 'human_corrections',
	label: 'Human Corrections Since Approval',
	source: 'db_query',
	queryHint: 'human_decisions WHERE timestamp > last phase approval — corrections and overrides',
};

const VALIDATION_FINDINGS: ContextBlockSpec = {
	blockId: 'validation_findings',
	label: 'Architecture Validation Findings',
	source: 'db_query',
	queryHint: 'architecture phase validation findings from gate metadata',
};

const HUMAN_FEEDBACK: ContextBlockSpec = {
	blockId: 'human_feedback',
	label: 'Human Feedback on Architecture',
	source: 'db_query',
	queryHint: 'human_decisions WHERE phase = ARCHITECTURE — most recent feedback',
};

// ==================== POLICY DEFINITIONS ====================

const policies: ContextPolicy[] = [

	// ── ARCHITECTURE sub-phases ──

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:DECOMPOSING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'DECOMPOSING',
		intent: '*',
		version: 1,
		requiredBlocks: [
			APPROVED_PLAN,
			DOMAIN_COVERAGE,
			CONSTRAINTS,
		],
		optionalBlocks: [
			HISTORICAL_FINDINGS,
			HUMAN_CORRECTIONS,
		],
		sheddingPriority: ['human_corrections', 'historical_findings'],
		sectionBudgets: {
			approved_plan: 0.4,
			domain_coverage: 0.2,
			constraints: 0.15,
			historical_findings: 0.15,
			human_corrections: 0.1,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:MODELING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'MODELING',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'capabilities',
				label: 'Capabilities & Workflows',
				source: 'db_query',
				queryHint: 'architecture_documents — capabilities and workflows from latest doc',
			},
		],
		optionalBlocks: [
			{ blockId: 'plan_requirements', label: 'Plan Requirements', source: 'handoff_doc', handoffDocType: HandoffDocType.INTAKE },
		],
		sheddingPriority: ['plan_requirements'],
		sectionBudgets: {
			capabilities: 0.7,
			plan_requirements: 0.3,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:DESIGNING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'DESIGNING',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'capabilities',
				label: 'Capabilities & Workflows',
				source: 'db_query',
				queryHint: 'architecture_documents — capabilities and workflows',
			},
			{
				blockId: 'domain_model',
				label: 'Domain Model',
				source: 'db_query',
				queryHint: 'architecture_documents — domain entities, relationships, invariants',
			},
			{
				blockId: 'decomposition_config',
				label: 'Decomposition Configuration',
				source: 'db_query',
				queryHint: 'architecture_documents — decomposition constraints and config',
			},
		],
		optionalBlocks: [
			VALIDATION_FINDINGS,
			HUMAN_FEEDBACK,
			WORKSPACE_SPECS,
		],
		sheddingPriority: ['workspace_specs', 'human_feedback', 'validation_findings'],
		sectionBudgets: {
			capabilities: 0.3,
			domain_model: 0.2,
			decomposition_config: 0.1,
			validation_findings: 0.15,
			human_feedback: 0.1,
			workspace_specs: 0.15,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:SEQUENCING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'SEQUENCING',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'components',
				label: 'Components & Dependencies',
				source: 'db_query',
				queryHint: 'architecture_documents — components with dependencies',
			},
			{
				blockId: 'interfaces',
				label: 'Interface Contracts',
				source: 'db_query',
				queryHint: 'architecture_documents — interfaces with providers/consumers',
			},
			{
				blockId: 'domain_model',
				label: 'Domain Model Summary',
				source: 'db_query',
				queryHint: 'architecture_documents — entities and relationships',
			},
		],
		optionalBlocks: [
			{ blockId: 'workspace_patterns', label: 'Workspace Build Patterns', source: 'agent_synthesized' },
		],
		sheddingPriority: ['workspace_patterns'],
		sectionBudgets: {
			components: 0.35,
			interfaces: 0.25,
			domain_model: 0.2,
			workspace_patterns: 0.2,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	// ── EXECUTOR ──

	{
		policyKey: 'EXECUTOR:EXECUTE:*:*',
		role: Role.EXECUTOR,
		phase: Phase.EXECUTE,
		subPhase: '*',
		intent: '*',
		version: 1,
		requiredBlocks: [
			GOAL,
			CONSTRAINTS,
			ARCHITECTURE_DOC,
			ACTIVE_CLAIMS,
		],
		optionalBlocks: [
			HISTORICAL_FINDINGS,
			NARRATIVE_MEMORY,
			WORKSPACE_SPECS,
		],
		sheddingPriority: ['workspace_specs', 'narrative_memory', 'historical_findings'],
		sectionBudgets: {
			goal: 0.05,
			constraints: 0.1,
			architecture_doc: 0.35,
			active_claims: 0.2,
			historical_findings: 0.1,
			narrative_memory: 0.1,
			workspace_specs: 0.1,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	{
		policyKey: 'EXECUTOR:EXECUTE:*:MAKER_PLANNER',
		role: Role.EXECUTOR,
		phase: Phase.EXECUTE,
		subPhase: '*',
		intent: 'MAKER_PLANNER',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'intent_record',
				label: 'Intent Record',
				source: 'static',
			},
			{
				blockId: 'acceptance_contract',
				label: 'Acceptance Contract',
				source: 'static',
			},
			CONSTRAINTS,
		],
		optionalBlocks: [
			HISTORICAL_FINDINGS,
			{
				blockId: 'failure_motifs',
				label: 'Failure Motifs & Precedents',
				source: 'db_query',
				queryHint: 'historical_invariant_packets — failure motifs, precedent patterns, reusable subplans',
			},
		],
		sheddingPriority: ['failure_motifs', 'historical_findings'],
		sectionBudgets: {
			intent_record: 0.25,
			acceptance_contract: 0.2,
			constraints: 0.15,
			historical_findings: 0.2,
			failure_motifs: 0.2,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	// ── VERIFIER ──

	{
		policyKey: 'VERIFIER:VERIFY:*:*',
		role: Role.VERIFIER,
		phase: Phase.VERIFY,
		subPhase: '*',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'claim_to_verify',
				label: 'Claim Under Verification',
				source: 'static',
			},
			CONSTRAINTS,
			{
				blockId: 'related_evidence',
				label: 'Related Evidence & Claims',
				source: 'db_query',
				queryHint: 'claims + verdicts — related to the claim under verification',
			},
		],
		optionalBlocks: [
			HISTORICAL_VERDICTS,
			{
				blockId: 'contradictions',
				label: 'Potential Contradictions',
				source: 'agent_synthesized',
			},
		],
		sheddingPriority: ['contradictions', 'historical_verdicts'],
		sectionBudgets: {
			claim_to_verify: 0.15,
			constraints: 0.15,
			related_evidence: 0.3,
			historical_verdicts: 0.25,
			contradictions: 0.15,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	// ── HISTORIAN ──

	{
		policyKey: 'HISTORIAN:HISTORICAL_CHECK:*:*',
		role: Role.HISTORIAN,
		phase: Phase.HISTORICAL_CHECK,
		subPhase: '*',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'full_event_history',
				label: 'Full Event History',
				source: 'db_query',
				queryHint: 'dialogue_events — all events for dialogue, ordered chronologically',
			},
			{
				blockId: 'claims_with_verdicts',
				label: 'Claims with Verdicts',
				source: 'db_query',
				queryHint: 'claims LEFT JOIN verdicts — all claims with their latest verdict',
			},
			HUMAN_DECISIONS,
		],
		optionalBlocks: [
			{
				blockId: 'cross_dialogue_lessons',
				label: 'Cross-Dialogue Lessons',
				source: 'db_query',
				queryHint: 'narrative_memories + decision_traces from other dialogues',
			},
			{
				blockId: 'precedents',
				label: 'Historical Precedents',
				source: 'agent_synthesized',
			},
		],
		sheddingPriority: ['precedents', 'cross_dialogue_lessons'],
		sectionBudgets: {
			full_event_history: 0.35,
			claims_with_verdicts: 0.25,
			human_decisions: 0.15,
			cross_dialogue_lessons: 0.15,
			precedents: 0.1,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	{
		policyKey: 'HISTORIAN:HISTORICAL_CHECK:ADJUDICATION:*',
		role: Role.HISTORIAN,
		phase: Phase.HISTORICAL_CHECK,
		subPhase: 'ADJUDICATION',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'conflicting_verdicts',
				label: 'Conflicting Verdicts',
				source: 'static',
			},
			{
				blockId: 'claim_context',
				label: 'Claim Context',
				source: 'db_query',
				queryHint: 'claims + verdicts + evidence for the conflicting claims',
			},
			HUMAN_DECISIONS,
		],
		optionalBlocks: [
			{
				blockId: 'historical_precedents',
				label: 'Historical Adjudication Precedents',
				source: 'db_query',
				queryHint: 'prior adjudication decisions from narrative_memories',
			},
		],
		sheddingPriority: ['historical_precedents'],
		sectionBudgets: {
			conflicting_verdicts: 0.3,
			claim_context: 0.3,
			human_decisions: 0.2,
			historical_precedents: 0.2,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	// ── INTAKE (Technical Expert in INTAKE phase) ──

	{
		policyKey: 'TECHNICAL_EXPERT:INTAKE:*:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.INTAKE,
		subPhase: '*',
		intent: '*',
		version: 1,
		requiredBlocks: [
			{
				blockId: 'conversation_history',
				label: 'Intake Conversation History',
				source: 'db_query',
				queryHint: 'intake_conversations + dialogue_events — recent turns with full content, older turns summarized',
			},
			{
				blockId: 'current_plan',
				label: 'Current Plan Document',
				source: 'db_query',
				queryHint: 'intake_conversations — draft or finalized plan',
			},
			{
				blockId: 'human_message',
				label: 'Current Human Message',
				source: 'static',
			},
		],
		optionalBlocks: [
			{
				blockId: 'accumulation_summaries',
				label: 'Accumulation Summaries',
				source: 'db_query',
				queryHint: 'intake_conversations — prior accumulation summaries for context continuity',
			},
		],
		sheddingPriority: ['accumulation_summaries'],
		sectionBudgets: {
			conversation_history: 0.4,
			current_plan: 0.3,
			human_message: 0.15,
			accumulation_summaries: 0.15,
		},
		omissionStrategy: 'degrade_with_warning',
	},

	// ── TECHNICAL_EXPERT fallback (general questions) ──

	{
		policyKey: 'TECHNICAL_EXPERT:*:*:*',
		role: Role.TECHNICAL_EXPERT,
		phase: '*',
		subPhase: '*',
		intent: '*',
		version: 1,
		requiredBlocks: [
			GOAL,
			{
				blockId: 'related_claims',
				label: 'Related Claims',
				source: 'db_query',
				queryHint: 'claims — filtered to related claim IDs if provided',
			},
			CONSTRAINTS,
		],
		optionalBlocks: [
			{
				blockId: 'historical_evidence',
				label: 'Historical Evidence',
				source: 'db_query',
				queryHint: 'verdicts with evidence_ref — prioritized by relevance to question',
			},
		],
		sheddingPriority: ['historical_evidence'],
		sectionBudgets: {
			goal: 0.1,
			related_claims: 0.3,
			constraints: 0.2,
			historical_evidence: 0.4,
		},
		omissionStrategy: 'degrade_with_warning',
	},
];

// ==================== POLICY MAP ====================

/** All registered context policies keyed by policyKey. */
export const CONTEXT_POLICIES: ReadonlyMap<string, ContextPolicy> = new Map(
	policies.map(p => [p.policyKey, p])
);

// ==================== POLICY LOOKUP ====================

/**
 * Look up the context policy for a given role/phase/subPhase/intent.
 *
 * Fallback chain:
 * 1. Exact match: `role:phase:subPhase:intent`
 * 2. Wildcard intent: `role:phase:subPhase:*`
 * 3. Wildcard subPhase: `role:phase:*:*`
 * 4. Wildcard phase: `role:*:*:*`
 *
 * @returns The matching ContextPolicy, or null if none found.
 */
export function getPolicy(
	role: Role,
	phase: Phase,
	subPhase?: string,
	intent?: string,
): ContextPolicy | null {
	const sp = subPhase ?? '*';
	const it = intent ?? '*';

	// Try exact match first, then progressively widen
	const candidates = [
		`${role}:${phase}:${sp}:${it}`,
		`${role}:${phase}:${sp}:*`,
		`${role}:${phase}:*:*`,
		`${role}:*:*:*`,
	];

	for (const key of candidates) {
		const policy = CONTEXT_POLICIES.get(key);
		if (policy) { return policy; }
	}

	return null;
}

/**
 * Get all registered policy keys (for testing and diagnostics).
 */
export function getAllPolicyKeys(): string[] {
	return [...CONTEXT_POLICIES.keys()];
}
