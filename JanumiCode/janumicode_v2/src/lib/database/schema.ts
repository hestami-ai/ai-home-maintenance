/**
 * Governed Stream Database Schema — full DDL from spec §11.
 * SQLite with WAL mode, FTS5, and prepared sqlite-vec stub.
 */

/**
 * Core schema DDL. Executed on database creation.
 * All tables deployed immediately per Wave 1 decision — tables are cheap.
 */
export const SCHEMA_DDL = `
-- Enable WAL mode for concurrent readers during writes
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;

-- ── Workflow Run registry ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_runs (
  id                            TEXT PRIMARY KEY,
  workspace_id                  TEXT NOT NULL,
  janumicode_version_sha        TEXT NOT NULL,
  initiated_at                  TEXT NOT NULL,
  completed_at                  TEXT,
  status                        TEXT NOT NULL DEFAULT 'initiated',
  current_phase_id              TEXT,
  current_sub_phase_id          TEXT,
  raw_intent_record_id          TEXT,
  scope_classification_ref      TEXT,
  compliance_context_ref        TEXT,
  cross_run_impact_triggered    INTEGER DEFAULT 0,
  intent_lens                   TEXT,
  decomposition_budget_calls_used INTEGER DEFAULT 0,  -- sum of fr + nfr
  decomposition_fr_calls_used     INTEGER DEFAULT 0,
  decomposition_nfr_calls_used    INTEGER DEFAULT 0,
  decomposition_max_depth_reached INTEGER DEFAULT 0,
  active_release_plan_record_id   TEXT
);

-- ── Universal record store — the Governed Stream (lossless) ─────────

CREATE TABLE IF NOT EXISTS governed_stream (
  id                            TEXT PRIMARY KEY,
  record_type                   TEXT NOT NULL,
  schema_version                TEXT NOT NULL,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT,
  sub_phase_id                  TEXT,
  produced_by_agent_role        TEXT,
  produced_by_record_id         TEXT,
  produced_at                   TEXT NOT NULL,
  effective_at                  TEXT,
  janumicode_version_sha        TEXT NOT NULL,
  authority_level               INTEGER NOT NULL DEFAULT 2,
  derived_from_system_proposal  INTEGER DEFAULT 0,
  is_current_version            INTEGER DEFAULT 1,
  superseded_by_id              TEXT,
  superseded_at                 TEXT,
  superseded_by_record_id       TEXT,
  source_workflow_run_id        TEXT NOT NULL,
  derived_from_record_ids       TEXT, -- JSON array of UUIDs
  quarantined                   INTEGER DEFAULT 0,
  sanitized                     INTEGER DEFAULT 0,
  sanitized_fields              TEXT, -- JSON array of field names
  content                       TEXT NOT NULL, -- JSON object
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS gs_workflow ON governed_stream(workflow_run_id);
CREATE INDEX IF NOT EXISTS gs_record_type ON governed_stream(record_type);
CREATE INDEX IF NOT EXISTS gs_phase ON governed_stream(phase_id);
CREATE INDEX IF NOT EXISTS gs_produced_at ON governed_stream(produced_at);
CREATE INDEX IF NOT EXISTS gs_authority ON governed_stream(authority_level);
CREATE INDEX IF NOT EXISTS gs_quarantined ON governed_stream(quarantined) WHERE quarantined = 1;

-- ── Phase Gate completion registry ──────────────────────────────────

CREATE TABLE IF NOT EXISTS phase_gates (
  id                            TEXT PRIMARY KEY,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT NOT NULL,
  sub_phase_id                  TEXT,
  completed_at                  TEXT NOT NULL,
  human_approved                INTEGER NOT NULL,
  approval_record_id            TEXT NOT NULL,
  domain_attestation_confirmed  INTEGER DEFAULT 0,
  invalidated_by_rollback_at    TEXT,
  verification_ensemble_used    INTEGER DEFAULT 0,
  narrative_memory_id           TEXT,
  decision_trace_id             TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS pg_workflow ON phase_gates(workflow_run_id);
CREATE INDEX IF NOT EXISTS pg_phase ON phase_gates(phase_id);

-- ── Retry and loop detection ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_phase_execution_log (
  id                            TEXT PRIMARY KEY,
  workflow_run_id               TEXT NOT NULL,
  phase_id                      TEXT NOT NULL,
  sub_phase_id                  TEXT NOT NULL,
  attempt_number                INTEGER NOT NULL,
  started_at                    TEXT NOT NULL,
  completed_at                  TEXT,
  status                        TEXT NOT NULL,
  loop_status                   TEXT,
  tool_call_loop_detected       INTEGER DEFAULT 0,
  unsticking_session_id         TEXT
);

CREATE INDEX IF NOT EXISTS spel_workflow ON sub_phase_execution_log(workflow_run_id);
CREATE INDEX IF NOT EXISTS spel_sub_phase ON sub_phase_execution_log(sub_phase_id);

-- ── Agent Invocation trace index ────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_invocation_trace (
  invocation_record_id          TEXT NOT NULL,
  trace_record_id               TEXT NOT NULL,
  trace_record_type             TEXT NOT NULL,
  sequence_position             INTEGER NOT NULL,
  PRIMARY KEY (invocation_record_id, trace_record_id),
  FOREIGN KEY (invocation_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (trace_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX IF NOT EXISTS ait_invocation ON agent_invocation_trace(invocation_record_id);
CREATE INDEX IF NOT EXISTS ait_record_type ON agent_invocation_trace(invocation_record_id, trace_record_type);

-- ── Memory Edge table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_edge (
  id                            TEXT PRIMARY KEY,
  source_record_id              TEXT NOT NULL,
  target_record_id              TEXT NOT NULL,
  edge_type                     TEXT NOT NULL,
  asserted_by                   TEXT NOT NULL,
  asserted_at                   TEXT NOT NULL,
  authority_level               INTEGER NOT NULL,
  confidence                    REAL,
  status                        TEXT NOT NULL DEFAULT 'proposed',
  workflow_run_id               TEXT,
  notes                         TEXT,
  FOREIGN KEY (source_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (target_record_id) REFERENCES governed_stream(id)
);

CREATE INDEX IF NOT EXISTS me_source ON memory_edge(source_record_id);
CREATE INDEX IF NOT EXISTS me_target ON memory_edge(target_record_id);
CREATE INDEX IF NOT EXISTS me_type ON memory_edge(edge_type);
CREATE INDEX IF NOT EXISTS me_asserted ON memory_edge(asserted_by, authority_level);
CREATE INDEX IF NOT EXISTS me_status ON memory_edge(status);

-- ── FTS5 full-text search with BM25 ────────────────────────────────

CREATE VIRTUAL TABLE IF NOT EXISTS governed_stream_fts USING fts5(
  id UNINDEXED,
  record_type,
  content,
  content='governed_stream',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync with governed_stream
CREATE TRIGGER IF NOT EXISTS gs_fts_insert AFTER INSERT ON governed_stream BEGIN
  INSERT INTO governed_stream_fts(rowid, id, record_type, content)
  VALUES (new.rowid, new.id, new.record_type, new.content);
END;

CREATE TRIGGER IF NOT EXISTS gs_fts_delete BEFORE DELETE ON governed_stream BEGIN
  INSERT INTO governed_stream_fts(governed_stream_fts, rowid, id, record_type, content)
  VALUES ('delete', old.rowid, old.id, old.record_type, old.content);
END;

CREATE TRIGGER IF NOT EXISTS gs_fts_update BEFORE UPDATE ON governed_stream BEGIN
  INSERT INTO governed_stream_fts(governed_stream_fts, rowid, id, record_type, content)
  VALUES ('delete', old.rowid, old.id, old.record_type, old.content);
END;

CREATE TRIGGER IF NOT EXISTS gs_fts_update_after AFTER UPDATE ON governed_stream BEGIN
  INSERT INTO governed_stream_fts(rowid, id, record_type, content)
  VALUES (new.rowid, new.id, new.record_type, new.content);
END;

-- ── File system write tracking ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_system_writes (
  id                            TEXT PRIMARY KEY,
  agent_invocation_id           TEXT NOT NULL,
  implementation_task_id        TEXT,
  workflow_run_id               TEXT NOT NULL,
  operation                     TEXT NOT NULL,
  file_path                     TEXT NOT NULL,
  file_sha256_before            TEXT,
  file_sha256_after             TEXT,
  produced_at                   TEXT NOT NULL,
  reverted_at                   TEXT,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS fsw_workflow ON file_system_writes(workflow_run_id);
CREATE INDEX IF NOT EXISTS fsw_task ON file_system_writes(implementation_task_id);
CREATE INDEX IF NOT EXISTS fsw_path ON file_system_writes(file_path);

-- -- Sub-Artifact Registry (Architecture Canvas) ------------------------

/**
 * Maps semantic IDs (e.g., "COMP-001") to parent governed_stream records.
 * Enables canvas nodes to use stable semantic IDs for layout persistence.
 */
CREATE TABLE IF NOT EXISTS sub_artifact (
  id                  TEXT PRIMARY KEY,     -- Semantic ID (e.g., "COMP-001")
  parent_record_id    TEXT NOT NULL,       -- governed_stream.id
  json_path           TEXT NOT NULL,       -- JSON path within parent content
  kind                TEXT NOT NULL,       -- 'component', 'responsibility', 'adr', etc.
  workflow_run_id     TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  FOREIGN KEY (parent_record_id) REFERENCES governed_stream(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS sa_parent ON sub_artifact(parent_record_id);
CREATE INDEX IF NOT EXISTS sa_kind ON sub_artifact(kind);
CREATE INDEX IF NOT EXISTS sa_workflow ON sub_artifact(workflow_run_id);

-- -- Sub-Artifact Edges (Architecture Canvas) ---------------------------

/**
 * Edges between sub-artifacts (satisfies, depends_on, governs).
 * Stored separately from memory_edge because endpoints are semantic IDs,
 * not governed_stream record IDs.
 */
CREATE TABLE IF NOT EXISTS sub_artifact_edge (
  id                  TEXT PRIMARY KEY,
  source_id           TEXT NOT NULL,       -- Semantic ID
  target_id           TEXT NOT NULL,       -- Semantic ID
  edge_type           TEXT NOT NULL,       -- 'satisfies', 'depends_on', 'governs'
  asserted_by         TEXT NOT NULL,
  asserted_at         TEXT NOT NULL,
  authority_level     INTEGER NOT NULL DEFAULT 5,
  status              TEXT NOT NULL DEFAULT 'system_asserted',
  workflow_run_id     TEXT NOT NULL,
  notes               TEXT,
  FOREIGN KEY (source_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (target_id) REFERENCES sub_artifact(id),
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
);

CREATE INDEX IF NOT EXISTS sae_source ON sub_artifact_edge(source_id);
CREATE INDEX IF NOT EXISTS sae_target ON sub_artifact_edge(target_id);
CREATE INDEX IF NOT EXISTS sae_type ON sub_artifact_edge(edge_type);
CREATE INDEX IF NOT EXISTS sae_workflow ON sub_artifact_edge(workflow_run_id);

-- -- Canvas Layout State (Architecture Canvas) --------------------------

/**
 * Persists node positions for architecture canvas.
 * Uses semantic IDs for node_id to ensure stability under reordering.
 */
CREATE TABLE IF NOT EXISTS canvas_layout_state (
  workflow_run_id     TEXT NOT NULL,
  node_id             TEXT NOT NULL,       -- Semantic ID
  x                   REAL NOT NULL,
  y                   REAL NOT NULL,
  width               REAL,
  height              REAL,
  collapsed           INTEGER DEFAULT 0,
  user_positioned     INTEGER DEFAULT 0,
  last_modified_at    TEXT NOT NULL,
  PRIMARY KEY (workflow_run_id, node_id)
);
`;

/**
 * Vector search table DDL — Ollama-backed embedding pipeline (Wave 5).
 *
 * Stores Float32Array embeddings as BLOB. Cosine similarity is computed in
 * JavaScript at retrieval time over a candidate set bounded by FTS5 / record
 * filters. No sqlite-vec dependency. The table is created unconditionally as
 * part of the base schema.
 */
export const VECTOR_SEARCH_DDL = `
CREATE TABLE IF NOT EXISTS governed_stream_vec (
  record_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  embedding_model TEXT NOT NULL,
  embedded_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES governed_stream(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gsvec_model ON governed_stream_vec(embedding_model);
`;
