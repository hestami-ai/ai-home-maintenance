/**
 * Hardcoded default configuration values.
 * Based on JanumiCode Spec v2.3, §10.
 *
 * Separated from ConfigManager for testability and clarity.
 */

import type { JanumiCodeConfig } from './configManager';

export const DEFAULT_CONFIG: JanumiCodeConfig = {
  schema_version: '1.2',
  workspace_id: '',
  janumicode_version_sha: 'dev',

  governed_stream: {
    sqlite_path: '.janumicode/governed_stream.db',
    vector_extension: 'sqlite-vec',
    enable_vector_search: false,
  },

  context_assembly: {
    cli_agents: {
      stdin_max_tokens: 8000,
      detail_file_path_template: '.janumicode/context/{sub_phase_id}_{invocation_id}.md',
      detail_file_cleanup: 'archive_after_phase_gate',
      detail_file_max_bytes: 10_485_760,
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

  llm_routing: {
    reasoning_review: {
      primary: { provider: 'google', model: 'gemini-2.0-flash-thinking' },
      temperature: 0.2,
      trace_max_tokens: 8000,
    },
  },
};
