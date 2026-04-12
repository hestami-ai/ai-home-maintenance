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
};

// ── ConfigManager ───────────────────────────────────────────────────

export class ConfigManager {
  private config: JanumiCodeConfig;

  constructor(workspacePath?: string) {
    this.config = { ...DEFAULT_CONFIG };

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
}
