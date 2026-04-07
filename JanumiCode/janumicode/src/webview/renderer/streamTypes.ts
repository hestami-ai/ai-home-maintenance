/**
 * Stream types for the webview renderer.
 * These mirror the extension-host types but are defined independently
 * so the webview bundle has no Node.js dependencies.
 */

// ==================== Enum-like constants ====================

export const Phase = {
	INTAKE: 'INTAKE',
	ARCHITECTURE: 'ARCHITECTURE',
	PROPOSE: 'PROPOSE',
	ASSUMPTION_SURFACING: 'ASSUMPTION_SURFACING',
	VERIFY: 'VERIFY',
	HISTORICAL_CHECK: 'HISTORICAL_CHECK',
	REVIEW: 'REVIEW',
	EXECUTE: 'EXECUTE',
	VALIDATE: 'VALIDATE',
	COMMIT: 'COMMIT',
	REPLAN: 'REPLAN',
} as const;
export type Phase = typeof Phase[keyof typeof Phase];

export const GateStatus = {
	PENDING: 'PENDING',
	RESOLVED: 'RESOLVED',
} as const;

export const ClaimStatus = {
	OPEN: 'OPEN',
	VERIFIED: 'VERIFIED',
	DISPROVED: 'DISPROVED',
	UNKNOWN: 'UNKNOWN',
	CONDITIONAL: 'CONDITIONAL',
} as const;

export const SpeechAct = {
	ASSUMPTION: 'ASSUMPTION',
	CLAIM: 'CLAIM',
	QUESTION: 'QUESTION',
	ANSWER: 'ANSWER',
	PROPOSAL: 'PROPOSAL',
	DIRECTIVE: 'DIRECTIVE',
	ASSERTION: 'ASSERTION',
} as const;

export const Role = {
	HUMAN: 'HUMAN',
	EXECUTOR: 'EXECUTOR',
	VERIFIER: 'VERIFIER',
	TECHNICAL_EXPERT: 'TECHNICAL_EXPERT',
	HISTORIAN: 'HISTORIAN',
} as const;

export const IntakeMode = {
	STATE_DRIVEN: 'STATE_DRIVEN',
	DOCUMENT_BASED: 'DOCUMENT_BASED',
	HYBRID_CHECKPOINTS: 'HYBRID_CHECKPOINTS',
} as const;

export const EngineeringDomainCoverageLevel = {
	ADEQUATE: 'ADEQUATE',
	PARTIAL: 'PARTIAL',
	NONE: 'NONE',
} as const;

// ==================== Core types ====================

export interface DialogueEvent {
	event_id: number;
	dialogue_id: string;
	role: string;
	speech_act: string;
	phase: string;
	content: string;
	summary: string;
	detail?: string;
	timestamp: string;
}

export interface Claim {
	claim_id: string;
	statement: string;
	status: string;
	criticality: string;
	assumption_type?: string;
}

export interface Verdict {
	claim_id: string;
	verdict: string;
	rationale?: string;
}

export interface Gate {
	gate_id: string;
	gate_seq: number;
	reason: string;
	status: string;
	resolved_at?: string;
}

export interface WorkflowCommandRecord {
	command_id: string;
	command_type: string;
	label: string;
	status: string;
	started_at: string;
	collapsed?: boolean;
}

export interface WorkflowCommandOutput {
	content: string;
	line_type: string;
	tool_name?: string;
	timestamp: string;
}

// ==================== Intake types ====================

export interface IntakeModeRecommendation {
	recommended: string;
	rationale: string;
}

export interface IntakeCheckpoint {
	turnNumber: number;
	coverageSnapshot: EngineeringDomainCoverageMap;
	suggestedDomains: string[];
	offerModeSwitch?: boolean;
}

export type EngineeringDomainCoverageMap = Record<string, { level: string; evidence: string[] }>;

export interface IntakeConversationTurn {
	turnNumber: number;
	humanMessage: string;
	expertResponse: IntakeTurnResponse | IntakeGatheringTurnResponse | IntakeAnalysisTurnResponse;
}

export interface IntakeTurnResponse {
	conversationalResponse: string;
	suggestedQuestions?: string[];
	codebaseFindings?: string[];
	updatedPlan: { version: number };
	mmp?: MMPPayload;
}

export interface IntakeGatheringTurnResponse {
	type: 'gathering';
	focusEngineeringDomain: string;
	conversationalResponse: string;
	engineeringDomainNotes: string[];
	codebaseFindings?: string[];
	followUpQuestions?: string[];
	mmp?: MMPPayload;
}

export interface IntakeAnalysisTurnResponse {
	type: 'analysis';
}

export function isGatheringResponse(r: unknown): r is IntakeGatheringTurnResponse {
	return !!r && typeof r === 'object' && (r as Record<string, unknown>).type === 'gathering';
}

export interface IntakePlanDocument {
	version: number;
	title?: string;
	summary?: string;
	proposedApproach?: string;
	requirements?: Array<{ id: string; text: string }>;
	decisions?: Array<{ id: string; text: string }>;
	constraints?: Array<{ id: string; text: string }>;
	openQuestions?: Array<{ id: string; text: string }>;
	productVision?: string;
	productDescription?: string;
	personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>;
	userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string; implementationPhase?: string }>;
	phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>;
	successMetrics?: string[];
	uxRequirements?: string[];
	businessBusinessDomainProposals?: Array<{ id: string; name: string; description: string; entityPreview: string[]; workflowPreview: string[] }>;
	entityProposals?: Array<{ id: string; name: string; description: string; businessDomainId: string; keyAttributes: string[]; relationships: string[] }>;
	workflowProposals?: Array<{ id: string; name: string; description: string; businessDomainId: string }>;
	integrationProposals?: Array<{ id: string; name: string; description: string; category: string; standardProviders: string[] }>;
	qualityAttributes?: string[];
	proposerPhase?: string;
	preProposerReview?: boolean;
}

// ==================== MMP types ====================

export interface MMPPayload {
	mirror?: {
		steelMan?: string;
		items: MirrorItem[];
	};
	menu?: {
		items: MenuItem[];
	};
	preMortem?: {
		summary?: string;
		items: PreMortemItem[];
	};
}

export interface MirrorItem {
	id: string;
	text: string;
	category: string;
	rationale?: string;
	status: string;
	editedText?: string;
	source?: string;
}

export interface MenuItem {
	id: string;
	question: string;
	context?: string;
	options: MenuOption[];
	selectedOptionId?: string;
	customResponse?: string;
}

export interface MenuOption {
	optionId: string;
	label: string;
	description?: string;
	tradeoffs?: string;
	recommended?: boolean;
}

export interface PreMortemItem {
	id: string;
	assumption: string;
	failureScenario: string;
	severity: string;
	mitigation?: string;
	status: string;
	rationale?: string;
}

// ==================== Review types ====================

export interface ReviewItem {
	kind: 'claim' | 'finding';
	claim?: Claim;
	verdict?: Verdict;
	adjudication?: ClaimAdjudication;
	findingText?: string;
	findingIndex?: number;
	category: 'needs_decision' | 'awareness' | 'all_clear';
	categoryReason: string;
}

export interface ClaimAdjudication {
	verdict: string;
	rationale: string;
	citations: string[];
	conflicts?: string[];
	conditions?: string[];
	verification_queries?: string[];
}

export interface ReviewSummary {
	verified: number;
	disproved: number;
	unknown: number;
	conditional: number;
	open: number;
	historianFindings: number;
	needsDecisionCount: number;
	awarenessCount: number;
	allClearCount: number;
	adjudicationAvailable: boolean;
	consistent: number;
	inconsistent: number;
	adjConditional: number;
	adjUnknown: number;
}

// ==================== Pending MMP snapshot ====================

export interface PendingMmpSnapshot {
	mirrorDecisions: Record<string, { status: string; editedText?: string }>;
	menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>;
	preMortemDecisions: Record<string, { status: string; rationale?: string }>;
}

// ==================== Intake state subset ====================

export interface IntakeState {
	subState: string;
	turnCount: number;
	intakeMode: string | null;
	currentEngineeringDomain: string | null;
	engineeringDomainCoverage: EngineeringDomainCoverageMap | null;
	currentPlan?: Record<string, unknown> | null;
}

// ==================== StreamItem discriminated union ====================

export type StreamItem =
	| { type: 'human_message'; text: string; timestamp: string }
	| { type: 'turn'; turn: DialogueEvent; claims: Claim[]; verdict?: Verdict }
	| { type: 'gate'; gate: Gate; blockingClaims: Claim[]; resolvedAction?: string; metadata?: Record<string, unknown> }
	| { type: 'verification_gate'; gate: Gate; allClaims: Claim[]; verdicts: Verdict[]; blockingClaims: Claim[]; resolvedAction?: string }
	| { type: 'review_gate'; dialogueId: string; gate: Gate; allClaims: Claim[]; verdicts: Verdict[];
		historianFindings: string[]; reviewItems: ReviewItem[]; summary: ReviewSummary; resolvedAction?: string; resolvedRationale?: string }
	| { type: 'milestone'; dialogueId: string; phase: Phase; timestamp: string }
	| { type: 'dialogue_start'; dialogueId: string; goal: string; title: string | null; timestamp: string }
	| { type: 'dialogue_end'; dialogueId: string; status: string; timestamp: string }
	| { type: 'command_block'; dialogueId: string; command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[]; hasReview?: boolean }
	| { type: 'intake_turn'; dialogueId: string; turn: IntakeConversationTurn; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>; isLatest?: boolean; eventId?: number }
	| { type: 'intake_plan_preview'; dialogueId: string; plan: IntakePlanDocument; isFinal: boolean; timestamp: string }
	| { type: 'intake_approval_gate'; plan: IntakePlanDocument; dialogueId: string; timestamp: string; resolved?: boolean; resolvedAction?: string }
	| { type: 'intake_mode_selector'; dialogueId: string; recommendation: IntakeModeRecommendation; timestamp: string; resolved?: boolean; selectedMode?: string }
	| { type: 'intake_checkpoint'; dialogueId: string; checkpoint: IntakeCheckpoint; timestamp: string; resolved?: boolean }
	| { type: 'intake_domain_transition'; dialogueId: string; fromDomain: string; fromLabel: string; toDomain: string | null; toLabel: string | null; toDescription: string | null; timestamp: string }
	| { type: 'intake_gathering_complete'; dialogueId: string; coverageSummary: { adequate: number; partial: number; none: number; percentage: number }; intakeMode: string | null; timestamp: string }
	| { type: 'intake_analysis'; dialogueId: string; humanMessage: string; analysisSummary: string; codebaseFindings: string[]; engineeringDomainAssessment: Array<{ domain: string; level: string; evidence: string }>; timestamp: string; commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>; eventId?: number }
	| { type: 'intake_product_discovery'; dialogueId: string; requestCategory: string; productVision?: string; productDescription?: string; personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>; userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>; phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>; successMetrics?: string[]; uxRequirements?: string[]; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposal'; dialogueId: string; title: string; summary: string; proposedApproach: string; engineeringDomainCoverage: { adequate: number; partial: number; none: number; percentage: number }; timestamp: string }
	| { type: 'intake_proposer_business_domains'; dialogueId: string; domains: Array<{ id: string; name: string; description: string; rationale: string; entityPreview: string[]; workflowPreview: string[] }>; personas: Array<{ id: string; name: string; description: string }>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_journeys'; dialogueId: string; journeys: Array<{ id: string; title: string; scenario: string; priority?: string }>; workflows: Array<{ id: string; name: string; description: string; businessDomainId: string }>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_entities'; dialogueId: string; entities: Array<{ id: string; name: string; description: string; businessDomainId: string; keyAttributes: string[]; relationships: string[] }>; domainNames?: Record<string, string>; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'intake_proposer_integrations'; dialogueId: string; integrations: Array<{ id: string; name: string; category: string; description: string; standardProviders: string[]; ownershipModel: string }>; qualityAttributes: string[]; mmpJson?: string; eventId?: number; timestamp: string }
	| { type: 'qa_exchange'; dialogueId: string; question: string; answer: string; timestamp: string }
	| { type: 'reasoning_review'; dialogueId: string; concerns: Array<{ severity: string; summary: string; detail: string; location: string; recommendation: string }>; overallAssessment: string; reviewerModel: string; reviewPrompt?: string; timestamp: string }
	| { type: 'architecture_capabilities'; dialogueId: string; capabilities: Array<{ id: string; label: string; requirements: number; workflows: number; parentId: string | null }>; timestamp: string; eventId?: number }
	| { type: 'architecture_design'; dialogueId: string; components: Array<{ id: string; label: string; responsibility: string; rationale: string; parentId: string | null; workflowsServed: string[]; dependencies: string[]; interactionPatterns: string[]; technologyNotes: string; fileScope: string }>; dataModels: Array<{ id: string; entity: string; description: string; fields: Array<{ name: string; type: string; required: boolean }>; relationships: Array<{ targetModel: string; type: string; description: string }>; invariants: string[] }>; interfaces: Array<{ id: string; label: string; type: string; description: string; contract: string; providerComponent: string; consumerComponents: string[]; sourceWorkflows: string[] }>; implementationSequence: Array<{ id: string; label: string; description: string; componentsInvolved: string[]; dependencies: string[]; complexity: string; verificationMethod: string; sortOrder: number }>; timestamp: string; eventId?: number }
	| { type: 'architecture_validation'; dialogueId: string; score: number | null; findings: string[]; validated: boolean; timestamp: string; eventId?: number }
	| { type: 'architecture_gate'; docId: string; version: number; capabilities: number; components: number; goalAlignmentScore: number | null; dialogueId: string; timestamp: string; resolved?: boolean; resolvedAction?: string; mmpJson?: string; decompositionDepth?: number; eventId?: number }
	| { type: 'validation_finding'; dialogueId: string; findingId: string; hypothesis: string; category: string; severity: string; location: string; tool_used: string; proof_status: string; proof_artifact: string | null; confidence: number; useful_rating: number | null; timestamp: string; eventId?: number }
	| { type: 'validation_summary'; dialogueId: string; totalFindings: number; provenCount: number; probableCount: number; categories: Record<string, number>; timestamp: string; eventId?: number };
