/**
 * ConfigManager — loads janumicode.config.json with hardcoded sensible defaults.
 * Based on JanumiCode Spec v2.3, §10.
 *
 * Reads overrides from .janumicode/config.json if it exists.
 * Falls back to hardcoded defaults for all values.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getLogger } from '../logging';

// ── Configuration Types ─────────────────────────────────────────────

export interface JanumiCodeConfig {
  schema_version: string;
  workspace_id: string;
  janumicode_version_sha: string;

  governed_stream: {
    sqlite_path: string;
    vector_extension: string;
    enable_vector_search: boolean;
  };

  context_assembly: {
    cli_agents: {
      stdin_max_tokens: number;
      detail_file_path_template: string;
      detail_file_cleanup: string;
      detail_file_max_bytes: number;
      governing_constraints_always_in_stdin: boolean;
      hard_stop_on_governing_constraint_overflow: boolean;
    };
  };

  invariant_library: {
    path: string;
    run_before_reasoning_review: boolean;
    blocking_violation_action: string;
  };

  workflow: {
    max_retry_attempts_per_subphase: number;
    loop_detection_threshold: number;
    require_human_approval_all_phase_gates: boolean;
    rollback_closure_max_artifacts: number;
    /**
     * Records-idle stall threshold (ms). The CLI's waitForQuiescence
     * declares the run stalled when no new governed_stream record has
     * been written for this long, EVEN IF a phase is supposedly
     * executing or LLM calls are in-flight — because forward progress
     * is measured by records landing in the stream, not by in-flight
     * counters that can hang. Pending human decisions suspend the
     * check (waiting on a webview submit isn't a stall).
     *
     * Wave 6 recursive decomposition can legitimately run for many
     * hours end-to-end against slow backends; the previous hard
     * 1-hour wall-clock cap killed runs that were still making
     * progress. Default here is 15 minutes of complete stream silence.
     */
    records_idle_stall_ms: number;
    /**
     * Auto-mitigation policy — see defaults.ts + study/auto-mitigation-design.md.
     * Optional in config; defaults to `disabled` when omitted.
     */
    auto_mitigation_policy?: 'disabled' | 'auto' | 'present_to_human';
    /**
     * Thin-slice / calibration override — when set, Phase 9 task
     * executor invocations use this backing tool regardless of what
     * the Phase 6 implementation_planner chose per-task. Lets thin
     * slice runs force `goose_cli` for cost-bounded local execution
     * while leaving production runs free to honor the planner's choice.
     * Logged per-task when the override fires.
     */
    force_executor_backing_tool?:
      | 'mimo_cli'
      | 'claude_code_cli'
      | 'gemini_cli'
      | 'goose_cli'
      | 'codex_cli'
      | 'direct_llm_api';
  };

  deep_memory_research: {
    materiality_weights: {
      semantic_similarity: number;
      constraint_relevance: number;
      authority_level: number;
      temporal_recency: number;
      causal_relevance: number;
      contradiction_signal: number;
    };
  };

  cross_run_refactoring: {
    cascade_threshold_task_count: number;
    cascade_threshold_file_count: number;
  };

  cli_invocation: {
    timeout_seconds: number;
    idle_timeout_seconds: number;
    /**
     * Fires when no assistant text or thinking content has streamed from
     * the CLI for N seconds, even if heartbeat / tool_use envelopes are
     * still arriving. Catches the "spinning on tool calls without
     * convergence" pathology that idle_timeout_seconds misses because
     * envelope traffic keeps it alive. Set to 0 to disable.
     */
    no_content_timeout_seconds: number;
    buffer_max_events: number;
  };

  /**
   * Wave 6 — recursive requirements decomposition safety rails. The
   * primary terminator is assumption-saturation (pass with zero-delta
   * assumption set means stop). These caps are belt-and-suspenders for
   * pathological cases where the decomposer either loops or fans out
   * uncontrollably.
   *
   * - depth_cap: hard ceiling on tree depth across any branch.
   * - budget_cap: max LLM calls across all passes PER ROOT (applied
   *   independently to each root FR / root NFR). Resets per resume
   *   session — the in-memory per-root counter is not persisted.
   * - fanout_cap: max children produced from a single parent in one pass.
   * - mirror_gate_depth: depth at which the human prune gate fires.
   *   Below this depth all branches recurse autonomously to fixed point.
   */
  decomposition: {
    depth_cap: number;
    budget_cap: number;
    fanout_cap: number;
    mirror_gate_depth: number;
    /**
     * Thin-slice support: cap how many depth-0 root FRs/NFRs from
     * Phase 2.1/2.2 bloom feed into the saturation loop. Default 0 =
     * no cap (every bloom root is saturated). `--thin-slice` mode sets
     * these to a small N (e.g. 2) so total saturation cost is bounded
     * while every Phase 2 prompt template still fires end-to-end.
     */
    max_root_count_fr: number;
    max_root_count_nfr: number;
    /**
     * Wave 6 Step 4c — when true, after each post-gate decomposition
     * pass produces Tier-C/D children under a previously-accepted
     * Tier-B parent, run a Reasoning Review pass to audit whether the
     * children's acceptance criteria are verification-shaped ("does the
     * system do X correctly?") or policy-shaped ("did we already decide
     * X?"). Policy-shaped ACs indicate commitments hiding as
     * implementation — the residual failure mode Step 4b cannot catch.
     *
     * Off by default because it adds one LLM API call per post-gate
     * pass. Enable for runs where latent-commitment detection matters.
     */
    reasoning_review_on_tier_c: boolean;
    /**
     * Wave 7 — recursive component decomposition (Phase 4.2a) safety
     * rails. Tier rubric is component-scaled (A=Macro Subsystem, B=
     * Bounded Domain, C=Module, D=Atomic Component). Defaults are
     * lower than the requirements caps because component trees are
     * typically shallower (depth_cap=6 vs 10) and per-call context is
     * heavier (carries domain + sibling-component state).
     */
    component_depth_cap: number;
    component_budget_cap: number;
    component_fanout_cap: number;
    component_mirror_gate_depth: number;
    /**
     * Lever 1b — decomposition scale budget. The maximum number of
     * FUNCTIONAL components allowed out of Phase 4.2 is keyed to upstream
     * intent scale, not a hardcoded constant:
     *   budget = max(#acceptedSoftwareDomains, ceil(ratio × #acceptedUserStories))
     * When the proposed functional set exceeds this budget, Phase 4 runs a
     * consolidation pass (merge to ≤ budget) guarded so user-story coverage
     * is never reduced. Default 1.0 (a component per user story is the
     * upper band; the domain count is the floor). 0 disables the gate.
     */
    component_scale_ratio: number;
    /**
     * Wave 7 Step 4c analog — when true, audit Tier-C component
     * children for "responsibility shape" (verb-led / mutually
     * exclusive / collectively exhausting / no implied subcomponents).
     * Off by default until Wave 7 calibration evidence supports
     * flipping it.
     */
    component_reasoning_review_on_tier_c: boolean;
    /**
     * Wave 8 — recursive task decomposition (Phase 6.1a) safety rails.
     * Tier rubric is task-scaled (A=Epic, B=Story, C=Task, D=Atomic-Unit).
     * Defaults: depth_cap=5 (tasks are shallower than components),
     * budget_cap=250 (whole-run budget across all roots), fanout_cap=10
     * (most components yield 2–6 stories with headroom).
     */
    task_depth_cap: number;
    task_budget_cap: number;
    task_fanout_cap: number;
    task_mirror_gate_depth: number;
    /**
     * Wave 8 Step 4c analog — when true, audit Tier-C tasks for
     * "atomic-unit shape" (single-session sized / completion criteria
     * verifiable / no implied subtask / scope within one component).
     * Off by default until Wave 8 calibration evidence supports it.
     */
    task_reasoning_review_on_tier_c: boolean;
    /**
     * Wave 9 — recursive data-model decomposition (Phase 5.1a) safety
     * rails. Tier rubric is data-model-scoped (A=Aggregate Root,
     * B=Entity, C=Sub-entity / value-type cluster, D=Atomic value type).
     * Defaults: depth_cap=4 (data trees are typically shallow), fanout
     * cap=10 (an aggregate can host many entities), budget_cap=150
     * (heavier per-call context than tasks; smaller tree size).
     */
    data_model_depth_cap: number;
    data_model_budget_cap: number;
    data_model_fanout_cap: number;
    data_model_mirror_gate_depth: number;
    data_model_reasoning_review_on_tier_c: boolean;
    /**
     * Wave 10 — recursive test decomposition (Phase 7.1a) safety rails.
     * Tier rubric is test-scoped (A=Test Suite, B=Test Scenario,
     * C=Test Case, D=Atomic Test Step). Mirror Wave 7/8/9 caps; the
     * test tree is typically the deepest because end-to-end scenarios
     * naturally decompose into many atomic steps (arrange/act/assert).
     */
    test_depth_cap: number;
    test_budget_cap: number;
    test_fanout_cap: number;
    test_mirror_gate_depth: number;
    test_reasoning_review_on_tier_c: boolean;
  };

  /**
   * Wave R — Phase 9 release-plan execution scheduler config. Replaces
   * the prior failureHandler abort/skip binary with retry budgets,
   * quarantine semantics, per-leaf test execution, and per-wave gates.
   * See docs/waveR_phase9_release_execution.md.
   */
  execution: {
    /** Per-leaf retries before quarantine in a release wave. */
    leaf_retry_budget: number;
    /** Per-leaf retries in the deferred-batch wave. */
    deferred_retry_budget: number;
    /** in_place = strict write_directory_paths; feature_branch deferred to Wave R+1. */
    workspace_mode: 'in_place' | 'feature_branch';
    /** Calibration runs auto-approve; interactive runs default false. */
    auto_approve_wave_gates: boolean;
    /** Fallback when two leaves declare overlapping write_directory_paths. */
    merge_conflict_default_strategy: 'manual' | 'extend' | 'replace';
    /** Calibration / unattended bypass for executor permission prompts. */
    unattended_skip_permissions: boolean;
    /** Per-leaf test execution policy. */
    tests_per_leaf: {
      enabled: boolean;
      test_command_resolution: 'package_json_scripts' | 'explicit_per_leaf' | 'framework_autodetect';
      /** Per-leaf wall-clock for the test invocation (ms). */
      timeout_ms: number;
    };
    /** Optional wave-level reasoning review at the gate. */
    wave_reasoning_review_on_gate: boolean;
    /**
     * Pillar D — max delta-cycle restarts per release before the cycle
     * controller stops routing and surfaces the ceiling to the operator.
     * Bounds the packet-coherence self-correction loop. Default 3.
     */
    max_cycles_per_release: number;
  };

  /**
   * Lever 2a — canonical project profile + shared scaffold. Phase 9.0
   * (scaffold_synthesis) materializes ONE root project configuration and a
   * shared module directory from interface_contracts + data_models BEFORE
   * any executor leaf runs, so leaves import shared modules instead of
   * reinventing them divergently. The profile is resolved by precedence:
   * detected existing workspace config (brownfield) → Phase-4 ADR override
   * → this default (greenfield). Only the TS/ESM/vitest materializer ships
   * today; other languages can be declared but are not yet materialized.
   */
  scaffold: {
    /** Master switch — false skips Phase 9.0 entirely. */
    enabled: boolean;
    /**
     * After materializing the root package.json, run `npm install` ONCE so the
     * declared test runner (vitest/jest) resolves — otherwise every leaf
     * quarantines on `npm test` (command not found). Skipped if node_modules
     * already exists; non-fatal on failure (the run continues, tests may fail).
     */
    install_dependencies: boolean;
    /** Test-file placement convention enforced by the layout contract. */
    test_placement: 'colocated' | 'subdir';
    /**
     * Engineering Constitution — coding/craft best practices for the
     * GENERATED codebase (commenting, debugging/observability, testing).
     * Scaffold synthesis copies this file into the workspace
     * (`.janumicode/engineering-constitution.md`) and every Phase-9
     * executor attempt is instructed to review it as an ADVISORY standard
     * (task spec / completion criteria / TECH-* constraints win on
     * conflict; applied proportionally to task scope). Resolved relative
     * to cwd when not absolute; warn-and-skip when missing.
     */
    engineering_constitution_path?: string;
    project_profile: {
      language: 'typescript' | 'javascript';
      module: 'esm' | 'commonjs';
      test_runner: 'vitest' | 'jest' | 'node';
      /** Workspace-relative dir owned exclusively by the scaffold step. */
      shared_dir: string;
    };
  };

  /** Lever 2c — Phase 10.1 pre-commit consistency check. */
  consistency: {
    /**
     * Severity for divergent-duplicate findings (same basename, different
     * content hash across paths). 'block' fails the Phase 10 gate; 'warn'
     * records the finding + technical debt but passes. Default 'block'.
     */
    divergence_severity: 'block' | 'warn';
    /**
     * Severity for project-layout violations (stray top-level dirs, stray
     * shared trees, foreign-language files, dist source). Default 'advisory'
     * — recorded but never blocks (prevention does the work).
     */
    layout_violation_severity: 'advisory' | 'block';
    /**
     * Severity for `tsc --noEmit` errors on the generated workspace (broken
     * imports, type errors). Default 'advisory'.
     */
    tsc_validation_severity: 'advisory' | 'block';
  };

  /**
   * LLM routing — per-role provider/model assignments.
   * Based on spec §10 `llm_routing`. Providers referenced here MUST be
   * registered with the OrchestratorEngine's LLMCaller at startup, or the
   * Phase that uses them will fail loudly. This is by design: silent
   * fallbacks in correctness-validation roles (e.g. Reasoning Review) would
   * mask configuration errors that matter for trust in the system.
   */
  llm_routing: {
    /**
     * Orchestrator-role routing. Covers cross-cutting quality-gate LLM
     * work that's not specific to one phase agent — today that's the
     * Intent Quality Check (Phase 1.0). Distinct from `reasoning_review`
     * which audits other agents' traces.
     *
     * `primary.backing_tool` selects the execution path:
     *   - `direct_llm_api` routes through LLMCaller with the named
     *     provider + model. Used for headless mock-mode tests and for
     *     environments where Ollama is the only LLM available.
     *   - `claude_code_cli` / `gemini_cli` / `goose_cli` spawn the
     *     corresponding CLI as a subprocess. The CLI handles its own
     *     model selection; we pass `--model <model>` when set.
     *
     * Production default: `gemini_cli` with `gemini-2.5-flash` — the
     * gemini CLI is the production target. Operators override to
     * `claude_code_cli` + `qwen3.5:9b` (via a router proxy like
     * claude-code-router) for harness runs that exercise the CLI
     * path without Gemini API keys.
     */
    orchestrator: {
      primary: {
        /** 'direct_llm_api' | 'claude_code_cli' | 'gemini_cli' | 'goose_cli' | 'codex_cli' */
        backing_tool: string;
        /** Provider name — required only when backing_tool === 'direct_llm_api'. */
        provider?: string;
        /** Model override. CLIs have their own defaults; omit to use them. */
        model?: string;
        /**
         * Optional per-role provider base URL. Currently only honored
         * by the `llamacpp` provider. Lets the calibration harness
         * point this role at a specific llama-server instance (e.g.
         * `http://127.0.0.1:11435`) without registering multiple
         * provider adapters. Other providers ignore this field.
         */
        base_url?: string;
      };
      temperature?: number;
    };
    /**
     * Domain Interpreter role — Phase 1 product-lens bloom rounds (1.0b
     * discovery, 1.2 domains, 1.3 journeys, 1.4 entities, 1.5 integrations,
     * 1.6 narrative refinement) and Phase 1 default-lens bloom/synthesis.
     * Optional so legacy configs keep working; falls back to
     * `{ backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' }`
     * when absent.
     */
    domain_interpreter?: {
      primary: {
        backing_tool: string;
        provider?: string;
        model?: string;
        base_url?: string;
      };
      temperature?: number;
    };
    /**
     * Requirements Agent role — Phase 2 functional and non-functional
     * requirements bloom. Added in wave 5 when Phase 2 was upgraded to
     * consume the `product_description_handoff` directly under the
     * product lens.
     */
    requirements_agent?: {
      primary: {
        backing_tool: string;
        provider?: string;
        model?: string;
        base_url?: string;
      };
      temperature?: number;
    };
    reasoning_review: {
      /** Primary provider + model used for ReasoningReview LLM calls. */
      primary: { provider: string; model: string; base_url?: string };
      /** Temperature for reasoning review; should be low for deterministic output. */
      temperature: number;
      /** Optional fallback if primary fails. */
      fallback?: { provider: string; model: string };
      /** Ensemble config (future — not yet used). */
      ensemble?: {
        enabled: boolean;
        secondary: { provider: string; model: string };
      };
    };
    /**
     * Dedicated LLM-based JSON repair fallback. Fires when an agent
     * call requested `responseFormat: 'json'` and the response can't
     * be parsed. Two attempts run sequentially:
     *   1. PRIMARY repair model
     *   2. FALLBACK repair model (different family, different bias)
     * Both receive the original prompt + system + thinking chain (and
     * optional schema hint) as grounding. If both fail, the workflow
     * halts with a json_repair_record diagnostic. Omit this slot to
     * disable repair (caller halts immediately on parse failure).
     */
    json_repair?: {
      primary: { provider: string; model: string; base_url?: string };
      fallback?: { provider: string; model: string; base_url?: string };
      temperature?: number;
      fallback_temperature?: number;
    };
    /**
     * Phase 9 implementation-task executor. Distinct from the planning
     * roles because Phase 9 spawns a coding agent (file-system tools,
     * shell access, multi-turn). `backing_tool` MUST be one of the CLI
     * variants the ExecutorAgent supports — direct_llm_api is rejected
     * here because executors need tool use. Optional so legacy configs
     * keep working; ExecutorAgent falls back to its built-in default
     * when omitted.
     */
    executor?: {
      primary: {
        /** 'claude_code_cli' | 'gemini_cli' | 'goose_cli' | 'codex_cli' */
        backing_tool: string;
        /** Model passed via `--model <name>` to the chosen CLI. */
        model?: string;
      };
      temperature?: number;
    };
    /**
     * UnstickingAgent routing — invoked by FailureHandler (Phase 9.4)
     * when a loop is detected during task execution. Direct LLM call
     * (no backing_tool wrapper); the agent runs N socratic turns to
     * propose a correction. Shape mirrors `reasoning_review` — a
     * provider+model pair plus optional knobs.
     */
    unsticking?: {
      primary: { provider: string; model: string; base_url?: string };
      temperature?: number;
      max_socratic_turns?: number;
    };
    /**
     * Session Responder — the LLM playing the HUMAN side of an interactive
     * Phase-9 executor session (the coding agent's TUI thinks it is talking
     * to a person). Answers the agent's clarifying questions from the task
     * spec and composes contextual continuation nudges. Direct LLM call,
     * latency-sensitive: a small fast model is appropriate (the questions
     * are answerable from a provided spec). Omit to fall back to the
     * adapters' canned responses. Env overrides:
     * JANUMICODE_SESSION_RESPONDER_PROVIDER / _MODEL.
     */
    session_responder?: {
      primary: { provider: string; model: string; base_url?: string };
      temperature?: number;
      max_tokens?: number;
    };
  };
}

// ── Hardcoded Defaults ──────────────────────────────────────────────

export const DEFAULT_CONFIG: JanumiCodeConfig = {
  schema_version: '1.2',
  workspace_id: '',
  janumicode_version_sha: 'dev',

  governed_stream: {
    sqlite_path: '.janumicode/governed_stream.db',
    vector_extension: 'sqlite-vec',
    enable_vector_search: false, // Deferred to Wave 7
  },

  context_assembly: {
    cli_agents: {
      stdin_max_tokens: 8000,
      detail_file_path_template: '.janumicode/runs/{workflow_run_id}/context/{sub_phase_id}_{invocation_id}.md',
      detail_file_cleanup: 'archive_after_phase_gate',
      detail_file_max_bytes: 10485760, // 10MB
      governing_constraints_always_in_stdin: true,
      hard_stop_on_governing_constraint_overflow: true,
    },
  },

  invariant_library: {
    path: 'schemas/invariants',
    run_before_reasoning_review: true,
    blocking_violation_action: 'quarantine_and_retry_with_violation',
  },

  workflow: {
    records_idle_stall_ms: 900000,
    max_retry_attempts_per_subphase: 3,
    loop_detection_threshold: 3,
    require_human_approval_all_phase_gates: true,
    rollback_closure_max_artifacts: 50,
  },

  deep_memory_research: {
    materiality_weights: {
      semantic_similarity: 0.20,
      constraint_relevance: 0.25,
      authority_level: 0.20,
      temporal_recency: 0.15,
      causal_relevance: 0.10,
      contradiction_signal: 0.10,
    },
  },

  cross_run_refactoring: {
    cascade_threshold_task_count: 10,
    cascade_threshold_file_count: 20,
  },

  cli_invocation: {
    timeout_seconds: 600,
    idle_timeout_seconds: 120,
    // Catches CLI sessions stuck in tool-call loops with no assistant
    // text/thinking. Calibrated from thin-slice-13 where 600s was the
    // upper bound for successful Phase 9.1 tasks; values higher than
    // that were almost all goose tasks looping without convergence.
    no_content_timeout_seconds: 600,
    buffer_max_events: 1000,
  },

  decomposition: {
    depth_cap: 10,
    budget_cap: 500,
    fanout_cap: 8,
    mirror_gate_depth: 2,
    max_root_count_fr: 0,
    max_root_count_nfr: 0,
    reasoning_review_on_tier_c: false,
    // Wave 7 component-tree caps. Component trees are typically
    // shallower than requirement trees (depth_cap=6), with higher
    // permissible fanout per node (12) because software domains can
    // legitimately host many components. Per-run budget of 200 calls
    // — heavier per-call context than requirements (carries domain +
    // sibling-component state) but still substantially less surface
    // than a 500-call FR run.
    component_depth_cap: 6,
    component_budget_cap: 200,
    component_fanout_cap: 12,
    component_mirror_gate_depth: 2,
    component_reasoning_review_on_tier_c: false,
    // Lever 1b — functional-component scale budget (per accepted user story).
    component_scale_ratio: 1.0,
    // Wave 8 task-tree caps. Tasks fan out per component leaf and are
    // already finer-grained than components, so depth_cap=5 (vs
    // component depth_cap=6), fanout_cap=10 (typical 2–6 stories per
    // component), budget_cap=250 across the whole run.
    task_depth_cap: 5,
    task_budget_cap: 250,
    task_fanout_cap: 10,
    task_mirror_gate_depth: 2,
    task_reasoning_review_on_tier_c: false,
    // Wave 9 data-model caps. Data trees are shallow (depth_cap=4),
    // moderate fanout (10 entities per aggregate), moderate per-run
    // budget (150 calls).
    data_model_depth_cap: 4,
    data_model_budget_cap: 150,
    data_model_fanout_cap: 10,
    data_model_mirror_gate_depth: 2,
    data_model_reasoning_review_on_tier_c: false,
    // Wave 10 recursive test caps. Tests can run deeper than tasks
    // (depth_cap=6) because end-to-end scenarios naturally have
    // arrange/act/assert/teardown layers; fanout is moderate (10
    // sub-scenarios per scenario typical); whole-run budget 250.
    test_depth_cap: 6,
    test_budget_cap: 250,
    test_fanout_cap: 10,
    test_mirror_gate_depth: 2,
    test_reasoning_review_on_tier_c: false,
  },

  execution: {
    leaf_retry_budget: 3,
    deferred_retry_budget: 2,
    workspace_mode: 'in_place',
    auto_approve_wave_gates: false,
    merge_conflict_default_strategy: 'manual',
    unattended_skip_permissions: false,
    tests_per_leaf: {
      enabled: true,
      test_command_resolution: 'package_json_scripts',
      timeout_ms: 120_000,
    },
    wave_reasoning_review_on_gate: false,
    max_cycles_per_release: 3,
  },

  scaffold: {
    enabled: true,
    install_dependencies: true,
    test_placement: 'colocated',
    engineering_constitution_path: 'docs/JanumiCode v2 Engineering Constitution.md',
    project_profile: {
      language: 'typescript',
      module: 'esm',
      test_runner: 'vitest',
      shared_dir: 'src/shared',
    },
  },

  consistency: {
    divergence_severity: 'block',
    layout_violation_severity: 'advisory',
    tsc_validation_severity: 'advisory',
  },

  // Spec §10 canonical:
  //   "primary": { "provider": "google", "model": "gemini-2.5-flash" }
  // The provider name MUST match an LLMProviderAdapter.name (GoogleProvider
  // registers as 'google'). If the named provider is not registered at
  // engine startup, validateLLMRouting() logs a startup error and the
  // phase will fail loudly at invocation time (not silently skip).
  llm_routing: {
    // Production default: Gemini CLI. Replaces the previous API-only
    // path that required a registered 'ollama' or 'google' provider
    // adapter — production Orchestrator work (Intent Quality Check,
    // phase-gate reasoning) now spawns the gemini CLI as a subprocess
    // so we can use the same flow across mock + real + CLI-routed
    // harnesses without a direct API key in the extension host.
    orchestrator: {
      primary: { backing_tool: 'gemini_cli', model: 'gemini-2.5-flash' },
      temperature: 0.3,
    },
    // Default: gpt-oss:20b. Switched from qwen3.5:9b after the
    // thin-slice-12 bake-off — gpt-oss matched or beat qwen on every
    // T1/T2/T3 dimension, was 3× faster, and avoided the runaway-
    // thinking hang qwen reproducibly hit on entities_bloom and
    // coverage_verifier. Provider kept as 'llamacpp' for the compiled
    // default; live configs (cal-28 seed) route through 'ollama'.
    domain_interpreter: {
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'gpt-oss:20b' },
      temperature: 0.5,
    },
    // Requirements Agent default — matches domain_interpreter. Override
    // via JANUMICODE_REQUIREMENTS_AGENT_BACKING for CLI-backed runs.
    requirements_agent: {
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'gpt-oss:20b' },
      temperature: 0.5,
    },
    reasoning_review: {
      primary: { provider: 'google', model: 'gemini-2.5-flash' },
      temperature: 0.2,
    },
    // UnstickingAgent default — used by FailureHandler on loop detection.
    // Google provider must register as 'google' to match (see
    // src/lib/llm/providers/google.ts). Earlier versions used 'gemini'
    // here, which didn't match any registered adapter — symptom was
    // silent UnstickingAgent failures in tests.
    unsticking: {
      primary: { provider: 'google', model: 'gemini-2.5-flash' },
      temperature: 0.3,
      max_socratic_turns: 3,
    },
    // Session Responder default — answers an interactive executor session's
    // clarifying questions FROM THE SPEC. Routed through ollama (the live
    // thin-slice setup); the spec is provided in-context so a small local
    // model suffices, and latency matters (the coding agent is sitting at
    // a prompt waiting). If the provider isn't registered, the responder
    // closure fails soft to the adapters' canned responses.
    session_responder: {
      primary: { provider: 'ollama', model: 'gpt-oss:20b' },
      temperature: 0.2,
      max_tokens: 600,
    },
  },
};

// ── ConfigManager ───────────────────────────────────────────────────

export class ConfigManager {
  private config: JanumiCodeConfig;

  constructor(workspacePath?: string) {
    this.config = { ...DEFAULT_CONFIG };

    // Env-var overrides for CLI invocation timeouts. Applied before the
    // workspace file so file overrides still win. Useful for real-mode
    // CLI harness runs where a capable model (gpt-5.4 via codex_cli) can
    // reason silently for longer than the default 120s idle window,
    // tripping cliInvoker's idle-timeout guard.
    //   JANUMICODE_CLI_IDLE_TIMEOUT_SECONDS
    //   JANUMICODE_CLI_TIMEOUT_SECONDS
    const idleEnv = process.env.JANUMICODE_CLI_IDLE_TIMEOUT_SECONDS;
    if (idleEnv) {
      const n = Number.parseInt(idleEnv, 10);
      if (Number.isFinite(n) && n > 0) this.config.cli_invocation.idle_timeout_seconds = n;
    }
    const totalEnv = process.env.JANUMICODE_CLI_TIMEOUT_SECONDS;
    if (totalEnv) {
      const n = Number.parseInt(totalEnv, 10);
      if (Number.isFinite(n) && n > 0) this.config.cli_invocation.timeout_seconds = n;
    }

    if (workspacePath) {
      this.loadOverrides(workspacePath);
    }
  }

  /**
   * Load overrides from .janumicode/config.json if it exists.
   * Merges shallowly — top-level keys only.
   */
  private loadOverrides(workspacePath: string): void {
    const configPath = join(workspacePath, '.janumicode', 'config.json');
    if (!existsSync(configPath)) return;

    try {
      const raw = readFileSync(configPath, 'utf-8');
      const overrides = JSON.parse(raw);
      this.config = this.deepMerge(
        this.config as unknown as Record<string, unknown>,
        overrides,
      ) as unknown as JanumiCodeConfig;
    } catch (err) {
      getLogger().warn('activation', `Failed to load config overrides`, {
        path: configPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Deep merge source into target. Source values override target.
   */
  private deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const targetVal = (target as Record<string, unknown>)[key];
      const sourceVal = source[key];
      if (
        targetVal && sourceVal &&
        typeof targetVal === 'object' && typeof sourceVal === 'object' &&
        !Array.isArray(targetVal) && !Array.isArray(sourceVal)
      ) {
        (result as Record<string, unknown>)[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceVal;
      }
    }
    return result;
  }

  get(): JanumiCodeConfig {
    return this.config;
  }

  getWorkflow() { return this.config.workflow; }
  getGovernedStream() { return this.config.governed_stream; }
  getContextAssembly() { return this.config.context_assembly; }
  getInvariantLibrary() { return this.config.invariant_library; }
  getCLIInvocation() { return this.config.cli_invocation; }
  getLLMRouting() { return this.config.llm_routing; }

  /**
   * Resolve the `{ provider, model, baseUrl? }` for a routing role with
   * NO literal fallback — throws if the role lacks a `direct_llm_api`
   * primary with a populated model. Use this anywhere production code
   * needs a model name; never hardcode `'gpt-oss:20b'` (or any model
   * literal) again. Roles that have a `direct_llm_api` primary today:
   * `orchestrator`, `domain_interpreter`, `requirements_agent`. The
   * `executor` role uses a CLI backing tool, not a direct API, so its
   * `model` field is for the embedded CLI subprocess.
   *
   * Failure to set the role in config surfaces loudly at first call
   * rather than silently routing through a stale literal default.
   */
  getRoutingModel(role: 'orchestrator' | 'domain_interpreter' | 'requirements_agent'): {
    provider: string; model: string; baseUrl?: string;
  } {
    const routing = this.config.llm_routing[role];
    const primary = (routing as { primary?: { backing_tool: string; provider?: string; model?: string; base_url?: string } } | undefined)?.primary;
    if (!primary || primary.backing_tool !== 'direct_llm_api' || !primary.provider || !primary.model) {
      throw new Error(
        `llm_routing.${role}.primary must be a direct_llm_api routing with provider+model set. ` +
        `Got: ${JSON.stringify(primary)}. Fix in .janumicode/config.json or DEFAULT_CONFIG.`,
      );
    }
    return { provider: primary.provider, model: primary.model, baseUrl: primary.base_url };
  }

  /**
   * Override `llm_routing.orchestrator` at runtime. Used by
   * createTestEngine to steer the Orchestrator role to a mock or a
   * specific CLI backing without requiring a `.janumicode/config.json`
   * on disk. Production callers should prefer a workspace config file;
   * this method is here so tests don't have to touch the filesystem
   * just to change a one-field routing.
   */
  setOrchestratorRouting(override: JanumiCodeConfig['llm_routing']['orchestrator']): void {
    this.config.llm_routing.orchestrator = override;
  }

  /**
   * Override `llm_routing.domain_interpreter` at runtime. Mirrors
   * `setOrchestratorRouting`. Used by the CLI runner (env-var driven)
   * and by tests that route Phase 1 bloom + 1.6 narrative calls through
   * a non-default backing.
   */
  setDomainInterpreterRouting(override: NonNullable<JanumiCodeConfig['llm_routing']['domain_interpreter']>): void {
    this.config.llm_routing.domain_interpreter = override;
  }

  /**
   * Override `llm_routing.requirements_agent` at runtime. Mirrors
   * `setOrchestratorRouting` and `setDomainInterpreterRouting`. Used by
   * the CLI runner (env-var driven) and by tests that route Phase 2
   * FR/NFR bloom calls through a non-default backing.
   */
  setRequirementsAgentRouting(override: NonNullable<JanumiCodeConfig['llm_routing']['requirements_agent']>): void {
    this.config.llm_routing.requirements_agent = override;
  }

  /**
   * Override fields on the `decomposition` block at runtime. Used by
   * `--thin-slice` mode to tighten depth/fanout/budget caps and limit
   * root counts so a calibration run exercises every prompt template
   * end-to-end without saturating fully. Only the fields present in
   * `override` are touched; other fields keep their existing values.
   */
  setDecompositionOverrides(override: Partial<JanumiCodeConfig['decomposition']>): void {
    this.config.decomposition = { ...this.config.decomposition, ...override };
  }

  /**
   * Override fields on the `workflow` block at runtime. Used by
   * `--thin-slice` mode to extend the records-idle stall window so a
   * single legitimate slow LLM call (Phase 1 bloom prompts can take
   * several minutes of verbose-but-converging output on qwen3.5:9b)
   * doesn't trip the stall detector. Mirrors `setDecompositionOverrides`.
   */
  setWorkflowOverrides(override: Partial<JanumiCodeConfig['workflow']>): void {
    this.config.workflow = { ...this.config.workflow, ...override };
  }

  /**
   * Validate that every provider referenced in `llm_routing` is actually
   * registered with the LLMCaller. Called by OrchestratorEngine at startup
   * once all providers have been registered.
   *
   * Returns an array of validation errors. Empty = OK. A non-empty result
   * should be treated as a fatal misconfiguration: correctness-validation
   * roles (Reasoning Review, Domain Compliance Review) cannot fall back
   * silently without undermining the system's trust model.
   */
  validateLLMRouting(
    registeredProviders: ReadonlySet<string>,
    registeredBackingTools: ReadonlySet<string> = new Set(),
  ): string[] {
    const errors: string[] = [];
    const routing = this.config.llm_routing;
    if (!routing) return errors;

    // Orchestrator — direct_llm_api requires a provider; CLI backing
    // tools require a registered parser (via registerBuiltinCLIParsers).
    // The backing_tool check stays a warning when the parser set is
    // empty (opt-in surface) so mock-mode tests don't fail on config
    // validation alone.
    // Shared validator for any role entry that accepts the same backing
    // shape (orchestrator + domain_interpreter + requirements_agent today).
    const validateRolePrimary = (
      role: 'orchestrator' | 'domain_interpreter' | 'requirements_agent',
      primary: { backing_tool: string; provider?: string; model?: string } | undefined,
    ): void => {
      if (!primary) return;
      const tool = primary.backing_tool;
      if (tool === 'direct_llm_api') {
        if (!primary.provider) {
          errors.push(
            `llm_routing.${role}.primary.backing_tool='direct_llm_api' requires ` +
            `a 'provider' field. Fix: set llm_routing.${role}.primary.provider ` +
            `(e.g. 'ollama') in .janumicode/config.json.`,
          );
        } else if (!registeredProviders.has(primary.provider)) {
          errors.push(
            `llm_routing.${role}.primary references provider '${primary.provider}' ` +
            `which is not registered. Registered: ${Array.from(registeredProviders).sort((a, b) => a.localeCompare(b)).join(', ')}.`,
          );
        }
      } else if (
        tool !== 'claude_code_cli' &&
        tool !== 'gemini_cli' &&
        tool !== 'goose_cli' &&
        tool !== 'codex_cli' &&
        tool !== 'openai_codex_cli'
      ) {
        errors.push(
          `llm_routing.${role}.primary.backing_tool='${tool}' is not a supported ` +
          `backing tool. Use 'direct_llm_api', 'claude_code_cli', 'gemini_cli', ` +
          `'goose_cli', or 'codex_cli'.`,
        );
      } else if (registeredBackingTools.size > 0) {
        // 'openai_codex_cli' is an alias for 'codex_cli' — accept both at
        // the config surface; runtime uses codex_cli in agentInvoker.
        const effective = tool === 'openai_codex_cli' ? 'codex_cli' : tool;
        if (!registeredBackingTools.has(effective)) {
          errors.push(
            `llm_routing.${role}.primary.backing_tool='${tool}' has no output ` +
            `parser registered. Fix: call engine.registerBuiltinCLIParsers() before ` +
            `executing a phase that invokes the ${role} role.`,
          );
        }
      }
    };
    validateRolePrimary('orchestrator', routing.orchestrator?.primary);
    validateRolePrimary('domain_interpreter', routing.domain_interpreter?.primary);
    validateRolePrimary('requirements_agent', routing.requirements_agent?.primary);

    const rr = routing.reasoning_review;
    if (rr?.primary && !registeredProviders.has(rr.primary.provider)) {
      errors.push(
        `llm_routing.reasoning_review.primary references provider '${rr.primary.provider}' ` +
        `which is not registered. Registered providers: ${Array.from(registeredProviders).sort().join(', ')}. ` +
        `Fix: either register the '${rr.primary.provider}' provider adapter at startup, ` +
        `or override llm_routing.reasoning_review.primary.provider in .janumicode/config.json.`,
      );
    }
    if (rr?.fallback && !registeredProviders.has(rr.fallback.provider)) {
      errors.push(
        `llm_routing.reasoning_review.fallback references provider '${rr.fallback.provider}' ` +
        `which is not registered. Registered: ${Array.from(registeredProviders).sort().join(', ')}.`,
      );
    }
    if (rr?.ensemble?.enabled && !registeredProviders.has(rr.ensemble.secondary.provider)) {
      errors.push(
        `llm_routing.reasoning_review.ensemble.secondary references provider ` +
        `'${rr.ensemble.secondary.provider}' which is not registered.`,
      );
    }
    return errors;
  }
}
