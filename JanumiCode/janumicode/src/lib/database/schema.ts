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
];
