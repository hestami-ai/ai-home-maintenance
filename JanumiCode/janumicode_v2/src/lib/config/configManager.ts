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
      };
      temperature?: number;
    };
    /**
     * Domain Interpreter role — Phase 1 product-lens bloom rounds (1.0b
     * discovery, 1.2 domains, 1.3 journeys, 1.4 entities, 1.5 integrations,
     * 1.6 narrative refinement) and Phase 1 default-lens bloom/synthesis.
     * Optional so legacy configs keep working; falls back to
     * `{ backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' }`
     * when absent.
     */
    domain_interpreter?: {
      primary: {
        backing_tool: string;
        provider?: string;
        model?: string;
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
      };
      temperature?: number;
    };
    reasoning_review: {
      /** Primary provider + model used for ReasoningReview LLM calls. */
      primary: { provider: string; model: string };
      /** Temperature for reasoning review; should be low for deterministic output. */
      temperature: number;
      /** Max tokens of trace to include in the review prompt. */
      trace_max_tokens: number;
      /** Optional fallback if primary fails. */
      fallback?: { provider: string; model: string };
      /** Ensemble config (future — not yet used). */
      ensemble?: {
        enabled: boolean;
        secondary: { provider: string; model: string };
      };
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
      detail_file_path_template: '.janumicode/context/{sub_phase_id}_{invocation_id}.md',
      detail_file_cleanup: 'archive_after_phase_gate',
      detail_file_max_bytes: 10485760, // 10MB
      governing_constraints_always_in_stdin: true,
      hard_stop_on_governing_constraint_overflow: true,
    },
  },

  invariant_library: {
    path: '.janumicode/schemas/invariants',
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
    buffer_max_events: 1000,
  },

  decomposition: {
    depth_cap: 10,
    budget_cap: 500,
    fanout_cap: 8,
    mirror_gate_depth: 2,
    reasoning_review_on_tier_c: false,
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
    // Default: local Ollama with qwen3.5:9b. Suitable for fixture-based
    // mock tests and single-phase dev runs; override to a capable CLI
    // backing for gold-capture / real-mode harness runs (see the CLI
    // runner env-var wiring).
    domain_interpreter: {
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    },
    // Requirements Agent default — matches domain_interpreter. Override
    // via JANUMICODE_REQUIREMENTS_AGENT_BACKING for CLI-backed runs.
    requirements_agent: {
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
      temperature: 0.5,
    },
    reasoning_review: {
      primary: { provider: 'google', model: 'gemini-2.5-flash' },
      temperature: 0.2,
      trace_max_tokens: 8000,
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
