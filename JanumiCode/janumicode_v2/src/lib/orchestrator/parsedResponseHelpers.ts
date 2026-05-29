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
 *   4. `{ <kind_name>: { <schema_key>: [item, ...] } }` (DOUBLE envelope)
 *
 * Walk the candidate keys in order at the top level first. If a
 * candidate yields an object (not an array), recurse one level: look
 * for any of the remaining candidate keys INSIDE that object. This
 * handles shape #4 — observed for gpt-oss:20b at interface_contracts
 * (ts-103) and system_requirements (ts-107) where the model wraps
 * the items array under BOTH the kind name AND the schema key.
 *
 * Returns null when no resolution succeeds — caller decides whether
 * to fall back to a placeholder or surface an error.
 *
 * Order matters: list the kind-name envelope first, schema key
 * second. When the model emits *both* at the top level (rare but
 * observed on long outputs), the kind-name envelope is the primary
 * payload; the schema-key envelope tends to be a partial summary.
 */
function findArrayAtKeys<T>(
  obj: Record<string, unknown>,
  keys: string[],
  exclude?: string,
): T[] | null {
  for (const k of keys) {
    if (k === exclude) continue;
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) return v as T[];
  }
  return null;
}

export function pickItemsArray<T>(
  parsed: Record<string, unknown> | null | undefined,
  candidateKeys: string[],
): T[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed as T[];
  const root = parsed as Record<string, unknown>;
  // Pass 1: flat — array directly under one of the candidate keys.
  const flat = findArrayAtKeys<T>(root, candidateKeys);
  if (flat) return flat;
  // Pass 2: double-envelope — `{ outer: { inner: [...] } }`.
  for (const outer of candidateKeys) {
    const v = root[outer];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const nested = findArrayAtKeys<T>(v as Record<string, unknown>, candidateKeys, outer);
    if (nested) return nested;
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
