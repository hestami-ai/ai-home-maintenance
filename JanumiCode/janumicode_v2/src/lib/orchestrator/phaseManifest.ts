/**
 * Phase Manifest — single source of truth for phase / sub-phase identity,
 * ordering, and display rendering across the entire JanumiCode workflow.
 *
 * Design (Pattern 3 from the naming-audit discussion):
 *
 *   - Stable IDs are *semantic slugs*, not position-encoded numerics.
 *     `fr_saturation` is what's stored in `governed_stream.sub_phase_id`,
 *     in prompt-template frontmatter, in fixtures, in logs.
 *
 *   - Execution order IS the manifest array order. To insert a new
 *     sub-phase between two existing ones, drop a new entry in the
 *     right place. No neighbour renames.
 *
 *   - Display codes (`2.1.4`, `1.3.2`, etc.) are *derived at render
 *     time* from manifest position + optional `group` clustering. They
 *     are a UI concern only — never persisted.
 *
 *   - `group` lets related sub-phases share a numeric slot at the
 *     parent level. For example the four entries of the FR three-pass
 *     bloom + saturation share `group: 'fr_bloom'`, so they render as
 *     `2.1.1`–`2.1.4` rather than `2.1`, `2.2`, `2.3`, `2.4`.
 *
 *   - Cross-cutting entries have no parent phase and no display code;
 *     they render as `[slug]` in logs.
 *
 * Why slugs (not numerics) for the stable ID:
 *
 *   - Insertion is free — no neighbour rename, no DB migration
 *   - Self-documenting in raw DB queries and logs
 *   - Eliminates the lexical-vs-execution-order trap that produced
 *     `2.1a` (saturation, runs last) following `2.1c` (verifier)
 *   - Naturally fixes the duplicate-prefix collisions in Phase 1 prompt
 *     directories (`01_2_business_domains_bloom` vs
 *     `01_2_intent_domain_bloom` etc.) — every step has a unique slug
 */

// ── Types ────────────────────────────────────────────────────────────

/**
 * A top-level phase. Phase display codes are hand-set rather than
 * derived, because phases are stable structural anchors that rarely
 * change. Phase 0.5 (cross-cutting bootstrap) is the one half-step.
 */
export interface PhaseEntry {
  /** Stable slug — what code references via constants. */
  readonly id: string;
  /** Hand-set display code (`'0'`, `'0.5'`, `'1'`, ...). */
  readonly displayCode: string;
  /** Human-readable name (e.g. `'Requirements'`). */
  readonly displayName: string;
  /** One-line description for tooling/UI. */
  readonly description: string;
}

/**
 * A sub-phase within a parent phase. Position in the `subPhases` array
 * defines execution order. Display code is computed from position +
 * optional `group` clustering.
 */
export interface SubPhaseEntry {
  /** Stable slug — what's persisted everywhere. */
  readonly id: string;
  /** Parent phase slug. Must match a `PhaseEntry.id`. */
  readonly parentPhase: string;
  /**
   * Optional group slug. Sub-phases sharing a group get nested display
   * codes (e.g. `2.1.1`, `2.1.2`) rather than flat ones (`2.1`, `2.2`).
   * The group occupies one numeric slot at the parent level.
   */
  readonly group?: string;
  /** Human-readable name. */
  readonly displayName: string;
  /** One-line description. */
  readonly description: string;
  /**
   * Agent role (matches prompt-template frontmatter `agent_role`).
   * `null` for purely deterministic / synthesis steps that have no
   * LLM call.
   */
  readonly agentRole: string | null;
}

/**
 * A cross-cutting sub-phase that runs outside the linear phase
 * pipeline (reasoning review, vocabulary check, narrative memory,
 * etc.). No parent phase, no display code.
 */
export interface CrossCuttingEntry {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly agentRole: string | null;
}

// ── Phase manifest ────────────────────────────────────────────────────

export const PHASES: readonly PhaseEntry[] = [
  {
    id: 'workspace_init',
    displayCode: '0',
    displayName: 'Workspace Init',
    description: 'Workspace classification, ingestion, constraint extraction, vocabulary check.',
  },
  {
    id: 'cross_run_impact_analysis',
    displayCode: '0.5',
    displayName: 'Cross-Run Impact Analysis',
    description: 'Conditional analysis when prior decision overrides reference phase-gate-certified artifacts from prior runs.',
  },
  {
    id: 'intent_capture',
    displayCode: '1',
    displayName: 'Intent Capture',
    description: 'Intent quality check, lens classification, discovery, scope, blooms, product description.',
  },
  {
    id: 'requirements',
    displayCode: '2',
    displayName: 'Requirements',
    description: 'Functional + non-functional requirement bloom (skeleton/enrichment/verifier/saturation), finalize, gate.',
  },
  {
    id: 'system_specification',
    displayCode: '3',
    displayName: 'System Specification',
    description: 'System boundary, system requirements, interface contracts, finalize, gate.',
  },
  {
    id: 'architecture',
    displayCode: '4',
    displayName: 'Architecture',
    description: 'Software domains, component decomposition (skeleton + saturation), ADR capture, synthesis, gate.',
  },
  {
    id: 'technical_specification',
    displayCode: '5',
    displayName: 'Technical Specification',
    description: 'Data models (skeleton + saturation), API definitions, error handling, configuration, synthesis, gate.',
  },
  {
    id: 'implementation_planning',
    displayCode: '6',
    displayName: 'Implementation Planning',
    description: 'Task generation (skeleton + saturation), plan synthesis, gate.',
  },
  {
    id: 'test_planning',
    displayCode: '7',
    displayName: 'Test Planning',
    description: 'Test case generation (skeleton + saturation), test plan synthesis, mirror/menu, gate.',
  },
  {
    id: 'evaluation_planning',
    displayCode: '8',
    displayName: 'Evaluation Planning',
    description: 'Evaluation design, metrics, thresholds, synthesis, gate.',
  },
  {
    id: 'execution',
    displayCode: '9',
    displayName: 'Execution',
    description: 'Implementation, test execution, evaluation execution, synthesis, gate.',
  },
  {
    id: 'commit',
    displayCode: '10',
    displayName: 'Commit',
    description: 'Commit prep, execute, finalize.',
  },
] as const;

// ── Sub-phase manifest (execution order) ──────────────────────────────

export const SUB_PHASES: readonly SubPhaseEntry[] = [
  // ── Phase 0 — workspace_init ────────────────────────────────────────
  {
    id: 'workspace_classification',
    parentPhase: 'workspace_init',
    group: 'workspace_setup',
    displayName: 'Workspace Classification',
    description: 'Classify workspace as greenfield or brownfield.',
    agentRole: 'orchestrator',
  },
  {
    id: 'external_reference_resolution',
    parentPhase: 'workspace_init',
    group: 'workspace_setup',
    displayName: 'External Reference Resolution',
    description: 'Resolve explicit file references from the raw intent so Phase 1 can bloom from actual content.',
    agentRole: 'orchestrator',
  },
  {
    id: 'artifact_ingestion',
    parentPhase: 'workspace_init',
    group: 'artifact_handling',
    displayName: 'Artifact Ingestion',
    description: 'Ingest brownfield workspace files into the governed stream.',
    agentRole: 'orchestrator',
  },
  {
    id: 'brownfield_continuity_check',
    parentPhase: 'workspace_init',
    group: 'artifact_handling',
    displayName: 'Brownfield Continuity Check',
    description: 'Check continuity of prior decisions against ingested brownfield artifacts.',
    agentRole: 'orchestrator',
  },
  {
    id: 'vocabulary_collision_check',
    parentPhase: 'workspace_init',
    displayName: 'Vocabulary Collision Check',
    description: 'Detect collisions in canonical vocabulary across artifacts.',
    agentRole: 'orchestrator',
  },

  // ── Phase 0.5 — cross_run_impact_analysis ───────────────────────────
  {
    id: 'impact_enumeration',
    parentPhase: 'cross_run_impact_analysis',
    displayName: 'Impact Enumeration',
    description: 'Enumerate cross-run impact of changes to phase-gate-certified artifacts.',
    agentRole: 'consistency_checker',
  },
  {
    id: 'refactoring_decision',
    parentPhase: 'cross_run_impact_analysis',
    displayName: 'Refactoring Decision',
    description: 'Human decision on refactoring scope based on impact report.',
    agentRole: null,
  },

  // ── Phase 1 — intent_capture ────────────────────────────────────────
  {
    id: 'intent_quality_check',
    parentPhase: 'intent_capture',
    displayName: 'Intent Quality Check',
    description: 'Gate raw intent on minimum quality before discovery.',
    agentRole: 'orchestrator',
  },
  {
    id: 'intent_lens_classification',
    parentPhase: 'intent_capture',
    displayName: 'Intent Lens Classification',
    description: 'Classify the intent lens (product/feature/research/etc.).',
    agentRole: 'orchestrator',
  },
  {
    id: 'product_intent_discovery',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'Product Intent Discovery',
    description: 'Silent discovery — product intent dimensions.',
    agentRole: 'orchestrator',
  },
  {
    id: 'technical_constraints_discovery',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'Technical Constraints Discovery',
    description: 'Silent discovery — technical constraints.',
    agentRole: 'orchestrator',
  },
  {
    id: 'compliance_retention_discovery',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'Compliance & Retention Discovery',
    description: 'Silent discovery — compliance regimes and retention requirements.',
    agentRole: 'orchestrator',
  },
  {
    id: 'vv_requirements_discovery',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'V&V Requirements Discovery',
    description: 'Silent discovery — verification & validation requirements.',
    agentRole: 'orchestrator',
  },
  {
    id: 'canonical_vocabulary_discovery',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'Canonical Vocabulary Discovery',
    description: 'Silent discovery — canonical project vocabulary.',
    agentRole: 'orchestrator',
  },
  {
    id: 'discovery_bundle_compose',
    parentPhase: 'intent_capture',
    group: 'silent_discovery',
    displayName: 'Discovery Bundle Compose',
    description: 'Deterministic synthesis of all silent-discovery outputs.',
    agentRole: null,
  },
  {
    id: 'scope_bounding',
    parentPhase: 'intent_capture',
    displayName: 'Scope Bounding',
    description: 'Bound the project scope for downstream phases.',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'business_domains_bloom',
    parentPhase: 'intent_capture',
    displayName: 'Business Domains and Personas Bloom',
    description: 'Bloom business domains and personas (Phase 1.5, product lens Round 1).',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'user_journey_bloom',
    parentPhase: 'intent_capture',
    displayName: 'User Journey Bloom',
    description: 'Bloom user journeys with steps (Phase 1.6, product lens Round 2a).',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'system_workflow_bloom',
    parentPhase: 'intent_capture',
    displayName: 'System Workflow Bloom',
    description: 'Bloom system workflows backing automatable journey steps (Phase 1.7, product lens Round 2b).',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'coverage_verifier',
    parentPhase: 'intent_capture',
    displayName: 'Coverage Verifier',
    description: 'Deterministic verifier that journeys + workflows cover the scope.',
    agentRole: null,
  },
  {
    id: 'entities_bloom',
    parentPhase: 'intent_capture',
    displayName: 'Entities Bloom',
    description: 'Bloom domain entities.',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'integrations_qa_bloom',
    parentPhase: 'intent_capture',
    displayName: 'Integrations & QA Bloom',
    description: 'Bloom integrations and QA scenarios.',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'product_description_synthesis',
    parentPhase: 'intent_capture',
    displayName: 'Product Description Synthesis',
    description: 'Compose the product description handoff document.',
    agentRole: 'domain_interpreter',
  },
  {
    id: 'product_handoff_gate',
    parentPhase: 'intent_capture',
    displayName: 'Product Handoff Gate',
    description: 'Human approval gate for the product description handoff.',
    agentRole: null,
  },
  {
    id: 'release_plan',
    parentPhase: 'intent_capture',
    displayName: 'Release Plan',
    description: 'Synthesize the release plan from approved product description.',
    agentRole: 'domain_interpreter',
  },

  // ── Phase 2 — requirements ──────────────────────────────────────────
  {
    id: 'fr_bloom_skeleton',
    parentPhase: 'requirements',
    group: 'fr_bloom',
    displayName: 'FR Bloom — Skeleton',
    description: 'Pass 1: bloom user-story skeletons for functional requirements.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'fr_bloom_enrichment',
    parentPhase: 'requirements',
    group: 'fr_bloom',
    displayName: 'FR Bloom — Enrichment',
    description: 'Pass 2: enrich skeletons with acceptance criteria.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'fr_bloom_verifier',
    parentPhase: 'requirements',
    group: 'fr_bloom',
    displayName: 'FR Bloom — Verifier',
    description: 'Pass 3: deterministic coverage verifier for FR bloom.',
    agentRole: null,
  },
  {
    id: 'fr_saturation',
    parentPhase: 'requirements',
    group: 'fr_bloom',
    displayName: 'FR Saturation',
    description: 'Recursive decomposition of FR tree to atomic leaves (Wave 6).',
    agentRole: 'requirements_agent',
  },
  {
    id: 'nfr_bloom_skeleton',
    parentPhase: 'requirements',
    group: 'nfr_bloom',
    displayName: 'NFR Bloom — Skeleton',
    description: 'Pass 1: bloom non-functional requirement skeletons.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'nfr_bloom_enrichment',
    parentPhase: 'requirements',
    group: 'nfr_bloom',
    displayName: 'NFR Bloom — Enrichment',
    description: 'Pass 2: enrich NFR skeletons with thresholds and measurement.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'nfr_bloom_verifier',
    parentPhase: 'requirements',
    group: 'nfr_bloom',
    displayName: 'NFR Bloom — Verifier',
    description: 'Pass 3: deterministic coverage verifier for NFR bloom.',
    agentRole: null,
  },
  {
    id: 'nfr_saturation',
    parentPhase: 'requirements',
    group: 'nfr_bloom',
    displayName: 'NFR Saturation',
    description: 'Recursive decomposition of NFR tree to atomic leaves.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'requirement_set_finalize',
    parentPhase: 'requirements',
    displayName: 'Requirement Set Finalize',
    description: 'Finalize FR + NFR set as a coherent requirement document.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'requirement_set_review_prep',
    parentPhase: 'requirements',
    displayName: 'Requirement Set Review Prep',
    description: 'Prepare requirements for human review.',
    agentRole: null,
  },
  {
    id: 'requirements_gate',
    parentPhase: 'requirements',
    displayName: 'Requirements Gate',
    description: 'Human approval gate for the requirement set.',
    agentRole: null,
  },

  // ── Phase 3 — system_specification ──────────────────────────────────
  {
    id: 'system_boundary',
    parentPhase: 'system_specification',
    displayName: 'System Boundary',
    description: 'Define the system boundary (in-scope / out-of-scope).',
    agentRole: 'systems_agent',
  },
  {
    id: 'system_requirements',
    parentPhase: 'system_specification',
    displayName: 'System Requirements',
    description: 'Translate FR/NFR into system requirements.',
    agentRole: 'systems_agent',
  },
  {
    id: 'interface_contracts',
    parentPhase: 'system_specification',
    displayName: 'Interface Contracts',
    description: 'Define external interface contracts.',
    agentRole: 'systems_agent',
  },
  {
    id: 'system_spec_finalize',
    parentPhase: 'system_specification',
    displayName: 'System Spec Finalize',
    description: 'Finalize the system specification document.',
    agentRole: 'systems_agent',
  },
  {
    id: 'system_spec_gate',
    parentPhase: 'system_specification',
    displayName: 'System Spec Gate',
    description: 'Human approval gate for the system specification.',
    agentRole: null,
  },

  // ── Phase 4 — architecture ──────────────────────────────────────────
  {
    id: 'software_domains',
    parentPhase: 'architecture',
    displayName: 'Software Domains',
    description: 'Bloom software domains.',
    agentRole: 'architecture_agent',
  },
  {
    id: 'component_skeleton',
    parentPhase: 'architecture',
    group: 'component_decomposition',
    displayName: 'Component Skeleton',
    description: 'Top-level component decomposition.',
    agentRole: 'architecture_agent',
  },
  {
    id: 'component_saturation',
    parentPhase: 'architecture',
    group: 'component_decomposition',
    displayName: 'Component Saturation',
    description: 'Recursive component decomposition to atomic leaves.',
    agentRole: 'architecture_agent',
  },
  {
    id: 'adr_capture',
    parentPhase: 'architecture',
    displayName: 'ADR Capture',
    description: 'Capture architecture decision records.',
    agentRole: 'architecture_agent',
  },
  {
    id: 'architecture_synthesis',
    parentPhase: 'architecture',
    displayName: 'Architecture Synthesis',
    description: 'Synthesize the architecture document.',
    agentRole: 'architecture_agent',
  },
  {
    id: 'architecture_gate',
    parentPhase: 'architecture',
    displayName: 'Architecture Gate',
    description: 'Human approval gate for the architecture.',
    agentRole: null,
  },

  // ── Phase 5 — technical_specification ───────────────────────────────
  {
    id: 'data_model_skeleton',
    parentPhase: 'technical_specification',
    group: 'data_model',
    displayName: 'Data Model Skeleton',
    description: 'Top-level data model.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'data_model_saturation',
    parentPhase: 'technical_specification',
    group: 'data_model',
    displayName: 'Data Model Saturation',
    description: 'Recursive data model decomposition.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'api_definitions',
    parentPhase: 'technical_specification',
    displayName: 'API Definitions',
    description: 'Define APIs.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'error_handling',
    parentPhase: 'technical_specification',
    displayName: 'Error Handling',
    description: 'Error handling strategy.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'configuration_parameters',
    parentPhase: 'technical_specification',
    displayName: 'Configuration Parameters',
    description: 'Configuration parameter definitions.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'technical_spec_synthesis',
    parentPhase: 'technical_specification',
    displayName: 'Technical Spec Synthesis',
    description: 'Synthesize the technical specification document.',
    agentRole: 'technical_spec_agent',
  },
  {
    id: 'technical_spec_gate',
    parentPhase: 'technical_specification',
    displayName: 'Technical Spec Gate',
    description: 'Human approval gate for the technical spec.',
    agentRole: null,
  },

  // ── Phase 6 — implementation_planning ───────────────────────────────
  {
    id: 'task_skeleton',
    parentPhase: 'implementation_planning',
    group: 'task_decomposition',
    displayName: 'Task Skeleton',
    description: 'Top-level task generation.',
    agentRole: 'implementation_planner',
  },
  {
    id: 'task_saturation',
    parentPhase: 'implementation_planning',
    group: 'task_decomposition',
    displayName: 'Task Saturation',
    description: 'Recursive task decomposition.',
    agentRole: 'implementation_planner',
  },
  {
    id: 'implementation_plan_synthesis',
    parentPhase: 'implementation_planning',
    displayName: 'Implementation Plan Synthesis',
    description: 'Synthesize the implementation plan.',
    agentRole: 'implementation_planner',
  },
  {
    id: 'implementation_plan_gate',
    parentPhase: 'implementation_planning',
    displayName: 'Implementation Plan Gate',
    description: 'Human approval gate for the implementation plan.',
    agentRole: null,
  },

  // ── Phase 7 — test_planning ─────────────────────────────────────────
  {
    id: 'test_case_skeleton',
    parentPhase: 'test_planning',
    group: 'test_decomposition',
    displayName: 'Test Case Skeleton',
    description: 'Top-level test case generation.',
    agentRole: 'test_design_agent',
  },
  {
    id: 'test_case_saturation',
    parentPhase: 'test_planning',
    group: 'test_decomposition',
    displayName: 'Test Case Saturation',
    description: 'Recursive test case decomposition.',
    agentRole: 'test_design_agent',
  },
  {
    id: 'test_plan_synthesis',
    parentPhase: 'test_planning',
    displayName: 'Test Plan Synthesis',
    description: 'Synthesize the test plan.',
    agentRole: 'test_design_agent',
  },
  {
    id: 'test_plan_review_prep',
    parentPhase: 'test_planning',
    displayName: 'Test Plan Mirror and Menu',
    description: 'Present test plan mirror and menu for human review (Phase 7.3).',
    agentRole: 'test_design_agent',
  },
  {
    id: 'test_plan_gate',
    parentPhase: 'test_planning',
    displayName: 'Test Plan Gate',
    description: 'Human approval gate for the test plan.',
    agentRole: null,
  },

  // ── Phase 8 — evaluation_planning ───────────────────────────────────
  // Phase 8.1-8.3 are a single LLM call but advance three sub-phase
  // states in the state machine. Kept as separate manifest entries to
  // preserve that fidelity.
  {
    id: 'evaluation_design',
    parentPhase: 'evaluation_planning',
    displayName: 'Evaluation Design',
    description: 'Design evaluation scenarios (Phase 8.1).',
    agentRole: 'eval_design_agent',
  },
  {
    id: 'evaluation_metrics',
    parentPhase: 'evaluation_planning',
    displayName: 'Evaluation Metrics',
    description: 'Evaluation metrics state advance (Phase 8.2; bundled with 8.1 LLM call).',
    agentRole: null,
  },
  {
    id: 'evaluation_thresholds',
    parentPhase: 'evaluation_planning',
    displayName: 'Evaluation Thresholds',
    description: 'Evaluation thresholds state advance (Phase 8.3; bundled with 8.1 LLM call).',
    agentRole: null,
  },
  {
    id: 'evaluation_synthesis',
    parentPhase: 'evaluation_planning',
    displayName: 'Evaluation Synthesis',
    description: 'Synthesize evaluation plan (Phase 8.4).',
    agentRole: 'eval_design_agent',
  },
  {
    id: 'evaluation_gate',
    parentPhase: 'evaluation_planning',
    displayName: 'Evaluation Gate',
    description: 'Human approval gate for the evaluation plan (Phase 8.5).',
    agentRole: null,
  },

  // ── Phase 9 — execution ─────────────────────────────────────────────
  {
    id: 'implementation_task_execution',
    parentPhase: 'execution',
    displayName: 'Implementation Task Execution',
    description: 'Execute implementation tasks (Phase 9.1).',
    agentRole: 'executor',
  },
  {
    id: 'test_execution',
    parentPhase: 'execution',
    displayName: 'Test Execution',
    description: 'Execute test suites (Phase 9.2).',
    agentRole: 'executor',
  },
  {
    id: 'evaluation_execution',
    parentPhase: 'execution',
    displayName: 'Evaluation Execution',
    description: 'Run evaluation scenarios (Phase 9.3).',
    agentRole: 'executor',
  },
  {
    id: 'execution_synthesis',
    parentPhase: 'execution',
    displayName: 'Execution Synthesis',
    description: 'Synthesize execution results (Phase 9.4).',
    agentRole: null,
  },
  {
    id: 'execution_gate',
    parentPhase: 'execution',
    displayName: 'Execution Gate',
    description: 'Human approval gate for execution results (Phase 9.5).',
    agentRole: null,
  },

  // ── Phase 10 — commit ───────────────────────────────────────────────
  {
    id: 'pre_commit_consistency_check',
    parentPhase: 'commit',
    displayName: 'Pre-Commit Consistency Check',
    description: 'Cross-artifact consistency verification before committing (Phase 10.1).',
    agentRole: 'consistency_checker',
  },
  {
    id: 'commit_preparation',
    parentPhase: 'commit',
    displayName: 'Commit Preparation',
    description: 'Stage and prepare git commit (Phase 10.2).',
    agentRole: 'executor_agent',
  },
  {
    id: 'workflow_run_closure',
    parentPhase: 'commit',
    displayName: 'Workflow Run Closure',
    description: 'Finalize and close the workflow run (Phase 10.3).',
    agentRole: null,
  },
] as const;

// ── Cross-cutting manifest ────────────────────────────────────────────

export const CROSS_CUTTING: readonly CrossCuttingEntry[] = [
  {
    id: 'reasoning_review',
    displayName: 'Reasoning Review',
    description: 'Per-call advisory review of agent reasoning + Phase 9 quarantine gate.',
    agentRole: 'reasoning_review',
  },
  {
    id: 'client_liaison_query_classification',
    displayName: 'Client Liaison — Query Classification',
    description: 'Classify ad-hoc client liaison queries.',
    agentRole: 'client_liaison',
  },
  {
    id: 'client_liaison_synthesis',
    displayName: 'Client Liaison — Synthesis',
    description: 'Synthesize client liaison responses.',
    agentRole: 'client_liaison',
  },
  {
    id: 'consistency_checker_semantic',
    displayName: 'Consistency Checker (Semantic)',
    description: 'Cross-artifact semantic consistency check.',
    agentRole: 'consistency_checker',
  },
  {
    id: 'deep_memory_context_packet_synthesis',
    displayName: 'DMR — Context Packet Synthesis',
    description: 'Deep Memory Research synthesis of context packet.',
    agentRole: 'deep_memory_research',
  },
  {
    id: 'deep_memory_query_decomposition',
    displayName: 'DMR — Query Decomposition',
    description: 'Deep Memory Research query decomposition.',
    agentRole: 'deep_memory_research',
  },
  {
    id: 'domain_compliance_review',
    displayName: 'Domain Compliance Review',
    description: 'Review artifacts against compliance regimes.',
    agentRole: 'compliance_reviewer',
  },
  {
    id: 'eval_execution',
    displayName: 'Evaluation Execution (cross-cutting)',
    description: 'Cross-cutting evaluation execution helper.',
    agentRole: 'eval_runner',
  },
  {
    id: 'ingestion_pipeline_stage3',
    displayName: 'Ingestion Pipeline — Stage 3',
    description: 'Stage 3 of the ingestion pipeline.',
    agentRole: 'ingestion_agent',
  },
  {
    id: 'narrative_memory',
    displayName: 'Narrative Memory',
    description: 'Narrative memory synthesis at phase boundaries.',
    agentRole: 'narrative_curator',
  },
  {
    id: 'tier_c_ac_shape_audit',
    displayName: 'Tier-C AC Shape Audit',
    description: 'Audit Tier-C atomic acceptance criteria shape.',
    agentRole: 'requirements_agent',
  },
  {
    id: 'unsticking_socratic_turn',
    displayName: 'Unsticking — Socratic Turn',
    description: 'Socratic turn to unstick a stalled agent.',
    agentRole: 'unsticking_coach',
  },
  {
    id: 'unsticking_tool_result_review',
    displayName: 'Unsticking — Tool Result Review',
    description: 'Review tool results to unstick a stalled agent.',
    agentRole: 'unsticking_coach',
  },
  {
    id: 'verification_ensemble_secondary',
    displayName: 'Verification Ensemble — Secondary',
    description: 'Secondary verification ensemble pass.',
    agentRole: 'verification_ensemble',
  },
] as const;

// ── Lookup indices (built once at module load) ───────────────────────

const PHASE_BY_ID = new Map<string, PhaseEntry>(PHASES.map((p) => [p.id, p]));
const SUB_PHASE_BY_ID = new Map<string, SubPhaseEntry>(SUB_PHASES.map((s) => [s.id, s]));
const CROSS_CUTTING_BY_ID = new Map<string, CrossCuttingEntry>(CROSS_CUTTING.map((c) => [c.id, c]));
const SUB_PHASES_BY_PARENT = new Map<string, SubPhaseEntry[]>();
for (const sp of SUB_PHASES) {
  const arr = SUB_PHASES_BY_PARENT.get(sp.parentPhase) ?? [];
  arr.push(sp);
  SUB_PHASES_BY_PARENT.set(sp.parentPhase, arr);
}

// ── Display code derivation ───────────────────────────────────────────

const DISPLAY_CODE_CACHE = new Map<string, string>();

/**
 * Derive the display code for a sub-phase from its position within the
 * parent phase's sub-phase array, taking `group` into account.
 *
 * Algorithm:
 *   - Walk the parent's sub-phases in array order
 *   - Each ungrouped entry occupies one slot at the parent level:
 *     `<phaseDisplayCode>.<slot>`
 *   - Each group occupies one slot at the parent level (the slot of
 *     its first member). Members within get a sub-slot:
 *     `<phaseDisplayCode>.<slot>.<intra>`
 *
 * Result is cached after first computation per parent.
 */
function computeDisplayCodesForParent(parentId: string): void {
  const parent = PHASE_BY_ID.get(parentId);
  if (!parent) return;
  const subs = SUB_PHASES_BY_PARENT.get(parentId) ?? [];
  const groupSlot = new Map<string, number>();
  const groupIntra = new Map<string, number>();
  let nextSlot = 1;
  for (const sp of subs) {
    if (sp.group) {
      let slot = groupSlot.get(sp.group);
      if (slot === undefined) {
        slot = nextSlot++;
        groupSlot.set(sp.group, slot);
        groupIntra.set(sp.group, 0);
      }
      const intra = (groupIntra.get(sp.group) ?? 0) + 1;
      groupIntra.set(sp.group, intra);
      DISPLAY_CODE_CACHE.set(sp.id, `${parent.displayCode}.${slot}.${intra}`);
    } else {
      const slot = nextSlot++;
      DISPLAY_CODE_CACHE.set(sp.id, `${parent.displayCode}.${slot}`);
    }
  }
}

for (const phase of PHASES) {
  computeDisplayCodesForParent(phase.id);
}

// ── Public API ────────────────────────────────────────────────────────

export function getPhase(id: string): PhaseEntry | undefined {
  return PHASE_BY_ID.get(id);
}

export function getSubPhase(id: string): SubPhaseEntry | undefined {
  return SUB_PHASE_BY_ID.get(id);
}

export function getCrossCutting(id: string): CrossCuttingEntry | undefined {
  return CROSS_CUTTING_BY_ID.get(id);
}

/**
 * Resolve any slug (sub-phase or cross-cutting) to a display label.
 * Sub-phases render as `<displayCode> · <displayName>`.
 * Cross-cutting entries render as `[<id>]`.
 * Unknown slugs render as the raw id (with a debug-only warning).
 */
export function displayLabelFor(id: string): string {
  const sp = SUB_PHASE_BY_ID.get(id);
  if (sp) {
    const code = DISPLAY_CODE_CACHE.get(id);
    return code ? `${code} · ${sp.displayName}` : sp.displayName;
  }
  const cc = CROSS_CUTTING_BY_ID.get(id);
  if (cc) return `[${cc.id}] ${cc.displayName}`;
  return id;
}

export function displayCodeFor(id: string): string | undefined {
  return DISPLAY_CODE_CACHE.get(id);
}

export function displayNameFor(id: string): string | undefined {
  return SUB_PHASE_BY_ID.get(id)?.displayName
    ?? CROSS_CUTTING_BY_ID.get(id)?.displayName;
}

export function subPhasesOf(parentId: string): readonly SubPhaseEntry[] {
  return SUB_PHASES_BY_PARENT.get(parentId) ?? [];
}

export function parentPhaseOf(subPhaseId: string): PhaseEntry | undefined {
  const sp = SUB_PHASE_BY_ID.get(subPhaseId);
  return sp ? PHASE_BY_ID.get(sp.parentPhase) : undefined;
}

/** True if the slug is a known sub-phase or cross-cutting id. */
export function isKnownSubPhase(id: string): boolean {
  return SUB_PHASE_BY_ID.has(id) || CROSS_CUTTING_BY_ID.has(id);
}

/** True if the slug is a known phase id. */
export function isKnownPhase(id: string): boolean {
  return PHASE_BY_ID.has(id);
}

// ── Validation ────────────────────────────────────────────────────────

export interface ManifestValidationError {
  code: 'duplicate_id' | 'unknown_parent' | 'orphan_group_member';
  id: string;
  message: string;
}

/**
 * Validate the manifest internally for structural integrity. Called at
 * boot and from tests. Returns errors (empty array = valid).
 */
export function validateManifest(): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];
  const seen = new Set<string>();
  for (const p of PHASES) {
    if (seen.has(p.id)) errors.push({ code: 'duplicate_id', id: p.id, message: `Duplicate phase id: ${p.id}` });
    seen.add(p.id);
  }
  for (const sp of SUB_PHASES) {
    if (seen.has(sp.id)) errors.push({ code: 'duplicate_id', id: sp.id, message: `Duplicate sub-phase id: ${sp.id}` });
    seen.add(sp.id);
    if (!PHASE_BY_ID.has(sp.parentPhase)) {
      errors.push({ code: 'unknown_parent', id: sp.id, message: `Sub-phase ${sp.id} references unknown parent ${sp.parentPhase}` });
    }
  }
  for (const cc of CROSS_CUTTING) {
    if (seen.has(cc.id)) errors.push({ code: 'duplicate_id', id: cc.id, message: `Duplicate cross-cutting id: ${cc.id}` });
    seen.add(cc.id);
  }
  return errors;
}
