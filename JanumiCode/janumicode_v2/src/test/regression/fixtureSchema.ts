/**
 * Fixture schema for the regression test suite.
 *
 * A fixture pins one (template, sub_phase) invocation: the rendered
 * variables, the historical response (as a baseline + diff target), the
 * invocation parameters (model/temperature/etc.), and the assertion
 * block that defines the regression contract.
 *
 * The **assertion block is the source of truth.** The historical
 * baseline is a sanity check; the regression contract is what's in
 * `assertions`, not what the LLM produced last time.
 *
 * Layers (T1-T4 in the README):
 *   T1 — schema     : response is valid JSON of the expected shape
 *   T2 — preservation: every input ID that should appear in output does
 *   T3 — invariants : counted properties, forbidden patterns
 *   T4 — LLM-judge  : NOT IN V1 (stretch goal)
 */
import { z } from 'zod';

// ── Invocation params ──────────────────────────────────────────────

export const InvocationParamsSchema = z.object({
  /** Provider name as known to LLMCaller (e.g. 'llamacpp', 'ollama'). */
  provider: z.string(),
  model: z.string(),
  /** Optional base URL override; honored by providers that support it. */
  base_url: z.string().url().optional(),
  /** Sampling temperature — must match the baseline to compare apples-to-apples. */
  temperature: z.number().min(0).max(2),
  /** Response shape JSON or text. Defaults to 'text'. */
  response_format: z.enum(['json', 'text']).default('text'),
  /** Optional max tokens cap; uses provider default when absent. */
  max_tokens: z.number().int().positive().optional(),
});
export type InvocationParams = z.infer<typeof InvocationParamsSchema>;

// ── Template reference ─────────────────────────────────────────────

export const TemplateRefSchema = z.object({
  /** Agent role from the template's frontmatter. */
  agent_role: z.string(),
  /** Sub-phase id from the template's frontmatter. */
  sub_phase: z.string(),
  /** Optional lens discriminator (frontmatter `lens:` — e.g. `product`). */
  lens: z.string().optional(),
});
export type TemplateRef = z.infer<typeof TemplateRefSchema>;

// ── T1 Schema assertion ────────────────────────────────────────────

export const T1SchemaAssertionSchema = z.object({
  /** Type of schema check. Currently `json-shape` only; future: 'json-schema-ref'. */
  kind: z.enum(['json-shape']),
  /**
   * For 'json-shape': a structural fingerprint as a path-to-type map.
   * Keys are dot/bracket JSON paths; values are expected type names.
   *
   * Examples:
   *   "tasks": "array"
   *   "tasks[].id": "string"
   *   "tasks[].component_id": "string"
   *   "tasks[].completion_criteria[].verification_method": "string"
   */
  shape: z.record(z.string(), z.enum([
    'string', 'number', 'boolean', 'array', 'object', 'null',
  ])),
  /**
   * Optional list of required top-level paths. If the response parses
   * but is missing one of these, T1 fails. Defaults to all keys in
   * `shape` whose value isn't paired with an `array[]` indicator.
   */
  required_paths: z.array(z.string()).optional(),
});
export type T1SchemaAssertion = z.infer<typeof T1SchemaAssertionSchema>;

// ── T2 ID-preservation assertion ────────────────────────────────────

export const T2IdPreservationAssertionSchema = z.object({
  /** Human-readable name for the rule (shown on failure). */
  name: z.string(),
  /**
   * JSONPath into the input/template_variables space pointing at the
   * set of IDs that must be preserved. E.g.,
   * "component_model.components[].id" — but since variables are strings,
   * we provide a `extract` regex too.
   *
   * For string variables, IDs are extracted via regex match. For object
   * variables, IDs are extracted via JSONPath.
   */
  input_source: z.object({
    /** Variable name in template_variables. */
    variable: z.string(),
    /** Regex to extract IDs from the variable's text representation. */
    id_pattern: z.string(),
  }),
  /**
   * Where in the OUTPUT those IDs must appear.
   *
   * mode='all_in_field' — every input id must appear as a value at the path.
   *   path: 'tasks[].component_id' means at least one task has each id.
   * mode='subset_match' — input IDs that appear MUST match output IDs
   *   verbatim (catches prefix drift like comp-X vs X).
   */
  output_assertion: z.object({
    mode: z.enum(['all_in_field', 'subset_match']),
    /** JSONPath into parsed_json. */
    path: z.string(),
    /** Optional minimum match ratio (0-1). Defaults to 1.0 for all_in_field. */
    min_match_ratio: z.number().min(0).max(1).optional(),
  }),
});
export type T2IdPreservationAssertion = z.infer<typeof T2IdPreservationAssertionSchema>;

// ── T3 Counted-invariant assertion ─────────────────────────────────

export const T3InvariantAssertionSchema = z.object({
  /** Human-readable name. */
  name: z.string(),
  /** Type of invariant. */
  kind: z.enum([
    'array_length',          // require array length >= min / <= max
    'forbidden_value_pattern', // values at path must not match regex
    'required_value_pattern',  // values at path must match regex
    'enum_subset',             // values at path must be in given set
    'unique_values',           // values at path must be unique
  ]),
  /** JSONPath into parsed_json. */
  path: z.string(),
  /** Inclusive minimum (for array_length). */
  min: z.number().int().nonnegative().optional(),
  /** Inclusive maximum (for array_length). */
  max: z.number().int().nonnegative().optional(),
  /** Regex pattern (for *_pattern kinds). */
  pattern: z.string().optional(),
  /** Allowed values (for enum_subset). */
  allowed: z.array(z.string()).optional(),
  /** Optional explanation shown on failure. */
  rationale: z.string().optional(),
});
export type T3InvariantAssertion = z.infer<typeof T3InvariantAssertionSchema>;

// ── Assertion block ─────────────────────────────────────────────────

export const AssertionBlockSchema = z.object({
  t1_schema: T1SchemaAssertionSchema.optional(),
  t2_id_preservation: z.array(T2IdPreservationAssertionSchema).default([]),
  t3_invariants: z.array(T3InvariantAssertionSchema).default([]),
  /**
   * If true, the response must be parseable as JSON (independent of
   * t1_schema). Defaults to true when `invocation_params.response_format`
   * is 'json'.
   */
  require_json_parse: z.boolean().optional(),
});
export type AssertionBlock = z.infer<typeof AssertionBlockSchema>;

// ── Baseline response ──────────────────────────────────────────────

export const BaselineSchema = z.object({
  response_text: z.string(),
  /** Pre-parsed JSON (when response_format='json'). null when unparseable. */
  parsed_json: z.unknown().nullable(),
  duration_ms: z.number().int().nonnegative(),
  /** Optional captured thinking trace from the baseline invocation. */
  thinking: z.string().optional(),
});
export type Baseline = z.infer<typeof BaselineSchema>;

// ── Fixture ─────────────────────────────────────────────────────────

export const FixtureSchema = z.object({
  /** Stable identifier — used in test names + filenames. */
  fixture_id: z.string().regex(/^[a-z0-9_]+__[a-z0-9_-]+$/, {
    message: 'fixture_id format: <prompt_id>__<sample_slug>',
  }),
  /** Free-text purpose / what this fixture pins. */
  description: z.string().min(10),
  /** Workflow run id from the source thin-slice. */
  extracted_from_run: z.string(),
  /** Path to the source DB (relative to repo root) for traceability. */
  extracted_from_db: z.string(),
  /** ISO timestamp of extraction. */
  extracted_at: z.string().datetime(),
  /** Last rebaseline timestamp (set by `pnpm regression:rebaseline`). */
  last_rebaselined_at: z.string().datetime().optional(),
  template_ref: TemplateRefSchema,
  invocation_params: InvocationParamsSchema,
  template_variables: z.record(z.string(), z.string()),
  /**
   * Captured user message for templates dispatched via `makeLLMValidator`
   * (system prompt = rendered template, user prompt = audit material
   * built by serializeRuntimeForLLM). When present, the live runner sends
   * `system = rendered template` and `prompt = user_message` rather than
   * `prompt = rendered template`. Absent for standard producer templates
   * where the rendered template IS the user prompt.
   */
  user_message: z.string().optional(),
  baseline: BaselineSchema,
  assertions: AssertionBlockSchema,
});
export type Fixture = z.infer<typeof FixtureSchema>;

/**
 * Result of running assertions against a fresh response. Used by both
 * the deterministic layer (against baseline) and the live layer
 * (against fresh Ollama response).
 */
export interface AssertionResult {
  passed: boolean;
  /** One entry per assertion that ran (failures + passes). */
  checks: AssertionCheck[];
}

export interface AssertionCheck {
  tier: 'T1' | 'T2' | 'T3';
  name: string;
  passed: boolean;
  /** Detail on failure (e.g., expected vs. actual). Empty on pass. */
  detail?: string;
}
