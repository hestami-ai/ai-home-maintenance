/**
 * Thin wrapper for normalizers that emits a `normalized` transformation
 * step with the input/output field-diff. Designed to be the smallest
 * possible touchpoint at every existing normalizer call site:
 *
 *   // Before:
 *   const normalized = normalizeFRBloom(raw);
 *
 *   // After:
 *   const normalized = traceNormalize('phase1.fr_bloom', raw, normalizeFRBloom(raw));
 *
 * Or, when the normalizer accepts its own input:
 *
 *   const normalized = traceNormalizeFn('phase1.fr_bloom', raw, normalizeFRBloom);
 *
 * Either form emits a single `normalized` step whose `field_diff`
 * highlights silent drops, renames, and size changes — the most common
 * shapes of normalizer bugs. See feedback_normalizer_case_dual_keys.md
 * for the snake_case ↔ camelCase footgun this is designed to catch.
 */

import { computeFieldDiff, fieldDiffIsEmpty } from './fieldDiff';
import { emitTransformationStep } from './emit';

export interface TraceNormalizeOptions {
  /** Optional sub_phase_id override; defaults to the current TraceCtx. */
  subPhaseId?: string;
  /** Optional record id this normalization was sourced from. */
  sourceRecordId?: string;
  /** Persist input/output to the per-step payload file. Defaults to true. */
  capturePayload?: boolean;
}

/**
 * Emits a `normalized` step for an input → output transformation. Returns
 * `output` so this is a transparent pass-through at the call site.
 */
export function traceNormalize<I, O>(
  normalizer: string,
  input: I,
  output: O,
  opts: TraceNormalizeOptions = {},
): O {
  const diff = computeFieldDiff(input, output);
  emitTransformationStep({
    step_type: 'normalized',
    sub_phase_id_override: opts.subPhaseId,
    input_record_ids: opts.sourceRecordId ? [opts.sourceRecordId] : [],
    payload: (opts.capturePayload ?? true) ? { input, output } : undefined,
    field_diff: fieldDiffIsEmpty(diff) ? undefined : diff,
    metadata: {
      normalizer,
      input_top_keys: topLevelKeys(input),
      output_top_keys: topLevelKeys(output),
    },
  });
  return output;
}

/**
 * Companion form that owns the normalizer call. Useful when the call
 * site looks like `normalizeX(raw)` and wrapping both sides is awkward.
 *
 * Catches throws and re-throws after emitting a step with the error
 * field set, so a normalizer that crashes shows up in the trace.
 */
export function traceNormalizeFn<I, O>(
  normalizer: string,
  input: I,
  fn: (input: I) => O,
  opts: TraceNormalizeOptions = {},
): O {
  let output: O;
  try {
    output = fn(input);
  } catch (err) {
    emitTransformationStep({
      step_type: 'normalized',
      sub_phase_id_override: opts.subPhaseId,
      input_record_ids: opts.sourceRecordId ? [opts.sourceRecordId] : [],
      payload: (opts.capturePayload ?? true) ? { input } : undefined,
      error: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      metadata: {
        normalizer,
        input_top_keys: topLevelKeys(input),
        output_top_keys: [],
      },
    });
    throw err;
  }
  return traceNormalize(normalizer, input, output, opts);
}

function topLevelKeys(v: unknown): string[] {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return [];
  return Object.keys(v);
}
