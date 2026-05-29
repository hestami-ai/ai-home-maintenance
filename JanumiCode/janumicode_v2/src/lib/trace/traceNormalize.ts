/**
 * Thin pass-through helpers retained from the pre-AODD era for the
 * (small) set of phase-1 normalizer call-sites that still invoke them.
 *
 * Previously these wrapped a normalizer call with a `normalized`
 * `transformation_step` emit. The legacy transforms.jsonl stream has
 * been retired (see docs/design/aodd-parity-matrix.md), and the AODD
 * registry has no `context.normalized` counterpart — normalizers are
 * deterministic transforms; their inputs and outputs already flow
 * through AODD via the prompt.* / llm.* / record.* events that bracket
 * them.
 *
 * These helpers are kept as pass-throughs so the existing call-sites
 * don't need touching. They can be replaced with direct normalizer
 * calls in a follow-up cleanup.
 */

export interface TraceNormalizeOptions {
  /** Reserved for backwards compatibility. Unused. */
  subPhaseId?: string;
  /** Reserved for backwards compatibility. Unused. */
  sourceRecordId?: string;
  /** Reserved for backwards compatibility. Unused. */
  capturePayload?: boolean;
}

/**
 * Pass-through: returns `output` unchanged. Originally emitted a
 * `normalized` transformation_step capturing the input → output diff.
 */
export function traceNormalize<I, O>(
  _normalizer: string,
  _input: I,
  output: O,
  _opts: TraceNormalizeOptions = {},
): O {
  return output;
}

/**
 * Pass-through: runs `fn(input)` and returns the result. Originally
 * wrapped the call to capture inputs/outputs plus any throw.
 */
export function traceNormalizeFn<I, O>(
  _normalizer: string,
  input: I,
  fn: (input: I) => O,
  _opts: TraceNormalizeOptions = {},
): O {
  return fn(input);
}
