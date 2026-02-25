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
	/** Human and Technical Expert are actively discussing requirements */
	DISCUSSING = 'DISCUSSING',
	/** Technical Expert is synthesizing the conversation into a final plan */
	SYNTHESIZING = 'SYNTHESIZING',
	/** Final plan produced, awaiting Human approval */
	AWAITING_APPROVAL = 'AWAITING_APPROVAL',
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
}

/**
 * A single INTAKE conversation turn record, persisted in the intake_turns table.
 * Stores the paired human message + expert response + plan snapshot.
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
	/** The Technical Expert's full response (JSON: IntakeTurnResponse) */
	expertResponse: IntakeTurnResponse;
	/** Snapshot of the plan at this point (JSON: IntakePlanDocument) */
	planSnapshot: IntakePlanDocument;
	/** Approximate token count of this turn's content */
	tokenCount: number;
	/** ISO-8601 creation timestamp */
	createdAt: string;
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
