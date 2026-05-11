/**
 * SCHEMA_V1 — JanumiLegal greenfield database schema.
 *
 * Per:
 *   - docs/janumilegal_implementation_roadmap.md Wave 0 §0.2
 *   - docs/janumilegal_multi_matter_isolation_addendum.md §4 §9
 *   - docs/design/governed_stream_privilege.md §3
 *
 * Conventions:
 *   - Every domain table carries (firm_id, client_id, matter_id) where applicable.
 *   - Tenant-agnostic tables (firms, canonical_vocabulary, agents, lens_pack_catalog,
 *     operational telemetry) are explicitly listed and reviewed.
 *   - All TEXT IDs are UUIDs assigned by the application; the DB does not generate them.
 *   - No application code outside src/lib/database/ may execute SQL directly.
 *   - The op-track Governed Stream and the matter-track Governed Stream are separate;
 *     matter-track storage is per-matter file (per privilege design §3.3) — this schema
 *     covers the platform DB; per-matter Governed Stream files have their own micro-schema.
 */

export const SCHEMA_V1_VERSION = 1;

export const SCHEMA_V1_STATEMENTS: readonly string[] = [
  // ── Schema bookkeeping ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`,

  // ── Tenant-agnostic registries ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS firms (
    firm_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_jurisdiction TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS canonical_vocabulary (
    term_id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    one_line_definition TEXT NOT NULL,
    long_definition TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('core','practice_area','jurisdiction','firm')),
    scope_qualifier TEXT,
    allowed_synonyms_json TEXT NOT NULL DEFAULT '[]',
    prohibited_synonyms_json TEXT NOT NULL DEFAULT '[]',
    jurisdiction_variants_json TEXT NOT NULL DEFAULT '{}',
    collisions_with_json TEXT NOT NULL DEFAULT '[]',
    example_usage_json TEXT NOT NULL DEFAULT '[]',
    example_misuse_json TEXT NOT NULL DEFAULT '[]',
    governing_authority TEXT,
    version TEXT NOT NULL,
    supersedes TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    tier TEXT NOT NULL,
    capability_group_a TEXT,
    capability_group_b TEXT,
    capability_group_c TEXT,
    permitted_lenses_json TEXT NOT NULL DEFAULT '[]',
    permitted_states_json TEXT NOT NULL DEFAULT '[]',
    input_schema TEXT NOT NULL,
    output_schema TEXT NOT NULL,
    prohibited_actions_json TEXT NOT NULL DEFAULT '[]',
    required_validators_json TEXT NOT NULL DEFAULT '[]',
    confidence_policy_json TEXT NOT NULL,
    authority_policy_json TEXT NOT NULL,
    privilege_policy_json TEXT NOT NULL,
    version TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS lens_pack_catalog (
    lens_id TEXT NOT NULL,
    lens_version TEXT NOT NULL,
    practice_area TEXT NOT NULL,
    applicable_jurisdictions_json TEXT NOT NULL DEFAULT '[]',
    manifest_json TEXT NOT NULL,
    clv_bindings_json TEXT NOT NULL DEFAULT '[]',
    supersedes TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (lens_id, lens_version)
  )`,

  // ── Tenant tables ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS clients (
    firm_id TEXT NOT NULL REFERENCES firms(firm_id),
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    entity_type TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id)
  )`,

  `CREATE TABLE IF NOT EXISTS matters (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    matter_name TEXT NOT NULL,
    practice_area TEXT NOT NULL,
    primary_jurisdiction TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    procedural_posture TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    PRIMARY KEY (firm_id, client_id, matter_id),
    FOREIGN KEY (firm_id, client_id) REFERENCES clients(firm_id, client_id)
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    firm_id TEXT NOT NULL REFERENCES firms(firm_id),
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('attorney','paralegal','legal_assistant','knowledge_attorney','conflicts_officer','admin','intake_only')),
    bar_numbers_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_matter_access (
    firm_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('attorney_of_record','supervising','reviewer','drafter','paralegal','legal_assistant','knowledge_attorney','billing','intake_only','screened_out')),
    classification_ceiling TEXT,
    redacted_fields_json TEXT NOT NULL DEFAULT '[]',
    read_only INTEGER NOT NULL DEFAULT 0,
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    granted_by TEXT NOT NULL,
    grant_basis TEXT NOT NULL,
    PRIMARY KEY (firm_id, user_id, client_id, matter_id),
    FOREIGN KEY (firm_id, user_id) REFERENCES users(firm_id, user_id),
    FOREIGN KEY (firm_id, client_id, matter_id) REFERENCES matters(firm_id, client_id, matter_id)
  )`,

  `CREATE TABLE IF NOT EXISTS joint_representation_groups (
    firm_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    client_ids_json TEXT NOT NULL,
    attorney_ids_json TEXT NOT NULL,
    consent_basis TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    PRIMARY KEY (firm_id, group_id)
  )`,

  `CREATE TABLE IF NOT EXISTS common_interest_links (
    firm_id TEXT NOT NULL,
    link_id TEXT NOT NULL,
    matter_ids_json TEXT NOT NULL,
    agreement_basis TEXT NOT NULL,
    shared_artifact_ids_json TEXT NOT NULL DEFAULT '[]',
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    authorized_by_json TEXT NOT NULL,
    PRIMARY KEY (firm_id, link_id)
  )`,

  // ── Per-matter governance + workflow tables ─────────────────────
  `CREATE TABLE IF NOT EXISTS matter_keys (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    content_key_envelope BLOB NOT NULL,
    mental_key_envelope BLOB NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id, matter_id),
    FOREIGN KEY (firm_id, client_id, matter_id) REFERENCES matters(firm_id, client_id, matter_id)
  )`,

  `CREATE TABLE IF NOT EXISTS matter_lens_activations (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    activation_id TEXT NOT NULL,
    lens_id TEXT NOT NULL,
    lens_version TEXT NOT NULL,
    activated_by TEXT NOT NULL,
    activated_at TEXT NOT NULL,
    deactivated_at TEXT,
    PRIMARY KEY (firm_id, client_id, matter_id, activation_id),
    FOREIGN KEY (firm_id, client_id, matter_id) REFERENCES matters(firm_id, client_id, matter_id),
    FOREIGN KEY (lens_id, lens_version) REFERENCES lens_pack_catalog(lens_id, lens_version)
  )`,

  `CREATE TABLE IF NOT EXISTS state_outputs (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    activation_id TEXT NOT NULL,
    state_id TEXT NOT NULL,
    output_json TEXT NOT NULL,
    output_hash TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id, matter_id, activation_id, state_id)
  )`,

  `CREATE TABLE IF NOT EXISTS artifacts (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    version_hash TEXT NOT NULL,
    state_of_origin TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    release_status TEXT NOT NULL DEFAULT 'internal_draft',
    created_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id, matter_id, artifact_id)
  )`,

  `CREATE TABLE IF NOT EXISTS attorney_actions (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    artifact_version_hash TEXT NOT NULL,
    attorney_id TEXT NOT NULL,
    attorney_role TEXT NOT NULL,
    action TEXT NOT NULL,
    signature_mode TEXT,
    jurisdiction_requirements_met INTEGER NOT NULL DEFAULT 0,
    bar_numbers_at_action_json TEXT NOT NULL DEFAULT '[]',
    timestamp TEXT NOT NULL,
    governed_stream_event_id TEXT NOT NULL,
    acknowledged_findings_json TEXT,
    override_rationale TEXT,
    PRIMARY KEY (firm_id, client_id, matter_id, action_id)
  )`,

  `CREATE TABLE IF NOT EXISTS agent_runs (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    activation_id TEXT NOT NULL,
    state_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    input_hash TEXT NOT NULL,
    output_hash TEXT,
    error_class TEXT,
    PRIMARY KEY (firm_id, client_id, matter_id, run_id)
  )`,

  `CREATE TABLE IF NOT EXISTS matter_context_switches (
    firm_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    switch_id TEXT NOT NULL,
    from_matter_id TEXT,
    to_matter_id TEXT,
    switched_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, user_id, session_id, switch_id)
  )`,

  `CREATE TABLE IF NOT EXISTS cross_matter_operation_audit (
    firm_id TEXT NOT NULL,
    audit_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('joint_representation','common_interest','conflicts_check','brief_bank_promotion','operational_metadata','discovery_production')),
    matter_ids_json TEXT NOT NULL,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    PRIMARY KEY (firm_id, audit_id)
  )`,

  // ── Lens version migrations (Wave 8) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS lens_version_migrations (
    lens_id TEXT NOT NULL,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('SAFE','PARTIAL','INCOMPATIBLE')),
    stale_states_json TEXT NOT NULL DEFAULT '[]',
    incompatibility_reason TEXT,
    declared_at TEXT NOT NULL,
    PRIMARY KEY (lens_id, from_version, to_version)
  )`,

  // ── Attorney admissions (Wave 7) ────────────────────────────────
  `CREATE TABLE IF NOT EXISTS attorney_admissions (
    firm_id TEXT NOT NULL,
    attorney_id TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    bar_number TEXT NOT NULL,
    admitted_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','inactive','suspended')),
    PRIMARY KEY (firm_id, attorney_id, jurisdiction)
  )`,

  // ── Source-to-claim traces (Wave 6) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS source_to_claim_traces (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    artifact_id TEXT,
    assertion_text TEXT NOT NULL,
    assertion_kind TEXT NOT NULL CHECK (assertion_kind IN ('fact','authority','characterization','recommendation','citation')),
    source_id TEXT NOT NULL,
    supporting_span TEXT,
    state_id TEXT,
    verification_label TEXT NOT NULL,
    attorney_confirmed_action_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id, matter_id, trace_id),
    FOREIGN KEY (firm_id, client_id, matter_id) REFERENCES matters(firm_id, client_id, matter_id)
  )`,

  // ── Brief bank / firm knowledge artifacts (Wave 6) ──────────────
  `CREATE TABLE IF NOT EXISTS firm_knowledge_artifacts (
    firm_id TEXT NOT NULL,
    knowledge_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    content_scrubbed TEXT NOT NULL,
    promoted_from_firm_id TEXT NOT NULL,
    promoted_from_client_id TEXT NOT NULL,
    promoted_from_matter_id TEXT NOT NULL,
    promoted_from_artifact_id TEXT NOT NULL,
    promoted_at TEXT NOT NULL,
    promoted_by_attorney_id TEXT NOT NULL,
    promoted_by_attorney_action_id TEXT NOT NULL,
    PRIMARY KEY (firm_id, knowledge_id)
  )`,

  // ── Privilege Frame snapshots (Wave 3) ──────────────────────────
  `CREATE TABLE IF NOT EXISTS privilege_frame_snapshots (
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    version INTEGER NOT NULL,
    frame_json TEXT NOT NULL,
    produced_at TEXT NOT NULL,
    PRIMARY KEY (firm_id, client_id, matter_id, snapshot_id),
    FOREIGN KEY (firm_id, client_id, matter_id) REFERENCES matters(firm_id, client_id, matter_id)
  )`,

  // ── Export records (Wave 3, op-track adjacent) ─────────────────
  `CREATE TABLE IF NOT EXISTS export_records (
    export_id TEXT PRIMARY KEY,
    firm_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    matter_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    classification_filter_json TEXT NOT NULL,
    redaction_summary_json TEXT NOT NULL,
    package_hash TEXT NOT NULL,
    exported_at TEXT NOT NULL
  )`,

  // ── VCC reports (Wave 1) ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS vocabulary_collision_reports (
    report_id TEXT PRIMARY KEY,
    firm_id TEXT,
    trigger TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('allow','allow_with_ack','block')),
    blocking_count INTEGER NOT NULL DEFAULT 0,
    warn_ack_count INTEGER NOT NULL DEFAULT 0,
    warn_count INTEGER NOT NULL DEFAULT 0,
    collisions_json TEXT NOT NULL,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    produced_at TEXT NOT NULL
  )`,

  // ── Prompt template registry (Wave 1) ───────────────────────────
  `CREATE TABLE IF NOT EXISTS prompt_templates (
    template_id TEXT NOT NULL,
    template_version TEXT NOT NULL,
    lens_id TEXT,
    state_id TEXT,
    body TEXT NOT NULL,
    clv_bindings_json TEXT NOT NULL DEFAULT '[]',
    registered_at TEXT NOT NULL,
    PRIMARY KEY (template_id, template_version)
  )`,

  // ── Operational-track Governed Stream (non-substantive telemetry) ─
  `CREATE TABLE IF NOT EXISTS governed_stream_op (
    event_id TEXT PRIMARY KEY,
    firm_id TEXT NOT NULL,
    client_id TEXT,
    matter_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    written_at TEXT NOT NULL
  )`,

  // ── Indexes ──────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_matters_firm_client ON matters(firm_id, client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_matter_access_user ON user_matter_access(firm_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_matter_access_matter ON user_matter_access(firm_id, client_id, matter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_state_outputs_matter ON state_outputs(firm_id, client_id, matter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_matter ON artifacts(firm_id, client_id, matter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attorney_actions_artifact ON attorney_actions(firm_id, client_id, matter_id, artifact_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_matter ON agent_runs(firm_id, client_id, matter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_governed_stream_op_firm_time ON governed_stream_op(firm_id, written_at)`,
];

/**
 * Domain tables that MUST carry the (firm_id, client_id, matter_id) scope tuple.
 * Used by `validateSchema()` to assert the tenancy invariant.
 */
export const SCOPED_DOMAIN_TABLES: readonly string[] = [
  'matters',
  'matter_keys',
  'matter_lens_activations',
  'state_outputs',
  'artifacts',
  'attorney_actions',
  'agent_runs',
  'privilege_frame_snapshots',
  'export_records',
  'source_to_claim_traces',
];

/**
 * Tables intentionally NOT scoped — registry / catalog / operational tables.
 */
export const UNSCOPED_REGISTRY_TABLES: readonly string[] = [
  'schema_version',
  'firms',
  'canonical_vocabulary',
  'agents',
  'lens_pack_catalog',
];
