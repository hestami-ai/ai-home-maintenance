/**
 * Shared types for the Client Liaison Agent (Universal Router).
 *
 * The 8-type query taxonomy and surrounding interfaces per JanumiCode Spec
 * v2.3 §8.11 plus the rich-input feature spec §7-9.
 */

import type { GovernedStreamRecord, WorkflowRun, WorkflowRunStatus, PhaseId } from '../../types/records';
import type { ContextPacket } from '../deepMemoryResearch';

// ── Query Taxonomy (8 types) ────────────────────────────────────────

export type QueryType =
  | 'workflow_initiation'
  | 'historical_lookup'
  | 'consistency_challenge'
  | 'forward_implication'
  | 'rationale_request'
  | 'ambient_clarification'
  | 'status_check'
  | 'artifact_request';

// ── Composer-side input shapes ──────────────────────────────────────

export type MentionType = 'file' | 'symbol' | 'decision' | 'constraint' | 'phase' | 'run';

export interface Reference {
  type: MentionType;
  id: string;
  display: string;
  uri?: string;
}

export interface Attachment {
  uri: string;
  name: string;
  type: 'file' | 'image';
  size?: number;
}

export interface UserInput {
  id: string;
  text: string;
  attachments: Attachment[];
  references: Reference[];
  inputMode: 'raw_intent' | 'open_query';
  workflowRunId: string | null;
  currentPhaseId: PhaseId | null;
  /** Composer hint to skip classification and route directly to a capability. */
  forceCapability?: string;
}

// ── Classification ──────────────────────────────────────────────────

export interface OpenQuery {
  id: string;
  text: string;
  workflowRunId: string;
  currentPhaseId: string;
  references?: Reference[];
}

export interface QueryClassification {
  queryType: QueryType;
  confidence: number;
  /** Whether the query should be queued (during Phase 9 for types 2,3) */
  shouldQueue: boolean;
  /** Optional hint to skip a synthesis call and run a capability directly. */
  suggestedCapability?: string;
}

// ── Retrieval ───────────────────────────────────────────────────────

export interface RetrievalResult {
  records: GovernedStreamRecord[];
  strategy: string;
  /**
   * DMR Context Packet when the retrieval was delegated to the Deep Memory
   * Research Agent (§8.4). Present for retrieval-type queries where
   * completeness, supersession, and contradiction signals should be
   * surfaced to the user; absent for workflow_initiation / status_check
   * / workflow-mutating queries where full DMR research would be wasted
   * or misleading.
   */
  contextPacket?: ContextPacket;
}

export interface RecordFilters {
  workflowRunId?: string;
  recordType?: string;
  phaseId?: string;
  limit?: number;
}

// ── Synthesis / Tool calling ────────────────────────────────────────

export interface CapabilityCallResult {
  name: string;
  result?: unknown;
  error?: string;
  formatted: string;
  /** Record ids referenced by this capability call (for provenance). */
  recordIds?: string[];
}

export interface SynthesisResult {
  responseText: string;
  provenanceRecordIds: string[];
  capabilityCalls: CapabilityCallResult[];
  escalatedToOrchestrator: boolean;
}

export interface LiaisonResponse {
  queryId: string;
  queryType: QueryType;
  responseText: string;
  provenanceRecordIds: string[];
  escalatedToOrchestrator: boolean;
  capabilityCalls: CapabilityCallResult[];
}

// ── Workflow status ─────────────────────────────────────────────────

export interface WorkflowStatus {
  run: WorkflowRun | null;
  currentPhaseId: PhaseId | null;
  currentSubPhaseId: string | null;
  status: WorkflowRunStatus | null;
  recentRecords: GovernedStreamRecord[];
}

// ── Mention candidates ──────────────────────────────────────────────

export interface MentionCandidate {
  type: MentionType;
  id: string;
  label: string;
  detail?: string;
  uri?: string;
}
