/**
 * Database Schema Definition
 * Implements Phase 1.3: Core Data Model
 * Based on Technical Specification Section 5.1
 */

/**
 * Initial schema creation SQL (Migration v1)
 * Creates all 9 core tables:
 * 1. dialogue_turns
 * 2. claims
 * 3. claim_events
 * 4. verdicts
 * 5. gates
 * 6. human_decisions
 * 7. constraint_manifests
 * 8. artifacts
 * 9. artifact_references
 */
export const SCHEMA_V1 = `
-- ==================== DIALOGUE SYSTEM ====================

-- Dialogue turns table (Section 5.1)
-- Append-only log of all dialogue turns
CREATE TABLE IF NOT EXISTS dialogue_turns (
    turn_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('EXECUTOR', 'TECHNICAL_EXPERT', 'VERIFIER', 'HISTORIAN', 'HUMAN')),
    phase TEXT NOT NULL CHECK(phase IN ('INTAKE', 'PROPOSE', 'ASSUMPTION_SURFACING', 'VERIFY', 'HISTORICAL_CHECK', 'REVIEW', 'EXECUTE', 'VALIDATE', 'COMMIT', 'REPLAN')),
    speech_act TEXT NOT NULL CHECK(speech_act IN ('CLAIM', 'ASSUMPTION', 'EVIDENCE', 'VERDICT', 'DECISION')),
    content_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

    -- Indexes for common queries
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dialogue_turns_dialogue_turn ON dialogue_turns(dialogue_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_dialogue_id ON dialogue_turns(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_role ON dialogue_turns(role);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_phase ON dialogue_turns(phase);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_timestamp ON dialogue_turns(timestamp);

-- ==================== CLAIMS SYSTEM ====================

-- Claims table (Section 5.1)
-- Tracks all claims made during dialogue with their status
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY CHECK(length(claim_id) = 36),
    statement TEXT NOT NULL,
    introduced_by TEXT NOT NULL CHECK(introduced_by IN ('EXECUTOR', 'TECHNICAL_EXPERT', 'VERIFIER', 'HISTORIAN', 'HUMAN')),
    criticality TEXT NOT NULL CHECK(criticality IN ('CRITICAL', 'NON_CRITICAL')),
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'VERIFIED', 'CONDITIONAL', 'DISPROVED', 'UNKNOWN')) DEFAULT 'OPEN',
    dialogue_id TEXT NOT NULL,
    turn_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (dialogue_id, turn_id) REFERENCES dialogue_turns(dialogue_id, turn_id)
);

CREATE INDEX IF NOT EXISTS idx_claims_dialogue_id ON claims(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_criticality ON claims(criticality);
CREATE INDEX IF NOT EXISTS idx_claims_introduced_by ON claims(introduced_by);

-- Claim events table (Section 5.1)
-- Append-only log of claim status changes
CREATE TABLE IF NOT EXISTS claim_events (
    event_id TEXT PRIMARY KEY CHECK(length(event_id) = 36),
    claim_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('CREATED', 'VERIFIED', 'DISPROVED', 'OVERRIDDEN')),
    source TEXT NOT NULL CHECK(source IN ('EXECUTOR', 'TECHNICAL_EXPERT', 'VERIFIER', 'HISTORIAN', 'HUMAN', 'SYSTEM')),
    evidence_ref TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_events_claim_id ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_events_timestamp ON claim_events(timestamp);

-- ==================== VERIFICATION SYSTEM ====================

-- Verdicts table (Section 5.1)
-- Verifier verdicts on claims
CREATE TABLE IF NOT EXISTS verdicts (
    verdict_id TEXT PRIMARY KEY CHECK(length(verdict_id) = 36),
    claim_id TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK(verdict IN ('VERIFIED', 'CONDITIONAL', 'DISPROVED', 'UNKNOWN')),
    constraints_ref TEXT,
    evidence_ref TEXT,
    rationale TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
);

CREATE INDEX IF NOT EXISTS idx_verdicts_claim_id ON verdicts(claim_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_verdict ON verdicts(verdict);
CREATE INDEX IF NOT EXISTS idx_verdicts_timestamp ON verdicts(timestamp);

-- ==================== GATE SYSTEM ====================

-- Gates table (Section 5.1)
-- Human-in-the-loop decision points
CREATE TABLE IF NOT EXISTS gates (
    gate_id TEXT PRIMARY KEY CHECK(length(gate_id) = 36),
    dialogue_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'RESOLVED')) DEFAULT 'OPEN',
    blocking_claims TEXT NOT NULL, -- JSON array of claim IDs
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,

    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE INDEX IF NOT EXISTS idx_gates_dialogue_id ON gates(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_gates_status ON gates(status);
CREATE INDEX IF NOT EXISTS idx_gates_created_at ON gates(created_at);

-- Human decisions table (Section 5.1)
-- All human actions at gates with rationale
CREATE TABLE IF NOT EXISTS human_decisions (
    decision_id TEXT PRIMARY KEY CHECK(length(decision_id) = 36),
    gate_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('APPROVE', 'REJECT', 'OVERRIDE', 'REFRAME')),
    rationale TEXT NOT NULL,
    attachments_ref TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (gate_id) REFERENCES gates(gate_id)
);

CREATE INDEX IF NOT EXISTS idx_human_decisions_gate_id ON human_decisions(gate_id);
CREATE INDEX IF NOT EXISTS idx_human_decisions_action ON human_decisions(action);
CREATE INDEX IF NOT EXISTS idx_human_decisions_timestamp ON human_decisions(timestamp);

-- ==================== CONSTRAINT SYSTEM ====================

-- Constraint manifests table (Section 5.1)
-- Versioned constraint documents
CREATE TABLE IF NOT EXISTS constraint_manifests (
    manifest_id TEXT PRIMARY KEY CHECK(length(manifest_id) = 36),
    version INTEGER NOT NULL,
    constraints_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_constraint_manifests_version ON constraint_manifests(version);
CREATE INDEX IF NOT EXISTS idx_constraint_manifests_timestamp ON constraint_manifests(timestamp);

-- ==================== ARTIFACT SYSTEM ====================

-- Artifacts table (Phase 3: Artifact Management)
-- Content-addressed blob storage
CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id TEXT PRIMARY KEY CHECK(length(artifact_id) = 36),
    content_hash TEXT NOT NULL UNIQUE,
    content BLOB NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artifacts_content_hash ON artifacts(content_hash);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at);

-- Artifact references table (Phase 3: Artifact Management)
-- File system and metadata tracking
CREATE TABLE IF NOT EXISTS artifact_references (
    reference_id TEXT PRIMARY KEY CHECK(length(reference_id) = 36),
    artifact_type TEXT NOT NULL CHECK(artifact_type IN ('BLOB', 'FILE', 'EVIDENCE')),
    file_path TEXT,
    content_hash TEXT,
    git_commit TEXT,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Either file_path or content_hash must be present
    CONSTRAINT chk_artifact_ref CHECK(
        (artifact_type = 'FILE' AND file_path IS NOT NULL) OR
        (artifact_type IN ('BLOB', 'EVIDENCE') AND content_hash IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_artifact_references_type ON artifact_references(artifact_type);
CREATE INDEX IF NOT EXISTS idx_artifact_references_file_path ON artifact_references(file_path);
CREATE INDEX IF NOT EXISTS idx_artifact_references_content_hash ON artifact_references(content_hash);

-- ==================== METADATA TABLE ====================

-- Schema metadata table
-- Tracks schema version and migration history
CREATE TABLE IF NOT EXISTS schema_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial schema version
INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '1')
    ON CONFLICT(key) DO NOTHING;
`;

/**
 * Migration history
 */
export interface Migration {
	version: number;
	description: string;
	sql: string;
	appliedAt?: string;
}

/**
 * All migrations in order
 */
/**
 * Migration V3: Dialogues lifecycle table
 * Tracks dialogue lifecycle (active, completed, abandoned) for multi-dialogue stream support.
 */
export const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS dialogues (
    dialogue_id TEXT PRIMARY KEY CHECK(length(dialogue_id) = 36),
    goal TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')) DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dialogues_status ON dialogues(status);
CREATE INDEX IF NOT EXISTS idx_dialogues_created_at ON dialogues(created_at);
`;

/**
 * Migration V4: CLI activity events table
 * Persists all CLI streaming events for audit trail (Level 3 data).
 * Always written regardless of UI display level.
 */
export const SCHEMA_V4 = `
CREATE TABLE IF NOT EXISTS cli_activity_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    role TEXT,
    phase TEXT,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT,
    tool_name TEXT,
    file_path TEXT,
    status TEXT CHECK(status IS NULL OR status IN ('success', 'error')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cli_activity_dialogue_id ON cli_activity_events(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_cli_activity_timestamp ON cli_activity_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_cli_activity_event_type ON cli_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cli_activity_role ON cli_activity_events(role);
`;

/**
 * Migration V5: Workflow command blocks
 * Persists command invocations and their streaming output so they
 * survive webview re-renders and appear in the scrollable history.
 */
export const SCHEMA_V5 = `
CREATE TABLE IF NOT EXISTS workflow_commands (
    command_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    command_type TEXT NOT NULL CHECK(command_type IN ('cli_invocation', 'llm_api_call', 'role_invocation')),
    label TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error')) DEFAULT 'running',
    collapsed INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wf_commands_dialogue_id ON workflow_commands(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_wf_commands_started_at ON workflow_commands(started_at);

CREATE TABLE IF NOT EXISTS workflow_command_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('summary', 'detail', 'error')) DEFAULT 'summary',
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (command_id) REFERENCES workflow_commands(command_id)
);

CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_command_id ON workflow_command_outputs(command_id);
CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_timestamp ON workflow_command_outputs(timestamp);
`;

/**
 * Migration V6: INTAKE conversation tables
 * Supports the conversational planning phase where Human and Technical Expert
 * collaborate to produce a structured implementation plan.
 */
export const SCHEMA_V6 = `
-- INTAKE conversation state (one per dialogue)
-- Tracks the evolving plan, sub-state, and accumulated context summaries.
CREATE TABLE IF NOT EXISTS intake_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    sub_state TEXT NOT NULL CHECK(sub_state IN ('DISCUSSING', 'SYNTHESIZING', 'AWAITING_APPROVAL')) DEFAULT 'DISCUSSING',
    turn_count INTEGER NOT NULL DEFAULT 0,
    draft_plan TEXT NOT NULL DEFAULT '{}',
    accumulations TEXT NOT NULL DEFAULT '[]',
    finalized_plan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_conv_dialogue_id ON intake_conversations(dialogue_id);

-- INTAKE conversation turns (paired human message + expert response)
-- Stores the full content of each turn plus a plan snapshot for history/debugging.
CREATE TABLE IF NOT EXISTS intake_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    human_message TEXT NOT NULL,
    expert_response TEXT NOT NULL,
    plan_snapshot TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE INDEX IF NOT EXISTS idx_intake_turns_dialogue_id ON intake_turns(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_intake_turns_turn_number ON intake_turns(dialogue_id, turn_number);
`;

/**
 * Migration V7: Dialogue titles
 * Adds a nullable title column for LLM-generated human-readable dialogue labels.
 */
export const SCHEMA_V7 = `
ALTER TABLE dialogues ADD COLUMN title TEXT DEFAULT NULL;
`;

/**
 * Migration V8: Widen workflow_command_outputs line_type CHECK constraint
 * Adds 'stdin', 'tool_input', 'tool_output' to allowed line_type values.
 * Adds tool_name column for efficient tool-type filtering.
 * SQLite cannot ALTER CHECK constraints, so we recreate the table.
 */
export const SCHEMA_V8 = `
CREATE TABLE workflow_command_outputs_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id TEXT NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('summary', 'detail', 'error', 'stdin', 'tool_input', 'tool_output')) DEFAULT 'summary',
    tool_name TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (command_id) REFERENCES workflow_commands(command_id)
);
INSERT INTO workflow_command_outputs_v2 (id, command_id, line_type, content, timestamp)
    SELECT id, command_id, line_type, content, timestamp FROM workflow_command_outputs;
DROP TABLE workflow_command_outputs;
ALTER TABLE workflow_command_outputs_v2 RENAME TO workflow_command_outputs;
CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_command_id ON workflow_command_outputs(command_id);
CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_timestamp ON workflow_command_outputs(timestamp);
`;

/**
 * Migration V9: Narrative Curator artifact tables
 * Stores structured memory artifacts produced by the Narrative Curator:
 * narrative memories, decision traces, and open loops.
 */
export const SCHEMA_V9 = `
CREATE TABLE IF NOT EXISTS narrative_memories (
    memory_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL CHECK(curation_mode IN ('INTENT', 'OUTCOME', 'FAILURE')),
    agent_frame TEXT NOT NULL,
    goal TEXT NOT NULL,
    causal_sequence TEXT NOT NULL,
    conflicts TEXT NOT NULL DEFAULT '[]',
    resolution_status TEXT NOT NULL,
    lessons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_narrative_memories_dialogue_id ON narrative_memories(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_narrative_memories_mode ON narrative_memories(curation_mode);

CREATE TABLE IF NOT EXISTS decision_traces (
    trace_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL CHECK(curation_mode IN ('INTENT', 'OUTCOME', 'FAILURE')),
    decision_points TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decision_traces_dialogue_id ON decision_traces(dialogue_id);

CREATE TABLE IF NOT EXISTS open_loops (
    loop_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL CHECK(curation_mode IN ('INTENT', 'OUTCOME', 'FAILURE')),
    category TEXT NOT NULL CHECK(category IN ('blocker', 'deferred_decision', 'missing_info', 'risk', 'follow_up')),
    description TEXT NOT NULL,
    related_claim_ids TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_open_loops_dialogue_id ON open_loops(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_category ON open_loops(category);
CREATE INDEX IF NOT EXISTS idx_open_loops_priority ON open_loops(priority);
`;

/**
 * Migration V10: Embeddings table for vector search
 * Stores vector embeddings for semantic retrieval across all queryable artifacts.
 * Used with sqlite-vector extension for KNN cosine similarity search.
 */
export const SCHEMA_V10 = `
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK(source_type IN (
        'narrative_memory', 'decision_trace', 'open_loop',
        'dialogue_turn', 'claim', 'verdict'
    )),
    source_id TEXT NOT NULL,
    dialogue_id TEXT NOT NULL,
    content_text TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL DEFAULT 1024,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_dialogue ON embeddings(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);
`;

/**
 * Migration V12: Add FEEDBACK curation mode + assumption_type on claims.
 *
 * - Recreates narrative_memories, decision_traces, open_loops WITHOUT the
 *   CHECK(curation_mode IN (...)) constraint so the TypeScript CurationMode
 *   enum is the single source of truth for valid modes. This enables the new
 *   FEEDBACK mode (and any future modes) without further migrations.
 * - Adds optional assumption_type column to claims for categorising assumptions
 *   as architectural, compatibility, structural, scoping, or intent.
 */
export const SCHEMA_V12 = `
-- Recreate narrative_memories without CHECK constraint on curation_mode
CREATE TABLE IF NOT EXISTS narrative_memories_v2 (
    memory_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL,
    agent_frame TEXT NOT NULL,
    goal TEXT NOT NULL,
    causal_sequence TEXT NOT NULL,
    conflicts TEXT NOT NULL DEFAULT '[]',
    resolution_status TEXT NOT NULL,
    lessons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO narrative_memories_v2 SELECT * FROM narrative_memories;
DROP TABLE IF EXISTS narrative_memories;
ALTER TABLE narrative_memories_v2 RENAME TO narrative_memories;
CREATE INDEX IF NOT EXISTS idx_narrative_memories_dialogue_id ON narrative_memories(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_narrative_memories_mode ON narrative_memories(curation_mode);

-- Recreate decision_traces without CHECK constraint on curation_mode
CREATE TABLE IF NOT EXISTS decision_traces_v2 (
    trace_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL,
    decision_points TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO decision_traces_v2 SELECT * FROM decision_traces;
DROP TABLE IF EXISTS decision_traces;
ALTER TABLE decision_traces_v2 RENAME TO decision_traces;
CREATE INDEX IF NOT EXISTS idx_decision_traces_dialogue_id ON decision_traces(dialogue_id);

-- Recreate open_loops without CHECK constraint on curation_mode
CREATE TABLE IF NOT EXISTS open_loops_v2 (
    loop_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('blocker', 'deferred_decision', 'missing_info', 'risk', 'follow_up')),
    description TEXT NOT NULL,
    related_claim_ids TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO open_loops_v2 SELECT * FROM open_loops;
DROP TABLE IF EXISTS open_loops;
ALTER TABLE open_loops_v2 RENAME TO open_loops;
CREATE INDEX IF NOT EXISTS idx_open_loops_dialogue_id ON open_loops(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_category ON open_loops(category);
CREATE INDEX IF NOT EXISTS idx_open_loops_priority ON open_loops(priority);

-- Add assumption_type to claims (nullable — only set for Executor-surfaced assumptions)
ALTER TABLE claims ADD COLUMN assumption_type TEXT;
`;

/**
 * Migration V11: MAKER Agent Integration Control Plane tables
 * Adds structured internal objects for intent capture, task graph decomposition,
 * per-unit execution, bounded repair, and outcome tracking.
 */
export const SCHEMA_V11 = `
-- ==================== INTENT & CONTRACT ====================

CREATE TABLE IF NOT EXISTS intent_records (
    intent_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    human_goal TEXT NOT NULL,
    scope_in TEXT NOT NULL DEFAULT '[]',
    scope_out TEXT NOT NULL DEFAULT '[]',
    priority_axes TEXT NOT NULL DEFAULT '[]',
    risk_posture TEXT NOT NULL CHECK(risk_posture IN ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE')) DEFAULT 'BALANCED',
    clarifications_resolved TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intent_records_dialogue ON intent_records(dialogue_id);

CREATE TABLE IF NOT EXISTS acceptance_contracts (
    contract_id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    dialogue_id TEXT NOT NULL,
    success_conditions TEXT NOT NULL DEFAULT '[]',
    required_validations TEXT NOT NULL DEFAULT '[]',
    non_goals TEXT NOT NULL DEFAULT '[]',
    human_judgment_required TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (intent_id) REFERENCES intent_records(intent_id)
);
CREATE INDEX IF NOT EXISTS idx_acceptance_contracts_dialogue ON acceptance_contracts(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_contracts_intent ON acceptance_contracts(intent_id);

-- ==================== TASK GRAPH ====================

CREATE TABLE IF NOT EXISTS task_graphs (
    graph_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    root_goal TEXT NOT NULL,
    graph_status TEXT NOT NULL CHECK(graph_status IN ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABANDONED')) DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (intent_id) REFERENCES intent_records(intent_id)
);
CREATE INDEX IF NOT EXISTS idx_task_graphs_dialogue ON task_graphs(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_task_graphs_intent ON task_graphs(intent_id);

CREATE TABLE IF NOT EXISTS task_units (
    unit_id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,
    label TEXT NOT NULL,
    goal TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('SCAFFOLD', 'IMPLEMENTATION', 'REFACTOR', 'TEST', 'DOCUMENTATION', 'CONFIGURATION', 'MIGRATION')),
    inputs TEXT NOT NULL DEFAULT '[]',
    outputs TEXT NOT NULL DEFAULT '[]',
    preconditions TEXT NOT NULL DEFAULT '[]',
    postconditions TEXT NOT NULL DEFAULT '[]',
    allowed_tools TEXT NOT NULL DEFAULT '[]',
    preferred_provider TEXT,
    max_change_scope TEXT NOT NULL DEFAULT '*',
    observables TEXT NOT NULL DEFAULT '[]',
    falsifiers TEXT NOT NULL DEFAULT '[]',
    verification_method TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'READY', 'IN_PROGRESS', 'VALIDATING', 'REPAIRING', 'COMPLETED', 'FAILED', 'SKIPPED')) DEFAULT 'PENDING',
    parent_unit_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (graph_id) REFERENCES task_graphs(graph_id),
    FOREIGN KEY (parent_unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_task_units_graph ON task_units(graph_id);
CREATE INDEX IF NOT EXISTS idx_task_units_status ON task_units(status);
CREATE INDEX IF NOT EXISTS idx_task_units_parent ON task_units(parent_unit_id);

CREATE TABLE IF NOT EXISTS task_edges (
    edge_id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,
    from_unit_id TEXT NOT NULL,
    to_unit_id TEXT NOT NULL,
    edge_type TEXT NOT NULL CHECK(edge_type IN ('DEPENDS_ON', 'BLOCKS', 'RELATED')),
    FOREIGN KEY (graph_id) REFERENCES task_graphs(graph_id),
    FOREIGN KEY (from_unit_id) REFERENCES task_units(unit_id),
    FOREIGN KEY (to_unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_task_edges_graph ON task_edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_task_edges_from ON task_edges(from_unit_id);
CREATE INDEX IF NOT EXISTS idx_task_edges_to ON task_edges(to_unit_id);

-- ==================== CLAIMS & EVIDENCE ====================

CREATE TABLE IF NOT EXISTS claim_units (
    claim_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    statement TEXT NOT NULL,
    claim_scope TEXT NOT NULL CHECK(claim_scope IN ('ATOMIC', 'COMPOSITE', 'VAGUE')),
    falsifiers TEXT NOT NULL DEFAULT '[]',
    required_evidence TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_claim_units_unit ON claim_units(unit_id);

CREATE TABLE IF NOT EXISTS evidence_packets (
    packet_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    supported_statements TEXT NOT NULL DEFAULT '[]',
    unsupported_statements TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0.0,
    gaps TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_evidence_packets_unit ON evidence_packets(unit_id);

-- ==================== VALIDATION & REPAIR ====================

CREATE TABLE IF NOT EXISTS validation_packets (
    validation_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    checks TEXT NOT NULL DEFAULT '[]',
    expected_observables TEXT NOT NULL DEFAULT '[]',
    actual_observables TEXT NOT NULL DEFAULT '[]',
    pass_fail TEXT NOT NULL CHECK(pass_fail IN ('PASS', 'FAIL')),
    failure_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_validation_packets_unit ON validation_packets(unit_id);

CREATE TABLE IF NOT EXISTS repair_packets (
    repair_id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    suspected_cause TEXT NOT NULL,
    repair_strategy TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 2,
    escalation_threshold TEXT NOT NULL CHECK(escalation_threshold IN ('AUTO_REPAIR_SAFE', 'CONDITIONAL', 'ESCALATE_REQUIRED')),
    diff_before TEXT NOT NULL DEFAULT '',
    diff_after TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL CHECK(result IN ('FIXED', 'PARTIALLY_FIXED', 'FAILED', 'ESCALATED', 'TIMED_OUT')),
    wall_clock_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_repair_packets_unit ON repair_packets(unit_id);

-- ==================== HISTORICAL INVARIANTS ====================

CREATE TABLE IF NOT EXISTS historical_invariant_packets (
    packet_id TEXT PRIMARY KEY,
    unit_id TEXT,
    dialogue_id TEXT NOT NULL,
    relevant_invariants TEXT NOT NULL DEFAULT '[]',
    prior_failure_motifs TEXT NOT NULL DEFAULT '[]',
    precedent_patterns TEXT NOT NULL DEFAULT '[]',
    reusable_subplans TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (unit_id) REFERENCES task_units(unit_id)
);
CREATE INDEX IF NOT EXISTS idx_hist_invariant_dialogue ON historical_invariant_packets(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_hist_invariant_unit ON historical_invariant_packets(unit_id);

-- ==================== OUTCOME TRACKING ====================

CREATE TABLE IF NOT EXISTS outcome_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    graph_id TEXT NOT NULL,
    providers_used TEXT NOT NULL DEFAULT '[]',
    augmentations_used TEXT NOT NULL DEFAULT '[]',
    success INTEGER NOT NULL DEFAULT 0,
    failure_modes TEXT NOT NULL DEFAULT '[]',
    useful_invariants TEXT NOT NULL DEFAULT '[]',
    units_completed INTEGER NOT NULL DEFAULT 0,
    units_total INTEGER NOT NULL DEFAULT 0,
    total_wall_clock_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (graph_id) REFERENCES task_graphs(graph_id)
);
CREATE INDEX IF NOT EXISTS idx_outcome_snapshots_dialogue ON outcome_snapshots(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_outcome_snapshots_graph ON outcome_snapshots(graph_id);

-- ==================== TOOLCHAIN DETECTION ====================

CREATE TABLE IF NOT EXISTS toolchain_detections (
    detection_id TEXT PRIMARY KEY,
    workspace_root TEXT NOT NULL,
    project_type TEXT NOT NULL,
    package_manager TEXT NOT NULL DEFAULT '',
    lint_command TEXT,
    type_check_command TEXT,
    test_command TEXT,
    build_command TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    confidence REAL NOT NULL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_toolchain_workspace ON toolchain_detections(workspace_root);
`;

/**
 * Migration V13: Clarification threads table
 * Persists inline "Ask More" conversations so they survive re-renders
 * and are available as context for future agents and human review.
 */
export const SCHEMA_V13 = `
CREATE TABLE IF NOT EXISTS clarification_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_context TEXT NOT NULL,
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clarification_dialogue ON clarification_threads(dialogue_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clarification_item ON clarification_threads(dialogue_id, item_id);
`;

export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		description: 'Initial schema - Core data model',
		sql: SCHEMA_V1,
	},
	{
		version: 2,
		description: 'Add composite unique index on dialogue_turns for FK support',
		sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_dialogue_turns_dialogue_turn ON dialogue_turns(dialogue_id, turn_id);`,
	},
	{
		version: 3,
		description: 'Add dialogues lifecycle table for multi-dialogue stream',
		sql: SCHEMA_V3,
	},
	{
		version: 4,
		description: 'Add CLI activity events table for multi-CLI audit trail',
		sql: SCHEMA_V4,
	},
	{
		version: 5,
		description: 'Add workflow command blocks for persistent stream history',
		sql: SCHEMA_V5,
	},
	{
		version: 6,
		description: 'Add INTAKE conversation tables for conversational planning phase',
		sql: SCHEMA_V6,
	},
	{
		version: 7,
		description: 'Add title column to dialogues for LLM-generated titles',
		sql: SCHEMA_V7,
	},
	{
		version: 8,
		description: 'Widen command output line_type for tool cards; add tool_name column',
		sql: SCHEMA_V8,
	},
	{
		version: 9,
		description: 'Add Narrative Curator artifact tables (narrative_memories, decision_traces, open_loops)',
		sql: SCHEMA_V9,
	},
	{
		version: 10,
		description: 'Add embeddings table for vector semantic search',
		sql: SCHEMA_V10,
	},
	{
		version: 11,
		description: 'MAKER Agent Integration Control Plane — intent, task graph, claims, validation, repair, outcome tables',
		sql: SCHEMA_V11,
	},
	{
		version: 12,
		description: 'Add FEEDBACK curation mode, assumption_type on claims',
		sql: SCHEMA_V12,
	},
	{
		version: 13,
		description: 'Add clarification threads table for Ask More conversations',
		sql: SCHEMA_V13,
	},
];
