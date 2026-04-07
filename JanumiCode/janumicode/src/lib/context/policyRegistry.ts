/**
 * Context Policy Registry
 *
 * Declarative policies defining the situational awareness required for each
 * Role/Phase/SubPhase/Intent combination. The Context Engineer consults these
 * policies to decide what data to include in each agent invocation.
 *
 * No token budgets, no shedding, no truncation: every block whose data is
 * available MUST appear in the briefing. Completeness is the goal.
 *
 * Lookup: exact match → role:phase:* → role:*:*:* fallback chain.
 */

import { Role, Phase } from '../types';
import { HandoffDocType } from './engineTypes';
import type { ContextPolicy, ContextBlockSpec } from './engineTypes';

// ==================== REUSABLE BLOCK SPECS ====================

const APPROVED_PLAN_FULL: ContextBlockSpec = {
	blockId: 'approved_plan',
	label: 'Approved Intake Plan (include the entire finalizedPlan content verbatim — every field, every array element)',
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
	source: 'static',
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

/** Validation findings passed via extras during fast-loop repair (not from DB). */
const VALIDATION_FINDINGS_STATIC: ContextBlockSpec = {
	blockId: 'validation_findings',
	label: 'Architecture Validation Findings',
	source: 'static',
};

const HUMAN_FEEDBACK: ContextBlockSpec = {
	blockId: 'human_feedback',
	label: 'Human Feedback on Architecture',
	source: 'db_query',
	queryHint: 'human_decisions WHERE phase = ARCHITECTURE — most recent feedback',
};

/** Human feedback passed via extras during fast-loop repair (not from DB). */
const HUMAN_FEEDBACK_STATIC: ContextBlockSpec = {
	blockId: 'human_feedback',
	label: 'Human Feedback on Architecture',
	source: 'static',
};

// ── Proposer-artifact blocks (user-validated INTAKE outputs, passed via extras) ──
//
// These five blocks are the user-validated foundation that downstream architecture
// sub-phases MUST honor. They are passed as extras by the architecture phase code
// (see roles/architectureExpert.ts) and the Context Engineer is required to include
// every entry of every list verbatim.

const BUSINESS_DOMAIN_PROPOSALS: ContextBlockSpec = {
	blockId: 'business_domain_proposals',
	label: 'User-Validated Business Domains (PRIMARY source for capability grouping — every entry MUST appear in your briefing)',
	source: 'static',
};

const WORKFLOW_PROPOSALS: ContextBlockSpec = {
	blockId: 'workflow_proposals',
	label: 'User-Validated Workflow Proposals (PRIMARY source for workflows — every entry MUST appear in your briefing)',
	source: 'static',
};

const ENTITY_PROPOSALS: ContextBlockSpec = {
	blockId: 'entity_proposals',
	label: 'User-Validated Entity Proposals (every entry MUST appear in your briefing)',
	source: 'static',
};

const USER_JOURNEYS: ContextBlockSpec = {
	blockId: 'user_journeys',
	label: 'User-Validated User Journeys (every entry MUST appear in your briefing)',
	source: 'static',
};

const PHASING_STRATEGY: ContextBlockSpec = {
	blockId: 'phasing_strategy',
	label: 'User-Defined Implementation Phasing Strategy (include verbatim)',
	source: 'static',
};

const INTEGRATION_PROPOSALS: ContextBlockSpec = {
	blockId: 'integration_proposals',
	label: 'User-Validated Integration Proposals (every entry MUST appear in your briefing)',
	source: 'static',
};

const PERSONAS: ContextBlockSpec = {
	blockId: 'personas',
	label: 'User-Validated Personas (include verbatim)',
	source: 'static',
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
		version: 4,
		requiredBlocks: [
			APPROVED_PLAN_FULL,
			BUSINESS_DOMAIN_PROPOSALS,
			WORKFLOW_PROPOSALS,
			ENTITY_PROPOSALS,
			USER_JOURNEYS,
			PHASING_STRATEGY,
			DOMAIN_COVERAGE,
			CONSTRAINTS,
		],
		optionalBlocks: [
			INTEGRATION_PROPOSALS,
			PERSONAS,
			HISTORICAL_FINDINGS,
			HUMAN_CORRECTIONS,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:MODELING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'MODELING',
		intent: '*',
		version: 4,
		requiredBlocks: [
			{
				blockId: 'capabilities',
				label: 'Capabilities & Workflows (from prior DECOMPOSING pass)',
				source: 'static',
			},
			APPROVED_PLAN_FULL,
			BUSINESS_DOMAIN_PROPOSALS,
			ENTITY_PROPOSALS,
			WORKFLOW_PROPOSALS,
		],
		optionalBlocks: [
			USER_JOURNEYS,
			INTEGRATION_PROPOSALS,
			WORKSPACE_SPECS,
			VALIDATION_FINDINGS_STATIC,
			HUMAN_FEEDBACK_STATIC,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:DESIGNING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'DESIGNING',
		intent: '*',
		version: 4,
		requiredBlocks: [
			{
				blockId: 'capabilities',
				label: 'Capabilities & Workflows (from prior DECOMPOSING pass)',
				source: 'static',
			},
			{
				blockId: 'domain_model',
				label: 'Domain Model (from prior MODELING pass)',
				source: 'static',
			},
			{
				blockId: 'decomposition_config',
				label: 'Decomposition Configuration',
				source: 'static',
			},
			APPROVED_PLAN_FULL,
			BUSINESS_DOMAIN_PROPOSALS,
			WORKFLOW_PROPOSALS,
			ENTITY_PROPOSALS,
			USER_JOURNEYS,
			INTEGRATION_PROPOSALS,
		],
		optionalBlocks: [
			PHASING_STRATEGY,
			PERSONAS,
			{
				blockId: 'constraints_and_decisions',
				label: 'Constraints & Decisions (from Intake)',
				source: 'static',
			},
			VALIDATION_FINDINGS,
			HUMAN_FEEDBACK,
			WORKSPACE_SPECS,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:ARCHITECTURE:SEQUENCING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.ARCHITECTURE,
		subPhase: 'SEQUENCING',
		intent: '*',
		version: 4,
		requiredBlocks: [
			{
				blockId: 'components',
				label: 'Components & Dependencies (from prior DESIGNING pass)',
				source: 'static',
			},
			{
				blockId: 'interfaces',
				label: 'Interface Contracts (from prior DESIGNING pass)',
				source: 'static',
			},
			{
				blockId: 'domain_model',
				label: 'Domain Model Summary',
				source: 'static',
			},
			PHASING_STRATEGY,
		],
		optionalBlocks: [
			{ blockId: 'workspace_patterns', label: 'Workspace Build Patterns', source: 'static' },
			VALIDATION_FINDINGS_STATIC,
			HUMAN_FEEDBACK_STATIC,
		],
	},

	// ── EXECUTOR ──

	{
		policyKey: 'EXECUTOR:EXECUTE:*:*',
		role: Role.EXECUTOR,
		phase: Phase.EXECUTE,
		subPhase: '*',
		intent: '*',
		version: 3,
		requiredBlocks: [
			GOAL,
			CONSTRAINTS,
			ARCHITECTURE_DOC,
			ACTIVE_CLAIMS,
		],
		optionalBlocks: [
			HISTORICAL_VERDICTS,
			HISTORICAL_FINDINGS,
			NARRATIVE_MEMORY,
			WORKSPACE_SPECS,
		],
	},

	{
		policyKey: 'EXECUTOR:EXECUTE:*:MAKER_PLANNER',
		role: Role.EXECUTOR,
		phase: Phase.EXECUTE,
		subPhase: '*',
		intent: 'MAKER_PLANNER',
		version: 2,
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
	},

	// ── VERIFIER ──

	{
		policyKey: 'VERIFIER:VERIFY:*:*',
		role: Role.VERIFIER,
		phase: Phase.VERIFY,
		subPhase: '*',
		intent: '*',
		version: 2,
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
	},

	// ── HISTORIAN ──

	{
		policyKey: 'HISTORIAN:HISTORICAL_CHECK:*:*',
		role: Role.HISTORIAN,
		phase: Phase.HISTORICAL_CHECK,
		subPhase: '*',
		intent: '*',
		version: 3,
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
			CONSTRAINTS,
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
	},

	{
		policyKey: 'HISTORIAN:HISTORICAL_CHECK:ADJUDICATION:*',
		role: Role.HISTORIAN,
		phase: Phase.HISTORICAL_CHECK,
		subPhase: 'ADJUDICATION',
		intent: '*',
		version: 3,
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
			CONSTRAINTS,
		],
		optionalBlocks: [
			{
				blockId: 'historical_precedents',
				label: 'Historical Adjudication Precedents',
				source: 'db_query',
				queryHint: 'prior adjudication decisions from narrative_memories',
			},
		],
	},

	// ── INTAKE (Technical Expert in INTAKE phase) ──

	{
		policyKey: 'TECHNICAL_EXPERT:INTAKE:*:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.INTAKE,
		subPhase: '*',
		intent: '*',
		version: 3,
		requiredBlocks: [
			{
				blockId: 'conversation_history',
				label: 'Intake Conversation History',
				source: 'db_query',
				queryHint: 'intake_conversations + dialogue_events — all turns with full content',
			},
			{
				blockId: 'current_plan',
				label: 'Current Plan Document',
				source: 'static',
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
	},

	// ── TECHNICAL_EXPERT: VALIDATE phase (Deep Validation Review) ──

	{
		policyKey: 'TECHNICAL_EXPERT:VALIDATE:HYPOTHESIZING:security',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.VALIDATE,
		subPhase: 'HYPOTHESIZING',
		intent: 'security',
		version: 2,
		requiredBlocks: [
			{
				blockId: 'source_context',
				label: 'Source Files & Workspace Structure',
				source: 'static',
			},
		],
		optionalBlocks: [
			ARCHITECTURE_DOC,
			GOAL,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:VALIDATE:HYPOTHESIZING:logic',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.VALIDATE,
		subPhase: 'HYPOTHESIZING',
		intent: 'logic',
		version: 2,
		requiredBlocks: [
			{
				blockId: 'source_context',
				label: 'Source Files & Workspace Structure',
				source: 'static',
			},
		],
		optionalBlocks: [
			ARCHITECTURE_DOC,
			GOAL,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:VALIDATE:HYPOTHESIZING:best_practices',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.VALIDATE,
		subPhase: 'HYPOTHESIZING',
		intent: 'best_practices',
		version: 2,
		requiredBlocks: [
			{
				blockId: 'source_context',
				label: 'Source Files & Workspace Structure',
				source: 'static',
			},
		],
		optionalBlocks: [
			ARCHITECTURE_DOC,
			GOAL,
		],
	},

	{
		policyKey: 'TECHNICAL_EXPERT:VALIDATE:GRADING:*',
		role: Role.TECHNICAL_EXPERT,
		phase: Phase.VALIDATE,
		subPhase: 'GRADING',
		intent: '*',
		version: 2,
		requiredBlocks: [
			{
				blockId: 'validated_hypotheses',
				label: 'Validated Hypotheses',
				source: 'static',
			},
		],
		optionalBlocks: [
			GOAL,
		],
	},

	// ── TECHNICAL_EXPERT fallback (general questions) ──

	{
		policyKey: 'TECHNICAL_EXPERT:*:*:*',
		role: Role.TECHNICAL_EXPERT,
		phase: '*',
		subPhase: '*',
		intent: '*',
		version: 3,
		requiredBlocks: [
			GOAL,
			{
				blockId: 'question',
				label: 'Target Question',
				source: 'static',
			},
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
			WORKSPACE_SPECS,
			ARCHITECTURE_DOC,
		],
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
