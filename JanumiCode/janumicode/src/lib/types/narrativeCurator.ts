/**
 * Narrative Curator Type Definitions
 * Types for the structured memory artifacts produced by the Narrative Curator.
 * The Curator runs as a quick step (like the Evaluator) within existing phases,
 * producing narrative memories, decision traces, and open loops.
 */

/**
 * When the Curator runs — determines what kind of snapshot to produce
 */
export enum CurationMode {
	/** Post-plan-approval snapshot: captures intent, deliberation, and planning */
	INTENT = 'INTENT',
	/** Post-execution snapshot: captures full lifecycle from intent through results */
	OUTCOME = 'OUTCOME',
	/** Lightweight failure trace on ESCALATE_* verdicts */
	FAILURE = 'FAILURE',
	/** Human feedback at a workflow gate — captures decisions, corrections, clarifications */
	FEEDBACK = 'FEEDBACK',
}

/**
 * A single causal event in the narrative sequence
 */
export interface CausalEvent {
	order: number;
	description: string;
	/** "because..." link to previous event */
	causal_link: string;
	/** "before → after" state change */
	state_change: string;
}

/**
 * Narrative Memory — causal, goal-structured story
 * (goal → obstacles → actions → outcomes → lessons)
 */
export interface NarrativeMemory {
	memory_id: string;
	dialogue_id: string;
	curation_mode: CurationMode;
	/** Who was involved and their roles */
	agent_frame: string;
	goal: string;
	causal_sequence: CausalEvent[];
	conflicts: string[];
	resolution_status: string;
	lessons: string[];
	created_at: string;
}

/**
 * A single decision point in the deliberation record
 */
export interface DecisionPoint {
	order: number;
	/** What was known at decision time */
	context_snapshot: string;
	options_considered: string[];
	selected_option: string;
	rejected_options: string[];
	rationale: string;
	confidence: 'high' | 'medium' | 'low';
	/** What would have happened if a different option was chosen */
	counterfactual: string;
}

/**
 * Decision Trace — decision-by-decision deliberation record
 */
export interface DecisionTrace {
	trace_id: string;
	dialogue_id: string;
	curation_mode: CurationMode;
	decision_points: DecisionPoint[];
	created_at: string;
}

/**
 * Open Loop categories
 */
export type OpenLoopCategory =
	| 'blocker'
	| 'deferred_decision'
	| 'missing_info'
	| 'risk'
	| 'follow_up';

/**
 * Open Loop priority levels
 */
export type OpenLoopPriority = 'high' | 'medium' | 'low';

/**
 * Open Loop — an unresolved item, deferred decision, or known unknown
 */
export interface OpenLoop {
	loop_id: string;
	dialogue_id: string;
	curation_mode: CurationMode;
	category: OpenLoopCategory;
	description: string;
	related_claim_ids: string[];
	priority: OpenLoopPriority;
	created_at: string;
}

/**
 * Parsed Narrative Curator LLM response (before IDs/metadata are added)
 */
export interface NarrativeCuratorResponse {
	narrative_memory: {
		agent_frame: string;
		goal: string;
		causal_sequence: CausalEvent[];
		conflicts: string[];
		resolution_status: string;
		lessons: string[];
	};
	decision_trace: {
		decision_points: DecisionPoint[];
	};
	open_loops: Array<{
		category: string;
		description: string;
		priority: string;
	}>;
	raw_response: string;
}
