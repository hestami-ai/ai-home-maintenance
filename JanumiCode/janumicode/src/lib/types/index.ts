/**
 * Core Type Definitions for JanumiCode
 * Based on: Governed Multi-Role Dialogue & Execution System - Technical Specification
 */

// ==================== ENUMS ====================

/**
 * System roles as defined in the technical specification (Section 3)
 */
export enum Role {
	EXECUTOR = 'EXECUTOR',
	TECHNICAL_EXPERT = 'TECHNICAL_EXPERT',
	VERIFIER = 'VERIFIER',
	HISTORIAN = 'HISTORIAN',
	HUMAN = 'HUMAN',
}

/**
 * Workflow phases as defined in the technical specification (Section 6)
 */
export enum Phase {
	INTAKE = 'INTAKE',
	ARCHITECTURE = 'ARCHITECTURE',
	PROPOSE = 'PROPOSE',
	ASSUMPTION_SURFACING = 'ASSUMPTION_SURFACING',
	VERIFY = 'VERIFY',
	HISTORICAL_CHECK = 'HISTORICAL_CHECK',
	REVIEW = 'REVIEW',
	EXECUTE = 'EXECUTE',
	VALIDATE = 'VALIDATE',
	COMMIT = 'COMMIT',
	REPLAN = 'REPLAN',
}

/**
 * Speech act types for structured communication (Section 4.1)
 */
export enum SpeechAct {
	CLAIM = 'CLAIM',
	ASSUMPTION = 'ASSUMPTION',
	EVIDENCE = 'EVIDENCE',
	VERDICT = 'VERDICT',
	DECISION = 'DECISION',
}

/**
 * Claim status lifecycle (Section 5.1)
 */
export enum ClaimStatus {
	OPEN = 'OPEN',
	VERIFIED = 'VERIFIED',
	CONDITIONAL = 'CONDITIONAL',
	DISPROVED = 'DISPROVED',
	UNKNOWN = 'UNKNOWN',
}

/**
 * Claim criticality levels (Section 5.1)
 */
export enum ClaimCriticality {
	CRITICAL = 'CRITICAL',
	NON_CRITICAL = 'NON_CRITICAL',
}

/**
 * Claim event types (Section 5.1)
 */
export enum ClaimEventType {
	CREATED = 'CREATED',
	VERIFIED = 'VERIFIED',
	DISPROVED = 'DISPROVED',
	OVERRIDDEN = 'OVERRIDDEN',
}

/**
 * Verdict types from the Verifier (Section 3.3)
 */
export enum VerdictType {
	VERIFIED = 'VERIFIED',
	CONDITIONAL = 'CONDITIONAL',
	DISPROVED = 'DISPROVED',
	UNKNOWN = 'UNKNOWN',
}

/**
 * Gate status (Section 5.1)
 */
export enum GateStatus {
	OPEN = 'OPEN',
	RESOLVED = 'RESOLVED',
}

/**
 * Human decision actions (Section 9.2)
 */
export enum HumanAction {
	APPROVE = 'APPROVE',
	REJECT = 'REJECT',
	OVERRIDE = 'OVERRIDE',
	REFRAME = 'REFRAME',
	DELEGATE = 'DELEGATE',
	ESCALATE = 'ESCALATE',
}

/**
 * Artifact types for hybrid storage (Phase 3 Implementation Roadmap)
 */
export enum ArtifactType {
	BLOB = 'BLOB', // Content-addressed blob
	FILE = 'FILE', // Workspace file reference
	EVIDENCE = 'EVIDENCE', // Evidence document
}

// ==================== CORE DATA STRUCTURES ====================

/**
 * Dialogue envelope structure (Section 4.1)
 * Every utterance or system action MUST be wrapped in this envelope
 */
export interface DialogueEnvelope {
	dialogue_id: string; // UUID
	turn_id: number;
	role: Role;
	phase: Phase;
	speech_act: SpeechAct;
	content_ref: string; // Reference to content (blob hash, file path, etc.)
	related_claims: string[]; // Claim IDs
	timestamp: string; // ISO-8601
}

/**
 * Unified dialogue event record.
 * Every phase writes events to the `dialogue_events` table through this shape.
 */
export interface DialogueEvent {
	event_id: number;
	dialogue_id: string;
	event_type: string;
	role: Role | 'SYSTEM';
	phase: Phase;
	speech_act: SpeechAct;
	summary: string;
	content: string | null;
	detail: string | null;
	timestamp: string;
}

/**
 * Assumption type — categorizes the kind of assumption an Executor surfaced.
 * Used for visual tagging in Review UI and Verifier strategy routing.
 */
export type AssumptionType = 'architectural' | 'compatibility' | 'structural' | 'scoping' | 'intent';

/**
 * Claim record (Section 5.1)
 */
export interface Claim {
	claim_id: string; // UUID
	statement: string; // The actual claim text
	introduced_by: Role;
	criticality: ClaimCriticality;
	status: ClaimStatus;
	dialogue_id: string;
	turn_id: number;
	created_at: string; // ISO-8601
	assumption_type?: AssumptionType;
}

/**
 * Claim event record (Section 5.1)
 * Append-only log of claim status changes
 */
export interface ClaimEvent {
	event_id: string; // UUID
	claim_id: string;
	event_type: ClaimEventType;
	source: Role;
	evidence_ref: string | null; // Reference to evidence artifact
	timestamp: string; // ISO-8601
}

/**
 * Verdict record (Section 5.1, 3.3)
 */
export interface Verdict {
	verdict_id: string; // UUID
	claim_id: string;
	verdict: VerdictType;
	constraints_ref: string | null; // Reference to constraint manifest
	evidence_ref: string | null; // Reference to evidence
	rationale: string; // Explanation for the verdict
	novel_dependency: boolean; // Technology not currently in the project
	timestamp: string; // ISO-8601
}

/**
 * Gate record (Section 5.1, 9.1)
 * Represents a blocking point requiring human decision
 */
export interface Gate {
	gate_seq: number; // Autoincrement stable ID for MMP cardId consistency
	gate_id: string; // UUID
	dialogue_id: string;
	reason: string; // Why the gate was triggered
	status: GateStatus;
	blocking_claims: string[]; // Claim IDs that triggered this gate
	created_at: string; // ISO-8601
	resolved_at: string | null; // ISO-8601 when resolved
}

/**
 * Human decision record (Section 5.1, 9.2)
 * All human actions are logged and auditable
 */
export interface HumanDecision {
	decision_id: string; // UUID
	gate_id: string;
	action: HumanAction;
	rationale: string; // Required for all decisions
	attachments_ref: string | null; // Reference to attached evidence
	timestamp: string; // ISO-8601
}

/**
 * Constraint manifest record (Section 5.1)
 * Versioned constraint documents
 */
export interface ConstraintManifest {
	manifest_id: string; // UUID
	version: number;
	constraints_ref: string; // Reference to constraint document
	timestamp: string; // ISO-8601
}

/**
 * Artifact record (Phase 3 Implementation Roadmap)
 * Content-addressed blob storage
 */
export interface Artifact {
	artifact_id: string; // UUID
	content_hash: string; // SHA-256 hash
	content: Buffer; // Actual content
	mime_type: string;
	size: number; // Bytes
	created_at: string; // ISO-8601
}

/**
 * Artifact reference record (Phase 3 Implementation Roadmap)
 * File system and metadata tracking
 */
export interface ArtifactReference {
	reference_id: string; // UUID
	artifact_type: ArtifactType;
	file_path: string | null; // Workspace-relative path (for FILE type)
	content_hash: string | null; // SHA-256 hash (for BLOB type)
	git_commit: string | null; // Git commit hash if in repository
	metadata: string; // JSON metadata
	created_at: string; // ISO-8601
}

// ==================== CONTEXT PACK TYPES ====================

/**
 * Context Pack structure (Section 8.1)
 * Role-specific context compiled for LLM invocation
 */
export interface ContextPack {
	role: Role;
	goal: string | null;
	constraint_manifest: ConstraintManifest | null;
	active_claims: Claim[];
	verdicts: Verdict[];
	human_decisions: HumanDecision[];
	historical_findings: string[]; // Historian-Interpreter output
	artifact_refs: string[]; // Artifact reference IDs
	token_budget: number;
	compiled_at: string; // ISO-8601
}

// ==================== CONFIGURATION TYPES ====================

/**
 * LLM provider types
 */
export enum LLMProvider {
	CLAUDE = 'CLAUDE',
	OPENAI = 'OPENAI',
	GEMINI = 'GEMINI',
}

/**
 * LLM model configuration
 */
export interface LLMModelConfig {
	provider: LLMProvider;
	model: string; // e.g., "claude-sonnet-4", "gpt-4"
	apiKey: string;
	maxTokens?: number;
	temperature?: number;
}

/**
 * Role-specific LLM configuration
 */
export interface RoleLLMConfig {
	executor: LLMModelConfig;
	technicalExpert: LLMModelConfig;
	verifier: LLMModelConfig;
	historianInterpreter: LLMModelConfig;
}

/**
 * Extension configuration
 */
export interface JanumiCodeConfig {
	tokenBudget: number; // Default: 10,000
	databasePath: string; // Path to SQLite database
	llmConfig: RoleLLMConfig;
}

// ==================== UTILITY TYPES ====================

/**
 * Custom error class with code property
 */
export class CodedError extends Error {
	constructor(
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'CodedError';
	}
}

/**
 * Result type for operations that may fail
 */
export type Result<T, E = Error> =
	| { success: true; value: T }
	| { success: false; error: E };

/**
 * Event source types
 */
export type EventSource = Role | 'SYSTEM';

/**
 * Content reference types
 */
export type ContentRef = string; // Format: "blob://hash" | "file://path" | "evidence://id"

// ==================== LLM PROVIDER TYPES ====================

/**
 * Re-export LLM provider types from llm module
 */
export type { LLMProvider as LLMProviderInterface } from '../llm/provider';
export type { Message as LLMMessage } from '../llm/provider';
export type { LLMRequest, LLMResponse } from '../llm/provider';

// ==================== ROLE TYPES ====================

/**
 * Re-export role-specific types from roles module
 */
export type { ExecutorResponse, Assumption as ExecutorAssumption } from '../roles/executor';
export type { VerifierResponse } from '../roles/verifier';
export type { HistorianInterpreterResponse } from '../roles/historianInterpreter';

/**
 * Re-export dialogue types from dialogue module
 */
export type { DialogueSession as Dialogue } from '../dialogue/session';

/**
 * Type alias for verdict status (same as VerdictType)
 */
export type VerdictStatus = VerdictType;

// ==================== INTAKE PHASE TYPES ====================

/**
 * Re-export INTAKE conversation planning types
 */
export {
	IntakeSubState,
	IntakeMode,
	EngineeringDomain,
	EngineeringDomainCoverageLevel,
	type IntakeExtractedItemType,
	type IntakeExtractedItem,
	type IntakePlanDocument,
	type IntakeTurnResponse,
	type IntakeGatheringTurnResponse,
	type IntakeAccumulation,
	type IntakeConversationState,
	type IntakeConversationTurn,
	type EngineeringDomainCoverageEntry,
	type EngineeringDomainCoverageMap,
	type IntakeModeRecommendation,
	type IntakeCheckpoint,
	type PersonaDefinition,
	type UserJourney,
	type UserJourneyStep,
	type PhasingEntry,
	ProposerPhase,
	type BusinessDomainProposal,
	type EntityProposal,
	type WorkflowProposal,
	type IntegrationProposal,
	createEmptyPlanDocument,
	isGatheringResponse,
} from './intake';

// ==================== MAKER / AGENT INTEGRATION CONTROL PLANE TYPES ====================

/**
 * Re-export MAKER types for structured intent capture, task graph decomposition,
 * per-unit execution, bounded repair, multi-provider routing, and active memory injection.
 */
export * from './maker';
