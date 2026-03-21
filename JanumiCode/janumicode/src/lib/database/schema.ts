/**
 * Database Schema Definition
 * Consolidated clean schema (greenfield — no incremental migrations).
 *
 * Tables (38):
 *  1. dialogue_events     — Unified event log (replaces dialogue_turns + intake_turns)
 *  2. dialogues           — Dialogue lifecycle tracking
 *  3. claims              — Claim tracking with status lifecycle
 *  4. claim_events        — Append-only claim status change log
 *  5. verdicts            — Verifier verdicts on claims
 *  6. gates               — Human-in-the-loop decision points
 *  7. human_decisions     — Logged human actions at gates
 *  8. constraint_manifests — Versioned constraint documents
 *  9. artifacts           — Content-addressed blob storage
 * 10. artifact_references — File system and metadata tracking
 * 11. cli_activity_events — CLI streaming event audit trail
 * 12. workflow_commands   — Command invocation blocks
 * 13. workflow_command_outputs — Streaming output for commands
 * 14. intake_conversations — INTAKE conversation state machine
 * 15. narrative_memories  — Narrative Curator memories
 * 16. decision_traces     — Decision trace artifacts
 * 17. open_loops          — Open loop tracking
 * 18. embeddings          — Vector embeddings for semantic search
 * 19–30. MAKER Agent tables (intent, task graph, claims, validation, etc.)
 * 31. clarification_threads — Ask More conversations
 * 32. fts_stream_content  — FTS5 full-text search
 * 33. architecture_documents — Architecture phase JSON snapshots
 * 34. arch_capabilities   — Normalized capability lookup
 * 35. arch_domain_mappings — Domain→capability traceability
 * 36. arch_workflows      — Workflow lookup
 * 37. arch_components     — Component lookup (hierarchical)
 * 38. arch_implementation_steps — Implementation steps (→ MAKER TaskUnits)
 * 39. handoff_documents    — Canonical phase-boundary artifacts for context handoff
 * + schema_metadata
 */

/**
 * Migration interface
 */
export interface Migration {
	version: number;
	description: string;
	sql: string;
	appliedAt?: string;
}

/**
 * Consolidated schema V1 — all tables created in a single pass.
 * Since this is a greenfield extension, we delete and recreate the DB
 * rather than running incremental migrations.
 */
export const SCHEMA_V1 = `
-- ==================== DIALOGUE SYSTEM ====================

-- Dialogue events table (replaces dialogue_turns + intake_turns)
-- Unified append-only event log for all phases and roles.
-- event_type categorizes the event; summary is always human-readable;
-- content holds full content; detail holds phase-specific JSON enrichment.
CREATE TABLE IF NOT EXISTS dialogue_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    role TEXT NOT NULL,
    phase TEXT NOT NULL,
    speech_act TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT,
    detail TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dialogue_events_dialogue_event ON dialogue_events(dialogue_id, event_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_events_dialogue_id ON dialogue_events(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_events_event_type ON dialogue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dialogue_events_role ON dialogue_events(role);
CREATE INDEX IF NOT EXISTS idx_dialogue_events_phase ON dialogue_events(phase);
CREATE INDEX IF NOT EXISTS idx_dialogue_events_timestamp ON dialogue_events(timestamp);

-- Dialogues lifecycle table
-- Tracks dialogue status (active, completed, abandoned) for multi-dialogue stream support.
CREATE TABLE IF NOT EXISTS dialogues (
    dialogue_id TEXT PRIMARY KEY CHECK(length(dialogue_id) = 36),
    goal TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')) DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    title TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_dialogues_status ON dialogues(status);
CREATE INDEX IF NOT EXISTS idx_dialogues_created_at ON dialogues(created_at);

-- ==================== CLAIMS SYSTEM ====================

-- Claims table — tracks all claims made during dialogue with their status
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY CHECK(length(claim_id) = 36),
    statement TEXT NOT NULL,
    introduced_by TEXT NOT NULL CHECK(introduced_by IN ('EXECUTOR', 'TECHNICAL_EXPERT', 'VERIFIER', 'HISTORIAN', 'HUMAN')),
    criticality TEXT NOT NULL CHECK(criticality IN ('CRITICAL', 'NON_CRITICAL')),
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'VERIFIED', 'CONDITIONAL', 'DISPROVED', 'UNKNOWN')) DEFAULT 'OPEN',
    dialogue_id TEXT NOT NULL,
    turn_id INTEGER NOT NULL,
    assumption_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (dialogue_id, turn_id) REFERENCES dialogue_events(dialogue_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_claims_dialogue_id ON claims(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_criticality ON claims(criticality);
CREATE INDEX IF NOT EXISTS idx_claims_introduced_by ON claims(introduced_by);

-- Claim events table — append-only log of claim status changes
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

-- Verdicts table — Verifier verdicts on claims
CREATE TABLE IF NOT EXISTS verdicts (
    verdict_id TEXT PRIMARY KEY CHECK(length(verdict_id) = 36),
    claim_id TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK(verdict IN ('VERIFIED', 'CONDITIONAL', 'DISPROVED', 'UNKNOWN')),
    constraints_ref TEXT,
    evidence_ref TEXT,
    rationale TEXT NOT NULL,
    novel_dependency INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
);

CREATE INDEX IF NOT EXISTS idx_verdicts_claim_id ON verdicts(claim_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_verdict ON verdicts(verdict);
CREATE INDEX IF NOT EXISTS idx_verdicts_timestamp ON verdicts(timestamp);

-- ==================== GATE SYSTEM ====================

-- Gates table — human-in-the-loop decision points
CREATE TABLE IF NOT EXISTS gates (
    gate_id TEXT PRIMARY KEY CHECK(length(gate_id) = 36),
    dialogue_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'RESOLVED')) DEFAULT 'OPEN',
    blocking_claims TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,

    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE INDEX IF NOT EXISTS idx_gates_dialogue_id ON gates(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_gates_status ON gates(status);
CREATE INDEX IF NOT EXISTS idx_gates_created_at ON gates(created_at);

-- Human decisions table — all human actions at gates with rationale
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

-- Constraint manifests table — versioned constraint documents
CREATE TABLE IF NOT EXISTS constraint_manifests (
    manifest_id TEXT PRIMARY KEY CHECK(length(manifest_id) = 36),
    version INTEGER NOT NULL,
    constraints_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_constraint_manifests_version ON constraint_manifests(version);
CREATE INDEX IF NOT EXISTS idx_constraint_manifests_timestamp ON constraint_manifests(timestamp);

-- ==================== ARTIFACT SYSTEM ====================

-- Artifacts table — content-addressed blob storage
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

-- Artifact references table — file system and metadata tracking
CREATE TABLE IF NOT EXISTS artifact_references (
    reference_id TEXT PRIMARY KEY CHECK(length(reference_id) = 36),
    artifact_type TEXT NOT NULL CHECK(artifact_type IN ('BLOB', 'FILE', 'EVIDENCE')),
    file_path TEXT,
    content_hash TEXT,
    git_commit TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT chk_artifact_ref CHECK(
        (artifact_type = 'FILE' AND file_path IS NOT NULL) OR
        (artifact_type IN ('BLOB', 'EVIDENCE') AND content_hash IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_artifact_references_type ON artifact_references(artifact_type);
CREATE INDEX IF NOT EXISTS idx_artifact_references_file_path ON artifact_references(file_path);
CREATE INDEX IF NOT EXISTS idx_artifact_references_content_hash ON artifact_references(content_hash);

-- ==================== CLI ACTIVITY ====================

-- CLI activity events table — audit trail for all CLI streaming events
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

-- ==================== WORKFLOW COMMANDS ====================

-- Workflow command blocks — persists command invocations and streaming output
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
    line_type TEXT NOT NULL CHECK(line_type IN ('summary', 'detail', 'error', 'stdin', 'tool_input', 'tool_output', 'reasoning_review')) DEFAULT 'summary',
    tool_name TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (command_id) REFERENCES workflow_commands(command_id)
);

CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_command_id ON workflow_command_outputs(command_id);
CREATE INDEX IF NOT EXISTS idx_wf_cmd_outputs_timestamp ON workflow_command_outputs(timestamp);

-- ==================== INTAKE CONVERSATIONS ====================

-- INTAKE conversation state (one per dialogue)
-- Tracks the evolving plan, sub-state, domain coverage, and accumulated context summaries.
CREATE TABLE IF NOT EXISTS intake_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    sub_state TEXT NOT NULL CHECK(sub_state IN ('GATHERING','DISCUSSING','SYNTHESIZING','AWAITING_APPROVAL','ANALYZING','PRODUCT_REVIEW','PROPOSING','CLARIFYING','PROPOSING_DOMAINS','PROPOSING_JOURNEYS','PROPOSING_ENTITIES','PROPOSING_INTEGRATIONS')) DEFAULT 'DISCUSSING',
    turn_count INTEGER NOT NULL DEFAULT 0,
    draft_plan TEXT NOT NULL DEFAULT '{}',
    accumulations TEXT NOT NULL DEFAULT '[]',
    finalized_plan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    intake_mode TEXT DEFAULT NULL,
    domain_coverage TEXT DEFAULT NULL,
    current_domain TEXT DEFAULT NULL,
    checkpoints TEXT DEFAULT NULL,
    classifier_result TEXT DEFAULT NULL,
    clarification_round INTEGER NOT NULL DEFAULT 0,
    mmp_history TEXT DEFAULT NULL,
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_conv_dialogue_id ON intake_conversations(dialogue_id);

-- ==================== NARRATIVE CURATOR ====================

-- Narrative memories — structured memory artifacts from Narrative Curator
CREATE TABLE IF NOT EXISTS narrative_memories (
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
CREATE INDEX IF NOT EXISTS idx_narrative_memories_dialogue_id ON narrative_memories(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_narrative_memories_mode ON narrative_memories(curation_mode);

-- Decision traces
CREATE TABLE IF NOT EXISTS decision_traces (
    trace_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL,
    decision_points TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decision_traces_dialogue_id ON decision_traces(dialogue_id);

-- Open loops — unresolved items tracked across dialogues
CREATE TABLE IF NOT EXISTS open_loops (
    loop_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    curation_mode TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('blocker', 'deferred_decision', 'missing_info', 'risk', 'follow_up')),
    description TEXT NOT NULL,
    related_claim_ids TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_open_loops_dialogue_id ON open_loops(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_category ON open_loops(category);
CREATE INDEX IF NOT EXISTS idx_open_loops_priority ON open_loops(priority);

-- ==================== EMBEDDINGS ====================

-- Embeddings table for vector search / semantic retrieval
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK(source_type IN (
        'narrative_memory', 'decision_trace', 'open_loop',
        'dialogue_event', 'claim', 'verdict'
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

-- ==================== MAKER AGENT INTEGRATION ====================

-- Intent & Contract
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

-- Task Graph
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

-- Claims & Evidence (MAKER)
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

-- Validation & Repair
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

-- Historical Invariants
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

-- Outcome Tracking
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

-- Toolchain Detection
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

-- ==================== CLARIFICATION ====================

-- Clarification threads — inline "Ask More" conversations
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

-- ==================== FULL-TEXT SEARCH ====================

-- FTS5 virtual table for full-text search over governed stream content
CREATE VIRTUAL TABLE IF NOT EXISTS fts_stream_content USING fts5(
    content,
    source_table UNINDEXED,
    source_id UNINDEXED,
    dialogue_id UNINDEXED,
    tokenize = 'porter unicode61'
);

-- ==================== ARCHITECTURE PHASE ====================

-- Architecture document snapshots (full JSON + normalized lookup tables)
CREATE TABLE IF NOT EXISTS architecture_documents (
    doc_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    document TEXT NOT NULL,
    goal_alignment_score REAL,
    validation_findings TEXT,
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'VALIDATED', 'APPROVED', 'SUPERSEDED')) DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_docs_dialogue ON architecture_documents(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_arch_docs_status ON architecture_documents(status);

-- Capabilities (normalized lookup)
CREATE TABLE IF NOT EXISTS arch_capabilities (
    capability_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    dialogue_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    source_requirements TEXT NOT NULL DEFAULT '[]',
    parent_capability_id TEXT DEFAULT NULL,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_cap_doc ON arch_capabilities(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_cap_dialogue ON arch_capabilities(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_arch_cap_parent ON arch_capabilities(parent_capability_id);

-- Domain → capability mapping (traceability layer)
CREATE TABLE IF NOT EXISTS arch_domain_mappings (
    mapping_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    requirement_ids TEXT NOT NULL DEFAULT '[]',
    coverage_contribution TEXT NOT NULL CHECK(coverage_contribution IN ('PRIMARY', 'SECONDARY')) DEFAULT 'PRIMARY',
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (capability_id) REFERENCES arch_capabilities(capability_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_dm_doc ON arch_domain_mappings(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_dm_cap ON arch_domain_mappings(capability_id);
CREATE INDEX IF NOT EXISTS idx_arch_dm_domain ON arch_domain_mappings(domain);

-- Workflows (normalized lookup)
CREATE TABLE IF NOT EXISTS arch_workflows (
    workflow_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    actors TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (capability_id) REFERENCES arch_capabilities(capability_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_wf_doc ON arch_workflows(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_wf_cap ON arch_workflows(capability_id);

-- Components (normalized lookup)
CREATE TABLE IF NOT EXISTS arch_components (
    component_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    label TEXT NOT NULL,
    responsibility TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    workflows_served TEXT NOT NULL DEFAULT '[]',
    dependencies TEXT NOT NULL DEFAULT '[]',
    interaction_patterns TEXT NOT NULL DEFAULT '[]',
    file_scope TEXT,
    parent_component_id TEXT,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (parent_component_id) REFERENCES arch_components(component_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_comp_doc ON arch_components(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_comp_parent ON arch_components(parent_component_id);

-- Implementation steps (bridges to MAKER TaskUnits)
CREATE TABLE IF NOT EXISTS arch_implementation_steps (
    step_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    components_involved TEXT NOT NULL DEFAULT '[]',
    dependencies TEXT NOT NULL DEFAULT '[]',
    estimated_complexity TEXT NOT NULL CHECK(estimated_complexity IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
    verification_method TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_step_doc ON arch_implementation_steps(doc_id);

-- ==================== CONTEXT HANDOFF ====================

-- Canonical phase-boundary artifacts for context handoff.
-- Produced by the Narrative Curator at phase transitions.
-- Consumed by the Context Engineer for pre-invocation context assembly.
CREATE TABLE IF NOT EXISTS handoff_documents (
    doc_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('INTAKE', 'ARCHITECTURE', 'EXECUTION', 'VERIFICATION', 'HISTORICAL')),
    source_phase TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    event_watermark INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_handoff_docs_dialogue ON handoff_documents(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_handoff_docs_type ON handoff_documents(doc_type, dialogue_id);

-- ==================== GENERATED DOCUMENTS ====================

CREATE TABLE IF NOT EXISTS generated_documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id   TEXT NOT NULL,
    document_type TEXT NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dialogue_id, document_type),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_gen_docs_dialogue ON generated_documents(dialogue_id);

-- ==================== WEBVIEW DRAFTS ====================

-- Persists in-progress user inputs (gate rationales, intake responses, etc.) across restarts
CREATE TABLE IF NOT EXISTS webview_drafts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    category    TEXT NOT NULL,
    item_key    TEXT NOT NULL DEFAULT '',
    value       TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dialogue_id, category, item_key)
);
CREATE INDEX IF NOT EXISTS idx_webview_drafts_dialogue ON webview_drafts(dialogue_id);

-- ==================== METADATA ====================

-- Schema metadata table — tracks schema version and migration history
CREATE TABLE IF NOT EXISTS schema_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial schema version
INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '12')
    ON CONFLICT(key) DO NOTHING;
`;

// V2: Architecture Phase tables (also included in SCHEMA_V1 for fresh databases)
const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS architecture_documents (
    doc_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    document TEXT NOT NULL,
    goal_alignment_score REAL,
    validation_findings TEXT,
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'VALIDATED', 'APPROVED', 'SUPERSEDED')) DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_docs_dialogue ON architecture_documents(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_arch_docs_status ON architecture_documents(status);

CREATE TABLE IF NOT EXISTS arch_capabilities (
    capability_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    dialogue_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    source_requirements TEXT NOT NULL DEFAULT '[]',
    parent_capability_id TEXT DEFAULT NULL,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_cap_doc ON arch_capabilities(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_cap_dialogue ON arch_capabilities(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_arch_cap_parent ON arch_capabilities(parent_capability_id);

CREATE TABLE IF NOT EXISTS arch_domain_mappings (
    mapping_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    requirement_ids TEXT NOT NULL DEFAULT '[]',
    coverage_contribution TEXT NOT NULL CHECK(coverage_contribution IN ('PRIMARY', 'SECONDARY')) DEFAULT 'PRIMARY',
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (capability_id) REFERENCES arch_capabilities(capability_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_dm_doc ON arch_domain_mappings(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_dm_cap ON arch_domain_mappings(capability_id);
CREATE INDEX IF NOT EXISTS idx_arch_dm_domain ON arch_domain_mappings(domain);

CREATE TABLE IF NOT EXISTS arch_workflows (
    workflow_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    actors TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (capability_id) REFERENCES arch_capabilities(capability_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_wf_doc ON arch_workflows(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_wf_cap ON arch_workflows(capability_id);

CREATE TABLE IF NOT EXISTS arch_components (
    component_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    label TEXT NOT NULL,
    responsibility TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    workflows_served TEXT NOT NULL DEFAULT '[]',
    dependencies TEXT NOT NULL DEFAULT '[]',
    interaction_patterns TEXT NOT NULL DEFAULT '[]',
    file_scope TEXT,
    parent_component_id TEXT,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id),
    FOREIGN KEY (parent_component_id) REFERENCES arch_components(component_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_comp_doc ON arch_components(doc_id);
CREATE INDEX IF NOT EXISTS idx_arch_comp_parent ON arch_components(parent_component_id);

CREATE TABLE IF NOT EXISTS arch_implementation_steps (
    step_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    components_involved TEXT NOT NULL DEFAULT '[]',
    dependencies TEXT NOT NULL DEFAULT '[]',
    estimated_complexity TEXT NOT NULL CHECK(estimated_complexity IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
    verification_method TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (doc_id) REFERENCES architecture_documents(doc_id)
);
CREATE INDEX IF NOT EXISTS idx_arch_step_doc ON arch_implementation_steps(doc_id);
`;

export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		description:
			'Consolidated schema — dialogue_events, intake_conversations, MAKER, FTS',
		sql: SCHEMA_V1,
	},
	{
		version: 2,
		description:
			'Architecture phase — architecture_documents + lookup tables',
		sql: SCHEMA_V2,
	},
	{
		version: 3,
		description:
			'Mirror & Menu Protocol — mmp_history column on intake_conversations',
		sql: `ALTER TABLE intake_conversations ADD COLUMN mmp_history TEXT DEFAULT NULL;`,
	},
	{
		version: 4,
		description:
			'Architecture enrichment — rationale, interaction_patterns on arch_components',
		sql: `
ALTER TABLE arch_components ADD COLUMN rationale TEXT NOT NULL DEFAULT '';
ALTER TABLE arch_components ADD COLUMN interaction_patterns TEXT NOT NULL DEFAULT '[]';
`,
	},
	{
		version: 5,
		description: 'Novel dependency detection flag on verdicts',
		sql: `ALTER TABLE verdicts ADD COLUMN novel_dependency INTEGER NOT NULL DEFAULT 0;`,
	},
	{
		version: 6,
		description: 'Widen sub_state CHECK constraint for PRODUCT_REVIEW',
		sql: `
-- SQLite cannot ALTER CHECK constraints; recreate the table.
CREATE TABLE intake_conversations_v6 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    sub_state TEXT NOT NULL CHECK(sub_state IN ('GATHERING','DISCUSSING','SYNTHESIZING','AWAITING_APPROVAL','ANALYZING','PRODUCT_REVIEW','PROPOSING','CLARIFYING')) DEFAULT 'DISCUSSING',
    turn_count INTEGER NOT NULL DEFAULT 0,
    draft_plan TEXT NOT NULL DEFAULT '{}',
    accumulations TEXT NOT NULL DEFAULT '[]',
    finalized_plan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    intake_mode TEXT DEFAULT NULL,
    domain_coverage TEXT DEFAULT NULL,
    current_domain TEXT DEFAULT NULL,
    checkpoints TEXT DEFAULT NULL,
    classifier_result TEXT DEFAULT NULL,
    clarification_round INTEGER NOT NULL DEFAULT 0,
    mmp_history TEXT DEFAULT NULL,
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

INSERT INTO intake_conversations_v6 (id, dialogue_id, sub_state, turn_count, draft_plan, accumulations, finalized_plan, created_at, updated_at, intake_mode, domain_coverage, current_domain, checkpoints, classifier_result, clarification_round, mmp_history)
    SELECT id, dialogue_id, sub_state, turn_count, draft_plan, accumulations, finalized_plan, created_at, updated_at, intake_mode, domain_coverage, current_domain, checkpoints, classifier_result, clarification_round, mmp_history
    FROM intake_conversations;

DROP TABLE intake_conversations;
ALTER TABLE intake_conversations_v6 RENAME TO intake_conversations;
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_conv_dialogue_id ON intake_conversations(dialogue_id);
`,
	},
	{
		version: 7,
		description:
			'Capability hierarchy — parent_capability_id on arch_capabilities',
		sql: `
ALTER TABLE arch_capabilities ADD COLUMN parent_capability_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_arch_cap_parent ON arch_capabilities(parent_capability_id);
`,
	},
	{
		version: 8,
		description:
			'Proposer-Validator sub-states + proposer_phase column on intake_conversations',
		sql: `
-- SQLite cannot ALTER CHECK constraints; recreate the table.
CREATE TABLE intake_conversations_v8 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    sub_state TEXT NOT NULL CHECK(sub_state IN ('GATHERING','DISCUSSING','SYNTHESIZING','AWAITING_APPROVAL','ANALYZING','PRODUCT_REVIEW','PROPOSING','CLARIFYING','PROPOSING_DOMAINS','PROPOSING_JOURNEYS','PROPOSING_ENTITIES','PROPOSING_INTEGRATIONS')) DEFAULT 'DISCUSSING',
    turn_count INTEGER NOT NULL DEFAULT 0,
    draft_plan TEXT NOT NULL DEFAULT '{}',
    accumulations TEXT NOT NULL DEFAULT '[]',
    finalized_plan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    intake_mode TEXT DEFAULT NULL,
    domain_coverage TEXT DEFAULT NULL,
    current_domain TEXT DEFAULT NULL,
    checkpoints TEXT DEFAULT NULL,
    classifier_result TEXT DEFAULT NULL,
    clarification_round INTEGER NOT NULL DEFAULT 0,
    mmp_history TEXT DEFAULT NULL,
    proposer_phase INTEGER DEFAULT NULL,
    CONSTRAINT fk_dialogue_id CHECK(length(dialogue_id) = 36)
);

INSERT INTO intake_conversations_v8 (id, dialogue_id, sub_state, turn_count, draft_plan, accumulations, finalized_plan, created_at, updated_at, intake_mode, domain_coverage, current_domain, checkpoints, classifier_result, clarification_round, mmp_history)
    SELECT id, dialogue_id, sub_state, turn_count, draft_plan, accumulations, finalized_plan, created_at, updated_at, intake_mode, domain_coverage, current_domain, checkpoints, classifier_result, clarification_round, mmp_history
    FROM intake_conversations;

DROP TABLE intake_conversations;
ALTER TABLE intake_conversations_v8 RENAME TO intake_conversations;
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_conv_dialogue_id ON intake_conversations(dialogue_id);
`,
	},
	{
		version: 9,
		description:
			'Pending MMP decisions — persists partial user decisions across restarts',
		sql: `
CREATE TABLE IF NOT EXISTS pending_mmp_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    mirror_decisions TEXT NOT NULL DEFAULT '{}',
    menu_selections TEXT NOT NULL DEFAULT '{}',
    premortem_decisions TEXT NOT NULL DEFAULT '{}',
    product_edits TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dialogue_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_pending_mmp_dialogue ON pending_mmp_decisions(dialogue_id);
`,
	},
	{
		version: 10,
		description:
			'Generated documents — ephemeral LLM-generated prose artifacts per dialogue',
		sql: `
CREATE TABLE IF NOT EXISTS generated_documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id   TEXT NOT NULL,
    document_type TEXT NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dialogue_id, document_type),
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_gen_docs_dialogue ON generated_documents(dialogue_id);
`,
	},
	{
		version: 11,
		description:
			'Webview drafts — persists in-progress user inputs (gate rationales, intake responses, etc.) across restarts',
		sql: `
CREATE TABLE IF NOT EXISTS webview_drafts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dialogue_id TEXT NOT NULL,
    category    TEXT NOT NULL,
    item_key    TEXT NOT NULL DEFAULT '',
    value       TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dialogue_id, category, item_key)
);
CREATE INDEX IF NOT EXISTS idx_webview_drafts_dialogue ON webview_drafts(dialogue_id);
`,
	},
	{
		version: 12,
		description:
			'Transition graph versioning — tracks which version of the phase graph a dialogue was created under',
		sql: `
ALTER TABLE workflow_states ADD COLUMN transition_graph_version INTEGER NOT NULL DEFAULT 1;
`,
	},
	{
		version: 13,
		description:
			'Deep Memory Agent — typed memory objects, graph edges, extraction audit, context packet cache, embeddings source_type widening',
		sql: `
-- ==================== MEMORY OBJECTS ====================

-- Typed memory objects — canonical representation of extracted knowledge
CREATE TABLE IF NOT EXISTS memory_objects (
    object_id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL CHECK(object_type IN (
        'raw_record', 'narrative_summary', 'decision_trace',
        'claim', 'constraint', 'assumption', 'correction',
        'risk', 'open_question', 'derived_conclusion'
    )),
    dialogue_id TEXT NOT NULL,
    workflow_id TEXT,
    domain TEXT,
    actor TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    authority_level TEXT NOT NULL CHECK(authority_level IN (
        'exploratory_discussion', 'agent_inference', 'accepted_artifact',
        'human_validated', 'approved_requirement', 'approved_decision',
        'test_evidence', 'incident_evidence', 'policy_invariant'
    )) DEFAULT 'agent_inference',
    superseded_by TEXT,
    superseded_at TEXT,
    validation_status TEXT CHECK(validation_status IN (
        'pending', 'validated', 'rejected', 'uncertain'
    )) DEFAULT 'pending',
    extraction_method TEXT,
    extraction_run_id TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_at TEXT,
    effective_from TEXT,
    effective_to TEXT,
    source_table TEXT,
    source_id TEXT,
    source_segment TEXT,
    model_id TEXT,
    prompt_version TEXT,
    parent_object_id TEXT,
    FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
);
CREATE INDEX IF NOT EXISTS idx_mo_dialogue ON memory_objects(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_mo_type ON memory_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_mo_authority ON memory_objects(authority_level);
CREATE INDEX IF NOT EXISTS idx_mo_superseded ON memory_objects(superseded_by);
CREATE INDEX IF NOT EXISTS idx_mo_source ON memory_objects(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_mo_recorded ON memory_objects(recorded_at);
CREATE INDEX IF NOT EXISTS idx_mo_event ON memory_objects(event_at);
CREATE INDEX IF NOT EXISTS idx_mo_domain ON memory_objects(domain);

-- ==================== MEMORY EDGES ====================

-- Typed edges between memory objects — the memory graph
CREATE TABLE IF NOT EXISTS memory_edges (
    edge_id TEXT PRIMARY KEY,
    edge_type TEXT NOT NULL CHECK(edge_type IN (
        'supports', 'contradicts', 'supersedes', 'derived_from',
        'implements', 'blocked_by', 'answers', 'raises',
        'invalidates', 'depends_on'
    )),
    from_object_id TEXT NOT NULL,
    to_object_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    evidence TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_object_id) REFERENCES memory_objects(object_id),
    FOREIGN KEY (to_object_id) REFERENCES memory_objects(object_id)
);
CREATE INDEX IF NOT EXISTS idx_me_type ON memory_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_me_from ON memory_edges(from_object_id);
CREATE INDEX IF NOT EXISTS idx_me_to ON memory_edges(to_object_id);

-- ==================== EXTRACTION AUDIT ====================

-- Extraction run audit trail — tracks each ingestion batch
CREATE TABLE IF NOT EXISTS memory_extraction_runs (
    run_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('incremental', 'full', 'repair')),
    model_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    objects_created INTEGER NOT NULL DEFAULT 0,
    edges_created INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running'
);
CREATE INDEX IF NOT EXISTS idx_mer_dialogue ON memory_extraction_runs(dialogue_id);

-- ==================== CONTEXT PACKET CACHE ====================

-- Caches previously generated ContextPackets for reuse
CREATE TABLE IF NOT EXISTS memory_context_packets (
    packet_id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('fast', 'research', 'audit')),
    packet TEXT NOT NULL,
    memory_object_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_dialogue ON memory_context_packets(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_mcp_hash ON memory_context_packets(query_hash);

-- ==================== EMBEDDINGS SOURCE_TYPE WIDENING ====================

-- Widen source_type CHECK to include 'memory_object'
-- SQLite cannot ALTER CHECK constraints; recreate the table.
CREATE TABLE IF NOT EXISTS embeddings_v13 (
    embedding_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK(source_type IN (
        'narrative_memory', 'decision_trace', 'open_loop',
        'dialogue_event', 'claim', 'verdict', 'memory_object'
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

INSERT INTO embeddings_v13 (embedding_id, source_type, source_id, dialogue_id, content_text, content_hash, embedding, model, dimensions, created_at)
    SELECT embedding_id, source_type, source_id, dialogue_id, content_text, content_hash, embedding, model, dimensions, created_at
    FROM embeddings;

DROP TABLE embeddings;
ALTER TABLE embeddings_v13 RENAME TO embeddings;
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_dialogue ON embeddings(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);
`,
	},
];
