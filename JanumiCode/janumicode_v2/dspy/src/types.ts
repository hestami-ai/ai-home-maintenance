/**
 * Shared types for the DSPy prompt-optimization harness.
 */

/** One harvested training example: the rendered input + the recorded model output. */
export interface TrainExample {
  /** agent_invocation record id (provenance). */
  invocationId: string;
  /** Human-readable label, e.g. "fr_saturation Pass-1 — decomposition of US-001". */
  label: string;
  agentRole: string;
  subPhaseId: string;
  /** The rendered user prompt (full template body with variables substituted). */
  prompt: string;
  /** The system prompt, if any (usually null for these calls). */
  system: string | null;
  /** The model's recorded output text (raw). */
  recordedOutputText: string;
  provider: string;
  model: string;
}

/** Per-validator finding rollup. */
export interface ValidatorRollup {
  validatorId: string;
  high: number;
  medium: number;
  low: number;
  summaries: string[];
}

/** Result of scoring one candidate output. */
export interface ScoreResult {
  score: number;          // 0..1, higher is better
  parseOk: boolean;
  penalty: number;
  byValidator: ValidatorRollup[];
  totalFindings: number;
}
