/**
 * Context Handoff Layer — Type Definitions
 *
 * Types for the contract-driven, policy-aware context engineering system.
 * Replaces the legacy CompiledContextPack with HandoffPacket.
 */

import type { Role, Phase } from '../types';

// ==================== HISTORIAN QUERY TYPES ====================
// (Moved from builders/historianInterpreter.ts — used by orchestrator + roleConnector)

export enum HistorianQueryType {
	CONTRADICTION_CHECK = 'CONTRADICTION_CHECK',
	PRECEDENT_SEARCH = 'PRECEDENT_SEARCH',
	INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
	GENERAL_HISTORY = 'GENERAL_HISTORY',
	GOAL_ALIGNMENT_CHECK = 'GOAL_ALIGNMENT_CHECK',
	ARCHITECTURE_DRIFT_CHECK = 'ARCHITECTURE_DRIFT_CHECK',
}

// ==================== CONTEXT BLOCK TYPES ====================

/** Source from which a context block is materialized. */
export type ContextBlockSource =
	| 'handoff_doc'       // Pre-synthesized handoff document from phase boundary
	| 'db_query'          // Direct SQL query against the dialogue database
	| 'static'            // Static content (e.g., constraint manifests, system prompts)
	| 'agent_synthesized'; // Content the Context Engineer synthesizes on the fly

/** Canonical handoff document types produced at phase boundaries. */
export enum HandoffDocType {
	INTAKE = 'INTAKE',
	ARCHITECTURE = 'ARCHITECTURE',
	EXECUTION = 'EXECUTION',
	VERIFICATION = 'VERIFICATION',
	HISTORICAL = 'HISTORICAL',
}

/** Specification for a single context block within a policy. */
export interface ContextBlockSpec {
	/** Unique identifier for this block within the policy. */
	blockId: string;
	/** Human-readable label (used in audit manifests and agent prompts). */
	label: string;
	/** How this block's data is sourced. */
	source: ContextBlockSource;
	/** For 'handoff_doc' source: which handoff document type to consume. */
	handoffDocType?: HandoffDocType;
	/** For 'db_query' source: table name or SQL hint for the agent. */
	queryHint?: string;
	/** Maximum tokens for this block. When omitted, governed by policy's sectionBudgets. */
	maxTokens?: number;
}

// ==================== CONTEXT POLICY ====================

/**
 * A declarative contract defining the bounded situational awareness
 * required for a specific Role at a specific Phase/SubPhase/Intent.
 */
export interface ContextPolicy {
	/** Unique key: `${role}:${phase}:${subPhase}:${intent}` (wildcards use '*'). */
	policyKey: string;
	/** Target role this policy serves. */
	role: Role;
	/** Target workflow phase. */
	phase: Phase | '*';
	/** Target sub-phase (e.g., 'DECOMPOSING', 'MODELING'). '*' for any. */
	subPhase: string;
	/** Invocation intent (e.g., 'MAKER_PLANNER'). '*' for any. */
	intent: string;
	/** Policy version — incremented on changes; used in cache fingerprinting. */
	version: number;

	/** Blocks that MUST be present. Absence triggers ContextSufficiencyError or degraded result. */
	requiredBlocks: ContextBlockSpec[];
	/** Blocks included if token budget permits, in priority order (highest first). */
	optionalBlocks: ContextBlockSpec[];
	/**
	 * Block IDs in shedding order: first entry is dropped first when over budget.
	 * Must cover all optional block IDs.
	 */
	sheddingPriority: string[];
	/** Per-section token budget as fraction of total budget (0.0 – 1.0). */
	sectionBudgets: Record<string, number>;

	/** Strategy when a required block cannot be materialized. */
	omissionStrategy: 'fail' | 'degrade_with_warning';
}

// ==================== HANDOFF DOCUMENTS ====================

/**
 * A canonical phase-boundary artifact stored in SQLite.
 * Produced by the Narrative Curator at phase transitions.
 * Consumed by the Context Engineer for pre-invocation context assembly.
 */
export interface HandoffDocument {
	doc_id: string;
	dialogue_id: string;
	doc_type: HandoffDocType;
	source_phase: string;
	/** Structured content (stored as JSON in DB). */
	content: HandoffDocContent;
	/** Exact token count of serialized content. */
	token_count: number;
	/** Latest event_id included in this document. */
	event_watermark: number;
	created_at: string;
}

/** Union type for handoff document content variants. */
export type HandoffDocContent =
	| IntakeHandoffContent
	| ArchitectureHandoffContent
	| ExecutionHandoffContent
	| VerificationHandoffContent
	| HistoricalHandoffContent;

export interface IntakeHandoffContent {
	type: 'INTAKE';
	goal: string;
	finalizedPlan: Record<string, unknown>;
	humanDecisions: Array<{ action: string; rationale: string }>;
	openLoops: Array<{ category: string; description: string; priority: string }>;
	mmpDecisions: Record<string, unknown> | null;
}

export interface ArchitectureHandoffContent {
	type: 'ARCHITECTURE';
	documentVersion: number;
	capabilities: Array<{ id: string; label: string; requirements: string[] }>;
	components: Array<{ id: string; label: string; responsibility: string; dependencies: string[] }>;
	interfaces: Array<{ id: string; label: string; type: string; contract: string | null }>;
	implementationSequence: Array<{ label: string; complexity: string; components: string[] }>;
	validationFindings: string[];
}

export interface ExecutionHandoffContent {
	type: 'EXECUTION';
	taskGraphStatus: string;
	completedUnits: Array<{ id: string; label: string; outcome: string }>;
	failedUnits: Array<{ id: string; label: string; failureMode: string }>;
	activeUnit: { id: string; label: string; goal: string } | null;
	repairHistory: Array<{ unitId: string; strategy: string; result: string }>;
}

export interface VerificationHandoffContent {
	type: 'VERIFICATION';
	claimsSummary: Array<{ id: string; statement: string; status: string; criticality: string }>;
	verdictsSummary: Array<{ claimId: string; verdict: string; rationale: string }>;
	escalations: string[];
}

export interface HistoricalHandoffContent {
	type: 'HISTORICAL';
	narrativeMemory: Record<string, unknown> | null;
	decisionTrace: Record<string, unknown> | null;
	openLoops: Array<{ category: string; description: string; priority: string }>;
	priorDialogueLessons: string[];
	failureMotifs: string[];
	invariants: string[];
}

// ==================== HANDOFF PACKET (Return Type) ====================

/**
 * The output of the Context Engineer — replaces CompiledContextPack.
 * Contains the rendered context briefing plus full audit metadata.
 */
export interface HandoffPacket {
	/** Rendered context string ready for LLM consumption (markdown). */
	briefing: string;
	/** Structured manifest of what's included. */
	sectionManifest: SectionManifestEntry[];
	/** What was omitted and why. */
	omissions: OmissionEntry[];
	/** Token accounting. */
	tokenAccounting: TokenAccounting;
	/** Sufficiency assessment. */
	sufficiency: SufficiencyAssessment;
	/** Cache fingerprint that produced this packet. */
	fingerprint: string;
	/** Diagnostics for debugging and observability. */
	diagnostics: ContextDiagnostics;
}

export interface SectionManifestEntry {
	blockId: string;
	label: string;
	source: ContextBlockSource;
	tokenCount: number;
	/** Pointer to source data for audit (e.g., "db:claims:dialogue-123", "handoff:INTAKE:doc-456"). */
	retrievalPointer: string;
}

export interface OmissionEntry {
	blockId: string;
	reason: 'budget_exceeded' | 'not_available' | 'policy_excluded';
	/** Estimated impact of this omission. */
	impact: 'low' | 'medium' | 'high';
	/** Optional retrieval pointer if the agent can fetch this data later. */
	retrievalHint?: string;
}

export interface TokenAccounting {
	budget: number;
	used: number;
	remaining: number;
	/** Per-section token usage keyed by blockId. */
	perSection: Record<string, number>;
}

export interface SufficiencyAssessment {
	sufficient: boolean;
	missingRequired: string[];
	warnings: string[];
	confidenceLevel: 'high' | 'medium' | 'low';
}

export interface ContextDiagnostics {
	policyKey: string;
	policyVersion: number;
	handoffDocsConsumed: string[];
	sqlQueriesExecuted: number;
	agentReasoningTokens: number;
	wallClockMs: number;
}

// ==================== CACHE FINGERPRINT ====================

/** State-based cache key components (hashed to produce a fingerprint string). */
export interface CacheFingerprint {
	role: Role;
	phase: Phase | '*';
	subPhase: string;
	intent: string;
	tokenBudget: number;
	policyVersion: number;
	latestEventId: number;
	latestHandoffDocId: string | null;
	/** Hash of extras keys+values to differentiate same-policy calls with different inputs. */
	extrasHash: string;
}

// ==================== ASSEMBLE CONTEXT OPTIONS ====================

/** Options for the main `assembleContext()` entry point. */
export interface AssembleContextOptions {
	dialogueId: string;
	role: Role;
	phase: Phase;
	subPhase?: string;
	intent?: string;
	tokenBudget: number;
	/**
	 * Role-specific extras passed through to the Context Engineer agent.
	 * Examples: claimToVerify, humanFeedback, architectureDoc, approvedPlan, currentPlan, humanMessage.
	 */
	extras?: Record<string, unknown>;
	/** Streaming event callback for governed stream visibility. */
	onEvent?: (event: import('../cli/types').CLIActivityEvent) => void;
	/** AbortSignal for cancellation. */
	signal?: AbortSignal;
}

// ==================== ERROR TYPES ====================

/**
 * Thrown when the Context Engineer cannot satisfy a policy's required blocks
 * and the policy's omissionStrategy is 'fail'.
 */
export class ContextSufficiencyError extends Error {
	public readonly missingBlocks: string[];
	public readonly policyKey: string;

	constructor(missingBlocks: string[], policyKey: string, message?: string) {
		super(message ?? `Context sufficiency failure [${policyKey}]: missing required blocks: ${missingBlocks.join(', ')}`);
		this.name = 'ContextSufficiencyError';
		this.missingBlocks = missingBlocks;
		this.policyKey = policyKey;
	}
}
