/**
 * Helpers for resolving structured payloads out of LLM JSON responses
 * that may wrap their data under different envelope keys than the
 * persisted-artifact schema uses.
 *
 * Why this exists
 * ───────────────
 * cal-21's Phase 3.2 system_requirements derivation lost 16 substantive
 * SRs (and 554 traceability links) because qwen-3.5:9b emitted
 * `{ system_requirements: [...] }` while the orchestrator parser
 * checked for `{ items: [...] }`. The "envelope key" the model
 * naturally writes (the artifact kind name) doesn't always match the
 * "schema key" the persisted record uses for the items array.
 *
 * The same shape mismatch is plausible across every Phase 3-6 parser
 * (Phase 4 software_domains/components/adrs, Phase 5 data_models/
 * api_definitions/error_handling_strategies/configuration_parameters,
 * Phase 6 implementation_plan tasks). Lifting these helpers here lets
 * each phase parser stop reinventing defensive resolution and just
 * declare its candidate keys.
 */

/**
 * Resolve an array of items from an LLM JSON response, tolerating
 * envelope-key vs schema-key mismatches.
 *
 * The model has been observed to emit any of these shapes on any
 * given run, sometimes varying between retries within a single phase:
 *   1. `{ <kind_name>: [item, item, ...] }`   (envelope = kind name)
 *   2. `{ <schema_key>: [item, item, ...] }`  (envelope = schema property name)
 *   3. `[item, item, ...]`                    (no envelope)
 *
 * Walk the candidate keys in order; first non-empty array wins. Falls
 * through to the parsed root if the root itself is an array (case 3).
 * Returns null when no resolution succeeds — caller decides whether
 * to fall back to a placeholder or surface an error.
 *
 * Order matters: list the kind-name envelope first, schema key
 * second. When the model emits *both* (which has happened on long
 * outputs), the kind-name envelope is the primary payload; the
 * schema-key envelope tends to be a partial summary.
 */
export function pickItemsArray<T>(
  parsed: Record<string, unknown> | null | undefined,
  candidateKeys: string[],
): T[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed as T[];
  for (const k of candidateKeys) {
    const v = (parsed as Record<string, unknown>)[k];
    if (Array.isArray(v) && v.length > 0) return v as T[];
  }
  return null;
}

/**
 * Resolve a single object envelope, tolerating the agent emitting it
 * either nested under a candidate key (e.g. `{ system_boundary: {...} }`)
 * or at the top level (e.g. `{ in_scope: [...], external_systems: [...] }`).
 *
 * Picks the first candidate key that holds an object; otherwise
 * returns the parsed root itself (caller must still check that the
 * root carries the expected fields).
 */
export function pickEnvelope<T>(
  parsed: Record<string, unknown> | null | undefined,
  candidateKeys: string[],
): T | null {
  if (!parsed) return null;
  for (const k of candidateKeys) {
    const v = (parsed as Record<string, unknown>)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  }
  return parsed as T;
}
