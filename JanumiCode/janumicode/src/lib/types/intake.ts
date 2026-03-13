/**
 * INTAKE Phase Types
 * Defines types for the conversational planning phase where Human and Technical Expert
 * collaborate to produce a structured implementation plan.
 */

// ==================== ENUMS ====================

/**
 * INTAKE sub-states for the internal state machine within the INTAKE phase.
 * The orchestrator uses these to determine which action to take on each
 * advanceWorkflow() call during INTAKE.
 */
export enum IntakeSubState {
	// === Legacy / HYBRID_CHECKPOINTS flow (unchanged) ===
	/** Expert is gathering domain-by-domain info as interviewer (no plan output) */
	GATHERING = 'GATHERING',
	/** Human and Technical Expert are actively discussing requirements */
	DISCUSSING = 'DISCUSSING',
	/** Technical Expert is synthesizing the conversation into a final plan */
	SYNTHESIZING = 'SYNTHESIZING',
	/** Final plan produced, awaiting Human approval */
	AWAITING_APPROVAL = 'AWAITING_APPROVAL',

	// === Inverted flow (STATE_DRIVEN + DOMAIN_GUIDED) ===
	/** Expert silently analyzes docs, codebase, and user prompt. No user interaction. */
	ANALYZING = 'ANALYZING',
	/** Expert presents comprehensive technical approach. User reads and responds. */
	PROPOSING = 'PROPOSING',
	/** Expert asks ONLY business gaps + significant tradeoffs. Max 2 rounds. */
	CLARIFYING = 'CLARIFYING',
}

/**
 * Adaptive INTAKE mode — determines how the DISCUSSING sub-state operates.
 * All three modes layer WITHIN the existing DISCUSSING → SYNTHESIZING → AWAITING_APPROVAL
 * state machine; they change *how* each DISCUSSING turn is processed.
 */
export enum IntakeMode {
	/** Sequential walk through 12 engineering domains. Best for vague, high-level inputs. */
	STATE_DRIVEN = 'STATE_DRIVEN',
	/** Pre-fill from documents, free-form with gap tracking. Best for rich inputs with docs. */
	DOMAIN_GUIDED = 'DOMAIN_GUIDED',
	/** Free-form with periodic coverage checkpoint cards. Default mode. */
	HYBRID_CHECKPOINTS = 'HYBRID_CHECKPOINTS',
}

/**
 * The 12 engineering domains that systematic INTAKE coverage tracks.
 */
export enum EngineeringDomain {
	PROBLEM_MISSION = 'PROBLEM_MISSION',
	STAKEHOLDERS = 'STAKEHOLDERS',
	SCOPE = 'SCOPE',
	CAPABILITIES = 'CAPABILITIES',
	WORKFLOWS_USE_CASES = 'WORKFLOWS_USE_CASES',
	DATA_INFORMATION = 'DATA_INFORMATION',
	ENVIRONMENT_OPERATIONS = 'ENVIRONMENT_OPERATIONS',
	QUALITY_ATTRIBUTES = 'QUALITY_ATTRIBUTES',
	SECURITY_COMPLIANCE = 'SECURITY_COMPLIANCE',
	INTEGRATION_INTERFACES = 'INTEGRATION_INTERFACES',
	ARCHITECTURE = 'ARCHITECTURE',
	VERIFICATION_DELIVERY = 'VERIFICATION_DELIVERY',
}

/**
 * Coverage level for each engineering domain.
 */
export enum DomainCoverageLevel {
	/** Domain has not been discussed at all */
	NONE = 'NONE',
	/** Domain mentioned but not adequately explored */
	PARTIAL = 'PARTIAL',
	/** Domain sufficiently covered with evidence */
	ADEQUATE = 'ADEQUATE',
}

// ==================== DOMAIN COVERAGE ====================

/**
 * Coverage tracking entry for a single engineering domain.
 */
export interface DomainCoverageEntry {
	domain: EngineeringDomain;
	level: DomainCoverageLevel;
	/** Text snippets that contributed to coverage */
	evidence: string[];
	/** Turn numbers where this domain was discussed */
	turnNumbers: number[];
}

/**
 * Complete coverage map across all 12 engineering domains.
 */
export type DomainCoverageMap = Record<EngineeringDomain, DomainCoverageEntry>;

/**
 * Input classifier's recommendation for which INTAKE mode to use.
 */
export interface IntakeModeRecommendation {
	recommended: IntakeMode;
	/** 0.0 to 1.0 confidence score */
	confidence: number;
	/** Human-readable explanation of why this mode was chosen */
	rationale: string;
}

/**
 * A coverage checkpoint triggered during INTAKE conversation.
 * Used by HYBRID_CHECKPOINTS (periodic) and DOMAIN_GUIDED (post-analysis).
 */
export interface IntakeCheckpoint {
	/** The turn number when this checkpoint was triggered */
	turnNumber: number;
	/** Coverage snapshot at checkpoint time */
	coverageSnapshot: DomainCoverageMap;
	/** Domains the checkpoint suggests exploring next */
	suggestedDomains: EngineeringDomain[];
	/** When true, the checkpoint offers mode-switching to fill coverage gaps */
	offerModeSwitch?: boolean;
}

/**
 * Types of items extracted from the INTAKE conversation into structured plan sections
 */
export type IntakeExtractedItemType =
	| 'REQUIREMENT'
	| 'DECISION'
	| 'CONSTRAINT'
	| 'OPEN_QUESTION';

// ==================== PLAN DOCUMENT ====================

/**
 * An item extracted from conversation and categorized into a plan section.
 * Items are accumulated across turns and carried forward in the draft plan.
 */
export interface IntakeExtractedItem {
	/** Unique identifier (e.g., REQ-1, DEC-1, CON-1, Q-1) */
	id: string;
	/** Category of this item */
	type: IntakeExtractedItemType;
	/** The extracted text */
	text: string;
	/** The conversation turn where this was first identified */
	extractedFromTurnId: number;
	/** ISO-8601 timestamp of extraction */
	timestamp: string;
}

/**
 * The structured plan document that evolves through the INTAKE conversation.
 * The Technical Expert produces an updated version alongside each conversational response.
 * Version is incremented with each turn.
 */
export interface IntakePlanDocument {
	/** Monotonically increasing version number */
	version: number;
	/** Short title for the plan */
	title: string;
	/** Executive summary of what is being built */
	summary: string;
	/** Business and technical requirements gathered from conversation */
	requirements: IntakeExtractedItem[];
	/** Decisions made during the conversation */
	decisions: IntakeExtractedItem[];
	/** Technical and business constraints identified */
	constraints: IntakeExtractedItem[];
	/** Questions that remain unanswered (should be empty when finalized) */
	openQuestions: IntakeExtractedItem[];
	/** Technical observations from codebase investigation */
	technicalNotes: string[];
	/** High-level implementation approach based on discussion */
	proposedApproach: string;
	/** ISO-8601 timestamp of last update */
	lastUpdatedAt: string;
}

// ==================== CONVERSATION TYPES ====================

/**
 * Technical Expert response during an INTAKE conversation turn.
 * Contains both the conversational chat message and the updated plan.
 */
export interface IntakeTurnResponse {
	/** Natural language response to display in the chat UI */
	conversationalResponse: string;
	/** Updated draft plan reflecting this turn's discussion */
	updatedPlan: IntakePlanDocument;
	/** Questions the Expert suggests the Human consider next */
	suggestedQuestions?: string[];
	/** Files or patterns the Expert found during codebase investigation */
	codebaseFindings?: string[];
}

/**
 * Technical Expert response during an INTAKE gathering turn.
 * The Expert acts as a domain interviewer — no plan output, just focused Q&A.
 */
export interface IntakeGatheringTurnResponse {
	/** Interviewer-style conversational response scoped to one domain */
	conversationalResponse: string;
	/** The domain this turn focused on */
	focusDomain: EngineeringDomain;
	/** Structured notes extracted from this domain investigation */
	domainNotes: string[];
	/** Codebase findings specific to this domain */
	codebaseFindings?: string[];
	/** Follow-up questions for the user about this domain */
	followUpQuestions?: string[];
}

/**
 * Technical Expert response during the ANALYZING sub-state.
 * Expert produces a comprehensive analysis summary + initial draft plan.
 * NO questions to the user — this is a silent analysis phase.
 */
export interface IntakeAnalysisTurnResponse {
	/** Comprehensive analysis summary (the "homework report") */
	analysisSummary: string;
	/** Initial draft plan seeded from analysis */
	initialPlan: IntakePlanDocument;
	/** Files and patterns discovered during analysis */
	codebaseFindings: string[];
	/** Per-domain coverage assessment from analysis */
	domainAssessment: Array<{
		domain: string;
		level: string;
		evidence: string;
	}>;
}

/**
 * Type guard to distinguish gathering responses from discussion responses.
 */
export function isGatheringResponse(
	response: IntakeTurnResponse | IntakeGatheringTurnResponse,
): response is IntakeGatheringTurnResponse {
	return 'focusDomain' in response && !('updatedPlan' in response);
}

/**
 * Type guard to identify analysis responses.
 */
export function isAnalysisResponse(
	response: IntakeTurnResponse | IntakeGatheringTurnResponse | IntakeAnalysisTurnResponse,
): response is IntakeAnalysisTurnResponse {
	return 'analysisSummary' in response && 'initialPlan' in response;
}

/**
 * Structured accumulation record for summarizing older conversation turns.
 * When turns fall outside the sliding context window, they are condensed
 * into these records to manage token budget.
 */
export interface IntakeAccumulation {
	/** Range of turn numbers that were summarized [from, to] inclusive */
	summarizedTurnRange: [number, number];
	/** Condensed summary of the conversation in this range */
	summary: string;
	/** Items extracted from the summarized turns */
	extractedItems: IntakeExtractedItem[];
	/** Approximate token count of this accumulation */
	tokenCount: number;
	/** ISO-8601 timestamp of when this accumulation was created */
	timestamp: string;
}

// ==================== CONVERSATION STATE ====================

/**
 * Complete state of an INTAKE conversation, persisted in the intake_conversations table.
 * One record per dialogue.
 */
export interface IntakeConversationState {
	/** Auto-increment row ID */
	id: number;
	/** The dialogue this conversation belongs to */
	dialogueId: string;
	/** Current sub-state of the INTAKE phase */
	subState: IntakeSubState;
	/** Number of completed conversation turns */
	turnCount: number;
	/** Current draft plan (updated each turn) */
	draftPlan: IntakePlanDocument;
	/** Accumulated summaries of older conversation turns */
	accumulations: IntakeAccumulation[];
	/** The finalized plan (set during SYNTHESIZING, null during DISCUSSING) */
	finalizedPlan: IntakePlanDocument | null;
	/** ISO-8601 creation timestamp */
	createdAt: string;
	/** ISO-8601 last update timestamp */
	updatedAt: string;

	// ===== Adaptive Deep INTAKE fields (V15) =====

	/** Selected INTAKE mode (null = legacy/pre-V15 conversation) */
	intakeMode: IntakeMode | null;
	/** Per-domain coverage tracking (null = not initialized) */
	domainCoverage: DomainCoverageMap | null;
	/** Current domain being explored in STATE_DRIVEN mode */
	currentDomain: EngineeringDomain | null;
	/** Coverage checkpoints triggered during HYBRID_CHECKPOINTS mode */
	checkpoints: IntakeCheckpoint[];
	/** Input classifier's recommendation (stored for audit/display) */
	classifierResult: IntakeModeRecommendation | null;

	// ===== Inverted flow fields (V17) =====

	/** Current clarification round (0 = not started, 1 = first round, 2 = second/final round) */
	clarificationRound: number;
}

/**
 * A single INTAKE conversation turn record, persisted in the intake_turns table.
 * Stores the paired human message + expert response + plan snapshot.
 * During GATHERING, expertResponse is IntakeGatheringTurnResponse and planSnapshot is null.
 */
export interface IntakeConversationTurn {
	/** Auto-increment row ID */
	id: number;
	/** The dialogue this turn belongs to */
	dialogueId: string;
	/** Sequential turn number within the INTAKE conversation */
	turnNumber: number;
	/** The Human's message for this turn */
	humanMessage: string;
	/** The Technical Expert's full response (discussion, gathering, or analysis format) */
	expertResponse: IntakeTurnResponse | IntakeGatheringTurnResponse | IntakeAnalysisTurnResponse;
	/** Snapshot of the plan at this point (null during gathering) */
	planSnapshot: IntakePlanDocument | null;
	/** Approximate token count of this turn's content */
	tokenCount: number;
	/** ISO-8601 creation timestamp */
	createdAt: string;
	/** Whether this is a gathering turn (vs. discussion turn) */
	isGathering?: boolean;
}

// ==================== DEFAULT FACTORIES ====================

/**
 * Create an empty IntakePlanDocument for a new conversation
 */
export function createEmptyPlanDocument(): IntakePlanDocument {
	return {
		version: 0,
		title: '',
		summary: '',
		requirements: [],
		decisions: [],
		constraints: [],
		openQuestions: [],
		technicalNotes: [],
		proposedApproach: '',
		lastUpdatedAt: new Date().toISOString(),
	};
}
