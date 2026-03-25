/**
 * Mirror & Menu Protocol (MMP) Types
 *
 * Defines the data structures for the MMP interaction pattern that replaces
 * open-ended questions with structured assumptions (Mirror) and decision
 * options (Menu) for human judgment.
 *
 * Core principle: "The Human never writes the spec; the Human only judges the spec."
 * Agents do the articulation work (generating Mirrors and Menus) so the
 * Human can stay in the judgment zone (selecting and approving).
 */

// ==================== MIRROR ====================

/** Category of a mirror assumption */
export type MirrorCategory =
	| 'intent' | 'scope' | 'constraint' | 'priority' | 'anti-goal'
	| 'persona' | 'journey' | 'ux'
	| 'domain' | 'workflow' | 'entity' | 'integration';

/** Status of a mirror item after human judgment */
export type MirrorStatus = 'pending' | 'accepted' | 'rejected' | 'edited' | 'deferred';

/**
 * A single assumption the agent makes about user intent.
 * The human judges it: accept, reject, or edit.
 */
export interface MirrorItem {
	/** Unique identifier, e.g., "MIR-1" */
	id: string;
	/** The assumption statement */
	text: string;
	/** What kind of assumption this is */
	category: MirrorCategory;
	/** Why the agent believes this assumption */
	rationale: string;
	/** What the user does NOT want (for anti-goal items) */
	antiGoal?: string;
	/** Human's judgment */
	status: MirrorStatus;
	/** If human edited the assumption, their corrected text */
	editedText?: string;
	/** Provenance: where this item originated (document-specified, ai-proposed, etc.) */
	source?: string;
}

/**
 * A "Steel Man" projection: the agent's best understanding
 * of what the user wants, presented for confirmation.
 */
export interface MirrorCard {
	/** Overall summary of the agent's understanding */
	steelMan: string;
	/** Individual assumptions to accept/reject */
	items: MirrorItem[];
}

// ==================== MENU ====================

/**
 * A single option within a decision point.
 */
export interface MenuOption {
	/** Unique identifier within the menu item, e.g., "MENU-1-A" */
	optionId: string;
	/** Short label for the option */
	label: string;
	/** Full description of what this option means */
	description: string;
	/** Consequences of choosing this option */
	tradeoffs: string;
	/** Whether the agent recommends this option (at most one per MenuItem) */
	recommended?: boolean;
}

/**
 * A decision point where the human must choose between
 * concrete options with articulated trade-offs.
 */
export interface MenuItem {
	/** Unique identifier, e.g., "MENU-1" */
	id: string;
	/** The decision to make */
	question: string;
	/** Why this decision matters */
	context?: string;
	/** 2-3 concrete options (plus implicit "Other") */
	options: MenuOption[];
	/** Which option the human selected */
	selectedOptionId?: string;
	/** Free-text response if user picked "Other" */
	customResponse?: string;
}

/**
 * A set of decision points for the human to resolve.
 */
export interface MenuCard {
	items: MenuItem[];
}

// ==================== PRE-MORTEM ====================

/** Severity of a risk */
export type PreMortemSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Status of a pre-mortem item after human judgment */
export type PreMortemStatus = 'pending' | 'accepted' | 'rejected';

/**
 * A risk or failure scenario surfaced proactively.
 * The human acknowledges the risk (accept) or flags it as unacceptable (reject).
 */
export interface PreMortemItem {
	/** Unique identifier, e.g., "RISK-1" */
	id: string;
	/** The assumption that could fail */
	assumption: string;
	/** What happens if the assumption fails */
	failureScenario: string;
	/** How severe the failure would be */
	severity: PreMortemSeverity;
	/** Suggested way to mitigate the risk */
	mitigation?: string;
	/** Human's judgment: accept risk or reject */
	status: PreMortemStatus;
	/** Human's rationale for their decision */
	rationale?: string;
}

/**
 * A set of risks and failure scenarios for the human to evaluate.
 */
export interface PreMortemCard {
	/** Brief context for the risk assessment */
	summary: string;
	/** Individual risks to accept/reject */
	items: PreMortemItem[];
}

// ==================== COMPOSITE ====================

/**
 * The full MMP payload: structured output that replaces suggestedQuestions.
 * Any combination of Mirror, Menu, and Pre-Mortem cards may be present.
 */
export interface MMPPayload {
	mirror?: MirrorCard;
	menu?: MenuCard;
	preMortem?: PreMortemCard;
}

/**
 * The human's structured response to an MMP payload.
 * Captures all judgments: mirror accept/reject/edit, menu selections, risk decisions.
 */
export interface MMPResponse {
	/** Per-mirror-item decisions */
	mirrorDecisions: Record<string, { status: 'accepted' | 'rejected' | 'edited'; editedText?: string }>;
	/** Per-menu-item selections */
	menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>;
	/** Per-pre-mortem-item decisions */
	preMortemDecisions: Record<string, { status: 'accepted' | 'rejected'; rationale?: string }>;
	/** Any additional free-text notes from the human */
	additionalNotes?: string;
}

// ==================== HISTORY ====================

/**
 * A single MMP round in a conversation's history.
 * Tracks what the agent proposed and how the human responded.
 */
export interface MMPHistoryEntry {
	turnNumber: number;
	payload: MMPPayload;
	response: MMPResponse;
}
