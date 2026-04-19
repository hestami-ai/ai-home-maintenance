/**
 * Test Harness Types - Shared type definitions for CLI and test harness.
 *
 * These types define the contract between:
 *   - CLI runner (src/cli/runner.ts)
 *   - Test harness (src/test/harness/)
 *   - Gap report consumers
 */

// Re-export from existing types
export type { PhaseId } from '../../lib/types/records';

// Decision Override Types

export interface DecisionOverride {
  /** Selection: index_0, index_1, index_2, or custom string */
  selection: string;
  /** Optional rationale for the selection */
  rationale?: string;
}

// Gap Report Types

export interface GapReport {
  /** Phase where the gap was detected */
  phase: string;
  /** Sub-phase where the gap was detected */
  subPhase?: string;
  /**
   * Explicit "first broken phase" for machine consumers — same value as
   * `phase`, surfaced under a stable top-level name so the virtuous
   * cycle's coding agent can jq `.failed_at_phase` without remembering
   * that `phase` happens to be that pointer.
   */
  failed_at_phase: string;
  /** Explicit first broken sub-phase (alias of `subPhase`). */
  failed_at_sub_phase?: string;
  /** Missing records that should have been produced */
  missing_records: MissingRecord[];
  /** Schema validation failures */
  schema_violations: SchemaViolation[];
  /** Assertion failures from phase contracts */
  assertion_failures: AssertionFailure[];
  /**
   * Structured per-gap entries (added in Wave 4 of the product-lens plan).
   * Additive to the legacy `missing_records` / `schema_violations` /
   * `assertion_failures` arrays — every item in this array is ALSO
   * represented in one of those legacy arrays, so existing consumers
   * keep working. Rich consumers (the virtuous-cycle AI coding agent)
   * read this for `likely_source` pointers + `reproduce` command so they
   * can act on a gap without re-deriving context.
   */
  gaps?: StructuredGap[];
  /** AI-generated fix suggestion */
  suggested_fix: string;
  /**
   * LLM-grounded suggested fix — populated by the optional gap-enhancer
   * LLM pass when `llmGapEnhance` is set on the runner config. Rooted
   * in the governed-stream tail rather than the hardcoded recipe table
   * so the suggestion names the specific handler / prompt / validator
   * most likely to need changes. Absent when no LLM pass ran.
   */
  llm_suggested_fix?: string;
  /** References to spec sections */
  spec_references: string[];
}

export interface MissingRecord {
  /** Expected record type */
  record_type: string;
  /** Phase where it was expected */
  phase: string;
  /** Sub-phase where it was expected */
  sub_phase?: string;
  /** Why it was expected */
  reason: string;
}

export interface SchemaViolation {
  /** Record that failed validation */
  record_id: string;
  /** Record type */
  record_type: string;
  /** Field that violated schema */
  field: string;
  /** Validation error message */
  error: string;
  /** Expected schema version */
  schema_version: string;
}

/**
 * Structured gap entry — the load-bearing artifact in the virtuous-cycle
 * loop. The harness defines the contract; an AI coding agent (in a later
 * Claude Code session) reads these gaps, edits the indicated files, and
 * re-runs the harness until zero gaps remain. Every field is designed so
 * an agent picking up a gap cold — no prior context — can act on it.
 */
export type StructuredGapCategory =
  | 'missing_artifact'
  | 'shape_violation'
  | 'coverage_violation'
  | 'invariant_violation'
  | 'schema_violation';

export interface StructuredGap {
  /** Stable hash so later runs can deduplicate vs prior gap reports. */
  gap_id: string;
  phase_id: string;
  sub_phase_id?: string;
  severity: 'error' | 'warning';
  category: StructuredGapCategory;
  /** One-sentence headline — what the gap is, in plain English. */
  summary: string;
  /**
   * The contract entry that failed — e.g. `{ record_type, content_kind, sub_phase_id }`
   * for missing_artifact gaps, or `{ field, expected_range, expected_shape }` for
   * shape_violation / coverage_violation gaps.
   */
  expected: Record<string, unknown>;
  /** The observed state — either `missing` or the problematic artifact content. */
  observed: Record<string, unknown>;
  /**
   * Best-effort pointer to the code / prompt / schema the fixer should
   * look at first. Not authoritative — but saves the agent 80% of the
   * search. Empty arrays when the gap doesn't map to one.
   */
  likely_source: {
    templates: string[];
    handlers: string[];
    schemas: string[];
  };
  /** How to reproduce this gap — the command + run context. */
  reproduce: {
    command: string;
    run_id?: string;
    gold_reference_path?: string;
  };
}

export interface AssertionFailure {
  /** Phase where assertion failed */
  phase: string;
  /** Sub-phase where assertion failed */
  sub_phase: string;
  /** Assertion that failed */
  assertion: string;
  /** Expected value */
  expected: string;
  /** Actual value */
  actual: string;
  /** Record involved in the failure */
  record_id?: string;
}

// Semantic Warning Types

export interface SemanticWarning {
  /** Phase where warning was raised */
  phase: string;
  /** Sub-phase where warning was raised */
  subPhase: string;
  /** Field that triggered the warning */
  field: string;
  /** Assertion that was weakly satisfied */
  assertion: string;
  /** Warning message */
  message: string;
  /** Suggested improvement */
  suggestion?: string;
}

// Harness Result Types

export interface HarnessResult {
  /** Overall status */
  status: 'success' | 'partial' | 'failed';
  /** Phases that completed successfully */
  phasesCompleted: string[];
  /** Phases that failed */
  phasesFailed: string[];
  /** Artifacts produced, keyed by phase */
  artifactsProduced: Record<string, string[]>;
  /** Gap report (if status !== 'success') */
  gapReport?: GapReport;
  /** Semantic warnings (non-blocking issues) */
  semanticWarnings: SemanticWarning[];
  /** Total execution duration in ms */
  durationMs: number;
  /** Path to the governed stream database */
  governedStreamPath: string;
}

// Fixture Types

export interface FixtureFile {
  /** Fixture key (e.g., "requirements_agent__01_3__01") */
  key: string;
  /** Agent role that produced this fixture */
  agent_role: string;
  /** Sub-phase ID */
  sub_phase_id: string;
  /** Call sequence number (1-indexed) */
  call_sequence: number;
  /** Prompt template used */
  prompt_template: string;
  /** Hash of the prompt template */
  prompt_template_hash: string;
  /** Structured context payload for drift detection */
  prompt_context_payload: Record<string, unknown>;
  /** Raw LLM response */
  response_raw: string;
  /** Parsed response object (if JSON) */
  response_parsed?: unknown;
  /** When this fixture was captured */
  captured_at: string;
  /** JanumiCode version SHA when captured */
  janumicode_version_sha: string;
  /** LLM provider used */
  llm_provider: string;
  /** LLM model used */
  llm_model: string;
}

export interface FixtureManifest {
  /** Manifest schema version */
  version: '1.0';
  /** JanumiCode version SHA */
  janumicode_version_sha: string;
  /** Corpus SHA (hash of corpus document) */
  corpus_sha: string;
  /** When this manifest was generated */
  generated_at: string;
  /** Fixture files in this corpus */
  fixtures: FixtureFile[];
}

// Phase Contract Types

/**
 * A single artifact (or surface record) a phase must produce. The
 * oracle matches records by record_type first; when the record_type
 * is `artifact_produced`, `content_kind` further discriminates which
 * artifact must be present (since JanumiCode v2.3 uses a single
 * `artifact_produced` envelope with `content.kind` as the
 * differentiator — e.g. intent_statement, functional_requirements,
 * component_model, …). Optional `sub_phase_id` pins locality so the
 * same kind emitted in the wrong sub-phase still surfaces as a gap.
 */
export interface RequiredArtifact {
  /** record_type (e.g. 'artifact_produced', 'mirror_presented'). */
  record_type: string;
  /** `content.kind` value when record_type is `artifact_produced`. */
  content_kind?: string;
  /** Expected sub_phase_id. */
  sub_phase_id?: string;
  /** Expected produced_by_agent_role. Checked when present. */
  produced_by_agent_role?: string;
  /**
   * When true, the artifact only appears in some scenarios (e.g.
   * brownfield workspace; multi-candidate bloom). Missing optional
   * artifacts produce a warning, not an error.
   */
  optional?: boolean;
  /** Human-readable reason the artifact is required. */
  reason: string;
}

export interface PhaseContract {
  /** Phase ID */
  phase: string;
  /** Required artifacts for this phase. */
  required_artifacts: RequiredArtifact[];
  /** Required invariants */
  invariants: PhaseInvariant[];
  /** Authority progression rules */
  authority_rules: AuthorityRule[];
}

export interface PhaseInvariant {
  /** Invariant name */
  name: string;
  /** Invariant description */
  description: string;
  /** Validation function name */
  validator: string;
  /** Whether this is a hard failure or warning */
  severity: 'error' | 'warning';
  /**
   * Optional sub_phase_id so the gap report can report locality for
   * invariants that relate to a specific sub-phase artifact (e.g. the
   * product description handoff shape/coverage oracle lives at 1.6).
   */
  sub_phase_id?: string;
}

export interface AuthorityRule {
  /** Record type this rule applies to */
  record_type: string;
  /** Minimum authority level required */
  min_authority: number;
  /** Maximum authority level allowed */
  max_authority: number;
  /** Description of the rule */
  description: string;
}

// Corpus Lock Types

export interface CorpusLock {
  /** Corpus document SHA */
  corpus_sha: string;
  /** JanumiCode version SHA */
  janumicode_sha: string;
  /** When this lock was established */
  locked_at: string;
  /** Fixture manifest associated with this corpus */
  manifest: FixtureManifest;
}

// Test Isolation Types

export interface TestIsolationConfig {
  /** Unique test run ID */
  testRunId: string;
  /** Database path for this test */
  dbPath: string;
  /** Whether to cleanup after test */
  cleanup: boolean;
}

// Pipeline Runner Config

export interface PipelineRunnerConfig {
  /** Workspace root path */
  workspacePath: string;
  /** LLM mode: mock or real */
  llmMode: 'mock' | 'real';
  /** Auto-approve all decisions */
  autoApprove: boolean;
  /** Stop after completing this phase */
  phaseLimit?: string;
  /** Directory containing LLM fixtures for mock mode */
  fixtureDir?: string;
  /** Decision overrides keyed by sub-phase ID */
  decisionOverrides?: Record<string, DecisionOverride>;
  /**
   * When true AND llmMode is 'real', capture every LLM call as a fixture
   * JSON file for future mock-mode replay.
   */
  captureFixtures?: boolean;
  /** Directory to save captured fixtures (defaults to src/test/fixtures/captured/) */
  captureOutputDir?: string;
  /**
   * Path to a governed_stream DB from a prior run. When set, the pipeline
   * skips bootstrapIntent and resumes from the existing DB state at the
   * phase specified by `resumeAtPhase`. Used for incremental phase capture
   * during development — avoids re-running earlier phases.
   */
  resumeFromDb?: string;
  /** Phase to resume at (required when resumeFromDb is set). */
  resumeAtPhase?: string;
  /**
   * When set, the runner calls an LLM to produce a rich suggested_fix
   * for the gap report by grounding its suggestion in the governed
   * stream tail. Requires an available provider (same routing as normal
   * workflow calls). Failure falls back to the rule-based suggestion
   * without blocking the pipeline.
   */
  llmGapEnhance?: {
    provider: string;
    model: string;
  };
}
